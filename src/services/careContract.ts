// Contract of the client care refocus (SPEC-CARE §4). `api` (services/api.ts) implements Api & CrmApi & CareApi.
// Every method goes through the usual wrapper (async, sanitize, JSON clone, window.__CH_NET__ log).
// Access (data layer, SPEC-CARE §5):
//   director, AM (own accounts) — everything internal below;
//   member — getAccountCare (deployments + request roll-up only; departments / people / relations / care are null),
//            listChangeRequests, createChangeRequest, updateChangeRequest when they own the request;
//   client_owner / client_member — listMyRequests, submitRequest, listClientDeployments (own account, client-safe
//            fields only); every other method → forbidden. "Xem như khách hàng" = a read-only client.

import type { Health, ID, ISODate, ISODateTime, Salutation, Stage, Tier } from '@/domain/types';
import type {
  Adoption,
  CrPriority,
  CrSource,
  CrStatus,
  DepartmentEffective,
  DepartmentKey,
  DepartmentStatus,
  DeploymentStatus,
  Influence,
  RelationKind,
  SolutionCategory,
  Stance,
  Strength,
} from '@/domain/careTypes';
import type { CareStatus, CrRollup, DebtReason, MatrixCellState } from '@/domain/care';
import type { AccountRef, UserRef } from './contract';

export type { CareStatus, CrRollup, DebtReason, DeliveryHealth, MatrixCellState } from '@/domain/care';

// ───────────────────────────── small refs ─────────────────────────────

export interface EcosystemRef {
  id: ID;
  name: string;
  short_name: string;
}

export interface ContactRef {
  id: ID;
  full_name: string;
  title: string;
}

export interface ProjectRef {
  id: ID;
  name: string;
}

// ───────────────────────────── deployments ─────────────────────────────

/** internal view of a deployment ("Giải pháp đã triển khai") */
export interface DeploymentView {
  id: ID;
  account_id: ID;
  project: ProjectRef | null;
  name: string;
  category: SolutionCategory;
  /** "Ứng dụng di động" (care.category.*) */
  category_label: string;
  summary: string;
  status: DeploymentStatus;
  /** "Đang dùng" (care.deploymentStatus.*) */
  status_label: string;
  go_live_date: ISODate | null;
  /** still rolling out: the forecast go-live of its project (roadmap engine) when it moved off go_live_date, else null */
  go_live_forecast: ISODate | null;
  departments: DepartmentKey[];
  department_labels: string[];
  active_users: number | null;
  /** VND — director / AM only (null for members) */
  contract_value: number | null;
  adoption: Adoption | null;
  notes: string | null;
  owner: UserRef | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  /** director / AM of the account */
  can_edit: boolean;
}

/** what a client sees of a deployment (status ≠ retired) */
export interface ClientDeploymentView {
  id: ID;
  project: ProjectRef | null;
  name: string;
  category: SolutionCategory;
  category_label: string;
  summary: string;
  status: Exclude<DeploymentStatus, 'retired'>;
  /** client wording (care.deploymentStatusClient.*) */
  status_label: string;
  go_live_date: ISODate | null;
  /** as DeploymentView.go_live_forecast, only from a milestone the client sees on their timeline */
  go_live_forecast: ISODate | null;
  departments: DepartmentKey[];
  department_labels: string[];
  active_users: number | null;
}

export interface DeploymentInput {
  /** absent = new */
  id?: ID;
  account_id: ID;
  project_id: ID | null;
  name: string;
  category: SolutionCategory;
  summary: string;
  status: DeploymentStatus;
  go_live_date: ISODate | null;
  departments: DepartmentKey[];
  active_users: number | null;
  contract_value: number | null;
  adoption: Adoption | null;
  notes: string | null;
  /** default: the account's AM */
  owner_id?: ID | null;
  /**
   * The expansion gate applies here too: while the account has delivery debt, an active solution (live / rolling out /
   * pilot) may not put a department New Era does not work with yet (not in use, not engaged) in use — that is
   * expanding. Only a director passes, with this reason (logged department.gate_overridden per department); otherwise
   * ApiError('conflict', 'errors.care.expansionBlocked', { count, departments }).
   */
  override_reason?: string;
}

