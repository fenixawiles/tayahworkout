alter table public.exercise_preferences
  add column hidden_at timestamptz;

-- Shared exercises are hidden only for the requesting account. User-created
-- exercises are archived so historical plans and routine snapshots stay intact.
create function public.remove_exercise_from_library(p_exercise_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  item public.exercises;
begin
  if actor is null then raise exception 'Sign in to continue'; end if;

  select * into item from public.exercises
    where id = p_exercise_id and archived_at is null
    for update;
  if item.id is null or (item.owner_id is not null and item.owner_id <> actor) then
    raise exception 'Exercise not available';
  end if;

  if item.owner_id = actor then
    update public.exercises set archived_at = now() where id = p_exercise_id;
  else
    insert into public.exercise_preferences (user_id, exercise_id, hidden_at)
      values (actor, p_exercise_id, now())
    on conflict (user_id, exercise_id) do update
      set hidden_at = excluded.hidden_at, updated_at = now();
  end if;

  delete from public.exercise_favorites
    where user_id = actor and exercise_id = p_exercise_id;
end $$;

revoke all on function public.remove_exercise_from_library(uuid) from public, anon, authenticated;
grant execute on function public.remove_exercise_from_library(uuid) to authenticated;
