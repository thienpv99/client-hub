// Viewer-aware DTO builders of the client care refocus (SPEC-CARE §4–5). Client DTOs (ClientDeploymentView,
// ClientChangeRequestView) carry only client-safe fields; sanitize.ts strips the internal ones again (defence in depth).

import type { Account, Contact, ID, ISODate, Salutation } from '@/domain/types';
import type { AccountDepartment, ChangeRequest, Deployment, DepartmentKey, RelationLink, SolutionCategory, Stakeholder, Strength } from '@/domain/careTypes';
import { DEPARTMENT_KEYS, SOLUTION_CATEGORIES } from '@/domain/careTypes';
import { dateOf, todayISO } from '@/domain/clock';
import { addDays, diffDays } from '@/domain/dates';
import {
  daysSinceReceived,
  daysSinceTriaged,
  defaultCadence,
  deliveryDebtReason,
  deliveryDebtReasons,
  effectiveDepartmentStatus,
  hasOpportunity,
  isActiveDeployment,
  isSignedStage,
  isUndated,
  isUntriaged,
  matrixCellState,
  opportunityValue,
  whitespaceCategories,
} from '@/domain/care';
import { addressName } from '@/domain/naming';
import { capitalize, t } from '@/i18n';
import type { AccountRef, Viewer } from './contract';
import type {
  AccountCareView,
  CareInfo,
  CarePlanView,
  CarePortfolioRow,
  ChangeRequestView,
  ClientChangeRequestView,
  ClientDeploymentView,
  DepartmentView,
  DeploymentView,
  EcosystemRef,
  ExpansionInfo,
  ExpansionNextStep,
  GroupMatrix,
  GroupMatrixUnit,
  MatrixCellView,
  RelationView,
  StakeholderView,
} from './careContract';
import {
  accountContacts,
  accountDepartmentRows,
  accountDeployments,
  accountRelationLinks,
  careStatusFor,
  contactLastTouch,
  coverageFor,
  crRollupFor,
  ecosystemAccounts,
  ecosystemOf,
  sameAccountOrGroup,
  storedStakeholder,
} from './careData';
import { launchMilestone } from '@/domain/graph';
import { isManagerOf } from './context';
import { db } from './db';
import { accessibleIds, accountRef, graphForAccount, healthFor, projectMilestones, userRefAny, userRefById } from './views';

// ───────────────────────────── labels ─────────────────────────────

export const categoryLabel = (c: SolutionCategory): string => t(`care.category.${c}`);
export const departmentLabel = (d: DepartmentKey): string => t(`care.department.${d}`);

/** director / AM signed in as themselves (not view-as) */
export function isCareManagerViewer(v: Viewer): boolean {
  return v.org_type === 'internal' && !v.read_only && (v.role === 'director' || v.role === 'am');
}

function projectRef(id: ID | null): { id: ID; name: string } | null {
  if (!id) return null;
  const p = db.find('projects', id);
  return p ? { id: p.id, name: p.name } : null;
}

export function ecosystemRef(accountId: ID): EcosystemRef | null {
  const e = ecosystemOf(accountId);
  return e ? { id: e.id, name: e.name, short_name: e.short_name } : null;
}

// ───────────────────────────── deployments ─────────────────────────────

/**
 * The go-live a solution still being rolled out can really expect: the forecast of its project's launch milestone
 * (the roadmap's engine), when it differs from the stored date — null otherwise (live / paused solution, no project,
 * forecast on plan). `client`: only a milestone the client can see on their own timeline.
 */
export function goLiveForecast(d: Deployment, client = false): ISODate | null {
  if (!d.project_id || d.status === 'live' || !isActiveDeployment(d)) return null;
  const open = projectMilestones(d.project_id)
    .filter((m) => m.status !== 'done')
    .sort((a, b) => a.order_no - b.order_no);
  const m = launchMilestone(open);
  if (!m || (client && !m.client_visible)) return null;
  try {
    const forecast = graphForAccount(d.account_id).forecast(m.id).forecast_date;
    return forecast && forecast !== d.go_live_date ? forecast : null;
  } catch {
    return null;
  }
}

