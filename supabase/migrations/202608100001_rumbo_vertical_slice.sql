-- Rumbo seven-day vertical slice. Apply with the Supabase CLI or SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Traveller' check (char_length(display_name) between 1 and 60), timezone text not null default 'Africa/Johannesburg',
  course_version text not null default '2026.1', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, lesson_id text not null,
  status text not null check (status in ('started','completed')), started_at timestamptz not null default now(), completed_at timestamptz,
  points integer not null default 0 check (points between 0 and 100), content_version text not null default '2026.1', revision integer not null default 1,
  unique(profile_id, lesson_id)
);
create table public.phrase_mastery (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, phrase_id text not null,
  interval_step smallint not null default 0 check (interval_step between 0 and 5), due_at timestamptz not null default now(), consecutive_successes integer not null default 0,
  last_outcome text, updated_at timestamptz not null default now(), unique(profile_id, phrase_id)
);
create table public.attempts (
  id uuid primary key, profile_id uuid not null references public.profiles(id) on delete cascade, phrase_id text, exercise_id text,
  mode text not null check (mode in ('listening','speaking','retrieval')), outcome text not null,
  critical_error_code text, provider_status text, latency_ms integer, created_at timestamptz not null default now()
);
create table public.scenario_runs (
  id uuid primary key, profile_id uuid not null references public.profiles(id) on delete cascade, scenario_id text not null, scenario_version text not null,
  status text not null check (status in ('started','completed')), completed_intents text[] not null default '{}', hints integer not null default 0,
  repairs integer not null default 0, started_at timestamptz not null default now(), completed_at timestamptz
);
create table public.progress_events (
  id uuid primary key, profile_id uuid not null references public.profiles(id) on delete cascade, device_id text not null,
  event_type text not null check (event_type in ('lesson_started','lesson_completed','phrase_reviewed','mission_completed')), entity_id text not null,
  payload jsonb not null default '{}', client_created_at timestamptz not null, server_created_at timestamptz not null default now()
);
create table public.achievements (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, achievement_key text not null,
  earned_at timestamptz not null default now(), evidence_event_id uuid references public.progress_events(id), unique(profile_id, achievement_key)
);
create table public.favourites (
  profile_id uuid not null references public.profiles(id) on delete cascade, phrase_id text not null, created_at timestamptz not null default now(), primary key(profile_id, phrase_id)
);
create table public.category_readiness (
  profile_id uuid not null references public.profiles(id) on delete cascade, category text not null check (category in ('foundations','food','money','transport','directions','stay','problems','friendly-chat')),
  state text not null check (state in ('not-started','building','practised','trip-ready')), evidence_count integer not null default 0,
  explanation text not null default '', computed_at timestamptz not null default now(), primary key(profile_id, category)
);
create table public.devices (
  id text not null, profile_id uuid not null references public.profiles(id) on delete cascade, app_version text not null default '0.1.0',
  content_version text not null default '2026.1', last_sync_at timestamptz not null default now(), primary key(profile_id, id)
);

create index lesson_progress_profile_status_idx on public.lesson_progress(profile_id, status);
create index phrase_mastery_profile_due_idx on public.phrase_mastery(profile_id, due_at);
create index progress_events_profile_server_idx on public.progress_events(profile_id, server_created_at);

create or replace function public.current_profile_id() returns uuid language sql stable security invoker set search_path = '' as $$
  select id from public.profiles where auth_user_id = (select auth.uid()) limit 1
$$;
create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(auth_user_id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Traveller')) on conflict (auth_user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.phrase_mastery enable row level security;
alter table public.attempts enable row level security;
alter table public.scenario_runs enable row level security;
alter table public.progress_events enable row level security;
alter table public.achievements enable row level security;
alter table public.favourites enable row level security;
alter table public.category_readiness enable row level security;
alter table public.devices enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated using (auth_user_id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
create policy profiles_own_delete on public.profiles for delete to authenticated using (auth_user_id = (select auth.uid()));
create policy lesson_progress_own_all on public.lesson_progress for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy phrase_mastery_own_all on public.phrase_mastery for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy attempts_own_all on public.attempts for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy scenario_runs_own_all on public.scenario_runs for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy progress_events_own_all on public.progress_events for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy achievements_own_all on public.achievements for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy favourites_own_all on public.favourites for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy category_readiness_own_all on public.category_readiness for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));
create policy devices_own_all on public.devices for all to authenticated using (profile_id = (select public.current_profile_id())) with check (profile_id = (select public.current_profile_id()));

grant select, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.lesson_progress, public.phrase_mastery, public.attempts, public.scenario_runs,
  public.progress_events, public.achievements, public.favourites, public.category_readiness, public.devices to authenticated;
revoke all on all tables in schema public from anon;
