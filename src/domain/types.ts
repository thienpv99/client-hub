// Core entities (mirror of the Postgres schema in supabase/schema.sql).
// Pure types only — no runtime code. Every module imports these with `import type`.

export type ID = string;
/** Calendar date 'YYYY-MM-DD' in Asia/Ho_Chi_Minh. A task is overdue once today > due_date (i.e. after 23:59 of the due day). */
export type ISODate = string;
/** Instant, ISO-8601 with +07:00 offset, e.g. '2026-10-06T08:30:00+07:00'. */
export type ISODateTime = string;

export interface SoftDelete {
  deleted_at: ISODateTime | null;
}

// ───────────────────────────── People ─────────────────────────────

export type OrgType = 'internal' | 'client';
export type Role = 'director' | 'am' | 'member' | 'client_owner' | 'client_member';
export type Salutation = 'anh' | 'chị';
/** 'digest_and_urgent' = "chỉ nhận bản tin tuần và việc gấp" */
export type NotificationPref = 'all' | 'digest_and_urgent';
export type UserStatus = 'active' | 'invited' | 'disabled';
/** how the login was created: 'google' = by the person's first Google sign-in (SSO, New Era staff only) */
export type AuthProvider = 'password' | 'google' | 'otp';

export interface User extends SoftDelete {
  id: ID;
  full_name: string;
  email: string;
  phone: string | null;
  org_type: OrgType;
  /** client users only; null for New Era staff */
  account_id: ID | null;
  role: Role;
  /** director: always true. AM: only when granted by director. member/client: always false. */
  can_view_cost: boolean;
  title: string | null;
  salutation: Salutation | null;
  avatar_url: string | null;
  notification_pref: NotificationPref;
  /** client finished or skipped the 3-screen intro */
  onboarded_at: ISODateTime | null;
  invited_at: ISODateTime | null;
  invited_by: ID | null;
  last_login_at: ISODateTime | null;
  status: UserStatus;
  /** demo password for internal users (mock only — never shown) */
  password?: string;
  /** absent on seeded / invited users; 'google' on staff created by their first Google sign-in */
  auth_provider?: AuthProvider;
}

export type Tier = 'strategic' | 'key' | 'standard';
export type Stage = 'prospecting' | 'negotiating' | 'implementing' | 'operating' | 'paused';
export type Health = 'blocked' | 'attention' | 'on_track';