export function deploymentView(d: Deployment, v: Viewer): DeploymentView {
  const manager = isCareManagerViewer(v);
  return {
    id: d.id,
    account_id: d.account_id,
    project: projectRef(d.project_id),
    name: d.name,
    category: d.category,
    category_label: categoryLabel(d.category),
    summary: d.summary,
    status: d.status,
    status_label: t(`care.deploymentStatus.${d.status}`),
    go_live_date: d.go_live_date,
    go_live_forecast: goLiveForecast(d),
    departments: [...d.departments],
    department_labels: d.departments.map(departmentLabel),
    active_users: d.active_users,
    contract_value: manager ? d.contract_value : null,
    adoption: d.adoption,
    notes: d.notes,
    owner: userRefById(d.owner_id),
    created_at: d.created_at,
    updated_at: d.updated_at,
    can_edit: isManagerOf(v, d.account_id),
  };
}

export function clientDeploymentView(d: Deployment): ClientDeploymentView | null {
  if (d.status === 'retired') return null;
  return {
    id: d.id,
    project: projectRef(d.project_id),
    name: d.name,
    category: d.category,
    category_label: categoryLabel(d.category),
    summary: d.summary,
    status: d.status,
    status_label: t(`care.deploymentStatusClient.${d.status}`),
    go_live_date: d.go_live_date,
    go_live_forecast: goLiveForecast(d, true),
    departments: [...d.departments],
    department_labels: d.departments.map(departmentLabel),
    active_users: d.active_users,
  };
}

// ───────────────────────────── expansion map ─────────────────────────────

function contactRef(id: ID | null): { id: ID; full_name: string; title: string } | null {
  if (!id) return null;
  const c = db.find('contacts', id);
  return c ? { id: c.id, full_name: c.full_name, title: c.title } : null;
}

export function departmentView(row: AccountDepartment, deployments: readonly Deployment[], today: ISODate = todayISO()): DepartmentView {
  const effective = effectiveDepartmentStatus(row, deployments);
  return {
    id: row.id,
    account_id: row.account_id,
    department: row.department,
    label: departmentLabel(row.department),
    status: row.status,
    effective,
    effective_label: t(`care.departmentStatus.${effective}`),
    deployments: deployments
      .filter((d) => isActiveDeployment(d) && d.departments.includes(row.department))
      .map((d) => ({ id: d.id, name: d.name, category: d.category, status: d.status })),
    contact: contactRef(row.contact_id),
    ne_owner: userRefById(row.ne_owner_id),
    need_note: row.need_note,
    opportunity_note: row.opportunity_note,
    opportunity_category: row.opportunity_category,
    opportunity_category_label: row.opportunity_category ? categoryLabel(row.opportunity_category) : null,
    est_value: row.est_value,
    has_opportunity: hasOpportunity(row),
    next_step: row.next_step,
    next_step_due: row.next_step_due,
    next_step_overdue: !!row.next_step_due && row.next_step_due < today,
    updated_at: row.updated_at,
  };
}

const DEPARTMENT_ORDER = new Map<DepartmentKey, number>(DEPARTMENT_KEYS.map((k, i) => [k, i]));
const EFFECTIVE_ORDER: Record<DepartmentView['effective'], number> = { using: 0, engaged: 1, untouched: 2, not_fit: 3 };

export function departmentViews(accountId: ID, today: ISODate = todayISO()): DepartmentView[] {
  const deployments = accountDeployments(accountId);
  return accountDepartmentRows(accountId)
    .map((r) => departmentView(r, deployments, today))
    .sort((a, b) => EFFECTIVE_ORDER[a.effective] - EFFECTIVE_ORDER[b.effective] || (DEPARTMENT_ORDER.get(a.department) ?? 0) - (DEPARTMENT_ORDER.get(b.department) ?? 0));
}

