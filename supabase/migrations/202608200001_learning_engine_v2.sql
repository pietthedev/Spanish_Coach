-- Learning Engine V2: record how much help the learner had, not just whether
-- they were correct. Additive only; existing rows keep their schedule.

alter table public.phrase_mastery
  add column if not exists independent_successes integer not null default 0,
  add column if not exists assisted_successes integer not null default 0,
  add column if not exists encounters integer not null default 0,
  add column if not exists last_assistance text,
  add column if not exists independent_days text[] not null default '{}';

-- Existing mastery predates retrieval-quality tracking, so treat prior
-- successes as assisted rather than crediting independent recall the learner
-- may never have demonstrated.
update public.phrase_mastery
  set assisted_successes = consecutive_successes,
      encounters = greatest(consecutive_successes, 1)
  where encounters = 0;
