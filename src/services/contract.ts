// API contract between UI and the service layer.
// The UI only ever talks to `api` (src/services/api.ts), which implements `Api` below.
// Today it runs on mock data in the browser; later it is replaced by Supabase/HTTP with the same shapes.
//
// SECURITY RULE: every value returned by `api` is already filtered for the current viewer
// (RBAC at the data layer). Client viewers never receive cost/margin fields, internal comments,
// internal files/activities, or tasks with client_visible = false. The UI must not rely on hiding.

import type {
  Account,
  ActivityAction,
  ActivityTargetType,
  AppNotification,
  AuthProvider,
  ClientTaskType,
  Contact,
  ContractStatus,
  DecisionRole,
  EmailMessage,
  FileKind,
  Health,
  ID,
  ISODate,
  ISODateTime,
  MilestoneStatus,
  NotificationPref,
  OrgType,
  PaymentStatus,
  PriceUnit,
  ProjectStatus,
  ProjectTemplate,
  QuoteStatus,
  Role,
  Salutation,
  Settings,
  Stage,
  TaskSide,
  TaskStatus,
  TaskType,
  Tier,
  UserStatus,
  VatRate,
  Visibility,
  WaitingOn,
} from '@/domain/types';

// ───────────────────────────── Errors ─────────────────────────────

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'blocked' // task is blocked by an unfinished task
  | 'cycle' // dependency would create a cycle
  | 'read_only' // "Xem như khách hàng" mode
  | 'needs_approval' // quote over discount threshold, not approved yet
  | 'domain_mismatch' // invite email not in the client's company domain
  | 'requires_owner' // task must be handled by the decision maker
  | 'conflict';

export class ApiError extends Error {
  code: ApiErrorCode;
  /** i18n key for a user-facing message, e.g. 'errors.blocked' */
  messageKey: string;
  details?: Record<string, unknown>;
  constructor(code: ApiErrorCode, messageKey: string, details?: Record<string, unknown>) {
    super(`${code}: ${messageKey}`);
    this.name = 'ApiError';
    this.code = code;
    this.messageKey = messageKey;
    this.details = details;
  }
}

// ───────────────────────────── Shared refs ─────────────────────────────

export interface UserRef {
  id: ID;
  full_name: string;
  title: string | null;
  salutation: Salutation | null;
  org_type: OrgType;
  role: Role;
  avatar_url: string | null;
  email: string;
  phone: string | null;
}

export interface AccountRef {
  id: ID;
  name: string;
  short_name: string;
  logo_url: string | null;
  brand_color: string;
}

export interface MilestoneRef {
  id: ID;
  name: string;
  project_id: ID;
  planned_date: ISODate;
  forecast_date: ISODate;
  status: MilestoneStatus;
}

export interface DueInfo {
  due_date: ISODate;
  /** due_date - today (negative when overdue) */
  days_left: number;
  /** today > due_date and not done */
  overdue: boolean;
  overdue_days: number;
  /** not overdue and 0 ≤ days_left ≤ 3 */
  due_soon: boolean;
}

// ───────────────────────────── Health & status line ─────────────────────────────

export type HealthReason =
  | {
      kind: 'overdue_blocking';
      task_id: ID;
      task_title: string;
      side: TaskSide;
      waiting_on: WaitingOn | null;
      overdue_days: number;
      milestone_id: ID;
      milestone_name: string;
    }
  | {
      kind: 'due_soon_blocking';
      task_id: ID;
      task_title: string;
      side: TaskSide;
      waiting_on: WaitingOn | null;
      days_left: number;
      milestone_id: ID;
      milestone_name: string;
    }
  | { kind: 'overdue_task'; task_id: ID; task_title: string; side: TaskSide; waiting_on: WaitingOn | null; overdue_days: number }
  | { kind: 'overdue_payment'; payment_id: ID; name: string; overdue_days: number; amount: number };

export interface HealthInfo {
  /** effective value (override wins) */
  value: Health;
  /** clients: = value (whether New Era set the colour by hand is internal) */
  auto: Health;
  /** clients: always false */
  overridden: boolean;
  /** internal viewers only (stripped for clients) */
  override_reason?: string | null;
  /** most severe first; for clients only reasons about visible tasks are kept */
  reasons: HealthReason[];
}

/**
 * Whose task(s) a waiting_client band names when they are NOT the client viewer's own (a colleague's, or several
 * people's): "từ anh Minh (Cỏ Xanh)" (`name` = polite address) or "từ phía Cỏ Xanh" (`name` null).
 */
export interface StatusLineWho {
  name: string | null;
  /** the client company's short name */
  company: string;
}

