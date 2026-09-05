begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'tayah@example.com', extensions.crypt('password', extensions.gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"display_name":"Tayah","time_zone":"America/Chicago"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@example.com', extensions.crypt('password', extensions.gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"display_name":"Other","time_zone":"UTC"}', now(), now());

insert into public.exercises (id, owner_id, name, category, image_path)
values ('22222222-2222-4222-8222-222222222299', '22222222-2222-4222-8222-222222222222', 'Private exercise', 'strength', '22222222-2222-4222-8222-222222222222/private.webp');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.profiles), 1, 'a user sees only their own profile');
select is((select count(*)::integer from public.exercises where id = '22222222-2222-4222-8222-222222222299'), 0, 'a user cannot see another user custom exercise');
select ok(not has_table_privilege('authenticated', 'public.exercise_completions', 'INSERT'), 'direct completion inserts are revoked');
select ok(not has_table_privilege('authenticated', 'public.day_plans', 'INSERT'), 'direct day plan inserts are revoked');
select ok(not has_table_privilege('authenticated', 'public.routine_template_items', 'INSERT'), 'routine items can only be written transactionally');
select ok(not has_function_privilege('anon', 'public.current_user_date(uuid)', 'EXECUTE'), 'anonymous users cannot call the date helper');
select ok(not has_function_privilege('anon', 'public.save_day_plan(date,text,jsonb)', 'EXECUTE'), 'anonymous users cannot call the plan RPC');
select ok(not has_function_privilege('anon', 'public.set_exercise_completion(uuid,boolean)', 'EXECUTE'), 'anonymous users cannot call the completion RPC');
select ok(not has_function_privilege('anon', 'public.save_day_reflection(date,text)', 'EXECUTE'), 'anonymous users cannot call the reflection RPC');
select ok(not has_function_privilege('anon', 'public.save_routine_template(text,jsonb)', 'EXECUTE'), 'anonymous users cannot call the template RPC');
select ok(not has_function_privilege('anon', 'public.remove_exercise_from_library(uuid)', 'EXECUTE'), 'anonymous users cannot remove library exercises');
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anonymous users cannot call the profile trigger helper');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'signed-in users cannot call the profile trigger helper');
select throws_like(
  $$ insert into public.exercise_favorites (user_id, exercise_id) values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222299') $$,
  '%row-level security%',
  'a user cannot favorite another account private exercise'
);

select lives_ok(
  $$ select public.save_day_plan(public.current_user_date(), 'Today', '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","source_exercise_id":"00000000-0000-4000-8000-000000000001","name":"Goblet squat","category":"strength","image_path":"seed/goblet-squat.jpg","target":"3 × 10","notes":"","sort_order":0}]'::jsonb) $$,
  'a user can save their current day atomically'
);
select lives_ok(
  $$ select public.set_exercise_completion('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true) $$,
  'a user can complete an exercise on its scheduled local day'
);
select is((select count(*)::integer from public.exercise_completions), 1, 'the valid completion is stored');

select lives_ok(
  $$ select public.save_day_plan(public.current_user_date() + 1, 'Tomorrow', '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","source_exercise_id":"00000000-0000-4000-8000-000000000001","name":"Goblet squat","category":"strength","image_path":"seed/goblet-squat.jpg","target":"3 × 10","notes":"","sort_order":0}]'::jsonb) $$,
  'future plans can be created'
);
select throws_like(
  $$ select public.set_exercise_completion('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true) $$,
  '%only be completed on their scheduled day%',
  'future exercises cannot be completed through the RPC'
);
select throws_like(
  $$ select public.save_day_plan(public.current_user_date() - 1, 'Yesterday', '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","source_exercise_id":"00000000-0000-4000-8000-000000000001","name":"Goblet squat","category":"strength","image_path":"seed/goblet-squat.jpg","target":"3 × 10","notes":"","sort_order":0}]'::jsonb) $$,
  '%Past workout days are read-only%',
  'past plans cannot be written through the RPC'
);
select throws_like(
  $$ select public.save_day_plan(public.current_user_date() + 2, 'Stolen', '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4","source_exercise_id":"22222222-2222-4222-8222-222222222299","name":"Private exercise","category":"strength","image_path":"22222222-2222-4222-8222-222222222222/private.webp","target":"1","notes":"","sort_order":0}]'::jsonb) $$,
  '%not available to this account%',
  'a plan cannot snapshot another account private exercise'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*)::integer from public.day_plans), 0, 'another user cannot read the first user plans');

select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anonymous users cannot read profiles');
select ok(not has_table_privilege('anon', 'public.exercises', 'SELECT'), 'anonymous users cannot read even the global library');

select * from finish();
rollback;
