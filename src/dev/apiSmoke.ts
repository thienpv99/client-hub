// API smoke test: every READ method of `Api`, as every demo role, with realistic ids (first accessible account,
// project, task, quote, user), through the real wrapper (latency → sanitize → JSON clone), plus the demo scenario
// checks on a fresh database and a forced notification sweep.
// Expected refusals are the documented ones (client dashboard, internal portal home, commercial for client_member
// and internal member, price list for non-managers, templates / dependency check for clients, user admin for
// non-directors, Zalo for non-managers…).
// The session is restored and the demo data reset at the end.
// Run in the browser: (await import('/src/dev/apiSmoke')).runApiSmoke().then(r => r.filter(x => !x.ok))

import type { ID, Role } from '@/domain/types';
import { ApiError, CLIENT_SETTINGS_KEYS, type Api } from '@/services/contract';
import type { CrmApi } from '@/services/crmContract';
import { api } from '@/services/api';
import { getSession, setSession } from '@/services/context';
import { assert, assertEqual, AssertionError, createSuite, type TestResult } from '@/dev/testkit';
import { runScenarioChecks } from '@/dev/scenarioChecks';

/** 'not_found': a CRM read with a placeholder id while the CRM tables are still empty */
type Expect = 'ok' | 'forbidden' | 'not_found';

type ApiMethod = keyof Api | keyof CrmApi;

interface Probe {
  method: ApiMethod;
  label: string;
  expect: Expect;
  run: () => Promise<unknown>;
  /** extra shape assertions on a successful result */
  check?: (value: unknown) => void;
}

/** Every read-only method of Api (plus runNotificationSweep, the daily job). Each must be probed at least once. */
export const READ_METHODS: readonly (keyof Api)[] = [
  'getViewer',
  'listDemoLogins',
  'getDirectorDashboard',
  'listAccounts',
  'getAccount',
  'listProjects',
  'listTasks',
  'getTask',
  'listActivities',
  'listFiles',
  'listContacts',
  'listUsers',
  'getPortalHome',
  'search',
  'getZaloReminder',
  'checkDependencies',
  'listTemplates',
  'listAllUsers',
  'listPriceItems',
  'listAccountPrices',
  'listQuotes',
  'getQuote',
  'listContracts',
  'listPayments',
  'getReceivables',
  'listNotifications',
  'listOutbox',
  'getWeeklyDigest',
  'getSettings',
  'runNotificationSweep',
];

/** Every read method of CrmApi (director / AM; members: portfolio + workload; clients: none). */
export const CRM_READ_METHODS: readonly (keyof CrmApi)[] = [
  'getCrmDashboard',
  'listFollowUps',
  'listOpportunities',
  'getOpportunity',
  'listLeads',
  'getLead',
  'listSegments',
  'previewSegment',
  'getSegmentMembers',
  'listTargetAccounts',
  'getIcp',
  'getTargetingOptions',
  'listInteractions',
  'listProjectPortfolio',
  'getWorkload',
  'getClientMap',
  'listEcosystems',
];

const ROLES: readonly Role[] = ['director', 'am', 'member', 'client_owner', 'client_member'];
const CX = 'acc_coxanh';
const MINH = 'u_client_minh';
const LAN = 'u_client_lan';
const DESIGN_APPROVAL = 't_coxanh_design_approval';
const ORDER_DEV = 't_coxanh_order_dev';

function codeOf(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  return `unexpected: ${err instanceof Error ? err.message : String(err)}`;
}

function isArray(label: string): (value: unknown) => void {
  return (value) => assert(Array.isArray(value), `${label} returns an array`);
}

function obj(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'returns an object');
  return value as Record<string, unknown>;
}

interface Fixtures {
  /** a Cỏ Xanh quote the client may see (sent / accepted / changes requested) */
  clientQuoteId: ID | null;
  /** any opportunity / lead / segment (director view), for the refusals of the other roles */
  opportunityId: ID | null;
  leadId: ID | null;
  segmentId: ID | null;
}