/** One-sentence band on the client home (section 5.1). The UI renders it with i18n + salutation. */
export type StatusLine =
  | { tone: 'on_track'; kind: 'on_track' }
  | { tone: 'attention'; kind: 'due_soon_blocking'; count: number; milestone_name: string }
  | { tone: 'attention'; kind: 'overdue'; count: number }
  | { tone: 'attention'; kind: 'payment_overdue'; count: number }
  /**
   * "Mốc Go-live đang chờ 1 việc từ phía anh. Mỗi ngày chậm, Go-live lùi thêm 1 ngày." — `waiting_for` (client viewers
   * only) is set when the waited-for task is not the viewer's: "… đang chờ 1 việc từ anh Minh (Cỏ Xanh). …"
   */
  | { tone: 'blocked'; kind: 'waiting_client'; count: number; milestone_name: string; delay_days: number; waiting_for?: StatusLineWho }
  /** "Mốc UAT đang lùi 4 ngày do New Era chậm việc …. New Era đang xử lý." */
  | { tone: 'blocked'; kind: 'waiting_internal'; milestone_name: string; delay_days: number; task_title: string | null }
  /** health set manually by the AM, or no reason visible to this viewer → neutral sentence for the tone */
  | { tone: Health; kind: 'generic' };

export interface WaitingCounts {
  waiting_client: number;
  waiting_internal: number;
  overdue_client: number;
  overdue_internal: number;
}

// ───────────────────────────── Milestones & projects ─────────────────────────────

export type ForecastSource = 'on_plan' | 'dependency' | 'cascade' | 'manual' | 'done';

export interface MilestoneView {
  id: ID;
  project_id: ID;
  name: string;
  order_no: number;
  status: MilestoneStatus;
  planned_date: ISODate;
  /** always present: = planned_date when on plan */
  forecast_date: ISODate;
  /** forecast_date - planned_date (≥ 0 unless manual override earlier) */
  delay_days: number;
  forecast_source: ForecastSource;
  /** root cause for 'dependency' / 'cascade': the late task holding this milestone (title null if hidden from viewer) */
  cause: { task_id: ID; task_title: string | null; side: TaskSide; waiting_on: WaitingOn | null; delay_days: number } | null;
  /** for 'cascade': the earlier milestone that pushed this one */
  cascade_from: { milestone_id: ID; milestone_name: string } | null;
  /** for 'manual' */
  override_reason: string | null;
  client_visible: boolean;
  completed_at: ISODateTime | null;
  description: string | null;
  open_task_count: number;
  done_task_count: number;
}

export interface ProjectView {
  id: ID;
  account_id: ID;
  name: string;
  code: string;
  start_date: ISODate;
  end_date: ISODate;
  status: ProjectStatus;
  milestones: MilestoneView[];
  /** first milestone not done */
  current_milestone_id: ID | null;
  next_milestone: MilestoneView | null;
  /** last milestone (usually Go-live / Hỗ trợ sau go-live) */
  final_milestone: MilestoneView | null;
  /** done milestones / total */
  progress_pct: number;
}

// ───────────────────────────── Tasks ─────────────────────────────

export type TaskActionKind =
  | 'approve' // approval → "Xem & duyệt" (+ "Yêu cầu chỉnh sửa")
  | 'upload' // upload → "Tải lên"
  | 'confirm' // confirm → "Xác nhận"
  | 'sign' // sign → "Tải bản đã ký"
  | 'payment' // payment → "Báo đã chuyển khoản"
  | 'attend' // attend → "Xác nhận tham dự"
  | 'answer' // answer → "Trả lời"
  | 'review_submission' // internal: check what the client sent (accept / return to client)
  | 'start' // internal task → in_progress
  | 'complete'; // internal task → done

export interface BlockerRef {
  id: ID;
  /** null when the blocker is hidden from this viewer → UI says "việc chuẩn bị của New Era" */
  title: string | null;
  side: TaskSide;
  status: TaskStatus;
  assignee: UserRef | null;
  due: DueInfo;
}

export interface ChainNode {
  kind: 'task' | 'milestone';
  id: ID;
  /** null when hidden from viewer */
  label: string | null;
  /** 'stuck' nodes are drawn red */
  state: 'done' | 'stuck' | 'pending';
  side?: TaskSide;
  /** milestones only */
  forecast_date?: ISODate;
  planned_date?: ISODate;
}

export interface TaskPermissions {
  /** perform the primary action / secondary client actions */
  act: boolean;
  /** "Giao cho đồng nghiệp" (client_owner, not requires_owner) */
  delegate: boolean;
  /** "Hỏi lại New Era" */
  ask: boolean;
  /** internal: move between Kanban columns */
  change_status: boolean;
  /** internal: "Mở chặn thủ công" */
  unblock: boolean;
  /** internal: "Nhắc khách" / "Nhắc qua Zalo" */
  remind: boolean;
  /** internal: edit fields, dependencies, visibility */
  edit: boolean;
  /** internal: accept / return a client submission */
  review: boolean;
  /** comment as internal note */
  comment_internal: boolean;
  comment_shared: boolean;
}

