// Integrity checks for the seed: every row has exactly the fields of its type, ids are unique, every *_id
// resolves, business invariants hold, and the six demo scenarios come out as specified.
// Usage: (await import('/src/data/seedChecks')).checkSeed(buildSeed(today), today) → [] when all good.

import type { DbData, TableName } from '@/services/db';
import type { ID, ISODate, Task } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import { isValidISODate } from '@/domain/dates';
import { getSampleFile, sampleFileUrl } from './sampleFiles';
import { OPTIONAL_KEYS, SETTINGS_KEYS, TABLE_KEYS, TEMPLATE_MILESTONE_KEYS } from './seed/fieldKeys';
import { accountSlice, blockersOf, checkScenarios, effectiveDiscount, taskDelay } from './seed/scenarioChecks';
import { quoteGrandTotal } from './seed/catalog';
import { DEMO_PASSWORD } from './seed/people';
import { CRM_TABLE_KEYS } from './seed/crmFieldKeys';
import { checkCrm } from './seed/crmChecks';
import { ORIGINAL_ACCOUNT_IDS } from './seed/crmAccounts';

type Seed = Omit<DbData, 'meta'>;
type AnyRow = Record<string, unknown> & { id?: string };

/** the six original demo accounts; the CRM prospects (converted leads) are checked by checkCrm */
const ACCOUNT_IDS = ORIGINAL_ACCOUNT_IDS;
/** reference field lists of every table, core + CRM extension */
const SHAPES: Partial<Record<TableName, Record<string, true>>> = { ...TABLE_KEYS, ...CRM_TABLE_KEYS };
/** CRM activity actions (lead.*, opportunity.*, interaction.*, ecosystem.*) do not count towards the per-account activity mix */
const isCrmAction = (action: string): boolean => /^(lead|opportunity|interaction|ecosystem)\./.test(action);
const PARAM_NAMES = new Set([
  'task', 'milestone', 'quote', 'version', 'amount', 'reason', 'note', 'to', 'file', 'project', 'days', 'date',
  // CRM activity params (i18n/vi/activityCrm.ts)
  'account', 'opportunity', 'from', 'stage', 'stage_label', 'lead', 'status', 'status_label', 'subject', 'kind', 'kind_label', 'fields',
  'ecosystem', 'count',
]);
const PHONE = /^0\d{3} \d{3} \d{3}$/;

