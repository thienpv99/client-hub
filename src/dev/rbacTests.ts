// Data-level RBAC self test (SPEC §2, §11): calls the real `api` (latency + sanitizer, exactly like the UI)
// as each role and deep-scans every response.
// Run in the browser: (await import('/src/dev/rbacTests')).runRbacTests().then(r => r.filter(x => !x.ok))
// The current session is restored at the end; the test runs on a private copy of the db (db.isolated) and rolls its
// changes back, so nothing it writes ever reaches the shared localStorage demo data.

import type { ID } from '@/domain/types';
import { nowISO, setNow, todayISO } from '@/domain/clock';
import { addDays } from '@/domain/dates';
import { api, setNetLogLimit } from '@/services/api';
import { clientMapApi } from '@/services/api/clientMap';
import { crmApi } from '@/services/api/crm';
import { projectsApi } from '@/services/api/projects';
import { ApiError, type TaskView } from '@/services/contract';
import type { LeadInput } from '@/services/crmContract';
import { getSession, setSession } from '@/services/context';
import { db, TABLES, type DbData } from '@/services/db';
import { CLIENT_FORBIDDEN_KEYS, COST_KEYS, CRM_ACTION_PREFIXES, isClientForbiddenKey, sanitizeOutgoing } from '@/services/sanitize';
import { AssertionError, assert, assertEqual, createSuite, type TestResult } from '@/dev/testkit';
import { careRbac } from '@/dev/careRbac';

const CX = 'acc_coxanh';
const MINH = 'u_client_minh';
const LAN = 'u_client_lan';
const DESIGN_APPROVAL = 't_coxanh_design_approval';

type Suite = ReturnType<typeof createSuite>;

interface Rule {
  forbiddenKeys: readonly string[];
  /** client rules: no object with visibility 'internal' / client_visible false anywhere */
  noInternal: boolean;
  /** texts that must never appear (hidden titles, internal notes, other companies) */
  forbiddenTexts: string[];
}

interface Probe {
  label: string;
  run: () => Promise<unknown>;
  /** 'ok' must succeed · 'forbidden' must fail with forbidden · 'denied' forbidden|not_found · none: either */
  expect?: 'ok' | 'forbidden' | 'denied';
}

interface Fixtures {
  hiddenTaskId: ID | null;
  visibleTaskIds: ID[];
  otherAccountId: ID;
  otherTaskId: ID | null;
  /** an account u_am_ha does not manage */
  notHaAccountId: ID | null;
  /** an account u_member_tuan has no task in */
  notTuanAccountId: ID | null;
  /** two task ids of the account u_am_ha does not manage */
  notHaTaskIds: ID[];
  /** Cỏ Xanh tasks carrying a quote (owner-only, commercial) */
  quoteTaskIds: ID[];
  /** Cỏ Xanh client tasks of Lan's colleagues (neither assigned to nor delegated by her, not commercial) */
  colleagueTaskIds: ID[];
  /** quote-approval / payment tasks on u_member_tuan's accounts that are not assigned to him */
  memberCommercialTaskIds: ID[];
  quoteId: ID | null;
  clientTexts: string[];
  otherNames: Map<ID, string>;
}

// ───────────────────────────── helpers ─────────────────────────────

function scan(value: unknown, rule: Rule, path: string, issues: string[]): void {
  if (issues.length >= 8) return;
  if (typeof value === 'string') {
    for (const text of rule.forbiddenTexts) {
      if (text && value.includes(text)) issues.push(`${path}: leaked “${text.slice(0, 48)}”`);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => scan(item, rule, `${path}[${i}]`, issues));
    return;
  }
  const obj = value as Record<string, unknown>;
  if (rule.noInternal) {
    if (obj.visibility === 'internal') issues.push(`${path}: visibility 'internal'`);
    if (obj.client_visible === false) issues.push(`${path}: client_visible false`);
  }
  for (const [key, child] of Object.entries(obj)) {
    // client rules also forbid the health-only keys (override_reason inside HealthInfo, not on milestones)
    if (rule.forbiddenKeys.includes(key) || (rule.noInternal && isClientForbiddenKey(obj, key))) {
      issues.push(`${path}.${key}: forbidden key`);
    }
    scan(child, rule, `${path}.${key}`, issues);
  }
}

function errorCode(err: unknown): string {
  return err instanceof ApiError ? err.code : `unexpected (${err instanceof Error ? err.message : String(err)})`;
}

async function expectCode(p: Promise<unknown>, codes: string[], label: string): Promise<void> {
  try {
    await p;
  } catch (err) {
    const code = errorCode(err);
    if (!codes.includes(code)) throw new AssertionError(`${label}: expected ${codes.join('|')}, got ${code}`);
    return;
  }
  throw new AssertionError(`${label}: expected ${codes.join('|')}, but the call succeeded`);
}

async function runProbes(suite: Suite, who: string, probes: Probe[], rule: Rule): Promise<void> {
  const settled = await Promise.allSettled(probes.map((p) => p.run()));
  settled.forEach((s, i) => {
    const p = probes[i];
    suite.test(`${who} · ${p.label}`, () => {
      if (s.status === 'fulfilled') {
        if (p.expect === 'forbidden' || p.expect === 'denied') throw new AssertionError(`expected ${p.expect}, got data`);
        const issues: string[] = [];
        scan(s.value, rule, p.label, issues);
        assert(issues.length === 0, issues.join(' | '));
        return;
      }
      const code = errorCode(s.reason);
      if (p.expect === 'ok') throw new AssertionError(`expected data, got ${code}`);
      if (p.expect === 'forbidden') assertEqual(code, 'forbidden', 'error code');
      else assert(code === 'forbidden' || code === 'not_found', `unexpected error ${code}`);
    });
  });
}

/** removes viewer-dependent fields (viewer block, permissions, primary action) before comparing */
function stripViewerFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripViewerFields);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'viewer' || k === 'can' || k === 'primary_action' || k === 'mine') continue;
    out[k] = stripViewerFields(v);
  }
  return out;
}

/** Roll the db back to a snapshot taken with db.dump() (one batch, one change event). */
function restoreSnapshot(snap: DbData): void {
  db.batch(() => {
    for (const table of TABLES) {
      const before = new Map<string, unknown>((snap[table] as { id: ID }[]).map((r) => [r.id, r]));
      for (const row of [...(db.allRows(table) as { id: ID }[])]) {
        const old = before.get(row.id);
        if (old === undefined) db.hardDelete(table, row.id);
        else if (JSON.stringify(old) !== JSON.stringify(row)) db.update(table, row.id, old as never);
      }
      const present = new Set((db.allRows(table) as { id: ID }[]).map((r) => r.id));
      for (const [id, old] of before) if (!present.has(id)) db.insert(table, old as never);
    }
    if (JSON.stringify(db.settings) !== JSON.stringify(snap.settings)) db.updateSettings(snap.settings);
  });
}

