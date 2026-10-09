// Client care rules (SPEC-CARE §3) — pure functions, no db, no React. Unit-tested in src/dev/careTests.ts.
//   · untriaged: a 'new' request received MORE than 7 days ago
//   · delivery debt ("nợ triển khai"): an open request with a promised date and no owner / no plan / a broken date
//   · roll-up per account, effective department status ('using' derived from deployments), coverage x/y
//   · expansion gate: debt > 0 blocks a move into a department we do not work with yet
//   · care status from the last touch, the cadence and the next action
//   · room to sell: categories without a deployment + departments with a concrete opportunity; group matrix cells

import type { ISODate, ISODateTime, Stage, Tier } from './types';
import type {
  AccountDepartment,
  ChangeRequest,
  CrStatus,
  DepartmentEffective,
  DepartmentKey,
  DepartmentStatus,
  Deployment,
  DeploymentStatus,
  SolutionCategory,
} from './careTypes';
import { SOLUTION_CATEGORIES } from './careTypes';
import { dateOf } from './clock';
import { addDays, diffDays } from './dates';

// ───────────────────────────── change requests ─────────────────────────────

/** a 'new' request older than this many days is flagged "chưa xử lý quá 7 ngày" */
export const TRIAGE_SLA_DAYS = 7;
/** "Đã xong 30 ngày qua" window of the roll-up */
export const DONE_WINDOW_DAYS = 30;

export const OPEN_CR_STATUSES: readonly CrStatus[] = ['new', 'triaged', 'planned', 'in_progress'];
/** statuses in which a promised date is a commitment New Era must back with an owner and a plan */
export const COMMITTED_CR_STATUSES: readonly CrStatus[] = ['triaged', 'planned', 'in_progress'];

export function isOpenCr(status: CrStatus): boolean {
  return OPEN_CR_STATUSES.includes(status);
}

/** `triaged_at` is optional so plain test rows still fit (missing → the received date stands in) */
type CrLike = Pick<ChangeRequest, 'status' | 'received_at' | 'promised_date' | 'owner_id' | 'plan_ref' | 'task_id' | 'done_at'> & {
  triaged_at?: ISODateTime | null;
};

/** whole days since the request was received (calendar days, Vietnam time) */
export function daysSinceReceived(cr: Pick<ChangeRequest, 'received_at'>, today: ISODate): number {
  return Math.max(0, diffDays(today, dateOf(cr.received_at)));
}

/** status 'new' and received MORE than TRIAGE_SLA_DAYS days before today (exactly 7 days → not yet) */
export function isUntriaged(cr: Pick<ChangeRequest, 'status' | 'received_at'>, today: ISODate): boolean {
  return cr.status === 'new' && daysSinceReceived(cr, today) > TRIAGE_SLA_DAYS;
}

/**
 * a request taken in ('triaged') with no date told to the client for more than this many days is flagged "đã tiếp
 * nhận N ngày, chưa hẹn ngày với khách" (review 09/10: it was never flagged, and the account read "ổn định")
 */
export const UNDATED_SLA_DAYS = 14;

/** whole days since New Era took the request in (the received date when no triage date is stored) */
export function daysSinceTriaged(cr: Pick<ChangeRequest, 'received_at'> & { triaged_at?: ISODateTime | null }, today: ISODate): number {
  return Math.max(0, diffDays(today, dateOf(cr.triaged_at ?? cr.received_at)));
}

/** status 'triaged', no promised date, and taken in MORE than UNDATED_SLA_DAYS days ago (exactly 14 → not yet) */
export function isUndated(
  cr: Pick<ChangeRequest, 'status' | 'received_at' | 'promised_date'> & { triaged_at?: ISODateTime | null },
  today: ISODate,
): boolean {
  return cr.status === 'triaged' && !cr.promised_date && daysSinceTriaged(cr, today) > UNDATED_SLA_DAYS;
}