export function expansionInfo(accountId: ID): ExpansionInfo {
  const rows = accountDepartmentRows(accountId);
  const deployments = accountDeployments(accountId);
  const cov = coverageFor(accountId);
  const debt = crRollupFor(accountId).debt;
  const onMap = new Set(rows.map((r) => r.department));
  return {
    covered: cov.covered,
    total: cov.total,
    blocked: debt > 0,
    debt_count: debt,
    gate_message: debt > 0 ? t('care.gate.blocked', { count: debt }) : null,
    whitespace_categories: whitespaceCategories(deployments).map((c) => ({ category: c, label: categoryLabel(c) })),
    opportunity_count: rows.filter(hasOpportunity).length,
    est_value_total: opportunityValue(rows),
    missing_departments: DEPARTMENT_KEYS.filter((k) => !onMap.has(k)).map((k) => ({ department: k, label: departmentLabel(k) })),
  };
}

// ───────────────────────────── people ─────────────────────────────

const STRENGTH_ORDER: Record<Strength, number> = { strong: 0, warm: 1, cold: 2 };

/** stored row, or defaults from the contact (decision role → influence, AM as owner, recent touch → warm) */
export function stakeholderOf(c: Contact, today: ISODate = todayISO()): { row: Stakeholder; stored: boolean } {
  const stored = storedStakeholder(c.id);
  if (stored) return { row: stored, stored: true };
  const account = db.find('accounts', c.account_id);
  const last = contactLastTouch(c);
  const recent = !!last && diffDays(today, dateOf(last)) <= 30;
  return {
    row: {
      id: `stk_${c.id}`,
      contact_id: c.id,
      account_id: c.account_id,
      department: null,
      influence: c.decision_role === 'decision_maker' ? 'decision_maker' : c.decision_role === 'approver' ? 'influencer' : 'user',
      stance: 'neutral',
      strength: recent ? 'warm' : 'cold',
      ne_owner_id: account ? account.am_id : null,
      reports_to_contact_id: null,
      notes: null,
      updated_at: c.last_interaction_at ?? account?.created_at ?? '',
    },
    stored: false,
  };
}

export function stakeholderView(c: Contact, today: ISODate = todayISO()): StakeholderView {
  const { row, stored } = stakeholderOf(c, today);
  return {
    id: row.id,
    contact_id: c.id,
    account_id: c.account_id,
    contact: {
      id: c.id,
      full_name: c.full_name,
      salutation: c.salutation,
      title: c.title,
      decision_role: c.decision_role,
      email: c.email,
      phone: c.phone,
      has_login: !!c.user_id,
    },
    department: row.department,
    department_label: row.department ? departmentLabel(row.department) : null,
    influence: row.influence,
    influence_label: t(`care.influence.${row.influence}`),
    stance: row.stance,
    stance_label: t(`care.stance.${row.stance}`),
    strength: row.strength,
    strength_label: t(`care.strength.${row.strength}`),
    ne_owner: userRefById(row.ne_owner_id),
    reports_to_contact_id: row.reports_to_contact_id,
    notes: row.notes,
    last_touch_at: contactLastTouch(c),
    stored,
    updated_at: stored ? row.updated_at : null,
  };
}

const DECISION_ORDER: Record<Contact['decision_role'], number> = { decision_maker: 0, approver: 1, ops_contact: 2 };

export function stakeholderViews(accountId: ID): StakeholderView[] {
  return accountContacts(accountId)
    .map((c) => stakeholderView(c))
    .sort(
      (a, b) =>
        DECISION_ORDER[a.contact.decision_role] - DECISION_ORDER[b.contact.decision_role] ||
        STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
        a.contact.full_name.localeCompare(b.contact.full_name, 'vi'),
    );
}