function readProbes(accountId: ID, fx: Fixtures, client: boolean): Probe[] {
  const taskIds = fx.visibleTaskIds.slice(0, 6);
  const probes: Probe[] = [
    { label: 'getDirectorDashboard', run: () => api.getDirectorDashboard(), expect: client ? 'forbidden' : undefined },
    { label: 'listAccounts', run: () => api.listAccounts(), expect: 'ok' },
    { label: 'getAccount(own)', run: () => api.getAccount(accountId), expect: 'ok' },
    { label: 'listProjects(own)', run: () => api.listProjects(accountId), expect: 'ok' },
    { label: 'listTasks()', run: () => api.listTasks(), expect: 'ok' },
    { label: 'listTasks(all)', run: () => api.listTasks({ openOnly: false }), expect: 'ok' },
    { label: 'listTasks(mine)', run: () => api.listTasks({ mine: true }), expect: 'ok' },
    { label: 'listTasks(own account)', run: () => api.listTasks({ accountId, openOnly: false }), expect: 'ok' },
    { label: 'listActivities(account)', run: () => api.listActivities({ accountId }), expect: 'ok' },
    { label: 'listActivities(approvals)', run: () => api.listActivities({ approvalsOnly: true, limit: 50 }), expect: 'ok' },
    { label: 'listFiles(account)', run: () => api.listFiles({ accountId }), expect: 'ok' },
    { label: 'listFiles()', run: () => api.listFiles({}), expect: 'ok' },
    { label: 'listContacts(own)', run: () => api.listContacts(accountId), expect: 'ok' },
    { label: 'listUsers', run: () => api.listUsers(), expect: 'ok' },
    { label: 'getPortalHome', run: () => api.getPortalHome(), expect: client ? 'ok' : 'forbidden' },
    { label: 'search(a)', run: () => api.search('a'), expect: 'ok' },
    { label: 'search(duyet)', run: () => api.search('duyet'), expect: 'ok' },
    { label: 'search(thinh an)', run: () => api.search('thinh an'), expect: 'ok' },
    { label: 'getSettings', run: () => api.getSettings(), expect: 'ok' },
    { label: 'listQuotes', run: () => api.listQuotes() },
    { label: 'listContracts', run: () => api.listContracts() },
    { label: 'listPayments', run: () => api.listPayments() },
    { label: 'getReceivables', run: () => api.getReceivables() },
    { label: 'listPriceItems', run: () => api.listPriceItems() },
    { label: 'listAccountPrices(own)', run: () => api.listAccountPrices(accountId) },
    { label: 'listNotifications', run: () => api.listNotifications() },
    { label: 'listOutbox', run: () => api.listOutbox() },
    { label: 'getWeeklyDigest', run: () => api.getWeeklyDigest() },
  ];
  for (const id of taskIds) {
    probes.push({ label: `getTask(${id})`, run: () => api.getTask(id) });
    probes.push({ label: `listActivities(task ${id})`, run: () => api.listActivities({ taskId: id }) });
    probes.push({ label: `listFiles(task ${id})`, run: () => api.listFiles({ taskId: id }) });
  }
  if (fx.quoteId) {
    const quoteId = fx.quoteId;
    probes.push({ label: 'getQuote', run: () => api.getQuote(quoteId) });
  }
  return probes;
}

// ───────────────────────────── fixtures (as director) ─────────────────────────────

async function collectFixtures(): Promise<Fixtures> {
  await api.loginDemo('director');
  const accounts = await api.listAccounts();
  const other = accounts.find((a) => a.id !== CX);
  if (!other) throw new AssertionError('seed needs at least two accounts');
  const [cxTasks, otherTasks, cxDetail, cxFiles, tuanTasks, quotes] = await Promise.all([
    api.listTasks({ accountId: CX, openOnly: false }),
    api.listTasks({ accountId: other.id, openOnly: false }),
    api.getAccount(CX),
    api.listFiles({ accountId: CX }),
    api.listTasks({ assigneeId: 'u_member_tuan', openOnly: false }),
    api.listQuotes({ accountId: CX }),
  ]);
  const details = await Promise.all(cxTasks.map((x) => api.getTask(x.id)));

  const hidden = cxTasks.filter((x) => x.side === 'internal' && !x.client_visible);
  const texts: string[] = [];
  hidden.forEach((x) => texts.push(x.title));
  for (const d of details) {
    d.comments.filter((c) => c.visibility === 'internal').forEach((c) => texts.push(c.body));
    if (d.manual_unblock_reason) texts.push(d.manual_unblock_reason);
  }
  if (cxDetail.internal_notes) texts.push(cxDetail.internal_notes);
  if (cxDetail.health.override_reason) texts.push(cxDetail.health.override_reason);
  cxDetail.contacts.forEach((c) => {
    if (c.last_interaction_note) texts.push(c.last_interaction_note);
  });
  const allFiles = cxFiles.flatMap((file) => [file, ...(file.older_versions ?? [])]);
  const sharedNames = new Set(allFiles.filter((x) => x.visibility === 'shared').map((x) => x.name));
  allFiles.filter((x) => x.visibility === 'internal' && !sharedNames.has(x.name)).forEach((x) => texts.push(x.name));
  const quoteDetails = await Promise.all(quotes.map((q) => api.getQuote(q.id)));
  quoteDetails.forEach((q) => {
    if (q.internal_note) texts.push(q.internal_note);
  });

  const otherNames = new Map<ID, string>(accounts.filter((a) => a.id !== CX).map((a) => [a.id, a.name]));
  const tuanAccounts = new Set(tuanTasks.map((x) => x.account.id));
  const clientQuote = quotes.find((q) => q.status === 'sent' || q.status === 'accepted' || q.status === 'changes_requested');
  const notHa = accounts.find((a) => a.am.id !== 'u_am_ha');
  const notHaTasks = notHa ? await api.listTasks({ accountId: notHa.id, openOnly: false }) : [];
  const commercial = (x: TaskView): boolean => x.quote_id !== null || x.payment_schedule_id !== null || x.type === 'payment';
  const tuanAccountTasks = (await Promise.all([...tuanAccounts].map((id) => api.listTasks({ accountId: id, openOnly: false })))).flat();
  return {
    hiddenTaskId: hidden.length ? hidden[0].id : null,
    visibleTaskIds: cxTasks.filter((x) => x.side === 'client' || x.client_visible).map((x) => x.id),
    otherAccountId: other.id,
    otherTaskId: otherTasks.length ? otherTasks[0].id : null,
    notHaAccountId: notHa ? notHa.id : null,
    notTuanAccountId: accounts.find((a) => !tuanAccounts.has(a.id))?.id ?? null,
    notHaTaskIds: notHaTasks.slice(0, 2).map((x) => x.id),
    quoteTaskIds: cxTasks.filter((x) => x.quote_id !== null).map((x) => x.id),
    colleagueTaskIds: cxTasks
      .filter((x) => x.side === 'client' && !commercial(x) && x.assignee?.id !== LAN && x.delegated_by?.id !== LAN)
      .map((x) => x.id),
    memberCommercialTaskIds: tuanAccountTasks.filter((x) => commercial(x) && x.assignee?.id !== 'u_member_tuan').map((x) => x.id),
    quoteId: clientQuote ? clientQuote.id : null,
    clientTexts: [...new Set(texts.filter((s) => s.trim().length >= 6))],
    otherNames,
  };
}

// ───────────────────────────── CRM extension (ARCHITECTURE §13) ─────────────────────────────

/** marker in every CRM text the test writes: it must never reach a client (nor a member's activity feeds) */
const CRM_SECRET = 'KIEMTHU_CRM';
/** keys only CRM DTOs carry (incl. the client map / ecosystems) */
const CRM_ONLY_KEYS = ['weighted_value', 'probability', 'fit', 'follow_up_overdue', 'whitespace', 'converted_account', 'ecosystem_id', 'fit_grade', 'lead_status', 'potential_value'];
/** activity actions of the client map (logged without an account: director feeds only) */
const ECOSYSTEM_ACTION_PREFIX = 'ecosystem.';

function leadInput(name: string, ownerId: ID | null): LeadInput {
  return {
    company_name: name,
    industry: 'Bán lẻ',
    province: 'TP. Hồ Chí Minh',
    size: '200_1000',
    revenue_band: '200b_1t',
    website: null,
    contact_name: 'Kiểm Thử',
    contact_title: 'Giám đốc',
    contact_salutation: 'anh',
    contact_email: 'kiemthu@kiemthu-crm.vn',
    contact_phone: null,
    source: 'event',
    owner_id: ownerId,
    tags: [CRM_SECRET],
    need_summary: `${CRM_SECRET} nhu cầu`,
    budget_estimate: 300_000_000,
    notes: null,
    next_follow_up_date: null,
  };
}

interface CrmIds {
  opp: ID;
  lead: ID;
  segment: ID;
  account: ID;
}