// ───────────────────────────── expansion map ─────────────────────────────

export interface DepartmentView {
  id: ID;
  account_id: ID;
  department: DepartmentKey;
  /** "Tài chính – Kế toán" (care.department.*) */
  label: string;
  status: DepartmentStatus;
  /** 'using' when a live / rolling-out / pilot deployment lists the department */
  effective: DepartmentEffective;
  /** "Đang dùng" · "Đang trao đổi" · "Chưa tiếp cận" · "Không phù hợp" (care.departmentStatus.*) */
  effective_label: string;
  /** active deployments used there */
  deployments: { id: ID; name: string; category: SolutionCategory; status: DeploymentStatus }[];
  contact: ContactRef | null;
  ne_owner: UserRef | null;
  need_note: string | null;
  opportunity_note: string | null;
  opportunity_category: SolutionCategory | null;
  opportunity_category_label: string | null;
  est_value: number | null;
  /** engaged / untouched (stored) with an opportunity note or a value */
  has_opportunity: boolean;
  next_step: string | null;
  next_step_due: ISODate | null;
  next_step_overdue: boolean;
  updated_at: ISODateTime;
}

export interface DepartmentInput {
  account_id: ID;
  department: DepartmentKey;
  status: DepartmentStatus;
  need_note?: string | null;
  opportunity_note?: string | null;
  opportunity_category?: SolutionCategory | null;
  est_value?: number | null;
  contact_id?: ID | null;
  ne_owner_id?: ID | null;
  next_step?: string | null;
  next_step_due?: ISODate | null;
  /**
   * Director only: expand although the account still has delivery debt. Logged to the activity
   * (department.gate_overridden). Without it a move into a new department while blocked throws
   * ApiError('conflict', 'errors.care.expansionBlocked', { count }).
   */
  override_reason?: string;
}

export interface ExpansionInfo {
  /** using + engaged */
  covered: number;
  /** departments on the map minus not_fit */
  total: number;
  /** delivery debt > 0 */
  blocked: boolean;
  debt_count: number;
  /** the gate sentence when blocked ("Còn 3 yêu cầu nợ triển khai — …"), else null */
  gate_message: string | null;
  /** categories with no deployment ("Danh mục chưa có") */
  whitespace_categories: { category: SolutionCategory; label: string }[];
  /** departments carrying an opportunity */
  opportunity_count: number;
  /** Σ est_value of those departments, VND */
  est_value_total: number;
  /** departments not on the map yet ("Thêm phòng ban") */
  missing_departments: { department: DepartmentKey; label: string }[];
}

// ───────────────────────────── people & relationships ─────────────────────────────

export interface StakeholderView {
  /** 'stk_<contact_id>' */
  id: ID;
  contact_id: ID;
  account_id: ID;
  contact: {
    id: ID;
    full_name: string;
    salutation: Salutation;
    title: string;
    decision_role: 'decision_maker' | 'approver' | 'ops_contact';
    email: string;
    phone: string | null;
    /** has a Client Hub login */
    has_login: boolean;
  };
  department: DepartmentKey | null;
  department_label: string | null;
  influence: Influence;
  influence_label: string;
  stance: Stance;
  stance_label: string;
  strength: Strength;
  strength_label: string;
  ne_owner: UserRef | null;
  reports_to_contact_id: ID | null;
  notes: string | null;
  /** latest touch with this person (contact.last_interaction_at / interactions), null = never */
  last_touch_at: ISODateTime | null;
  /** false = no stored row yet (defaults from the contact's decision role) */
  stored: boolean;
  updated_at: ISODateTime | null;
}

export interface StakeholderInput {
  contact_id: ID;
  department?: DepartmentKey | null;
  influence?: Influence;
  stance?: Stance;
  strength?: Strength;
  ne_owner_id?: ID | null;
  reports_to_contact_id?: ID | null;
  notes?: string | null;
}

export interface RelationEnd {
  contact_id: ID;
  full_name: string;
  title: string;
  salutation: Salutation;
  account: AccountRef;
  /** the viewer may open that account */
  accessible: boolean;
}