export function keyPeople(people: StakeholderView[]): { decision_maker: StakeholderView | null; champion: StakeholderView | null } {
  const decision =
    people.find((p) => p.contact.decision_role === 'decision_maker') ?? people.find((p) => p.influence === 'decision_maker') ?? null;
  const champions = people.filter((p) => p.stance === 'champion').sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength]);
  return { decision_maker: decision, champion: champions[0] ?? null };
}

// ───────────────────────────── relations ─────────────────────────────

function relationEnd(c: Contact, v: Viewer): RelationView['from'] | null {
  const a = db.find('accounts', c.account_id);
  if (!a) return null;
  return { contact_id: c.id, full_name: c.full_name, title: c.title, salutation: c.salutation, account: accountRef(a), accessible: accessibleIds(v).has(a.id) };
}

function personName(s: Salutation, fullName: string): string {
  return addressName(s, fullName);
}

/** null when an end is gone or the two ends are no longer one account / one group */
export function relationView(l: RelationLink, v: Viewer): RelationView | null {
  const from = db.find('contacts', l.from_contact_id);
  const to = db.find('contacts', l.to_contact_id);
  if (!from || !to || !sameAccountOrGroup(from.account_id, to.account_id)) return null;
  const a = relationEnd(from, v);
  const b = relationEnd(to, v);
  if (!a || !b) return null;
  const cross = from.account_id !== to.account_id;
  const verb = t(`care.relationVerb.${l.kind}`);
  const sentence = cross
    ? t('care.relationSentence.cross', {
        from: capitalize(personName(from.salutation, from.full_name)),
        fromAccount: a.account.short_name,
        verb,
        to: personName(to.salutation, to.full_name),
        toAccount: b.account.short_name,
      })
    : t('care.relationSentence.same', { from: capitalize(personName(from.salutation, from.full_name)), verb, to: personName(to.salutation, to.full_name) });
  return {
    id: l.id,
    kind: l.kind,
    kind_label: t(`care.relationKind.${l.kind}`),
    sentence,
    note: l.note,
    from: a,
    to: b,
    cross_unit: cross,
    created_at: l.created_at,
    can_edit: isManagerOf(v, from.account_id) || isManagerOf(v, to.account_id),
  };
}

export function relationViews(accountId: ID, v: Viewer): RelationView[] {
  return accountRelationLinks(accountId)
    .map((l) => relationView(l, v))
    .filter((x): x is RelationView => x !== null)
    .sort((a, b) => Number(b.cross_unit) - Number(a.cross_unit) || a.created_at.localeCompare(b.created_at));
}

// ───────────────────────────── care ─────────────────────────────

export function carePlanView(account: Account): CarePlanView {
  const { plan, stored } = careStatusFor(account);
  return {
    id: plan.id,
    cadence_days: plan.cadence_days,
    cadence_is_default: !stored || plan.cadence_days === defaultCadence(account.tier),
    next_action: plan.next_action,
    next_action_due: plan.next_action_due,
    next_action_owner: userRefById(plan.next_action_owner_id),
    updated_at: stored ? plan.updated_at : null,
  };
}

export function careInfo(account: Account, today: ISODate = todayISO()): CareInfo {
  const s = careStatusFor(account, today);
  return {
    plan: carePlanView(account),
    last_touch_at: s.last_touch_at,
    days_since: s.days_since,
    status: s.status,
    status_label: t(`care.careStatus.${s.status}`),
    next_action_overdue: s.next_action_overdue,
  };
}

// ───────────────────────────── change requests ─────────────────────────────

function requesterOf(cr: ChangeRequest): ChangeRequestView['requested_by'] {
  const contact = cr.requested_by_contact_id ? db.find('contacts', cr.requested_by_contact_id) : undefined;
  if (contact) return { name: contact.full_name, title: contact.title, contact_id: contact.id, user_id: contact.user_id ?? cr.requested_by_user_id };
  const user = cr.requested_by_user_id ? db.find('users', cr.requested_by_user_id) ?? db.allRows('users').find((u) => u.id === cr.requested_by_user_id) : undefined;
  if (user) return { name: user.full_name, title: user.title, contact_id: null, user_id: user.id };
  return null;
}

