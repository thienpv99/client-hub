// Client care: memoized per-account indexes over the care tables + derived facts (roll-up, last touch, care status,
// expansion) shared by the DTO builders (careViews.ts) and the API (api/care.ts). Rebuilt when db.version or the
// day changes — service code that writes inside a batch and reads again in the same batch calls invalidateCareCache().

import type { Account, Contact, ID, ISODate, ISODateTime } from '@/domain/types';
import type { Ecosystem } from '@/domain/crmTypes';
import type { AccountDepartment, CarePlan, ChangeRequest, Deployment, RelationLink, Stakeholder } from '@/domain/careTypes';
import { todayISO } from '@/domain/clock';
import {
  careStatus,
  coverage,
  crRollup,
  defaultCadence,
  expansionBlocked,
  latestTouch,
  type CareStatusInfo,
  type Coverage,
  type CrRollup,
} from '@/domain/care';
import { accountInteractions, profileOf } from './crmViews';
import { db } from './db';

interface CareIndex {
  key: string;
  deployments: Map<ID, Deployment[]>;
  departments: Map<ID, AccountDepartment[]>;
  stakeholders: Map<ID, Stakeholder>;
  crs: Map<ID, ChangeRequest[]>;
  plans: Map<ID, CarePlan>;
  contacts: Map<ID, Contact[]>;
  /** contact id → latest interaction naming the contact */
  contactTouch: Map<ID, ISODateTime>;
  /** account id → latest client decision on what New Era sent (CLIENT_DECISION_ACTIONS) */
  sharedTouch: Map<ID, ISODateTime>;
  lastTouch: Map<ID, ISODateTime | null>;
  rollups: Map<ID, CrRollup>;
}

let index: CareIndex | null = null;
let generation = 0;

