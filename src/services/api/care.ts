// Client care API (SPEC-CARE §4–5): portfolio, account care, deployments, expansion map (with the gate), people,
// relations, care plans, change requests (internal + client portal) and the group matrix.
// Every mutation: requireViewer → side check → assertWritable → scope → validation → ONE db.batch with its activity
// lines (+ notifications). Clients (and "Xem như khách hàng") only reach listMyRequests / submitRequest /
// listClientDeployments; every internal read answers them `forbidden`.

import type { Account, ID, ISODate, ISODateTime, User } from '@/domain/types';
import type { AccountDepartment, ChangeRequest, CrSource, CrStatus, Deployment, RelationLink, Stakeholder } from '@/domain/careTypes';
import {
  ADOPTIONS,
  CR_PRIORITIES,
  CR_SOURCES,
  CR_STATUSES,
  DEPARTMENT_KEYS,
  DEPARTMENT_STATUSES,
  DEPLOYMENT_STATUSES,
  INFLUENCES,
  RELATION_KINDS,
  SOLUTION_CATEGORIES,
  STANCES,
  STRENGTHS,
} from '@/domain/careTypes';
import { atTime, nowISO, todayISO } from '@/domain/clock';
import {
  CARE_STATUS_ORDER,
  MAX_CADENCE_DAYS,
  MIN_CADENCE_DAYS,
  compareCrs,
  isDeliveryDebt,
  isExpansionMove,
  isOpenCr,
  isUntriaged,
  nextCrCode,
  crCodePrefix,
  usingDepartments,
} from '@/domain/care';
import { isValidISODate } from '@/domain/dates';
import { hasKey, t } from '@/i18n';
import { newId } from '@/lib/utils';
import { ApiError, type Viewer } from '@/services/contract';
import type { CareApi, CarePortfolioRow, ChangeRequestPatch, ClientChangeRequestView } from '@/services/careContract';
import { accessibleAccountIds, assertAccount, assertManagerOf, assertWritable, isManagerOf, noAccess, requireViewer } from '@/services/context';
import {
  accountCrs,
  accountDepartmentRows,
  accountDeployments,
  careStatusFor,
  crRollupFor,
  invalidateCareCache,
  sameAccountOrGroup,
  storedCarePlan,
  storedStakeholder,
} from '@/services/careData';
import {
  accountCareView,
  canUpdateCr,
  carePlanView,
  carePortfolioRow,
  clientCrView,
  clientDeploymentView,
  crView,
  departmentLabel,
  departmentView,
  deploymentView,
  groupMatrix,
  isCareManagerViewer,
  relationView,
  stakeholderOf,
  stakeholderView,
} from '@/services/careViews';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { fmtDate, notifyRequestEvent } from '@/services/notifyEvents';
import { accessibleIds, healthFor } from '@/services/views';

const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');
const invalid = (key = 'errors.validation', details?: Record<string, unknown>): ApiError => new ApiError('validation', key, details);

const MAX_TITLE = 200;
const MAX_TEXT = 4000;
const MAX_NOTE = 1000;

// ───────────────────────────── guards ─────────────────────────────

/** internal reader (director, AM, member) — clients and view-as are refused */
function internalReader(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'internal' || v.read_only) throw forbidden();
  return v;
}

/** director / AM signed in as themselves */
function managerReader(): Viewer {
  const v = requireViewer();
  if (!isCareManagerViewer(v)) throw forbidden();
  return v;
}

/** internal writer: clients (and view-as, a read-only client) are refused like for every internal read */
function internalWriter(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'internal') throw forbidden();
  assertWritable(v);
  return v;
}

function clientReader(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'client' || !v.account_id) throw forbidden();
  return v;
}

/** unknown id → not_found; an account outside the viewer's scope → forbidden (internal) / not_found (client) */
function loadAccount(id: ID | null | undefined, v: Viewer): Account {
  const a = typeof id === 'string' ? db.find('accounts', id) : undefined;
  if (!a) throw notFound();
  assertAccount(v, a.id);
  return a;
}

// ───────────────────────────── field validation ─────────────────────────────

function text(s: unknown): string {
  return typeof s === 'string' ? s.trim() : '';
}

function optText(s: unknown, max = MAX_NOTE): string | null {
  const v = text(s);
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

function optDate(d: unknown): ISODate | null {
  if (d === null || d === undefined || d === '') return null;
  if (typeof d !== 'string' || !isValidISODate(d)) throw invalid('errors.invalid_date');
  return d;
}

function optAmount(n: unknown): number | null {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) throw invalid();
  return Math.round(v);
}

function oneOf<T extends string>(value: unknown, list: readonly T[]): T {
  if (typeof value !== 'string' || !(list as readonly string[]).includes(value)) throw invalid();
  return value as T;
}

