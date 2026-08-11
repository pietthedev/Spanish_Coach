-- ============================================================================
-- SUPABASE MIGRATIONS FOR SPANISH COACH
-- ============================================================================
-- These migrations set up the core tables for learner progress tracking.
-- All tables have Row Level Security (RLS) enabled.
-- Policies restrict access to authenticated owners only.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_id TEXT DEFAULT 'default',
  total_travel_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile (on first login)
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Learner'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- LESSON PROGRESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  current_exercise_index INTEGER,
  score INTEGER DEFAULT 0,
  travel_points_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Indexes for lesson progress
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_status ON lesson_progress(status);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_day ON lesson_progress(day_number);

-- RLS for lesson_progress
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Only owner can read
CREATE POLICY lesson_progress_select_own ON lesson_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Only owner can insert
CREATE POLICY lesson_progress_insert_own ON lesson_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Only owner can update
CREATE POLICY lesson_progress_update_own ON lesson_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Only owner can delete
CREATE POLICY lesson_progress_delete_own ON lesson_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PHRASE MASTERY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS phrase_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phrase_id TEXT NOT NULL,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 5),
  interval_index INTEGER DEFAULT 0,
  ease_factor NUMERIC DEFAULT 2.5,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_reviewed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phrase_id)
);

-- Indexes for phrase mastery
CREATE INDEX IF NOT EXISTS idx_phrase_mastery_user_id ON phrase_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_mastery_next_review ON phrase_mastery(next_review_date);

-- RLS for phrase_mastery
ALTER TABLE phrase_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY phrase_mastery_select_own ON phrase_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY phrase_mastery_insert_own ON phrase_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY phrase_mastery_update_own ON phrase_mastery
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY phrase_mastery_delete_own ON phrase_mastery
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- ATTEMPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('exercise', 'phrase', 'mission_step')),
  result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect', 'partial', 'technical_failure')),
  confidence NUMERIC,
  transcript TEXT,
  expected_answer TEXT,
  event_uuid UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attempts
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_content_id ON attempts(content_id);
CREATE INDEX IF NOT EXISTS idx_attempts_event_uuid ON attempts(event_uuid);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON attempts(created_at);

-- RLS for attempts
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY attempts_select_own ON attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY attempts_insert_own ON attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update or delete policies - attempts are immutable

-- ============================================================================
-- SCENARIO RUNS TABLE (Mission Progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  run_number INTEGER NOT NULL,
  current_state_id TEXT,
  visited_states TEXT[] DEFAULT '{}',
  total_failures INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  is_success BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  event_uuid UUID NOT NULL UNIQUE,
  UNIQUE(user_id, mission_id, run_number)
);

-- Indexes for scenario runs
CREATE INDEX IF NOT EXISTS idx_scenario_runs_user_id ON scenario_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_mission_id ON scenario_runs(mission_id);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_event_uuid ON scenario_runs(event_uuid);

-- RLS for scenario_runs
ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenario_runs_select_own ON scenario_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY scenario_runs_insert_own ON scenario_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY scenario_runs_update_own ON scenario_runs
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- PROGRESS EVENTS TABLE (Outbox for Sync)
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_events (
  event_uuid UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'lesson_completed', 'phrase_reviewed', 'achievement_unlocked',
    'points_earned', 'mission_completed', 'streak_updated'
  )),
  payload JSONB NOT NULL DEFAULT '{}',
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'acknowledged', 'failed')),
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for progress events
CREATE INDEX IF NOT EXISTS idx_progress_events_user_id ON progress_events(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_events_sync_status ON progress_events(sync_status);
CREATE INDEX IF NOT EXISTS idx_progress_events_created_at ON progress_events(created_at);

-- RLS for progress_events
ALTER TABLE progress_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY progress_events_select_own ON progress_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY progress_events_insert_own ON progress_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY progress_events_update_own ON progress_events
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to prevent duplicate event UUIDs
CREATE OR REPLACE FUNCTION prevent_duplicate_event()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM progress_events
    WHERE event_uuid = NEW.event_uuid
    AND sync_status = 'acknowledged'
  ) THEN
    RETURN NULL; -- Skip duplicate
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for deduplication
CREATE TRIGGER trg_prevent_duplicate_event
  BEFORE INSERT ON progress_events
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_event();

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  is_unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Index for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_unlocked ON achievements(is_unlocked);

-- RLS for achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY achievements_select_own ON achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY achievements_insert_own ON achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY achievements_update_own ON achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- FAVOURITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phrase_id TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phrase_id)
);

-- Index for favourites
CREATE INDEX IF NOT EXISTS idx_favourites_user_id ON favourites(user_id);

-- RLS for favourites
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY favourites_select_own ON favourites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY favourites_insert_own ON favourites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY favourites_delete_own ON favourites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- CATEGORY READINESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_readiness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  readiness_score INTEGER DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
  phrases_mastered INTEGER DEFAULT 0,
  total_phrases INTEGER DEFAULT 0,
  confidence_band TEXT DEFAULT 'low' CHECK (confidence_band IN ('low', 'medium', 'high')),
  last_assessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- Index for category readiness
CREATE INDEX IF NOT EXISTS idx_category_readiness_user_id ON category_readiness(user_id);

-- RLS for category_readiness
ALTER TABLE category_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_readiness_select_own ON category_readiness
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY category_readiness_insert_own ON category_readiness
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY category_readiness_update_own ON category_readiness
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- DEVICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for devices
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- RLS for devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY devices_select_own ON devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY devices_insert_own ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY devices_update_own ON devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY devices_delete_own ON devices
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_phrase_mastery_updated_at
  BEFORE UPDATE ON phrase_mastery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_category_readiness_updated_at
  BEFORE UPDATE ON category_readiness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