/** true for a non-blank string (tolerates malformed rows instead of throwing) */
function filled(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Never throws: a crash while checking malformed data is reported as one more error. */
export function checkSeed(data: Seed, today: ISODate): string[] {
  try {
    return runChecks(data, today);
  } catch (e) {
    return [`checkSeed crashed: ${e instanceof Error ? e.message : String(e)}`];
  }
}

function runChecks(data: Seed, today: ISODate): string[] {
  const errors: string[] = [];
  const err = (m: string): void => {
    errors.push(m);
  };
  const expect = (cond: unknown, m: string): void => {
    if (!cond) err(m);
  };

  // ── 1. shape: every field of the TS type, nothing else; unique ids; dates sane
  for (const table of Object.keys(SHAPES) as TableName[]) {
    const rows = (data[table] ?? []) as unknown as AnyRow[];
    const ref = Object.keys(SHAPES[table] ?? {});
    const optional = OPTIONAL_KEYS[table] ?? [];
    const seen = new Set<string>();
    for (const row of rows) {
      const id = String(row.id ?? '?');
      if (seen.has(id)) err(`${table}/${id}: duplicate id`);
      seen.add(id);
      for (const k of ref) if (!optional.includes(k) && (!(k in row) || row[k] === undefined)) err(`${table}/${id}: missing field ${k}`);
      for (const k of Object.keys(row)) if (!ref.includes(k)) err(`${table}/${id}: unknown field ${k}`);
      for (const [k, v] of Object.entries(row)) {
        if (typeof v !== 'string') continue;
        if (/^\d{4}-\d{2}-\d{2}T/.test(v) && !(dateOf(v) < today)) err(`${table}/${id}: ${k} ${v} is not in the past`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isValidISODate(v)) err(`${table}/${id}: ${k} invalid date ${v}`);
      }
    }
  }
  for (const k of Object.keys(SETTINGS_KEYS)) expect(k in data.settings, `settings: missing ${k}`);
  for (const k of Object.keys(data.settings)) expect(k in SETTINGS_KEYS, `settings: unknown field ${k}`);
  for (const tpl of data.templates) for (const m of tpl.milestones) for (const k of Object.keys(TEMPLATE_MILESTONE_KEYS)) expect(k in m, `templates/${tpl.id}: milestone missing ${k}`);

  // ── 2. referential integrity
  const index = <T extends { id: ID }>(rows: T[]): Map<ID, T> => new Map(rows.map((r) => [r.id, r]));
  const users = index(data.users);
  const accounts = index(data.accounts);
  const projects = index(data.projects);
  const milestones = index(data.milestones);
  const tasks = index(data.tasks);
  const comments = index(data.comments);
  const files = index(data.files);
  const quotes = index(data.quotes);
  const contracts = index(data.contracts);
  const payments = index(data.payment_schedules);
  const priceItems = index(data.price_items);
  const ref = (where: string, field: string, value: ID | null | undefined, map: Map<ID, unknown>): void => {
    if (value !== null && value !== undefined && !map.has(value)) err(`${where}: ${field} → ${value} does not exist`);
  };
  const accOfProject = (id: ID): ID | undefined => projects.get(id)?.account_id;
  const accOfTask = (id: ID): ID | undefined => {
    const t = tasks.get(id);
    return t ? accOfProject(t.project_id) : undefined;
  };
  const accOfMilestone = (id: ID): ID | undefined => {
    const m = milestones.get(id);
    return m ? accOfProject(m.project_id) : undefined;
  };

  for (const u of data.users) {
    ref(`users/${u.id}`, 'account_id', u.account_id, accounts);
    ref(`users/${u.id}`, 'invited_by', u.invited_by, users);
  }
  for (const a of data.accounts) ref(`accounts/${a.id}`, 'am_id', a.am_id, users);
  for (const c of data.contacts) {
    ref(`contacts/${c.id}`, 'account_id', c.account_id, accounts);
    ref(`contacts/${c.id}`, 'user_id', c.user_id, users);
    if (c.user_id) expect(users.get(c.user_id)?.account_id === c.account_id, `contacts/${c.id}: user of another account`);
  }
  for (const p of data.projects) ref(`projects/${p.id}`, 'account_id', p.account_id, accounts);
  for (const m of data.milestones) ref(`milestones/${m.id}`, 'project_id', m.project_id, projects);
  for (const t of data.tasks) {
    const w = `tasks/${t.id}`;
    ref(w, 'project_id', t.project_id, projects);
    ref(w, 'milestone_id', t.milestone_id, milestones);
    ref(w, 'assignee_id', t.assignee_id, users);
    ref(w, 'delegated_by', t.delegated_by, users);
    ref(w, 'manual_unblocked_by', t.manual_unblocked_by, users);
    ref(w, 'quote_id', t.quote_id, quotes);
    ref(w, 'payment_schedule_id', t.payment_schedule_id, payments);
    ref(w, 'created_by', t.created_by, users);
    if (t.milestone_id) expect(milestones.get(t.milestone_id)?.project_id === t.project_id, `${w}: milestone of another project`);
    if (t.quote_id) expect(quotes.get(t.quote_id)?.account_id === accOfTask(t.id), `${w}: quote of another account`);
  }
  for (const d of data.task_dependencies) {
    const w = `task_dependencies/${d.id}`;
    ref(w, 'task_id', d.task_id, tasks);
    ref(w, 'blocks_task_id', d.blocks_task_id, tasks);
    ref(w, 'blocks_milestone_id', d.blocks_milestone_id, milestones);
    ref(w, 'created_by', d.created_by, users);
  }
  for (const c of data.comments) {
    ref(`comments/${c.id}`, 'task_id', c.task_id, tasks);
    ref(`comments/${c.id}`, 'author_id', c.author_id, users);
    ref(`comments/${c.id}`, 'reply_to_id', c.reply_to_id, comments);
    if (c.reply_to_id) expect(comments.get(c.reply_to_id)?.task_id === c.task_id, `comments/${c.id}: reply to a comment of another task`);
  }
  for (const f of data.files) {
    const w = `files/${f.id}`;
    ref(w, 'account_id', f.account_id, accounts);
    ref(w, 'project_id', f.project_id, projects);
    ref(w, 'task_id', f.task_id, tasks);
    ref(w, 'uploaded_by', f.uploaded_by, users);
    if (f.project_id) expect(accOfProject(f.project_id) === f.account_id, `${w}: project of another account`);
    if (f.task_id) expect(accOfTask(f.task_id) === f.account_id, `${w}: task of another account`);
  }
  for (const ap of data.account_prices) {
    ref(`account_prices/${ap.id}`, 'account_id', ap.account_id, accounts);
    ref(`account_prices/${ap.id}`, 'price_item_id', ap.price_item_id, priceItems);
  }
  for (const q of data.quotes) {
    const w = `quotes/${q.id}`;
    ref(w, 'account_id', q.account_id, accounts);
    ref(w, 'project_id', q.project_id, projects);
    ref(w, 'parent_id', q.parent_id, quotes);
    for (const k of ['approval_requested_by', 'director_approved_by', 'sent_by', 'client_decided_by', 'created_by'] as const) ref(w, k, q[k], users);
  }
  for (const l of data.quote_lines) {
    ref(`quote_lines/${l.id}`, 'quote_id', l.quote_id, quotes);
    ref(`quote_lines/${l.id}`, 'price_item_id', l.price_item_id, priceItems);
  }
  for (const c of data.contracts) {
    ref(`contracts/${c.id}`, 'account_id', c.account_id, accounts);
    ref(`contracts/${c.id}`, 'quote_id', c.quote_id, quotes);
    ref(`contracts/${c.id}`, 'file_id', c.file_id, files);
  }
  for (const p of data.payment_schedules) {
    const w = `payment_schedules/${p.id}`;
    ref(w, 'contract_id', p.contract_id, contracts);
    ref(w, 'milestone_id', p.milestone_id, milestones);
    ref(w, 'task_id', p.task_id, tasks);
    ref(w, 'proof_file_id', p.proof_file_id, files);
    const acc = contracts.get(p.contract_id)?.account_id;
    if (p.milestone_id) expect(accOfMilestone(p.milestone_id) === acc, `${w}: milestone of another account`);
  }
  const targets: Record<string, Map<ID, unknown>> = {
    task: tasks, milestone: milestones, project: projects, quote: quotes, contract: contracts, payment: payments, file: files, account: accounts,
    contact: index(data.contacts), user: users, comment: comments,
    opportunity: index(data.opportunities ?? []), lead: index(data.leads ?? []), interaction: index(data.interactions ?? []),
  };
  for (const a of data.activities) {
    const w = `activities/${a.id}`;
    ref(w, 'account_id', a.account_id, accounts);
    ref(w, 'actor_id', a.actor_id, users);
    if (a.target_type !== 'settings') ref(w, `target(${a.target_type})`, a.target_id, targets[a.target_type] ?? new Map<ID, unknown>());
    for (const k of Object.keys(a.params)) expect(PARAM_NAMES.has(k), `${w}: param "${k}" not allowed`);
  }
  for (const n of data.notifications) {
    const w = `notifications/${n.id}`;
    ref(w, 'user_id', n.user_id, users);
    ref(w, 'account_id', n.account_id, accounts);
    ref(w, 'task_id', n.task_id, tasks);
    const u = users.get(n.user_id);
    expect(n.link.startsWith(u?.org_type === 'client' ? '/portal/' : '/app/'), `${w}: link ${n.link} does not match the user side`);
    const linkTask = /\/portal\/tasks\/([\w-]+)/.exec(n.link)?.[1] ?? /[?&]task=([\w-]+)/.exec(n.link)?.[1];
    if (linkTask) ref(w, 'link task', linkTask, tasks);
    const linkQuote = /\/commercial\/quotes\/([\w-]+)/.exec(n.link)?.[1];
    if (linkQuote) ref(w, 'link quote', linkQuote, quotes);
    const linkAcc = /\/app\/accounts\/([\w-]+)/.exec(n.link)?.[1];
    if (linkAcc) ref(w, 'link account', linkAcc, accounts);
  }
  expect(data.emails.length === 0, 'emails: the seed sends none');

  // ── 3. people
  const demo: [ID, string, ID | null][] = [['u_director', 'director', null], ['u_am_ha', 'am', null], ['u_am_ducanh', 'am', null], ['u_member_tuan', 'member', null], ['u_client_minh', 'client_owner', 'acc_coxanh'], ['u_client_lan', 'client_member', 'acc_coxanh']];
  for (const [id, role, acc] of demo) expect(users.get(id)?.role === role && users.get(id)?.account_id === acc, `demo user ${id} must be ${role}`);
  expect(users.get('u_am_ha')?.can_view_cost === false && users.get('u_am_ducanh')?.can_view_cost === true, 'AM cost permissions');
  for (const u of data.users) {
    const w = `users/${u.id}`;
    expect(u.phone && PHONE.test(u.phone), `${w}: phone format`);
    if (u.org_type === 'internal') {
      expect(u.account_id === null && u.email.endsWith('@newera.inc') && u.password === DEMO_PASSWORD, `${w}: internal user email/password`);
    } else {
      const acc = u.account_id ? accounts.get(u.account_id) : undefined;
      expect(acc && u.email.endsWith(`@${acc.email_domain}`), `${w}: email not on the account domain`);
      expect(u.role === 'client_owner' || u.role === 'client_member', `${w}: client role`);
      expect(u.salutation, `${w}: salutation`);
      const firstLoginDemo = u.account_id === 'acc_haidang' && u.role === 'client_owner';
      expect(firstLoginDemo ? u.onboarded_at === null : u.onboarded_at !== null, `${w}: onboarded_at`);
    }
  }

  // ── 4. per account
  expect(ACCOUNT_IDS.every((id) => accounts.has(id)), 'the six demo accounts');
  for (const a of data.accounts) {
    const w = `account ${a.id}`;
    const am = users.get(a.am_id);
    expect(am?.role === 'am', `${w}: am_id is not an AM`);
    expect(a.exec_summary.split('\n').length === 3, `${w}: exec summary must have 3 lines`);
    // prospects (converted leads: no users, projects or tasks) → checkCrm
    if (!ACCOUNT_IDS.includes(a.id)) continue;
    const contacts = data.contacts.filter((c) => c.account_id === a.id);
    expect(contacts.length >= 2 && contacts.length <= 4, `${w}: 2–4 contacts`);
    for (const c of contacts) {
      const u = c.user_id ? users.get(c.user_id) : undefined;
      if (u) expect(u.role === (c.decision_role === 'decision_maker' ? 'client_owner' : 'client_member'), `${w}: contact ${c.id} role mismatch`);
    }
    const accUsers = data.users.filter((u) => u.account_id === a.id);
    expect(accUsers.some((u) => u.role === 'client_owner') && accUsers.some((u) => u.role === 'client_member'), `${w}: needs a client_owner and a client_member`);
    const projs = data.projects.filter((p) => p.account_id === a.id);
    expect(projs.length >= 1 && projs.length <= 2, `${w}: 1–2 projects`);
    const s = accountSlice(data, a.id);
    expect(s.tasks.length >= 15 && s.tasks.length <= 25, `${w}: 15–25 tasks (has ${s.tasks.length})`);
    const acts = data.activities.filter((x) => x.account_id === a.id && !isCrmAction(x.action));
    expect(acts.length >= 6 && acts.length <= 15, `${w}: 6–15 activities (has ${acts.length})`);
    for (const p of projs) {
      const ms = data.milestones.filter((m) => m.project_id === p.id).sort((x, y) => x.order_no - y.order_no);
      expect(ms.length >= 5 && ms.length <= 7, `project ${p.id}: 5–7 milestones`);
      expect(ms.every((m, i) => m.order_no === i + 1 && (i === 0 || m.planned_date > ms[i - 1].planned_date)), `project ${p.id}: order_no 1..n with increasing planned dates`);
      expect(ms.filter((m) => m.status === 'in_progress').length <= 1, `project ${p.id}: at most one milestone in progress`);
      for (const m of ms) {
        expect((m.status === 'done') === (m.completed_at !== null), `milestone ${m.id}: status/completed_at`);
        if (m.planned_date < today) expect(m.status === 'done', `milestone ${m.id}: planned in the past but not done`);
        if (m.status === 'done') expect(data.tasks.filter((t) => t.milestone_id === m.id).every((t) => t.status === 'done'), `milestone ${m.id}: done with open tasks`);
      }
    }
    const blocking = new Set(s.deps.map((d) => d.task_id));
    for (const t of s.tasks) checkTask(t, a.id, blocking.has(t.id), blockersOf(s, t).length > 0);
  }

  function checkTask(t: Task, accountId: ID, blocksSomething: boolean, blocked: boolean): void {
    const w = `tasks/${t.id}`;
    const done = t.status === 'done';
    const assignee = t.assignee_id ? users.get(t.assignee_id) : undefined;
    expect(filled(t.title) && /^\p{Lu}/u.test(t.title), `${w}: title must start with a capitalised verb`);
    expect(done === (t.completed_at !== null), `${w}: completed_at vs status`);
    if (done) expect(t.waiting_on === null && taskDelay(t, today) === 0 && t.completed_at! >= t.created_at, `${w}: done tasks finish on time, waiting_on null`);
    else if (t.side === 'internal') expect(t.waiting_on === 'internal', `${w}: open internal task waits on internal`);
    else expect(t.waiting_on === (t.status === 'waiting' ? 'internal' : 'client'), `${w}: client waiting_on vs status`);
    if (blocked) expect(t.status === 'todo', `${w}: blocked task must stay in todo`);
    expect((t.reminder_count > 0) === (t.last_reminded_at !== null), `${w}: reminder_count vs last_reminded_at`);
    if (t.side === 'client') {
      expect(t.type !== 'work' && t.client_visible && filled(t.impact_text) && filled(t.due_date) && isValidISODate(t.due_date), `${w}: client task needs type, impact_text and due_date`);
      expect(assignee?.account_id === accountId && assignee.org_type === 'client', `${w}: client assignee of the account`);
    } else {
      expect(t.type === 'work' && (!assignee || assignee.org_type === 'internal'), `${w}: internal task type/assignee`);
      if (blocksSomething) expect(filled(t.impact_text), `${w}: blocks something but has no impact_text`);
    }
    if (t.delegated_by) {
      const by = users.get(t.delegated_by);
      expect(by?.role === 'client_owner' && by.account_id === accountId && t.assignee_id !== t.delegated_by && t.delegated_at && t.delegation_note && !t.requires_owner, `${w}: delegation fields`);
    }
    if (t.quote_id) expect(t.type === 'approval' && t.requires_owner && assignee?.role === 'client_owner', `${w}: quote task must be an owner approval`);
    if (t.payment_schedule_id) expect(t.type === 'payment' && payments.get(t.payment_schedule_id)?.task_id === t.id, `${w}: payment task ↔ installment`);
    if (t.type === 'payment') expect(t.payment_schedule_id, `${w}: payment task without installment`);
  }

  // ── 5. dependencies: one target, same account, no self / duplicate, no cycle
  const edgeKeys = new Set<string>();
  for (const d of data.task_dependencies) {
    const w = `task_dependencies/${d.id}`;
    expect((d.blocks_task_id === null) !== (d.blocks_milestone_id === null), `${w}: exactly one of blocks_task_id / blocks_milestone_id`);
    expect(d.blocks_task_id !== d.task_id, `${w}: self dependency`);
    const target = d.blocks_task_id ? accOfTask(d.blocks_task_id) : d.blocks_milestone_id ? accOfMilestone(d.blocks_milestone_id) : undefined;
    expect(target === accOfTask(d.task_id), `${w}: crosses accounts`);
    const key = `${d.task_id}>${d.blocks_task_id ?? d.blocks_milestone_id}`;
    expect(!edgeKeys.has(key), `${w}: duplicate edge`);
    edgeKeys.add(key);
  }
  const state = new Map<ID, 1 | 2>();
  const visit = (id: ID, path: ID[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) return err(`dependency cycle: ${[...path, id].join(' → ')}`);
    state.set(id, 1);
    for (const d of data.task_dependencies) if (d.task_id === id && d.blocks_task_id) visit(d.blocks_task_id, [...path, id]);
    state.set(id, 2);
  };
  for (const t of data.tasks) visit(t.id, []);

  // ── 6. visibility (RBAC test material)
  const hidden = data.tasks.filter((t) => t.side === 'internal' && !t.client_visible);
  for (const c of data.comments) if (hidden.some((t) => t.id === c.task_id)) expect(c.visibility === 'internal', `comments/${c.id}: shared comment on a hidden task`);
  expect(data.comments.some((c) => c.visibility === 'internal' && hidden.some((t) => t.id === c.task_id)), 'a hidden task carries an internal comment');
  expect(data.comments.filter((c) => c.visibility === 'internal' && tasks.get(c.task_id)?.client_visible).length >= 3, 'several visible tasks carry internal comments');
  expect(data.files.some((f) => f.visibility === 'internal') && data.files.some((f) => f.visibility === 'shared'), 'files: internal and shared');

  // ── 7. files ↔ sample generator
  const versions = new Set<string>();
  for (const f of data.files) {
    const w = `files/${f.id}`;
    const key = f.storage_path.startsWith('sample:') ? f.storage_path.slice(7) : '';
    const sample = key ? getSampleFile(key) : null;
    expect(sample && sampleFileUrl(f.storage_path) === sample.url, `${w}: sample "${f.storage_path}" does not resolve`);
    // PDFs carry their own Vietnamese font subset (~10 kB), so they stay well under 24 kB; designs are small SVGs
    if (sample) expect(sample.mime === f.mime && sample.size === f.size && sample.size < 24_000, `${w}: mime/size mismatch or file too big (${sample.size} B)`);
    const v = `${f.account_id}:${f.doc_key}:${f.version}`;
    expect(!versions.has(v), `${w}: duplicate doc_key/version`);
    versions.add(v);
  }
  expect(data.files.some((f) => f.kind === 'design' && f.version === 2 && data.files.some((g) => g.doc_key === f.doc_key && g.version === 1)), 'files: a design with v1 and v2');

  // ── 8. commercial
  const threshold = data.settings.discount_approval_threshold_pct;
  for (const q of data.quotes) {
    const w = `quotes/${q.id}`;
    const lines = data.quote_lines.filter((l) => l.quote_id === q.id);
    expect(lines.length > 0, `${w}: no lines`);
    expect(q.status === 'draft' || q.status === 'pending_approval' ? q.sent_at === null : q.sent_at !== null, `${w}: sent_at vs status`);
    if (q.status === 'accepted' || q.status === 'changes_requested') expect(q.client_decision === q.status && q.client_decided_at, `${w}: client decision fields`);
    else expect(q.client_decision === null, `${w}: client_decision must be null`);
    if (q.status === 'pending_approval') expect(q.approval_requested_by && q.approval_requested_at && !q.director_approved_by, `${w}: pending approval fields`);
    if (q.sent_at && effectiveDiscount(data, q) > threshold) expect(q.director_approved_by && q.director_approved_at, `${w}: over threshold but sent without director approval`);
    if (q.parent_id) {
      const parent = quotes.get(q.parent_id);
      expect(parent && parent.code === q.code && parent.version === q.version - 1, `${w}: parent version/code`);
    }
  }
  for (const c of data.contracts) {
    const w = `contracts/${c.id}`;
    const q = c.quote_id ? quotes.get(c.quote_id) : undefined;
    if (q) {
      expect(q.status === 'accepted', `${w}: quote not accepted`);
      const total = quoteGrandTotal(data.quote_lines.filter((l) => l.quote_id === q.id), q.discount_pct_total);
      expect(total === c.value, `${w}: value ${c.value} ≠ quote grand total ${total}`);
    }
    const ps = data.payment_schedules.filter((p) => p.contract_id === c.id);
    expect(ps.length >= 3 && ps.length <= 4, `${w}: 3–4 installments`);
    expect(ps.reduce((s, p) => s + p.percent, 0) === 100, `${w}: percentages must sum to 100`);
    expect(ps.reduce((s, p) => s + p.amount, 0) === c.value, `${w}: amounts must sum to the value`);
    for (const p of ps) {
      const pw = `payment_schedules/${p.id}`;
      const m = p.milestone_id ? milestones.get(p.milestone_id) : undefined;
      expect(Math.abs(p.amount - (c.value * p.percent) / 100) <= 1, `${pw}: amount vs percent`);
      if (p.status === 'paid') expect(p.paid_at && p.invoiced_at && p.invoice_no, `${pw}: paid fields`);
      if (p.status === 'invoiced' || p.status === 'overdue') expect(p.invoice_no && p.invoiced_at && !p.paid_at && p.task_id, `${pw}: invoiced installments need invoice + payment task`);
      if (p.status === 'not_due') expect(!p.invoice_no && !p.paid_at && m?.status !== 'done', `${pw}: not_due but milestone done / invoiced`);
      if (p.status === 'invoice_due') expect(!p.invoice_no && m?.status === 'done', `${pw}: invoice_due needs a completed milestone`);
      if (p.status !== 'not_due' && m) expect(m.status === 'done', `${pw}: ${p.status} but its milestone is not done`);
    }
  }

  // ── 9. notifications, templates, settings
  for (const uid of ['u_director', 'u_am_ha', 'u_member_tuan', 'u_client_minh', 'u_client_lan']) {
    const mine = data.notifications.filter((n) => n.user_id === uid);
    expect(mine.length >= 2 && mine.some((n) => n.read_at === null), `notifications: ${uid} needs a few, some unread`);
  }
  expect(data.templates.length === 2, 'templates: 2');
  const sw = data.templates.find((t) => t.name === 'Triển khai phần mềm');
  expect(sw && sw.milestones.map((m) => m.name).join('→') === 'Kickoff→Khảo sát→Thiết kế→Phát triển→UAT→Go-live→Hỗ trợ sau go-live', 'templates: "Triển khai phần mềm" with 7 milestones');
  const st = data.settings;
  expect(st.discount_approval_threshold_pct === 10 && st.escalation_overdue_days === 3 && st.reminder_days_before.join(',') === '3,1' && st.max_emails_per_day === 1 && st.weekly_digest_weekday === 1 && st.weekly_digest_hour === 8 && st.payment_task_auto, 'settings: defaults');
  expect(data.price_items.length >= 10 && data.price_items.some((p) => !p.active), 'price items: ~12 with some inactive');

  // ── 10. scenarios
  errors.push(...checkScenarios(data, today));

  // ── 11. CRM / targeting extension (ARCHITECTURE §13)
  errors.push(...checkCrm(data, today));
  return errors;
}