export interface RelationView {
  id: ID;
  kind: RelationKind;
  /** "đã giới thiệu" · "làm việc cùng" · "báo cáo cho" · "từng là đồng nghiệp" (care.relationKind.*) */
  kind_label: string;
  /** readable sentence: "Anh Bình (Mây Trắng) đã giới thiệu anh Minh (Cỏ Xanh)" */
  sentence: string;
  note: string | null;
  from: RelationEnd;
  to: RelationEnd;
  /** the two ends belong to different accounts (units of one group) */
  cross_unit: boolean;
  created_at: ISODateTime;
  can_edit: boolean;
}

export interface RelationLinkInput {
  id?: ID;
  from_contact_id: ID;
  to_contact_id: ID;
  kind: RelationKind;
  note: string | null;
}

// ───────────────────────────── care ─────────────────────────────

export interface CarePlanView {
  /** 'care_<account_id>' */
  id: ID;
  cadence_days: number;
  /** no stored plan / the tier's default */
  cadence_is_default: boolean;
  next_action: string | null;
  next_action_due: ISODate | null;
  next_action_owner: UserRef | null;
  updated_at: ISODateTime | null;
}

export interface CareInfo {
  plan: CarePlanView;
  last_touch_at: ISODateTime | null;
  /** whole days since the last touch, null = never */
  days_since: number | null;
  status: CareStatus;
  /** "Đúng nhịp" · "Sắp đến hạn chăm sóc" · "Quá hạn chăm sóc" (care.careStatus.*) */
  status_label: string;
  next_action_overdue: boolean;
}

export interface CarePlanInput {
  cadence_days?: number;
  next_action?: string | null;
  next_action_due?: ISODate | null;
  next_action_owner_id?: ID | null;
}

// ───────────────────────────── change requests ─────────────────────────────

export interface CrFlags {
  /** 'new' for more than 7 days */
  untriaged: boolean;
  /** days since received (for "chưa xử lý 11 ngày") */
  days_waiting: number;
  /** 'triaged' for more than 14 days with no date told to the client (isUndated) */
  undated: boolean;
  /** days since New Era took it in (for "đã tiếp nhận 54 ngày, chưa hẹn ngày"); 0 before triage */
  days_since_triage: number;
  debt: boolean;
  /** main reason (date_passed first), null when not debt */
  debt_reason: DebtReason | null;
  debt_reasons: DebtReason[];
}

/** internal view of a change request */
export interface ChangeRequestView {
  id: ID;
  /** 'YC-07' */
  code: string;
  account: AccountRef;
  project: ProjectRef | null;
  deployment: { id: ID; name: string } | null;
  title: string;
  description: string;
  source: CrSource;
  source_label: string;
  /** who asked (a client contact / user); null for internal requests */
  requested_by: { name: string; title: string | null; contact_id: ID | null; user_id: ID | null } | null;
  received_at: ISODateTime;
  status: CrStatus;
  /** internal wording (care.crStatus.*) */
  status_label: string;
  /** what the client reads for this status (care.crStatusClient.*) */
  client_status_label: string;
  priority: CrPriority;
  priority_label: string;
  triaged_at: ISODateTime | null;
  owner: UserRef | null;
  promised_date: ISODate | null;
  plan_ref: string | null;
  task: { id: ID; title: string; status: string; due_date: ISODate } | null;
  client_note: string | null;
  internal_note: string | null;
  decline_reason: string | null;
  done_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  flags: CrFlags;
  can: {
    /** triage, plan, status, notes (director, the account's AM, the request owner) */
    update: boolean;
    /** reassign the owner (director, the account's AM) */
    assign: boolean;
  };
}

/** what a client sees of a request of their own company */
export interface ClientChangeRequestView {
  id: ID;
  code: string;
  title: string;
  description: string;
  project: ProjectRef | null;
  status: CrStatus;
  /** client wording: "Đã gửi, chờ New Era tiếp nhận", "Đã lên kế hoạch"… */
  status_label: string;
  received_at: ISODateTime;
  promised_date: ISODate | null;
  client_note: string | null;
  decline_reason: string | null;
  done_at: ISODateTime | null;
  /** first name of the colleague who asked ("anh Minh"), null for requests New Era logged itself */
  requested_by_name: string | null;
  /** sent by the viewer */
  mine: boolean;
}