export interface TaskView {
  id: ID;
  project_id: ID;
  milestone_id: ID | null;
  title: string;
  description: string;
  side: TaskSide;
  type: TaskType;
  status: TaskStatus;
  waiting_on: WaitingOn | null;
  due_date: ISODate;
  impact_text: string;
  client_visible: boolean;
  requires_owner: boolean;
  reminder_count: number;
  last_reminded_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  revision: number;
  answer_text: string | null;
  quote_id: ID | null;
  payment_schedule_id: ID | null;
  /** internal viewers only */
  manual_unblock_reason?: string | null;
  manual_unblocked_by?: UserRef | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;

  account: AccountRef;
  project: { id: ID; name: string };
  milestone: MilestoneRef | null;
  assignee: UserRef | null;
  delegated_by: UserRef | null;
  delegated_at: ISODateTime | null;
  delegation_note: string | null;

  due: DueInfo;
  /** has unfinished blockers and was not manually unblocked */
  blocked: boolean;
  blocked_by: BlockerRef[];
  blocks_tasks: { id: ID; title: string | null; side: TaskSide }[];
  /** not-done milestones this task holds back, directly or indirectly */
  blocks_milestones: MilestoneRef[];
  is_blocking_milestone: boolean;
  /** client ordering bucket (section 3): 1 overdue & blocking, 2 due soon & blocking, 3 other overdue, 4 rest */
  priority_rank: 1 | 2 | 3 | 4;
  /** main button for the CURRENT viewer, null = nothing to do */
  primary_action: TaskActionKind | null;
  can: TaskPermissions;
}

export interface CommentView {
  id: ID;
  task_id: ID;
  author: UserRef;
  body: string;
  visibility: Visibility;
  reply_to_id: ID | null;
  created_at: ISODateTime;
  mine: boolean;
}

export interface FileView {
  id: ID;
  account_id: ID;
  project_id: ID | null;
  task_id: ID | null;
  name: string;
  doc_key: string;
  version: number;
  /** all versions of the same doc_key visible to viewer, newest first (only on the newest entry) */
  older_versions?: FileView[];
  mime: string;
  size: number;
  /** ready to use in <img src>/<iframe src>/<a download> (data:, blob: or generated) */
  url: string;
  visibility: Visibility;
  kind: FileKind;
  uploaded_by: UserRef;
  uploaded_at: ISODateTime;
  note: string | null;
}

export interface ActivityView {
  id: ID;
  account_id: ID | null;
  actor: UserRef | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_id: ID;
  params: Record<string, string | number>;
  visibility: Visibility;
  created_at: ISODateTime;
}

export interface TaskDetail extends TaskView {
  comments: CommentView[];
  files: FileView[];
  history: ActivityView[];
  /** e.g. Duyệt thiết kế → Lập trình Đặt hàng → Mốc UAT → Go-live */
  chain: ChainNode[];
  /** raw dependency ids (internal editing) */
  dependencies: { blocks_task_ids: ID[]; blocks_milestone_ids: ID[]; blocked_by_task_ids: ID[] };
}

export interface TaskFilter {
  accountId?: ID;
  projectId?: ID;
  milestoneId?: ID;
  side?: TaskSide;
  assigneeId?: ID;
  waitingOn?: WaitingOn;
  /** open tasks only (default true) */
  openOnly?: boolean;
  overdue?: boolean;
  /** only tasks currently holding back a milestone */
  blocking?: boolean;
  blocked?: boolean;
  /** client viewer: tasks the viewer must act on now */
  mine?: boolean;
  /** client_owner: tasks the viewer delegated to colleagues */
  delegatedByMe?: boolean;
  search?: string;
}

/** Returned by client task actions — drives the toast and its 5-second "Hoàn tác". */
export interface ActionResult {
  task: TaskView;
  /** pass to api.undoAction within ~5 s; null when not undoable */
  undo_token: string | null;
  /** i18n key, e.g. 'task.toast.approved' → "Đã duyệt. New Era đã nhận được thông báo." */
  message_key: string;
}

export interface UploadInput {
  name: string;
  mime: string;
  size: number;
  /** data: URL (small files) or blob: URL */
  url: string;
}

export interface TaskInput {
  project_id: ID;
  milestone_id: ID | null;
  title: string;
  description: string;
  side: TaskSide;
  type: TaskType;
  assignee_id: ID | null;
  requires_owner: boolean;
  due_date: ISODate;
  /** required for client tasks and for any task that blocks something */
  impact_text: string;
  /** internal tasks; default true when milestone_id is set */
  client_visible: boolean;
  blocks_task_ids: ID[];
  blocks_milestone_ids: ID[];
  blocked_by_task_ids: ID[];
}

// ───────────────────────────── Accounts ─────────────────────────────

export interface AccountSummary extends AccountRef {
  industry: string;
  tier: Tier;
  stage: Stage;
  email_domain: string;
  am: UserRef;
  health: HealthInfo;
  next_milestone: (MilestoneView & { project_name: string }) | null;
  counts: WaitingCounts;
  /** signed contracts, VND incl. VAT */
  contract_value: number;
  receivable: number;
  receivable_overdue: number;
  last_activity_at: ISODateTime | null;
  updated_at: ISODateTime;
}