export function canUpdateCr(cr: ChangeRequest, v: Viewer): boolean {
  if (v.org_type !== 'internal' || v.read_only) return false;
  return isManagerOf(v, cr.account_id) || (!!cr.owner_id && cr.owner_id === v.user.id);
}

export function crView(cr: ChangeRequest, v: Viewer, today: ISODate = todayISO()): ChangeRequestView {
  const account = db.find('accounts', cr.account_id);
  const deployment = cr.deployment_id ? db.find('deployments', cr.deployment_id) : undefined;
  const task = cr.task_id ? db.find('tasks', cr.task_id) : undefined;
  const reasons = deliveryDebtReasons(cr, today);
  return {
    id: cr.id,
    code: cr.code,
    account: account ? accountRef(account) : ({ id: cr.account_id, name: '', short_name: '', logo_url: null, brand_color: '#64748B' } as AccountRef),
    project: projectRef(cr.project_id),
    deployment: deployment ? { id: deployment.id, name: deployment.name } : null,
    title: cr.title,
    description: cr.description,
    source: cr.source,
    source_label: t(`care.crSource.${cr.source}`),
    requested_by: requesterOf(cr),
    received_at: cr.received_at,
    status: cr.status,
    status_label: t(`care.crStatus.${cr.status}`),
    client_status_label: t(`care.crStatusClient.${cr.status}`),
    priority: cr.priority,
    priority_label: t(`care.crPriority.${cr.priority}`),
    triaged_at: cr.triaged_at,
    owner: userRefById(cr.owner_id),
    promised_date: cr.promised_date,
    plan_ref: cr.plan_ref,
    task: task ? { id: task.id, title: task.title, status: task.status, due_date: task.due_date } : null,
    client_note: cr.client_note,
    internal_note: cr.internal_note,
    decline_reason: cr.decline_reason,
    done_at: cr.done_at,
    created_at: cr.created_at,
    updated_at: cr.updated_at,
    flags: {
      untriaged: isUntriaged(cr, today),
      days_waiting: daysSinceReceived(cr, today),
      undated: isUndated(cr, today),
      days_since_triage: cr.triaged_at ? daysSinceTriaged(cr, today) : 0,
      debt: reasons.length > 0,
      debt_reason: deliveryDebtReason(cr, today),
      debt_reasons: reasons,
    },
    can: { update: canUpdateCr(cr, v), assign: v.org_type === 'internal' && isManagerOf(v, cr.account_id) },
  };
}

export function clientCrView(cr: ChangeRequest, v: Viewer): ClientChangeRequestView {
  const contact = cr.requested_by_contact_id ? db.find('contacts', cr.requested_by_contact_id) : undefined;
  const user = !contact && cr.requested_by_user_id ? db.find('users', cr.requested_by_user_id) : undefined;
  const name = contact ? addressName(contact.salutation, contact.full_name) : user ? addressName(user.salutation, user.full_name) : null;
  // in "Xem như khách hàng" v.user is the decision maker being shown: the list reads exactly as they see it
  const viewerUserId = v.user.id;
  return {
    id: cr.id,
    code: cr.code,
    title: cr.title,
    description: cr.description,
    project: projectRef(cr.project_id),
    status: cr.status,
    status_label: t(`care.crStatusClient.${cr.status}`),
    received_at: cr.received_at,
    promised_date: cr.promised_date,
    client_note: cr.client_note,
    decline_reason: cr.status === 'declined' ? cr.decline_reason : null,
    done_at: cr.done_at,
    requested_by_name: name,
    mine: !!viewerUserId && (cr.requested_by_user_id === viewerUserId || (!!contact && contact.user_id === viewerUserId)),
  };
}

// ───────────────────────────── account care & portfolio ─────────────────────────────