async function collectFixtures(): Promise<Fixtures> {
  await api.loginDemo('director');
  const [quotes, opps, leads, segments] = await Promise.all([api.listQuotes({ accountId: CX }), api.listOpportunities(), api.listLeads(), api.listSegments()]);
  const q = quotes.find((x) => x.status === 'sent' || x.status === 'accepted' || x.status === 'changes_requested');
  return {
    clientQuoteId: q ? q.id : null,
    opportunityId: opps[0]?.id ?? null,
    leadId: leads[0]?.id ?? null,
    segmentId: segments[0]?.id ?? null,
  };
}

function isObjArray(label: string, keys: string[]): (value: unknown) => void {
  return (value) => {
    assert(Array.isArray(value), `${label} returns an array`);
    for (const row of value as Record<string, unknown>[]) {
      for (const k of keys) assert(k in row, `${label}: rows have ${k}`);
    }
  };
}

/** CRM reads: director & AM see their scope; members only portfolio + workload; clients nothing */
async function crmProbes(role: Role, fx: Fixtures, accountId: ID): Promise<Probe[]> {
  const crm = role === 'director' || role === 'am';
  const internal = crm || role === 'member';
  const yes = (cond: boolean): Expect => (cond ? 'ok' : 'forbidden');
  // ids the role may read (its own scope); others reuse the director's ids to prove the refusal
  let oppId = fx.opportunityId;
  let leadId = fx.leadId;
  let segmentId = fx.segmentId;
  if (crm) {
    const [opps, leads, segments] = await Promise.all([api.listOpportunities(), api.listLeads(), api.listSegments()]);
    oppId = opps[0]?.id ?? null;
    leadId = leads[0]?.id ?? null;
    segmentId = segments[0]?.id ?? null;
  }
  const byId = (id: ID | null): Expect => (!crm ? 'forbidden' : id ? 'ok' : 'not_found');
  return [
    {
      method: 'getCrmDashboard',
      label: 'getCrmDashboard',
      expect: yes(crm),
      run: () => api.getCrmDashboard(),
      check: (x) => {
        const d = obj(x);
        assert(Array.isArray(d.pipeline) && d.pipeline.length === 4, '4 open stages');
        assert(Array.isArray(d.forecast) && d.forecast.length === 6, '6 forecast months');
        assert(typeof d.win_rate === 'number' && typeof d.weighted_value === 'number', 'numbers');
      },
    },
    { method: 'listFollowUps', label: 'listFollowUps()', expect: yes(crm), run: () => api.listFollowUps(), check: isObjArray('listFollowUps', ['kind', 'date', 'href']) },
    { method: 'listFollowUps', label: 'listFollowUps(overdue)', expect: yes(crm), run: () => api.listFollowUps({ range: 'overdue' }), check: (x) => assert(Array.isArray(x) && (x as { overdue: boolean }[]).every((i) => i.overdue), 'overdue only') },
    { method: 'listOpportunities', label: 'listOpportunities()', expect: yes(crm), run: () => api.listOpportunities(), check: isObjArray('listOpportunities', ['weighted_value', 'stage', 'account']) },
    { method: 'listOpportunities', label: 'listOpportunities(open)', expect: yes(crm), run: () => api.listOpportunities({ openOnly: true }), check: isArray('listOpportunities') },
    {
      method: 'getOpportunity',
      label: `getOpportunity(${oppId ?? 'none'})`,
      expect: byId(oppId),
      run: () => api.getOpportunity(oppId ?? 'opp_none'),
      check: (x) => assert(Array.isArray(obj(x).interactions) && Array.isArray(obj(x).stage_history), 'detail lists'),
    },
    { method: 'listLeads', label: 'listLeads()', expect: yes(crm), run: () => api.listLeads(), check: isObjArray('listLeads', ['fit', 'status', 'segment_ids']) },
    { method: 'listLeads', label: 'listLeads(open, unassigned)', expect: yes(crm), run: () => api.listLeads({ openOnly: true, owner: 'none' }), check: isArray('listLeads') },
    {
      method: 'getLead',
      label: `getLead(${leadId ?? 'none'})`,
      expect: byId(leadId),
      run: () => api.getLead(leadId ?? 'lead_none'),
      check: (x) => assert(Array.isArray(obj(x).interactions), 'interactions'),
    },
    { method: 'listSegments', label: 'listSegments', expect: yes(crm), run: () => api.listSegments(), check: isObjArray('listSegments', ['lead_count', 'account_count', 'avg_fit']) },
    {
      method: 'previewSegment',
      label: 'previewSegment(all)',
      expect: yes(crm),
      run: () => api.previewSegment({ scope: 'all' }),
      check: (x) => assert(Array.isArray(obj(x).leads) && Array.isArray(obj(x).accounts), 'members'),
    },
    {
      method: 'getSegmentMembers',
      label: `getSegmentMembers(${segmentId ?? 'none'})`,
      expect: byId(segmentId),
      run: () => api.getSegmentMembers(segmentId ?? 'seg_none'),
      check: (x) => assert(typeof obj(x).lead_count === 'number', 'counts'),
    },
    { method: 'listTargetAccounts', label: 'listTargetAccounts', expect: yes(crm), run: () => api.listTargetAccounts(), check: isObjArray('listTargetAccounts', ['fit', 'whitespace']) },
    {
      method: 'getIcp',
      label: 'getIcp',
      expect: yes(crm),
      run: () => api.getIcp(),
      check: (x) => assert(typeof obj(obj(x).weights).engagement === 'number', 'weights'),
    },
    {
      method: 'getTargetingOptions',
      label: 'getTargetingOptions',
      expect: yes(crm),
      run: () => api.getTargetingOptions(),
      check: (x) => assert(Array.isArray(obj(x).industries) && Array.isArray(obj(x).provinces) && Array.isArray(obj(x).tags), 'option lists'),
    },
    { method: 'listInteractions', label: 'listInteractions()', expect: yes(crm), run: () => api.listInteractions({ limit: 20 }), check: isArray('listInteractions') },
    {
      method: 'listInteractions',
      label: `listInteractions(account ${accountId})`,
      expect: yes(crm),
      run: () => api.listInteractions({ accountId }),
      check: isArray('listInteractions'),
    },
    {
      method: 'listProjectPortfolio',
      label: 'listProjectPortfolio()',
      expect: yes(internal),
      run: () => api.listProjectPortfolio(),
      check: isObjArray('listProjectPortfolio', ['health', 'forecast_end_date', 'slip_days', 'team']),
    },
    {
      method: 'listProjectPortfolio',
      label: 'listProjectPortfolio(blocked)',
      expect: yes(internal),
      run: () => api.listProjectPortfolio({ health: 'blocked' }),
      check: (x) => assert(Array.isArray(x) && (x as { health: string }[]).every((r) => r.health === 'blocked'), 'blocked only'),
    },
    {
      method: 'getWorkload',
      label: 'getWorkload()',
      expect: yes(internal),
      run: () => api.getWorkload(),
      check: (x) => {
        const w = obj(x);
        assert(Array.isArray(w.weeks) && w.weeks.length === 6, '6 weeks by default');
        assert((w.people as { per_week: number[] }[]).every((p) => p.per_week.length === 6), 'per-week counts');
      },
    },
    {
      method: 'getClientMap',
      label: 'getClientMap()',
      expect: yes(crm),
      run: () => api.getClientMap(),
      check: (x) => {
        const m = obj(x);
        assert(m.metric === 'total' && Array.isArray(m.nodes) && Array.isArray(m.links) && Array.isArray(m.ecosystems), 'map shape');
        const nodes = m.nodes as { id: string; kind: string; value: number; href: string | null }[];
        const ids = new Set(nodes.map((n) => n.id));
        assert((m.links as { source: string; target: string }[]).every((l) => ids.has(l.source) && ids.has(l.target)), 'links resolve to nodes');
        assert(nodes.every((n, i) => i === 0 || nodes[i - 1].value >= n.value), 'bubbles sorted by value');
        assert(nodes.some((n) => n.kind === 'ecosystem'), 'the demo has a business group for this viewer');
        assert(nodes.every((n) => (n.kind === 'ecosystem') === (n.href === null)), 'companies link to their page, hubs nowhere');
        const t = obj(m.totals);
        assert(t.accounts === nodes.filter((n) => n.kind === 'account').length && t.leads === nodes.filter((n) => n.kind === 'lead').length, 'totals');
      },
    },
    {
      method: 'getClientMap',
      label: 'getClientMap(pipeline, accounts only)',
      expect: yes(crm),
      run: () => api.getClientMap({ metric: 'pipeline', includeLeads: false }),
      check: (x) => {
        const m = obj(x);
        assert(m.metric === 'pipeline' && (m.nodes as { kind: string }[]).every((n) => n.kind !== 'lead'), 'no lead bubbles');
      },
    },
    {
      method: 'listEcosystems',
      label: 'listEcosystems',
      expect: yes(crm),
      run: () => api.listEcosystems(),
      check: isObjArray('listEcosystems', ['short_name', 'account_count', 'lead_count', 'contract_value', 'potential_value', 'members']),
    },
  ];
}