/** drop the memoized indexes (call after writes made inside the current batch, before reading again) */
export function invalidateCareCache(): void {
  generation += 1;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function later(map: Map<ID, ISODateTime>, key: ID, at: ISODateTime | null | undefined): void {
  if (!at) return;
  const prev = map.get(key);
  if (!prev || at > prev) map.set(key, at);
}

/** shared client actions that answer New Era (they count as a care touch); see accountLastTouch */
export const CLIENT_DECISION_ACTIONS: ReadonlySet<string> = new Set<string>([
  'task.approved',
  'task.changes_requested',
  'task.answered',
  'task.confirmed',
  'task.signed_submitted',
  'quote.accepted',
  'quote.changes_requested',
]);

function idx(): CareIndex {
  const key = `${db.version}|${generation}|${todayISO()}`;
  if (index && index.key === key) return index;
  const next: CareIndex = {
    key,
    deployments: new Map(),
    departments: new Map(),
    stakeholders: new Map(),
    crs: new Map(),
    plans: new Map(),
    contacts: new Map(),
    contactTouch: new Map(),
    sharedTouch: new Map(),
    lastTouch: new Map(),
    rollups: new Map(),
  };
  for (const d of db.rows('deployments')) push(next.deployments, d.account_id, d);
  for (const d of db.rows('account_departments')) push(next.departments, d.account_id, d);
  for (const s of db.rows('stakeholders')) next.stakeholders.set(s.contact_id, s);
  for (const cr of db.rows('change_requests')) push(next.crs, cr.account_id, cr);
  for (const p of db.rows('care_plans')) next.plans.set(p.account_id, p);
  for (const c of db.rows('contacts')) push(next.contacts, c.account_id, c);
  // an internal note is not a touch with the client (SPEC-CARE §3: care = New Era reaching out)
  for (const i of db.rows('interactions')) if (i.contact_id && i.kind !== 'note') later(next.contactTouch, i.contact_id, i.occurred_at);
  // the client's decisions on what New Era sent (approvals, answers, confirmations) are two-way touches; the client's
  // own requests, uploads and delegations are not — a client who complains must not reset the care clock
  const clientUsers = new Set(db.rows('users').filter((u) => u.org_type === 'client').map((u) => u.id));
  for (const a of db.rows('activities')) {
    if (!a.account_id || a.visibility !== 'shared' || !a.actor_id || !clientUsers.has(a.actor_id)) continue;
    if (CLIENT_DECISION_ACTIONS.has(a.action)) later(next.sharedTouch, a.account_id, a.created_at);
  }
  for (const list of next.deployments.values()) list.sort((a, b) => statusRank(a) - statusRank(b) || a.name.localeCompare(b.name, 'vi'));
  index = next;
  return next;
}

const DEPLOYMENT_RANK: Record<Deployment['status'], number> = { live: 0, rolling_out: 1, pilot: 2, paused: 3, retired: 4 };
function statusRank(d: Deployment): number {
  return DEPLOYMENT_RANK[d.status] ?? 9;
}

// ───────────────────────────── per-account rows ─────────────────────────────

/** live deployments of an account (retired included), live → rolling out → pilot → paused → retired, then name */
export const accountDeployments = (accountId: ID): Deployment[] => idx().deployments.get(accountId) ?? [];
/** expansion-map rows of an account */
export const accountDepartmentRows = (accountId: ID): AccountDepartment[] => idx().departments.get(accountId) ?? [];
export const accountCrs = (accountId: ID): ChangeRequest[] => idx().crs.get(accountId) ?? [];
export const accountContacts = (accountId: ID): Contact[] => idx().contacts.get(accountId) ?? [];
export const storedStakeholder = (contactId: ID): Stakeholder | undefined => idx().stakeholders.get(contactId);
export const storedCarePlan = (accountId: ID): CarePlan | undefined => idx().plans.get(accountId);

export function crRollupFor(accountId: ID, today: ISODate = todayISO()): CrRollup {
  const ix = idx();
  let r = ix.rollups.get(accountId);
  if (!r) {
    r = crRollup(accountCrs(accountId), today);
    ix.rollups.set(accountId, r);
  }
  return r;
}

export function coverageFor(accountId: ID): Coverage {
  return coverage(accountDepartmentRows(accountId), accountDeployments(accountId));
}

export function isExpansionBlocked(accountId: ID): boolean {
  return expansionBlocked(crRollupFor(accountId));
}

// ───────────────────────────── touches & care ─────────────────────────────

/** latest touch with one person: the contact's interaction log and the interactions naming them */
export function contactLastTouch(c: Contact): ISODateTime | null {
  return latestTouch([c.last_interaction_at, idx().contactTouch.get(c.id)]);
}

/**
 * Latest touch with the account (SPEC-CARE §3): its interactions logged by New Era (an internal note is not a touch),
 * its contacts' last_interaction_at (the contact log New Era keeps) and the client's decisions on what New Era sent
 * (CLIENT_DECISION_ACTIONS: approvals, answers, confirmations). The client's own requests, uploads, delegations and
 * task comments do not count — they are activity, not care.
 */
export function accountLastTouch(accountId: ID): ISODateTime | null {
  const ix = idx();
  if (ix.lastTouch.has(accountId)) return ix.lastTouch.get(accountId) ?? null;
  const interactions = accountInteractions(accountId);
  const value = latestTouch([
    interactions.find((i) => i.kind !== 'note')?.occurred_at,
    ...accountContacts(accountId).map((c) => c.last_interaction_at),
    ix.sharedTouch.get(accountId),
  ]);
  ix.lastTouch.set(accountId, value);
  return value;
}

/** the stored care plan, or the tier's defaults (never stored until someone saves it) */
export function carePlanOf(account: Account): { plan: CarePlan; stored: boolean } {
  const stored = storedCarePlan(account.id);
  if (stored) return { plan: stored, stored: true };
  return {
    plan: {
      id: `care_${account.id}`,
      account_id: account.id,
      cadence_days: defaultCadence(account.tier),
      next_action: null,
      next_action_due: null,
      next_action_owner_id: null,
      updated_at: account.created_at,
    },
    stored: false,
  };
}

export function careStatusFor(account: Account, today: ISODate = todayISO()): CareStatusInfo & { last_touch_at: ISODateTime | null; plan: CarePlan; stored: boolean } {
  const { plan, stored } = carePlanOf(account);
  const last = accountLastTouch(account.id);
  return { ...careStatus({ last_touch_at: last, cadence_days: plan.cadence_days, next_action_due: plan.next_action_due, today }), last_touch_at: last, plan, stored };
}

// ───────────────────────────── groups ─────────────────────────────

export function ecosystemIdOf(accountId: ID): ID | null {
  return profileOf(accountId).ecosystem_id ?? null;
}

export function ecosystemOf(accountId: ID): Ecosystem | null {
  const id = ecosystemIdOf(accountId);
  return id ? db.find('ecosystems', id) ?? null : null;
}

/** member accounts of a group (live accounts whose profile points to it) */
export function ecosystemAccounts(ecosystemId: ID): Account[] {
  return db.rows('accounts').filter((a) => ecosystemIdOf(a.id) === ecosystemId);
}

/** two accounts may be linked by a relation: the same account, or two members of one business group */
export function sameAccountOrGroup(a: ID, b: ID): boolean {
  if (a === b) return true;
  const ea = ecosystemIdOf(a);
  return ea !== null && ea === ecosystemIdOf(b);
}

/** relation links touching an account's contacts */
export function accountRelationLinks(accountId: ID): RelationLink[] {
  const mine = new Set(accountContacts(accountId).map((c) => c.id));
  return db.rows('relation_links').filter((l) => mine.has(l.from_contact_id) || mine.has(l.to_contact_id));
}
