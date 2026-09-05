begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('31111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'alice@example.com', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Alice","time_zone":"America/Chicago"}', now(), now()),
  ('32222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'bob@example.com', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Bob","time_zone":"America/New_York"}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-111111111111', true);
select lives_ok($$ select public.update_profile('Alice', 'America/Chicago', 'alice_moves') $$, 'a user can choose a valid username');
select is((public.find_friend('missing') is null), true, 'lookup does not reveal close or missing matches');

select set_config('request.jwt.claim.sub', '32222222-2222-4222-8222-222222222222', true);
select throws_like($$ select public.update_profile('Bob', 'America/New_York', '2bad') $$, '%Choose a username%', 'invalid usernames are rejected');
select lives_ok($$ select public.update_profile('Bob', 'America/New_York', 'bob_moves') $$, 'the other user can choose a username');

select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-111111111111', true);
select is(public.find_friend('@bob_moves')->>'username', 'bob_moves', 'exact username lookup returns a limited identity');
select is(public.find_friend(public.find_friend('bob_moves')->>'code')->>'name', 'Bob', 'a stable friend code also finds the account');
select lives_ok($$ select public.send_friend_request('32222222-2222-4222-8222-222222222222') $$, 'a signed-in user can send a friend request');
select is((public.get_community()->'relationships'->0->>'incoming')::boolean, false, 'the sender sees an outgoing request');

select set_config('request.jwt.claim.sub', '32222222-2222-4222-8222-222222222222', true);
select is((public.get_community()->'relationships'->0->>'incoming')::boolean, true, 'the recipient sees an incoming request');
select lives_ok($$ select public.respond_friend_request((public.get_community()->'relationships'->0->>'id')::uuid, 'accept') $$, 'the recipient can accept');
select is(public.get_community()->'relationships'->0->>'status', 'accepted', 'both users become accepted friends');

select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-111111111111', true);
select lives_ok($$ select public.create_competition('32222222-2222-4222-8222-222222222222', 'Show up together', public.current_user_date() + 2, 7) $$, 'an accepted friend can receive a future challenge');
select is(public.get_community()->'competitions'->0->>'status', 'pending', 'challenge rules are pending until accepted');
select throws_like($$ select public.competition_score('32222222-2222-4222-8222-222222222222', current_date, current_date + 6, 'UTC') $$, '%permission denied%', 'clients cannot call arbitrary-user score helpers');

select set_config('request.jwt.claim.sub', '32222222-2222-4222-8222-222222222222', true);
select lives_ok($$ select public.respond_competition((public.get_community()->'competitions'->0->>'id')::uuid, 'accept') $$, 'the invited friend can accept');
select is(public.get_community()->'competitions'->0->>'status', 'accepted', 'accepted challenge becomes visible to both participants');
select throws_like($$ select public.update_profile('Bob', 'UTC', 'bob_moves') $$, '%timezone stays fixed%', 'an active challenge locks timezone changes');
select lives_ok($$ select public.set_user_block('31111111-1111-4111-8111-111111111111', true) $$, 'a user can block the other person');
select is(jsonb_array_length(public.get_community()->'relationships'), 0, 'blocking ends and hides the friendship');
select is(jsonb_array_length(public.get_community()->'competitions'), 0, 'blocking ends and hides shared challenges');

select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-111111111111', true);
select is(public.find_friend('bob_moves') is null, true, 'blocked accounts cannot find each other');
select lives_ok($$ select public.report_user('32222222-2222-4222-8222-222222222222', 'spam', 'Repeated unwanted requests', true) $$, 'a private report can also block');
select is(jsonb_array_length(public.get_community()->'reports'), 1, 'a reporter can follow their report status without seeing the moderation queue');
select throws_like($$ select public.get_moderation_queue() $$, '%Moderator access required%', 'ordinary users cannot read the moderation queue');
select lives_ok($$ select public.submit_support_request('privacy', 'Please prepare a complete copy of my account data.') $$, 'users can submit private support or privacy requests');
select lives_ok($$ select public.cancel_support_request((public.get_community()->'requests'->0->>'id')::uuid) $$, 'an open support request can be cancelled');
select ok(not has_table_privilege('authenticated', 'public.friendships', 'SELECT'), 'social tables are RPC-only');
select ok(not has_function_privilege('anon', 'public.find_friend(text)', 'EXECUTE'), 'anonymous lookup is denied');

select * from finish();
rollback;
