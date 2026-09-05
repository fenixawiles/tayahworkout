begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('41111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'reminder@example.com', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Reminder Test","time_zone":"America/Chicago"}', now(), now());
insert into public.notification_preferences (user_id, workout_reminder_enabled, consented_at) values ('41111111-1111-4111-8111-111111111111', true, now());
insert into public.day_plans (id, user_id, plan_date, title) values ('41111111-1111-4111-8111-111111111199', '41111111-1111-4111-8111-111111111111', date '2026-03-08', 'DST workout');
insert into public.day_exercises (id, day_plan_id, name_snapshot, category, sort_order) values ('41111111-1111-4111-8111-111111111188', '41111111-1111-4111-8111-111111111199', 'Walk', 'cardio', 0);

select ok(public.reminder_is_due('41111111-1111-4111-8111-111111111111', timestamptz '2026-03-08 22:05:00+00'), '5:05pm remains correct across the US spring DST transition');
select ok(not public.reminder_is_due('41111111-1111-4111-8111-111111111111', timestamptz '2026-03-08 21:59:00+00'), 'no reminder is due before 5pm local time');
select ok(not public.reminder_is_due('41111111-1111-4111-8111-111111111111', timestamptz '2026-03-08 23:00:00+00'), 'the dispatch window closes at 6pm local time');
insert into public.exercise_completions (day_exercise_id, completed_at) values ('41111111-1111-4111-8111-111111111188', timestamptz '2026-03-08 21:45:00+00');
select ok(not public.reminder_is_due('41111111-1111-4111-8111-111111111111', timestamptz '2026-03-08 22:05:00+00'), 'completed workouts never create a reminder');
delete from public.exercise_completions where day_exercise_id = '41111111-1111-4111-8111-111111111188';
update public.notification_preferences set workout_reminder_enabled = false where user_id = '41111111-1111-4111-8111-111111111111';
select ok(not public.reminder_is_due('41111111-1111-4111-8111-111111111111', timestamptz '2026-03-08 22:05:00+00'), 'opting out disables the reminder immediately');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '41111111-1111-4111-8111-111111111111', true);
select is((public.get_account_settings()->>'remindersReady')::boolean, false, 'the app truthfully reports that email delivery is not configured');
select throws_like($$ select public.set_workout_reminder(true) $$, '%not set up yet%', 'users cannot enable a non-working reminder');
select lives_ok($$ select public.set_workout_reminder(false) $$, 'users can always opt out');
select ok(not has_table_privilege('authenticated', 'public.reminder_deliveries', 'SELECT'), 'users cannot read delivery metadata');
select ok(not has_function_privilege('authenticated', 'public.claim_workout_reminders(integer)', 'EXECUTE'), 'only the service worker can claim delivery jobs');
select ok(not has_function_privilege('anon', 'public.set_workout_reminder(boolean)', 'EXECUTE'), 'anonymous users cannot change notification preferences');

select * from finish();
rollback;