export interface ContactView {
  id: ID;
  account_id: ID;
  full_name: string;
  salutation: Salutation;
  title: string;
  decision_role: DecisionRole;
  email: string;
  phone: string | null;
  /** the AM's interaction log (CRM): director / AM only — null for members and clients */
  last_interaction_at: ISODateTime | null;
  last_interaction_note: string | null;
  user: (UserRef & { status: UserStatus; last_login_at: ISODateTime | null }) | null;
}

export interface CommercialSummary {
  contract_value: number;
  invoiced: number;
  collected: number;
  receivable: number;
  receivable_overdue: number;
  open_quote: QuoteSummary | null;
  next_payment: PaymentView | null;
}

export interface AccountDetail extends AccountSummary {
  exec_summary: string;
  exec_summary_updated_at: ISODateTime | null;
  /** internal only */
  internal_notes?: string | null;
  /** the AM's manual health (internal): always null for clients — they get only the effective colour */
  health_override: Health | null;
  projects: ProjectView[];
  contacts: ContactView[];
  decision_makers: ContactView[];
  /** null for client_member */
  commercial: CommercialSummary | null;
  created_at: ISODateTime;
}

export interface AccountFilter {
  health?: Health;
  /** has open tasks waiting on client */
  waitingClient?: boolean;
  /** has overdue receivables */
  overdueReceivable?: boolean;
  amId?: ID;
  search?: string;
}

export interface NewAccountInput {
  company: {
    name: string;
    short_name: string;
    industry: string;
    tier: Tier;
    stage: Stage;
    email_domain: string;
    logo_url: string | null;
    brand_color: string;
    am_id: ID;
  };
  contacts: {
    full_name: string;
    salutation: Salutation;
    title: string;
    decision_role: DecisionRole;
    email: string;
    phone: string | null;
    /** create a login (role client_owner for decision_maker, else client_member) and send invite */
    invite: boolean;
  }[];
  project: { name: string; start_date: ISODate; template_id: ID | null };
}

export interface InviteClientInput {
  full_name: string;
  email: string;
  salutation: Salutation;
  title: string;
  role: 'client_owner' | 'client_member';
  decision_role: DecisionRole;
}

// ───────────────────────────── Portal ─────────────────────────────

export interface PortalHome {
  viewer: { user: UserRef; role: Role; salutation: Salutation | null; /** 'anh Minh' */ address_name: string };
  account: AccountRef & { exec_summary: string; email_domain: string };
  projects: { id: ID; name: string }[];
  health: HealthInfo;
  status_line: StatusLine;
  /** tasks waiting on the viewer, sorted per section 3 */
  my_tasks: TaskView[];
  /** my_tasks due this week (incl. overdue) — "tuần này có N việc" */
  week_count: number;
  /** client_owner only: tasks delegated to colleagues, with status */
  delegated_tasks: TaskView[];
  /** client tasks already submitted, waiting for New Era to check */
  waiting_new_era: TaskView[];
  progress: ProjectView[];
  /** 3–5 visible New Era tasks for this week; late ones first */
  new_era_working: TaskView[];
  /** latest shared activities */
  updates: ActivityView[];
  counts: WaitingCounts;
  am: UserRef;
}

// ───────────────────────────── Director dashboard ─────────────────────────────

export type AttentionKind =
  | 'client_overdue_blocking' // "[Khách A]: Go-live đang chờ khách duyệt thiết kế, đã quá hạn 6 ngày"
  | 'internal_overdue_blocking' // New Era late on a task holding a milestone
  | 'escalation'
  | 'quote_pending_approval' // "Báo giá v2 cho [Khách B] chiết khấu 15%, chờ duyệt"
  | 'payment_overdue'
  | 'quote_changes_requested'
  | 'due_soon_blocking'
  | 'internal_overdue';

export type AttentionAction =
  | 'remind_client'
  | 'open_account'
  | 'approve_quote'
  | 'view_quote'
  | 'open_task'
  | 'view_receivables'
  | 'zalo';

export interface AttentionItem {
  id: string;
  /** 1 = most severe */
  severity: 1 | 2 | 3;
  kind: AttentionKind;
  account: AccountRef;
  /** values for the i18n sentence `dashboard.attention.<kind>` */
  params: Record<string, string | number>;
  task_id?: ID;
  quote_id?: ID;
  payment_id?: ID;
  milestone_id?: ID;
  /** 1–2 buttons, first is primary */
  actions: AttentionAction[];
}

export interface DirectorDashboard {
  kpis: {
    accounts_at_risk: { blocked: number; attention: number; active_total: number };
    overdue_tasks: { client: number; internal: number };
    contract_value_ytd: number;
    contract_count_ytd: number;
    receivable: { total: number; overdue: number };
  };
  /** max 7, most severe first */
  attention: AttentionItem[];
  accounts: AccountSummary[];
  /** current year, 12 entries 'YYYY-MM' */
  cashflow: { month: string; planned: number; actual: number }[];
}