export function accountCareView(account: Account, v: Viewer): AccountCareView {
  const manager = isCareManagerViewer(v);
  const people = manager ? stakeholderViews(account.id) : null;
  return {
    account: {
      ...accountRef(account),
      tier: account.tier,
      stage: account.stage,
      industry: account.industry,
      am: userRefAny(account.am_id),
      health: healthFor(account.id, v).value,
      // business groups belong to the director / AMs (client map rules): members get null
      ecosystem: manager ? ecosystemRef(account.id) : null,
    },
    deployments: accountDeployments(account.id).map((d) => deploymentView(d, v)),
    requests: crRollupFor(account.id),
    departments: manager ? departmentViews(account.id) : null,
    stakeholders: people,
    relations: manager ? relationViews(account.id, v) : null,
    care: manager ? careInfo(account) : null,
    expansion: manager ? expansionInfo(account.id) : null,
    key_people: people ? keyPeople(people) : null,
    can_manage: isManagerOf(v, account.id),
  };
}

export function carePortfolioRow(account: Account, v: Viewer): CarePortfolioRow {
  const deployments = accountDeployments(account.id).filter((d) => d.status !== 'retired');
  const care = careStatusFor(account);
  const people = stakeholderViews(account.id);
  const dm = keyPeople(people).decision_maker;
  const rows = accountDepartmentRows(account.id);
  const cov = coverageFor(account.id);
  const rollup = crRollupFor(account.id);
  return {
    account: accountRef(account),
    industry: account.industry,
    tier: account.tier,
    stage: account.stage,
    am: userRefAny(account.am_id),
    health: healthFor(account.id, v).value,
    ecosystem: ecosystemRef(account.id),
    deployments: { live: deployments.filter((d) => d.status === 'live').length, total: deployments.length, names: deployments.map((d) => d.name) },
    departments: { covered: cov.covered, total: cov.total },
    requests: rollup,
    care: {
      status: care.status,
      status_label: t(`care.careStatus.${care.status}`),
      last_touch_at: care.last_touch_at,
      days_since: care.days_since,
      cadence_days: care.plan.cadence_days,
      next_action: care.plan.next_action,
      next_action_due: care.plan.next_action_due,
      next_action_owner: userRefById(care.plan.next_action_owner_id),
      next_action_overdue: care.next_action_overdue,
    },
    decision_maker: dm
      ? { contact_id: dm.contact_id, full_name: dm.contact.full_name, title: dm.contact.title, strength: dm.strength, strength_label: dm.strength_label, ne_owner: dm.ne_owner }
      : null,
    expansion: {
      blocked: rollup.debt > 0,
      opportunity_count: rows.filter(hasOpportunity).length,
      est_value_total: opportunityValue(rows),
      next_steps: expansionNextSteps(rows),
    },
  };
}

/** the overview lists a department's next step this many days before it is due (and every overdue one) */
export const NEXT_STEP_WINDOW_DAYS = 7;

/** next steps of the expansion map due within NEXT_STEP_WINDOW_DAYS or overdue (not_fit rows left out), soonest first */
export function expansionNextSteps(rows: readonly AccountDepartment[], today: ISODate = todayISO()): ExpansionNextStep[] {
  const until = addDays(today, NEXT_STEP_WINDOW_DAYS);
  return rows
    .filter((r): r is AccountDepartment & { next_step: string; next_step_due: ISODate } =>
      r.status !== 'not_fit' && !!r.next_step && !!r.next_step.trim() && !!r.next_step_due && r.next_step_due <= until,
    )
    .sort((a, b) => a.next_step_due.localeCompare(b.next_step_due) || a.department.localeCompare(b.department))
    .map((r) => ({
      department: r.department,
      department_label: departmentLabel(r.department),
      next_step: r.next_step,
      next_step_due: r.next_step_due,
      overdue: r.next_step_due < today,
      ne_owner: userRefById(r.ne_owner_id),
    }));
}