async function probesFor(role: Role, fx: Fixtures): Promise<Probe[]> {
  await api.loginDemo(role);
  const v = api.getViewer();
  assert(v && v.role === role, `logged in as ${role}`);
  const client = v.org_type === 'client';
  const internal = !client;
  const manager = role === 'director' || role === 'am';
  // commercial module: director, AM, client_owner (no client_member, no internal member — canAccessCommercial)
  const commercial = role !== 'client_member' && role !== 'member';
  const yes = (cond: boolean): Expect => (cond ? 'ok' : 'forbidden');

  // realistic ids: first accessible account / project / task / quote / user of this viewer
  const accounts = await api.listAccounts();
  const account = client ? accounts.find((a) => a.id === v.account_id) : accounts.find((a) => a.id === CX) ?? accounts[0];
  assert(account, `${role} has an accessible account`);
  const accountId = account.id;
  const [projects, tasks, users] = await Promise.all([
    api.listProjects(accountId),
    api.listTasks({ accountId, openOnly: false }),
    api.listUsers(),
  ]);
  const project = projects[0];
  const task = tasks.find((x) => x.id === DESIGN_APPROVAL) ?? tasks[0];
  assert(task, `${role} sees at least one task of ${accountId}`);
  // a task the client can act on now (Zalo reminders are refused for blocked / done / New Era tasks)
  const clientTask = tasks.find((x) => x.side === 'client' && x.status !== 'done' && x.waiting_on === 'client' && !x.blocked) ?? task;
  const quotes = commercial ? await api.listQuotes({ accountId }) : [];
  const quoteId = quotes[0]?.id ?? fx.clientQuoteId;
  const user = users[0];
  const digestTarget = role === 'client_owner' ? LAN : MINH;

  const probes: Probe[] = [
    {
      method: 'getViewer',
      label: 'getViewer',
      expect: 'ok',
      run: async () => api.getViewer(),
      check: (x) => assert(obj(x).role === role, 'viewer role'),
    },
    {
      method: 'listDemoLogins',
      label: 'listDemoLogins',
      expect: 'ok',
      run: async () => api.listDemoLogins(),
      check: (x) => {
        assert(Array.isArray(x), 'array');
        const roles = new Set((x as { role: Role }[]).map((d) => d.role));
        assert(['director', 'am', 'client_owner', 'client_member'].every((r) => roles.has(r as Role)), 'demo roles');
      },
    },
    {
      method: 'getDirectorDashboard',
      label: 'getDirectorDashboard',
      expect: yes(manager),
      run: () => api.getDirectorDashboard(),
      check: (x) => {
        const d = obj(x);
        assert(Array.isArray(d.attention) && d.attention.length <= 7, 'attention ≤ 7');
        assert(Array.isArray(d.cashflow) && d.cashflow.length === 12, '12 cashflow months');
      },
    },
    { method: 'listAccounts', label: 'listAccounts', expect: 'ok', run: () => api.listAccounts(), check: isArray('listAccounts') },
    {
      method: 'listAccounts',
      label: 'listAccounts(blocked filter)',
      expect: 'ok',
      run: () => api.listAccounts({ health: 'blocked' }),
      check: isArray('listAccounts'),
    },
    {
      method: 'getAccount',
      label: `getAccount(${accountId})`,
      expect: 'ok',
      run: () => api.getAccount(accountId),
      check: (x) => {
        const a = obj(x);
        assert(a.id === accountId && Array.isArray(a.projects), 'account detail');
        assert((a.commercial === null) === !commercial, 'commercial block only for allowed roles');
      },
    },
    { method: 'listProjects', label: `listProjects(${accountId})`, expect: 'ok', run: () => api.listProjects(accountId), check: isArray('listProjects') },
    { method: 'listTasks', label: 'listTasks()', expect: 'ok', run: () => api.listTasks(), check: isArray('listTasks') },
    { method: 'listTasks', label: 'listTasks(mine)', expect: 'ok', run: () => api.listTasks({ mine: true }), check: isArray('listTasks') },
    {
      method: 'listTasks',
      label: 'listTasks(project, overdue, blocking)',
      expect: 'ok',
      run: () => api.listTasks({ accountId, projectId: project?.id, overdue: true, blocking: true }),
      check: isArray('listTasks'),
    },
    {
      method: 'getTask',
      label: `getTask(${task.id})`,
      expect: 'ok',
      run: () => api.getTask(task.id),
      check: (x) => {
        const d = obj(x);
        assert(d.id === task.id && Array.isArray(d.chain) && Array.isArray(d.comments) && Array.isArray(d.history), 'task detail');
      },
    },
    { method: 'listActivities', label: 'listActivities(account)', expect: 'ok', run: () => api.listActivities({ accountId }), check: isArray('listActivities') },
    { method: 'listActivities', label: 'listActivities(task)', expect: 'ok', run: () => api.listActivities({ taskId: task.id }), check: isArray('listActivities') },
    {
      method: 'listActivities',
      label: 'listActivities(approvals)',
      expect: 'ok',
      run: () => api.listActivities({ accountId, approvalsOnly: true, limit: 20 }),
      check: isArray('listActivities'),
    },
    { method: 'listFiles', label: 'listFiles(account)', expect: 'ok', run: () => api.listFiles({ accountId }), check: isArray('listFiles') },
    { method: 'listFiles', label: 'listFiles(task)', expect: 'ok', run: () => api.listFiles({ taskId: task.id }), check: isArray('listFiles') },
    { method: 'listContacts', label: `listContacts(${accountId})`, expect: 'ok', run: () => api.listContacts(accountId), check: isArray('listContacts') },
    { method: 'listUsers', label: 'listUsers()', expect: 'ok', run: () => api.listUsers(), check: isArray('listUsers') },
    {
      method: 'listUsers',
      label: 'listUsers(client owners of account)',
      expect: 'ok',
      run: () => api.listUsers({ accountId: client ? undefined : accountId, role: 'client_owner' }),
      check: isArray('listUsers'),
    },
    {
      method: 'getPortalHome',
      label: 'getPortalHome',
      expect: yes(client),
      run: () => api.getPortalHome(),
      check: (x) => {
        const h = obj(x);
        assert(Array.isArray(h.my_tasks) && Array.isArray(h.progress), 'portal home lists');
        assert(obj(h.account).id === v.account_id, 'own account');
      },
    },
    {
      method: 'getPortalHome',
      label: 'getPortalHome(project)',
      expect: yes(client),
      run: () => api.getPortalHome({ projectId: project?.id }),
    },
    { method: 'search', label: 'search(duyet)', expect: 'ok', run: () => api.search('duyet'), check: isArray('search') },
    { method: 'search', label: 'search(empty)', expect: 'ok', run: () => api.search('  '), check: isArray('search') },
    {
      method: 'getZaloReminder',
      label: `getZaloReminder(${clientTask.id})`,
      expect: yes(manager),
      run: () => api.getZaloReminder(clientTask.id),
      check: (x) => assert(typeof obj(x).text === 'string' && String(obj(x).text).length > 0, 'ready-to-paste text'),
    },
    {
      method: 'checkDependencies',
      label: 'checkDependencies(no change)',
      expect: yes(internal),
      run: () => api.checkDependencies({ taskId: task.id, blocks_task_ids: [], blocked_by_task_ids: [] }),
      check: (x) => assert(obj(x).ok === true, 'no cycle'),
    },
    {
      method: 'listTemplates',
      label: 'listTemplates',
      expect: yes(internal),
      run: () => api.listTemplates(),
      check: (x) => assert(Array.isArray(x) && x.length >= 2, 'two templates'),
    },
    { method: 'listAllUsers', label: 'listAllUsers', expect: yes(role === 'director'), run: () => api.listAllUsers(), check: isArray('listAllUsers') },
    { method: 'listPriceItems', label: 'listPriceItems', expect: yes(manager), run: () => api.listPriceItems(), check: isArray('listPriceItems') },
    {
      method: 'listAccountPrices',
      label: `listAccountPrices(${accountId})`,
      expect: yes(manager),
      run: () => api.listAccountPrices(accountId),
      check: isArray('listAccountPrices'),
    },
    { method: 'listQuotes', label: 'listQuotes()', expect: yes(commercial), run: () => api.listQuotes(), check: isArray('listQuotes') },
    { method: 'listContracts', label: 'listContracts()', expect: yes(commercial), run: () => api.listContracts(), check: isArray('listContracts') },
    { method: 'listPayments', label: 'listPayments()', expect: yes(commercial), run: () => api.listPayments(), check: isArray('listPayments') },
    {
      method: 'getReceivables',
      label: 'getReceivables',
      expect: yes(commercial),
      run: () => api.getReceivables(),
      check: (x) => assert(typeof obj(x).total === 'number', 'total'),
    },
    { method: 'listNotifications', label: 'listNotifications', expect: 'ok', run: () => api.listNotifications(), check: isArray('listNotifications') },
    {
      method: 'listNotifications',
      label: 'listNotifications(unread, 5)',
      expect: 'ok',
      run: () => api.listNotifications({ unreadOnly: true, limit: 5 }),
      check: (x) => assert(Array.isArray(x) && x.length <= 5, '≤ 5'),
    },
    { method: 'listOutbox', label: 'listOutbox', expect: 'ok', run: () => api.listOutbox({ limit: 20 }), check: isArray('listOutbox') },
    {
      method: 'getWeeklyDigest',
      label: 'getWeeklyDigest(me)',
      expect: 'ok',
      run: () => api.getWeeklyDigest(),
      check: (x) => assert(Array.isArray(obj(x).sections), 'sections'),
    },
    {
      method: 'getWeeklyDigest',
      label: `getWeeklyDigest(${digestTarget})`,
      expect: yes(manager),
      run: () => api.getWeeklyDigest(digestTarget),
      check: (x) => assert(obj(obj(x).recipient).id === digestTarget, 'recipient'),
    },
    {
      method: 'getSettings',
      label: 'getSettings',
      expect: 'ok',
      run: () => api.getSettings(),
      check: (x) => {
        const s = obj(x);
        if (internal) assert(typeof s.discount_approval_threshold_pct === 'number', 'threshold');
        else assertEqual(Object.keys(s).sort(), [...CLIENT_SETTINGS_KEYS].sort(), 'client gets the portal fields only');
      },
    },
  ];
  if (user) {
    probes.push({ method: 'listUsers', label: `listUsers(role ${user.role})`, expect: 'ok', run: () => api.listUsers({ role: user.role }) });
  }
  if (quoteId) {
    probes.push({
      method: 'getQuote',
      label: `getQuote(${quoteId})`,
      expect: yes(commercial),
      run: () => api.getQuote(quoteId),
      check: (x) => {
        const q = obj(x);
        assert(q.id === quoteId && Array.isArray(q.lines) && Array.isArray(q.versions), 'quote detail');
      },
    });
  }
  probes.push(...(await crmProbes(role, fx, accountId)));
  if (role === 'director') {
    // the real cycle check (form semantics: the lists are the task's full new edge sets): the approval keeps blocking
    // “Lập trình phần Đặt hàng” and would also wait for it → cycle
    probes.push({
      method: 'checkDependencies',
      label: 'checkDependencies(cycle)',
      expect: 'ok',
      run: () => api.checkDependencies({ taskId: DESIGN_APPROVAL, blocks_task_ids: [ORDER_DEV], blocked_by_task_ids: [ORDER_DEV] }),
      check: (x) => {
        const r = obj(x);
        assert(r.ok === false && Array.isArray(r.path) && r.path.length >= 2, 'cycle path returned');
      },
    });
  }
  return probes;
}