// ───────────────────────────── Commercial ─────────────────────────────

export interface PriceItemView {
  id: ID;
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  /** director / AM with can_view_cost only */
  cost_price?: number;
  margin_pct?: number;
  category: string;
  active: boolean;
  description: string | null;
}

export interface AccountPriceView {
  price_item_id: ID;
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  negotiated_price: number | null;
  note: string | null;
}

export type LineChange = 'added' | 'removed' | 'modified' | null;

export interface QuoteLineView {
  id: ID;
  price_item_id: ID;
  code: string;
  name: string;
  unit: PriceUnit;
  description: string | null;
  qty: number;
  list_price: number;
  /** negotiated price for this account, else list price */
  applicable_price: number;
  unit_price: number;
  discount_pct: number;
  vat_rate: VatRate;
  /** qty × unit_price */
  subtotal: number;
  /** subtotal × discount_pct */
  discount_amount: number;
  /** subtotal − discount_amount − share of discount_pct_total */
  net: number;
  vat_amount: number;
  total: number;
  /** cost viewers only */
  cost_total?: number;
  /** vs previous version (only when a previous version exists) */
  change: LineChange;
  changed_fields: ('qty' | 'unit_price' | 'discount_pct' | 'vat_rate')[];
}

export interface QuoteTotals {
  /** Σ qty × applicable_price */
  gross_applicable: number;
  /** Σ qty × unit_price */
  subtotal: number;
  line_discount: number;
  header_discount: number;
  net_before_vat: number;
  vat: number;
  grand_total: number;
  /** 1 − net_before_vat / gross_applicable, in % (unit-price cuts count as discount) */
  effective_discount_pct: number;
  cost_total?: number;
  margin?: number;
  margin_pct?: number;
}

