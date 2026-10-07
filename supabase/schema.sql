-- =====================================================================================================
-- Client Hub (New Era) — target Postgres schema for Supabase (PostgreSQL 15)
-- =====================================================================================================
-- Mirrors src/domain/types.ts table by table. Today the app runs on the in-browser mock
-- (src/services/db.ts + src/services/api/*.ts); this file is the backend the service layer will be
-- swapped onto, with the same shapes. See supabase/README.md for the mapping api method → table/RPC.
--
-- Run once on a fresh Supabase project (SQL editor, or as the first migration of `supabase db push`),
-- then supabase/storage.sql. It relies on Supabase objects: schema auth (auth.users, auth.uid(),
-- auth.jwt()), roles anon / authenticated / service_role; storage.objects is only touched when present.
--
-- ── Conventions ──────────────────────────────────────────────────────────────────────────────────────
-- • ids: uuid (gen_random_uuid()). The API still treats them as opaque strings (types.ts `ID = string`).
--   public.mock_uuid('acc_coxanh') maps mock ids deterministically when importing the demo seed.
-- • money: bigint whole VND (no decimals). Percentages: numeric(5,2). Quantities: numeric(12,2).
-- • `date` = a calendar day in Asia/Ho_Chi_Minh (types.ts ISODate); `timestamptz` = an instant (ISODateTime).
-- • soft delete: deleted_at on every main table. RLS never shows soft-deleted rows to client users;
--   internal users still see them (audit / restore), so internal list queries filter `deleted_at is null`
--   exactly like db.rows() does in the mock.
-- • every union type of types.ts is a Postgres enum (or a check constraint for VatRate).
--
-- ── Timezone (SPEC §8) ───────────────────────────────────────────────────────────────────────────────
-- Business days are Vietnam days. Never use current_date: it follows the session TimeZone (UTC on
-- Supabase). Use public.today_vn() = (now() at time zone 'Asia/Ho_Chi_Minh')::date.
--   overdue  ⇔  public.today_vn() > due_date      (= after 23:59 of the due day, Vietnam time)
--   calendar day of an instant: (ts at time zone 'Asia/Ho_Chi_Minh')::date
-- (The SPEC shorthand "current_date at time zone 'Asia/Ho_Chi_Minh' > due_date" means exactly this.)
--
-- ── Security model (SPEC §2) ─────────────────────────────────────────────────────────────────────────
-- 1. Row Level Security on every table. Helper functions describe the caller: auth_viewer() (role,
--    account, cost permission, read-only "Xem như khách hàng"), auth_role(), auth_account_id(),
--    is_internal(), can_view_cost(), is_manager_of(account_id), readable_account_ids() …
--    – client users: only rows of their own account; never tasks with client_visible = false
--      (internal side), never comments / files / activities with visibility = 'internal', milestones only
--      when client_visible, quotes only in sent / accepted / changes_requested / expired;
--      client_member: no commercial table at all (quotes, quote_lines, price_items, contracts,
--      payment_schedules, account_prices, proof / contract files, commercial activities).
--    – AM: only the accounts they manage (accounts.am_id). member: only accounts where they have at
--      least one assigned task. director: everything.
-- 2. Internal-only COLUMNS (cost price, internal notes, override reasons, manual-unblock data) are
--    protected with column privileges: `authenticated` has no SELECT on them at all, so not even a
--    hand-written PostgREST query can read them. Internal readers use the *_internal views (owner-rights
--    views that re-apply the same access rules and add `is_internal()` / `can_view_cost()`), clients and
--    everyone else use the base tables or the client-safe views (price_items_public, quote_lines_client,
--    v_quote_totals). See section 10 for the cost-protection details.
-- 3. Client users have no INSERT / UPDATE / DELETE on business tables. Every client action goes through
--    a SECURITY DEFINER RPC (approve_task, request_task_changes, submit_task_files, report_payment,
--    confirm_task, answer_task, delegate_task, ask_new_era, add_comment, client_accept_quote,
--    client_request_quote_changes, undo_task_action) that re-checks the rules of the mock and writes an
--    activity row in the same transaction.
-- 4. Direct writes by internal users are allowed by policy and checked by guard triggers (blocked
--    transitions, protected columns, quote state machine, dependency cycles). Guard triggers recognise a
--    trusted context by current_user: inside SECURITY DEFINER RPCs, jobs and the service role it is not
--    'authenticated'.
-- 5. "Xem như khách hàng": an Edge Function sets app_metadata.view_as_account_id on the internal user;
--    auth_viewer() then reports a READ-ONLY client_owner of that account, so every read goes through the
--    client filters and every write is refused (writable_viewer() / is_manager_of() are false).
--
-- ── RPC error convention ─────────────────────────────────────────────────────────────────────────────
-- RPCs raise: message = ApiErrorCode ('forbidden', 'blocked', …), detail = i18n key ('errors.blocked'),
-- hint = JSON ApiError.details (e.g. {"blockers": […]}), SQLSTATE 'PTxxx' so PostgREST answers with HTTP
-- status xxx. The Supabase adapter turns that into `new ApiError(message, detail, JSON.parse(hint))`.
-- =====================================================================================================


-- =====================================================================================================
-- 0. Setup
-- =====================================================================================================

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- private: machinery used only by SECURITY DEFINER functions and owner-rights views (never exposed by
-- PostgREST, no table privileges for API roles).
create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to authenticated, service_role;


-- =====================================================================================================
-- 1. Types (one enum per union type of src/domain/types.ts)
-- =====================================================================================================

create type public.org_type          as enum ('internal', 'client');
create type public.user_role         as enum ('director', 'am', 'member', 'client_owner', 'client_member');
create type public.salutation        as enum ('anh', 'chị');
create type public.notification_pref as enum ('all', 'digest_and_urgent');
create type public.user_status       as enum ('active', 'invited', 'disabled');
create type public.account_tier      as enum ('strategic', 'key', 'standard');
create type public.account_stage     as enum ('prospecting', 'negotiating', 'implementing', 'operating', 'paused');
create type public.health            as enum ('blocked', 'attention', 'on_track');
create type public.decision_role     as enum ('decision_maker', 'approver', 'ops_contact');
create type public.project_status    as enum ('active', 'done', 'paused');
create type public.milestone_status  as enum ('upcoming', 'in_progress', 'done');
create type public.task_side         as enum ('client', 'internal');
-- ClientTaskType + 'work' (ordinary New Era task)
create type public.task_type         as enum ('approval', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer', 'work');
create type public.task_status       as enum ('todo', 'in_progress', 'waiting', 'done');
create type public.waiting_on        as enum ('client', 'internal');
create type public.visibility        as enum ('internal', 'shared');
create type public.file_kind         as enum ('design', 'document', 'contract', 'proof', 'data', 'report', 'other');
create type public.price_unit        as enum ('month', 'user', 'package', 'manday');
create type public.quote_status      as enum ('draft', 'pending_approval', 'sent', 'accepted', 'changes_requested', 'expired');
create type public.client_decision   as enum ('accepted', 'changes_requested');
create type public.contract_status   as enum ('draft', 'active', 'completed');
create type public.payment_status    as enum ('not_due', 'invoice_due', 'invoiced', 'paid', 'overdue');
create type public.email_status      as enum ('sent', 'batched', 'suppressed');
create type public.forecast_source   as enum ('on_plan', 'dependency', 'cascade', 'manual', 'done');

create type public.activity_action as enum (
  'task.created', 'task.updated', 'task.status_changed', 'task.approved', 'task.changes_requested',
  'task.files_submitted', 'task.confirmed', 'task.attendance_confirmed', 'task.answered',
  'task.signed_submitted', 'task.payment_reported', 'task.delegated', 'task.question_asked',
  'task.reminded', 'task.unblocked', 'task.submission_accepted', 'task.returned_to_client',
  'task.visibility_changed', 'task.action_undone', 'task.deleted',
  'comment.added',
  'milestone.created', 'milestone.updated', 'milestone.forecast_overridden', 'milestone.completed',
  'project.created',
  'quote.created', 'quote.updated', 'quote.version_created', 'quote.approval_requested', 'quote.approved',
  'quote.approval_rejected', 'quote.sent', 'quote.accepted', 'quote.changes_requested', 'quote.expired',
  'contract.created',
  'payment.invoice_due', 'payment.invoiced', 'payment.reported', 'payment.paid', 'payment.overdue',
  'payment.reopened', 'payment.auto_task_toggled',
  'file.uploaded', 'file.visibility_changed',
  'account.created', 'account.updated', 'account.health_overridden', 'account.am_assigned',
  'account.exec_summary_updated',
  'contact.updated', 'user.invited', 'user.role_changed', 'settings.updated', 'escalation.sent'
);

create type public.activity_target_type as enum (
  'task', 'milestone', 'project', 'quote', 'contract', 'payment', 'file', 'account', 'contact', 'user',
  'comment', 'settings'
);

create type public.notification_kind as enum (
  'due_soon', 'overdue', 'escalation', 'reminder', 'task_update', 'comment', 'approval_needed', 'quote',
  'payment', 'delegated', 'digest', 'system'
);

-- Who is asking (see public.auth_viewer()).
create type public.viewer_ctx as (
  user_id       uuid,
  role          public.user_role,
  org_type      public.org_type,
  account_id    uuid,
  can_view_cost boolean,
  read_only     boolean
);


-- =====================================================================================================
-- 2. Pure utility functions (no table access)
-- =====================================================================================================

-- Today's calendar date in Vietnam. Every "overdue / days left" computation uses this, never current_date.
create or replace function public.today_vn()
returns date
language sql stable parallel safe
set search_path = ''
as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- Deterministic uuid for a mock id ('acc_coxanh', 't_123'…) so a seed import keeps every reference.
create or replace function public.mock_uuid(p_mock_id text)
returns uuid
language sql immutable strict parallel safe
set search_path = ''
as $$ select md5('clienthub:' || p_mock_id)::uuid $$;

-- uuid or null (no exception) — used on free-text ids (activities.target_id, JWT claims).
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql immutable parallel safe
set search_path = ''
as $$
begin
  if p_text ~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then
    return p_text::uuid;
  end if;
  return null;
end;
$$;

-- Accent-insensitive search key (Vietnamese diacritics, đ → d), like normalizeText() in src/lib/utils.ts.
create or replace function public.search_norm(p_text text)
returns text
language sql immutable strict parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_text)) $$;

-- Storage bucket of an account (one private bucket per account, see supabase/storage.sql).
create or replace function public.account_bucket_id(p_account_id uuid)
returns text
language sql immutable strict parallel safe
set search_path = ''
as $$ select 'acc-' || p_account_id::text $$;

create or replace function public.bucket_account_id(p_bucket_id text)
returns uuid
language sql immutable strict parallel safe
set search_path = ''
as $$ select case when p_bucket_id like 'acc-%' then public.try_uuid(substr(p_bucket_id, 5)) end $$;

-- SPEC §3: not done → max(0, today − due); done → max(0, completion day (Vietnam) − due).
create or replace function public.task_delay_days(
  p_due_date date, p_status public.task_status, p_completed_at timestamptz, p_today date
)
returns integer
language sql immutable parallel safe
set search_path = ''
as $$
  select case
    when p_status = 'done' then
      case when p_completed_at is null then 0
           else greatest(0, (p_completed_at at time zone 'Asia/Ho_Chi_Minh')::date - p_due_date)
      end
    else greatest(0, p_today - p_due_date)
  end
$$;

-- Raise an ApiError (see the error convention in the header).
create or replace function private.api_error(p_code text, p_message_key text default null, p_details jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    message = p_code,
    detail  = coalesce(p_message_key, 'errors.' || p_code),
    hint    = coalesce(p_details::text, ''),
    errcode = case p_code
                when 'unauthenticated' then 'PT401'
                when 'forbidden'       then 'PT403'
                when 'read_only'       then 'PT403'
                when 'not_found'       then 'PT404'
                when 'validation'      then 'PT400'
                else 'PT409'  -- blocked | cycle | needs_approval | domain_mismatch | requires_owner | conflict
              end;
end;
$$;

-- True when the current request comes from an end user (PostgREST JWT role authenticated / anon), even
-- inside a SECURITY DEFINER function. False for the service role, pg_cron and SQL sessions.
create or replace function private.is_end_user_call()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') $$;

-- "Xem như khách hàng": account id put in app_metadata by the view-as Edge Function (service role only
-- can write app_metadata, so users cannot forge it).
create or replace function public.view_as_account_id()
returns uuid
language sql stable
set search_path = ''
as $$ select public.try_uuid(nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'view_as_account_id', '')), '')) $$;

-- '120.000.000 ₫' (same as formatMoney in src/lib/format.ts) — used in generated activity params / task texts.
create or replace function private.format_vnd(p_amount bigint)
returns text
language sql immutable
set search_path = ''
as $$ select replace(to_char(coalesce(p_amount, 0), 'FM999,999,999,999,999,990'), ',', '.') || ' ₫' $$;

-- '15,0%'
create or replace function private.format_pct(p_value numeric)
returns text
language sql immutable
set search_path = ''
as $$ select replace(to_char(round(coalesce(p_value, 0), 1), 'FM999990.0'), '.', ',') || '%' $$;

-- 'Thiết kế Đặt hàng v2.pdf' → 'thiet-ke-dat-hang-v2' (docKeyFor() in src/services/api/files.ts)
create or replace function private.slugify(p_name text)
returns text
language sql immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(regexp_replace(public.search_norm(regexp_replace(coalesce(p_name, ''), '\.[^./\\]+$', '')),
                                '[^a-z0-9]+', '-', 'g'), '-'), ''),
    'file')
$$;


-- =====================================================================================================
-- 3. Tables
-- =====================================================================================================

-- ── users → profiles (1:1 with auth.users) ──────────────────────────────────────────────────────────
-- Passwords live in Supabase Auth (the mock's User.password is never stored here). Rows are created by
-- the invite Edge Function (service role) right after auth.admin.inviteUserByEmail / createUser.
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null check (btrim(full_name) <> ''),
  email             text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  phone             text,
  org_type          public.org_type not null,
  account_id        uuid,                                   -- FK added once public.accounts exists
  role              public.user_role not null,
  -- director: always true · AM: only when granted by the director · member / client: always false
  can_view_cost     boolean not null default false,
  title             text,
  salutation        public.salutation,
  avatar_url        text,
  notification_pref public.notification_pref not null default 'all',
  onboarded_at      timestamptz,
  invited_at        timestamptz,
  invited_by        uuid references public.profiles (id),
  last_login_at     timestamptz,
  status            public.user_status not null default 'invited',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint profiles_org_account check ((org_type = 'client') = (account_id is not null)),
  constraint profiles_role_org check (
    (org_type = 'internal' and role in ('director', 'am', 'member'))
    or (org_type = 'client' and role in ('client_owner', 'client_member'))),
  constraint profiles_cost_roles check (not can_view_cost or role in ('director', 'am'))
);
comment on table public.profiles is 'types.ts User. id = auth.users.id. Client users: email must use the account email_domain.';

-- ── accounts ─────────────────────────────────────────────────────────────────────────────────────────
create table public.accounts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (btrim(name) <> ''),
  short_name              text not null check (btrim(short_name) <> ''),
  logo_url                text,
  brand_color             text not null default '#1D4ED8' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  industry                text not null default '',
  tier                    public.account_tier not null default 'standard',
  stage                   public.account_stage not null default 'prospecting',
  am_id                   uuid not null references public.profiles (id),
  -- SPEC §8 `health_auto`: cache of public.account_health(), refreshed by public.refresh_health_cache()
  health_auto             public.health,
  health_auto_at          timestamptz,
  health_override         public.health,
  health_override_reason  text,                              -- INTERNAL ONLY (column privilege)
  health_override_by      uuid references public.profiles (id), -- INTERNAL ONLY
  health_override_at      timestamptz,
  exec_summary            text not null default '' check (cardinality(string_to_array(exec_summary, E'\n')) <= 3),
  exec_summary_updated_at timestamptz,
  email_domain            text not null check (email_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  internal_notes          text,                              -- INTERNAL ONLY
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint accounts_override_reason check (health_override is null or coalesce(btrim(health_override_reason), '') <> '')
);

alter table public.profiles
  add constraint profiles_account_fk foreign key (account_id) references public.accounts (id);

-- ── contacts ─────────────────────────────────────────────────────────────────────────────────────────
create table public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.accounts (id),
  full_name             text not null check (btrim(full_name) <> ''),
  salutation            public.salutation not null,
  title                 text not null default '',
  decision_role         public.decision_role not null,
  email                 text not null default '' check (email = lower(btrim(email))),
  phone                 text,
  user_id               uuid references public.profiles (id),
  last_interaction_at   timestamptz,
  last_interaction_note text,                                -- INTERNAL ONLY
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

-- ── projects ─────────────────────────────────────────────────────────────────────────────────────────
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  name       text not null check (btrim(name) <> ''),
  code       text not null default '',
  start_date date not null,
  end_date   date not null,
  status     public.project_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_dates check (end_date >= start_date)
);

-- ── milestones ───────────────────────────────────────────────────────────────────────────────────────
create table public.milestones (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects (id),
  name                     text not null check (btrim(name) <> ''),
  -- 1-based order inside the project; later milestones shift with earlier ones
  order_no                 integer not null check (order_no >= 1),
  planned_date             date not null,
  -- = SPEC column `forecast_date` (manual forecast set by the AM). null = computed, see public.milestone_forecasts()
  forecast_override_date   date,
  forecast_override_reason text,                             -- client-visible (SPEC 5.4 "lý do nếu lùi")
  status                   public.milestone_status not null default 'upcoming',
  completed_at             timestamptz,
  client_visible           boolean not null default true,
  description              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  constraint milestones_override_reason check (forecast_override_date is null or coalesce(btrim(forecast_override_reason), '') <> ''),
  constraint milestones_completed check (completed_at is null or status = 'done')
);

-- ── price_items / account_prices ─────────────────────────────────────────────────────────────────────
create table public.price_items (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (btrim(code) <> ''),
  name        text not null check (btrim(name) <> ''),
  unit        public.price_unit not null,
  list_price  bigint not null check (list_price >= 0),
  cost_price  bigint not null default 0 check (cost_price >= 0),  -- INTERNAL ONLY: no SELECT for `authenticated`
  category    text not null default '',
  active      boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.account_prices (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts (id),
  price_item_id    uuid not null references public.price_items (id),
  negotiated_price bigint not null check (negotiated_price >= 0),
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint account_prices_unique unique (account_id, price_item_id)
);

-- ── quotes / quote_lines ─────────────────────────────────────────────────────────────────────────────
create table public.quotes (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.accounts (id),
  project_id            uuid references public.projects (id),
  -- shared by all versions, e.g. 'BG-TA-2026-03'
  code                  text not null check (btrim(code) <> ''),
  title                 text not null check (btrim(title) <> ''),
  version               integer not null default 1 check (version >= 1),
  parent_id             uuid references public.quotes (id),
  status                public.quote_status not null default 'draft',
  valid_until           date not null,
  discount_pct_total    numeric(5,2) not null default 0 check (discount_pct_total between 0 and 100),
  approval_requested_at timestamptz,
  approval_requested_by uuid references public.profiles (id),
  director_approved_by  uuid references public.profiles (id),
  director_approved_at  timestamptz,
  approval_note         text,                                -- INTERNAL ONLY (director's note)
  sent_at               timestamptz,
  sent_by               uuid references public.profiles (id),
  client_decision       public.client_decision,
  client_decided_by     uuid references public.profiles (id),
  client_decided_at     timestamptz,
  client_note           text,
  notes                 text,                                -- shown on the client quote page
  internal_note         text,                                -- INTERNAL ONLY
  created_by            uuid not null default auth.uid() references public.profiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint quotes_version_unique unique (account_id, code, version),
  constraint quotes_approval_pair check ((director_approved_by is null) = (director_approved_at is null)),
  constraint quotes_sent check (status not in ('sent', 'accepted', 'changes_requested', 'expired') or sent_at is not null),
  constraint quotes_decision check (client_decision is null or (client_decided_by is not null and client_decided_at is not null)),
  constraint quotes_decision_status check (status not in ('accepted', 'changes_requested') or client_decision::text = status::text)
);

create table public.quote_lines (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references public.quotes (id) on delete cascade,
  price_item_id uuid not null references public.price_items (id),
  description   text,
  qty           numeric(12,2) not null check (qty > 0),
  -- price used on this quote (defaults to the account negotiated price, else list price)
  unit_price    bigint not null check (unit_price >= 0),
  discount_pct  numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  vat_rate      smallint not null default 10 check (vat_rate in (0, 5, 8, 10)),   -- types.ts VatRate
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── tasks ────────────────────────────────────────────────────────────────────────────────────────────
create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id),
  milestone_id         uuid references public.milestones (id),
  -- starts with a verb, plain words: "Duyệt thiết kế màn hình Đặt hàng"
  title                text not null check (btrim(title) <> ''),
  description          text not null default '',
  side                 public.task_side not null,
  type                 public.task_type not null,
  assignee_id          uuid references public.profiles (id),
  delegated_by         uuid references public.profiles (id),
  delegated_at         timestamptz,
  delegation_note      text,
  requires_owner       boolean not null default false,
  -- who must act next; null once done (drives "Đang chờ khách / Đang chờ New Era")
  waiting_on           public.waiting_on,
  due_date             date not null,
  status               public.task_status not null default 'todo',
  -- "Nếu chưa làm"
  impact_text          text not null default '',
  client_visible       boolean not null default true,
  reminder_count       integer not null default 0 check (reminder_count >= 0),
  last_reminded_at     timestamptz,
  manual_unblock_reason text,                               -- INTERNAL ONLY
  manual_unblocked_by  uuid references public.profiles (id), -- INTERNAL ONLY
  manual_unblocked_at  timestamptz,                         -- INTERNAL ONLY
  completed_at         timestamptz,
  quote_id             uuid references public.quotes (id),
  payment_schedule_id  uuid,                                -- FK added once payment_schedules exists
  revision             integer not null default 1 check (revision >= 1),
  answer_text          text,
  created_by           uuid not null default auth.uid() references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint tasks_type_side check ((side = 'client') = (type <> 'work')),
  constraint tasks_client_always_visible check (side = 'internal' or client_visible),
  constraint tasks_requires_owner_client check (not requires_owner or side = 'client'),
  constraint tasks_delegation_client check (delegated_by is null or side = 'client'),
  -- SPEC §1.2: every client task has a due date, an impact sentence and one primary action
  constraint tasks_client_impact check (side = 'internal' or btrim(impact_text) <> ''),
  -- waiting_on state machine (taskRules.ts); normalised by trg_tasks_guard before this check runs
  constraint tasks_done_state check (
    (status = 'done' and waiting_on is null and completed_at is not null)
    or (status <> 'done' and waiting_on is not null and completed_at is null)),
  constraint tasks_internal_waits_internal check (side = 'client' or waiting_on is null or waiting_on = 'internal'),
  constraint tasks_unblock_reason check (manual_unblocked_at is null or coalesce(btrim(manual_unblock_reason), '') <> '')
);

-- ── task_dependencies ────────────────────────────────────────────────────────────────────────────────
-- task_id blocks exactly one target: another task OR a milestone. Same account, no self-dependency,
-- no cycle (trg_task_dependencies_guard). Rows are immutable: edit = delete + insert (replaceDeps()).
create table public.task_dependencies (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks (id) on delete cascade,
  blocks_task_id      uuid references public.tasks (id) on delete cascade,
  blocks_milestone_id uuid references public.milestones (id) on delete cascade,
  created_by          uuid not null default auth.uid() references public.profiles (id),
  created_at          timestamptz not null default now(),
  constraint task_dependencies_one_target check (num_nonnulls(blocks_task_id, blocks_milestone_id) = 1),
  constraint task_dependencies_no_self check (blocks_task_id is null or blocks_task_id <> task_id)
);

-- ── comments ─────────────────────────────────────────────────────────────────────────────────────────
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id),
  author_id   uuid not null default auth.uid() references public.profiles (id),
  body        text not null check (btrim(body) <> ''),
  -- 'internal' = Ghi chú nội bộ (never returned to client accounts)
  visibility  public.visibility not null default 'internal',
  reply_to_id uuid references public.comments (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── files ────────────────────────────────────────────────────────────────────────────────────────────
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts (id),
  project_id   uuid references public.projects (id),
  task_id      uuid references public.tasks (id),
  name         text not null check (btrim(name) <> ''),
  -- groups versions of the same document (filled from the file name when omitted)
  doc_key      text not null,
  -- max version of doc_key in the account + 1 when omitted
  version      integer not null check (version >= 1),
  mime         text not null default 'application/octet-stream',
  size         bigint not null default 0 check (size >= 0),
  -- '<bucket id>/<object path>' in Supabase Storage, e.g. 'acc-…/incoming/<uid>/thiet-ke.pdf'
  -- (imported demo files keep 'sample:<key>')
  storage_path text not null,
  visibility   public.visibility not null default 'internal',
  kind         public.file_kind not null default 'document',
  uploaded_by  uuid not null default auth.uid() references public.profiles (id),
  uploaded_at  timestamptz not null default now(),
  note         text,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint files_version_unique unique (account_id, doc_key, version)
);

-- ── contracts / payment_schedules ────────────────────────────────────────────────────────────────────
create table public.contracts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts (id),
  quote_id    uuid references public.quotes (id),
  code        text not null check (btrim(code) <> ''),
  title       text not null check (btrim(title) <> ''),
  value       bigint not null check (value >= 0),              -- VND incl. VAT
  signed_date date,
  start_date  date not null,
  end_date    date not null,
  status      public.contract_status not null default 'draft',
  file_id     uuid references public.files (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint contracts_dates check (end_date >= start_date)
);

-- One installment ("đợt thanh toán"). 'overdue' is stored by the daily job but always re-derivable:
-- status in (invoiced, overdue) and today_vn() > due_date.
create table public.payment_schedules (
  id                 uuid primary key default gen_random_uuid(),
  contract_id        uuid not null references public.contracts (id),
  name               text not null check (btrim(name) <> ''),
  percent            numeric(5,2) not null check (percent between 0 and 100),
  amount             bigint not null check (amount >= 0),
  -- when this milestone completes, status → 'invoice_due' (trg_milestones_completed)
  milestone_id       uuid references public.milestones (id),
  due_date           date not null,
  status             public.payment_status not null default 'not_due',
  invoice_no         text,
  invoiced_at        timestamptz,
  paid_at            timestamptz,
  client_reported_at timestamptz,
  proof_file_id      uuid references public.files (id),
  -- AM can turn off the auto-created client "Thanh toán" task
  auto_task_enabled  boolean not null default true,
  task_id            uuid references public.tasks (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint payment_schedules_paid check (status <> 'paid' or paid_at is not null)
);

alter table public.tasks
  add constraint tasks_payment_schedule_fk foreign key (payment_schedule_id) references public.payment_schedules (id);

-- ── activities (nhật ký) ─────────────────────────────────────────────────────────────────────────────
-- Append-only audit log: "ai, lúc nào, nội dung gì" (SPEC §4.2, §11). Written by RPCs / the service layer.
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts (id),       -- null = company-wide (settings, staff)
  actor_id      uuid references public.profiles (id),       -- null = system
  action        public.activity_action not null,
  target_type   public.activity_target_type not null,
  target_id     text not null,                              -- id of the target row (uuid text; 'settings')
  -- extension (not in types.ts): the task an entry is about (target or params.task_id), filled by trigger.
  -- Used by RLS (hidden internal tasks) and by "Lịch sử phê duyệt" per task.
  task_id       uuid references public.tasks (id) on delete set null,
  -- values for the i18n sentence `activity.<action>` (e.g. {"task": "Duyệt thiết kế…", "reason": "…"})
  params        jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  -- 'shared' entries appear in the client's "Cập nhật mới" and approval history
  visibility    public.visibility not null default 'internal',
  created_at    timestamptz not null default now(),
  -- extension: bookkeeping of the notification dispatcher (README §6); null = not processed yet
  dispatched_at timestamptz
);

-- ── notifications / email_outbox ─────────────────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  title      text not null,
  body       text not null default '',
  -- in-app path: '/portal/tasks/<id>' (client) or '/app/accounts/<a>/tasks?task=<id>' (internal)
  link       text not null,
  account_id uuid references public.accounts (id),
  task_id    uuid references public.tasks (id) on delete set null,
  urgent     boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  -- idempotency key of the daily sweep, e.g. 'due3:<task>:2026-10-06'
  dedupe_key text
);

-- types.ts EmailMessage (DbData.emails in the mock).
create table public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_user_id  uuid not null references public.profiles (id),
  to_email    text not null,
  subject     text not null,
  body_text   text not null,
  -- absolute path opened by the e-mail button — straight to the task, never via the home page
  link        text,
  kind        public.notification_kind not null,
  urgent      boolean not null default false,
  -- 'batched' = merged into the daily summary; 'suppressed' = user preference
  status      public.email_status not null,
  batch_key   text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  reason      text
);

-- ── project_templates / settings ─────────────────────────────────────────────────────────────────────
create table public.project_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> ''),
  description text not null default '',
  -- TemplateMilestone[]: [{ "name": "Kickoff", "offset_days": 0, "client_visible": true }, …]
  milestones  jsonb not null default '[]'::jsonb check (jsonb_typeof(milestones) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Singleton row (types.ts Settings + DbMeta.last_sweep_date).
create table public.settings (
  id                              boolean primary key default true check (id),
  company_name                    text not null default 'New Era',
  timezone                        text not null default 'Asia/Ho_Chi_Minh' check (timezone = 'Asia/Ho_Chi_Minh'),
  -- quotes whose effective discount vs the account price is STRICTLY above this need director approval
  discount_approval_threshold_pct numeric(5,2) not null default 10 check (discount_approval_threshold_pct between 0 and 100),
  escalation_overdue_days         integer not null default 3 check (escalation_overdue_days >= 1),
  reminder_days_before            integer[] not null default '{3,1}' check (0 < all (reminder_days_before)),
  overdue_reminder_per_day        integer not null default 1 check (overdue_reminder_per_day >= 0),
  max_emails_per_day              integer not null default 1 check (max_emails_per_day >= 1),
  -- 0 = Sunday … 6 = Saturday (same as src/domain/dates.ts weekday())
  weekly_digest_weekday           smallint not null default 1 check (weekly_digest_weekday between 0 and 6),
  weekly_digest_hour              smallint not null default 8 check (weekly_digest_hour between 0 and 23),
  payment_task_auto               boolean not null default true,
  last_sweep_date                 date,
  updated_at                      timestamptz not null default now(),
  updated_by                      uuid references public.profiles (id)
);
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ── undo of client actions (private) ─────────────────────────────────────────────────────────────────
-- Before-images of the rows a client action touched; undo_task_action() restores them for 10 seconds.
create table private.action_undo (
  token           uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  task_id         uuid not null,
  account_id      uuid not null,
  -- tasks.updated_at right after the action: undo is refused once anyone changed the task again
  task_updated_at timestamptz not null,
  -- [{ "t": table, "id": uuid, "before": row | null }] in write order (null = row was inserted)
  snapshot        jsonb not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);


-- =====================================================================================================
-- 4. Indexes (every foreign key + the common filters of the service layer)
-- =====================================================================================================

create unique index profiles_email_key            on public.profiles (email) where deleted_at is null;
create index profiles_account_idx                 on public.profiles (account_id);
create index profiles_invited_by_idx              on public.profiles (invited_by);
create index profiles_role_idx                    on public.profiles (role) where deleted_at is null;

create index accounts_am_idx                      on public.accounts (am_id);
create index accounts_health_override_by_idx      on public.accounts (health_override_by);
create index accounts_stage_idx                   on public.accounts (stage) where deleted_at is null;
create index accounts_name_trgm                   on public.accounts using gin (public.search_norm(name) extensions.gin_trgm_ops);

create index contacts_account_idx                 on public.contacts (account_id);
create index contacts_user_idx                    on public.contacts (user_id);
create index contacts_name_trgm                   on public.contacts using gin (public.search_norm(full_name) extensions.gin_trgm_ops);

create index projects_account_idx                 on public.projects (account_id);

create index milestones_project_order_idx         on public.milestones (project_id, order_no);

create unique index price_items_code_key          on public.price_items (lower(code)) where deleted_at is null;
create index account_prices_item_idx              on public.account_prices (price_item_id);

create index quotes_account_status_idx            on public.quotes (account_id, status);
create index quotes_project_idx                   on public.quotes (project_id);
create index quotes_parent_idx                    on public.quotes (parent_id);
create index quotes_approval_requested_by_idx     on public.quotes (approval_requested_by);
create index quotes_director_approved_by_idx      on public.quotes (director_approved_by);
create index quotes_sent_by_idx                   on public.quotes (sent_by);
create index quotes_client_decided_by_idx         on public.quotes (client_decided_by);
create index quotes_created_by_idx                on public.quotes (created_by);
create index quotes_pending_idx                   on public.quotes (created_at) where status = 'pending_approval' and deleted_at is null;
create index quotes_title_trgm                    on public.quotes using gin (public.search_norm(title) extensions.gin_trgm_ops);
create index quote_lines_quote_idx                on public.quote_lines (quote_id, sort_order);
create index quote_lines_item_idx                 on public.quote_lines (price_item_id);

create index tasks_project_idx                    on public.tasks (project_id);
create index tasks_milestone_idx                  on public.tasks (milestone_id);
create index tasks_assignee_idx                   on public.tasks (assignee_id);
create index tasks_delegated_by_idx               on public.tasks (delegated_by);
create index tasks_manual_unblocked_by_idx        on public.tasks (manual_unblocked_by);
create index tasks_quote_idx                      on public.tasks (quote_id);
create index tasks_payment_schedule_idx           on public.tasks (payment_schedule_id);
create index tasks_created_by_idx                 on public.tasks (created_by);
-- open tasks by due date (overdue / due-soon / "việc cần xử lý" lists, daily sweep)
create index tasks_open_due_idx                   on public.tasks (project_id, due_date) where status <> 'done' and deleted_at is null;
create index tasks_waiting_idx                    on public.tasks (waiting_on, due_date) where status <> 'done' and deleted_at is null;
create index tasks_title_trgm                     on public.tasks using gin (public.search_norm(title) extensions.gin_trgm_ops);

create unique index task_dependencies_task_edge_key on public.task_dependencies (task_id, blocks_task_id) where blocks_task_id is not null;
create unique index task_dependencies_ms_edge_key   on public.task_dependencies (task_id, blocks_milestone_id) where blocks_milestone_id is not null;
create index task_dependencies_task_idx           on public.task_dependencies (task_id);
create index task_dependencies_blocks_task_idx    on public.task_dependencies (blocks_task_id);
create index task_dependencies_blocks_ms_idx      on public.task_dependencies (blocks_milestone_id);
create index task_dependencies_created_by_idx     on public.task_dependencies (created_by);

create index comments_task_idx                    on public.comments (task_id, created_at);
create index comments_author_idx                  on public.comments (author_id);
create index comments_reply_idx                   on public.comments (reply_to_id);

create index files_account_idx                    on public.files (account_id, uploaded_at desc);
create index files_project_idx                    on public.files (project_id);
create index files_task_idx                       on public.files (task_id);
create index files_uploaded_by_idx                on public.files (uploaded_by);
create index files_storage_path_idx               on public.files (storage_path);

create index contracts_account_idx                on public.contracts (account_id);
create index contracts_quote_idx                  on public.contracts (quote_id);
create index contracts_file_idx                   on public.contracts (file_id);

create index payment_schedules_contract_idx       on public.payment_schedules (contract_id);
create index payment_schedules_milestone_idx      on public.payment_schedules (milestone_id);
create index payment_schedules_task_idx           on public.payment_schedules (task_id);
create index payment_schedules_proof_idx          on public.payment_schedules (proof_file_id);
create index payment_schedules_status_due_idx     on public.payment_schedules (status, due_date) where deleted_at is null;

create index activities_account_idx               on public.activities (account_id, created_at desc);
create index activities_task_idx                  on public.activities (task_id, created_at desc);
create index activities_actor_idx                 on public.activities (actor_id);
create index activities_undispatched_idx          on public.activities (created_at) where dispatched_at is null;

create index notifications_user_idx               on public.notifications (user_id, created_at desc);
create index notifications_unread_idx             on public.notifications (user_id) where read_at is null;
create index notifications_account_idx            on public.notifications (account_id);
create index notifications_task_idx               on public.notifications (task_id);
create unique index notifications_dedupe_key      on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create index email_outbox_user_idx                on public.email_outbox (to_user_id, created_at desc);
create index email_outbox_batch_idx               on public.email_outbox (batch_key) where batch_key is not null;

create index settings_updated_by_idx              on public.settings (updated_by);
create index action_undo_expires_idx              on private.action_undo (expires_at);


-- =====================================================================================================
-- 5. Viewer helpers (SECURITY DEFINER: they read profiles/accounts without going through RLS, which
--    also avoids policy recursion). They only describe the CALLER, so exposing them as RPC is harmless.
-- =====================================================================================================

-- The caller as the data layer sees them (= `Viewer` in contract.ts). null when not signed in, disabled
-- or soft-deleted. In "Xem như khách hàng" mode: read-only client_owner of the viewed account.
create or replace function public.auth_viewer()
returns public.viewer_ctx
language plpgsql stable security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype;
  va  uuid;
  ctx public.viewer_ctx;
begin
  select p.* into me
    from public.profiles p
   where p.id = auth.uid() and p.deleted_at is null and p.status <> 'disabled';
  if not found then
    return null;
  end if;

  ctx.user_id := me.id;
  va := public.view_as_account_id();
  if va is not null and me.org_type = 'internal' and exists (
       select 1
         from public.accounts a
        where a.id = va and a.deleted_at is null
          and (me.role = 'director'
               or (me.role = 'am' and a.am_id = me.id)
               or (me.role = 'member' and exists (
                     select 1
                       from public.tasks t
                       join public.projects pr on pr.id = t.project_id
                      where pr.account_id = a.id and t.assignee_id = me.id and t.deleted_at is null))))
  then
    ctx.role          := 'client_owner'::public.user_role;
    ctx.org_type      := 'client'::public.org_type;
    ctx.account_id    := va;
    ctx.can_view_cost := false;
    ctx.read_only     := true;
  else
    ctx.role          := me.role;
    ctx.org_type      := me.org_type;
    ctx.account_id    := me.account_id;
    ctx.can_view_cost := me.role = 'director' or (me.role = 'am' and me.can_view_cost);
    ctx.read_only     := false;
  end if;
  return ctx;
end;
$$;

create or replace function public.auth_role()
returns public.user_role
language sql stable
set search_path = ''
as $$ select v.role from public.auth_viewer() v $$;

create or replace function public.auth_account_id()
returns uuid
language sql stable
set search_path = ''
as $$ select v.account_id from public.auth_viewer() v $$;

create or replace function public.is_internal()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.org_type = 'internal', false) from public.auth_viewer() v $$;

create or replace function public.is_client()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.org_type = 'client', false) from public.auth_viewer() v $$;

create or replace function public.is_director()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.role = 'director' and not v.read_only, false) from public.auth_viewer() v $$;

-- director, or an AM granted by the director (never clients, never members)
create or replace function public.can_view_cost()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.org_type = 'internal' and v.can_view_cost, false) from public.auth_viewer() v $$;

-- "Xem như khách hàng" session: every write is refused
create or replace function public.is_read_only()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.read_only, false) from public.auth_viewer() v $$;

-- client_member has no commercial access (quotes, contracts, payments, prices)
create or replace function public.can_access_commercial()
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(v.role <> 'client_member', false) from public.auth_viewer() v $$;

-- director, or the AM in charge of the account (never in read-only mode)
create or replace function public.is_manager_of(p_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    v.org_type = 'internal' and not v.read_only
    and (v.role = 'director'
         or (v.role = 'am' and exists (
               select 1 from public.accounts a
                where a.id = p_account_id and a.am_id = v.user_id and a.deleted_at is null))),
    false)
  from public.auth_viewer() v
$$;

-- accessibleAccountIds() of src/services/context.ts
create or replace function public.readable_account_ids()
returns uuid[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.viewer_ctx := public.auth_viewer();
begin
  if v.user_id is null then
    return '{}'::uuid[];
  end if;
  if v.org_type = 'client' then
    return case when v.account_id is null then '{}'::uuid[] else array[v.account_id] end;
  end if;
  if v.role = 'director' then
    return coalesce((select array_agg(a.id) from public.accounts a where a.deleted_at is null), '{}'::uuid[]);
  end if;
  if v.role = 'am' then
    return coalesce((select array_agg(a.id) from public.accounts a
                      where a.deleted_at is null and a.am_id = v.user_id), '{}'::uuid[]);
  end if;
  -- member: accounts where they are assigned at least one task
  return coalesce((select array_agg(distinct pr.account_id)
                     from public.tasks t
                     join public.projects pr on pr.id = t.project_id
                     join public.accounts a on a.id = pr.account_id
                    where t.assignee_id = v.user_id and t.deleted_at is null and a.deleted_at is null), '{}'::uuid[]);
end;
$$;

create or replace function public.readable_project_ids()
returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
    from public.projects p
   where p.account_id = any (public.readable_account_ids())
     and (p.deleted_at is null or public.is_internal())
$$;

create or replace function public.can_read_account(p_account_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(p_account_id = any (public.readable_account_ids()), false) $$;

create or replace function public.project_account_id(p_project_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select p.account_id from public.projects p where p.id = p_project_id $$;

create or replace function public.task_account_id(p_task_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select p.account_id from public.tasks t join public.projects p on p.id = t.project_id where t.id = p_task_id $$;

create or replace function public.quote_account_id(p_quote_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select q.account_id from public.quotes q where q.id = p_quote_id $$;

create or replace function public.contract_account_id(p_contract_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select c.account_id from public.contracts c where c.id = p_contract_id $$;

-- canViewTask(): account access + (internal, or client task, or client_visible internal task)
create or replace function public.can_read_task(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where t.id = p_task_id
       and p.account_id = any (public.readable_account_ids())
       and (public.is_internal()
            or (t.deleted_at is null and p.deleted_at is null and (t.side = 'client' or t.client_visible))))
$$;

-- canViewQuote(): commercial access + clients only once sent (sent / accepted / changes_requested / expired)
create or replace function public.can_read_quote(p_quote_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.quotes q
     where q.id = p_quote_id
       and q.account_id = any (public.readable_account_ids())
       and public.can_access_commercial()
       and (public.is_internal()
            or (q.deleted_at is null and q.status in ('sent', 'accepted', 'changes_requested', 'expired'))))
$$;

-- for the activity policy: history survives deletion, so soft-deleted tasks count too
create or replace function public.task_client_visible(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select t.side = 'client' or t.client_visible from public.tasks t where t.id = p_task_id), true) $$;

create or replace function public.milestone_client_visible(p_milestone_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select m.client_visible from public.milestones m where m.id = public.try_uuid(p_milestone_id)), true) $$;

-- blocked = not done, not manually unblocked, and at least one direct blocker not done (graph.ts blockersOf)
create or replace function private.task_blocked(p_task_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.tasks t
      join public.task_dependencies d on d.blocks_task_id = t.id
      join public.tasks b on b.id = d.task_id and b.deleted_at is null and b.status <> 'done'
     where t.id = p_task_id and t.deleted_at is null and t.status <> 'done'
       and coalesce(btrim(t.manual_unblock_reason), '') = '')
$$;

create or replace function public.task_is_blocked(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select public.can_read_task(p_task_id) and private.task_blocked(p_task_id) $$;

-- unfinished blockers' titles for ApiError.details.blockers; null = hidden from a client viewer
-- (the UI says "việc chuẩn bị của New Era", errors.hidden_blocker)
create or replace function private.blocker_titles(p_task_id uuid, p_for_client boolean)
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(case when not p_for_client or b.side = 'client' or b.client_visible
                                 then to_jsonb(b.title) else 'null'::jsonb end
                            order by b.due_date, b.id), '[]'::jsonb)
    from public.task_dependencies d
    join public.tasks b on b.id = d.task_id and b.deleted_at is null and b.status <> 'done'
   where d.blocks_task_id = p_task_id
$$;

-- viewer-aware version (callable from invoker triggers / RPC): titles of blockers hidden from a client are null
create or replace function public.task_blocker_titles(p_task_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case when public.can_read_task(p_task_id)
              then private.blocker_titles(p_task_id, not public.is_internal())
              else '[]'::jsonb end
$$;


-- =====================================================================================================
-- 6. Quote arithmetic (owner-only views in schema private; see section 10 for the public views)
--    Mirrors src/domain/quoteMath.ts: every money value rounded to whole VND.
--    subtotal = qty × unit_price · discount_amount = subtotal × discount_pct% ·
--    header_share = (subtotal − discount_amount) × discount_pct_total% · net = subtotal − discount − header ·
--    vat = net × vat_rate% · total = net + vat · effective_discount_pct = (1 − Σnet / Σ(qty × applicable)) × 100
--    (Postgres round() rounds halves away from zero, Math.round towards +∞: identical for positive amounts.)
-- =====================================================================================================

create view private.quote_line_math as
select
  ql.id,
  ql.quote_id,
  q.account_id,
  ql.price_item_id,
  ql.description,
  ql.sort_order,
  pi.code,
  pi.name,
  pi.unit,
  pi.list_price,
  coalesce(ap.negotiated_price, pi.list_price)                          as applicable_price,
  ql.qty,
  ql.unit_price,
  ql.discount_pct,
  ql.vat_rate,
  s.subtotal,
  d.discount_amount,
  h.header_share,
  n.net,
  v.vat_amount,
  n.net + v.vat_amount                                                  as total,
  round(ql.qty * coalesce(ap.negotiated_price, pi.list_price))::bigint  as gross_applicable,
  round(ql.qty * pi.cost_price)::bigint                                 as cost_total
from public.quote_lines ql
join public.quotes q       on q.id = ql.quote_id
join public.price_items pi on pi.id = ql.price_item_id
left join public.account_prices ap on ap.account_id = q.account_id and ap.price_item_id = ql.price_item_id
cross join lateral (select round(ql.qty * ql.unit_price)::bigint as subtotal) s
cross join lateral (select round(s.subtotal * ql.discount_pct / 100)::bigint as discount_amount) d
cross join lateral (select round((s.subtotal - d.discount_amount) * q.discount_pct_total / 100)::bigint as header_share) h
cross join lateral (select s.subtotal - d.discount_amount - h.header_share as net) n
cross join lateral (select round(n.net * ql.vat_rate / 100.0)::bigint as vat_amount) v;

create view private.quote_totals as
select
  q.id                                                  as quote_id,
  q.account_id,
  coalesce(sum(l.gross_applicable), 0)::bigint          as gross_applicable,
  coalesce(sum(l.subtotal), 0)::bigint                  as subtotal,
  coalesce(sum(l.discount_amount), 0)::bigint           as line_discount,
  coalesce(sum(l.header_share), 0)::bigint              as header_discount,
  coalesce(sum(l.net), 0)::bigint                       as net_before_vat,
  coalesce(sum(l.vat_amount), 0)::bigint                as vat,
  coalesce(sum(l.total), 0)::bigint                     as grand_total,
  case when coalesce(sum(l.gross_applicable), 0) > 0
       then round((1 - sum(l.net)::numeric / sum(l.gross_applicable)) * 100, 2)
       else 0 end                                       as effective_discount_pct,
  coalesce(sum(l.cost_total), 0)::bigint                as cost_total,
  (coalesce(sum(l.net), 0) - coalesce(sum(l.cost_total), 0))::bigint as margin,
  case when coalesce(sum(l.net), 0) > 0
       then round((sum(l.net) - sum(l.cost_total))::numeric / sum(l.net) * 100, 2)
       else 0 end                                       as margin_pct
from public.quotes q
left join private.quote_line_math l on l.quote_id = q.id
group by q.id, q.account_id;

-- needsDirectorApproval(): effective discount STRICTLY above settings.discount_approval_threshold_pct
create or replace function public.quote_needs_approval(p_quote_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select t.effective_discount_pct > s.discount_approval_threshold_pct
      from private.quote_totals t
      cross join public.settings s
     where t.quote_id = p_quote_id and s.id
       and (not private.is_end_user_call() or public.can_read_quote(p_quote_id))
  ), false)
$$;

create or replace function private.quote_params(q public.quotes)
returns jsonb
language sql stable
set search_path = ''
as $$ select jsonb_build_object('quote', q.title, 'code', q.code, 'version', q.version) $$;

-- the client may still decide: stored 'sent', not expired, not superseded by a newer SENT version
create or replace function private.quote_decidable(q public.quotes)
returns boolean
language sql stable
set search_path = ''
as $$
  select q.status = 'sent'
     and q.valid_until >= public.today_vn()
     and not exists (select 1 from public.quotes x
                      where x.account_id = q.account_id and x.code = q.code and x.version > q.version
                        and x.sent_at is not null and x.deleted_at is null)
$$;


-- =====================================================================================================
-- 7. Trigger functions + triggers
--    Invoker triggers treat current_user = 'authenticated' (a direct PostgREST write) as untrusted.
--    Inside SECURITY DEFINER RPCs / jobs / service role, current_user is the owner → trusted.
-- =====================================================================================================

-- updated_at only moves on real changes; trigger arguments name extra columns to ignore (caches).
create or replace function public.trg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ignore text[] := array['updated_at'] || coalesce(tg_argv::text[], '{}'::text[]);
begin
  if (to_jsonb(new) - v_ignore) is distinct from (to_jsonb(old) - v_ignore) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at          before update on public.profiles          for each row execute function public.trg_set_updated_at();
create trigger accounts_updated_at          before update on public.accounts          for each row execute function public.trg_set_updated_at('health_auto', 'health_auto_at');
create trigger contacts_updated_at          before update on public.contacts          for each row execute function public.trg_set_updated_at();
create trigger projects_updated_at          before update on public.projects          for each row execute function public.trg_set_updated_at();
create trigger milestones_updated_at        before update on public.milestones        for each row execute function public.trg_set_updated_at();
create trigger price_items_updated_at       before update on public.price_items       for each row execute function public.trg_set_updated_at();
create trigger account_prices_updated_at    before update on public.account_prices    for each row execute function public.trg_set_updated_at();
create trigger quotes_updated_at            before update on public.quotes            for each row execute function public.trg_set_updated_at();
create trigger quote_lines_updated_at       before update on public.quote_lines       for each row execute function public.trg_set_updated_at();
create trigger tasks_updated_at             before update on public.tasks             for each row execute function public.trg_set_updated_at();
create trigger comments_updated_at          before update on public.comments          for each row execute function public.trg_set_updated_at();
create trigger files_updated_at             before update on public.files             for each row execute function public.trg_set_updated_at();
create trigger contracts_updated_at         before update on public.contracts         for each row execute function public.trg_set_updated_at();
create trigger payment_schedules_updated_at before update on public.payment_schedules for each row execute function public.trg_set_updated_at();
create trigger project_templates_updated_at before update on public.project_templates for each row execute function public.trg_set_updated_at();
create trigger settings_updated_at          before update on public.settings          for each row execute function public.trg_set_updated_at('last_sweep_date');

-- ── profiles: normalisation, company-domain rule, protected columns ──────────────────────────────────
create or replace function public.trg_profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_domain   text;
  v_director boolean;
begin
  new.email := lower(btrim(new.email));
  if new.role = 'director' then
    new.can_view_cost := true;
  elsif new.role <> 'am' then
    new.can_view_cost := false;
  end if;

  -- client users must use the company e-mail domain (SPEC §2: "chỉ email cùng domain công ty")
  if new.org_type = 'client' then
    if tg_op = 'INSERT' then
      select a.email_domain into v_domain from public.accounts a where a.id = new.account_id;
      if v_domain is null or split_part(new.email, '@', 2) <> v_domain then
        perform private.api_error('domain_mismatch', 'errors.domain_mismatch', jsonb_build_object('domain', v_domain));
      end if;
    elsif new.email is distinct from old.email or new.account_id is distinct from old.account_id then
      select a.email_domain into v_domain from public.accounts a where a.id = new.account_id;
      if v_domain is null or split_part(new.email, '@', 2) <> v_domain then
        perform private.api_error('domain_mismatch', 'errors.domain_mismatch', jsonb_build_object('domain', v_domain));
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    v_director := public.is_director();
    -- identity & access: director only (setUserRole / setUserCanViewCost / assign account)
    if (new.email, new.org_type, new.account_id, new.role, new.can_view_cost, new.invited_by, new.invited_at)
       is distinct from (old.email, old.org_type, old.account_id, old.role, old.can_view_cost, old.invited_by, old.invited_at)
       and not v_director then
      perform private.api_error('forbidden', 'errors.forbidden');
    end if;
    -- status / soft delete: director, or the manager of a client user's account
    if (new.status, new.deleted_at) is distinct from (old.status, old.deleted_at)
       and not (v_director or (old.org_type = 'client' and public.is_manager_of(old.account_id))) then
      perform private.api_error('forbidden', 'errors.forbidden');
    end if;
    -- nobody changes their own role, cost permission or status
    if new.id = auth.uid()
       and (new.role, new.can_view_cost, new.status) is distinct from (old.role, old.can_view_cost, old.status) then
      perform private.api_error('validation', 'errors.cannot_change_self');
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.trg_profiles_guard();

-- ── accounts ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_accounts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_untrusted boolean := current_user in ('authenticated', 'anon');
  v_am_changed boolean := false;
begin
  new.email_domain := lower(btrim(new.email_domain));
  if tg_op = 'INSERT' then
    v_am_changed := true;
  elsif new.am_id is distinct from old.am_id then
    v_am_changed := true;
  end if;
  if v_am_changed and not exists (
       select 1 from public.profiles p
        where p.id = new.am_id and p.org_type = 'internal' and p.role in ('am', 'director')
          and p.status <> 'disabled' and p.deleted_at is null) then
    perform private.api_error('validation', 'errors.invalid_am');
  end if;
  if new.health_override is null then
    new.health_override_reason := null;
    new.health_override_by     := null;
    new.health_override_at     := null;
  end if;

  if not v_untrusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.health_auto    := null;
    new.health_auto_at := null;
    if new.health_override is not null then
      new.health_override_by := auth.uid();
      new.health_override_at := now();
    end if;
    new.exec_summary_updated_at := case when new.exec_summary <> '' then now() end;
    return new;
  end if;

  -- assignAm() and deleting an account are director-only
  if (new.am_id is distinct from old.am_id or new.deleted_at is distinct from old.deleted_at) and not public.is_director() then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  -- the health cache belongs to refresh_health_cache()
  if (new.health_auto, new.health_auto_at) is distinct from (old.health_auto, old.health_auto_at) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if new.health_override is not null
     and (new.health_override, new.health_override_reason) is distinct from (old.health_override, old.health_override_reason) then
    new.health_override_by := auth.uid();
    new.health_override_at := now();
  end if;
  if new.exec_summary is distinct from old.exec_summary then
    new.exec_summary_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger accounts_guard before insert or update on public.accounts
  for each row execute function public.trg_accounts_guard();

-- ── milestones ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_milestones_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  if new.forecast_override_date is null then
    new.forecast_override_reason := null;
  end if;
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    if new.project_id is distinct from old.project_id
       and public.project_account_id(new.project_id) is distinct from public.project_account_id(old.project_id) then
      perform private.api_error('validation', 'errors.invalid_project');
    end if;
  end if;
  return new;
end;
$$;

create trigger milestones_guard before insert or update on public.milestones
  for each row execute function public.trg_milestones_guard();

-- SPEC §4.5: "Mốc hoàn thành thì đợt gắn với mốc đó tự chuyển Đến hạn xuất hóa đơn" — enforced at the data
-- layer, whatever path completed the milestone (onMilestoneCompleted in commercialEffects.ts).
create or replace function public.trg_milestones_completed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select ps.id, ps.name, ps.amount, c.account_id, c.code
      from public.payment_schedules ps
      join public.contracts c on c.id = ps.contract_id
     where ps.milestone_id = new.id and ps.status = 'not_due'
       and ps.deleted_at is null and c.deleted_at is null
  loop
    update public.payment_schedules set status = 'invoice_due' where id = r.id;
    insert into public.activities (account_id, actor_id, action, target_type, target_id, params, visibility)
    values (r.account_id, auth.uid(), 'payment.invoice_due', 'payment', r.id::text,
            jsonb_build_object('note', r.name, 'amount', private.format_vnd(r.amount), 'contract', r.code), 'internal');
  end loop;
  return null;
end;
$$;

create trigger milestones_completed after update of status on public.milestones
  for each row when (new.status = 'done' and old.status is distinct from 'done')
  execute function public.trg_milestones_completed();

-- ── tasks: waiting_on state machine + blocked transitions + member column limits ─────────────────────
create or replace function public.trg_tasks_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_untrusted boolean := current_user in ('authenticated', 'anon');
  v_account   uuid;
  v_manager   boolean;
begin
  -- normalisation (always): taskRules.ts statusPatch / clientActionPatch invariants
  if new.side = 'client' then
    new.client_visible := true;
  end if;
  if new.status = 'done' then
    new.waiting_on   := null;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
    if new.side = 'internal' then
      new.waiting_on := 'internal'::public.waiting_on;
    elsif new.waiting_on is null then
      new.waiting_on := 'client'::public.waiting_on;
    end if;
  end if;
  if coalesce(btrim(new.manual_unblock_reason), '') = '' then
    new.manual_unblock_reason := null;
    new.manual_unblocked_by   := null;
    new.manual_unblocked_at   := null;
  end if;

  if not v_untrusted then
    return new;
  end if;

  v_account := public.project_account_id(new.project_id);
  v_manager := public.is_manager_of(v_account);

  if tg_op = 'INSERT' then
    new.created_by       := auth.uid();
    new.reminder_count   := 0;
    new.last_reminded_at := null;
    new.delegated_by     := null;
    new.delegated_at     := null;
    new.delegation_note  := null;
    if new.manual_unblock_reason is not null then
      new.manual_unblocked_by := auth.uid();
      new.manual_unblocked_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.project_id is distinct from old.project_id
     and v_account is distinct from public.project_account_id(old.project_id) then
    perform private.api_error('validation', 'errors.dependency_scope');
  end if;

  if not v_manager then
    -- the assignee of an internal task (member) may only move it between Kanban columns
    if (to_jsonb(new) - array['status', 'waiting_on', 'completed_at', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'waiting_on', 'completed_at', 'updated_at']) then
      perform private.api_error('forbidden', 'errors.forbidden');
    end if;
  end if;

  if new.manual_unblock_reason is not null and new.manual_unblock_reason is distinct from old.manual_unblock_reason then
    new.manual_unblocked_by := auth.uid();
    new.manual_unblocked_at := now();
  end if;

  if new.status is distinct from old.status then
    -- canMoveTo(): staff move client tasks only to todo / done; a blocked task cannot leave todo
    if new.side = 'client' and new.status not in ('todo', 'done') then
      perform private.api_error('validation', 'errors.invalid_transition');
    end if;
    -- (public definer helpers: this trigger runs with the caller's rights and cannot call private.*)
    if new.status <> 'todo' and public.task_is_blocked(new.id) then
      perform private.api_error('blocked', 'errors.blocked',
        jsonb_build_object('blockers', public.task_blocker_titles(new.id)));
    end if;
    if new.side = 'client' and new.status = 'todo' then
      new.waiting_on := 'client'::public.waiting_on;
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.trg_tasks_guard();

-- ── task_dependencies: same account, no cycle (owner rights: must see every edge of the account) ─────
create or replace function public.trg_task_dependencies_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_target  uuid;
begin
  v_account := public.task_account_id(new.task_id);
  if new.blocks_task_id is not null then
    v_target := public.task_account_id(new.blocks_task_id);
  else
    select p.account_id into v_target
      from public.milestones m join public.projects p on p.id = m.project_id
     where m.id = new.blocks_milestone_id;
  end if;
  if v_account is null or v_target is distinct from v_account then
    perform private.api_error('validation', 'errors.dependency_scope');
  end if;
  if new.blocks_task_id = new.task_id then
    perform private.api_error('cycle', 'errors.cycle', jsonb_build_object('task_ids', jsonb_build_array(new.task_id, new.task_id)));
  end if;

  if new.blocks_task_id is not null then
    -- serialise dependency edits of one account so two concurrent inserts cannot close a cycle together
    perform pg_advisory_xact_lock(hashtextextended('task_dependencies:' || v_account::text, 0));
    -- adding A → B closes a cycle when B already reaches A (milestones are sinks, never part of a cycle)
    if exists (
      with recursive reach (id) as (
        select d.blocks_task_id from public.task_dependencies d
         where d.task_id = new.blocks_task_id and d.blocks_task_id is not null
        union
        select d.blocks_task_id from public.task_dependencies d
          join reach r on d.task_id = r.id
         where d.blocks_task_id is not null
      )
      select 1 from reach where reach.id = new.task_id
    ) then
      perform private.api_error('cycle', 'errors.cycle',
        jsonb_build_object('task_ids', jsonb_build_array(new.task_id, new.blocks_task_id)));
    end if;
  end if;
  return new;
end;
$$;

create trigger task_dependencies_guard before insert or update on public.task_dependencies
  for each row execute function public.trg_task_dependencies_guard();

-- ── files: doc_key + version (owner rights: versions of rows the caller cannot see count too) ────────
create or replace function public.trg_files_defaults()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.doc_key is null or btrim(new.doc_key) = '' then
    new.doc_key := coalesce(new.task_id::text || ':', '') || private.slugify(new.name);
  end if;
  if new.version is null then
    perform pg_advisory_xact_lock(hashtextextended('files:' || new.account_id::text || ':' || new.doc_key, 0));
    select coalesce(max(f.version), 0) + 1 into new.version
      from public.files f
     where f.account_id = new.account_id and f.doc_key = new.doc_key;
  end if;
  new.uploaded_at := coalesce(new.uploaded_at, now());
  return new;
end;
$$;

create trigger files_defaults before insert on public.files
  for each row execute function public.trg_files_defaults();

-- ── quotes: state machine driven by RPCs; send requires director approval when over threshold ───────
create or replace function public.trg_quotes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SPEC §4.5 / §11: over the threshold, a quote can never become 'sent' without a director approval
  -- (applies to every path, RPC or not)
  if tg_op = 'UPDATE' then
    if new.status = 'sent' and old.status is distinct from 'sent'
       and new.director_approved_by is null and public.quote_needs_approval(new.id) then
      perform private.api_error('needs_approval', 'errors.needs_approval');
    end if;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- a quote always starts as a draft (createQuote / createQuoteVersion)
    new.status                := 'draft'::public.quote_status;
    new.created_by            := auth.uid();
    new.approval_requested_at := null;
    new.approval_requested_by := null;
    new.director_approved_by  := null;
    new.director_approved_at  := null;
    new.approval_note         := null;
    new.sent_at               := null;
    new.sent_by               := null;
    new.client_decision       := null;
    new.client_decided_by     := null;
    new.client_decided_at     := null;
    new.client_note           := null;
    return new;
  end if;

  -- status and decision columns only change through request_quote_approval / approve_quote /
  -- reject_quote_approval / send_quote / client_accept_quote / client_request_quote_changes
  if (new.status, new.approval_requested_at, new.approval_requested_by, new.director_approved_at,
      new.approval_note, new.sent_at, new.sent_by, new.client_decision, new.client_decided_by,
      new.client_decided_at, new.client_note, new.account_id, new.code, new.version, new.created_by)
     is distinct from
     (old.status, old.approval_requested_at, old.approval_requested_by, old.director_approved_at,
      old.approval_note, old.sent_at, old.sent_by, old.client_decision, old.client_decided_by,
      old.client_decided_at, old.client_note, old.account_id, old.code, old.version, old.created_by) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  -- an approval can be withdrawn here (set to null), never granted
  if new.director_approved_by is not null and new.director_approved_by is distinct from old.director_approved_by then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if new.director_approved_by is null and old.director_approved_by is not null then
    new.director_approved_at := null;
    new.approval_note        := null;
  end if;
  -- commercial terms only change while the quote is a draft
  if old.status <> 'draft'
     and (new.title, new.project_id, new.valid_until, new.discount_pct_total, new.notes)
         is distinct from (old.title, old.project_id, old.valid_until, old.discount_pct_total, old.notes) then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_draft'));
  end if;
  return new;
end;
$$;

create trigger quotes_guard before insert or update on public.quotes
  for each row execute function public.trg_quotes_guard();

create or replace function public.trg_quote_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_status public.quote_status;
  v_new_status public.quote_status;
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select q.status into v_old_status from public.quotes q where q.id = old.quote_id;
    if v_old_status is distinct from 'draft' then
      perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_draft'));
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select q.status into v_new_status from public.quotes q where q.id = new.quote_id;
  if v_new_status is distinct from 'draft' then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_draft'));
  end if;
  return new;
end;
$$;

create trigger quote_lines_guard before insert or update or delete on public.quote_lines
  for each row execute function public.trg_quote_lines_guard();

-- saveQuoteDraft(): "a director approval covers the prices it saw" — a price change on an approved
-- draft voids the approval when the quote still needs one. Only for end-user edits (seed import keeps it).
create or replace function private.void_stale_approval(p_quote_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_end_user_call() then
    return;
  end if;
  update public.quotes q
     set director_approved_by = null, director_approved_at = null, approval_note = null
   where q.id = p_quote_id and q.status = 'draft' and q.director_approved_by is not null
     and public.quote_needs_approval(q.id);
end;
$$;

create or replace function public.trg_quote_lines_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.void_stale_approval(old.quote_id);
  else
    perform private.void_stale_approval(new.quote_id);
  end if;
  return null;
end;
$$;

create trigger quote_lines_changed after insert or update or delete on public.quote_lines
  for each row execute function public.trg_quote_lines_changed();

create or replace function public.trg_quotes_discount_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.void_stale_approval(new.id);
  return null;
end;
$$;

create trigger quotes_discount_changed after update of discount_pct_total on public.quotes
  for each row when (new.discount_pct_total is distinct from old.discount_pct_total)
  execute function public.trg_quotes_discount_changed();

-- ── payment_schedules: auto client "Thanh toán" task (ensurePaymentTask in commercialEffects.ts) ─────
create or replace function private.host_project_id(p_account_id uuid, p_preferred uuid)
returns uuid
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.projects p
      where p.id = p_preferred and p.account_id = p_account_id and p.deleted_at is null),
    (select p.id from public.projects p
      where p.account_id = p_account_id and p.deleted_at is null
      order by case p.status when 'active' then 0 when 'paused' then 1 else 2 end, p.start_date, p.id
      limit 1))
$$;

-- the client_owner a generated task is assigned to (primaryOwnerOf in context.ts)
create or replace function private.primary_owner_id(p_account_id uuid)
returns uuid
language sql stable
set search_path = ''
as $$
  select p.id from public.profiles p
   where p.account_id = p_account_id and p.role = 'client_owner'
     and p.status <> 'disabled' and p.deleted_at is null
   order by (p.status = 'active') desc, p.created_at, p.id
   limit 1
$$;

-- Texts mirror i18n activity.commercialGen.* (stored on the task as data, like the mock does).
create or replace function private.ensure_payment_task(p_payment_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  p         public.payment_schedules;
  c         public.contracts;
  a         public.accounts;
  v_project uuid;
  v_amount  text;
  v_id      uuid;
begin
  select * into p from public.payment_schedules where id = p_payment_id and deleted_at is null;
  if not found or not p.auto_task_enabled or p.status not in ('invoiced', 'overdue') then
    return null;
  end if;
  if not coalesce((select s.payment_task_auto from public.settings s where s.id), true) then
    return null;
  end if;
  if exists (select 1 from public.tasks t
              where t.deleted_at is null and (t.id = p.task_id or t.payment_schedule_id = p.id)) then
    return null;
  end if;
  select * into c from public.contracts where id = p.contract_id and deleted_at is null;
  if not found then
    return null;
  end if;
  select * into a from public.accounts where id = c.account_id and deleted_at is null;
  if not found then
    return null;
  end if;
  v_project := private.host_project_id(a.id, coalesce(
    (select m.project_id from public.milestones m where m.id = p.milestone_id),
    (select q.project_id from public.quotes q where q.id = c.quote_id)));
  if v_project is null then
    return null;
  end if;
  v_amount := private.format_vnd(p.amount);

  insert into public.tasks (project_id, title, description, side, type, assignee_id, requires_owner,
                            waiting_on, due_date, status, impact_text, client_visible,
                            payment_schedule_id, created_by)
  values (
    v_project,
    format('Thanh toán %s (hợp đồng %s)', p.name, c.code),
    case when p.invoice_no is not null
      then format('Hóa đơn %s · Số tiền %s · Hạn thanh toán %s. Sau khi chuyển khoản, bấm “Báo đã chuyển khoản” và đính kèm chứng từ.',
                  p.invoice_no, v_amount, to_char(p.due_date, 'DD/MM/YYYY'))
      else format('Số tiền %s · Hạn thanh toán %s. Sau khi chuyển khoản, bấm “Báo đã chuyển khoản” và đính kèm chứng từ.',
                  v_amount, to_char(p.due_date, 'DD/MM/YYYY'))
    end,
    'client', 'payment', private.primary_owner_id(a.id), false,
    'client', p.due_date, 'todo',
    format('“%s” (%s) đến hạn ngày %s. Nếu chưa thanh toán trước ngày này, khoản thanh toán sẽ chuyển sang quá hạn.',
           p.name, v_amount, to_char(p.due_date, 'DD/MM')),
    true,
    p.id, coalesce(p_actor, a.am_id))
  returning id into v_id;

  update public.payment_schedules set task_id = v_id where id = p.id;
  return v_id;
end;
$$;

create or replace function public.trg_payment_schedules_task()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.ensure_payment_task(new.id, auth.uid());
  return null;
end;
$$;

-- UPDATE only: a seed import inserts installments together with their existing tasks
create trigger payment_schedules_auto_task after update of status on public.payment_schedules
  for each row when (new.status in ('invoiced', 'overdue') and old.status is distinct from new.status)
  execute function public.trg_payment_schedules_task();

-- ── activities: append-only, task_id filled from the target / params ─────────────────────────────────
create or replace function public.trg_activities_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is null then
    if new.target_type = 'task' then
      new.task_id := public.try_uuid(new.target_id);
    elsif new.params ? 'task_id' then
      new.task_id := public.try_uuid(new.params ->> 'task_id');
    end if;
    if new.task_id is not null and not exists (select 1 from public.tasks t where t.id = new.task_id) then
      new.task_id := null;
    end if;
  end if;
  if current_user in ('authenticated', 'anon') then
    new.actor_id      := auth.uid();
    new.created_at    := now();
    new.dispatched_at := null;
  end if;
  return new;
end;
$$;

create trigger activities_fill before insert on public.activities
  for each row execute function public.trg_activities_fill();

create or replace function public.trg_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger activities_append_only before update or delete on public.activities
  for each row execute function public.trg_append_only();

-- ── notifications: users only mark them read ─────────────────────────────────────────────────────────
create or replace function public.trg_notifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  return new;
end;
$$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.trg_notifications_guard();


-- =====================================================================================================
-- 8. Row Level Security
--    Uncorrelated helper calls are wrapped in (select …) so Postgres evaluates them once per statement.
--    `x = any ((select public.readable_account_ids())::uuid[])` — the cast makes it an ARRAY test evaluated
--    once (an init-plan); without it `any ((select …))` would be parsed as a sub-query and compare x to uuid[].
-- =====================================================================================================

alter table public.profiles          enable row level security;
alter table public.accounts          enable row level security;
alter table public.contacts          enable row level security;
alter table public.projects          enable row level security;
alter table public.milestones        enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.comments          enable row level security;
alter table public.files             enable row level security;
alter table public.price_items       enable row level security;
alter table public.account_prices    enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_lines       enable row level security;
alter table public.contracts         enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.activities        enable row level security;
alter table public.notifications     enable row level security;
alter table public.email_outbox      enable row level security;
alter table public.project_templates enable row level security;
alter table public.settings          enable row level security;
alter table private.action_undo      enable row level security;   -- owner-only (no policy, no grant)

-- ── profiles ─────────────────────────────────────────────────────────────────────────────────────────
-- internal: all staff + client users of readable accounts · client: own company + New Era staff
create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or ((select public.is_internal())
      and (org_type = 'internal' or account_id = any ((select public.readable_account_ids())::uuid[])))
  or ((select public.is_client())
      and deleted_at is null
      and (account_id = (select public.auth_account_id()) or (org_type = 'internal' and status <> 'disabled')))
);

-- (in practice profiles are created by the invite Edge Function with the service role; these policies
-- cover a director / AM / client_owner inviting through PostgREST)
create policy profiles_insert on public.profiles for insert to authenticated
with check (
  (select public.is_director())
  or (org_type = 'client' and public.is_manager_of(account_id))
  or (org_type = 'client'
      and (select public.auth_role()) = 'client_owner'
      and not (select public.is_read_only())
      and account_id = (select public.auth_account_id()))
);

-- self (notification_pref, onboarded_at, phone…), director, AM of a client user's account.
-- Protected columns are enforced by trg_profiles_guard.
create policy profiles_update on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  or (select public.is_director())
  or (org_type = 'client' and public.is_manager_of(account_id))
)
with check (
  id = (select auth.uid())
  or (select public.is_director())
  or (org_type = 'client' and public.is_manager_of(account_id))
);

-- ── accounts ─────────────────────────────────────────────────────────────────────────────────────────
create policy accounts_select on public.accounts for select to authenticated
using (
  (select public.is_director())
  or ((select public.auth_role()) = 'am' and am_id = (select auth.uid()))
  or (id = any ((select public.readable_account_ids())::uuid[])
      and (deleted_at is null or (select public.is_internal())))
);

create policy accounts_insert on public.accounts for insert to authenticated
with check (
  (select public.is_director())
  or ((select public.auth_role()) = 'am' and am_id = (select auth.uid()))
);

create policy accounts_update on public.accounts for update to authenticated
using (public.is_manager_of(id))
with check (public.is_manager_of(id));

-- ── contacts / projects ──────────────────────────────────────────────────────────────────────────────
create policy contacts_select on public.contacts for select to authenticated
using (
  account_id = any ((select public.readable_account_ids())::uuid[])
  and (deleted_at is null or (select public.is_internal()))
);
create policy contacts_insert on public.contacts for insert to authenticated
with check (public.is_manager_of(account_id));
create policy contacts_update on public.contacts for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));

create policy projects_select on public.projects for select to authenticated
using (
  account_id = any ((select public.readable_account_ids())::uuid[])
  and (deleted_at is null or (select public.is_internal()))
);
create policy projects_insert on public.projects for insert to authenticated
with check (public.is_manager_of(account_id));
create policy projects_update on public.projects for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));

-- ── milestones: clients only see client_visible milestones ───────────────────────────────────────────
create policy milestones_select on public.milestones for select to authenticated
using (
  project_id = any ((select public.readable_project_ids())::uuid[])
  and ((select public.is_internal()) or (deleted_at is null and client_visible))
);
create policy milestones_insert on public.milestones for insert to authenticated
with check (public.is_manager_of(public.project_account_id(project_id)));
create policy milestones_update on public.milestones for update to authenticated
using (public.is_manager_of(public.project_account_id(project_id)))
with check (public.is_manager_of(public.project_account_id(project_id)));

-- ── tasks: clients never see internal tasks with client_visible = false ──────────────────────────────
create policy tasks_select on public.tasks for select to authenticated
using (
  project_id = any ((select public.readable_project_ids())::uuid[])
  and ((select public.is_internal())
       or (deleted_at is null and (side = 'client' or client_visible)))
);
create policy tasks_insert on public.tasks for insert to authenticated
with check (public.is_manager_of(public.project_account_id(project_id)));
-- managers; the assignee of an INTERNAL task (Kanban moves only, see trg_tasks_guard).
-- Client users have no write policy: their actions go through the RPCs of section 12.
create policy tasks_update on public.tasks for update to authenticated
using (
  public.is_manager_of(public.project_account_id(project_id))
  or (side = 'internal' and assignee_id = (select auth.uid())
      and (select public.is_internal()) and not (select public.is_read_only()))
)
with check (
  public.is_manager_of(public.project_account_id(project_id))
  or (side = 'internal' and assignee_id = (select auth.uid())
      and (select public.is_internal()) and not (select public.is_read_only()))
);

-- ── task_dependencies: visible when either end is visible (hidden blockers keep only their id) ──────
create policy task_dependencies_select on public.task_dependencies for select to authenticated
using (
  public.can_read_task(task_id)
  or (blocks_task_id is not null and public.can_read_task(blocks_task_id))
  or (blocks_milestone_id is not null
      and exists (select 1 from public.milestones m where m.id = task_dependencies.blocks_milestone_id))
);
create policy task_dependencies_insert on public.task_dependencies for insert to authenticated
with check (public.is_manager_of(public.task_account_id(task_id)));
create policy task_dependencies_delete on public.task_dependencies for delete to authenticated
using (public.is_manager_of(public.task_account_id(task_id)));

-- ── comments: clients never see visibility = 'internal' (Ghi chú nội bộ) ─────────────────────────────
create policy comments_select on public.comments for select to authenticated
using (
  public.can_read_task(task_id)
  and ((select public.is_internal()) or (visibility = 'shared' and deleted_at is null))
);
-- internal staff (TaskPermissions: comment_internal for everyone with access; comment_shared for the
-- manager or the assignee). Client comments go through add_comment() / ask_new_era().
create policy comments_insert on public.comments for insert to authenticated
with check (
  (select public.is_internal())
  and not (select public.is_read_only())
  and author_id = (select auth.uid())
  and public.can_read_task(task_id)
  and (visibility = 'internal'
       or public.is_manager_of(public.task_account_id(task_id))
       or exists (select 1 from public.tasks t
                   where t.id = comments.task_id and t.assignee_id = (select auth.uid())))
);
create policy comments_update on public.comments for update to authenticated
using (
  (select public.is_internal())
  and (author_id = (select auth.uid()) or public.is_manager_of(public.task_account_id(task_id)))
)
with check (
  (select public.is_internal())
  and (author_id = (select auth.uid()) or public.is_manager_of(public.task_account_id(task_id)))
);

-- ── files: clients see shared files only; client_member never sees proofs / contracts ──────────────
create policy files_select on public.files for select to authenticated
using (
  account_id = any ((select public.readable_account_ids())::uuid[])
  and ((select public.is_internal())
       or (deleted_at is null
           and visibility = 'shared'
           and (kind not in ('proof', 'contract') or (select public.auth_role()) = 'client_owner')
           and (task_id is null or public.can_read_task(task_id))))
);
create policy files_insert on public.files for insert to authenticated
with check (
  not (select public.is_read_only())
  and uploaded_by = (select auth.uid())
  and (
    ((select public.is_internal())
     and account_id = any ((select public.readable_account_ids())::uuid[])
     and storage_path like (public.account_bucket_id(account_id) || '/%'))
    or
    -- clients only share with New Era, only into their own upload folder, never contracts / proofs
    -- (those come with submit_task_files / report_payment)
    ((select public.is_client())
     and account_id = (select public.auth_account_id())
     and visibility = 'shared'
     and kind not in ('proof', 'contract')
     and (task_id is null or public.can_read_task(task_id))
     and storage_path like (public.account_bucket_id(account_id) || '/incoming/' || (select auth.uid())::text || '/%'))
  )
);
create policy files_update on public.files for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));

-- ── price_items: internal catalogue; client_owner only items on quotes they can read ─────────────────
create policy price_items_select on public.price_items for select to authenticated
using (
  (select public.is_internal())
  or ((select public.auth_role()) = 'client_owner'
      and deleted_at is null
      and exists (select 1 from public.quote_lines ql where ql.price_item_id = price_items.id))
);
create policy price_items_insert on public.price_items for insert to authenticated
with check ((select public.is_director()));
create policy price_items_update on public.price_items for update to authenticated
using ((select public.is_director()))
with check ((select public.is_director()));

-- ── account_prices: internal only (clients get applicable prices through quote_lines_client) ─────────
create policy account_prices_select on public.account_prices for select to authenticated
using ((select public.is_internal()) and account_id = any ((select public.readable_account_ids())::uuid[]));
create policy account_prices_insert on public.account_prices for insert to authenticated
with check (public.is_manager_of(account_id));
create policy account_prices_update on public.account_prices for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));
create policy account_prices_delete on public.account_prices for delete to authenticated
using (public.is_manager_of(account_id));

-- ── quotes / quote_lines: clients only once sent; client_member never ────────────────────────────────
create policy quotes_select on public.quotes for select to authenticated
using (
  account_id = any ((select public.readable_account_ids())::uuid[])
  and (select public.can_access_commercial())
  and ((select public.is_internal())
       or (deleted_at is null and status in ('sent', 'accepted', 'changes_requested', 'expired')))
);
create policy quotes_insert on public.quotes for insert to authenticated
with check (public.is_manager_of(account_id));
create policy quotes_update on public.quotes for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));

create policy quote_lines_select on public.quote_lines for select to authenticated
using (public.can_read_quote(quote_id));
create policy quote_lines_insert on public.quote_lines for insert to authenticated
with check (public.is_manager_of(public.quote_account_id(quote_id)));
create policy quote_lines_update on public.quote_lines for update to authenticated
using (public.is_manager_of(public.quote_account_id(quote_id)))
with check (public.is_manager_of(public.quote_account_id(quote_id)));
create policy quote_lines_delete on public.quote_lines for delete to authenticated
using (public.is_manager_of(public.quote_account_id(quote_id)));

-- ── contracts / payment_schedules ────────────────────────────────────────────────────────────────────
create policy contracts_select on public.contracts for select to authenticated
using (
  account_id = any ((select public.readable_account_ids())::uuid[])
  and (select public.can_access_commercial())
  and ((select public.is_internal()) or (deleted_at is null and status <> 'draft'))
);
create policy contracts_insert on public.contracts for insert to authenticated
with check (public.is_manager_of(account_id));
create policy contracts_update on public.contracts for update to authenticated
using (public.is_manager_of(account_id))
with check (public.is_manager_of(account_id));

create policy payment_schedules_select on public.payment_schedules for select to authenticated
using (
  exists (select 1 from public.contracts c where c.id = payment_schedules.contract_id)   -- contracts RLS applies
  and ((select public.is_internal()) or deleted_at is null)
);
create policy payment_schedules_insert on public.payment_schedules for insert to authenticated
with check (public.is_manager_of(public.contract_account_id(contract_id)));
create policy payment_schedules_update on public.payment_schedules for update to authenticated
using (public.is_manager_of(public.contract_account_id(contract_id)))
with check (public.is_manager_of(public.contract_account_id(contract_id)));

-- ── activities: clients see shared entries of their account, never about hidden tasks / milestones;
--    client_member never sees quote.* / contract.* / payment.* ─────────────────────────────────────────
create policy activities_select on public.activities for select to authenticated
using (
  (account_id is null and (select public.is_director()))
  or (account_id = any ((select public.readable_account_ids())::uuid[])
      and ((select public.is_internal())
           or (visibility = 'shared'
               and ((select public.auth_role()) = 'client_owner'
                    or split_part(action::text, '.', 1) not in ('quote', 'contract', 'payment'))
               and (task_id is null or public.task_client_visible(task_id))
               and (target_type <> 'milestone' or public.milestone_client_visible(target_id)))))
);
-- internal staff may log their own direct edits; clients log only through RPCs; no update / delete
create policy activities_insert on public.activities for insert to authenticated
with check (
  (select public.is_internal())
  and not (select public.is_read_only())
  and actor_id = (select auth.uid())
  and ((account_id is null and (select public.is_director()))
       or account_id = any ((select public.readable_account_ids())::uuid[]))
);

-- ── notifications / email_outbox ─────────────────────────────────────────────────────────────────────
create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- internal: mails to people they can see (listOutbox); client: own mails only
create policy email_outbox_select on public.email_outbox for select to authenticated
using (
  to_user_id = (select auth.uid())
  or ((select public.is_internal())
      and exists (select 1 from public.profiles p where p.id = email_outbox.to_user_id))   -- profiles RLS applies
);

-- ── project_templates / settings: internal read, director write ──────────────────────────────────────
create policy project_templates_select on public.project_templates for select to authenticated
using ((select public.is_internal()));
create policy project_templates_insert on public.project_templates for insert to authenticated
with check ((select public.is_director()));
create policy project_templates_update on public.project_templates for update to authenticated
using ((select public.is_director()))
with check ((select public.is_director()));

create policy settings_select on public.settings for select to authenticated
using ((select public.is_internal()));
create policy settings_update on public.settings for update to authenticated
using ((select public.is_director()))
with check ((select public.is_director()));


-- =====================================================================================================
-- 9. Internal views for the internal-only columns
--    Owner-rights views (security_invoker = false, security_barrier = true): they bypass the base-table
--    RLS and column privileges, so each WHERE clause re-applies the access rule with the SAME helper
--    functions as the policies, plus is_internal(). A client (or a read-only "view as" session) gets 0 rows.
-- =====================================================================================================

create view public.accounts_internal with (security_barrier = true) as
select a.*
  from public.accounts a
 where (select public.is_internal())
   and ((select public.is_director()) or a.id = any ((select public.readable_account_ids())::uuid[]));
comment on view public.accounts_internal is 'All account columns incl. internal_notes, health_override_reason, health_override_by — internal viewers only.';

create view public.contacts_internal with (security_barrier = true) as
select c.*
  from public.contacts c
 where (select public.is_internal())
   and c.account_id = any ((select public.readable_account_ids())::uuid[]);
comment on view public.contacts_internal is 'All contact columns incl. last_interaction_note — internal viewers only.';

create view public.milestones_internal with (security_barrier = true) as
select m.*
  from public.milestones m
 where (select public.is_internal())
   and m.project_id = any ((select public.readable_project_ids())::uuid[]);
comment on view public.milestones_internal is 'All milestone columns incl. forecast_override_reason — internal viewers only.';

create view public.tasks_internal with (security_barrier = true) as
select t.*
  from public.tasks t
 where (select public.is_internal())
   and t.project_id = any ((select public.readable_project_ids())::uuid[]);
comment on view public.tasks_internal is 'All task columns incl. manual_unblock_reason / _by / _at — internal viewers only.';

create view public.quotes_internal with (security_barrier = true) as
select q.*
  from public.quotes q
 where (select public.is_internal())
   and q.account_id = any ((select public.readable_account_ids())::uuid[]);
comment on view public.quotes_internal is 'All quote columns incl. internal_note, approval_note — internal viewers only.';


-- =====================================================================================================
-- 10. Cost protection (giá vốn, biên lợi nhuận) at the data layer
--    • `authenticated` has NO select privilege on price_items.cost_price (section 14): selecting it
--      directly fails with "permission denied", whoever asks, whatever RLS says.
--    • quote_lines has no cost column; cost and margin only exist in the owner-only private views of
--      section 6 (private.quote_line_math / private.quote_totals) which no API role can read.
--    • Safe views expose what each audience may see:
--        price_items_public       catalogue without cost (invoker rights → price_items RLS applies)
--        price_items_internal     + cost_price, margin_pct         WHERE can_view_cost()
--        quote_lines_client       computed lines without cost      WHERE can_read_quote()
--        quote_lines_internal     + cost_total (only when can_view_cost(), else null), internal only
--        v_quote_totals           totals + effective discount      WHERE can_read_quote()
--        v_quote_totals_internal  + cost_total, margin, margin_pct WHERE can_view_cost() AND can_read_quote()
--    So a client, a member or an AM without the director's permission never receives a cost value from
--    the database, not even by crafting their own PostgREST query (SPEC §2, §11).
-- =====================================================================================================

create view public.price_items_public with (security_invoker = true) as
select pi.id, pi.code, pi.name, pi.unit, pi.list_price, pi.category, pi.active, pi.description,
       pi.created_at, pi.updated_at, pi.deleted_at
  from public.price_items pi;

create view public.price_items_internal with (security_barrier = true) as
select pi.*,
       case when pi.list_price > 0
            then round((pi.list_price - pi.cost_price)::numeric / pi.list_price * 100, 2) end as margin_pct
  from public.price_items pi
 where (select public.can_view_cost());

create view public.quote_lines_client with (security_barrier = true) as
select l.id, l.quote_id, l.price_item_id, l.code, l.name, l.unit, l.description, l.qty, l.list_price,
       l.applicable_price, l.unit_price, l.discount_pct, l.vat_rate, l.subtotal, l.discount_amount,
       l.header_share, l.net, l.vat_amount, l.total, l.sort_order
  from private.quote_line_math l
 where public.can_read_quote(l.quote_id);

create view public.quote_lines_internal with (security_barrier = true) as
select l.id, l.quote_id, l.price_item_id, l.code, l.name, l.unit, l.description, l.qty, l.list_price,
       l.applicable_price, l.unit_price, l.discount_pct, l.vat_rate, l.subtotal, l.discount_amount,
       l.header_share, l.net, l.vat_amount, l.total, l.sort_order, l.gross_applicable,
       case when (select public.can_view_cost()) then l.cost_total end as cost_total
  from private.quote_line_math l
 where (select public.is_internal())
   and public.can_read_quote(l.quote_id);

create view public.v_quote_totals with (security_barrier = true) as
select t.quote_id, t.account_id, t.gross_applicable, t.subtotal, t.line_discount, t.header_discount,
       t.net_before_vat, t.vat, t.grand_total, t.effective_discount_pct,
       s.discount_approval_threshold_pct                         as threshold_pct,
       t.effective_discount_pct > s.discount_approval_threshold_pct as needs_approval
  from private.quote_totals t
 cross join public.settings s
 where s.id
   and public.can_read_quote(t.quote_id);

create view public.v_quote_totals_internal with (security_barrier = true) as
select t.quote_id, t.account_id, t.gross_applicable, t.subtotal, t.line_discount, t.header_discount,
       t.net_before_vat, t.vat, t.grand_total, t.effective_discount_pct,
       t.cost_total, t.margin, t.margin_pct
  from private.quote_totals t
 where (select public.can_view_cost())
   and public.can_read_quote(t.quote_id);


-- =====================================================================================================
-- 11. Domain engine in SQL — reference implementation of ARCHITECTURE §7 (src/domain/graph.ts, health.ts)
--     Recursive CTEs over task_dependencies. Computed over ALL tasks of the account (owner rights), then
--     filtered for the viewer: a hidden internal task still delays a milestone, a client just does not
--     see its title (MilestoneView.cause.task_title = null on the API side).
-- =====================================================================================================

-- milestonesHeldBy(): every OPEN task → the not-done milestones it holds back, directly or through
-- downstream open tasks (edges into manually-unblocked tasks are skipped).
create or replace function private.held_milestones(p_account_id uuid)
returns table (task_id uuid, milestone_id uuid)
language sql stable
set search_path = ''
as $$
  with recursive
  acc_tasks as (
    select t.id, t.status, t.manual_unblock_reason
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where p.account_id = p_account_id and t.deleted_at is null and p.deleted_at is null
  ),
  edges as (
    select distinct d.task_id as blocker_id, d.blocks_task_id as blocked_id
      from public.task_dependencies d
      join acc_tasks a on a.id = d.task_id
      join acc_tasks b on b.id = d.blocks_task_id
     where d.blocks_task_id <> d.task_id
  ),
  downstream (origin_id, node_id) as (
    select a.id, a.id from acc_tasks a where a.status <> 'done'
    union
    select ds.origin_id, e.blocked_id
      from downstream ds
      join edges e on e.blocker_id = ds.node_id
      join acc_tasks n on n.id = e.blocked_id
     where n.status <> 'done' and coalesce(btrim(n.manual_unblock_reason), '') = ''
  )
  select distinct ds.origin_id, m.id
    from downstream ds
    join public.task_dependencies d on d.task_id = ds.node_id and d.blocks_milestone_id is not null
    join public.milestones m on m.id = d.blocks_milestone_id
    join public.projects p on p.id = m.project_id
   where m.deleted_at is null and m.status <> 'done' and p.deleted_at is null and p.account_id = p_account_id
$$;

-- N(M): max delay over the upstream set of each milestone + its cause (max delay, earliest due, id).
-- Upstream = tasks with a dependency blocks_milestone_id = M; the walk continues to the blockers of
-- NOT-done, not manually-unblocked tasks; a done task (possibly done late) counts but stops the walk.
create or replace function private.milestone_upstream(p_account_id uuid, p_today date)
returns table (milestone_id uuid, max_delay integer, cause_task_id uuid)
language sql stable
set search_path = ''
as $$
  with recursive
  acc_tasks as (
    select t.id, t.status, t.due_date, t.completed_at, t.manual_unblock_reason,
           public.task_delay_days(t.due_date, t.status, t.completed_at, p_today) as delay
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where p.account_id = p_account_id and t.deleted_at is null and p.deleted_at is null
  ),
  acc_ms as (
    select m.id
      from public.milestones m
      join public.projects p on p.id = m.project_id
     where p.account_id = p_account_id and m.deleted_at is null and p.deleted_at is null
  ),
  edges as (
    select distinct d.task_id as blocker_id, d.blocks_task_id as blocked_id
      from public.task_dependencies d
      join acc_tasks a on a.id = d.task_id
      join acc_tasks b on b.id = d.blocks_task_id
     where d.blocks_task_id <> d.task_id
  ),
  upstream (ms_id, node_id) as (
    select d.blocks_milestone_id, d.task_id
      from public.task_dependencies d
      join acc_ms m on m.id = d.blocks_milestone_id
      join acc_tasks a on a.id = d.task_id
    union
    select u.ms_id, e.blocker_id
      from upstream u
      join acc_tasks cur on cur.id = u.node_id
      join edges e on e.blocked_id = u.node_id
     where cur.status <> 'done' and coalesce(btrim(cur.manual_unblock_reason), '') = ''
  )
  select distinct on (u.ms_id) u.ms_id, a.delay, a.id
    from upstream u
    join acc_tasks a on a.id = u.node_id
   where a.delay > 0
   order by u.ms_id, a.delay desc, a.due_date, a.id
$$;

-- Milestone forecasts of one account (graph.ts forecast()), per project in order_no:
--   done → completion day, source 'done', pushes nothing;
--   forecast_override_date → that date, source 'manual', pushes later milestones by max(0, override − planned);
--   else shift = max(N(M), carry of earlier not-done milestones): 'cascade' when the carry is strictly
--   larger (cause = the cause of the milestone that set the carry), 'dependency' when N(M) > 0, 'on_plan'.
--   forecast = planned + shift.
-- Client viewers: only client_visible milestones, override_reason null.
create or replace function public.milestone_forecasts(p_account_id uuid, p_today date default null)
returns table (
  milestone_id              uuid,
  project_id                uuid,
  order_no                  integer,
  name                      text,
  client_visible            boolean,
  planned_date              date,
  forecast_date             date,
  delay_days                integer,
  source                    public.forecast_source,
  cause_task_id             uuid,
  cause_delay_days          integer,
  cascade_from_milestone_id uuid,
  override_reason           text
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today  date := coalesce(p_today, public.today_vn());
  v_client boolean := false;
begin
  if private.is_end_user_call() then
    if not public.can_read_account(p_account_id) then
      return;
    end if;
    v_client := not public.is_internal();
  end if;

  return query
  with
  ms as (
    select m.id, m.project_id, m.order_no, m.name, m.client_visible, m.planned_date, m.status,
           m.completed_at, m.forecast_override_date, m.forecast_override_reason
      from public.milestones m
      join public.projects p on p.id = m.project_id
     where p.account_id = p_account_id and p.deleted_at is null and m.deleted_at is null
  ),
  own as (
    select u.milestone_id as ms_id, u.max_delay, u.cause_task_id as cause_id
      from private.milestone_upstream(p_account_id, v_today) u
  ),
  ordered as (
    select ms.*,
           coalesce(o.max_delay, 0) as n,
           o.cause_id               as own_cause,
           case
             when ms.status = 'done' then 0
             when ms.forecast_override_date is not null then greatest(0, ms.forecast_override_date - ms.planned_date)
             else coalesce(o.max_delay, 0)
           end                      as push,
           row_number() over (partition by ms.project_id order by ms.order_no, ms.planned_date, ms.id) as seq
      from ms
      left join own o on o.ms_id = ms.id
  ),
  carried as (
    select x.*,
           coalesce(max(x.push) over (partition by x.project_id order by x.seq
                                      rows between unbounded preceding and 1 preceding), 0) as carry
      from ordered x
  ),
  resolved as (
    select c.*, cf.from_id, cf.from_cause, cf.from_cause_delay
      from carried c
      left join lateral (
        -- the FIRST earlier milestone that reached the carry (graph.ts updates the carry on '>' only)
        select f.id as from_id,
               case when f.forecast_override_date is null then f.own_cause end as from_cause,
               case when f.forecast_override_date is null then f.n else 0 end  as from_cause_delay
          from carried f
         where f.project_id = c.project_id and f.seq < c.seq and c.carry > 0 and f.push = c.carry
         order by f.seq
         limit 1
      ) cf on true
  )
  select r.id,
         r.project_id,
         r.order_no,
         r.name,
         r.client_visible,
         r.planned_date,
         fc.forecast_date,
         (fc.forecast_date - r.planned_date)::integer,
         fc.source,
         case fc.source when 'dependency' then r.own_cause when 'cascade' then r.from_cause end,
         case fc.source when 'dependency' then r.n when 'cascade' then r.from_cause_delay else 0 end,
         case when fc.source = 'cascade' then r.from_id end,
         case when fc.source = 'manual' then r.forecast_override_reason end   -- clients see it too (SPEC 5.4)
    from resolved r
    cross join lateral (
      select
        case
          when r.status = 'done' then coalesce((r.completed_at at time zone 'Asia/Ho_Chi_Minh')::date, r.planned_date)
          when r.forecast_override_date is not null then r.forecast_override_date
          when r.carry > r.n then r.planned_date + r.carry
          else r.planned_date + r.n
        end as forecast_date,
        case
          when r.status = 'done' then 'done'::public.forecast_source
          when r.forecast_override_date is not null then 'manual'::public.forecast_source
          when r.carry > r.n then 'cascade'::public.forecast_source
          when r.n > 0 then 'dependency'::public.forecast_source
          else 'on_plan'::public.forecast_source
        end as source
    ) fc
   where not v_client or r.client_visible
   order by r.project_id, r.seq;
end;
$$;

-- Account health (health.ts computeHealth):
--   blocked   — a not-done task is overdue AND holds a not-done milestone (directly or indirectly);
--   attention — otherwise any other overdue task, a task holding a milestone with 0 ≤ days_left ≤ 3, or an
--               installment effectively overdue (invoiced/overdue and today > due_date);
--   on_track  — otherwise. The AM override wins (health_value) but the reasons are still listed.
-- reasons: jsonb array of contract.ts HealthReason, sorted overdue_blocking (overdue_days desc) →
-- due_soon_blocking (days_left asc) → overdue_task → overdue_payment. Client viewers: only reasons about
-- visible tasks (blocking ones only with a client_visible milestone), payments for client_owner only.
create or replace function public.account_health(p_account_id uuid, p_today date default null)
returns table (
  account_id      uuid,
  health_auto     public.health,
  health_value    public.health,
  overridden      boolean,
  override_reason text,
  reasons         jsonb
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today           date := coalesce(p_today, public.today_vn());
  v_client          boolean := false;
  v_owner           boolean := false;
  v_override        public.health;
  v_override_reason text;
  v_all             jsonb;
  v_visible         jsonb;
  v_auto            public.health;
begin
  if private.is_end_user_call() then
    if not public.can_read_account(p_account_id) then
      return;
    end if;
    v_client := not public.is_internal();
    v_owner  := coalesce(public.auth_role() = 'client_owner', false);
  end if;

  select a.health_override, a.health_override_reason
    into v_override, v_override_reason
    from public.accounts a
   where a.id = p_account_id;
  if not found then
    return;
  end if;

  with
  open_tasks as (
    select t.id, t.title, t.side, t.waiting_on, t.client_visible, t.due_date
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where p.account_id = p_account_id and p.deleted_at is null
       and t.deleted_at is null and t.status <> 'done'
  ),
  held as (
    -- milestonesHeldBy(task)[0]: earliest planned milestone held by the task
    select distinct on (h.task_id) h.task_id, m.id as ms_id, m.name as ms_name, m.client_visible as ms_visible
      from private.held_milestones(p_account_id) h
      join public.milestones m on m.id = h.milestone_id
     order by h.task_id, m.planned_date, m.order_no, m.id
  ),
  classified as (
    select t.*,
           h.ms_id, h.ms_name, h.ms_visible,
           greatest(0, v_today - t.due_date) as overdue_days,
           (t.due_date - v_today)            as days_left,
           case
             when v_today > t.due_date and h.ms_id is not null then 'overdue_blocking'
             when v_today > t.due_date then 'overdue_task'
             when (t.due_date - v_today) between 0 and 3 and h.ms_id is not null then 'due_soon_blocking'
           end as kind
      from open_tasks t
      left join held h on h.task_id = t.id
  ),
  all_reasons as (
    select c.kind,
           case c.kind when 'overdue_blocking' then 0 when 'due_soon_blocking' then 1 else 2 end as kind_rank,
           case when c.kind = 'due_soon_blocking' then c.days_left else -c.overdue_days end    as severity,
           c.title  as label,
           c.id     as ref_id,
           false    as is_payment,
           (c.side = 'client' or c.client_visible) and (c.ms_id is null or c.ms_visible)       as client_ok,
           case c.kind
             when 'overdue_blocking' then jsonb_build_object(
               'kind', c.kind, 'task_id', c.id, 'task_title', c.title, 'side', c.side, 'waiting_on', c.waiting_on,
               'overdue_days', c.overdue_days, 'milestone_id', c.ms_id, 'milestone_name', c.ms_name)
             when 'due_soon_blocking' then jsonb_build_object(
               'kind', c.kind, 'task_id', c.id, 'task_title', c.title, 'side', c.side, 'waiting_on', c.waiting_on,
               'days_left', c.days_left, 'milestone_id', c.ms_id, 'milestone_name', c.ms_name)
             else jsonb_build_object(
               'kind', c.kind, 'task_id', c.id, 'task_title', c.title, 'side', c.side, 'waiting_on', c.waiting_on,
               'overdue_days', c.overdue_days)
           end as reason
      from classified c
     where c.kind is not null
    union all
    select 'overdue_payment', 3, -(v_today - ps.due_date), ps.name, ps.id, true, true,
           jsonb_build_object('kind', 'overdue_payment', 'payment_id', ps.id, 'name', ps.name,
                              'overdue_days', v_today - ps.due_date, 'amount', ps.amount)
      from public.payment_schedules ps
      join public.contracts c on c.id = ps.contract_id
     where c.account_id = p_account_id and c.deleted_at is null and ps.deleted_at is null
       and ps.status in ('invoiced', 'overdue') and v_today > ps.due_date
  )
  select coalesce(jsonb_agg(ar.reason order by ar.kind_rank, ar.severity, ar.label, ar.ref_id), '[]'::jsonb),
         coalesce(jsonb_agg(ar.reason order by ar.kind_rank, ar.severity, ar.label, ar.ref_id)
                    filter (where not v_client or (case when ar.is_payment then v_owner else ar.client_ok end)),
                  '[]'::jsonb),
         case
           when coalesce(bool_or(ar.kind = 'overdue_blocking'), false) then 'blocked'::public.health
           when count(*) > 0 then 'attention'::public.health
           else 'on_track'::public.health
         end
    into v_all, v_visible, v_auto
    from all_reasons ar;

  return query
  select p_account_id,
         v_auto,
         coalesce(v_override, v_auto),
         v_override is not null,
         case when v_client then null else v_override_reason end,
         v_visible;
end;
$$;

-- Per-task flags used by lists (TaskView.blocked / due / is_blocking_milestone / priority_rank, SPEC §3):
-- rank 1 overdue & blocking a milestone · 2 due soon (0–3 days) & blocking · 3 other overdue · 4 rest.
-- Client viewers: only visible tasks; "blocking" counts client_visible milestones only.
create or replace function public.task_flags(p_account_id uuid, p_today date default null)
returns table (
  task_id               uuid,
  blocked               boolean,
  overdue               boolean,
  overdue_days          integer,
  due_soon              boolean,
  days_left             integer,
  is_blocking_milestone boolean,
  priority_rank         integer
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today  date := coalesce(p_today, public.today_vn());
  v_client boolean := false;
begin
  if private.is_end_user_call() then
    if not public.can_read_account(p_account_id) then
      return;
    end if;
    v_client := not public.is_internal();
  end if;

  return query
  with
  acc as (
    select t.id, t.status, t.due_date, t.manual_unblock_reason
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where p.account_id = p_account_id and p.deleted_at is null and t.deleted_at is null
       and (not v_client or t.side = 'client' or t.client_visible)
  ),
  blocked_ids as (
    select distinct d.blocks_task_id as id
      from public.task_dependencies d
      join public.tasks b on b.id = d.task_id and b.deleted_at is null and b.status <> 'done'
     where d.blocks_task_id in (select acc.id from acc)
  ),
  holding as (
    select distinct h.task_id as id
      from private.held_milestones(p_account_id) h
      join public.milestones m on m.id = h.milestone_id
     where not v_client or m.client_visible
  ),
  base as (
    select a.id,
           a.status <> 'done'                                                   as is_open,
           a.status <> 'done' and coalesce(btrim(a.manual_unblock_reason), '') = ''
             and bi.id is not null                                              as is_blocked,
           a.status <> 'done' and v_today > a.due_date                          as is_overdue,
           (a.due_date - v_today)                                               as dl,
           hg.id is not null                                                    as holds
      from acc a
      left join blocked_ids bi on bi.id = a.id
      left join holding hg on hg.id = a.id
  )
  select b.id,
         b.is_blocked,
         b.is_overdue,
         case when b.is_overdue then -b.dl else 0 end,
         b.is_open and not b.is_overdue and b.dl between 0 and 3,
         b.dl,
         b.holds,
         case
           when b.is_overdue and b.holds then 1
           when b.is_open and not b.is_overdue and b.dl between 0 and 3 and b.holds then 2
           when b.is_overdue then 3
           else 4
         end
    from base b;
end;
$$;

-- Convenience views over every readable account (invoker rights: the accounts RLS picks the accounts,
-- the functions filter for the viewer).
create view public.v_milestone_forecasts with (security_invoker = true) as
select a.id as account_id, f.*
  from public.accounts a
 cross join lateral public.milestone_forecasts(a.id) f
 where a.deleted_at is null;

create view public.v_account_health with (security_invoker = true) as
select h.*
  from public.accounts a
 cross join lateral public.account_health(a.id) h
 where a.deleted_at is null;


-- =====================================================================================================
-- 12. RPC functions (SECURITY DEFINER). Each re-checks the rules of src/services/api/*.ts and writes the
--     activity row in the same transaction. Notifications / e-mails are produced afterwards by the
--     dispatcher from those activity rows (README §6), which is also what makes the 10-second undo clean.
-- =====================================================================================================

-- ── shared private helpers ───────────────────────────────────────────────────────────────────────────

-- the signed-in, writable viewer (assertWritable)
create or replace function private.writable_viewer()
returns public.viewer_ctx
language plpgsql
set search_path = ''
as $$
declare
  v public.viewer_ctx := public.auth_viewer();
begin
  if v.user_id is null then
    perform private.api_error('unauthenticated', 'errors.unauthenticated');
  end if;
  if v.read_only then
    perform private.api_error('read_only', 'errors.read_only');
  end if;
  return v;
end;
$$;

create or replace function private.log_activity(
  p_account_id  uuid,
  p_actor_id    uuid,
  p_action      public.activity_action,
  p_target_type public.activity_target_type,
  p_target_id   text,
  p_params      jsonb,
  p_visibility  public.visibility,
  p_task_id     uuid default null
)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.activities (account_id, actor_id, action, target_type, target_id, task_id, params, visibility)
  values (p_account_id, p_actor_id, p_action, p_target_type, p_target_id, p_task_id,
          jsonb_strip_nulls(coalesce(p_params, '{}'::jsonb)), p_visibility)
  returning id
$$;

create or replace function private.task_params(t public.tasks, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql stable
set search_path = ''
as $$ select jsonb_build_object('task', t.title, 'task_id', t.id) || coalesce(p_extra, '{}'::jsonb) $$;

-- undo bookkeeping: {"t": table, "id": id, "before": current row}
create or replace function private.snapshot(p_table text, p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  execute format('select to_jsonb(x) from public.%I x where x.id = $1', p_table) into v_row using p_id;
  return jsonb_build_object('t', p_table, 'id', p_id, 'before', v_row);
end;
$$;

create or replace function private.inserted(p_table text, p_id uuid)
returns jsonb
language sql immutable
set search_path = ''
as $$ select jsonb_build_object('t', p_table, 'id', p_id, 'before', null) $$;

-- restore a before-image (or delete a row that the action inserted)
create or replace function private.restore_row(p_table text, p_id uuid, p_before jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cols text;
begin
  if p_before is null or jsonb_typeof(p_before) = 'null' then
    execute format('delete from public.%I where id = $1', p_table) using p_id;
    return;
  end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = format('public.%I', p_table)::regclass
     and a.attnum > 0 and not a.attisdropped and a.attname <> 'id';
  execute format(
    'update public.%1$I as t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where t.id = $2',
    p_table, v_cols)
  using p_before, p_id;
end;
$$;

create or replace function private.remember_undo(p_user uuid, p_task_id uuid, p_account_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_token   uuid;
  v_updated timestamptz;
begin
  delete from private.action_undo where expires_at < now() - interval '1 hour';   -- housekeeping
  select t.updated_at into v_updated from public.tasks t where t.id = p_task_id;
  insert into private.action_undo (user_id, task_id, account_id, task_updated_at, snapshot, expires_at)
  values (p_user, p_task_id, p_account_id, v_updated, p_snapshot, clock_timestamp() + interval '10 seconds')
  returning token into v_token;
  return v_token;
end;
$$;

-- Register an uploaded object as a files row. p_file = { storage_path, name, mime, size, doc_key? }
-- storage_path must be '<account bucket>/<object>' and exist in Storage; client uploads must come from
-- the uploader's own folder 'incoming/<auth uid>/…' (the storage policy only lets them write there).
create or replace function private.insert_task_file(
  p_account_id uuid,
  p_task       public.tasks,
  p_file       jsonb,
  p_uploader   uuid,
  p_kind       public.file_kind,
  p_note       text,
  p_client     boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_bucket text := public.account_bucket_id(p_account_id);
  v_path   text := btrim(coalesce(p_file ->> 'storage_path', ''));
  v_name   text := btrim(coalesce(p_file ->> 'name', ''));
  v_mime   text := lower(coalesce(nullif(btrim(p_file ->> 'mime'), ''), 'application/octet-stream'));
  v_size   bigint := case when (p_file ->> 'size') ~ '^\d{1,15}$' then (p_file ->> 'size')::bigint else 0 end;
  v_object text;
  v_kind   public.file_kind;
  v_id     uuid;
begin
  if coalesce(jsonb_typeof(p_file), '') <> 'object' or v_name = '' or v_path = '' then
    perform private.api_error('validation', 'errors.invalid_file');
  end if;
  if v_path not like (v_bucket || '/%') then
    perform private.api_error('validation', 'errors.invalid_file');
  end if;
  v_object := substr(v_path, length(v_bucket) + 2);
  if p_client and v_object not like ('incoming/' || p_uploader::text || '/%') then
    perform private.api_error('validation', 'errors.invalid_file');
  end if;
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from storage.objects o where o.bucket_id = v_bucket and o.name = v_object) then
      perform private.api_error('validation', 'errors.invalid_file');
    end if;
  end if;
  -- kindForUpload(): images → design, spreadsheets → data, else document
  v_kind := coalesce(p_kind,
    case
      when v_mime like 'image/%' then 'design'
      when v_mime like '%spreadsheet%' or v_mime like '%excel%' or v_mime like '%csv%' then 'data'
      else 'document'
    end::public.file_kind);

  insert into public.files (account_id, project_id, task_id, name, doc_key, mime, size, storage_path,
                            visibility, kind, uploaded_by, note)
  values (p_account_id, p_task.project_id, p_task.id, v_name,
          coalesce(nullif(btrim(p_file ->> 'doc_key'), ''), p_task.id::text || ':' || private.slugify(v_name)),
          v_mime, v_size, v_path, 'shared', v_kind, p_uploader, p_note)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── client task actions ──────────────────────────────────────────────────────────────────────────────
-- One engine for the six client actions (api/tasks.ts runClientAction + taskRules.ts):
--   approve / confirm (+attend) / answer          → done, waiting_on null, completed_at now
--   request_changes / submit_files / report_payment → waiting, waiting_on internal
-- Refusals in the mock's order: not waiting on the client → conflict · blocked → blocked ·
-- requires_owner and not owner → requires_owner · not the person expected to act → forbidden ·
-- action does not fit the task type → validation.
create or replace function private.run_client_action(p_task_id uuid, p_action text, p_text text, p_files jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v          public.viewer_ctx := private.writable_viewer();
  t          public.tasks;
  q          public.quotes;
  ps         public.payment_schedules;
  c          public.contracts;
  v_acc      uuid;
  v_text     text := nullif(btrim(coalesce(p_text, '')), '');
  v_undo     jsonb := '[]'::jsonb;
  v_file     jsonb;
  v_file_id  uuid;
  v_proof_id uuid;
  v_names    text[] := '{}'::text[];
  v_activity public.activity_action;
  v_message  text;
  v_params   jsonb;
  v_act_id   uuid;
begin
  if v.org_type <> 'client' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;

  select * into t from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(t.project_id);
  if v_acc is distinct from v.account_id or not (t.side = 'client' or t.client_visible) then
    perform private.api_error('not_found', 'errors.not_found');   -- never reveal other companies' tasks
  end if;

  if t.side <> 'client' or t.status = 'done' or t.waiting_on is distinct from 'client' then
    perform private.api_error('conflict', 'errors.task_not_waiting');
  end if;
  if private.task_blocked(t.id) then
    perform private.api_error('blocked', 'errors.blocked',
      jsonb_build_object('blockers', private.blocker_titles(t.id, true)));
  end if;
  if t.requires_owner and v.role <> 'client_owner' then
    perform private.api_error('requires_owner', 'errors.requires_owner');
  end if;
  -- clientShouldAct(): the owner acts on unassigned tasks or their own; a member only on their own
  if not ((v.role = 'client_owner' and (t.assignee_id is null or t.assignee_id = v.user_id))
          or (v.role = 'client_member' and t.assignee_id = v.user_id)) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if not (case p_action
            when 'approve'         then t.type = 'approval'
            when 'request_changes' then t.type = 'approval'
            when 'submit_files'    then t.type in ('upload', 'sign')
            when 'report_payment'  then t.type = 'payment'
            when 'confirm'         then t.type in ('confirm', 'attend')
            when 'answer'          then t.type = 'answer'
            else false
          end) then
    perform private.api_error('validation', 'errors.action_not_allowed');
  end if;

  v_undo := v_undo || jsonb_build_array(private.snapshot('tasks', t.id));

  case p_action
    when 'approve', 'confirm', 'answer' then
      update public.tasks
         set status = 'done', waiting_on = null, completed_at = now(),
             answer_text = coalesce(v_text, answer_text)
       where id = t.id;
      if p_action = 'approve' then
        v_activity := 'task.approved'::public.activity_action;
        v_message  := 'task.toast.approved';
        v_params   := private.task_params(t, jsonb_build_object('note', v_text));
      elsif p_action = 'confirm' then
        v_activity := case when t.type = 'attend' then 'task.attendance_confirmed' else 'task.confirmed' end::public.activity_action;
        v_message  := case when t.type = 'attend' then 'task.toast.attendance_confirmed' else 'task.toast.confirmed' end;
        v_params   := private.task_params(t, jsonb_build_object('note', v_text));
      else
        v_activity := 'task.answered'::public.activity_action;
        v_message  := 'task.toast.answered';
        v_params   := private.task_params(t, jsonb_build_object('answer', v_text));
      end if;

    when 'request_changes' then
      update public.tasks
         set status = 'waiting', waiting_on = 'internal', completed_at = null
       where id = t.id;
      v_activity := 'task.changes_requested'::public.activity_action;
      v_message  := 'task.toast.changes_requested';
      v_params   := private.task_params(t, jsonb_build_object('reason', v_text));

    when 'submit_files' then
      for v_file in select e.value from jsonb_array_elements(p_files) as e loop
        v_file_id := private.insert_task_file(v_acc, t, v_file, v.user_id,
                       case when t.type = 'sign' then 'contract'::public.file_kind end, v_text, true);
        v_undo  := v_undo || jsonb_build_array(private.inserted('files', v_file_id));
        v_names := v_names || (v_file ->> 'name');
      end loop;
      update public.tasks
         set status = 'waiting', waiting_on = 'internal', completed_at = null
       where id = t.id;
      v_activity := case when t.type = 'sign' then 'task.signed_submitted' else 'task.files_submitted' end::public.activity_action;
      v_message  := 'task.toast.submitted';
      v_params   := private.task_params(t, jsonb_build_object(
                      'count', cardinality(v_names), 'files', array_to_string(v_names, ', '), 'note', v_text));

    when 'report_payment' then
      v_proof_id := private.insert_task_file(v_acc, t, p_files -> 0, v.user_id, 'proof'::public.file_kind, v_text, true);
      v_undo := v_undo || jsonb_build_array(private.inserted('files', v_proof_id));
      update public.tasks
         set status = 'waiting', waiting_on = 'internal', completed_at = null
       where id = t.id;
      v_activity := 'task.payment_reported'::public.activity_action;
      v_message  := 'task.toast.payment_reported';
      v_params   := private.task_params(t, jsonb_build_object('note', v_text));

    else
      perform private.api_error('validation', 'errors.action_not_allowed');
  end case;

  -- commercial hooks (commercialEffects.ts onQuoteTaskApproved / onQuoteTaskChangesRequested)
  if t.quote_id is not null and p_action in ('approve', 'request_changes') then
    select * into q from public.quotes where id = t.quote_id and deleted_at is null for update;
    if found then
      if not private.quote_decidable(q) then
        perform private.api_error('conflict', 'errors.conflict');
      end if;
      v_undo := v_undo || jsonb_build_array(private.snapshot('quotes', q.id));
      update public.quotes
         set status            = case when p_action = 'approve' then 'accepted' else 'changes_requested' end::public.quote_status,
             client_decision   = case when p_action = 'approve' then 'accepted' else 'changes_requested' end::public.client_decision,
             client_decided_by = v.user_id,
             client_decided_at = now(),
             client_note       = v_text
       where id = q.id;
      v_act_id := private.log_activity(v_acc, v.user_id,
        case when p_action = 'approve' then 'quote.accepted' else 'quote.changes_requested' end::public.activity_action,
        'quote', q.id::text,
        private.quote_params(q) || jsonb_build_object(case when p_action = 'approve' then 'note' else 'reason' end, v_text),
        'shared', null);
      v_undo := v_undo || jsonb_build_array(private.inserted('activities', v_act_id));
    end if;
  end if;

  -- onPaymentReported(): the installment records the report and its proof
  if p_action = 'report_payment' and t.payment_schedule_id is not null then
    select * into ps from public.payment_schedules where id = t.payment_schedule_id and deleted_at is null for update;
    if found then
      v_undo := v_undo || jsonb_build_array(private.snapshot('payment_schedules', ps.id));
      update public.payment_schedules
         set client_reported_at = now(), proof_file_id = v_proof_id, task_id = coalesce(task_id, t.id)
       where id = ps.id;
      select * into c from public.contracts where id = ps.contract_id;
      v_act_id := private.log_activity(v_acc, v.user_id, 'payment.reported', 'payment', ps.id::text,
        jsonb_build_object('note', ps.name, 'amount', private.format_vnd(ps.amount), 'contract', c.code),
        'shared', t.id);
      v_undo := v_undo || jsonb_build_array(private.inserted('activities', v_act_id));
    end if;
  end if;

  v_act_id := private.log_activity(v_acc, v.user_id, v_activity, 'task', t.id::text, v_params, 'shared', t.id);
  v_undo := v_undo || jsonb_build_array(private.inserted('activities', v_act_id));

  -- shape of contract.ts ActionResult (the API layer re-reads the TaskView)
  return jsonb_build_object(
    'task_id',     t.id,
    'undo_token',  private.remember_undo(v.user_id, t.id, v_acc, v_undo),
    'message_key', v_message);
end;
$$;

-- "Xem & duyệt" → Duyệt. Approving a quote approval task also accepts the quote.
create or replace function public.approve_task(p_task_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.run_client_action(p_task_id, 'approve', p_note, null);
end;
$$;

-- "Yêu cầu chỉnh sửa" — reason required (SPEC §3)
create or replace function public.request_task_changes(p_task_id uuid, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.writable_viewer();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  return private.run_client_action(p_task_id, 'request_changes', p_reason, null);
end;
$$;

-- "Tải lên" / "Tải bản đã ký": p_files = [{ storage_path, name, mime, size }] already uploaded to Storage
create or replace function public.submit_task_files(p_task_id uuid, p_files jsonb, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.writable_viewer();
  if coalesce(jsonb_typeof(p_files), '') <> 'array' or jsonb_array_length(p_files) = 0 then
    perform private.api_error('validation', 'errors.files_required');
  end if;
  return private.run_client_action(p_task_id, 'submit_files', p_note, p_files);
end;
$$;

-- "Báo đã chuyển khoản" with the transfer proof { storage_path, name, mime, size }
create or replace function public.report_payment(p_task_id uuid, p_proof jsonb, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.writable_viewer();
  if coalesce(jsonb_typeof(p_proof), '') <> 'object' then
    perform private.api_error('validation', 'errors.invalid_file');
  end if;
  return private.run_client_action(p_task_id, 'report_payment', p_note, jsonb_build_array(p_proof));
end;
$$;

-- "Xác nhận" / "Xác nhận tham dự"
create or replace function public.confirm_task(p_task_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.run_client_action(p_task_id, 'confirm', p_note, null);
end;
$$;

-- "Trả lời" — answer required
create or replace function public.answer_task(p_task_id uuid, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.writable_viewer();
  if nullif(btrim(coalesce(p_answer, '')), '') is null then
    perform private.api_error('validation', 'errors.answer_required');
  end if;
  return private.run_client_action(p_task_id, 'answer', p_answer, null);
end;
$$;

-- "Giao cho đồng nghiệp" (SPEC §5.3): client_owner only, never for requires_owner tasks, colleague of the
-- same company whose e-mail is in the company domain. Inviting a NEW colleague by e-mail is done by the
-- invite Edge Function (auth user + profile, same domain rule), which then calls this function.
create or replace function public.delegate_task(p_task_id uuid, p_to_user_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v        public.viewer_ctx := private.writable_viewer();
  t        public.tasks;
  target   public.profiles;
  v_acc    uuid;
  v_domain text;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_undo   jsonb;
  v_act_id uuid;
begin
  if v.org_type <> 'client' or v.role <> 'client_owner' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into t from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(t.project_id);
  if v_acc is distinct from v.account_id or not (t.side = 'client' or t.client_visible) then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if t.requires_owner then
    perform private.api_error('requires_owner', 'errors.requires_owner');
  end if;
  if t.side <> 'client' or t.status = 'done' or t.waiting_on is distinct from 'client' then
    perform private.api_error('conflict', 'errors.task_not_waiting');
  end if;
  if private.task_blocked(t.id) then
    perform private.api_error('blocked', 'errors.blocked',
      jsonb_build_object('blockers', private.blocker_titles(t.id, true)));
  end if;
  -- TaskPermissions.delegate: unassigned, mine, or one I delegated earlier (re-delegation)
  if not (t.assignee_id is null or t.assignee_id = v.user_id or t.delegated_by = v.user_id) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if p_to_user_id is null then
    perform private.api_error('validation', 'errors.delegate_target_required');
  end if;
  if p_to_user_id = v.user_id then
    perform private.api_error('validation', 'errors.delegate_self');
  end if;

  select * into target from public.profiles p where p.id = p_to_user_id and p.deleted_at is null;
  if not found or target.org_type <> 'client' or target.account_id is distinct from v_acc
     or target.status not in ('active', 'invited') then
    perform private.api_error('validation', 'errors.invalid_delegate');
  end if;
  -- domain check: only colleagues on the company e-mail domain
  select a.email_domain into v_domain from public.accounts a where a.id = v_acc;
  if v_domain is null or split_part(target.email, '@', 2) <> v_domain then
    perform private.api_error('domain_mismatch', 'errors.domain_mismatch', jsonb_build_object('domain', v_domain));
  end if;

  v_undo := jsonb_build_array(private.snapshot('tasks', t.id));
  update public.tasks
     set assignee_id = target.id, delegated_by = v.user_id, delegated_at = now(), delegation_note = v_note
   where id = t.id;
  v_act_id := private.log_activity(v_acc, v.user_id, 'task.delegated', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('to', target.full_name, 'note', v_note)), 'shared', t.id);
  v_undo := v_undo || jsonb_build_array(private.inserted('activities', v_act_id));

  return jsonb_build_object(
    'task_id',     t.id,
    'undo_token',  private.remember_undo(v.user_id, t.id, v_acc, v_undo),
    'message_key', 'task.toast.delegated');
end;
$$;

-- "Hoàn tác" (toast, 5 s in the UI; the token lives 10 s). Restores every row the action touched and
-- removes the rows it inserted (files, activities) — the dispatcher had not processed them yet.
create or replace function public.undo_task_action(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v      public.viewer_ctx := private.writable_viewer();
  u      private.action_undo;
  t      public.tasks;
  e      jsonb;
  i      integer;
begin
  select * into u from private.action_undo where token = p_token for update;
  if not found or u.expires_at < clock_timestamp() then
    perform private.api_error('conflict', 'errors.undo_expired');
  end if;
  if u.user_id <> v.user_id then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into t from public.tasks where id = u.task_id for update;
  if not found or t.updated_at is distinct from u.task_updated_at then
    -- someone (New Era) already acted on the task again: undoing would overwrite their change
    perform private.api_error('conflict', 'errors.undo_expired');
  end if;

  for i in reverse jsonb_array_length(u.snapshot) - 1 .. 0 loop
    e := u.snapshot -> i;
    perform private.restore_row(e ->> 't', (e ->> 'id')::uuid, e -> 'before');
  end loop;
  delete from private.action_undo where token = p_token;

  perform private.log_activity(u.account_id, v.user_id, 'task.action_undone', 'task', u.task_id::text,
    jsonb_build_object('task', t.title, 'task_id', u.task_id), 'internal', u.task_id);
  return jsonb_build_object('task_id', u.task_id);
end;
$$;

-- "Hỏi lại New Era" → shared comment + activity
create or replace function public.ask_new_era(p_task_id uuid, p_question text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v      public.viewer_ctx := private.writable_viewer();
  t      public.tasks;
  v_acc  uuid;
  v_text text := nullif(btrim(coalesce(p_question, '')), '');
  v_id   uuid;
begin
  if v.org_type <> 'client' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if v_text is null then
    perform private.api_error('validation', 'errors.question_required');
  end if;
  select * into t from public.tasks where id = p_task_id and deleted_at is null;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(t.project_id);
  if v_acc is distinct from v.account_id or not (t.side = 'client' or t.client_visible) then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  -- TaskPermissions.ask: open and involved (owner, or the assignee)
  if t.status = 'done' or not (v.role = 'client_owner' or t.assignee_id = v.user_id) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;

  insert into public.comments (task_id, author_id, body, visibility)
  values (t.id, v.user_id, v_text, 'shared')
  returning id into v_id;
  perform private.log_activity(v_acc, v.user_id, 'task.question_asked', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('question', v_text)), 'shared', t.id);
  return v_id;
end;
$$;

-- addComment(): both sides. Client: shared only, owner or assignee. Internal: internal note for anyone
-- with access; shared reply for the manager or the assignee.
create or replace function public.add_comment(
  p_task_id uuid, p_body text, p_visibility public.visibility, p_reply_to_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v       public.viewer_ctx := private.writable_viewer();
  t       public.tasks;
  parent  public.comments;
  v_acc   uuid;
  v_text  text := nullif(btrim(coalesce(p_body, '')), '');
  v_ok    boolean;
  v_id    uuid;
begin
  if v_text is null then
    perform private.api_error('validation', 'errors.comment_required');
  end if;
  if p_visibility is null then
    perform private.api_error('validation', 'errors.invalid_visibility');
  end if;
  select * into t from public.tasks where id = p_task_id and deleted_at is null;
  if not found or not public.can_read_task(t.id) then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(t.project_id);

  if v.org_type = 'client' then
    v_ok := p_visibility = 'shared' and (v.role = 'client_owner' or t.assignee_id = v.user_id);
  else
    v_ok := p_visibility = 'internal' or public.is_manager_of(v_acc) or t.assignee_id = v.user_id;
  end if;
  if not coalesce(v_ok, false) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;

  if p_reply_to_id is not null then
    select * into parent from public.comments where id = p_reply_to_id and deleted_at is null;
    if not found or parent.task_id <> t.id or (v.org_type = 'client' and parent.visibility <> 'shared') then
      perform private.api_error('validation', 'errors.invalid_reply');
    end if;
  end if;

  insert into public.comments (task_id, author_id, body, visibility, reply_to_id)
  values (t.id, v.user_id, v_text, p_visibility, p_reply_to_id)
  returning id into v_id;
  perform private.log_activity(v_acc, v.user_id, 'comment.added', 'comment', v_id::text,
    private.task_params(t), p_visibility, t.id);
  return v_id;
end;
$$;

-- ── client quote decisions (commercial page; the approval task follows) ──────────────────────────────
create or replace function private.client_quote_decision(p_quote_id uuid, p_decision public.client_decision, p_note text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v      public.viewer_ctx := private.writable_viewer();
  q      public.quotes;
  v_text text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v.org_type <> 'client' or v.role <> 'client_owner' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into q from public.quotes where id = p_quote_id and deleted_at is null for update;
  if not found or q.account_id is distinct from v.account_id
     or q.status not in ('sent', 'accepted', 'changes_requested', 'expired') then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if p_decision = 'changes_requested' and v_text is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  if not private.quote_decidable(q) then
    perform private.api_error('conflict', 'errors.conflict');
  end if;

  update public.quotes
     set status = p_decision::text::public.quote_status, client_decision = p_decision,
         client_decided_by = v.user_id, client_decided_at = now(), client_note = v_text
   where id = q.id;
  -- applyQuoteDecision(touchTask = true): close or hand back the open approval task
  update public.tasks
     set status       = case when p_decision = 'accepted' then 'done' else 'waiting' end::public.task_status,
         waiting_on   = case when p_decision = 'accepted' then null else 'internal' end::public.waiting_on,
         completed_at = case when p_decision = 'accepted' then now() end
   where quote_id = q.id and status <> 'done' and deleted_at is null;
  perform private.log_activity(q.account_id, v.user_id,
    case when p_decision = 'accepted' then 'quote.accepted' else 'quote.changes_requested' end::public.activity_action,
    'quote', q.id::text,
    private.quote_params(q) || jsonb_build_object(case when p_decision = 'accepted' then 'note' else 'reason' end, v_text),
    'shared', null);
  return q.id;
end;
$$;

create or replace function public.client_accept_quote(p_quote_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.client_quote_decision(p_quote_id, 'accepted', p_note);
end;
$$;

create or replace function public.client_request_quote_changes(p_quote_id uuid, p_note text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.client_quote_decision(p_quote_id, 'changes_requested', p_note);
end;
$$;

-- ── internal task operations that must keep the rules + the log together ─────────────────────────────

-- task of an account the caller manages (director / AM), locked
create or replace function private.manager_task(p_task_id uuid)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  v public.viewer_ctx := private.writable_viewer();
  t public.tasks;
begin
  if v.org_type <> 'internal' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into t from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if not public.is_manager_of(public.project_account_id(t.project_id)) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  return t;
end;
$$;

-- Kanban move (setTaskStatus): manager, or the assignee of an internal task. Blocked tasks cannot leave
-- 'todo' (SPEC §11); staff move client tasks only to todo / done.
create or replace function public.set_task_status(p_task_id uuid, p_status public.task_status)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v     public.viewer_ctx := private.writable_viewer();
  t     public.tasks;
  v_acc uuid;
begin
  if v.org_type <> 'internal' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into t from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found or not public.can_read_task(p_task_id) then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(t.project_id);
  if not (public.is_manager_of(v_acc) or (t.side = 'internal' and t.assignee_id = v.user_id)) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if p_status is null then
    perform private.api_error('validation', 'errors.invalid_transition');
  end if;
  if t.status = p_status then
    return t.id;
  end if;
  if t.side = 'client' and p_status not in ('todo', 'done') then
    perform private.api_error('validation', 'errors.invalid_transition');
  end if;
  if p_status <> 'todo' and private.task_blocked(t.id) then
    perform private.api_error('blocked', 'errors.blocked',
      jsonb_build_object('blockers', private.blocker_titles(t.id, false)));
  end if;

  update public.tasks
     set status       = p_status,
         waiting_on   = case
                          when p_status = 'done' then null
                          when t.side = 'internal' then 'internal'
                          when p_status = 'todo' then 'client'
                          when p_status = 'waiting' then 'internal'
                          else coalesce(t.waiting_on, 'client')
                        end::public.waiting_on,
         completed_at = case when p_status = 'done' then now() end
   where id = t.id;
  perform private.log_activity(v_acc, v.user_id, 'task.status_changed', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('from', t.status, 'to', p_status)), 'internal', t.id);
  return t.id;
end;
$$;

-- "Mở chặn thủ công" — reason required, logged (SPEC §3, §11)
create or replace function public.manual_unblock(p_task_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  t      public.tasks := private.manager_task(p_task_id);
  v_why  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_why is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  if not private.task_blocked(t.id) then
    perform private.api_error('validation', 'errors.not_blocked');
  end if;
  update public.tasks
     set manual_unblock_reason = v_why, manual_unblocked_by = auth.uid(), manual_unblocked_at = now()
   where id = t.id;
  perform private.log_activity(public.project_account_id(t.project_id), auth.uid(), 'task.unblocked', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('reason', v_why)), 'internal', t.id);
  return t.id;
end;
$$;

-- New Era accepts what the client sent → done (payment task → installment paid)
create or replace function public.accept_submission(p_task_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  t      public.tasks := private.manager_task(p_task_id);
  ps     public.payment_schedules;
  c      public.contracts;
  v_acc  uuid := public.project_account_id(t.project_id);
  v_text text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if t.side <> 'client' or t.status = 'done' or t.waiting_on is distinct from 'internal' then
    perform private.api_error('conflict', 'errors.nothing_to_review');
  end if;
  update public.tasks set status = 'done', waiting_on = null, completed_at = now() where id = t.id;
  if v_text is not null then
    insert into public.comments (task_id, author_id, body, visibility) values (t.id, auth.uid(), v_text, 'shared');
  end if;
  -- onPaymentTaskAccepted(): the installment is paid
  if t.payment_schedule_id is not null then
    select * into ps from public.payment_schedules
     where id = t.payment_schedule_id and deleted_at is null and status <> 'paid' for update;
    if found then
      update public.payment_schedules set status = 'paid', paid_at = now() where id = ps.id;
      select * into c from public.contracts where id = ps.contract_id;
      perform private.log_activity(v_acc, auth.uid(), 'payment.paid', 'payment', ps.id::text,
        jsonb_build_object('note', ps.name, 'amount', private.format_vnd(ps.amount), 'contract', c.code), 'shared', t.id);
    end if;
  end if;
  perform private.log_activity(v_acc, auth.uid(), 'task.submission_accepted', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('note', v_text)), 'shared', t.id);
  return t.id;
end;
$$;

-- New Era sends a new version / asks the client to redo → back to the client, revision + 1
create or replace function public.return_to_client(p_task_id uuid, p_message text, p_files jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  t      public.tasks := private.manager_task(p_task_id);
  v_acc  uuid := public.project_account_id(t.project_id);
  v_msg  text := nullif(btrim(coalesce(p_message, '')), '');
  v_file jsonb;
  v_n    integer := 0;
begin
  if t.side <> 'client' or t.status = 'done' or t.waiting_on is distinct from 'internal' then
    perform private.api_error('conflict', 'errors.nothing_to_review');
  end if;
  if v_msg is null then
    perform private.api_error('validation', 'errors.message_required');
  end if;
  update public.tasks
     set status = 'todo', waiting_on = 'client', completed_at = null, revision = revision + 1
   where id = t.id;
  if coalesce(jsonb_typeof(p_files), '') = 'array' then
    for v_file in select e.value from jsonb_array_elements(p_files) as e loop
      perform private.insert_task_file(v_acc, t, v_file, auth.uid(), null, null, false);
      v_n := v_n + 1;
    end loop;
  end if;
  insert into public.comments (task_id, author_id, body, visibility) values (t.id, auth.uid(), v_msg, 'shared');
  perform private.log_activity(v_acc, auth.uid(), 'task.returned_to_client', 'task', t.id::text,
    private.task_params(t, jsonb_build_object('message', v_msg, 'count', nullif(v_n, 0))), 'shared', t.id);
  return t.id;
end;
$$;

-- deleteTask(): soft delete + drop its dependencies + log
create or replace function public.delete_task(p_task_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.tasks := private.manager_task(p_task_id);
begin
  update public.tasks set deleted_at = now() where id = t.id;
  delete from public.task_dependencies where task_id = t.id or blocks_task_id = t.id;
  perform private.log_activity(public.project_account_id(t.project_id), auth.uid(), 'task.deleted', 'task', t.id::text,
    private.task_params(t), 'internal', t.id);
  return t.id;
end;
$$;

-- "Nhắc khách": counts + logs; the dispatcher e-mails the reminder immediately (no daily limit).
-- Recipients: the client assignee, else every client_owner of the account.
create or replace function public.remind_client(p_task_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v         public.viewer_ctx := private.writable_viewer();
  t         public.tasks;
  v_acc     uuid;
  v_to      text;
  v_done    integer := 0;
  v_skipped integer := 0;
begin
  if v.org_type <> 'internal' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  for t in
    select * from public.tasks where id = any (coalesce(p_task_ids, '{}'::uuid[])) for update
  loop
    v_acc := public.project_account_id(t.project_id);
    if t.deleted_at is not null or t.side <> 'client' or t.status = 'done' or t.waiting_on is distinct from 'client'
       or not public.is_manager_of(v_acc) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    select string_agg(p.full_name, ', ' order by p.full_name) into v_to
      from public.profiles p
     where p.account_id = v_acc and p.org_type = 'client' and p.status <> 'disabled' and p.deleted_at is null
       and (p.id = t.assignee_id
            or (not exists (select 1 from public.profiles x
                             where x.id = t.assignee_id and x.org_type = 'client' and x.status <> 'disabled')
                and p.role = 'client_owner'));
    if v_to is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    update public.tasks set reminder_count = reminder_count + 1, last_reminded_at = now() where id = t.id;
    perform private.log_activity(v_acc, v.user_id, 'task.reminded', 'task', t.id::text,
      private.task_params(t, jsonb_build_object('to', v_to)), 'internal', t.id);
    v_done := v_done + 1;
  end loop;
  -- ids that do not exist count as skipped too
  v_skipped := v_skipped + greatest(0, cardinality(coalesce(p_task_ids, '{}'::uuid[])) - v_done - v_skipped);
  return jsonb_build_object('reminded', v_done, 'skipped', v_skipped);
end;
$$;

-- dry-run cycle check for the task form (checkDependencies): replaces the task's task-to-task edges by
-- the given ones; returns { ok, path: [titles] } (null title = the new task itself / hidden)
create or replace function public.check_dependencies(
  p_task_id uuid, p_blocks_task_ids uuid[], p_blocked_by_task_ids uuid[]
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_self uuid := coalesce(p_task_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_acc  uuid;
  v_path uuid[];
begin
  if not public.is_internal() then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if p_task_id is not null then
    v_acc := public.task_account_id(p_task_id);
  else
    select public.task_account_id(x.id) into v_acc
      from unnest(coalesce(p_blocks_task_ids, '{}'::uuid[]) || coalesce(p_blocked_by_task_ids, '{}'::uuid[])) as x (id)
     where public.task_account_id(x.id) is not null
     limit 1;
  end if;
  if v_acc is null then
    return jsonb_build_object('ok', true);
  end if;
  if not public.can_read_account(v_acc) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;

  with recursive
  existing as (
    select d.task_id as a, d.blocks_task_id as b
      from public.task_dependencies d
      join public.tasks t on t.id = d.task_id
      join public.projects p on p.id = t.project_id
     where p.account_id = v_acc and d.blocks_task_id is not null
       and d.task_id <> v_self and d.blocks_task_id <> v_self
  ),
  proposed as (
    select v_self as a, x.id as b from unnest(coalesce(p_blocks_task_ids, '{}'::uuid[])) as x (id)
    union all
    select x.id, v_self from unnest(coalesce(p_blocked_by_task_ids, '{}'::uuid[])) as x (id)
  ),
  edges as (
    select ex.a, ex.b from existing ex
    union
    select pr.a, pr.b from proposed pr
  ),
  -- every new cycle goes through the edited task: walk from it until we come back (small graphs)
  walk (node, path, closed) as (
    select e.b, array[v_self, e.b], e.b = v_self
      from edges e
     where e.a = v_self
    union all
    select e.b, w.path || e.b, e.b = v_self
      from walk w
      join edges e on e.a = w.node
     where not w.closed and (e.b = v_self or not (e.b = any (w.path)))
  )
  select w.path into v_path
    from walk w
   where w.closed
   order by cardinality(w.path)
   limit 1;

  if v_path is null then
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'path',
    (select jsonb_agg(t.title order by x.ord)
       from unnest(v_path) with ordinality as x (id, ord)
       left join public.tasks t on t.id = x.id));
end;
$$;

-- ── milestones / health ──────────────────────────────────────────────────────────────────────────────

-- completeMilestone(): linked installments → invoice_due (trg_milestones_completed)
create or replace function public.complete_milestone(p_milestone_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v     public.viewer_ctx := private.writable_viewer();
  m     public.milestones;
  v_acc uuid;
begin
  select * into m from public.milestones where id = p_milestone_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(m.project_id);
  if v.org_type <> 'internal' or not public.is_manager_of(v_acc) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if m.status = 'done' then
    perform private.api_error('conflict', 'errors.already_done');
  end if;
  update public.milestones set status = 'done', completed_at = now() where id = m.id;
  perform private.log_activity(v_acc, v.user_id, 'milestone.completed', 'milestone', m.id::text,
    jsonb_build_object('milestone', m.name),
    case when m.client_visible then 'shared' else 'internal' end::public.visibility, null);
  return m.id;
end;
$$;

-- overrideForecast(): date null clears the override; reason required when setting
create or replace function public.override_milestone_forecast(p_milestone_id uuid, p_date date, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v     public.viewer_ctx := private.writable_viewer();
  m     public.milestones;
  v_acc uuid;
  v_why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into m from public.milestones where id = p_milestone_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  v_acc := public.project_account_id(m.project_id);
  if v.org_type <> 'internal' or not public.is_manager_of(v_acc) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if p_date is not null and v_why is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  update public.milestones
     set forecast_override_date = p_date,
         forecast_override_reason = case when p_date is null then null else v_why end
   where id = m.id;
  perform private.log_activity(v_acc, v.user_id, 'milestone.forecast_overridden', 'milestone', m.id::text,
    jsonb_build_object('milestone', m.name, 'date', to_char(p_date, 'DD/MM/YYYY'), 'reason', v_why), 'internal', null);
  return m.id;
end;
$$;

-- overrideHealth(): health null clears the override; reason required when setting
create or replace function public.override_account_health(p_account_id uuid, p_health public.health, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v     public.viewer_ctx := private.writable_viewer();
  v_why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v.org_type <> 'internal' or not public.is_manager_of(p_account_id) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if p_health is not null and v_why is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  update public.accounts
     set health_override        = p_health,
         health_override_reason = case when p_health is null then null else v_why end,
         health_override_by     = case when p_health is null then null else v.user_id end,
         health_override_at     = case when p_health is null then null else now() end
   where id = p_account_id and deleted_at is null;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  perform private.log_activity(p_account_id, v.user_id, 'account.health_overridden', 'account', p_account_id::text,
    jsonb_build_object('health', p_health, 'reason', v_why), 'internal', null);
  return p_account_id;
end;
$$;

-- ── quotes: approval workflow (SPEC §4.5) ────────────────────────────────────────────────────────────

create or replace function private.manager_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
set search_path = ''
as $$
declare
  v public.viewer_ctx := private.writable_viewer();
  q public.quotes;
begin
  if v.org_type <> 'internal' then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into q from public.quotes where id = p_quote_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if not public.is_manager_of(q.account_id) then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  return q;
end;
$$;

create or replace function private.quote_discount_label(p_quote_id uuid)
returns text
language sql stable
set search_path = ''
as $$ select private.format_pct(t.effective_discount_pct) from private.quote_totals t where t.quote_id = p_quote_id $$;

-- AM → "Chờ Giám đốc duyệt" (only when the quote really needs it)
create or replace function public.request_quote_approval(p_quote_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  q      public.quotes := private.manager_quote(p_quote_id);
  v_text text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if q.status <> 'draft' then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_draft'));
  end if;
  if q.director_approved_by is not null or not public.quote_needs_approval(q.id) then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'approval_not_needed'));
  end if;
  update public.quotes
     set status = 'pending_approval', approval_requested_at = now(), approval_requested_by = auth.uid()
   where id = q.id;
  perform private.log_activity(q.account_id, auth.uid(), 'quote.approval_requested', 'quote', q.id::text,
    private.quote_params(q) || jsonb_build_object('discount', private.quote_discount_label(q.id), 'note', v_text),
    'internal', null);
  return q.id;
end;
$$;

-- director: approve → back to draft with director_approved_by, so the AM can send it
create or replace function public.approve_quote(p_quote_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v      public.viewer_ctx := private.writable_viewer();
  q      public.quotes;
  v_text text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_director() then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  select * into q from public.quotes where id = p_quote_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if q.status <> 'pending_approval' then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_pending'));
  end if;
  update public.quotes
     set status = 'draft', director_approved_by = v.user_id, director_approved_at = now(), approval_note = v_text
   where id = q.id;
  perform private.log_activity(q.account_id, v.user_id, 'quote.approved', 'quote', q.id::text,
    private.quote_params(q) || jsonb_build_object('discount', private.quote_discount_label(q.id), 'note', v_text),
    'internal', null);
  return q.id;
end;
$$;

-- director: reject (reason required) → back to draft, request cleared
create or replace function public.reject_quote_approval(p_quote_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v     public.viewer_ctx := private.writable_viewer();
  q     public.quotes;
  v_why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_director() then
    perform private.api_error('forbidden', 'errors.forbidden');
  end if;
  if v_why is null then
    perform private.api_error('validation', 'errors.reason_required');
  end if;
  select * into q from public.quotes where id = p_quote_id and deleted_at is null for update;
  if not found then
    perform private.api_error('not_found', 'errors.not_found');
  end if;
  if q.status <> 'pending_approval' then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_pending'));
  end if;
  update public.quotes
     set status = 'draft', director_approved_by = null, director_approved_at = null, approval_note = null,
         approval_requested_at = null, approval_requested_by = null
   where id = q.id;
  perform private.log_activity(q.account_id, v.user_id, 'quote.approval_rejected', 'quote', q.id::text,
    private.quote_params(q) || jsonb_build_object('reason', v_why), 'internal', null);
  return q.id;
end;
$$;

-- the client approval task of a sent quote (createQuoteApprovalTask; texts = i18n activity.commercialGen.*)
create or replace function private.create_quote_approval_task(p_quote_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  q         public.quotes;
  v_project uuid;
  v_due     date;
  v_id      uuid;
begin
  select * into q from public.quotes where id = p_quote_id;
  if not found then
    return null;
  end if;
  v_project := private.host_project_id(q.account_id, q.project_id);
  if v_project is null then
    return null;
  end if;
  v_due := least(q.valid_until, public.today_vn() + 5);
  insert into public.tasks (project_id, title, description, side, type, assignee_id, requires_owner,
                            waiting_on, due_date, status, impact_text, client_visible, quote_id, created_by)
  values (
    v_project,
    format('Xem và chấp thuận báo giá “%s” (v%s)', q.title, q.version),
    format('Báo giá %s phiên bản v%s, hiệu lực đến %s. Mở báo giá để xem chi tiết, sau đó chấp thuận hoặc đề nghị điều chỉnh.',
           q.code, q.version, to_char(q.valid_until, 'DD/MM/YYYY')),
    'client', 'approval', private.primary_owner_id(q.account_id), true,
    'client', v_due, 'todo',
    format('Nếu chưa phản hồi trước %s, New Era chưa thể chốt phạm vi và lịch triển khai cho “%s”. Báo giá hết hiệu lực sau %s.',
           to_char(v_due, 'DD/MM'), q.title, to_char(q.valid_until, 'DD/MM')),
    true, q.id, p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- "Gửi khách": refused while over the threshold without director approval (needs_approval), only from
-- draft, needs lines and a valid date. Closes earlier versions' open approval tasks, creates the new one.
create or replace function public.send_quote(p_quote_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  q       public.quotes := private.manager_quote(p_quote_id);
  v_needs boolean := public.quote_needs_approval(q.id);
  v_earlier uuid[];
begin
  if q.status = 'pending_approval' or (q.status = 'draft' and v_needs and q.director_approved_by is null) then
    perform private.api_error('needs_approval', 'errors.needs_approval');
  end if;
  if q.status <> 'draft' then
    perform private.api_error('conflict', 'errors.conflict', jsonb_build_object('reason', 'not_draft'));
  end if;
  if not exists (select 1 from public.quote_lines l where l.quote_id = q.id) then
    perform private.api_error('validation', 'errors.validation', jsonb_build_object('field', 'lines'));
  end if;
  if q.valid_until < public.today_vn() then
    perform private.api_error('validation', 'errors.invalid_date');
  end if;

  update public.quotes set status = 'sent', sent_at = now(), sent_by = auth.uid() where id = q.id;

  -- closeEarlierQuoteTasks(): unanswered → withdrawn (soft delete); answered → done
  select coalesce(array_agg(x.id), '{}'::uuid[]) into v_earlier
    from public.quotes x
   where x.account_id = q.account_id and x.code = q.code and x.version < q.version;
  update public.tasks set deleted_at = now()
   where quote_id = any (v_earlier) and status <> 'done' and waiting_on = 'client' and deleted_at is null;
  update public.tasks set status = 'done', waiting_on = null, completed_at = now()
   where quote_id = any (v_earlier) and status <> 'done' and deleted_at is null;

  perform private.create_quote_approval_task(q.id, auth.uid());
  perform private.log_activity(q.account_id, auth.uid(), 'quote.sent', 'quote', q.id::text,
    private.quote_params(q), 'shared', null);
  return q.id;
end;
$$;


-- =====================================================================================================
-- 13. Daily jobs (service role / pg_cron only — no EXECUTE for end users, see section 14)
--     The reminder / escalation / digest part of the sweep needs the i18n templates and runs in an Edge
--     Function (README §6); these are the pure data parts.
-- =====================================================================================================

-- invoiced installments past due → 'overdue' (+ activity; the payment task is ensured by trigger)
create or replace function public.refresh_overdue_payments(p_today date default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, public.today_vn());
  r       record;
  n       integer := 0;
begin
  for r in
    select ps.id, ps.name, ps.amount, ps.due_date, c.account_id, c.code
      from public.payment_schedules ps
      join public.contracts c on c.id = ps.contract_id
     where ps.status = 'invoiced' and v_today > ps.due_date and ps.deleted_at is null and c.deleted_at is null
       for update of ps
  loop
    update public.payment_schedules set status = 'overdue' where id = r.id;
    perform private.log_activity(r.account_id, null, 'payment.overdue', 'payment', r.id::text,
      jsonb_build_object('note', r.name, 'amount', private.format_vnd(r.amount), 'contract', r.code,
                         'days', v_today - r.due_date), 'internal', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- sent quotes past valid_until → 'expired'; their unanswered approval tasks are withdrawn
create or replace function public.expire_quotes(p_today date default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, public.today_vn());
  q       public.quotes;
  n       integer := 0;
begin
  for q in
    select * from public.quotes x
     where x.status = 'sent' and x.valid_until < v_today and x.deleted_at is null
       for update
  loop
    update public.quotes set status = 'expired' where id = q.id;
    update public.tasks set deleted_at = now()
     where quote_id = q.id and status <> 'done' and waiting_on = 'client' and deleted_at is null;
    perform private.log_activity(q.account_id, null, 'quote.expired', 'quote', q.id::text,
      private.quote_params(q), 'internal', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- accounts.health_auto cache (dashboard sorting / filters without recomputing every account)
create or replace function public.refresh_health_cache(p_today date default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.accounts a
     set health_auto = h.health_auto, health_auto_at = now()
    from public.accounts x
   cross join lateral public.account_health(x.id, p_today) h
   where a.id = x.id and x.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.run_daily_maintenance(p_today date default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today   date := coalesce(p_today, public.today_vn());
  v_overdue integer;
  v_expired integer;
  v_health  integer;
begin
  v_overdue := public.refresh_overdue_payments(v_today);
  v_expired := public.expire_quotes(v_today);
  v_health  := public.refresh_health_cache(v_today);
  update public.settings set last_sweep_date = v_today where id;
  return jsonb_build_object('date', v_today, 'payments_overdue', v_overdue, 'quotes_expired', v_expired,
                            'accounts_refreshed', v_health);
end;
$$;

-- pg_cron (enable the extension in the dashboard first). pg_cron runs in UTC: 17:05 UTC = 00:05 Vietnam.
-- select cron.schedule('client-hub-daily', '5 17 * * *', $$ select public.run_daily_maintenance() $$);


-- (Storage — one private bucket per account + policies on storage.objects — lives in supabase/storage.sql,
--  run right after this file.)


-- =====================================================================================================
-- 14. Privileges
--     Supabase grants everything to anon / authenticated by default; start from nothing and grant what the
--     API needs. TRUNCATE / REFERENCES / TRIGGER are never granted (TRUNCATE ignores RLS).
-- =====================================================================================================

revoke all on all tables    in schema public  from anon, authenticated;
revoke all on all tables    in schema private from public, anon, authenticated;
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

-- invoker triggers raise ApiErrors through this one
grant execute on function private.api_error(text, text, jsonb) to authenticated;

grant select, insert, update on public.profiles to authenticated;

grant select (id, name, short_name, logo_url, brand_color, industry, tier, stage, am_id, health_auto, health_auto_at,
              health_override, health_override_at, exec_summary, exec_summary_updated_at, email_domain,
              created_at, updated_at, deleted_at)
  on public.accounts to authenticated;                       -- not: internal_notes, health_override_reason, health_override_by
grant insert, update on public.accounts to authenticated;

grant select (id, account_id, full_name, salutation, title, decision_role, email, phone, user_id,
              last_interaction_at, created_at, updated_at, deleted_at)
  on public.contacts to authenticated;                       -- not: last_interaction_note
grant insert, update on public.contacts to authenticated;

grant select, insert, update on public.projects to authenticated;

grant select (id, project_id, name, order_no, planned_date, forecast_override_date, forecast_override_reason,
              status, completed_at, client_visible, description, created_at, updated_at, deleted_at)
  on public.milestones to authenticated;                     -- forecast_override_reason is client-visible (SPEC 5.4)
grant insert, update on public.milestones to authenticated;

grant select (id, project_id, milestone_id, title, description, side, type, assignee_id, delegated_by, delegated_at,
              delegation_note, requires_owner, waiting_on, due_date, status, impact_text, client_visible,
              reminder_count, last_reminded_at, completed_at, quote_id, payment_schedule_id, revision, answer_text,
              created_by, created_at, updated_at, deleted_at)
  on public.tasks to authenticated;                          -- not: manual_unblock_reason / _by / _at
grant insert, update on public.tasks to authenticated;

grant select, insert, delete on public.task_dependencies to authenticated;
grant select, insert, update on public.comments to authenticated;
grant select, insert, update on public.files to authenticated;

grant select (id, code, name, unit, list_price, category, active, description, created_at, updated_at, deleted_at)
  on public.price_items to authenticated;                    -- not: cost_price
grant insert, update on public.price_items to authenticated;

grant select, insert, update, delete on public.account_prices to authenticated;

grant select (id, account_id, project_id, code, title, version, parent_id, status, valid_until, discount_pct_total,
              approval_requested_at, approval_requested_by, director_approved_by, director_approved_at, sent_at,
              sent_by, client_decision, client_decided_by, client_decided_at, client_note, notes, created_by,
              created_at, updated_at, deleted_at)
  on public.quotes to authenticated;                         -- not: internal_note, approval_note
grant insert, update on public.quotes to authenticated;

grant select, insert, update, delete on public.quote_lines to authenticated;
grant select, insert, update on public.contracts to authenticated;
grant select, insert, update on public.payment_schedules to authenticated;
grant select, insert on public.activities to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.email_outbox to authenticated;
grant select, insert, update on public.project_templates to authenticated;
grant select, update on public.settings to authenticated;

grant select on public.accounts_internal, public.contacts_internal, public.milestones_internal,
                public.tasks_internal, public.quotes_internal,
                public.price_items_public, public.price_items_internal,
                public.quote_lines_client, public.quote_lines_internal,
                public.v_quote_totals, public.v_quote_totals_internal,
                public.v_milestone_forecasts, public.v_account_health
  to authenticated;

-- functions: helpers + RPCs for signed-in users; jobs for the service role only
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.refresh_overdue_payments(date), public.expire_quotes(date),
                           public.refresh_health_cache(date), public.run_daily_maintenance(date)
  from authenticated;

-- the service role (Edge Functions: invites, view-as, notification dispatcher, daily sweep)
grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
