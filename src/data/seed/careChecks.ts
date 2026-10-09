// Seed checks of the client care tables (SPEC-CARE §7): referential integrity of every new table, the business rules
// a stored row must respect, and the demo stories (Cỏ Xanh blocked by delivery debt, Thịnh An with requests waiting
// more than 7 days, Mây Trắng healthy with priced room to expand, 2–3 accounts overdue for care, cross-unit links in
// every group). Called by checkSeed (seedChecks.ts); also run by the 'care' self-test suite.

import type { ID, ISODate } from '@/domain/types';
import type { DbData } from '@/services/db';
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
import { crRollup, hasOpportunity, MAX_CADENCE_DAYS, MIN_CADENCE_DAYS } from '@/domain/care';
import { isValidISODate } from '@/domain/dates';
import { ORIGINAL_ACCOUNT_IDS, PROSPECT_ACCOUNT_IDS } from './crmAccounts';

type Seed = Omit<DbData, 'meta'>;

export function checkCare(data: Seed, today: ISODate): string[] {
  const errors: string[] = [];
  const expect = (cond: unknown, m: string): void => {
    if (!cond) errors.push(m);
  };
  const by = <T extends { id: ID }>(rows: T[] | undefined): Map<ID, T> => new Map((rows ?? []).map((r) => [r.id, r]));
  const accounts = by(data.accounts);
  const users = by(data.users);
  const contacts = by(data.contacts);
  const projects = by(data.projects);
  const tasks = by(data.tasks);
  const deploymentsById = by(data.deployments);
  const ecoOf = new Map<ID, ID | null>((data.account_profiles ?? []).map((p) => [p.account_id, p.ecosystem_id ?? null]));
  const internal = (id: ID | null | undefined): boolean => !!id && users.get(id)?.org_type === 'internal';
  const okDate = (d: string | null): boolean => d === null || isValidISODate(d);
  const sameGroup = (a: ID, b: ID): boolean => a === b || (!!ecoOf.get(a) && ecoOf.get(a) === ecoOf.get(b));

  const deployments = data.deployments ?? [];
  const departments = data.account_departments ?? [];
  const stakeholders = data.stakeholders ?? [];
  const links = data.relation_links ?? [];
  const crs = data.change_requests ?? [];
  const plans = data.care_plans ?? [];

  // ── deployments
  for (const d of deployments) {
    const w = `deployments/${d.id}`;
    expect(accounts.has(d.account_id), `${w}: account missing`);
    if (d.project_id) expect(projects.get(d.project_id)?.account_id === d.account_id, `${w}: project of another account`);
    expect(SOLUTION_CATEGORIES.includes(d.category) && DEPLOYMENT_STATUSES.includes(d.status), `${w}: category / status`);
    expect(d.departments.every((k) => DEPARTMENT_KEYS.includes(k)) && new Set(d.departments).size === d.departments.length, `${w}: departments`);
    expect(d.adoption === null || ADOPTIONS.includes(d.adoption), `${w}: adoption`);
    expect(okDate(d.go_live_date), `${w}: go_live_date`);
    expect(d.contract_value === null || d.contract_value >= 0, `${w}: contract_value`);
    expect(internal(d.owner_id), `${w}: owner must be New Era`);
    expect(d.name.trim() && d.summary.trim(), `${w}: name and summary`);
  }
  for (const id of ORIGINAL_ACCOUNT_IDS) {
    const n = deployments.filter((d) => d.account_id === id).length;
    expect(n >= 1 && n <= 4, `account ${id}: 1–4 deployments (has ${n})`);
  }
  for (const id of PROSPECT_ACCOUNT_IDS) {
    const n = deployments.filter((d) => d.account_id === id).length;
    expect(n <= 1, `account ${id}: prospects get 0–1 deployments (has ${n})`);
  }

  // ── expansion maps
  const deptKeys = new Set<string>();
  for (const r of departments) {
    const w = `account_departments/${r.id}`;
    expect(accounts.has(r.account_id), `${w}: account missing`);
    expect(r.id === `dept_${r.account_id}_${r.department}`, `${w}: id must be dept_<account>_<department>`);
    const key = `${r.account_id}:${r.department}`;
    expect(!deptKeys.has(key), `${w}: department twice on the map`);
    deptKeys.add(key);
    expect(DEPARTMENT_KEYS.includes(r.department) && DEPARTMENT_STATUSES.includes(r.status), `${w}: department / status`);
    expect(r.opportunity_category === null || SOLUTION_CATEGORIES.includes(r.opportunity_category), `${w}: opportunity_category`);
    expect(r.est_value === null || r.est_value >= 0, `${w}: est_value`);
    if (r.contact_id) expect(contacts.get(r.contact_id)?.account_id === r.account_id, `${w}: contact of another account`);
    if (r.ne_owner_id) expect(internal(r.ne_owner_id), `${w}: ne_owner must be New Era`);
    expect(okDate(r.next_step_due), `${w}: next_step_due`);
    if (hasOpportunity(r)) expect(r.opportunity_category !== null, `${w}: an opportunity needs its solution category (group matrix column)`);
  }
  for (const a of data.accounts) {
    const n = departments.filter((r) => r.account_id === a.id).length;
    expect(n >= 6 && n <= 9, `account ${a.id}: 6–9 departments on the map (has ${n})`);
  }

  // ── stakeholders: one per contact
  const stkByContact = new Map<ID, (typeof stakeholders)[number]>();
  for (const s of stakeholders) {
    const w = `stakeholders/${s.id}`;
    const c = contacts.get(s.contact_id);
    expect(c && c.account_id === s.account_id, `${w}: contact missing or of another account`);
    expect(s.id === `stk_${s.contact_id}`, `${w}: id must be stk_<contact>`);
    expect(!stkByContact.has(s.contact_id), `${w}: second row for the same contact`);
    stkByContact.set(s.contact_id, s);
    expect(INFLUENCES.includes(s.influence) && STANCES.includes(s.stance) && STRENGTHS.includes(s.strength), `${w}: influence / stance / strength`);
    expect(s.department === null || DEPARTMENT_KEYS.includes(s.department), `${w}: department`);
    if (s.ne_owner_id) expect(internal(s.ne_owner_id), `${w}: ne_owner must be New Era`);
    if (s.reports_to_contact_id) {
      expect(s.reports_to_contact_id !== s.contact_id && contacts.get(s.reports_to_contact_id)?.account_id === s.account_id, `${w}: reports_to must be another contact of the account`);
    }
  }
  for (const c of data.contacts) expect(stkByContact.has(c.id), `contacts/${c.id}: no stakeholder row`);
  for (const s of stakeholders) {
    const seen = new Set<ID>([s.contact_id]);
    let cursor = s.reports_to_contact_id;
    while (cursor) {
      if (seen.has(cursor)) {
        errors.push(`stakeholders/${s.id}: reporting line loops`);
        break;
      }
      seen.add(cursor);
      cursor = stkByContact.get(cursor)?.reports_to_contact_id ?? null;
    }
  }
  expect(stakeholders.some((s) => s.stance === 'champion') && stakeholders.some((s) => s.stance === 'skeptic'), 'stakeholders: at least one champion and one skeptic');
  for (const id of ORIGINAL_ACCOUNT_IDS) {
    const n = data.contacts.filter((c) => c.account_id === id).length;
    expect(n >= 4, `account ${id}: rich relationship map needs ≥ 4 contacts (has ${n})`);
  }

  // ── relation links
  const crossByEco = new Map<ID, number>();
  for (const l of links) {
    const w = `relation_links/${l.id}`;
    const from = contacts.get(l.from_contact_id);
    const to = contacts.get(l.to_contact_id);
    expect(from && to && from.id !== to.id, `${w}: two different existing contacts`);
    expect(RELATION_KINDS.includes(l.kind), `${w}: kind`);
    if (from && to) {
      expect(sameGroup(from.account_id, to.account_id), `${w}: ends must be one account or one business group`);
      const eco = ecoOf.get(from.account_id);
      if (from.account_id !== to.account_id && eco) crossByEco.set(eco, (crossByEco.get(eco) ?? 0) + 1);
    }
  }
  for (const eco of data.ecosystems ?? []) {
    const members = data.accounts.filter((a) => ecoOf.get(a.id) === eco.id).length;
    if (members < 2) continue;
    const n = crossByEco.get(eco.id) ?? 0;
    expect(n >= 1 && n <= 3, `ecosystem ${eco.id}: 1–3 cross-unit relation links (has ${n})`);
  }

  // ── change requests
  const codes = new Set<string>();
  for (const cr of crs) {
    const w = `change_requests/${cr.id}`;
    expect(accounts.has(cr.account_id), `${w}: account missing`);
    expect(/^YC-\d{2,}$/.test(cr.code), `${w}: code format YC-07`);
    const codeKey = `${cr.account_id}:${cr.code}`;
    expect(!codes.has(codeKey), `${w}: code used twice in the account`);
    codes.add(codeKey);
    if (cr.project_id) expect(projects.get(cr.project_id)?.account_id === cr.account_id, `${w}: project of another account`);
    if (cr.deployment_id) expect(deploymentsById.get(cr.deployment_id)?.account_id === cr.account_id, `${w}: deployment of another account`);
    if (cr.task_id) {
      const t = tasks.get(cr.task_id);
      expect(t && projects.get(t.project_id)?.account_id === cr.account_id, `${w}: task of another account`);
    }
    if (cr.requested_by_contact_id) expect(contacts.get(cr.requested_by_contact_id)?.account_id === cr.account_id, `${w}: requester contact of another account`);
    if (cr.requested_by_user_id) {
      const u = users.get(cr.requested_by_user_id);
      expect(u && u.org_type === 'client' && u.account_id === cr.account_id, `${w}: requester user must be a client of the account`);
    }
    expect(CR_STATUSES.includes(cr.status) && CR_SOURCES.includes(cr.source) && CR_PRIORITIES.includes(cr.priority), `${w}: status / source / priority`);
    if (cr.source === 'client_portal') expect(cr.requested_by_user_id, `${w}: a portal request names its client user`);
    expect((cr.status === 'new') === (cr.triaged_at === null), `${w}: triaged_at set exactly when the request left 'new'`);
    expect((cr.status === 'done') === (cr.done_at !== null), `${w}: done_at vs status`);
    if (cr.status === 'declined') expect(cr.decline_reason, `${w}: declined without a reason`);
    if (cr.status === 'planned') expect(cr.promised_date, `${w}: planned without a promised date`);
    if (cr.owner_id) expect(internal(cr.owner_id), `${w}: owner must be New Era`);
    expect(okDate(cr.promised_date), `${w}: promised_date`);
    if (cr.triaged_at) expect(cr.triaged_at >= cr.received_at, `${w}: triaged before received`);
    if (cr.done_at) expect(cr.done_at >= cr.received_at, `${w}: done before received`);
    expect(cr.title.trim(), `${w}: title`);
  }
  for (const id of ORIGINAL_ACCOUNT_IDS) {
    const n = crs.filter((cr) => cr.account_id === id).length;
    expect(n >= 3 && n <= 12, `account ${id}: 3–12 change requests (has ${n})`);
  }
  expect(crs.filter((cr) => cr.source === 'client_portal').length >= 3, 'change requests: a few come from the client portal');

  // ── care plans
  const planAccounts = new Set<ID>();
  for (const p of plans) {
    const w = `care_plans/${p.id}`;
    expect(accounts.has(p.account_id) && p.id === `care_${p.account_id}`, `${w}: account / id care_<account>`);
    expect(!planAccounts.has(p.account_id), `${w}: second plan for the account`);
    planAccounts.add(p.account_id);
    expect(Number.isInteger(p.cadence_days) && p.cadence_days >= MIN_CADENCE_DAYS && p.cadence_days <= MAX_CADENCE_DAYS, `${w}: cadence 1–180 days`);
    expect(okDate(p.next_action_due), `${w}: next_action_due`);
    if (p.next_action_owner_id) expect(internal(p.next_action_owner_id), `${w}: next action owner must be New Era`);
  }
  const overdue = plans.filter((p) => p.next_action_due !== null && p.next_action_due < today).length;
  expect(overdue >= 2 && overdue <= 3, `care plans: 2–3 accounts overdue for care (has ${overdue})`);

  // ── demo stories
  const rollup = (id: ID) => crRollup(crs.filter((cr) => cr.account_id === id), today);
  expect(rollup('acc_coxanh').debt > 0, 'scenario: Cỏ Xanh has delivery debt (expansion blocked)');
  expect(rollup('acc_thinhan').untriaged > 0 && rollup('acc_thinhan').debt === 0, 'scenario: Thịnh An has requests waiting more than 7 days, no debt');
  const mt = rollup('acc_maytrang');
  expect(mt.debt === 0 && mt.untriaged === 0, 'scenario: Mây Trắng requests are healthy');
  expect(departments.filter((r) => r.account_id === 'acc_maytrang' && hasOpportunity(r)).length >= 3, 'scenario: Mây Trắng has clear room to expand');
  return errors;
}