export type DebtReason = 'no_owner' | 'no_plan' | 'date_passed';
export const DEBT_REASONS: DebtReason[] = ['no_owner', 'no_plan', 'date_passed'];

/** every reason that makes a request delivery debt (empty = not debt), in DEBT_REASONS order */
export function deliveryDebtReasons(cr: CrLike, today: ISODate): DebtReason[] {
  if (!COMMITTED_CR_STATUSES.includes(cr.status) || !cr.promised_date) return [];
  const reasons: DebtReason[] = [];
  if (!cr.owner_id) reasons.push('no_owner');
  if (!cr.plan_ref && !cr.task_id) reasons.push('no_plan');
  if (cr.promised_date < today) reasons.push('date_passed');
  return reasons;
}

/** the main reason (date_passed first: a broken promise is the most visible to the client), null when not debt */
export function deliveryDebtReason(cr: CrLike, today: ISODate): DebtReason | null {
  const reasons = deliveryDebtReasons(cr, today);
  if (reasons.length === 0) return null;
  return reasons.includes('date_passed') ? 'date_passed' : reasons[0];
}

export function isDeliveryDebt(cr: CrLike, today: ISODate): boolean {
  return deliveryDebtReasons(cr, today).length > 0;
}

export type DeliveryHealth = 'ok' | 'attention' | 'debt';

export interface CrRollup {
  /** new + triaged + planned + in progress */
  open: number;
  untriaged: number;
  /** taken in more than 14 days ago and still no date told to the client (isUndated) */
  undated: number;
  debt: number;
  /** done in the last 30 days */
  done_30d: number;
  /** 'debt' when debt > 0 · 'attention' when untriaged > 0 or undated > 0 · else 'ok' */
  delivery_health: DeliveryHealth;
}

export function crRollup(crs: readonly CrLike[], today: ISODate): CrRollup {
  let open = 0;
  let untriaged = 0;
  let undated = 0;
  let debt = 0;
  let done30 = 0;
  const since = addDays(today, -DONE_WINDOW_DAYS);
  for (const cr of crs) {
    if (isOpenCr(cr.status)) open += 1;
    if (isUntriaged(cr, today)) untriaged += 1;
    if (isUndated(cr, today)) undated += 1;
    if (isDeliveryDebt(cr, today)) debt += 1;
    if (cr.status === 'done' && cr.done_at && dateOf(cr.done_at) >= since) done30 += 1;
  }
  return {
    open,
    untriaged,
    undated,
    debt,
    done_30d: done30,
    delivery_health: debt > 0 ? 'debt' : untriaged > 0 || undated > 0 ? 'attention' : 'ok',
  };
}

/** 'YC-07' → 7 (0 when the code has no number) */
export function crNumber(code: string): number {
  const m = /(\d+)\s*$/.exec(code);
  return m ? Number(m[1]) : 0;
}

/** code prefix of the requests the client sees ("YC-07") */
export const CLIENT_CR_PREFIX = 'YC';
/**
 * code prefix of New Era's own proposals (source 'internal', "ĐX-02"): numbered apart, so taking a number for an
 * internal idea never leaves a gap in the client's own list (YC-09 → YC-11 would hint at hidden requests)
 */
export const INTERNAL_CR_PREFIX = 'ĐX';

export function crCodePrefix(source: ChangeRequest['source']): string {
  return source === 'internal' ? INTERNAL_CR_PREFIX : CLIENT_CR_PREFIX;
}