/** an active New Era person (owners of deployments, requests, departments, relationships, care actions) */
function internalUser(id: unknown, key = 'errors.care.invalidOwner'): User {
  const u = typeof id === 'string' ? db.find('users', id) : undefined;
  if (!u || u.org_type !== 'internal' || u.status === 'disabled') throw invalid(key);
  return u;
}

function optInternalUser(id: unknown): ID | null {
  if (id === null || id === undefined || id === '') return null;
  return internalUser(id).id;
}

function projectOf(accountId: ID, id: unknown): ID | null {
  if (id === null || id === undefined || id === '') return null;
  const p = typeof id === 'string' ? db.find('projects', id) : undefined;
  if (!p || p.account_id !== accountId) throw invalid('errors.care.invalidProject');
  return p.id;
}

function deploymentOf(accountId: ID, id: unknown): ID | null {
  if (id === null || id === undefined || id === '') return null;
  const d = typeof id === 'string' ? db.find('deployments', id) : undefined;
  if (!d || d.account_id !== accountId) throw invalid('errors.care.invalidDeployment');
  return d.id;
}

function contactOf(accountId: ID, id: unknown): ID | null {
  if (id === null || id === undefined || id === '') return null;
  const c = typeof id === 'string' ? db.find('contacts', id) : undefined;
  if (!c || c.account_id !== accountId) throw invalid('errors.care.invalidContact');
  return c.id;
}

function taskOf(accountId: ID, id: unknown): ID | null {
  if (id === null || id === undefined || id === '') return null;
  const task = typeof id === 'string' ? db.find('tasks', id) : undefined;
  const project = task ? db.find('projects', task.project_id) : undefined;
  if (!task || !project || project.account_id !== accountId) throw invalid('errors.care.invalidTask');
  return task.id;
}

function changedKeys<T extends object>(before: T, after: T, keys: (keyof T)[]): string[] {
  return keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(String);
}

/** readable list of changed fields ('trạng thái, ngày hẹn với khách') from activity.<ns>.field.* */
function fieldList(ns: string, keys: string[]): string {
  return keys.map((k) => (hasKey(`activity.${ns}.field.${k}`) ? t(`activity.${ns}.field.${k}`) : k)).join(', ');
}

// ───────────────────────────── change-request helpers ─────────────────────────────

function crParams(cr: ChangeRequest): Record<string, string> {
  const params: Record<string, string> = { code: cr.code, request: cr.title };
  if (cr.project_id) params.project_id = cr.project_id;
  return params;
}

function loadCr(id: ID, v: Viewer): ChangeRequest {
  const cr = db.find('change_requests', id);
  if (!cr) throw notFound();
  if (!accessibleAccountIds(v).has(cr.account_id)) throw noAccess(v);
  return cr;
}

/** next code of the account in the numbering of source (YC- for the client's requests, ĐX- for New Era's own proposals; soft-deleted requests keep their number) */
function nextCode(accountId: ID, source: CrSource): string {
  return nextCrCode(
    db.allRows('change_requests').filter((x) => x.account_id === accountId).map((x) => x.code),
    crCodePrefix(source),
  );
}

/** received date of a request logged by New Era: now by default, never in the future */
function receivedAt(value: unknown): ISODateTime {
  const now = nowISO();
  if (value === null || value === undefined || value === '') return now;
  if (typeof value !== 'string') throw invalid('errors.invalid_date');
  const at = value.length === 10 ? (isValidISODate(value) ? (value === todayISO() ? now : atTime(value, '09:00')) : '') : value;
  if (!at || Number.isNaN(new Date(at).getTime())) throw invalid('errors.invalid_date');
  if (new Date(at).getTime() > new Date(now).getTime() + 60_000) throw invalid('errors.care.receivedInFuture');
  return at;
}

const CR_PATCH_KEYS: (keyof ChangeRequest)[] = [
  'priority',
  'owner_id',
  'promised_date',
  'plan_ref',
  'task_id',
  'client_note',
  'internal_note',
  'decline_reason',
  'title',
  'description',
  'project_id',
  'deployment_id',
];

// ───────────────────────────── portfolio ordering ─────────────────────────────

const DELIVERY_ORDER: Record<CarePortfolioRow['requests']['delivery_health'], number> = { debt: 0, attention: 1, ok: 2 };
const HEALTH_ORDER: Record<CarePortfolioRow['health'], number> = { blocked: 0, attention: 1, on_track: 2 };

function comparePortfolio(a: CarePortfolioRow, b: CarePortfolioRow): number {
  return (
    DELIVERY_ORDER[a.requests.delivery_health] - DELIVERY_ORDER[b.requests.delivery_health] ||
    CARE_STATUS_ORDER[a.care.status] - CARE_STATUS_ORDER[b.care.status] ||
    HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
    a.account.name.localeCompare(b.account.name, 'vi')
  );
}

// ───────────────────────────── the API ─────────────────────────────

