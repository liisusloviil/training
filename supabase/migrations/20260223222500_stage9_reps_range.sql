begin;

alter table public.plan_exercises
  add column if not exists prescribed_reps_min integer,
  add column if not exists prescribed_reps_max integer;

update public.plan_exercises
set
  prescribed_reps_min = prescribed_reps,
  prescribed_reps_max = prescribed_reps
where prescribed_reps is not null
  and (prescribed_reps_min is null or prescribed_reps_max is null);

alter table public.plan_exercises
  drop constraint if exists plan_exercises_prescribed_reps_min_check,
  drop constraint if exists plan_exercises_prescribed_reps_max_check,
  drop constraint if exists plan_exercises_prescribed_reps_range_check;

alter table public.plan_exercises
  add constraint plan_exercises_prescribed_reps_min_check
    check (prescribed_reps_min is null or prescribed_reps_min > 0),
  add constraint plan_exercises_prescribed_reps_max_check
    check (prescribed_reps_max is null or prescribed_reps_max > 0),
  add constraint plan_exercises_prescribed_reps_range_check
    check (
      (prescribed_reps_min is null and prescribed_reps_max is null)
      or (
        prescribed_reps_min is not null
        and prescribed_reps_max is not null
        and prescribed_reps_min <= prescribed_reps_max
      )
    );

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
  v_prescribed_sets integer;
  v_prescribed_reps integer;
  v_prescribed_reps_min integer;
  v_prescribed_reps_max integer;
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

        v_prescribed_sets := nullif(trim(v_exercise ->> 'prescribedSets'), '')::integer;
        v_prescribed_reps := nullif(trim(v_exercise ->> 'prescribedReps'), '')::integer;
        v_prescribed_reps_min := nullif(trim(v_exercise ->> 'prescribedRepsMin'), '')::integer;
        v_prescribed_reps_max := nullif(trim(v_exercise ->> 'prescribedRepsMax'), '')::integer;

        if v_prescribed_reps is not null then
          v_prescribed_reps_min := coalesce(v_prescribed_reps_min, v_prescribed_reps);
          v_prescribed_reps_max := coalesce(v_prescribed_reps_max, v_prescribed_reps);
        end if;

        if (
          v_prescribed_reps is null
          and v_prescribed_reps_min is not null
          and v_prescribed_reps_max is not null
          and v_prescribed_reps_min = v_prescribed_reps_max
        ) then
          v_prescribed_reps := v_prescribed_reps_min;
        end if;

        insert into public.plan_exercises (
          user_id,
          day_id,
          sort_order,
          exercise_name,
          intensity,
          prescribed_sets,
          prescribed_reps,
          prescribed_reps_min,
          prescribed_reps_max,
          raw_sets_reps
        )
        values (
          v_user_id,
          v_day_id,
          coalesce((v_exercise ->> 'sortOrder')::integer, v_exercises_count),
          trim(v_exercise ->> 'exerciseName'),
          nullif(trim(v_exercise ->> 'intensity'), ''),
          v_prescribed_sets,
          v_prescribed_reps,
          v_prescribed_reps_min,
          v_prescribed_reps_max,
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
