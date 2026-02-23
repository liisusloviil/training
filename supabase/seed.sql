-- Stage 2 seed file intentionally does not insert data.
-- Rationale: all domain tables depend on real auth.users records.
-- Use this file for quick post-migration smoke checks.

select 'training_plans' as table_name, to_regclass('public.training_plans') is not null as exists;
select 'plan_weeks' as table_name, to_regclass('public.plan_weeks') is not null as exists;
select 'plan_days' as table_name, to_regclass('public.plan_days') is not null as exists;
select 'plan_exercises' as table_name, to_regclass('public.plan_exercises') is not null as exists;
select 'workout_sessions' as table_name, to_regclass('public.workout_sessions') is not null as exists;
select 'session_sets' as table_name, to_regclass('public.session_sets') is not null as exists;

select enumlabel
from pg_enum
where enumtypid = 'public.workout_session_status'::regtype
order by enumsortorder;
