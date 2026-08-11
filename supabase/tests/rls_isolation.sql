-- Run with `supabase test db` after adding pgTAP to local config.
begin;
select plan(4);
insert into auth.users(id, email) values ('00000000-0000-0000-0000-000000000001', 'learner-a@example.invalid'), ('00000000-0000-0000-0000-000000000002', 'learner-b@example.invalid');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::int from public.profiles), 1, 'learner A sees one profile');
select is((select auth_user_id from public.profiles), '00000000-0000-0000-0000-000000000001'::uuid, 'learner A sees only their profile');
select is((with changed as (update public.profiles set display_name = 'intrusion' where auth_user_id = '00000000-0000-0000-0000-000000000002' returning id) select count(*)::int from changed), 0, 'learner A cannot update learner B');
select is((with inserted as (insert into public.progress_events(id, profile_id, device_id, event_type, entity_id, client_created_at) select gen_random_uuid(), id, 'bad', 'lesson_started', 'mx71.d01', now() from public.profiles where auth_user_id = '00000000-0000-0000-0000-000000000002' returning id) select count(*)::int from inserted), 0, 'learner A cannot insert events for learner B');
select * from finish();
rollback;
