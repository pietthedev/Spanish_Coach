-- Drive Mode records hands-free commute sessions. Phrase mastery still flows
-- through phrase_reviewed events, so this only widens the event vocabulary.

alter table public.progress_events
  drop constraint if exists progress_events_event_type_check;

alter table public.progress_events
  add constraint progress_events_event_type_check
  check (
    event_type in (
      'lesson_started',
      'lesson_completed',
      'phrase_reviewed',
      'mission_completed',
      'drive_session_completed'
    )
  );