async function runProbes(suite: ReturnType<typeof createSuite>, role: Role, probes: Probe[], probed: Set<ApiMethod>): Promise<void> {
  const settled = await Promise.allSettled(probes.map((p) => p.run()));
  settled.forEach((s, i) => {
    const p = probes[i];
    probed.add(p.method);
    suite.test(`${role} · ${p.label} → ${p.expect}`, () => {
      if (s.status === 'fulfilled') {
        if (p.expect !== 'ok') throw new AssertionError(`expected ${p.expect}, got data`);
        p.check?.(s.value);
        return;
      }
      const code = codeOf(s.reason);
      if (p.expect === 'ok') throw new AssertionError(`expected data, got ${code}`);
      if (code !== p.expect) throw new AssertionError(`expected ${p.expect}, got ${code}`);
    });
  });
}

export async function runApiSmoke(): Promise<TestResult[]> {
  const suite = createSuite('api');
  const saved = getSession();
  const probed = new Set<ApiMethod>();
  const results: TestResult[] = [];
  try {
    // the demo reset is a director / AM action
    await api.loginDemo('director');
    await api.resetDemoData();
    results.push(...(await runScenarioChecks()));

    const fx = await collectFixtures();
    for (const role of ROLES) {
      let probes: Probe[] = [];
      try {
        probes = await probesFor(role, fx);
      } catch (err) {
        suite.test(`${role} · discover ids`, () => {
          throw err instanceof Error ? err : new Error(String(err));
        });
        continue;
      }
      await runProbes(suite, role, probes, probed);
      // the daily job may be triggered by any signed-in viewer
      await suite.testAsync(`${role} · runNotificationSweep(true) → ok`, async () => {
        const r = await api.runNotificationSweep(true);
        assert(typeof r.date === 'string' && typeof r.reminders === 'number', 'SweepResult');
      });
      probed.add('runNotificationSweep');
    }

    suite.test('every read method of Api was called', () => {
      const missing = READ_METHODS.filter((m) => !probed.has(m));
      assert(missing.length === 0, `not probed: ${missing.join(', ')}`);
    });
    suite.test('every read method of CrmApi was called', () => {
      const missing = CRM_READ_METHODS.filter((m) => !probed.has(m));
      assert(missing.length === 0, `not probed: ${missing.join(', ')}`);
    });
  } catch (err) {
    suite.test('api smoke run', () => {
      throw err instanceof Error ? err : new Error(String(err));
    });
  } finally {
    try {
      await api.loginDemo('director');
      await api.resetDemoData();
    } catch (err) {
      console.error('[apiSmoke] reset failed', err);
    }
    setSession(saved);
  }
  return [...results, ...suite.results];
}
