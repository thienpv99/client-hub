-- =====================================================================================================
-- Client Hub — Supabase Storage: one private bucket per account + policies on storage.objects
-- Run right AFTER supabase/schema.sql (uses public.files, public.accounts and the helper functions).
-- =====================================================================================================
--
-- Layout
--   bucket  : 'acc-<account uuid>'  = public.account_bucket_id(account_id); private, created with the account
--   objects : 'shared/<file uuid>-<name>'   uploads by New Era staff (designs, documents, contracts…)
--             'incoming/<auth uid>/<name>'  uploads by a client user (task submissions, payment proofs,
--                                           documents shared with New Era)
--   public.files.storage_path = '<bucket id>/<object name>'  (one files row per object = metadata + visibility)
--
-- Rules
--   * READ an object  ⇔  the caller can read a public.files row pointing at it. The files RLS already says
--     who sees what (clients: only visibility = 'shared' files of their own company, of tasks they can see;
--     client_member: no proofs / contracts), so Storage inherits exactly the same rule — an 'internal' file
--     cannot be downloaded by a client even with its path. Signed URLs are created by the app as the caller
--     (createSignedUrl runs this policy). A client may also read back its own not-yet-registered upload.
--   * UPLOAD: staff → buckets of accounts they can read; client users → only 'incoming/<their uid>/' of their
--     own company bucket. They then call submit_task_files / report_payment (or insert a files row), which
--     check the path again and create the shared files row. An object without a files row is invisible.
--   * No UPDATE / DELETE for end users: a new document version is a new object; removing a document =
--     soft-deleting its files row. Orphan objects (e.g. after "Hoàn tác") are removed by a service-role job.

-- ── one private bucket per account ──────────────────────────────────────────────────────────────────
create or replace function public.trg_accounts_create_bucket()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into storage.buckets (id, name, public)
  values (public.account_bucket_id(new.id), public.account_bucket_id(new.id), false)
  on conflict (id) do nothing;
  return null;
end;
$$;

revoke execute on function public.trg_accounts_create_bucket() from public, anon, authenticated;

create trigger accounts_create_bucket
  after insert on public.accounts
  for each row execute function public.trg_accounts_create_bucket();

-- accounts that already exist (e.g. the imported demo seed)
insert into storage.buckets (id, name, public)
select public.account_bucket_id(a.id), public.account_bucket_id(a.id), false
  from public.accounts a
on conflict (id) do nothing;

-- ── policies on storage.objects ─────────────────────────────────────────────────────────────────────
create policy client_hub_objects_select on storage.objects for select to authenticated
using (
  public.bucket_account_id(bucket_id) is not null
  and (
    exists (select 1
              from public.files f                                   -- files RLS applies (invoker)
             where f.storage_path = objects.bucket_id || '/' || objects.name)
    or (objects.name like ('incoming/' || (select auth.uid())::text || '/%')
        and public.can_read_account(public.bucket_account_id(objects.bucket_id)))
  )
);

create policy client_hub_objects_insert on storage.objects for insert to authenticated
with check (
  public.bucket_account_id(bucket_id) is not null
  and not (select public.is_read_only())
  and (
    -- New Era staff with access to the account
    ((select public.is_internal())
     and public.can_read_account(public.bucket_account_id(bucket_id)))
    -- client users: only their own upload folder of their own company bucket
    or ((select public.is_client())
        and public.bucket_account_id(bucket_id) = (select public.auth_account_id())
        and name like ('incoming/' || (select auth.uid())::text || '/%'))
  )
);