export interface QuoteSummary {
  id: ID;
  code: string;
  title: string;
  version: number;
  status: QuoteStatus;
  account: AccountRef;
  valid_until: ISODate;
  grand_total: number;
  effective_discount_pct: number;
  /** effective discount > threshold */
  needs_approval: boolean;
  approved: boolean;
  sent_at: ISODateTime | null;
  client_decision: 'accepted' | 'changes_requested' | null;
  client_decided_at: ISODateTime | null;
  created_by: UserRef;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface QuoteDetail extends QuoteSummary {
  project_id: ID | null;
  parent_id: ID | null;
  discount_pct_total: number;
  notes: string | null;
  /** internal only */
  internal_note?: string | null;
  approval_requested_at: ISODateTime | null;
  approval_requested_by: UserRef | null;
  director_approved_by: UserRef | null;
  director_approved_at: ISODateTime | null;
  approval_note: string | null;
  sent_by: UserRef | null;
  client_decided_by: UserRef | null;
  client_note: string | null;
  lines: QuoteLineView[];
  /** lines present in the previous version but removed in this one */
  removed_lines: QuoteLineView[];
  totals: QuoteTotals;
  /** all versions of the same code visible to viewer, newest first */
  versions: QuoteSummary[];
  threshold_pct: number;
  /** why "Gửi khách" is disabled, null when allowed */
  send_block_reason: 'needs_director_approval' | 'not_draft' | null;
  can: {
    edit: boolean;
    request_approval: boolean;
    approve: boolean;
    send: boolean;
    new_version: boolean;
    client_decide: boolean;
  };
}

export interface QuoteLineInput {
  id?: ID;
  price_item_id: ID;
  description: string | null;
  qty: number;
  unit_price: number;
  discount_pct: number;
  vat_rate: VatRate;
}

export interface QuoteInput {
  title: string;
  project_id: ID | null;
  valid_until: ISODate;
  discount_pct_total: number;
  notes: string | null;
  internal_note: string | null;
  lines: QuoteLineInput[];
}

export interface PaymentView {
  id: ID;
  contract_id: ID;
  contract_code: string;
  account: AccountRef;
  name: string;
  percent: number;
  amount: number;
  milestone: MilestoneRef | null;
  due_date: ISODate;
  /** effective status (overdue derived) */
  status: PaymentStatus;
  overdue_days: number;
  invoice_no: string | null;
  invoiced_at: ISODateTime | null;
  paid_at: ISODateTime | null;
  client_reported_at: ISODateTime | null;
  proof_file: FileView | null;
  auto_task_enabled: boolean;
  task_id: ID | null;
}

export interface ContractView {
  id: ID;
  account: AccountRef;
  quote_id: ID | null;
  code: string;
  title: string;
  value: number;
  signed_date: ISODate | null;
  start_date: ISODate;
  end_date: ISODate;
  status: ContractStatus;
  file: FileView | null;
  payments: PaymentView[];
  collected: number;
  outstanding: number;
}

export interface ReceivablesView {
  total: number;
  overdue: number;
  by_account: {
    account: AccountRef;
    am: UserRef;
    total: number;
    overdue: number;
    next_due: PaymentView | null;
    payments: PaymentView[];
  }[];
}

export type PaymentAction = 'mark_invoice_due' | 'invoice' | 'mark_paid' | 'reopen';

// ───────────────────────────── Notifications ─────────────────────────────

export type NotificationView = AppNotification;

export interface EmailView extends EmailMessage {
  to_user: UserRef;
}

// ───────────────────────────── Settings ─────────────────────────────

/** what a client viewer receives from getSettings (the portal shows the digest time and the reminder days) */
export type ClientSettings = Pick<Settings, 'company_name' | 'timezone' | 'reminder_days_before' | 'weekly_digest_weekday' | 'weekly_digest_hour'>;

export const CLIENT_SETTINGS_KEYS: readonly (keyof ClientSettings)[] = [
  'company_name',
  'timezone',
  'reminder_days_before',
  'weekly_digest_weekday',
  'weekly_digest_hour',
];

/** true for the full Settings an internal viewer receives */
export function isFullSettings(s: Settings | ClientSettings): s is Settings {
  return 'discount_approval_threshold_pct' in s;
}

export interface SweepResult {
  date: ISODate;
  reminders: number;
  overdue: number;
  escalations: number;
  payment_tasks: number;
  emails_sent: number;
  emails_batched: number;
}

export interface DigestSection {
  account: AccountRef;
  health: HealthInfo;
  status_line: StatusLine;
  done_last_week: TaskView[];
  waiting_on_you: TaskView[];
  upcoming_milestones: MilestoneView[];
}

export interface WeeklyDigest {
  recipient: UserRef;
  /** Monday of the digest week (of `send_at`) */
  week_of: ISODate;
  /** 'Thứ Hai 08:00' — computed from settings; the preview (getWeeklyDigest) shows the NEXT send slot, never a past one */
  send_at: ISODateTime;
  sections: DigestSection[];
}

export interface ZaloReminder {
  phone: string | null;
  /** ready-to-paste text with recipient name, task, due date and deep link */
  text: string;
  /** https://zalo.me/<phone> or null when no phone */
  url: string | null;
}

// ───────────────────────────── Session & admin ─────────────────────────────

export interface Viewer {
  user: UserRef & { account_id: ID | null; notification_pref: NotificationPref; onboarded_at: ISODateTime | null };
  role: Role;
  org_type: OrgType;
  account_id: ID | null;
  can_view_cost: boolean;
  /** true in "Xem như khách hàng" mode — every mutation throws 'read_only' */
  read_only: boolean;
  /** set in "Xem như khách hàng" mode */
  impersonating: { by: UserRef; account_id: ID } | null;
  remember_device: boolean;
}

export interface DemoLogin {
  role: Role;
  user_id: ID;
  /** i18n key for the button label */
  label_key: string;
  full_name: string;
  subtitle: string;
}

export interface SearchResult {
  /** 'opportunity' | 'lead': CRM results, internal director / AM viewers only */
  type: 'account' | 'task' | 'quote' | 'contact' | 'page' | 'opportunity' | 'lead';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface UserAdminView extends UserRef {
  account_id: ID | null;
  account_name: string | null;
  status: UserStatus;
  can_view_cost: boolean;
  last_login_at: ISODateTime | null;
  invited_at: ISODateTime | null;
  notification_pref: NotificationPref;
  /** 'google': created by the person's first Google sign-in (shown as a "Google" tag); null = seeded / invited */
  auth_provider: AuthProvider | null;
}

// ───────────────────────────── The API ─────────────────────────────

export interface Api {
  // session (sync reads)
  getViewer(): Viewer | null;
  /** subscribe to viewer changes (login/logout/view-as); returns unsubscribe */
  onViewerChange(cb: () => void): () => void;
  /** subscribe to any data change (used by useQuery to refetch); returns unsubscribe */
  onDataChange(cb: () => void): () => void;
  listDemoLogins(): DemoLogin[];

  loginDemo(role: Role): Promise<Viewer>;
  /** demo: always succeeds for known client emails; returns the code to show in a dev hint */
  requestOtp(email: string): Promise<{ sent: true; demo_code: string }>;
  verifyOtp(email: string, code: string, remember: boolean): Promise<Viewer>;
  loginWithPassword(email: string, password: string, remember: boolean): Promise<Viewer>;
  /**
   * New Era staff: Google ID token from the GIS button. The service verifies it itself (signature against Google's
   * keys, iss, aud = GOOGLE_CLIENT_ID, exp, email_verified, hd AND email domain = SSO_ALLOWED_DOMAIN) and signs in the
   * internal user with that email, or creates one (SSO_DEFAULT_ROLE) on the first sign-in. Errors: errors.sso_*.
   */
  loginWithGoogle(idToken: string, remember: boolean): Promise<Viewer>;
  logout(): Promise<void>;
  /** internal only: switch into a read-only client_owner view of the account */
  startViewAsClient(accountId: ID): Promise<Viewer>;
  stopViewAsClient(): Promise<Viewer>;
  completeOnboarding(): Promise<void>;
  updateMyPreferences(patch: { notification_pref?: NotificationPref }): Promise<Viewer>;