export interface ChangeRequestFilter {
  accountId?: ID;
  projectId?: ID;
  status?: CrStatus[];
  flag?: 'untriaged' | 'debt';
}

export interface ChangeRequestInput {
  account_id: ID;
  project_id?: ID | null;
  deployment_id?: ID | null;
  title: string;
  description: string;
  /** not 'client_portal' (that is submitRequest) */
  source: Exclude<CrSource, 'client_portal'>;
  requested_by_contact_id?: ID | null;
  /** default now; may be in the past (a request heard at a meeting last week), never in the future */
  received_at?: ISODateTime | ISODate | null;
  priority?: CrPriority;
  owner_id?: ID | null;
  promised_date?: ISODate | null;
  plan_ref?: string | null;
  task_id?: ID | null;
  client_note?: string | null;
  internal_note?: string | null;
}

/** triage / plan / status / decline (SPEC-CARE §6.4): only the keys present change */
export interface ChangeRequestPatch {
  status?: CrStatus;
  priority?: CrPriority;
  owner_id?: ID | null;
  promised_date?: ISODate | null;
  plan_ref?: string | null;
  task_id?: ID | null;
  client_note?: string | null;
  internal_note?: string | null;
  /** required when status becomes 'declined' (visible to the client) */
  decline_reason?: string | null;
  title?: string;
  description?: string;
  project_id?: ID | null;
  deployment_id?: ID | null;
}

export interface ClientRequestInput {
  title: string;
  description: string;
  project_id?: ID | null;
  priority?: CrPriority;
}

// ───────────────────────────── account care & portfolio ─────────────────────────────

export interface AccountCareView {
  /** `ecosystem`: the business group (director / AM only — null for members) */
  account: AccountRef & { tier: Tier; stage: Stage; industry: string; am: UserRef; health: Health; ecosystem: EcosystemRef | null };
  deployments: DeploymentView[];
  /** CR roll-up (members too) */
  requests: CrRollup;
  /** director / AM only — null for members */
  departments: DepartmentView[] | null;
  stakeholders: StakeholderView[] | null;
  /** internal links of the account + cross-unit links to sister companies of the same group */
  relations: RelationView[] | null;
  care: CareInfo | null;
  expansion: ExpansionInfo | null;
  /** decision maker (decision_role) and the strongest champion, with strength and NE owner */
  key_people: { decision_maker: StakeholderView | null; champion: StakeholderView | null } | null;
  /** director / AM of the account (edit deployments, map, people, care plan) */
  can_manage: boolean;
}

export interface CarePortfolioRow {
  account: AccountRef;
  industry: string;
  tier: Tier;
  stage: Stage;
  am: UserRef;
  health: Health;
  ecosystem: EcosystemRef | null;
  deployments: { live: number; total: number; names: string[] };
  departments: { covered: number; total: number };
  requests: CrRollup;
  care: {
    status: CareStatus;
    status_label: string;
    last_touch_at: ISODateTime | null;
    days_since: number | null;
    cadence_days: number;
    next_action: string | null;
    next_action_due: ISODate | null;
    next_action_owner: UserRef | null;
    next_action_overdue: boolean;
  };
  decision_maker: { contact_id: ID; full_name: string; title: string; strength: Strength; strength_label: string; ne_owner: UserRef | null } | null;
  /** `next_steps`: the expansion map's next steps due within NEXT_STEP_WINDOW_DAYS or overdue, soonest first */
  expansion: { blocked: boolean; opportunity_count: number; est_value_total: number; next_steps: ExpansionNextStep[] };
}

/** a department's next selling step on the expansion map ("Bước tiếp theo" of Mở rộng), for the overview */
export interface ExpansionNextStep {
  department: DepartmentKey;
  department_label: string;
  next_step: string;
  next_step_due: ISODate;
  overdue: boolean;
  ne_owner: UserRef | null;
}

export interface CarePortfolioFilter {
  amId?: ID;
  health?: Health;
  care?: CareStatus;
  flag?: 'debt' | 'untriaged' | 'care_overdue';
}

// ───────────────────────────── group matrix ─────────────────────────────

