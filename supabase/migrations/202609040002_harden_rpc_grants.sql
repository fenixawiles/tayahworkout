-- Hosted Supabase grants API roles explicit function privileges when functions
-- are created. Keep Momentum's transactional RPCs authenticated-only, and
-- keep trigger helpers out of the exposed RPC surface.
revoke all on function public.current_user_date(uuid) from public, anon;
revoke all on function public.save_day_plan(date, text, jsonb) from public, anon;
revoke all on function public.set_exercise_completion(uuid, boolean) from public, anon;
revoke all on function public.save_day_reflection(date, text) from public, anon;
revoke all on function public.save_routine_template(text, jsonb) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.current_user_date(uuid) to authenticated;
grant execute on function public.save_day_plan(date, text, jsonb) to authenticated;
grant execute on function public.set_exercise_completion(uuid, boolean) to authenticated;
grant execute on function public.save_day_reflection(date, text) to authenticated;
grant execute on function public.save_routine_template(text, jsonb) to authenticated;

-- Cover foreign keys used by plan, favorite, and template lookups/deletes.
create index day_exercises_source_exercise_idx
  on public.day_exercises (source_exercise_id)
  where source_exercise_id is not null;

create index exercise_favorites_exercise_idx
  on public.exercise_favorites (exercise_id);

create index routine_template_items_template_idx
  on public.routine_template_items (routine_template_id);

create index routine_template_items_source_exercise_idx
  on public.routine_template_items (source_exercise_id)
  where source_exercise_id is not null;