// ───────────────────────────── group matrix ─────────────────────────────

function matrixCell(category: SolutionCategory, deployments: readonly Deployment[], rows: readonly AccountDepartment[]): MatrixCellView {
  const state = matrixCellState(category, deployments, rows);
  return {
    category,
    state,
    state_label: t(`care.matrixCell.${state}`),
    deployments: deployments.filter((d) => d.category === category && d.status !== 'retired').map((d) => ({ id: d.id, name: d.name, status: d.status })),
    opportunities: rows
      .filter((r) => r.opportunity_category === category && hasOpportunity(r))
      .map((r) => ({ department: r.department, department_label: departmentLabel(r.department), note: r.opportunity_note, est_value: r.est_value })),
  };
}

/** units the viewer may read; `null` when the group does not exist */
export function groupMatrix(ecosystemId: ID, v: Viewer): GroupMatrix | null {
  const eco = db.find('ecosystems', ecosystemId);
  if (!eco) return null;
  const readable = accessibleIds(v);
  const members = ecosystemAccounts(eco.id);
  const units: GroupMatrixUnit[] = members
    .filter((a) => readable.has(a.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((a) => {
      const deployments = accountDeployments(a.id);
      const rows = accountDepartmentRows(a.id);
      const rollup = crRollupFor(a.id);
      const care = careStatusFor(a);
      return {
        account: { ...accountRef(a), tier: a.tier, stage: a.stage, health: healthFor(a.id, v).value, am: userRefAny(a.am_id) },
        signed: isSignedStage(a.stage),
        opportunity_count: rows.filter(hasOpportunity).length,
        est_value: opportunityValue(rows),
        coverage: coverageFor(a.id),
        debt: rollup.debt,
        untriaged: rollup.untriaged,
        care_status: care.status,
        care_status_label: t(`care.careStatus.${care.status}`),
        cells: SOLUTION_CATEGORIES.map((c) => matrixCell(c, deployments, rows)),
      };
    });
  const memberIds = new Set(members.map((a) => a.id));
  const seen = new Set<ID>();
  const relations: RelationView[] = [];
  for (const a of members) {
    for (const l of accountRelationLinks(a.id)) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      const view = relationView(l, v);
      if (!view || !view.cross_unit) continue;
      if (!memberIds.has(view.from.account.id) || !memberIds.has(view.to.account.id)) continue;
      if (!view.from.accessible && !view.to.accessible) continue;
      relations.push(view);
    }
  }
  relations.sort((x, y) => x.created_at.localeCompare(y.created_at));
  // the room to sell is about signed clients (SPEC-CARE §0: no prospecting now): prospects are shown, not counted
  const totals = { live: 0, in_progress: 0, opportunity: 0, none: 0, est_value: 0, opportunities: 0, extra_opportunity_cells: 0, unsigned_units: 0 };
  for (const u of units) {
    if (!u.signed) {
      totals.unsigned_units += 1;
      continue;
    }
    for (const cell of u.cells) {
      totals[cell.state] += 1;
      if ((cell.state === 'live' || cell.state === 'in_progress') && cell.opportunities.length > 0) totals.extra_opportunity_cells += 1;
    }
    totals.opportunities += u.opportunity_count;
    totals.est_value += u.est_value;
  }
  // sister companies that use nothing from New Era yet (names only — the room is in the group, not a sales pipeline)
  const memberNames = new Set(members.map((a) => a.name));
  const other_members = db
    .rows('leads')
    .filter((l) => l.ecosystem_id === eco.id && !l.converted_account_id && !memberNames.has(l.company_name))
    .map((l) => ({ id: l.id, name: l.company_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return {
    ecosystem: { id: eco.id, name: eco.name, short_name: eco.short_name, description: eco.description, industry: eco.industry },
    categories: SOLUTION_CATEGORIES.map((c) => ({ category: c, label: categoryLabel(c) })),
    units,
    relations,
    totals,
    other_members,
  };
}