export interface Account extends SoftDelete {
  id: ID;
  name: string;
  short_name: string;
  /** data: URL or null → render initials on brand_color */
  logo_url: string | null;
  brand_color: string;
  industry: string;
  tier: Tier;
  stage: Stage;
  am_id: ID;
  health_override: Health | null;
  /** internal only */
  health_override_reason: string | null;
  health_override_by: ID | null;
  health_override_at: ISODateTime | null;
  /** max 3 lines, written by AM, visible to client */
  exec_summary: string;
  exec_summary_updated_at: ISODateTime | null;
  /** e.g. 'coxanh.vn' — client invites must use this domain */
  email_domain: string;
  /** internal only */
  internal_notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type DecisionRole = 'decision_maker' | 'approver' | 'ops_contact';

export interface Contact extends SoftDelete {
  id: ID;
  account_id: ID;
  full_name: string;
  salutation: Salutation;
  title: string;
  decision_role: DecisionRole;
  email: string;
  phone: string | null;
  /** linked login, if invited */
  user_id: ID | null;
  last_interaction_at: ISODateTime | null;
  last_interaction_note: string | null;
}

// ───────────────────────────── Delivery ─────────────────────────────

export type ProjectStatus = 'active' | 'done' | 'paused';

export interface Project extends SoftDelete {
  id: ID;
  account_id: ID;
  name: string;
  code: string;
  start_date: ISODate;
  end_date: ISODate;
  status: ProjectStatus;
}

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'done';

export interface Milestone extends SoftDelete {
  id: ID;
  project_id: ID;
  name: string;
  /** 1-based order inside the project; later milestones shift with earlier ones */
  order_no: number;
  planned_date: ISODate;
  /** Manual forecast set by AM (spec column `forecast_date`). null = auto-computed. */
  forecast_override_date: ISODate | null;
  forecast_override_reason: string | null;
  status: MilestoneStatus;
  completed_at: ISODateTime | null;
  client_visible: boolean;
  description: string | null;
}

export type TaskSide = 'client' | 'internal';
/** Client task types — each has its own icon and primary button (section 3). */
export type ClientTaskType = 'approval' | 'upload' | 'confirm' | 'sign' | 'payment' | 'attend' | 'answer';
/** 'work' = ordinary New Era task */
export type TaskType = ClientTaskType | 'work';
/** Kanban columns: Cần làm / Đang làm / Chờ phản hồi / Xong */
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done';
export type WaitingOn = 'client' | 'internal';

export interface Task extends SoftDelete {
  id: ID;
  project_id: ID;
  milestone_id: ID | null;
  /** starts with a verb, plain words: "Duyệt thiết kế màn hình Đặt hàng" */
  title: string;
  description: string;
  side: TaskSide;
  type: TaskType;
  assignee_id: ID | null;
  /** client_owner who delegated this task to assignee_id */
  delegated_by: ID | null;
  delegated_at: ISODateTime | null;
  delegation_note: string | null;
  /** must be handled by the decision maker personally (e.g. accept a quote) → cannot be delegated */
  requires_owner: boolean;
  /** who must act next; null once done. Drives every "Đang chờ khách / Đang chờ New Era" counter. */
  waiting_on: WaitingOn | null;
  due_date: ISODate;
  status: TaskStatus;
  /** "Nếu chưa làm" — 1–2 plain sentences naming the blocked work and dates */
  impact_text: string;
  /** internal tasks only; client tasks are always visible to the client */
  client_visible: boolean;
  reminder_count: number;
  last_reminded_at: ISODateTime | null;
  manual_unblock_reason: string | null;
  manual_unblocked_by: ID | null;
  manual_unblocked_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  /** approval task generated when a quote is sent */
  quote_id: ID | null;
  /** payment task generated for an installment */
  payment_schedule_id: ID | null;
  /** deliverable round: 1 = first submission, 2 = after one change request… */
  revision: number;
  /** stored answer for 'answer' tasks / confirmation note */
  answer_text: string | null;
  created_by: ID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface TaskDependency {
  id: ID;
  /** the blocking task */
  task_id: ID;
  /** exactly one of blocks_task_id / blocks_milestone_id is set */
  blocks_task_id: ID | null;
  blocks_milestone_id: ID | null;
  created_by: ID;
  created_at: ISODateTime;
}

export type Visibility = 'internal' | 'shared';

export interface TaskComment extends SoftDelete {
  id: ID;
  task_id: ID;
  author_id: ID;
  body: string;
  /** 'internal' = Ghi chú nội bộ (never returned to client accounts) */
  visibility: Visibility;
  reply_to_id: ID | null;
  created_at: ISODateTime;
}

export type FileKind = 'design' | 'document' | 'contract' | 'proof' | 'data' | 'report' | 'other';

export interface FileItem extends SoftDelete {
  id: ID;
  account_id: ID;
  project_id: ID | null;
  task_id: ID | null;
  name: string;
  /** groups versions of the same document */
  doc_key: string;
  version: number;
  mime: string;
  size: number;
  /** 'sample:<key>' (generated demo file), 'data:...' (uploaded, small) or 'session:<id>' (uploaded, this tab only) */
  storage_path: string;
  visibility: Visibility;
  kind: FileKind;
  uploaded_by: ID;
  uploaded_at: ISODateTime;
  note: string | null;
}

// ───────────────────────────── Commercial ─────────────────────────────

export type PriceUnit = 'month' | 'user' | 'package' | 'manday';

export interface PriceItem extends SoftDelete {
  id: ID;
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  /** internal only */
  cost_price: number;
  category: string;
  active: boolean;
  description: string | null;
}

export interface AccountPrice {
  id: ID;
  account_id: ID;
  price_item_id: ID;
  negotiated_price: number;
  note: string | null;
}

export type QuoteStatus = 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'changes_requested' | 'expired';
export type VatRate = 0 | 5 | 8 | 10;

export interface Quote extends SoftDelete {
  id: ID;
  account_id: ID;
  project_id: ID | null;
  /** shared by all versions, e.g. 'BG-TA-2026-03' */
  code: string;
  title: string;
  version: number;
  /** previous version (v1 for v2) */
  parent_id: ID | null;
  status: QuoteStatus;
  valid_until: ISODate;
  /** extra discount on the total, % */
  discount_pct_total: number;
  approval_requested_at: ISODateTime | null;
  approval_requested_by: ID | null;
  director_approved_by: ID | null;
  director_approved_at: ISODateTime | null;
  approval_note: string | null;
  sent_at: ISODateTime | null;
  sent_by: ID | null;
  client_decision: 'accepted' | 'changes_requested' | null;
  client_decided_by: ID | null;
  client_decided_at: ISODateTime | null;
  client_note: string | null;
  /** shown on the client quote page */
  notes: string | null;
  /** internal only */
  internal_note: string | null;
  created_by: ID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface QuoteLine {
  id: ID;
  quote_id: ID;
  price_item_id: ID;
  description: string | null;
  qty: number;
  /** price used on this quote (defaults to account negotiated price, else list price) */
  unit_price: number;
  discount_pct: number;
  vat_rate: VatRate;
  sort_order: number;
}

export type ContractStatus = 'draft' | 'active' | 'completed';

export interface Contract extends SoftDelete {
  id: ID;
  account_id: ID;
  quote_id: ID | null;
  code: string;
  title: string;
  /** VND incl. VAT */
  value: number;
  signed_date: ISODate | null;
  start_date: ISODate;
  end_date: ISODate;
  status: ContractStatus;
  file_id: ID | null;
}

/** Stored states. 'overdue' is also stored once detected, but always re-derived: invoiced && today > due_date. */
export type PaymentStatus = 'not_due' | 'invoice_due' | 'invoiced' | 'paid' | 'overdue';

/** One installment ("đợt thanh toán") of a contract. Table: payment_schedules. */
export interface PaymentSchedule extends SoftDelete {
  id: ID;
  contract_id: ID;
  name: string;
  percent: number;
  amount: number;
  /** when this milestone completes, status → 'invoice_due' */
  milestone_id: ID | null;
  due_date: ISODate;
  status: PaymentStatus;
  invoice_no: string | null;
  invoiced_at: ISODateTime | null;
  paid_at: ISODateTime | null;
  client_reported_at: ISODateTime | null;
  proof_file_id: ID | null;
  /** AM can turn off the auto-created client "Thanh toán" task */
  auto_task_enabled: boolean;
  task_id: ID | null;
}

// ───────────────────────────── Log & messaging ─────────────────────────────

export type ActivityAction =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.approved'
  | 'task.changes_requested'
  | 'task.files_submitted'
  | 'task.confirmed'
  | 'task.attendance_confirmed'
  | 'task.answered'
  | 'task.signed_submitted'
  | 'task.payment_reported'
  | 'task.delegated'
  | 'task.question_asked'
  | 'task.reminded'
  | 'task.unblocked'
  | 'task.submission_accepted'
  | 'task.returned_to_client'
  | 'task.visibility_changed'
  | 'task.action_undone'
  | 'task.deleted'
  | 'comment.added'
  | 'milestone.created'
  | 'milestone.updated'
  | 'milestone.forecast_overridden'
  | 'milestone.completed'
  | 'project.created'
  | 'quote.created'
  | 'quote.updated'
  | 'quote.version_created'
  | 'quote.approval_requested'
  | 'quote.approved'
  | 'quote.approval_rejected'
  | 'quote.sent'
  | 'quote.accepted'
  | 'quote.changes_requested'
  | 'quote.expired'
  | 'contract.created'
  | 'payment.invoice_due'
  | 'payment.invoiced'
  | 'payment.reported'
  | 'payment.paid'
  | 'payment.overdue'
  /** a paid installment set back to invoiced (payment not actually received) */
  | 'payment.reopened'
  | 'payment.auto_task_toggled'
  | 'file.uploaded'
  | 'file.visibility_changed'
  | 'account.created'
  | 'account.updated'
  | 'account.health_overridden'
  | 'account.am_assigned'
  | 'account.exec_summary_updated'
  | 'contact.updated'
  | 'user.invited'
  | 'user.role_changed'
  /** a New Era staff member created by their first Google sign-in (actor = that person, visibility internal) */
  | 'user.sso_provisioned'
  | 'settings.updated'
  | 'escalation.sent'
  // CRM extension (always logged with visibility 'internal'; sentences in i18n/vi/activityCrm.ts)
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'opportunity.stage_changed'
  | 'opportunity.won'
  | 'opportunity.lost'
  | 'opportunity.reopened'
  | 'lead.created'
  | 'lead.updated'
  | 'lead.status_changed'
  | 'lead.assigned'
  | 'lead.converted'
  | 'interaction.logged'
  /** director changed the ideal customer profile (every fit score moves): target 'settings', account null */
  | 'icp.updated'
  /** director / AM created or edited a business group (name, members) of the client map: target 'settings' (id = the
   *  ecosystem), account null — director feeds only */
  | 'ecosystem.saved';

export type ActivityTargetType =
  | 'task'
  | 'milestone'
  | 'project'
  | 'quote'
  | 'contract'
  | 'payment'
  | 'file'
  | 'account'
  | 'contact'
  | 'user'
  | 'comment'
  | 'settings'
  | 'opportunity'
  | 'lead'
  | 'interaction';

export interface Activity {
  id: ID;
  account_id: ID | null;
  /** null = system */
  actor_id: ID | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_id: ID;
  /** values interpolated into the i18n sentence `activity.<action>` (e.g. { task: 'Duyệt thiết kế…', reason: '…' }) */
  params: Record<string, string | number>;
  /** 'shared' entries appear in the client's "Cập nhật mới" and approval history */
  visibility: Visibility;
  created_at: ISODateTime;
}

export type NotificationKind =
  | 'due_soon'
  | 'overdue'
  | 'escalation'
  | 'reminder'
  | 'task_update'
  | 'comment'
  | 'approval_needed'
  | 'quote'
  | 'payment'
  | 'delegated'
  | 'digest'
  | 'system';

export interface AppNotification {
  id: ID;
  user_id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  /** in-app path, e.g. '/portal/tasks/t_123' or '/app/accounts/a_1/tasks?task=t_9' */
  link: string;
  account_id: ID | null;
  task_id: ID | null;
  urgent: boolean;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
  /** idempotency key for the daily sweep, e.g. 'due3:t_12:2026-10-06' */
  dedupe_key: string | null;
}

export type EmailStatus = 'sent' | 'batched' | 'suppressed';

/** Simulated outbox (no real email is sent in this build). */
export interface EmailMessage {
  id: ID;
  to_user_id: ID;
  to_email: string;
  subject: string;
  body_text: string;
  /** absolute path opened by the email button — goes straight to the task, never via the home page */
  link: string | null;
  kind: NotificationKind;
  urgent: boolean;
  /** 'batched' = merged into the daily digest email; 'suppressed' = user preference */
  status: EmailStatus;
  batch_key: string | null;
  created_at: ISODateTime;
  sent_at: ISODateTime | null;
  reason: string | null;
  /**
   * Tasks whose titles the mail names (its own task, or every task a daily summary / weekly bulletin lists).
   * A client keeps seeing a stored mail only while every one of them is still visible to them (SPEC §2).
   * Optional: rows written before this field existed fall back to the task in `link`.
   */
  task_ids?: ID[];
}

export interface TemplateMilestone {
  name: string;
  /** days after project start */
  offset_days: number;
  client_visible: boolean;
}

export interface ProjectTemplate {
  id: ID;
  name: string;
  description: string;
  milestones: TemplateMilestone[];
}

export interface Settings {
  company_name: string;
  timezone: 'Asia/Ho_Chi_Minh';
  /** quotes whose effective discount vs account price exceeds this need director approval (default 10) */
  discount_approval_threshold_pct: number;
  /** escalate when a client task blocking a milestone is overdue ≥ N days (default 3) */
  escalation_overdue_days: number;
  /** remind N days before due (default [3, 1]) */
  reminder_days_before: number[];
  /** at most one overdue reminder per task per day */
  overdue_reminder_per_day: number;
  /** at most N emails per person per day, escalations excepted (default 1) */
  max_emails_per_day: number;
  /** Monday 08:00 */
  weekly_digest_weekday: number;
  weekly_digest_hour: number;
  /** auto-create a client "Thanh toán" task when an installment becomes invoice-due / invoiced */
  payment_task_auto: boolean;
}

export interface DbMeta {
  seed_version: number;
  /** calendar day the seed was generated for */
  seeded_for: ISODate;
  last_sweep_date: ISODate | null;
  /**
   * Set (Date.now()) whenever the data is (re)seeded. A tab ignores a stored copy of an OLDER generation written by
   * another tab (a stale tab writing right after a demo reset must not bring the old data back) — see db.ts.
   */
  generation?: number;
}