export interface MatrixCellView {
  category: SolutionCategory;
  state: MatrixCellState;
  /** "Đang dùng" · "Đang triển khai" · "Cơ hội" · "Trống" (care.matrixCell.*) */
  state_label: string;
  deployments: { id: ID; name: string; status: DeploymentStatus }[];
  opportunities: { department: DepartmentKey; department_label: string; note: string | null; est_value: number | null }[];
}

export interface GroupMatrixUnit {
  account: AccountRef & { tier: Tier; stage: Stage; health: Health; am: UserRef };
  /** signed client (implementing / operating / paused); prospects are shown but left out of the totals */
  signed: boolean;
  /** departments of this unit carrying an opportunity (in any cell, or without a category) and their Σ value */
  opportunity_count: number;
  est_value: number;
  coverage: { covered: number; total: number };
  debt: number;
  untriaged: number;
  care_status: CareStatus;
  care_status_label: string;
  /** one per SOLUTION_CATEGORIES entry, same order as GroupMatrix.categories */
  cells: MatrixCellView[];
}

export interface GroupMatrix {
  ecosystem: EcosystemRef & { description: string; industry: string | null };
  categories: { category: SolutionCategory; label: string }[];
  /** accounts of the group the viewer may read (AM: own accounts only) */
  units: GroupMatrixUnit[];
  /** cross-unit relation links inside the group (at least one end readable by the viewer) */
  relations: RelationView[];
  /**
   * Over the SIGNED units only: cells per state; `opportunities` = departments carrying an opportunity (the count
   * that matches `est_value`, wherever they sit — also inside a cell already in use); `extra_opportunity_cells` =
   * cells in use / rolling out that still hold an opportunity; `unsigned_units` = prospects left out.
   */
  totals: {
    live: number;
    in_progress: number;
    opportunity: number;
    none: number;
    est_value: number;
    opportunities: number;
    extra_opportunity_cells: number;
    unsigned_units: number;
  };
  /** sister companies of the group that use nothing from New Era yet (names only) */
  other_members: { id: ID; name: string }[];
}

// ───────────────────────────── API ─────────────────────────────

export interface CareApi {
  /** director, am (own accounts) — one row per accessible account */
  getCarePortfolio(filter?: CarePortfolioFilter): Promise<CarePortfolioRow[]>;
  /** director, am; member: deployments + request roll-up only */
  getAccountCare(accountId: ID): Promise<AccountCareView>;
  /** director, the account's AM */
  saveDeployment(input: DeploymentInput): Promise<DeploymentView>;
  /** director, the account's AM (soft delete) */
  deleteDeployment(id: ID): Promise<void>;
  /** director, the account's AM — the expansion gate applies (see DepartmentInput.override_reason) */
  saveDepartment(input: DepartmentInput): Promise<DepartmentView>;
  /** director, the account's AM — upsert by contact */
  saveStakeholder(input: StakeholderInput): Promise<StakeholderView>;
  /** director, an AM managing at least one end; both ends in one account or one business group */
  saveRelationLink(input: RelationLinkInput): Promise<RelationView>;
  deleteRelationLink(id: ID): Promise<void>;
  /** director, the account's AM */
  saveCarePlan(accountId: ID, input: CarePlanInput): Promise<CarePlanView>;

  /** internal (member: accounts they can access) */
  listChangeRequests(filter?: ChangeRequestFilter): Promise<ChangeRequestView[]>;
  /** internal, writable, account access; status 'new' */
  createChangeRequest(input: ChangeRequestInput): Promise<ChangeRequestView>;
  /** director, the account's AM, the request owner */
  updateChangeRequest(id: ID, patch: ChangeRequestPatch): Promise<ChangeRequestView>;

  /** client_owner, client_member — own account only (view-as: read) */
  listMyRequests(): Promise<ClientChangeRequestView[]>;
  /** client_owner, client_member — status 'new', source 'client_portal'; notifies the AM */
  submitRequest(input: ClientRequestInput): Promise<ClientChangeRequestView>;
  /** clients — own account, status ≠ retired, client-safe fields */
  listClientDeployments(): Promise<ClientDeploymentView[]>;

  /** director, am — units × solution categories of one business group */
  getGroupMatrix(ecosystemId: ID): Promise<GroupMatrix>;
}
