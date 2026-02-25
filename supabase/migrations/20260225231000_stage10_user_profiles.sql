begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_format check (username ~ '^[a-z0-9_]{3,32}$')
);

create unique index if not exists user_profiles_username_unique
  on public.user_profiles (username);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_profiles enable row level security;

grant select, insert, update on public.user_profiles to authenticated;

drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_profiles_insert_own
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  if v_username !~ '^[a-z0-9_]{3,32}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.user_profiles
    where username = v_username
  );
end;
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon;
grant execute on function public.is_username_available(text) to authenticated;

commit;