export const careApi: CareApi = {
  async getCarePortfolio(filter) {
    const v = managerReader();
    const f = filter ?? {};
    const rows: CarePortfolioRow[] = [];
    for (const id of accessibleIds(v)) {
      const account = db.find('accounts', id);
      if (!account) continue;
      if (f.amId && account.am_id !== f.amId) continue;
      if (f.health && healthFor(id, v).value !== f.health) continue;
      const row = carePortfolioRow(account, v);
      if (f.care && row.care.status !== f.care) continue;
      if (f.flag === 'debt' && row.requests.debt === 0) continue;
      if (f.flag === 'untriaged' && row.requests.untriaged === 0) continue;
      if (f.flag === 'care_overdue' && row.care.status !== 'overdue') continue;
      rows.push(row);
    }
    return rows.sort(comparePortfolio);
  },

  async getAccountCare(accountId) {
    const v = internalReader();
    const account = loadAccount(accountId, v);
    return accountCareView(account, v);
  },

  async saveDeployment(input) {
    const v = internalWriter();
    if (!input || typeof input !== 'object') throw invalid();
    const existing = input.id ? db.find('deployments', input.id) : undefined;
    if (input.id && !existing) throw notFound();
    const accountId = existing ? existing.account_id : input.account_id;
    const account = loadAccount(accountId, v);
    assertManagerOf(v, account.id);
    if (existing && input.account_id && input.account_id !== existing.account_id) throw invalid();
    const name = text(input.name);
    if (!name) throw invalid('errors.care.nameRequired');
    const departments = [...new Set((Array.isArray(input.departments) ? input.departments : []).map((d) => oneOf(d, DEPARTMENT_KEYS)))];
    const at = nowISO();
    const fields: Omit<Deployment, 'id' | 'account_id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
      project_id: projectOf(account.id, input.project_id),
      name: name.slice(0, MAX_TITLE),
      category: oneOf(input.category, SOLUTION_CATEGORIES),
      summary: optText(input.summary, 400) ?? '',
      status: oneOf(input.status, DEPLOYMENT_STATUSES),
      go_live_date: optDate(input.go_live_date),
      departments: DEPARTMENT_KEYS.filter((k) => departments.includes(k)),
      active_users: optAmount(input.active_users),
      contract_value: optAmount(input.contract_value),
      adoption: input.adoption === null || input.adoption === undefined ? null : oneOf(input.adoption, ADOPTIONS),
      notes: optText(input.notes, MAX_NOTE),
      owner_id: input.owner_id ? internalUser(input.owner_id).id : existing ? existing.owner_id : account.am_id,
    };
    const id = existing ? existing.id : newId('dpl');

    // the expansion gate (SPEC-CARE §3) also holds through solutions: while the account has delivery debt, an active
    // solution may not put a department New Era does not work with yet (not in use, not engaged) in use
    const others = accountDeployments(account.id).filter((d) => d.id !== id);
    const before = usingDepartments(existing ? [...others, existing] : others);
    const after = usingDepartments([...others, { ...fields }]);
    const stored = new Map(accountDepartmentRows(account.id).map((r) => [r.department, r.status]));
    const newDepartments = DEPARTMENT_KEYS.filter((k) => after.has(k) && !before.has(k) && stored.get(k) !== 'engaged');
    const debt = crRollupFor(account.id).debt;
    const reason = text(input.override_reason);
    const gated = newDepartments.length > 0 && debt > 0;
    if (gated && !(v.role === 'director' && reason)) {
      throw new ApiError('conflict', 'errors.care.expansionBlocked', { count: debt, departments: newDepartments });
    }

    db.batch(() => {
      if (gated) {
        for (const k of newDepartments) {
          logActivity({
            account_id: account.id,
            actor_id: v.user.id,
            action: 'department.gate_overridden',
            target_type: 'department',
            target_id: `dept_${account.id}_${k}`,
            params: { department_label: departmentLabel(k), count: debt, reason: reason.slice(0, MAX_NOTE) },
            visibility: 'internal',
          });
        }
      }
      if (existing) {
        const next: Deployment = { ...existing, ...fields, updated_at: at };
        const changed = changedKeys(existing, next, Object.keys(fields) as (keyof Deployment)[]);
        if (changed.length === 0) return;
        db.update('deployments', id, { ...fields, updated_at: at });
        logActivity({
          account_id: account.id,
          actor_id: v.user.id,
          action: 'deployment.updated',
          target_type: 'deployment',
          target_id: id,
          params: { deployment: fields.name, fields: fieldList('deployment', changed) },
          visibility: 'internal',
        });
        return;
      }
      db.insert('deployments', { id, account_id: account.id, ...fields, created_at: at, updated_at: at, deleted_at: null });
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'deployment.created',
        target_type: 'deployment',
        target_id: id,
        params: { deployment: fields.name, category_label: t(`care.category.${fields.category}`) },
        visibility: 'internal',
      });
    });
    return deploymentView(db.get('deployments', id), v);
  },

  async deleteDeployment(id) {
    const v = internalWriter();
    const d = db.find('deployments', id);
    if (!d) throw notFound();
    loadAccount(d.account_id, v);
    assertManagerOf(v, d.account_id);
    db.batch(() => {
      db.softDelete('deployments', d.id, nowISO());
      logActivity({
        account_id: d.account_id,
        actor_id: v.user.id,
        action: 'deployment.deleted',
        target_type: 'deployment',
        target_id: d.id,
        params: { deployment: d.name },
        visibility: 'internal',
      });
    });
  },

  async saveDepartment(input) {
    const v = internalWriter();
    if (!input || typeof input !== 'object') throw invalid();
    const account = loadAccount(input.account_id, v);
    assertManagerOf(v, account.id);
    const department = oneOf(input.department, DEPARTMENT_KEYS);
    const status = oneOf(input.status, DEPARTMENT_STATUSES);
    const existing = db.rows('account_departments').find((r) => r.account_id === account.id && r.department === department);
    const pick = <K extends keyof AccountDepartment>(key: K, value: AccountDepartment[K] | undefined, fallback: AccountDepartment[K]): AccountDepartment[K] =>
      value === undefined ? (existing ? existing[key] : fallback) : value;
    const at = nowISO();
    const row: AccountDepartment = {
      id: existing ? existing.id : `dept_${account.id}_${department}`,
      account_id: account.id,
      department,
      status,
      need_note: pick('need_note', input.need_note === undefined ? undefined : optText(input.need_note), null),
      opportunity_note: pick('opportunity_note', input.opportunity_note === undefined ? undefined : optText(input.opportunity_note), null),
      opportunity_category: pick(
        'opportunity_category',
        input.opportunity_category === undefined ? undefined : input.opportunity_category === null ? null : oneOf(input.opportunity_category, SOLUTION_CATEGORIES),
        null,
      ),
      est_value: pick('est_value', input.est_value === undefined ? undefined : optAmount(input.est_value), null),
      contact_id: pick('contact_id', input.contact_id === undefined ? undefined : contactOf(account.id, input.contact_id), null),
      ne_owner_id: pick('ne_owner_id', input.ne_owner_id === undefined ? undefined : optInternalUser(input.ne_owner_id), null),
      next_step: pick('next_step', input.next_step === undefined ? undefined : optText(input.next_step, 300), null),
      next_step_due: pick('next_step_due', input.next_step_due === undefined ? undefined : optDate(input.next_step_due), null),
      updated_at: at,
    };

    // the expansion gate: delivery debt must reach 0 before moving into a department New Era does not work with yet
    const deployments = accountDeployments(account.id);
    const from = usingDepartments(deployments).has(department) ? 'using' : existing ? existing.status : null;
    const debt = crRollupFor(account.id).debt;
    const reason = text(input.override_reason);
    const gated = isExpansionMove(from, status) && debt > 0;
    if (gated && !(v.role === 'director' && reason)) throw new ApiError('conflict', 'errors.care.expansionBlocked', { count: debt });

    db.batch(() => {
      if (existing) db.update('account_departments', existing.id, row);
      else db.insert('account_departments', row);
      const label = departmentLabel(department);
      if (gated) {
        logActivity({
          account_id: account.id,
          actor_id: v.user.id,
          action: 'department.gate_overridden',
          target_type: 'department',
          target_id: row.id,
          params: { department_label: label, count: debt, reason: reason.slice(0, MAX_NOTE) },
          visibility: 'internal',
        });
      }
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'department.updated',
        target_type: 'department',
        target_id: row.id,
        params: { department_label: label, status_label: t(`care.departmentStatus.${status}`) },
        visibility: 'internal',
      });
    });
    invalidateCareCache();
    return departmentView(db.get('account_departments', row.id), accountDeployments(account.id));
  },

  async saveStakeholder(input) {
    const v = internalWriter();
    if (!input || typeof input !== 'object') throw invalid();
    const contact = typeof input.contact_id === 'string' ? db.find('contacts', input.contact_id) : undefined;
    if (!contact) throw notFound();
    loadAccount(contact.account_id, v);
    assertManagerOf(v, contact.account_id);
    const base = stakeholderOf(contact).row;
    const reportsTo = input.reports_to_contact_id === undefined ? base.reports_to_contact_id : contactOf(contact.account_id, input.reports_to_contact_id);
    if (reportsTo === contact.id) throw invalid('errors.care.reportsToCycle');
    // no loop in the reporting line: walk up from the new manager
    const seen = new Set<ID>([contact.id]);
    let cursor: ID | null = reportsTo;
    while (cursor) {
      if (seen.has(cursor)) throw invalid('errors.care.reportsToCycle');
      seen.add(cursor);
      cursor = storedStakeholder(cursor)?.reports_to_contact_id ?? null;
    }
    const next: Stakeholder = {
      ...base,
      department: input.department === undefined ? base.department : input.department === null ? null : oneOf(input.department, DEPARTMENT_KEYS),
      influence: input.influence === undefined ? base.influence : oneOf(input.influence, INFLUENCES),
      stance: input.stance === undefined ? base.stance : oneOf(input.stance, STANCES),
      strength: input.strength === undefined ? base.strength : oneOf(input.strength, STRENGTHS),
      ne_owner_id: input.ne_owner_id === undefined ? base.ne_owner_id : optInternalUser(input.ne_owner_id),
      reports_to_contact_id: reportsTo,
      notes: input.notes === undefined ? base.notes : optText(input.notes),
      updated_at: nowISO(),
    };
    const stored = storedStakeholder(contact.id);
    db.batch(() => {
      if (stored) db.update('stakeholders', stored.id, next);
      else db.insert('stakeholders', next);
      logActivity({
        account_id: contact.account_id,
        actor_id: v.user.id,
        action: 'stakeholder.updated',
        target_type: 'stakeholder',
        target_id: next.id,
        params: { name: contact.full_name },
        visibility: 'internal',
      });
    });
    return stakeholderView(db.get('contacts', contact.id));
  },

  async saveRelationLink(input) {
    const v = internalWriter();
    if (!isCareManagerViewer(v)) throw forbidden();
    if (!input || typeof input !== 'object') throw invalid();
    const kind = oneOf(input.kind, RELATION_KINDS);
    const from = typeof input.from_contact_id === 'string' ? db.find('contacts', input.from_contact_id) : undefined;
    const to = typeof input.to_contact_id === 'string' ? db.find('contacts', input.to_contact_id) : undefined;
    if (!from || !to) throw notFound();
    if (from.id === to.id) throw invalid('errors.care.relationSelf');
    if (!sameAccountOrGroup(from.account_id, to.account_id)) throw invalid('errors.care.relationScope');
    if (!isManagerOf(v, from.account_id) && !isManagerOf(v, to.account_id)) throw forbidden();
    // one link per pair and kind: saving the same link again (a double click, the AM of the other unit) updates it.
    // "works with" / "former colleague" read the same both ways; "introduced" / "reports to" have a direction.
    const symmetric = kind === 'works_with' || kind === 'former_colleague';
    const twin = db
      .rows('relation_links')
      .find(
        (l) =>
          l.id !== input.id &&
          l.kind === kind &&
          ((l.from_contact_id === from.id && l.to_contact_id === to.id) || (symmetric && l.from_contact_id === to.id && l.to_contact_id === from.id)),
      );
    if (input.id && twin) throw new ApiError('conflict', 'errors.care.relationExists');
    const existing = input.id ? db.find('relation_links', input.id) : twin;
    if (input.id && !existing) throw notFound();
    if (existing) {
      const oldFrom = db.find('contacts', existing.from_contact_id);
      const oldTo = db.find('contacts', existing.to_contact_id);
      if (!(oldFrom && isManagerOf(v, oldFrom.account_id)) && !(oldTo && isManagerOf(v, oldTo.account_id))) throw forbidden();
    }
    const row: RelationLink = {
      id: existing ? existing.id : newId('rel'),
      from_contact_id: from.id,
      to_contact_id: to.id,
      kind,
      note: optText(input.note, 400),
      created_at: existing ? existing.created_at : nowISO(),
    };
    const logAccount = isManagerOf(v, from.account_id) ? from.account_id : to.account_id;
    db.batch(() => {
      if (existing) db.update('relation_links', row.id, row);
      else db.insert('relation_links', row);
      logActivity({
        account_id: logAccount,
        actor_id: v.user.id,
        action: 'relation.saved',
        target_type: 'relation',
        target_id: row.id,
        params: { from: from.full_name, to: to.full_name, kind_label: t(`care.relationKind.${kind}`) },
        visibility: 'internal',
      });
    });
    const view = relationView(db.get('relation_links', row.id), v);
    if (!view) throw invalid('errors.care.relationScope');
    return view;
  },

  async deleteRelationLink(id) {
    const v = internalWriter();
    if (!isCareManagerViewer(v)) throw forbidden();
    const link = db.find('relation_links', id);
    if (!link) throw notFound();
    const from = db.find('contacts', link.from_contact_id);
    const to = db.find('contacts', link.to_contact_id);
    const managed = [from, to].find((c) => c && isManagerOf(v, c.account_id));
    if (!managed) throw forbidden();
    db.batch(() => {
      db.hardDelete('relation_links', link.id);
      logActivity({
        account_id: managed.account_id,
        actor_id: v.user.id,
        action: 'relation.deleted',
        target_type: 'relation',
        target_id: link.id,
        params: { from: from?.full_name ?? '', to: to?.full_name ?? '' },
        visibility: 'internal',
      });
    });
  },

  async saveCarePlan(accountId, input) {
    const v = internalWriter();
    const account = loadAccount(accountId, v);
    assertManagerOf(v, account.id);
    if (!input || typeof input !== 'object') throw invalid();
    const current = careStatusFor(account).plan;
    let cadence = current.cadence_days;
    if (input.cadence_days !== undefined) {
      const n = Number(input.cadence_days);
      if (!Number.isInteger(n) || n < MIN_CADENCE_DAYS || n > MAX_CADENCE_DAYS) throw invalid('errors.care.cadenceRange');
      cadence = n;
    }
    const next = {
      ...current,
      cadence_days: cadence,
      next_action: input.next_action === undefined ? current.next_action : optText(input.next_action, 300),
      next_action_due: input.next_action_due === undefined ? current.next_action_due : optDate(input.next_action_due),
      next_action_owner_id: input.next_action_owner_id === undefined ? current.next_action_owner_id : optInternalUser(input.next_action_owner_id),
      updated_at: nowISO(),
    };
    const stored = storedCarePlan(account.id);
    const changed = changedKeys(current, next, ['cadence_days', 'next_action', 'next_action_due', 'next_action_owner_id']);
    db.batch(() => {
      if (stored) db.update('care_plans', stored.id, next);
      else db.insert('care_plans', next);
      if (changed.length > 0) {
        logActivity({
          account_id: account.id,
          actor_id: v.user.id,
          action: 'care_plan.updated',
          target_type: 'care_plan',
          target_id: next.id,
          params: { fields: fieldList('care_plan', changed) },
          visibility: 'internal',
        });
      }
    });
    return carePlanView(db.get('accounts', account.id));
  },

  // ── change requests (internal)

  async listChangeRequests(filter) {
    const v = internalReader();
    const f = filter ?? {};
    const today = todayISO();
    const readable = accessibleAccountIds(v);
    let accountIds: ID[];
    if (f.accountId) {
      loadAccount(f.accountId, v);
      accountIds = [f.accountId];
    } else {
      accountIds = [...readable];
    }
    if (f.projectId) {
      const p = db.find('projects', f.projectId);
      if (!p) throw notFound();
      if (!readable.has(p.account_id)) throw forbidden();
    }
    const statuses = Array.isArray(f.status) && f.status.length > 0 ? new Set<CrStatus>(f.status.filter((s) => CR_STATUSES.includes(s))) : null;
    const list: ChangeRequest[] = [];
    for (const id of accountIds) {
      for (const cr of accountCrs(id)) {
        if (f.projectId && cr.project_id !== f.projectId) continue;
        if (statuses && !statuses.has(cr.status)) continue;
        if (f.flag === 'untriaged' && !isUntriaged(cr, today)) continue;
        if (f.flag === 'debt' && !isDeliveryDebt(cr, today)) continue;
        list.push(cr);
      }
    }
    return list.sort((a, b) => compareCrs(a, b, today)).map((cr) => crView(cr, v, today));
  },

  async createChangeRequest(input) {
    const v = internalWriter();
    if (!input || typeof input !== 'object') throw invalid();
    const account = loadAccount(input.account_id, v);
    const source = oneOf(input.source, CR_SOURCES);
    if (source === 'client_portal') throw invalid();
    const title = text(input.title);
    if (!title) throw invalid('errors.care.titleRequired');
    const at = nowISO();
    const row: ChangeRequest = {
      id: newId('cr'),
      code: nextCode(account.id, source),
      account_id: account.id,
      project_id: projectOf(account.id, input.project_id),
      deployment_id: deploymentOf(account.id, input.deployment_id),
      title: title.slice(0, MAX_TITLE),
      description: optText(input.description, MAX_TEXT) ?? '',
      source,
      requested_by_contact_id: contactOf(account.id, input.requested_by_contact_id),
      requested_by_user_id: null,
      received_at: receivedAt(input.received_at),
      status: 'new',
      priority: input.priority === undefined ? 'normal' : oneOf(input.priority, CR_PRIORITIES),
      triaged_at: null,
      owner_id: optInternalUser(input.owner_id),
      promised_date: optDate(input.promised_date),
      plan_ref: optText(input.plan_ref, 120),
      task_id: taskOf(account.id, input.task_id),
      client_note: optText(input.client_note),
      internal_note: optText(input.internal_note),
      decline_reason: null,
      done_at: null,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    };
    // only the director / the account's AM hand a request to someone else (same rule as updateChangeRequest)
    if (row.owner_id && row.owner_id !== v.user.id && !isManagerOf(v, account.id)) throw forbidden();
    // New Era's own proposals stay internal: nobody on the client side asked, so nobody is named or told
    if (source === 'internal') row.requested_by_contact_id = null;
    const contact = row.requested_by_contact_id ? db.find('contacts', row.requested_by_contact_id) : undefined;
    if (contact?.user_id) row.requested_by_user_id = contact.user_id;
    db.batch(() => {
      db.insert('change_requests', row);
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'change_request.created',
        target_type: 'change_request',
        target_id: row.id,
        params: crParams(row),
        // a request the client asked for (meeting, email, chat) shows in their updates; New Era's own ideas do not
        visibility: source === 'internal' ? 'internal' : 'shared',
      });
    });
    return crView(db.get('change_requests', row.id), v);
  },

  async updateChangeRequest(id, patch) {
    const v = internalWriter();
    const cr = loadCr(id, v);
    if (!canUpdateCr(cr, v)) throw forbidden();
    if (!patch || typeof patch !== 'object') throw invalid();
    const p: ChangeRequestPatch = patch;
    const next: ChangeRequest = { ...cr };
    if (p.status !== undefined) next.status = oneOf(p.status, CR_STATUSES);
    if (p.priority !== undefined) next.priority = oneOf(p.priority, CR_PRIORITIES);
    if (p.owner_id !== undefined) {
      next.owner_id = optInternalUser(p.owner_id);
      if (next.owner_id !== cr.owner_id && !isManagerOf(v, cr.account_id)) throw forbidden();
    }
    if (p.promised_date !== undefined) next.promised_date = optDate(p.promised_date);
    if (p.plan_ref !== undefined) next.plan_ref = optText(p.plan_ref, 120);
    if (p.task_id !== undefined) next.task_id = taskOf(cr.account_id, p.task_id);
    if (p.client_note !== undefined) next.client_note = optText(p.client_note);
    if (p.internal_note !== undefined) next.internal_note = optText(p.internal_note);
    if (p.decline_reason !== undefined) next.decline_reason = optText(p.decline_reason);
    if (p.title !== undefined) {
      const title = text(p.title);
      if (!title) throw invalid('errors.care.titleRequired');
      next.title = title.slice(0, MAX_TITLE);
    }
    if (p.description !== undefined) next.description = optText(p.description, MAX_TEXT) ?? '';
    if (p.project_id !== undefined) next.project_id = projectOf(cr.account_id, p.project_id);
    if (p.deployment_id !== undefined) next.deployment_id = deploymentOf(cr.account_id, p.deployment_id);

    // status rules (SPEC-CARE §4): planned needs a promised date, declined a reason the client can read; a request New
    // Era has taken in never goes back to 'new' (it would read "chờ tiếp nhận" with a promise already made) — reopen
    // it as 'triaged' instead
    if (next.status === 'new' && cr.status !== 'new') throw invalid('errors.care.cannotReopenAsNew');
    if (next.status === 'planned' && !next.promised_date) throw invalid('errors.care.plannedNeedsDate');
    if (next.status === 'declined' && !next.decline_reason) throw invalid('errors.care.declineReasonRequired');
    const at = nowISO();
    const statusChanged = next.status !== cr.status;
    if (statusChanged) {
      if (cr.status === 'new' && !next.triaged_at) next.triaged_at = at;
      next.done_at = next.status === 'done' ? (cr.status === 'done' ? cr.done_at : at) : null;
      if (cr.status === 'declined' && next.status !== 'declined' && p.decline_reason === undefined) next.decline_reason = null;
    }
    const changed = changedKeys(cr, next, CR_PATCH_KEYS);
    if (!statusChanged && changed.length === 0) return crView(cr, v);
    next.updated_at = at;

    // New Era's own proposals (source 'internal') stay internal end to end: no client line, no client notice
    const clientFacing = next.source !== 'internal';
    const shared = clientFacing ? 'shared' : 'internal';
    // the client is told when the date they were promised moves (open request, status unchanged)
    const rescheduled =
      clientFacing && !statusChanged && (next.status === 'planned' || next.status === 'in_progress') && !!next.promised_date && next.promised_date !== cr.promised_date;

    db.batch(() => {
      db.update('change_requests', cr.id, next);
      const params = crParams(next);
      if (statusChanged && cr.status === 'new') {
        logActivity({ account_id: cr.account_id, actor_id: v.user.id, action: 'change_request.triaged', target_type: 'change_request', target_id: cr.id, params, visibility: shared });
      }
      if (statusChanged && !(cr.status === 'new' && next.status === 'triaged')) {
        logActivity({
          account_id: cr.account_id,
          actor_id: v.user.id,
          action: 'change_request.status_changed',
          target_type: 'change_request',
          target_id: cr.id,
          params: { ...params, status_label: t(`care.crStatusClient.${next.status}`) },
          visibility: shared,
        });
      }
      if (rescheduled && next.promised_date) {
        logActivity({
          account_id: cr.account_id,
          actor_id: v.user.id,
          action: 'change_request.rescheduled',
          target_type: 'change_request',
          target_id: cr.id,
          params: { ...params, date: fmtDate(next.promised_date) },
          visibility: 'shared',
        });
      }
      const other = changed.filter((k) => (k !== 'decline_reason' || !statusChanged) && (k !== 'promised_date' || !rescheduled));
      if (other.length > 0) {
        logActivity({
          account_id: cr.account_id,
          actor_id: v.user.id,
          action: 'change_request.updated',
          target_type: 'change_request',
          target_id: cr.id,
          params: { ...params, fields: fieldList('change_request', other) },
          visibility: 'internal',
        });
      }
      if (clientFacing) {
        if (statusChanged && next.status === 'planned') notifyRequestEvent('planned', cr.id, v.user.id, { note: next.client_note });
        if (statusChanged && next.status === 'done') notifyRequestEvent('done', cr.id, v.user.id, { note: next.client_note });
        if (statusChanged && next.status === 'declined') notifyRequestEvent('declined', cr.id, v.user.id, { note: next.decline_reason });
        // the note goes along only when it was written with the new date (an old note would answer another question)
        if (rescheduled) notifyRequestEvent('rescheduled', cr.id, v.user.id, { note: next.client_note !== cr.client_note ? next.client_note : null });
      }
    });
    return crView(db.get('change_requests', cr.id), v);
  },

  // ── client portal

  async listMyRequests() {
    const v = clientReader();
    const accountId = v.account_id as ID;
    const today = todayISO();
    // open first — a late promise on top, then the soonest promised date (no date last), then the newest; then the
    // handled ones, newest first. New Era's own proposals (source 'internal') are not the client's requests.
    const late = (cr: ChangeRequest): number => (isOpenCr(cr.status) && !!cr.promised_date && cr.promised_date < today ? 0 : 1);
    const list = accountCrs(accountId)
      .filter((cr) => cr.source !== 'internal')
      .sort(
        (a, b) =>
          Number(isOpenCr(b.status)) - Number(isOpenCr(a.status)) ||
          (isOpenCr(a.status) ? late(a) - late(b) || (a.promised_date ?? '9999').localeCompare(b.promised_date ?? '9999') : 0) ||
          b.received_at.localeCompare(a.received_at) ||
          b.code.localeCompare(a.code),
      );
    return list.map((cr): ClientChangeRequestView => clientCrView(cr, v));
  },

  async submitRequest(input) {
    const v = requireViewer();
    if (v.org_type !== 'client' || !v.account_id) throw forbidden();
    assertWritable(v);
    if (v.role !== 'client_owner' && v.role !== 'client_member') throw forbidden();
    if (!input || typeof input !== 'object') throw invalid();
    const accountId = v.account_id;
    const title = text(input.title);
    if (!title) throw invalid('errors.care.titleRequired');
    const project = input.project_id ? db.find('projects', input.project_id) : undefined;
    // another company's project answers like an unknown id (no id probing)
    if (input.project_id && (!project || project.account_id !== accountId)) throw notFound();
    const at = nowISO();
    const contact = db.rows('contacts').find((c) => c.account_id === accountId && c.user_id === v.user.id);
    const row: ChangeRequest = {
      id: newId('cr'),
      code: nextCode(accountId, 'client_portal'),
      account_id: accountId,
      project_id: project ? project.id : null,
      deployment_id: null,
      title: title.slice(0, MAX_TITLE),
      description: optText(input.description, MAX_TEXT) ?? '',
      source: 'client_portal',
      requested_by_contact_id: contact ? contact.id : null,
      requested_by_user_id: v.user.id,
      received_at: at,
      status: 'new',
      priority: input.priority ? oneOf(input.priority, CR_PRIORITIES) : 'normal',
      triaged_at: null,
      owner_id: null,
      promised_date: null,
      plan_ref: null,
      task_id: null,
      client_note: null,
      internal_note: null,
      decline_reason: null,
      done_at: null,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    };
    db.batch(() => {
      db.insert('change_requests', row);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'change_request.submitted',
        target_type: 'change_request',
        target_id: row.id,
        params: crParams(row),
        visibility: 'shared',
      });
      notifyRequestEvent('submitted', row.id, v.user.id, { note: row.description });
    });
    return clientCrView(db.get('change_requests', row.id), v);
  },

  async listClientDeployments() {
    const v = clientReader();
    return accountDeployments(v.account_id as ID)
      .map(clientDeploymentView)
      .filter((d): d is NonNullable<typeof d> => d !== null);
  },

  // ── groups

  async getGroupMatrix(ecosystemId) {
    const v = managerReader();
    const matrix = typeof ecosystemId === 'string' ? groupMatrix(ecosystemId, v) : null;
    if (!matrix) throw new ApiError('not_found', 'errors.care.noGroup');
    // an AM reads a group only through one of her companies
    if (v.role !== 'director' && matrix.units.length === 0) throw forbidden();
    return matrix;
  },
};
