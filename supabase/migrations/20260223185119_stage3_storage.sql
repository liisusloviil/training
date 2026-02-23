begin;

insert into storage.buckets (id, name, public)
values ('plan-files', 'plan-files', false)
on conflict (id)
do update
set name = excluded.name,
    public = excluded.public;

-- storage.objects is managed by Storage internals; RLS is already enabled in hosted environments.
-- Explicit ALTER can fail for non-owner roles when running via pooler.

drop policy if exists plan_files_select_own_prefix on storage.objects;
drop policy if exists plan_files_insert_own_prefix on storage.objects;
drop policy if exists plan_files_update_own_prefix on storage.objects;
drop policy if exists plan_files_delete_own_prefix on storage.objects;

create policy plan_files_select_own_prefix
on storage.objects
for select
to authenticated
using (
  bucket_id = 'plan-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy plan_files_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'plan-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy plan_files_update_own_prefix
on storage.objects
for update
to authenticated
using (
  bucket_id = 'plan-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'plan-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy plan_files_delete_own_prefix
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'plan-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

commit;