/** every CrmApi method with harmless arguments (refused before any change for clients and members) */
function crmCalls(ids: CrmIds): { label: string; run: () => Promise<unknown>; portfolio?: boolean }[] {
  const today = todayISO();
  return [
    { label: 'getCrmDashboard', run: () => api.getCrmDashboard() },
    { label: 'listFollowUps', run: () => api.listFollowUps({ range: 'all' }) },
    { label: 'listOpportunities', run: () => api.listOpportunities() },
    { label: 'getOpportunity', run: () => api.getOpportunity(ids.opp) },
    {
      label: 'createOpportunity',
      run: () =>
        api.createOpportunity({
          account_id: ids.account,
          name: `${CRM_SECRET} tạo`,
          value: 1,
          stage: 'qualified',
          expected_close_date: today,
          owner_id: 'u_am_ha',
          source: 'referral',
          price_item_ids: [],
          next_step: null,
          next_step_date: null,
          quote_id: null,
        }),
    },
    { label: 'updateOpportunity', run: () => api.updateOpportunity(ids.opp, { name: `${CRM_SECRET} sửa` }) },
    { label: 'moveOpportunityStage', run: () => api.moveOpportunityStage(ids.opp, 'proposal') },
    { label: 'winOpportunity', run: () => api.winOpportunity(ids.opp, { create_project: false, project_name: '', start_date: today, template_id: null }) },
    { label: 'loseOpportunity', run: () => api.loseOpportunity(ids.opp, 'kiểm thử') },
    { label: 'reopenOpportunity', run: () => api.reopenOpportunity(ids.opp) },
    { label: 'listLeads', run: () => api.listLeads() },
    { label: 'getLead', run: () => api.getLead(ids.lead) },
    { label: 'upsertLead', run: () => api.upsertLead(leadInput(`${CRM_SECRET} mới`, null)) },
    { label: 'setLeadStatus', run: () => api.setLeadStatus(ids.lead, 'contacted') },
    { label: 'assignLeads', run: () => api.assignLeads([ids.lead], null) },
    {
      label: 'convertLead',
      run: () => api.convertLead(ids.lead, { opportunity_name: 'x', value: 1, expected_close_date: today, owner_id: 'u_am_ha', tier: 'standard' }),
    },
    { label: 'listSegments', run: () => api.listSegments() },
    { label: 'previewSegment', run: () => api.previewSegment({ scope: 'all' }) },
    { label: 'getSegmentMembers', run: () => api.getSegmentMembers(ids.segment) },
    { label: 'saveSegment', run: () => api.saveSegment({ name: 'x', description: '', criteria: { scope: 'all' }, shared: false }) },
    { label: 'deleteSegment', run: () => api.deleteSegment(ids.segment) },
    { label: 'listTargetAccounts', run: () => api.listTargetAccounts() },
    { label: 'getIcp', run: () => api.getIcp() },
    { label: 'updateIcp', run: () => api.updateIcp({ name: 'x' }) },
    { label: 'getTargetingOptions', run: () => api.getTargetingOptions() },
    { label: 'listInteractions', run: () => api.listInteractions({}) },
    {
      label: 'logInteraction',
      run: () =>
        api.logInteraction({
          kind: 'call',
          occurred_at: nowISO(),
          subject: 'x',
          summary: '',
          outcome: null,
          account_id: ids.account,
          lead_id: null,
          opportunity_id: null,
          contact_id: null,
          next_follow_up_date: null,
        }),
    },
    { label: 'listProjectPortfolio', run: () => api.listProjectPortfolio(), portfolio: true },
    { label: 'getWorkload', run: () => api.getWorkload(), portfolio: true },
    // client map (bản đồ khách hàng) + business groups
    { label: 'getClientMap', run: () => api.getClientMap({ metric: 'total', includeLeads: true }) },
    { label: 'listEcosystems', run: () => api.listEcosystems() },
    {
      label: 'saveEcosystem',
      run: () => api.saveEcosystem({ name: `${CRM_SECRET} nhóm`, short_name: 'KT', description: '', industry: null, account_ids: [ids.account], lead_ids: [] }),
    },
  ];
}

