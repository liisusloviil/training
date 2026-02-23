begin;

alter table public.training_plans enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;

grant usage on schema public to authenticated;
grant usage on type public.workout_session_status to authenticated;

grant select, insert, update, delete on public.training_plans to authenticated;
grant select, insert, update, delete on public.plan_weeks to authenticated;
grant select, insert, update, delete on public.plan_days to authenticated;
grant select, insert, update, delete on public.plan_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.session_sets to authenticated;

-- training_plans
drop policy if exists training_plans_select_own on public.training_plans;
drop policy if exists training_plans_insert_own on public.training_plans;
drop policy if exists training_plans_update_own on public.training_plans;
drop policy if exists training_plans_delete_own on public.training_plans;

create policy training_plans_select_own
on public.training_plans
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy training_plans_insert_own
on public.training_plans
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy training_plans_update_own
on public.training_plans
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy training_plans_delete_own
on public.training_plans
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- plan_weeks
drop policy if exists plan_weeks_select_own on public.plan_weeks;
drop policy if exists plan_weeks_insert_own on public.plan_weeks;
drop policy if exists plan_weeks_update_own on public.plan_weeks;
drop policy if exists plan_weeks_delete_own on public.plan_weeks;

create policy plan_weeks_select_own
on public.plan_weeks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy plan_weeks_insert_own
on public.plan_weeks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy plan_weeks_update_own
on public.plan_weeks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy plan_weeks_delete_own
on public.plan_weeks
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- plan_days
drop policy if exists plan_days_select_own on public.plan_days;
drop policy if exists plan_days_insert_own on public.plan_days;
drop policy if exists plan_days_update_own on public.plan_days;
drop policy if exists plan_days_delete_own on public.plan_days;

create policy plan_days_select_own
on public.plan_days
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy plan_days_insert_own
on public.plan_days
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy plan_days_update_own
on public.plan_days
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy plan_days_delete_own
on public.plan_days
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- plan_exercises
drop policy if exists plan_exercises_select_own on public.plan_exercises;
drop policy if exists plan_exercises_insert_own on public.plan_exercises;
drop policy if exists plan_exercises_update_own on public.plan_exercises;
drop policy if exists plan_exercises_delete_own on public.plan_exercises;

create policy plan_exercises_select_own
on public.plan_exercises
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy plan_exercises_insert_own
on public.plan_exercises
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy plan_exercises_update_own
on public.plan_exercises
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy plan_exercises_delete_own
on public.plan_exercises
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- workout_sessions
drop policy if exists workout_sessions_select_own on public.workout_sessions;
drop policy if exists workout_sessions_insert_own on public.workout_sessions;
drop policy if exists workout_sessions_update_own on public.workout_sessions;
drop policy if exists workout_sessions_delete_own on public.workout_sessions;

create policy workout_sessions_select_own
on public.workout_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy workout_sessions_insert_own
on public.workout_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy workout_sessions_update_own
on public.workout_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy workout_sessions_delete_own
on public.workout_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- session_sets
drop policy if exists session_sets_select_own on public.session_sets;
drop policy if exists session_sets_insert_own on public.session_sets;
drop policy if exists session_sets_update_own on public.session_sets;
drop policy if exists session_sets_delete_own on public.session_sets;

create policy session_sets_select_own
on public.session_sets
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy session_sets_insert_own
on public.session_sets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy session_sets_update_own
on public.session_sets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy session_sets_delete_own
on public.session_sets
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