/** next code of an account in one numbering ('YC' by default): highest number + 1, two digits ('YC-01' … 'YC-99', then 'YC-100') */
export function nextCrCode(existingCodes: readonly string[], prefix: string = CLIENT_CR_PREFIX): string {
  const max = existingCodes.filter((c) => c.startsWith(`${prefix}-`)).reduce((m, c) => Math.max(m, crNumber(c)), 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

/** sort key of a request list: open ones first (debt → untriaged → undated → high priority → oldest), then closed newest first */
export function compareCrs(a: ChangeRequest, b: ChangeRequest, today: ISODate): number {
  const openA = isOpenCr(a.status);
  const openB = isOpenCr(b.status);
  if (openA !== openB) return openA ? -1 : 1;
  if (openA) {
    const rank = (x: ChangeRequest): number =>
      isDeliveryDebt(x, today) ? 0 : isUntriaged(x, today) ? 1 : isUndated(x, today) ? 2 : x.priority === 'high' ? 3 : 4;
    return rank(a) - rank(b) || a.received_at.localeCompare(b.received_at) || a.code.localeCompare(b.code);
  }
  const closedAt = (x: ChangeRequest): string => x.done_at ?? x.updated_at;
  return closedAt(b).localeCompare(closedAt(a)) || b.code.localeCompare(a.code);
}

// ───────────────────────────── departments & coverage ─────────────────────────────

/** deployment statuses that put a solution in a department's hands */
export const ACTIVE_DEPLOYMENT_STATUSES: readonly DeploymentStatus[] = ['live', 'rolling_out', 'pilot'];

type DeploymentLike = Pick<Deployment, 'status' | 'departments' | 'category'>;

export function isActiveDeployment(d: Pick<Deployment, 'status'>): boolean {
  return ACTIVE_DEPLOYMENT_STATUSES.includes(d.status);
}

/** departments that use (or are rolling out / piloting) at least one deployment */
export function usingDepartments(deployments: readonly DeploymentLike[]): Set<DepartmentKey> {
  const out = new Set<DepartmentKey>();
  for (const d of deployments) if (isActiveDeployment(d)) for (const k of d.departments) out.add(k);
  return out;
}

/** 'using' when an active deployment lists the department, else the stored status */
export function effectiveDepartmentStatus(dept: Pick<AccountDepartment, 'department' | 'status'>, deployments: readonly DeploymentLike[]): DepartmentEffective {
  return usingDepartments(deployments).has(dept.department) ? 'using' : dept.status;
}

export interface Coverage {
  /** using + engaged */
  covered: number;
  /** departments on the map minus not_fit */
  total: number;
}

/** "Phòng ban đã phủ x/y" */
export function coverage(departments: readonly Pick<AccountDepartment, 'department' | 'status'>[], deployments: readonly DeploymentLike[]): Coverage {
  const using = usingDepartments(deployments);
  let covered = 0;
  let total = 0;
  for (const d of departments) {
    const eff: DepartmentEffective = using.has(d.department) ? 'using' : d.status;
    if (eff === 'not_fit') continue;
    total += 1;
    if (eff === 'using' || eff === 'engaged') covered += 1;
  }
  return { covered, total };
}

// ───────────────────────────── expansion gate ─────────────────────────────

/** delivery debt must reach 0 before expanding into a new department */
export function expansionBlocked(rollup: Pick<CrRollup, 'debt'>): boolean {
  return rollup.debt > 0;
}

/**
 * Is moving a department to `to` an expansion into a department New Era does not work with yet? True for a move to
 * 'engaged' from 'untouched' / 'not_fit' / not on the map (`from` null). A department already in use (effective
 * 'using') or already engaged is not a new department.
 */
export function isExpansionMove(from: DepartmentEffective | null, to: DepartmentStatus): boolean {
  return to === 'engaged' && from !== 'engaged' && from !== 'using';
}

// ───────────────────────────── care status ─────────────────────────────

export type CareStatus = 'ok' | 'due_soon' | 'overdue';
/** a contact is "due soon" this many days before the cadence runs out */
export const CARE_DUE_SOON_DAYS = 3;
export const DEFAULT_CADENCE_DAYS: Record<Tier, number> = { strategic: 14, key: 21, standard: 30 };
export const MIN_CADENCE_DAYS = 1;
export const MAX_CADENCE_DAYS = 180;

export function defaultCadence(tier: Tier): number {
  return DEFAULT_CADENCE_DAYS[tier] ?? DEFAULT_CADENCE_DAYS.standard;
}

/** the latest of several instants (ISODateTime or ISODate), null when none */
export function latestTouch(values: readonly (ISODateTime | ISODate | null | undefined)[]): ISODateTime | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (best === null || v > best) best = v;
  }
  return best;
}

