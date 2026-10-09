// Client care entities (SPEC-CARE §2): what each signed account already uses, the per-department expansion map, the
// people and relationships, change requests ("yêu cầu thay đổi") and the care plan. New OPTIONAL tables in db.ts.
// Client viewers only ever get the client-safe views (services/careViews.ts) — see SPEC-CARE §5.

import type { ID, ISODate, ISODateTime, SoftDelete } from './types';

// ───────────────────────────── solutions ─────────────────────────────

export type SolutionCategory =
  | 'mobile_app' // Ứng dụng di động
  | 'web_portal' // Web & cổng thông tin
  | 'crm_erp' // CRM / ERP / quản trị
  | 'data_bi' // Dữ liệu & BI
  | 'ai_automation' // AI & tự động hóa
  | 'integration' // Tích hợp hệ thống
  | 'support'; // Vận hành & bảo trì

/** column order of the group matrix and of every category list */
export const SOLUTION_CATEGORIES: SolutionCategory[] = ['mobile_app', 'web_portal', 'crm_erp', 'data_bi', 'ai_automation', 'integration', 'support'];

export type DepartmentKey =
  | 'executive'
  | 'sales'
  | 'marketing'
  | 'operations'
  | 'supply_chain'
  | 'finance'
  | 'hr'
  | 'it'
  | 'customer_service'
  | 'production';

/** Ban điều hành, Kinh doanh, Marketing, Vận hành, Chuỗi cung ứng, Tài chính – Kế toán, Nhân sự, CNTT, Chăm sóc khách hàng, Sản xuất */
export const DEPARTMENT_KEYS: DepartmentKey[] = [
  'executive',
  'sales',
  'marketing',
  'operations',
  'supply_chain',
  'finance',
  'hr',
  'it',
  'customer_service',
  'production',
];

export type DeploymentStatus = 'live' | 'rolling_out' | 'pilot' | 'paused' | 'retired';
export const DEPLOYMENT_STATUSES: DeploymentStatus[] = ['live', 'rolling_out', 'pilot', 'paused', 'retired'];
export type Adoption = 'high' | 'medium' | 'low';
export const ADOPTIONS: Adoption[] = ['high', 'medium', 'low'];

/** table `deployments` — "Giải pháp đã triển khai" */
export interface Deployment extends SoftDelete {
  id: ID;
  account_id: ID;
  project_id: ID | null;
  name: string;
  category: SolutionCategory;
  /** 1–2 lines, client-visible */
  summary: string;
  status: DeploymentStatus;
  go_live_date: ISODate | null;
  /** who uses it */
  departments: DepartmentKey[];
  active_users: number | null;
  /** VND — INTERNAL (director / AM only) */
  contract_value: number | null;
  /** INTERNAL */
  adoption: Adoption | null;
  /** INTERNAL */
  notes: string | null;
  /** New Era owner */
  owner_id: ID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ───────────────────────────── expansion map ─────────────────────────────

/** stored status of a department on the expansion map */
export type DepartmentStatus = 'engaged' | 'untouched' | 'not_fit';
export const DEPARTMENT_STATUSES: DepartmentStatus[] = ['engaged', 'untouched', 'not_fit'];
/** 'using' is DERIVED: a live / rolling-out / pilot deployment lists the department */
export type DepartmentEffective = 'using' | DepartmentStatus;

/** table `account_departments` — the expansion map ("Bản đồ mở rộng"), one row per account × department */
export interface AccountDepartment {
  id: ID;
  account_id: ID;
  department: DepartmentKey;
  status: DepartmentStatus;
  /** evidence of a need */
  need_note: string | null;
  /** what we could sell there */
  opportunity_note: string | null;
  /** which solution category that opportunity belongs to (the column of the group matrix); null = not classified */
  opportunity_category: SolutionCategory | null;
  /** VND */
  est_value: number | null;
  /** client-side person in that department */
  contact_id: ID | null;
  /** New Era owner of the expansion */
  ne_owner_id: ID | null;
  next_step: string | null;
  next_step_due: ISODate | null;
  updated_at: ISODateTime;
}

// ───────────────────────────── people & relationships ─────────────────────────────

export type Influence = 'decision_maker' | 'influencer' | 'user' | 'gatekeeper';
export const INFLUENCES: Influence[] = ['decision_maker', 'influencer', 'user', 'gatekeeper'];
export type Stance = 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
export const STANCES: Stance[] = ['champion', 'supporter', 'neutral', 'skeptic', 'blocker'];
export type Strength = 'strong' | 'warm' | 'cold';
export const STRENGTHS: Strength[] = ['strong', 'warm', 'cold'];

/** table `stakeholders` — one per contact, id 'stk_<contact_id>' */
export interface Stakeholder {
  id: ID;
  contact_id: ID;
  account_id: ID;
  department: DepartmentKey | null;
  influence: Influence;
  stance: Stance;
  strength: Strength;
  /** who at New Era holds this relationship */
  ne_owner_id: ID | null;
  /** a contact of the same account */
  reports_to_contact_id: ID | null;
  notes: string | null;
  updated_at: ISODateTime;
}

export type RelationKind = 'introduced' | 'works_with' | 'reports_to' | 'former_colleague';
export const RELATION_KINDS: RelationKind[] = ['introduced', 'works_with', 'reports_to', 'former_colleague'];

/** table `relation_links` — mainly ACROSS units of a business group ("from introduced to", "from reports to to") */
export interface RelationLink {
  id: ID;
  from_contact_id: ID;
  to_contact_id: ID;
  kind: RelationKind;
  note: string | null;
  created_at: ISODateTime;
}

// ───────────────────────────── change requests ─────────────────────────────

export type CrStatus = 'new' | 'triaged' | 'planned' | 'in_progress' | 'done' | 'declined';
export const CR_STATUSES: CrStatus[] = ['new', 'triaged', 'planned', 'in_progress', 'done', 'declined'];
export type CrSource = 'client_portal' | 'meeting' | 'email' | 'chat' | 'internal';
export const CR_SOURCES: CrSource[] = ['client_portal', 'meeting', 'email', 'chat', 'internal'];
export type CrPriority = 'high' | 'normal' | 'low';
export const CR_PRIORITIES: CrPriority[] = ['high', 'normal', 'low'];

/** table `change_requests` — "Yêu cầu thay đổi" */
export interface ChangeRequest extends SoftDelete {
  id: ID;
  /** 'YC-07', numbered per account */
  code: string;
  account_id: ID;
  project_id: ID | null;
  deployment_id: ID | null;
  title: string;
  description: string;
  source: CrSource;
  requested_by_contact_id: ID | null;
  requested_by_user_id: ID | null;
  received_at: ISODateTime;
  status: CrStatus;
  priority: CrPriority;
  triaged_at: ISODateTime | null;
  /** New Era — INTERNAL */
  owner_id: ID | null;
  /** date told to the client */
  promised_date: ISODate | null;
  /** e.g. 'Sprint 14' — INTERNAL */
  plan_ref: string | null;
  /** linked internal task = a plan — INTERNAL */
  task_id: ID | null;
  /** visible to the client */
  client_note: string | null;
  /** INTERNAL */
  internal_note: string | null;
  /** visible to the client */
  decline_reason: string | null;
  done_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ───────────────────────────── care plan ─────────────────────────────

/** table `care_plans` — one per account, id 'care_<account_id>' */
export interface CarePlan {
  id: ID;
  account_id: ID;
  /** default: strategic 14, key 21, standard 30 */
  cadence_days: number;
  next_action: string | null;
  next_action_due: ISODate | null;
  next_action_owner_id: ID | null;
  updated_at: ISODateTime;
}