  // reads
  getDirectorDashboard(): Promise<DirectorDashboard>;
  listAccounts(filter?: AccountFilter): Promise<AccountSummary[]>;
  getAccount(id: ID): Promise<AccountDetail>;
  listProjects(accountId: ID): Promise<ProjectView[]>;
  listTasks(filter?: TaskFilter): Promise<TaskView[]>;
  getTask(id: ID): Promise<TaskDetail>;
  listActivities(params: { accountId?: ID; taskId?: ID; approvalsOnly?: boolean; limit?: number }): Promise<ActivityView[]>;
  listFiles(params: { accountId?: ID; taskId?: ID }): Promise<FileView[]>;
  listContacts(accountId: ID): Promise<ContactView[]>;
  /** client viewer: own company users (for delegation); internal: filter as given */
  listUsers(params?: { orgType?: OrgType; accountId?: ID; role?: Role }): Promise<UserRef[]>;
  getPortalHome(params?: { projectId?: ID }): Promise<PortalHome>;
  search(query: string): Promise<SearchResult[]>;

  // client task actions (each logs an activity and notifies New Era)
  approveTask(taskId: ID, note?: string): Promise<ActionResult>;
  requestTaskChanges(taskId: ID, reason: string): Promise<ActionResult>;
  /** upload + sign */
  submitTaskFiles(taskId: ID, files: UploadInput[], note?: string): Promise<ActionResult>;
  reportPayment(taskId: ID, proof: UploadInput, note?: string): Promise<ActionResult>;
  /** confirm + attend */
  confirmTask(taskId: ID, note?: string): Promise<ActionResult>;
  answerTask(taskId: ID, answer: string): Promise<ActionResult>;
  undoAction(undoToken: string): Promise<TaskView>;
  delegateTask(
    taskId: ID,
    input: { to_user_id?: ID; invite?: { email: string; full_name: string; salutation: Salutation }; note?: string },
  ): Promise<ActionResult>;
  askNewEra(taskId: ID, question: string): Promise<CommentView>;

  // internal task operations
  createTask(input: TaskInput): Promise<TaskView>;
  updateTask(id: ID, patch: Partial<TaskInput>): Promise<TaskView>;
  deleteTask(id: ID): Promise<void>;
  /** throws 'blocked' when moving a blocked task out of 'todo' */
  setTaskStatus(id: ID, status: TaskStatus): Promise<TaskView>;
  manualUnblock(id: ID, reason: string): Promise<TaskView>;
  setTaskClientVisible(id: ID, visible: boolean): Promise<TaskView>;
  acceptSubmission(taskId: ID, note?: string): Promise<TaskView>;
  /** send a new version / ask the client to redo → waiting_on = client */
  returnToClient(taskId: ID, input: { message: string; files?: UploadInput[] }): Promise<TaskView>;
  /** "Nhắc khách" — sends immediately, logs, increments reminder_count */
  remindClient(taskIds: ID[]): Promise<{ reminded: number; skipped: number }>;
  getZaloReminder(taskId: ID): Promise<ZaloReminder>;
  addComment(taskId: ID, body: string, visibility: Visibility, replyToId?: ID): Promise<CommentView>;
  /** dry-run cycle check for the create/edit form; `path` lists task titles forming the cycle */
  checkDependencies(input: { taskId?: ID; blocks_task_ids: ID[]; blocked_by_task_ids: ID[] }): Promise<{ ok: boolean; path?: string[] }>;

  // roadmap
  listTemplates(): Promise<ProjectTemplate[]>;
  createProject(accountId: ID, input: { name: string; start_date: ISODate; template_id: ID | null }): Promise<ProjectView>;
  applyTemplate(projectId: ID, templateId: ID, startDate: ISODate): Promise<ProjectView>;
  createMilestone(projectId: ID, input: { name: string; planned_date: ISODate; client_visible: boolean; description?: string | null }): Promise<MilestoneView>;
  updateMilestone(id: ID, patch: { name?: string; planned_date?: ISODate; client_visible?: boolean; description?: string | null; order_no?: number }): Promise<MilestoneView>;
  /** date null clears the override */
  overrideForecast(id: ID, date: ISODate | null, reason: string): Promise<MilestoneView>;
  /** marks done; linked installments → 'invoice_due' */
  completeMilestone(id: ID): Promise<MilestoneView>;

