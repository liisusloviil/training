begin;

create extension if not exists pgcrypto with schema extensions;

create type public.workout_session_status as enum ('in_progress', 'completed');

create table public.training_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_filename text not null,
  source_file_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_weeks (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  created_at timestamptz not null default now(),
  unique (plan_id, week_number)
);

create table public.plan_days (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_id uuid not null references public.plan_weeks (id) on delete cascade,
  day_key text not null check (
    day_key in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )
  ),
  day_label text not null,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (week_id, day_key)
);

create table public.plan_exercises (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_id uuid not null references public.plan_days (id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  exercise_name text not null,
  intensity text,
  prescribed_sets integer check (prescribed_sets is null or prescribed_sets > 0),
  prescribed_reps integer check (prescribed_reps is null or prescribed_reps > 0),
  raw_sets_reps text not null,
  created_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  session_date date not null,
  status public.workout_session_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, session_date, plan_day_id),
  check (
    (status = 'in_progress' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create table public.session_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  plan_exercise_id uuid not null references public.plan_exercises (id) on delete cascade,
  set_number integer not null check (set_number > 0),
  reps integer not null check (reps >= 0),
  weight numeric(6,2) not null check (weight >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, plan_exercise_id, set_number)
);

create index training_plans_user_active_created_idx
  on public.training_plans (user_id, is_active, created_at desc);

create index plan_exercises_day_sort_order_idx
  on public.plan_exercises (day_id, sort_order);

create index workout_sessions_user_session_date_idx
  on public.workout_sessions (user_id, session_date desc);

create index session_sets_session_id_idx
  on public.session_sets (session_id);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_session_sets_updated_at
before update on public.session_sets
for each row
execute function public.set_current_timestamp_updated_at();

commit;