/** texts / keys / actions of the CRM that must not appear in a payload */
function crmLeaks(value: unknown): string[] {
  const issues: string[] = [];
  const walk = (x: unknown, path: string): void => {
    if (issues.length >= 6) return;
    if (typeof x === 'string') {
      if (x.includes(CRM_SECRET)) issues.push(`${path}: CRM text`);
      return;
    }
    if (x === null || typeof x !== 'object') return;
    if (Array.isArray(x)) {
      x.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    const obj = x as Record<string, unknown>;
    if (typeof obj.action === 'string' && [...CRM_ACTION_PREFIXES, ECOSYSTEM_ACTION_PREFIX].some((p) => (obj.action as string).startsWith(p))) issues.push(`${path}: CRM activity ${obj.action}`);
    for (const [k, child] of Object.entries(obj)) {
      if (CRM_ONLY_KEYS.includes(k)) issues.push(`${path}.${k}: CRM key`);
      walk(child, `${path}.${k}`);
    }
  };
  walk(value, '');
  return issues;
}

async function crmRbac(suite: Suite): Promise<void> {
  const today = todayISO();
  // ── fixtures as the director (rolled back with the rest of the test)
  await api.loginDemo('director');
  const accounts = await api.listAccounts();
  const ducAccount = accounts.find((a) => a.am.id === 'u_am_ducanh');
  if (!ducAccount) {
    suite.test('crm · fixtures', () => assert(false, 'an account managed by Đức Anh'));
    return;
  }
  const oppInput = (accountId: ID, name: string, ownerId: ID) => ({
    account_id: accountId,
    name,
    value: 500_000_000,
    stage: 'discovery' as const,
    expected_close_date: addDays(today, 30),
    owner_id: ownerId,
    source: 'existing_customer' as const,
    price_item_ids: [],
    next_step: `${CRM_SECRET} gọi lại`,
    next_step_date: addDays(today, 2),
    quote_id: null,
  });
  const interaction = (accountId: ID, oppId: ID, subject: string) => ({
    kind: 'meeting' as const,
    occurred_at: nowISO(),
    subject,
    summary: `${CRM_SECRET} nội dung`,
    outcome: 'positive' as const,
    account_id: accountId,
    lead_id: null,
    opportunity_id: oppId,
    contact_id: null,
    next_follow_up_date: addDays(today, 3),
  });
  /** made as the director right before use: other tabs share (and may overwrite) the stored db mid-run */
  const scopeFixtures = async () => {
    await api.loginDemo('director');
    const cxOpp = await api.createOpportunity(oppInput(CX, `${CRM_SECRET} Cơ hội Cỏ Xanh`, 'u_am_ha'));
    await api.moveOpportunityStage(cxOpp.id, 'proposal');
    await api.logInteraction(interaction(CX, cxOpp.id, `${CRM_SECRET} họp Cỏ Xanh`));
    const ducOpp = await api.createOpportunity(oppInput(ducAccount.id, `${CRM_SECRET} Cơ hội của Đức Anh`, 'u_am_ducanh'));
    await api.logInteraction(interaction(ducAccount.id, ducOpp.id, `${CRM_SECRET} họp Đức Anh`));
    const ducLead = await api.upsertLead(leadInput(`${CRM_SECRET} Công ty của Đức Anh`, 'u_am_ducanh'));
    const poolLead = await api.upsertLead(leadInput(`${CRM_SECRET} Công ty chưa giao`, null));
    const privateSeg = await api.saveSegment({ name: `${CRM_SECRET} riêng`, description: '', criteria: { scope: 'all' }, shared: false });
    const sharedSeg = await api.saveSegment({ name: `${CRM_SECRET} chung`, description: '', criteria: { scope: 'leads' }, shared: true });
    return { cxOpp, ducOpp, ducLead, poolLead, privateSeg, sharedSeg };
  };
  const first = await scopeFixtures();
  const ids: CrmIds = { opp: first.cxOpp.id, lead: first.poolLead.id, segment: first.sharedSeg.id, account: CX };

  suite.test('crm · the forbidden-call list covers every CrmApi method', () => {
    const listed = new Set(crmCalls(ids).map((c) => c.label));
    const methods = [...Object.keys(crmApi), ...Object.keys(projectsApi), ...Object.keys(clientMapApi)];
    const missing = methods.filter((m) => !listed.has(m));
    assert(missing.length === 0, `not covered: ${missing.join(', ')}`);
  });

  // ── clients, view-as and members: forbidden everywhere (members: portfolio + workload only)
  const outsiders: { who: string; login: () => Promise<unknown>; member: boolean }[] = [
    { who: 'client_owner', login: () => api.loginDemo('client_owner'), member: false },
    { who: 'client_member', login: () => api.loginDemo('client_member'), member: false },
    {
      who: 'view-as-client',
      login: async () => {
        await api.loginDemo('director');
        await api.startViewAsClient(CX);
      },
      member: false,
    },
    { who: 'member', login: () => api.loginDemo('member'), member: true },
  ];
  for (const o of outsiders) {
    await o.login();
    for (const call of crmCalls(ids)) {
      const allowed = o.member && call.portfolio;
      await suite.testAsync(`crm · ${o.who} · ${call.label} → ${allowed ? 'ok' : 'forbidden'}`, async () => {
        if (allowed) {
          await call.run();
          return;
        }
        await expectCode(call.run(), ['forbidden'], call.label);
      });
    }
    await suite.testAsync(`crm · ${o.who} · no CRM data in account, activity, home and search responses`, async () => {
      const scope = o.member ? (await api.listAccounts()).map((a) => a.id) : [CX];
      const payloads: unknown[] = [await api.search(CRM_SECRET), await api.search('co hoi'), await api.listActivities({ limit: 300 })];
      for (const accountId of scope) {
        payloads.push(await api.getAccount(accountId), await api.listActivities({ accountId, limit: 300 }));
      }
      if (!o.member) payloads.push(await api.getPortalHome(), await api.listNotifications({ limit: 200 }), await api.listOutbox({ limit: 200 }));
      const issues = crmLeaks(payloads);
      assert(issues.length === 0, issues.join(' | '));
    });
    if (o.member) {
      await suite.testAsync('crm · member · portfolio and workload stay on the member’s accounts', async () => {
        const own = new Set((await api.listAccounts()).map((a) => a.id));
        const [rows, load] = await Promise.all([api.listProjectPortfolio(), api.getWorkload({ weeks: 4 })]);
        assert(rows.length > 0, 'member sees the projects they work on');
        assert(rows.every((r) => own.has(r.account.id)), 'portfolio rows of accessible accounts only');
        assertEqual(load.weeks.length, 4, 'weeks');
        assert(load.people.every((p) => p.accounts.every((a) => own.has(a.id)) && p.per_week.length === 4), 'workload accounts accessible');
      });
    }
    if (o.who === 'view-as-client') await api.stopViewAsClient();
  }

  // ── AM scope (Nguyễn Thu Hà): never Đức Anh's deals on his accounts, nor his leads, nor private segments
  const { cxOpp, ducOpp, ducLead, poolLead, privateSeg, sharedSeg } = await scopeFixtures();
  // a business group spanning both AMs (made by the director): an AM sees and edits only her side of it
  const mixedEco = await api.saveEcosystem({
    name: `${CRM_SECRET} Tập đoàn hai AM`,
    short_name: 'KT',
    description: `${CRM_SECRET} mô tả`,
    industry: null,
    account_ids: [CX, ducAccount.id],
    lead_ids: [ducLead.id, poolLead.id],
  });
  // a group made only of Đức Anh's companies: Hà may see its name (to join it), never read or rewrite its description
  const ducLead2 = await api.upsertLead(leadInput(`${CRM_SECRET} Công ty thứ hai của Đức Anh`, 'u_am_ducanh'));
  const foreignDescription = `${CRM_SECRET} mô tả riêng của Đức Anh`;
  const foreignEco = await api.saveEcosystem({
    name: `${CRM_SECRET} Tập đoàn của Đức Anh`,
    short_name: 'KD',
    description: foreignDescription,
    industry: 'Năng lượng',
    account_ids: [],
    lead_ids: [ducLead2.id],
  });
  await api.loginDemo('am');
  await suite.testAsync('crm · AM cannot read Đức Anh’s opportunity on his account', async () => {
    await expectCode(api.getOpportunity(ducOpp.id), ['forbidden'], 'getOpportunity');
    const [all, onHisAccount, dashboard, found, interactions] = await Promise.all([
      api.listOpportunities(),
      api.listOpportunities({ accountId: ducAccount.id }),
      api.getCrmDashboard(),
      api.search(CRM_SECRET),
      api.listInteractions({ limit: 500 }),
    ]);
    assert(!all.some((x) => x.id === ducOpp.id) && !onHisAccount.some((x) => x.id === ducOpp.id), 'not listed');
    assert(all.some((x) => x.id === cxOpp.id), 'own account deal listed');
    assert(!dashboard.top_opportunities.some((x) => x.id === ducOpp.id), 'not on the dashboard');
    assert(!found.some((r) => r.id === ducOpp.id || r.id === ducLead.id), 'not found by search');
    assert(found.some((r) => r.type === 'opportunity' && r.id === cxOpp.id), 'own deal found by search');
    assert(!interactions.some((i) => i.subject.includes('họp Đức Anh')), 'his touchpoints hidden');
    await expectCode(api.createOpportunity(oppInput(ducAccount.id, `${CRM_SECRET} x`, 'u_am_ha')), ['forbidden'], 'create on his account');
    await expectCode(api.listInteractions({ opportunityId: ducOpp.id }), ['forbidden'], 'interactions of his deal');
  });

  await suite.testAsync('crm · AM leads: own + team pool; assigns to themself only', async () => {
    await expectCode(api.getLead(ducLead.id), ['forbidden'], 'getLead(his lead)');
    const leads = await api.listLeads();
    assert(!leads.some((l) => l.id === ducLead.id), 'his lead not listed');
    assert(leads.some((l) => l.id === poolLead.id), 'team pool lead listed');
    assert(leads.every((l) => l.owner === null || l.owner.id === 'u_am_ha'), 'only own + unassigned');
    await expectCode(api.assignLeads([poolLead.id], 'u_am_ducanh'), ['forbidden'], 'assign to a colleague');
    const r = await api.assignLeads([poolLead.id], 'u_am_ha');
    assertEqual(r.updated, 1, 'assigned to themself');
    const after = await api.getLead(poolLead.id);
    assertEqual(after.owner?.id, 'u_am_ha', 'owner');
  });

  await suite.testAsync('crm · AM segments: own + shared; ICP read-only', async () => {
    const segments = await api.listSegments();
    assert(!segments.some((x) => x.id === privateSeg.id), 'private segment of the director hidden');
    assert(segments.some((x) => x.id === sharedSeg.id), 'shared segment visible');
    await expectCode(api.getSegmentMembers(privateSeg.id), ['forbidden'], 'members of a private segment');
    await expectCode(api.deleteSegment(sharedSeg.id), ['forbidden'], 'delete a shared segment of someone else');
    await expectCode(api.saveSegment({ id: sharedSeg.id, name: 'x', description: '', criteria: { scope: 'all' }, shared: true }), ['forbidden'], 'edit it');
    const icp = await api.getIcp();
    assert(icp.weights && typeof icp.weights.industry === 'number', 'ICP readable');
    await expectCode(api.updateIcp({ name: 'x' }), ['forbidden'], 'updateIcp (director only)');
    const targets = await api.listTargetAccounts();
    assert(targets.every((a) => a.am.id === 'u_am_ha'), 'target accounts = managed accounts');
  });

  await suite.testAsync('crm · AM client map: own accounts and leads only; a group shows only its visible side', async () => {
    const map = await api.getClientMap();
    const nodeIds = new Set(map.nodes.map((n) => n.id));
    assert(!nodeIds.has(`acc:${ducAccount.id}`) && !nodeIds.has(`lead:${ducLead.id}`), 'Đức Anh’s account and lead are not on her map');
    assert(map.nodes.filter((n) => n.kind === 'account').every((n) => n.owner?.id === 'u_am_ha'), 'accounts managed by Hà only');
    assert(map.nodes.filter((n) => n.kind === 'lead').every((n) => n.owner === null || n.owner.id === 'u_am_ha'), 'own + pool leads only');
    const hub = map.nodes.find((n) => n.id === `eco:${mixedEco.id}`);
    assert(hub, 'the mixed group has 2 visible members (Cỏ Xanh + a lead) → hub');
    const linked = map.links.filter((l) => l.source === hub.id).map((l) => l.target).sort();
    assertEqual(linked, [`acc:${CX}`, `lead:${poolLead.id}`].sort(), 'only the visible members are linked');
    const listed = (await api.listEcosystems()).find((e) => e.id === mixedEco.id);
    assert(listed && listed.members.every((m) => m.id !== ducAccount.id && m.id !== ducLead.id), 'listEcosystems: visible members only');
    await expectCode(
      api.saveEcosystem({ id: mixedEco.id, name: mixedEco.name, short_name: 'KT', description: '', industry: null, account_ids: [CX, ducAccount.id], lead_ids: [] }),
      ['forbidden'],
      'add an account she does not manage',
    );
    await expectCode(
      api.saveEcosystem({ name: `${CRM_SECRET} khác`, short_name: 'KT2', description: '', industry: null, account_ids: [], lead_ids: [ducLead.id] }),
      ['forbidden'],
      'add a lead of a colleague',
    );
    // Hà removes her side (Cỏ Xanh): Đức Anh's account and lead must stay in the group
    const saved = await api.saveEcosystem({ id: mixedEco.id, name: mixedEco.name, short_name: 'KT', description: '', industry: null, account_ids: [], lead_ids: [poolLead.id] });
    assertEqual(saved.members.map((m) => m.id), [poolLead.id], 'her view after the save');
  });

  await suite.testAsync('crm · AM: a group of another AM’s companies is listed by name only and cannot be rewritten', async () => {
    const listed = (await api.listEcosystems()).find((e) => e.id === foreignEco.id);
    assert(listed, 'listed (so she can join it)');
    assertEqual([listed.description, listed.industry, listed.members.length], ['', null, 0], 'name only');
    const same = { id: foreignEco.id, name: foreignEco.name, short_name: 'KD', description: '', industry: null, account_ids: [], lead_ids: [] };
    await expectCode(api.saveEcosystem({ ...same, name: `${CRM_SECRET} đổi tên` }), ['forbidden'], 'rename');
    await expectCode(api.saveEcosystem({ ...same, description: `${CRM_SECRET} viết lại` }), ['forbidden'], 'rewrite the description');
    await expectCode(api.saveEcosystem({ ...same, industry: 'Bán lẻ' }), ['forbidden'], 'change the industry');
    // joining with one of her customers keeps the stored fields
    const joined = await api.saveEcosystem({ ...same, account_ids: [CX] });
    assertEqual([joined.name, joined.description, joined.industry], [foreignEco.name, foreignDescription, 'Năng lượng'], 'fields kept on join');
  });

  // a client may still not see the deal the AM works on for its own company
  await api.loginDemo('client_owner');
  await suite.testAsync('crm · client_owner · Cỏ Xanh deal and touchpoints invisible', async () => {
    const issues = crmLeaks([await api.listActivities({ accountId: CX, limit: 300 }), await api.getAccount(CX), await api.listContacts(CX)]);
    assert(issues.length === 0, issues.join(' | '));
  });
  await suite.testAsync('crm · client_owner · business groups and the client map invisible', async () => {
    await expectCode(api.getClientMap(), ['forbidden'], 'getClientMap');
    await expectCode(api.listEcosystems(), ['forbidden'], 'listEcosystems');
    const payloads = [await api.getPortalHome(), await api.getAccount(CX), await api.listActivities({ limit: 300 }), await api.search('tap doan')];
    const issues = crmLeaks(payloads);
    const text = JSON.stringify(payloads);
    for (const name of ['Tập đoàn Cỏ Xanh', 'Hàng tiêu dùng Cỏ Xanh', 'Cỏ Xanh Logistics']) if (text.includes(name)) issues.push(`group / sister lead “${name}” leaked`);
    assert(issues.length === 0, issues.join(' | '));
  });
  await api.loginDemo('director');
  await suite.testAsync('crm · an AM edit keeps the group members out of her reach; the save is logged for the director', async () => {
    const full = (await api.listEcosystems()).find((e) => e.id === mixedEco.id);
    assert(full, 'group listed for the director');
    assertEqual(full.members.map((m) => m.id).sort(), [ducAccount.id, ducLead.id, poolLead.id].sort(), 'Đức Anh’s side kept, Cỏ Xanh removed');
    const acts = await api.listActivities({ limit: 300 });
    assert(acts.some((a) => a.action === 'ecosystem.saved' && a.target_id === mixedEco.id && a.visibility === 'internal' && a.account_id === null), 'ecosystem.saved logged (internal, no account)');
  });
}

// ───────────────────────────── the test ─────────────────────────────

/**
 * Runs on a private copy of the db (db.isolated): the test data never reaches localStorage, so another tab writing
 * mid-run can neither pick it up nor bring it back after the rollback (the shared demo data stays clean).
 */
export async function runRbacTests(): Promise<TestResult[]> {
  return db.isolated(runRbacSuite);
}

async function runRbacSuite(): Promise<TestResult[]> {
  const suite = createSuite('rbac');
  const savedSession = getSession();
  const snap = db.dump();
  // the closing network-log scan must see every client payload of this run, not the last 300 calls
  const prevNetLimit = setNetLogLimit(50_000);
  try {
    suite.test('sanitizeOutgoing strips client-forbidden keys and internal elements', () => {
      const raw = {
        cost_price: 1,
        nested: { margin: 2, internal_note: 'x', ok: 'y' },
        list: [{ visibility: 'internal', a: 1 }, { visibility: 'shared', a: 2 }, { client_visible: false }, { client_visible: true }],
      };
      const clean = sanitizeOutgoing(raw, null) as unknown as Record<string, unknown>;
      assertEqual(clean, { nested: { ok: 'y' }, list: [{ visibility: 'shared', a: 2 }, { client_visible: true }] }, 'client sanitize');
    });

    suite.test('sanitizeOutgoing: override_reason dropped inside HealthInfo only, kept on milestones', () => {
      const raw = {
        health: { value: 'attention', auto: 'blocked', overridden: true, override_reason: 'lý do nội bộ', reasons: [] },
        milestone: { id: 'm', forecast_source: 'manual', override_reason: 'Khách dời lịch UAT' },
      };
      assertEqual<unknown>(
        sanitizeOutgoing(raw, null),
        {
          // the effective colour only: no reason, no "set by hand" flag, no auto colour
          health: { value: 'attention', auto: 'attention', overridden: false, reasons: [] },
          milestone: { id: 'm', forecast_source: 'manual', override_reason: 'Khách dời lịch UAT' },
        },
        'client sanitize',
      );
      const v = api.getViewer();
      if (v && v.org_type === 'internal') {
        assertEqual(sanitizeOutgoing(raw, v), raw, 'internal viewers keep both reasons');
      }
    });

    let fx: Fixtures | null = null;
    await suite.testAsync('fixtures (director)', async () => {
      fx = await collectFixtures();
      assert(fx.visibleTaskIds.length > 0, 'Cỏ Xanh has visible tasks');
      assert(fx.hiddenTaskId !== null, 'Cỏ Xanh has an internal task hidden from the client');
    });
    const f = fx as Fixtures | null;
    if (!f) return suite.results;

    const otherNamesExcept = (keep: Set<ID>): string[] => [...f.otherNames].filter(([id]) => !keep.has(id)).map(([, name]) => name);

    // ── every read, every role
    const roles: { who: string; login: () => Promise<unknown>; client: boolean }[] = [
      { who: 'client_owner', login: () => api.loginDemo('client_owner'), client: true },
      { who: 'client_member', login: () => api.loginDemo('client_member'), client: true },
      { who: 'member', login: () => api.loginDemo('member'), client: false },
      { who: 'am (no cost)', login: () => api.loginDemo('am'), client: false },
      {
        who: 'view-as-client',
        login: async () => {
          await api.loginDemo('director');
          await api.startViewAsClient(CX);
        },
        client: true,
      },
    ];
    for (const role of roles) {
      await role.login();
      const v = api.getViewer();
      if (!v) {
        suite.test(`${role.who} · login`, () => assert(false, 'no viewer after login'));
        continue;
      }
      suite.test(`${role.who} · viewer`, () => {
        assert(!v.can_view_cost, 'viewer must not have cost permission');
        assertEqual(v.org_type, role.client ? 'client' : 'internal', 'org_type');
        if (role.who === 'view-as-client') assert(v.read_only && v.impersonating !== null, 'view-as is read-only');
      });
      let accountId: ID = CX;
      let keep = new Set<ID>([CX]);
      if (!role.client) {
        const accounts = await api.listAccounts();
        keep = new Set(accounts.map((a) => a.id));
        accountId = accounts.length ? accounts[0].id : CX;
      }
      const rule: Rule = role.client
        ? { forbiddenKeys: CLIENT_FORBIDDEN_KEYS, noInternal: true, forbiddenTexts: [...f.clientTexts, ...otherNamesExcept(keep)] }
        : { forbiddenKeys: COST_KEYS, noInternal: false, forbiddenTexts: otherNamesExcept(keep) };
      const probes = readProbes(accountId, role.client ? f : { ...f, visibleTaskIds: [] }, role.client);
      if (!role.client) {
        const tasks = await api.listTasks({ accountId, openOnly: false });
        tasks.slice(0, 4).forEach((x) => probes.push({ label: `getTask(${x.id})`, run: () => api.getTask(x.id) }));
      }

      // cross-account & hidden data (clients get not_found, like for an unknown id — no id probing)
      if (role.client) {
        const other = f.otherAccountId;
        probes.push(
          { label: 'getAccount(other company)', run: () => api.getAccount(other), expect: 'denied' },
          { label: 'listProjects(other company)', run: () => api.listProjects(other), expect: 'denied' },
          { label: 'listTasks(other company)', run: () => api.listTasks({ accountId: other }), expect: 'denied' },
          { label: 'listFiles(other company)', run: () => api.listFiles({ accountId: other }), expect: 'denied' },
          { label: 'listContacts(other company)', run: () => api.listContacts(other), expect: 'denied' },
          { label: 'listActivities(other company)', run: () => api.listActivities({ accountId: other }), expect: 'denied' },
        );
        if (f.otherTaskId) {
          const otherTask = f.otherTaskId;
          probes.push({ label: 'getTask(other company)', run: () => api.getTask(otherTask), expect: 'denied' });
        }
        if (f.hiddenTaskId) {
          const hidden = f.hiddenTaskId;
          probes.push({ label: 'getTask(hidden internal task)', run: () => api.getTask(hidden), expect: 'denied' });
        }
      }
      if (role.who === 'client_member') {
        probes.push(
          { label: 'commercial listQuotes', run: () => api.listQuotes(), expect: 'forbidden' },
          { label: 'commercial listContracts', run: () => api.listContracts(), expect: 'forbidden' },
          { label: 'commercial listPayments', run: () => api.listPayments(), expect: 'forbidden' },
        );
      }
      if (role.who === 'am (no cost)' && f.notHaAccountId) {
        const id = f.notHaAccountId;
        probes.push({ label: 'getAccount(not managed)', run: () => api.getAccount(id), expect: 'forbidden' });
      }
      if (role.who === 'member' && f.notTuanAccountId) {
        const id = f.notTuanAccountId;
        probes.push({ label: 'getAccount(no assigned task)', run: () => api.getAccount(id), expect: 'forbidden' });
        probes.push({ label: 'getDirectorDashboard (member)', run: () => api.getDirectorDashboard(), expect: 'forbidden' });
      }
      if (role.who === 'member') {
        // deals, internal quote notes, receivables and negotiated prices are the AM's and the director's
        probes.push(
          { label: 'listQuotes (member)', run: () => api.listQuotes(), expect: 'forbidden' },
          { label: 'getReceivables (member)', run: () => api.getReceivables(), expect: 'forbidden' },
          { label: 'listAccountPrices (member)', run: () => api.listAccountPrices(CX), expect: 'forbidden' },
        );
      }
      await runProbes(suite, role.who, probes, rule);

      if (role.client) {
        await suite.testAsync(`${role.who} · settings without New Era's internal policy`, async () => {
          const s = await api.getSettings();
          for (const key of ['discount_approval_threshold_pct', 'escalation_overdue_days', 'max_emails_per_day', 'payment_task_auto']) {
            assert(!(key in s), `${key} must be absent`);
          }
        });
      }

      if (role.who === 'client_member') {
        await suite.testAsync('client_member · account has no commercial block', async () => {
          const acc = await api.getAccount(CX);
          assertEqual(acc.commercial, null, 'commercial');
          assertEqual(acc.contract_value, 0, 'contract value hidden');
        });
        // SPEC §2: own tasks + overall progress — a colleague's task is named in a blocker list, never opened
        await suite.testAsync('client_member · a colleague’s task is neither listed nor opened', async () => {
          assert(f.colleagueTaskIds.length > 0, 'fixture: a client task of a colleague');
          const listed = await api.listTasks({ openOnly: false });
          assert(!listed.some((x) => f.colleagueTaskIds.includes(x.id)), 'not listed');
          for (const id of f.colleagueTaskIds) await expectCode(api.getTask(id), ['not_found'], `getTask(${id})`);
          const found = await api.search('duyet');
          assert(!found.some((r) => f.colleagueTaskIds.includes(r.id)), 'not found by search');
        });
      }

      if (role.who === 'member') {
        // the commercial module is director / AM / decision maker: no installment (name, amount, days) in a health
        // reason, no someone-else's invoice or approval task, no CRM interaction log on contacts
        await suite.testAsync('member · no overdue installment, commercial task or CRM note reaches a member', async () => {
          const accounts = await api.listAccounts();
          const payloads: unknown[] = [accounts, await api.listAccounts({ waitingClient: true }), await api.getWeeklyDigest()];
          for (const a of accounts) payloads.push(await api.getAccount(a.id), await api.listContacts(a.id));
          const text = JSON.stringify(payloads);
          assert(!text.includes('overdue_payment'), 'no overdue_payment health reason');
          const contacts = payloads.flatMap((p) => (p && typeof p === 'object' && 'contacts' in p ? (p as { contacts: { last_interaction_note: string | null; last_interaction_at: string | null }[] }).contacts : []));
          assert(contacts.length > 0 && contacts.every((c) => c.last_interaction_note === null && c.last_interaction_at === null), 'contacts carry no interaction log');
          const listed = await api.listTasks({ openOnly: false });
          assert(!listed.some((x) => f.memberCommercialTaskIds.includes(x.id)), 'commercial tasks of others not listed');
          for (const id of f.memberCommercialTaskIds) await expectCode(api.getTask(id), ['not_found', 'forbidden'], `getTask(${id})`);
        });

        // checkDependencies names the tasks of a cycle: someone else's quote-approval / payment task is refused when
        // passed in, and named neutrally when a cycle through existing dependencies runs over it
        await suite.testAsync('member · checkDependencies never names someone else’s quote-approval or payment task', async () => {
          const hiddenId = f.memberCommercialTaskIds[0];
          assert(hiddenId, 'fixture: a commercial task on the member’s accounts');
          for (const id of f.memberCommercialTaskIds) {
            await expectCode(api.checkDependencies({ blocks_task_ids: [id], blocked_by_task_ids: [id] }), ['validation', 'forbidden'], `self-cycle on ${id}`);
            await expectCode(api.checkDependencies({ blocks_task_ids: [], blocked_by_task_ids: [id] }), ['validation', 'forbidden'], `blocked by ${id}`);
          }
          // the dependencies written below are rolled back, so the later suites see the seed's graph
          const local = db.dump();
          try {
            await api.loginDemo('director');
            const hidden = await api.getTask(hiddenId);
            const plain = (await api.listTasks({ accountId: hidden.account.id, openOnly: false })).filter(
              (x) => x.status !== 'done' && x.quote_id === null && x.payment_schedule_id === null && x.type !== 'payment',
            );
            const [x, y] = plain;
            assert(x && y, 'fixture: two ordinary tasks on the same account');
            // x → hidden → y: x's only outgoing edge is the hidden task, so a cycle through x runs over it
            await api.updateTask(x.id, { blocks_task_ids: [hiddenId], impact_text: x.impact_text || 'Kiểm thử phụ thuộc.' });
            await api.updateTask(y.id, { blocked_by_task_ids: [hiddenId] });
            await api.loginDemo('member');
            const res = await api.checkDependencies({ blocks_task_ids: [x.id], blocked_by_task_ids: [y.id] });
            assert(!res.ok && Array.isArray(res.path) && res.path.length >= 4, 'the cycle is reported');
            assert(!JSON.stringify(res).includes(hidden.title), 'the hidden task is not named');
            assert(res.path?.includes(x.title) === true, 'a task the member may open is still named');
          } finally {
            restoreSnapshot(local);
            await api.loginDemo('member');
          }
        });
      }

      if (role.who === 'view-as-client') {
        const anyTask = f.visibleTaskIds[0];
        const mutations: [string, () => Promise<unknown>][] = [
          ['approveTask', () => api.approveTask(anyTask)],
          ['requestTaskChanges', () => api.requestTaskChanges(anyTask, 'kiểm thử')],
          ['confirmTask', () => api.confirmTask(anyTask)],
          ['answerTask', () => api.answerTask(anyTask, 'kiểm thử')],
          ['delegateTask', () => api.delegateTask(anyTask, { to_user_id: LAN })],
          ['askNewEra', () => api.askNewEra(anyTask, 'kiểm thử')],
          ['addComment', () => api.addComment(anyTask, 'kiểm thử', 'shared')],
          ['completeOnboarding', () => api.completeOnboarding()],
          ['updateMyPreferences', () => api.updateMyPreferences({ notification_pref: 'all' })],
          ['uploadFile', () => api.uploadFile(CX, { name: 'a.txt', mime: 'text/plain', size: 1, url: 'data:text/plain,a', visibility: 'shared', kind: 'other' })],
          ['inviteClientUser', () => api.inviteClientUser(CX, { full_name: 'Thử', email: 'thu@coxanh.vn', salutation: 'anh', title: '', role: 'client_member', decision_role: 'ops_contact' })],
          ['markNotificationsRead', () => api.markNotificationsRead()],
        ];
        if (f.quoteId) {
          const q = f.quoteId;
          mutations.push(['clientAcceptQuote', () => api.clientAcceptQuote(q)]);
        }
        for (const [name, call] of mutations) {
          await suite.testAsync(`view-as-client · ${name} → read_only`, () => expectCode(call(), ['read_only'], name));
        }
        await suite.testAsync('view-as-client · portal home equals the real client_owner’s', async () => {
          const asView = await api.getPortalHome();
          await api.loginDemo('client_owner');
          const asOwner = await api.getPortalHome();
          assertEqual(stripViewerFields(asView), stripViewerFields(asOwner), 'portal home');
        });
      }
    }

    // ── blocking rules (AM of Cỏ Xanh)
    await api.loginDemo('am');
    await suite.testAsync('blocked task cannot start; manual unblock needs a reason and is logged', async () => {
      const blocked = (await api.listTasks({ accountId: CX, blocked: true })).find((x) => x.side === 'internal');
      assert(blocked, 'Cỏ Xanh has a blocked internal task');
      await expectCode(api.setTaskStatus(blocked.id, 'in_progress'), ['blocked'], 'setTaskStatus(in_progress)');
      await expectCode(api.manualUnblock(blocked.id, '   '), ['validation'], 'manualUnblock(empty reason)');
      const unblocked = await api.manualUnblock(blocked.id, 'Kiểm thử RBAC: mở chặn thủ công');
      assertEqual(unblocked.blocked, false, 'task unblocked');
      assertEqual(unblocked.manual_unblock_reason, 'Kiểm thử RBAC: mở chặn thủ công', 'reason stored');
      const log = await api.listActivities({ taskId: blocked.id });
      const entry = log.find((a) => a.action === 'task.unblocked');
      assert(entry && entry.actor && entry.actor.id === 'u_am_ha', 'task.unblocked logged with actor');

      // the unblock waives the blockers it was given for, not a blocker added afterwards
      const blocker = await api.createTask({
        project_id: blocked.project_id,
        milestone_id: null,
        title: 'Kiểm thử RBAC: việc chặn mới',
        description: '',
        side: 'internal',
        type: 'work',
        assignee_id: null,
        requires_owner: false,
        due_date: addDays(todayISO(), 5),
        impact_text: 'Kiểm thử: việc phía sau phải chờ việc này.',
        client_visible: false,
        blocks_task_ids: [blocked.id],
        blocks_milestone_ids: [],
        blocked_by_task_ids: [],
      });
      const again = await api.getTask(blocked.id);
      assertEqual([again.blocked, again.manual_unblock_reason ?? null], [true, null], 'new blocker ends the manual unblock');
      assert(again.blocked_by.some((b) => b.id === blocker.id), 'the new blocker is listed');
      await expectCode(api.setTaskStatus(blocked.id, 'in_progress'), ['blocked'], 'cannot start again');
    });

    await suite.testAsync('AM: checkDependencies never resolves tasks of an account the AM does not manage', async () => {
      const [a, b] = f.notHaTaskIds;
      assert(a && b, 'fixture: two tasks of another AM’s account');
      await expectCode(api.checkDependencies({ blocks_task_ids: [a], blocked_by_task_ids: [b] }), ['validation', 'forbidden'], 'checkDependencies');
    });

    await suite.testAsync('Zalo text only for a client task the client can act on now', async () => {
      const hidden = f.hiddenTaskId;
      assert(hidden, 'fixture: hidden internal task');
      await expectCode(api.getZaloReminder(hidden), ['validation'], 'internal task');
    });

    // ── stored notifications follow the task's visibility
    await api.loginDemo('director');
    await suite.testAsync('hiding a task after notifying the client hides its bell items and mails', async () => {
      const shown = (await api.listTasks({ accountId: CX, side: 'internal', openOnly: false })).find((x) => x.client_visible);
      assert(shown, 'Cỏ Xanh has a client-visible New Era task');
      const body = 'Kiểm thử RBAC: bình luận gửi khách trước khi ẩn việc';
      await api.addComment(shown.id, body, 'shared');
      await api.setTaskClientVisible(shown.id, false);
      await api.loginDemo('client_owner');
      const [bell, mail] = await Promise.all([api.listNotifications(), api.listOutbox()]);
      const text = JSON.stringify([bell, mail]);
      assert(!text.includes(shown.id), 'no notification / mail points to the hidden task');
      assert(!text.includes(body), 'the comment sent before hiding is gone too');
      await api.loginDemo('director');
    });

    // ── the daily mail is rebuilt from current visibility: a task hidden after its mail was batched never reaches
    //    the client in the next day's summary (nor in a stored mail that names it)
    await suite.testAsync('a task hidden after its mail was batched stays out of the next daily mail', async () => {
      const lastSweep = db.meta.last_sweep_date;
      const tasks = await api.listTasks({ accountId: CX, openOnly: false });
      const first = tasks.find((x) => x.side === 'client' && x.status !== 'done' && x.assignee?.id === MINH);
      const target = tasks.find((x) => x.side === 'internal' && x.client_visible && x.status !== 'done');
      assert(first && target, 'fixture: an open client task of Minh and a client-visible New Era task');
      const secret = 'KIEMTHU_RBAC_VIEC_SE_AN';
      try {
        await api.runNotificationSweep(true);
        // two shared replies: the first uses Minh's mail of the day (if still free), the second is batched
        await api.addComment(first.id, 'Kiểm thử RBAC: trả lời thứ nhất', 'shared');
        await api.updateTask(target.id, { title: secret });
        await api.addComment(target.id, 'Kiểm thử RBAC: trả lời thứ hai', 'shared');
        await api.setTaskClientVisible(target.id, false);
        setNow(new Date(`${addDays(todayISO(), 1)}T09:00:00+07:00`));
        await api.runNotificationSweep(true);
        await api.loginDemo('client_owner');
        const [mail, bell] = await Promise.all([api.listOutbox({ limit: 500 }), api.listNotifications({ limit: 500 })]);
        const text = JSON.stringify([mail, bell]);
        assert(!text.includes(secret), 'the hidden task title is in no mail or bell item of the client');
        assert(!text.includes(target.id), 'no mail names the hidden task');
      } finally {
        setNow(null);
        db.updateMeta({ last_sweep_date: lastSweep });
        await api.loginDemo('director');
      }
    });

    // ── client_member: commercial tasks stay with the decision maker
    await suite.testAsync('client_member gets no quote-approval task', async () => {
      await api.loginDemo('client_member');
      const tasks = await api.listTasks({ openOnly: false });
      assert(!tasks.some((x) => x.quote_id !== null || x.payment_schedule_id !== null), 'no commercial task listed');
      for (const id of f.quoteTaskIds) await expectCode(api.getTask(id), ['not_found'], `getTask(${id})`);
      const found = await api.search('chap thuan');
      assert(!found.some((r) => f.quoteTaskIds.includes(r.id)), 'not found by search');
      await api.loginDemo('director');
    });

    // ── task detail: hidden milestones and raw dependency ids never reach a client
    await suite.testAsync('client task detail has no hidden milestone and no raw dependency ids', async () => {
      const detail = await api.getTask(DESIGN_APPROVAL);
      const secret = await api.createMilestone(detail.project_id, {
        name: 'Kiểm thử RBAC: mốc nội bộ',
        planned_date: addDays(todayISO(), 200),
        client_visible: false,
      });
      await api.updateTask(DESIGN_APPROVAL, { blocks_milestone_ids: [...detail.dependencies.blocks_milestone_ids, secret.id] });
      const internal = await api.getTask(DESIGN_APPROVAL);
      assert(internal.chain.some((n) => n.id === secret.id), 'internal chain reaches the hidden milestone');
      await api.loginDemo('client_owner');
      const seen = await api.getTask(DESIGN_APPROVAL);
      assert(!JSON.stringify(seen).includes(secret.id), 'hidden milestone id absent');
      assertEqual(seen.dependencies, { blocks_task_ids: [], blocks_milestone_ids: [], blocked_by_task_ids: [] }, 'dependencies');
      const last = seen.chain[seen.chain.length - 1];
      assert(last && last.kind === 'milestone' && last.label !== null, 'chain ends on a named milestone');
      await api.loginDemo('director');
    });

    // ── who may reset, impersonate, invite decision makers, share files, overwrite documents
    await suite.testAsync('demo reset, view-as and owner invites are limited', async () => {
      await api.loginDemo('client_owner');
      await expectCode(api.resetDemoData(), ['forbidden'], 'reset as client');
      await expectCode(
        api.inviteClientUser(CX, { full_name: 'Kiểm thử', email: 'kiemthu.owner@coxanh.vn', salutation: 'anh', title: '', role: 'client_owner', decision_role: 'decision_maker' }),
        ['forbidden'],
        'client owner invites a decision maker',
      );
      await api.loginDemo('member');
      await expectCode(api.resetDemoData(), ['forbidden'], 'reset as member');
      await expectCode(api.startViewAsClient(CX), ['forbidden'], 'member view-as');
      await api.loginDemo('director');
      await api.startViewAsClient(CX);
      await expectCode(api.resetDemoData(), ['read_only'], 'reset in view-as');
      await api.stopViewAsClient();
      setSession(null);
      await expectCode(api.resetDemoData(), ['unauthenticated'], 'reset signed out');
      await api.loginDemo('director');
    });

    await suite.testAsync('a client upload never becomes a version of a New Era document', async () => {
      const files = await api.listFiles({ accountId: CX });
      const targets = [files.find((x) => x.visibility === 'internal'), files.find((x) => x.visibility === 'shared' && x.uploaded_by.org_type === 'internal')];
      await api.loginDemo('client_owner');
      for (const target of targets) {
        if (!target) continue;
        const up = await api.uploadFile(CX, {
          name: 'Kiểm thử RBAC.pdf',
          mime: 'application/pdf',
          size: 10,
          url: 'data:application/pdf;base64,AA==',
          visibility: 'shared',
          kind: 'document',
          doc_key: target.doc_key,
        });
        assert(up.doc_key !== target.doc_key && up.version === 1, `own document group, v1 (target ${target.visibility})`);
      }
      await api.loginDemo('director');
    });

    await suite.testAsync('clients: another company’s id answers like an unknown id', async () => {
      await api.loginDemo('client_owner');
      const otherTask = f.otherTaskId;
      assert(otherTask, 'fixture: a task of another company');
      await expectCode(api.getTask(otherTask), ['not_found'], 'other company task');
      await expectCode(api.getTask('t_khong_ton_tai'), ['not_found'], 'unknown task');
      await expectCode(api.getAccount(f.otherAccountId), ['not_found'], 'other company account');
      await api.loginDemo('am');
    });

    // ── manual forecast reason is shared with the client; the health override reason is not (SPEC 5.4, §2)
    await suite.testAsync('client sees the manual forecast reason but never the health override reason', async () => {
      const forecastReason = 'Kiểm thử RBAC: nhà cung cấp dời lịch khảo sát';
      const healthReason = 'Kiểm thử RBAC: lý do nội bộ của AM';
      const projects = await api.listProjects(CX);
      const target = projects
        .flatMap((p) => p.milestones)
        .find((m) => m.status !== 'done' && m.client_visible && m.forecast_source === 'on_plan');
      assert(target, 'Cỏ Xanh has an on-plan client-visible milestone');
      const overridden = await api.overrideForecast(target.id, addDays(target.planned_date, 3), forecastReason);
      assertEqual([overridden.forecast_source, overridden.override_reason], ['manual', forecastReason], 'AM view of the override');
      const acc = await api.overrideHealth(CX, 'attention', healthReason);
      assertEqual(acc.health.override_reason, healthReason, 'AM sees the health override reason');

      await api.loginDemo('client_owner');
      const clientProjects = await api.listProjects(CX);
      const seen = clientProjects.flatMap((p) => p.milestones).find((m) => m.id === target.id);
      assert(seen, 'client sees the milestone');
      assertEqual([seen.forecast_source, seen.override_reason], ['manual', forecastReason], 'client sees “lý do nếu lùi”');
      const [detail, home] = await Promise.all([api.getAccount(CX), api.getPortalHome()]);
      for (const [label, health] of [['getAccount', detail.health], ['getPortalHome', home.health]] as const) {
        assert(!('override_reason' in health), `${label}: health.override_reason must be absent`);
        // only the effective colour: neither the manual flag nor the auto colour it replaced
        assertEqual([health.value, health.auto, health.overridden], ['attention', 'attention', false], `${label}: effective colour only`);
      }
      assertEqual(detail.health_override, null, 'AccountDetail.health_override hidden');
      assertEqual(home.status_line.kind, 'generic', 'the band of an overridden account is the neutral sentence');
      assert(!JSON.stringify([detail, home]).includes(healthReason), 'health override reason text never reaches the client');
      await api.loginDemo('am');
    });

    // ── client approval is logged and can be undone
    await api.loginDemo('client_owner');
    await suite.testAsync('client approve → logged with actor & time → undo restores', async () => {
      const mine: TaskView[] = await api.listTasks({ mine: true });
      const target = mine.find((x) => x.primary_action === 'approve' && !x.quote_id) ?? mine.find((x) => x.primary_action === 'approve');
      assert(target, 'client_owner has a task to approve');
      const result = await api.approveTask(target.id, 'Kiểm thử');
      assertEqual(result.task.status, 'done', 'approved task is done');
      assert(result.undo_token, 'undo token returned');
      assertEqual(result.message_key, 'task.toast.approved', 'message key');
      const log = await api.listActivities({ taskId: target.id });
      const entry = log.find((a) => a.action === 'task.approved');
      assert(entry && entry.actor && entry.actor.id === MINH && !!entry.created_at, 'approval logged with actor and time');
      const restored = await api.undoAction(result.undo_token as string);
      assertEqual(restored.status, target.status, 'status restored');
      assertEqual(restored.waiting_on, 'client', 'waiting on client again');
      await expectCode(api.undoAction(result.undo_token as string), ['conflict'], 'second undo');
    });

    await suite.testAsync('undo is refused once New Era changed what the action touched', async () => {
      const mine: TaskView[] = await api.listTasks({ mine: true });
      const target = mine.find((x) => x.primary_action === 'approve' && !x.quote_id);
      assert(target, 'client_owner has a task to approve');
      const result = await api.approveTask(target.id);
      assert(result.undo_token, 'undo token returned');
      await api.loginDemo('am');
      await api.updateTask(target.id, { impact_text: 'Kiểm thử RBAC: AM vừa sửa câu hệ quả' });
      await api.loginDemo('client_owner');
      await expectCode(api.undoAction(result.undo_token as string), ['conflict'], 'undo after an AM edit');
      const after = await api.getTask(target.id);
      assertEqual([after.status, after.impact_text], ['done', 'Kiểm thử RBAC: AM vừa sửa câu hệ quả'], 'nothing reverted');
    });

    // ── CRM extension: clients / view-as / members refused, AM scope, no CRM data outside director & AM
    await crmRbac(suite);

    // ── client care refocus (SPEC-CARE §5): every CareApi method × role, client-safe fields, members without care data.
    // Starts from the seeded data: the CRM checks above move Cỏ Xanh between test groups, and the care checks read
    // group membership (relation scope, group matrix).
    restoreSnapshot(snap);
    await careRbac(suite);

    // ── nothing a client received was unsanitized
    suite.test('network log · client payloads carry no forbidden keys', () => {
      const log = typeof window !== 'undefined' && Array.isArray(window.__CH_NET__) ? window.__CH_NET__ : [];
      const issues: string[] = [];
      log
        .filter((e) => e.role === 'client_owner' || e.role === 'client_member')
        .forEach((e, i) => scan(e.payload, { forbiddenKeys: CLIENT_FORBIDDEN_KEYS, noInternal: true, forbiddenTexts: [] }, `${e.method}#${i}`, issues));
      assert(issues.length === 0, issues.join(' | '));
    });

    suite.test('network log · no CRM data in any client or member payload', () => {
      const log = typeof window !== 'undefined' && Array.isArray(window.__CH_NET__) ? window.__CH_NET__ : [];
      const issues = log
        .filter((e) => e.role === 'client_owner' || e.role === 'client_member' || e.role === 'member')
        .flatMap((e, i) => crmLeaks(e.payload).map((x) => `${e.method}#${i}${x}`))
        .slice(0, 8);
      assert(issues.length === 0, issues.join(' | '));
    });
  } catch (err) {
    suite.test('rbac run', () => {
      throw err instanceof Error ? err : new Error(String(err));
    });
  } finally {
    try {
      restoreSnapshot(snap);
    } catch (err) {
      console.error('[rbacTests] restore failed', err);
    }
    setSession(savedSession);
    setNetLogLimit(prevNetLimit);
  }
  return suite.results;
}