export interface CareStatusInfo {
  status: CareStatus;
  /** whole days since the last touch; null = never touched */
  days_since: number | null;
  /** next_action_due < today */
  next_action_overdue: boolean;
}

/**
 * daysSince > cadence → 'overdue'; daysSince > cadence − 3 → 'due_soon'; else 'ok'. A next action whose due date has
 * passed also counts as 'overdue'. An account never touched is 'overdue'.
 */
export function careStatus(input: {
  last_touch_at: ISODateTime | ISODate | null;
  cadence_days: number;
  next_action_due: ISODate | null;
  today: ISODate;
}): CareStatusInfo {
  const daysSince = input.last_touch_at ? Math.max(0, diffDays(input.today, dateOf(input.last_touch_at))) : null;
  const nextOverdue = !!input.next_action_due && input.next_action_due < input.today;
  let status: CareStatus = 'ok';
  if (daysSince === null || daysSince > input.cadence_days || nextOverdue) status = 'overdue';
  else if (daysSince > input.cadence_days - CARE_DUE_SOON_DAYS) status = 'due_soon';
  return { status, days_since: daysSince, next_action_overdue: nextOverdue };
}

export const CARE_STATUS_ORDER: Record<CareStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

// ───────────────────────────── room to sell ─────────────────────────────

/** a department row carries a concrete opportunity: engaged / untouched (stored) with a note or a value */
export function hasOpportunity(d: Pick<AccountDepartment, 'status' | 'opportunity_note' | 'est_value'>): boolean {
  if (d.status !== 'engaged' && d.status !== 'untouched') return false;
  return !!(d.opportunity_note && d.opportunity_note.trim()) || (d.est_value ?? 0) > 0;
}

/**
 * solution categories without an active deployment (live / rolling out / pilot), in SOLUTION_CATEGORIES order — a
 * paused or retired solution leaves its category open to sell again (same rule as the department's 'using')
 */
export function whitespaceCategories(deployments: readonly DeploymentLike[]): SolutionCategory[] {
  const used = new Set(deployments.filter(isActiveDeployment).map((d) => d.category));
  return SOLUTION_CATEGORIES.filter((c) => !used.has(c));
}

/** stages of a client that signed with New Era (care and room to sell are about them, not prospects) */
export const SIGNED_STAGES: readonly Stage[] = ['implementing', 'operating', 'paused'];

export function isSignedStage(stage: Stage): boolean {
  return SIGNED_STAGES.includes(stage);
}

/** Σ est_value of the departments that carry an opportunity */
export function opportunityValue(departments: readonly Pick<AccountDepartment, 'status' | 'opportunity_note' | 'est_value'>[]): number {
  return departments.filter(hasOpportunity).reduce((s, d) => s + (d.est_value ?? 0), 0);
}

export type MatrixCellState = 'live' | 'in_progress' | 'opportunity' | 'none';

/**
 * One cell of the group matrix (unit × category): 'live' when a live deployment of that category exists, else
 * 'in_progress' for a rolling-out / pilot one, else 'opportunity' when a department carries an opportunity of that
 * category, else 'none'. A paused (or retired) solution does not hold its cell: the category is open again.
 */
export function matrixCellState(
  category: SolutionCategory,
  deployments: readonly DeploymentLike[],
  departments: readonly Pick<AccountDepartment, 'status' | 'opportunity_note' | 'est_value' | 'opportunity_category'>[],
): MatrixCellState {
  const mine = deployments.filter((d) => d.category === category && isActiveDeployment(d));
  if (mine.some((d) => d.status === 'live')) return 'live';
  if (mine.length > 0) return 'in_progress';
  if (departments.some((d) => d.opportunity_category === category && hasOpportunity(d))) return 'opportunity';
  return 'none';
}
