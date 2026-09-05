begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, aud, role, email, raw_user_meta_data)
values
  ('33333333-3333-4333-8333-333333333331', 'authenticated', 'authenticated', 'preferences-a@example.com', '{"display_name":"A"}'),
  ('33333333-3333-4333-8333-333333333332', 'authenticated', 'authenticated', 'preferences-b@example.com', '{"display_name":"B"}');
insert into public.exercises (id, owner_id, name, category)
values ('33333333-3333-4333-8333-333333333339', '33333333-3333-4333-8333-333333333332', 'Private B exercise', 'strength');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(not has_table_privilege('anon', 'public.exercise_preferences', 'SELECT'), 'personal defaults are unavailable anonymously');
select lives_ok($$
  insert into public.exercise_preferences (user_id, exercise_id, target, weight, weight_unit)
  values ('33333333-3333-4333-8333-333333333331', '00000000-0000-4000-8000-000000000001', '4 × 8', 22.5, 'kg')
$$, 'a user can customize a shared exercise');
select is((select weight from public.exercise_preferences), 22.50::numeric, 'fractional weights persist');
select is((select default_target from public.exercises where id = '00000000-0000-4000-8000-000000000001'), '3 × 10', 'shared library defaults remain unchanged');
select throws_like($$
  insert into public.exercise_preferences (user_id, exercise_id) values ('33333333-3333-4333-8333-333333333332', '00000000-0000-4000-8000-000000000001')
$$, '%row-level security%', 'cannot set another user preferences');
select throws_like($$
  insert into public.exercise_preferences (user_id, exercise_id) values ('33333333-3333-4333-8333-333333333331', '33333333-3333-4333-8333-333333333339')
$$, '%row-level security%', 'cannot reference another user private exercise');
select throws_like($$ update public.exercise_preferences set weight = -1 $$, '%check constraint%', 'negative weights are rejected');
select throws_like($$ update public.exercise_preferences set weight_unit = 'oz' $$, '%check constraint%', 'unsupported units are rejected');
select throws_like($$ update public.exercise_preferences set target = repeat('x', 81) $$, '%check constraint%', 'target length leaves space for the saved weight snapshot');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333332', true);
select is((select count(*)::integer from public.exercise_preferences), 0, 'other accounts cannot read these preferences');
select lives_ok($$
  insert into public.exercise_preferences (user_id, exercise_id, target, weight)
  values ('33333333-3333-4333-8333-333333333332', '00000000-0000-4000-8000-000000000001', '', null)
$$, 'another account can use independent optional defaults for the same exercise');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);
select is((select target from public.exercise_preferences), '4 × 8', 'another account changes do not affect the first user');
select lives_ok(
  $$ select public.remove_exercise_from_library('00000000-0000-4000-8000-000000000001') $$,
  'a user can remove a shared exercise from their own library'
);
select ok((select hidden_at is not null from public.exercise_preferences where exercise_id = '00000000-0000-4000-8000-000000000001'), 'shared removal is stored as a personal preference');
select is((select archived_at from public.exercises where id = '00000000-0000-4000-8000-000000000001'), null, 'a shared exercise is not archived for everyone');
select throws_like(
  $$ select public.remove_exercise_from_library('33333333-3333-4333-8333-333333333339') $$,
  '%Exercise not available%',
  'a user cannot remove another account custom exercise'
);
select ok(not has_function_privilege('anon', 'public.remove_exercise_from_library(uuid)', 'EXECUTE'), 'anonymous exercise removal is denied');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333332', true);
select lives_ok(
  $$ select public.remove_exercise_from_library('33333333-3333-4333-8333-333333333339') $$,
  'an owner can remove their custom exercise'
);
select ok((select archived_at is not null from public.exercises where id = '33333333-3333-4333-8333-333333333339'), 'custom removal archives the source record');
select * from finish();
rollback;