  // accounts & people
  createAccount(input: NewAccountInput): Promise<AccountDetail>;
  updateAccount(id: ID, patch: Partial<Pick<Account, 'name' | 'short_name' | 'industry' | 'tier' | 'stage' | 'logo_url' | 'brand_color' | 'email_domain' | 'exec_summary' | 'internal_notes'>>): Promise<AccountDetail>;
  /** health null clears the override; reason required when setting */
  overrideHealth(id: ID, health: Health | null, reason: string): Promise<AccountDetail>;
  /** director only */
  assignAm(accountId: ID, amId: ID): Promise<AccountDetail>;
  /** internal (AM/director) or client_owner of the same account; email must match account domain */
  inviteClientUser(accountId: ID, input: InviteClientInput): Promise<ContactView>;
  upsertContact(accountId: ID, input: Partial<Contact> & { full_name: string }): Promise<ContactView>;
  /** director only */
  listAllUsers(): Promise<UserAdminView[]>;
  setUserRole(userId: ID, role: Role): Promise<UserAdminView>;
  setUserCanViewCost(userId: ID, allowed: boolean): Promise<UserAdminView>;
  inviteInternalUser(input: { full_name: string; email: string; role: 'director' | 'am' | 'member'; title: string }): Promise<UserAdminView>;

  // files
  uploadFile(accountId: ID, input: UploadInput & { visibility: Visibility; kind: FileKind; task_id?: ID | null; project_id?: ID | null; doc_key?: string; note?: string | null }): Promise<FileView>;
  setFileVisibility(id: ID, visibility: Visibility): Promise<FileView>;

  // commercial
  listPriceItems(params?: { includeInactive?: boolean }): Promise<PriceItemView[]>;
  upsertPriceItem(input: { id?: ID; code: string; name: string; unit: PriceUnit; list_price: number; cost_price?: number; category: string; active: boolean; description?: string | null }): Promise<PriceItemView>;
  listAccountPrices(accountId: ID): Promise<AccountPriceView[]>;
  /** null removes the negotiated price */
  setAccountPrice(accountId: ID, priceItemId: ID, price: number | null, note?: string | null): Promise<AccountPriceView>;
  listQuotes(filter?: { accountId?: ID; status?: QuoteStatus; latestOnly?: boolean }): Promise<QuoteSummary[]>;
  getQuote(id: ID): Promise<QuoteDetail>;
  createQuote(accountId: ID, input: QuoteInput): Promise<QuoteDetail>;
  saveQuoteDraft(id: ID, input: QuoteInput): Promise<QuoteDetail>;
  /** copies into v(n+1) as draft */
  createQuoteVersion(id: ID): Promise<QuoteDetail>;
  requestQuoteApproval(id: ID, note?: string): Promise<QuoteDetail>;
  /** director only */
  approveQuote(id: ID, note?: string): Promise<QuoteDetail>;
  /** director only → back to draft */
  rejectQuoteApproval(id: ID, reason: string): Promise<QuoteDetail>;
  /** throws 'needs_approval' if over threshold and not approved; creates the client approval task */
  sendQuote(id: ID): Promise<QuoteDetail>;
  /** client_owner only */
  clientAcceptQuote(id: ID, note?: string): Promise<QuoteDetail>;
  clientRequestQuoteChanges(id: ID, note: string): Promise<QuoteDetail>;
  listContracts(filter?: { accountId?: ID }): Promise<ContractView[]>;
  listPayments(filter?: { accountId?: ID; status?: PaymentStatus }): Promise<PaymentView[]>;
  updatePayment(id: ID, action: PaymentAction, data?: { invoice_no?: string }): Promise<PaymentView>;
  setPaymentAutoTask(id: ID, enabled: boolean): Promise<PaymentView>;
  getReceivables(): Promise<ReceivablesView>;

  // notifications
  listNotifications(params?: { unreadOnly?: boolean; limit?: number }): Promise<NotificationView[]>;
  markNotificationsRead(ids?: ID[]): Promise<void>;
  /** internal: all emails; client: own emails */
  listOutbox(params?: { userId?: ID; limit?: number }): Promise<EmailView[]>;
  /** daily job (runs once per day on app start; also callable from Settings in demo) */
  runNotificationSweep(force?: boolean): Promise<SweepResult>;
  getWeeklyDigest(userId?: ID): Promise<WeeklyDigest>;

  // settings
  /**
   * Internal viewers: every field. Client viewers: only the ClientSettings fields — New Era's internal policy
   * (discount approval threshold, escalation days, email limits, auto payment tasks) is never sent to a client.
   * Narrow with `isFullSettings(s)`.
   */
  getSettings(): Promise<Settings | ClientSettings>;
  /** director only */
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** demo: wipe local changes and reseed */
  resetDemoData(): Promise<void>;
}

// Re-exported for convenience in UI code
export type {
  ClientTaskType,
  Contact,
  Health,
  NotificationPref,
  PaymentStatus,
  QuoteStatus,
  Role,
  Stage,
  TaskSide,
  TaskStatus,
  TaskType,
  Tier,
  VatRate,
  Visibility,
  WaitingOn,
};
