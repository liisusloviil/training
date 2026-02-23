begin;

create or replace function public.import_training_plan(
  p_plan_name text,
  p_source_filename text,
  p_source_file_path text,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_week_id uuid;
  v_day_id uuid;
  v_week jsonb;
  v_day jsonb;
  v_exercise jsonb;
  v_days_count integer := 0;
  v_exercises_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid import payload';
  end if;

  if jsonb_typeof(p_payload -> 'weeks') <> 'array' or jsonb_array_length(p_payload -> 'weeks') = 0 then
    raise exception 'Plan must contain at least one week';
  end if;

  update public.training_plans
  set is_active = false
  where user_id = v_user_id
    and is_active = true;

  insert into public.training_plans (
    user_id,
    name,
    source_filename,
    source_file_path,
    is_active
  )
  values (
    v_user_id,
    coalesce(nullif(trim(p_plan_name), ''), 'План тренировок'),
    p_source_filename,
    p_source_file_path,
    true
  )
  returning id into v_plan_id;

  for v_week in
    select value
    from jsonb_array_elements(p_payload -> 'weeks')
  loop
    insert into public.plan_weeks (
      user_id,
      plan_id,
      week_number
    )
    values (
      v_user_id,
      v_plan_id,
      (v_week ->> 'weekNumber')::integer
    )
    returning id into v_week_id;

    for v_day in
      select value
      from jsonb_array_elements(coalesce(v_week -> 'days', '[]'::jsonb))
    loop
      v_days_count := v_days_count + 1;

      insert into public.plan_days (
        user_id,
        week_id,
        day_key,
        day_label,
        sort_order
      )
      values (
        v_user_id,
        v_week_id,
        lower(trim(v_day ->> 'dayKey')),
        coalesce(nullif(trim(v_day ->> 'dayLabel'), ''), initcap(v_day ->> 'dayKey')),
        coalesce((v_day ->> 'sortOrder')::integer, v_days_count)
      )
      returning id into v_day_id;

      for v_exercise in
        select value
        from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb))
      loop
        v_exercises_count := v_exercises_count + 1;

        insert into public.plan_exercises (
          user_id,
          day_id,
          sort_order,
          exercise_name,
          intensity,
          prescribed_sets,
          prescribed_reps,
          raw_sets_reps
        )
        values (
          v_user_id,
          v_day_id,
          coalesce((v_exercise ->> 'sortOrder')::integer, v_exercises_count),
          trim(v_exercise ->> 'exerciseName'),
          nullif(trim(v_exercise ->> 'intensity'), ''),
          nullif(trim(v_exercise ->> 'prescribedSets'), '')::integer,
          nullif(trim(v_exercise ->> 'prescribedReps'), '')::integer,
          trim(v_exercise ->> 'rawSetsReps')
        );
      end loop;
    end loop;
  end loop;

  if v_days_count = 0 then
    raise exception 'Plan must contain at least one day';
  end if;

  if v_exercises_count = 0 then
    raise exception 'Plan must contain at least one exercise';
  end if;

  return v_plan_id;
end;
$$;

grant execute on function public.import_training_plan(text, text, text, jsonb) to authenticated;

commit;
