// RBAC of the client care refocus (SPEC-CARE §5), run inside runRbacTests (private db copy, rolled back at the end):
// every CareApi method × every role (client_owner, client_member, view-as-client, member, AM, director), cross-account
// access, read-only view-as, the client-safe fields of client payloads, members without expansion / relationship /
// care data (also in their activity feeds).

import type { ID } from '@/domain/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/contract';
import { CARE_MANAGER_ACTION_PREFIXES, isClientForbiddenKey } from '@/services/sanitize';
import { AssertionError, assert, assertEqual, type createSuite } from '@/dev/testkit';

type Suite = ReturnType<typeof createSuite>;

const CX = 'acc_coxanh';
/** Đức Anh's account: not managed by the AM demo login (Hà) */
const MT = 'acc_maytrang';
/** an account the member demo login (Tuấn) has no task in */
const NOT_TUAN = 'acc_vanxuan';
/** a Cỏ Xanh request owned by the member demo login (Tuấn) */
const TUAN_CR = 'cr_coxanh_03';
/** a Cỏ Xanh request NOT owned by Tuấn */
const OTHER_CR = 'cr_coxanh_04';
/** a Mây Trắng request (another company for Cỏ Xanh's clients) */
const MT_CR = 'cr_maytrang_07';
const CARE_SECRET = 'KIEMTHU_CARE_NOIBO';

/** keys a client must never receive from the care DTOs, wherever they sit */
const CLIENT_CARE_KEYS = ['contract_value', 'adoption', 'notes', 'owner', 'owner_id', 'plan_ref', 'task_id', 'task', 'internal_note', 'flags', 'triaged_at', 'priority', 'source'];

type Expect = 'ok' | 'forbidden' | 'not_found' | 'read_only' | 'denied';

function codeOf(err: unknown): string {
  return err instanceof ApiError ? err.code : `unexpected (${err instanceof Error ? err.message : String(err)})`;
}

async function check(suite: Suite, label: string, run: () => Promise<unknown>, expect: Expect, inspect?: (value: unknown) => void): Promise<void> {
  await suite.testAsync(label, async () => {
    let value: unknown;
    try {
      value = await run();
    } catch (err) {
      const code = codeOf(err);
      if (expect === 'ok') throw new AssertionError(`expected data, got ${code}`);
      if (expect === 'denied') assert(code === 'forbidden' || code === 'not_found', `expected forbidden|not_found, got ${code}`);
      else assertEqual(code, expect, 'error code');
      return;
    }
    if (expect !== 'ok') throw new AssertionError(`expected ${expect}, got data`);
    inspect?.(value);
  });
}

/**
 * deep scan: no client-forbidden key (shape-aware rule of sanitize.ts), no internal element, no planted internal text;
 * `strict` (care DTOs) also refuses the care-internal key names anywhere (activity params legitimately carry `task`).
 */
function clientScan(value: unknown, path: string, issues: string[], strict: boolean): void {
  if (issues.length >= 6 || value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.includes(CARE_SECRET)) issues.push(`${path}: leaked internal text`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((x, i) => clientScan(x, `${path}[${i}]`, issues, strict));
    return;
  }
  const obj = value as Record<string, unknown>;
  if (obj.visibility === 'internal') issues.push(`${path}: visibility internal`);
  for (const [k, v] of Object.entries(obj)) {
    if (isClientForbiddenKey(obj, k) || (strict && CLIENT_CARE_KEYS.includes(k))) issues.push(`${path}.${k}`);
    clientScan(v, `${path}.${k}`, issues, strict);
  }
}

function assertClientSafe(value: unknown, label: string, strict = true): void {
  const issues: string[] = [];
  clientScan(value, label, issues, strict);
  assert(issues.length === 0, issues.join(' | '));
}

const deploymentInput = (accountId: ID) => ({
  account_id: accountId,
  project_id: null,
  name: 'Kiểm thử RBAC: giải pháp',
  category: 'support' as const,
  summary: 'Thử',
  status: 'pilot' as const,
  go_live_date: null,
  departments: [],
  active_users: null,
  contract_value: 1,
  adoption: null,
  notes: CARE_SECRET,
});

export async function careRbac(suite: Suite): Promise<void> {
  // ── director: plant internal text the clients must never see
  await api.loginDemo('director');
  await suite.testAsync('care · director plants internal notes on a client-visible request and solution', async () => {
    await api.updateChangeRequest('cr_coxanh_06', { internal_note: CARE_SECRET, plan_ref: CARE_SECRET });
    const dep = (await api.getAccountCare(CX)).deployments.find((d) => d.status === 'live');
    assert(dep, 'a live Cỏ Xanh solution');
    await api.saveDeployment({ ...deploymentInput(CX), id: dep.id, name: dep.name, category: dep.category, summary: dep.summary, status: dep.status, go_live_date: dep.go_live_date, departments: dep.departments, active_users: dep.active_users, contract_value: dep.contract_value, adoption: dep.adoption, notes: CARE_SECRET, owner_id: dep.owner?.id ?? null });
  });
  await check(suite, 'care · director · getCarePortfolio', () => api.getCarePortfolio(), 'ok', (x) => assert(Array.isArray(x) && x.length === 9, 'all nine accounts'));
  await check(suite, 'care · director · getGroupMatrix(eco_giongan)', () => api.getGroupMatrix('eco_giongan'), 'ok');
  await check(suite, 'care · director · getGroupMatrix(unknown)', () => api.getGroupMatrix('eco_khong_co'), 'not_found');
  await check(suite, 'care · director · listMyRequests', () => api.listMyRequests(), 'forbidden');
  await check(suite, 'care · director · listClientDeployments', () => api.listClientDeployments(), 'forbidden');
  await check(suite, 'care · director · submitRequest', () => api.submitRequest({ title: 'x', description: '' }), 'forbidden');

  // ── AM (Hà): own accounts only
  await api.loginDemo('am');
  await check(suite, 'care · am · getCarePortfolio (own accounts)', () => api.getCarePortfolio(), 'ok', (x) => {
    const ids = (x as { account: { id: ID } }[]).map((r) => r.account.id);
    assert(ids.includes(CX) && !ids.includes(MT), `own accounts only (${ids.join(', ')})`);
  });
  await check(suite, 'care · am · getAccountCare(own)', () => api.getAccountCare(CX), 'ok', (x) => assert((x as { can_manage: boolean }).can_manage, 'can manage'));
  await check(suite, 'care · am · getAccountCare(not managed)', () => api.getAccountCare(MT), 'forbidden');
  await check(suite, 'care · am · listChangeRequests(not managed)', () => api.listChangeRequests({ accountId: MT }), 'forbidden');
  await check(suite, 'care · am · listChangeRequests() stays in scope', () => api.listChangeRequests(), 'ok', (x) =>
    assert((x as { account: { id: ID } }[]).every((r) => r.account.id !== MT), 'no Mây Trắng request'),
  );
  await check(suite, 'care · am · updateChangeRequest(not managed)', () => api.updateChangeRequest(MT_CR, { status: 'triaged' }), 'forbidden');
  await check(suite, 'care · am · saveDeployment(not managed)', () => api.saveDeployment(deploymentInput(MT)), 'forbidden');
  await check(suite, 'care · am · saveDepartment(not managed)', () => api.saveDepartment({ account_id: MT, department: 'hr', status: 'not_fit' }), 'forbidden');
  await check(suite, 'care · am · saveStakeholder(not managed)', () => api.saveStakeholder({ contact_id: 'ct_maytrang_binh', stance: 'skeptic' }), 'forbidden');
  await check(suite, 'care · am · saveCarePlan(not managed)', () => api.saveCarePlan(MT, { cadence_days: 7 }), 'forbidden');
  await check(suite, 'care · am · saveRelationLink(neither end managed)', () => api.saveRelationLink({ from_contact_id: 'ct_giongan_phuong', to_contact_id: 'ct_thientruong_hung', kind: 'works_with', note: null }), 'forbidden');
  await check(suite, 'care · am · getGroupMatrix(group with one of her companies)', () => api.getGroupMatrix('eco_coxanh'), 'ok', (x) => {
    const units = (x as { units: { account: { id: ID } }[] }).units.map((u) => u.account.id);
    assertEqual(units, [CX], 'only her company is a unit');
  });
  await check(suite, 'care · am · getGroupMatrix(group without her companies)', () => api.getGroupMatrix('eco_giongan'), 'forbidden');
  await check(suite, 'care · am · saveDepartment(own) writes a manager-only line', () => api.saveDepartment({ account_id: CX, department: 'hr', status: 'not_fit', need_note: 'Kiểm thử RBAC' }), 'ok');
  await check(suite, 'care · am · listMyRequests', () => api.listMyRequests(), 'forbidden');

  // ── member (Tuấn): deployments + requests only, no expansion / people / care
  await api.loginDemo('member');
  await check(suite, 'care · member · getCarePortfolio', () => api.getCarePortfolio(), 'forbidden');
  await check(suite, 'care · member · getGroupMatrix', () => api.getGroupMatrix('eco_coxanh'), 'forbidden');
  await check(suite, 'care · member · getAccountCare(accessible)', () => api.getAccountCare(CX), 'ok', (x) => {
    const v = x as Record<string, unknown> & { deployments: Record<string, unknown>[] };
    for (const k of ['departments', 'stakeholders', 'relations', 'care', 'expansion', 'key_people']) assertEqual(v[k], null, k);
    assert(v.deployments.length > 0 && v.deployments.every((d) => d.contract_value === undefined || d.contract_value === null), 'no contract value');
    assertEqual(v.can_manage, false, 'cannot manage');
  });
  await check(suite, 'care · member · getAccountCare(no task there)', () => api.getAccountCare(NOT_TUAN), 'forbidden');
  await check(suite, 'care · member · listChangeRequests', () => api.listChangeRequests({ accountId: CX }), 'ok');
  await check(suite, 'care · member · createChangeRequest (internal, account access)', () => api.createChangeRequest({ account_id: CX, title: 'Kiểm thử RBAC: thành viên ghi yêu cầu', description: '', source: 'chat' }), 'ok');
  await check(suite, 'care · member · updateChangeRequest(owner)', () => api.updateChangeRequest(TUAN_CR, { internal_note: 'Kiểm thử RBAC: người phụ trách cập nhật' }), 'ok');
  await check(suite, 'care · member · updateChangeRequest(owner cannot reassign)', () => api.updateChangeRequest(TUAN_CR, { owner_id: 'u_member_quang' }), 'forbidden');
  await check(suite, 'care · member · updateChangeRequest(not owner)', () => api.updateChangeRequest(OTHER_CR, { status: 'planned' }), 'forbidden');
  await check(suite, 'care · member · saveDeployment', () => api.saveDeployment(deploymentInput(CX)), 'forbidden');
  await check(suite, 'care · member · saveDepartment', () => api.saveDepartment({ account_id: CX, department: 'hr', status: 'not_fit' }), 'forbidden');
  await check(suite, 'care · member · saveStakeholder', () => api.saveStakeholder({ contact_id: 'ct_coxanh_minh', stance: 'blocker' }), 'forbidden');
  await check(suite, 'care · member · saveRelationLink', () => api.saveRelationLink({ from_contact_id: 'ct_coxanh_minh', to_contact_id: 'ct_coxanh_lan', kind: 'works_with', note: null }), 'forbidden');
  await check(suite, 'care · member · saveCarePlan', () => api.saveCarePlan(CX, { cadence_days: 7 }), 'forbidden');
  await check(suite, 'care · member · listMyRequests', () => api.listMyRequests(), 'forbidden');
  await check(suite, 'care · member · activity feed has no expansion / people / care lines', () => api.listActivities({ accountId: CX, limit: 200 }), 'ok', (x) => {
    const bad = (x as { action: string }[]).filter((a) => CARE_MANAGER_ACTION_PREFIXES.some((p) => a.action.startsWith(p)));
    assertEqual(bad.length, 0, 'manager-only care lines');
  });

  // ── clients: own account, client-safe fields only, every internal read refused
  for (const role of ['client_owner', 'client_member'] as const) {
    await api.loginDemo(role);
    await check(suite, `care · ${role} · listMyRequests`, () => api.listMyRequests(), 'ok', (x) => {
      assertClientSafe(x, 'listMyRequests');
      const codes = (x as { code: string; title: string }[]).map((r) => r.title);
      assert(codes.length >= 9 && !codes.some((t) => t.includes('chủ hàng tự tra cứu')), 'own company only');
    });
    await check(suite, `care · ${role} · listClientDeployments`, () => api.listClientDeployments(), 'ok', (x) => {
      assertClientSafe(x, 'listClientDeployments');
      assert((x as { status: string }[]).every((d) => d.status !== 'retired'), 'no retired solution');
    });
    await check(suite, `care · ${role} · submitRequest`, () => api.submitRequest({ title: `Kiểm thử RBAC: ${role} gửi yêu cầu`, description: '' }), 'ok', (x) => assertClientSafe(x, 'submitRequest'));
    await check(suite, `care · ${role} · submitRequest(other company's project)`, () => api.submitRequest({ title: 'x', description: '', project_id: 'prj_maytrang_ops' }), 'denied');
    await check(suite, `care · ${role} · getCarePortfolio`, () => api.getCarePortfolio(), 'forbidden');
    await check(suite, `care · ${role} · getAccountCare(own)`, () => api.getAccountCare(CX), 'forbidden');
    await check(suite, `care · ${role} · getAccountCare(other company)`, () => api.getAccountCare(MT), 'forbidden');
    await check(suite, `care · ${role} · listChangeRequests`, () => api.listChangeRequests({ accountId: CX }), 'forbidden');
    await check(suite, `care · ${role} · getGroupMatrix`, () => api.getGroupMatrix('eco_coxanh'), 'forbidden');
    await check(suite, `care · ${role} · createChangeRequest`, () => api.createChangeRequest({ account_id: CX, title: 'x', description: '', source: 'email' }), 'forbidden');
    await check(suite, `care · ${role} · updateChangeRequest`, () => api.updateChangeRequest(TUAN_CR, { status: 'done' }), 'forbidden');
    await check(suite, `care · ${role} · saveDeployment`, () => api.saveDeployment(deploymentInput(CX)), 'forbidden');
    await check(suite, `care · ${role} · saveDepartment`, () => api.saveDepartment({ account_id: CX, department: 'hr', status: 'engaged' }), 'forbidden');
    await check(suite, `care · ${role} · saveStakeholder`, () => api.saveStakeholder({ contact_id: 'ct_coxanh_minh', stance: 'champion' }), 'forbidden');
    await check(suite, `care · ${role} · saveRelationLink`, () => api.saveRelationLink({ from_contact_id: 'ct_coxanh_minh', to_contact_id: 'ct_coxanh_lan', kind: 'works_with', note: null }), 'forbidden');
    await check(suite, `care · ${role} · deleteRelationLink`, () => api.deleteRelationLink('rel_cx_ops'), 'forbidden');
    await check(suite, `care · ${role} · deleteDeployment`, () => api.deleteDeployment('dpl_coxanh_app'), 'forbidden');
    await check(suite, `care · ${role} · saveCarePlan`, () => api.saveCarePlan(CX, { cadence_days: 7 }), 'forbidden');
    await check(suite, `care · ${role} · activity feed: request lines shared, no internal care lines`, () => api.listActivities({ accountId: CX, limit: 200 }), 'ok', (x) => {
      const list = x as { action: string; visibility: string }[];
      assert(list.some((a) => a.action.startsWith('change_request.')), 'shared request lines visible');
      assert(!list.some((a) => /^(deployment|department|stakeholder|relation|care_plan)\./.test(a.action) || a.visibility === 'internal'), 'no internal care lines');
      assertClientSafe(x, 'listActivities', false);
    });
  }

  // ── view-as-client: a read-only client
  await api.loginDemo('director');
  await api.startViewAsClient(CX);
  await check(suite, 'care · view-as-client · listMyRequests (read)', () => api.listMyRequests(), 'ok', (x) => assertClientSafe(x, 'view-as listMyRequests'));
  await check(suite, 'care · view-as-client · listClientDeployments (read)', () => api.listClientDeployments(), 'ok', (x) => assertClientSafe(x, 'view-as listClientDeployments'));
  await check(suite, 'care · view-as-client · submitRequest → read_only', () => api.submitRequest({ title: 'Kiểm thử', description: '' }), 'read_only');
  await check(suite, 'care · view-as-client · getAccountCare → forbidden', () => api.getAccountCare(CX), 'forbidden');
  await check(suite, 'care · view-as-client · updateChangeRequest → forbidden', () => api.updateChangeRequest(TUAN_CR, { status: 'done' }), 'forbidden');
  await check(suite, 'care · view-as-client · saveDepartment → forbidden', () => api.saveDepartment({ account_id: CX, department: 'hr', status: 'engaged' }), 'forbidden');
  await viewAsInternalMethods(suite, 'view-as-client');
  await api.stopViewAsClient();

  // ── the AM previewing her own client: the same read-only client
  await api.loginDemo('am');
  await api.startViewAsClient(CX);
  await check(suite, 'care · am view-as (own account) · listMyRequests (read)', () => api.listMyRequests(), 'ok', (x) => assertClientSafe(x, 'am view-as listMyRequests'));
  await check(suite, 'care · am view-as (own account) · submitRequest → read_only', () => api.submitRequest({ title: 'Kiểm thử', description: '' }), 'read_only');
  await check(suite, 'care · am view-as (own account) · getAccountCare → forbidden', () => api.getAccountCare(CX), 'forbidden');
  await viewAsInternalMethods(suite, 'am view-as');
  await api.stopViewAsClient();

  await moreScopeChecks(suite);
}

/** every internal CareApi method is refused to a read-only client (view-as) */
async function viewAsInternalMethods(suite: Suite, who: string): Promise<void> {
  const probes: [string, () => Promise<unknown>][] = [
    ['getCarePortfolio', () => api.getCarePortfolio()],
    ['listChangeRequests', () => api.listChangeRequests({ accountId: CX })],
    ['getGroupMatrix', () => api.getGroupMatrix('eco_coxanh')],
    ['createChangeRequest', () => api.createChangeRequest({ account_id: CX, title: 'x', description: '', source: 'email' })],
    ['saveDeployment', () => api.saveDeployment(deploymentInput(CX))],
    ['deleteDeployment', () => api.deleteDeployment('dpl_coxanh_app')],
    ['saveStakeholder', () => api.saveStakeholder({ contact_id: 'ct_coxanh_minh', stance: 'champion' })],
    ['saveRelationLink', () => api.saveRelationLink({ from_contact_id: 'ct_coxanh_minh', to_contact_id: 'ct_coxanh_lan', kind: 'works_with', note: null })],
    ['deleteRelationLink', () => api.deleteRelationLink('rel_cx_ops')],
    ['saveCarePlan', () => api.saveCarePlan(CX, { cadence_days: 7 })],
  ];
  for (const [name, run] of probes) await check(suite, `care · ${who} · ${name} → forbidden`, run, 'forbidden');
}

/** the scope rules the matrix above leaves out: deletes outside one's accounts, members, forged client input, secrets */
async function moreScopeChecks(suite: Suite): Promise<void> {
  // ── AM (Hà) outside her accounts
  await api.loginDemo('am');
  await check(suite, 'care · am · deleteDeployment(not managed)', () => api.deleteDeployment('dpl_maytrang_tms'), 'forbidden');
  await check(suite, 'care · am · deleteRelationLink(neither end managed)', () => api.deleteRelationLink('rel_gn_eng'), 'forbidden');
  await check(suite, 'care · am · createChangeRequest(not managed)', () => api.createChangeRequest({ account_id: MT, title: 'x', description: '', source: 'email' }), 'forbidden');
  await check(suite, 'care · am · listChangeRequests(projectId of another AM)', () => api.listChangeRequests({ projectId: 'prj_maytrang_ops' }), 'forbidden');

  // ── member (Tuấn)
  await api.loginDemo('member');
  await check(suite, 'care · member · deleteDeployment', () => api.deleteDeployment('dpl_coxanh_app'), 'forbidden');
  await check(suite, 'care · member · deleteRelationLink', () => api.deleteRelationLink('rel_cx_ops'), 'forbidden');
  await check(suite, 'care · member · createChangeRequest(no access)', () => api.createChangeRequest({ account_id: NOT_TUAN, title: 'x', description: '', source: 'email' }), 'forbidden');
  await check(
    suite,
    'care · member · createChangeRequest handing it to someone else',
    () => api.createChangeRequest({ account_id: CX, title: 'Kiểm thử RBAC: giao cho người khác', description: '', source: 'chat', owner_id: 'u_member_linh' }),
    'forbidden',
  );
  await check(
    suite,
    'care · member · createChangeRequest owned by himself',
    () => api.createChangeRequest({ account_id: CX, title: 'Kiểm thử RBAC: tự nhận', description: '', source: 'chat', owner_id: 'u_member_tuan' }),
    'ok',
  );
  await check(suite, 'care · member · submitRequest', () => api.submitRequest({ title: 'x', description: '' }), 'forbidden');
  await check(suite, 'care · member · listClientDeployments', () => api.listClientDeployments(), 'forbidden');

  // ── a client forging fields: everything but title / description / project / priority is ignored
  await api.loginDemo('client_owner');
  let forgedId: ID = '';
  await suite.testAsync('care · client_owner · forged submitRequest fields are ignored', async () => {
    const forged = { title: 'Kiểm thử RBAC: yêu cầu giả mạo', description: '', account_id: MT, status: 'done', source: 'internal', owner_id: 'u_member_tuan', internal_note: CARE_SECRET, plan_ref: CARE_SECRET, promised_date: '2026-12-01' };
    const sent = await api.submitRequest(forged as unknown as Parameters<typeof api.submitRequest>[0]);
    forgedId = sent.id;
    assertEqual(sent.status, 'new', 'status');
  });
  await api.loginDemo('director');
  await suite.testAsync('care · director reads the forged request: own account, new, from the portal, nothing internal', async () => {
    const row = (await api.listChangeRequests({ accountId: CX })).find((x) => x.id === forgedId);
    assert(row, 'stored on the client’s own account');
    assertEqual(
      [row.account.id, row.status, row.source, row.owner, row.internal_note, row.plan_ref, row.promised_date],
      [CX, 'new', 'client_portal', null, null, null, null],
      'stored row',
    );
  });

  // ── internal text planted on a request (internal note, plan) never reaches the client's bell or mail
  await suite.testAsync('care · director plans, moves and closes a request carrying internal text', async () => {
    const promised = '2026-12-20';
    await api.updateChangeRequest('cr_coxanh_09', { status: 'planned', promised_date: promised, plan_ref: CARE_SECRET, internal_note: CARE_SECRET, owner_id: 'u_member_tuan' });
    await api.updateChangeRequest('cr_coxanh_09', { promised_date: '2026-12-22' });
    await api.updateChangeRequest('cr_coxanh_09', { status: 'done' });
  });
  await api.loginDemo('client_owner');
  await check(suite, 'care · client_owner · bell: request notices without internal text', () => api.listNotifications(), 'ok', (x) => {
    const list = x as { kind: string; link: string }[];
    assert(list.some((n) => n.kind === 'request' && n.link.includes('cr_coxanh_09')), 'the requester was told');
    assertClientSafe(x, 'listNotifications', false);
  });
  await check(suite, 'care · client_owner · mail outbox without internal text', () => api.listOutbox({ userId: 'u_client_minh' }), 'ok', (x) => assertClientSafe(x, 'listOutbox', false));

  // ── New Era's own proposals stay internal
  await api.loginDemo('am');
  let ideaId: ID = '';
  await suite.testAsync('care · am · an internal proposal names no client requester', async () => {
    const idea = await api.createChangeRequest({ account_id: CX, title: CARE_SECRET, description: CARE_SECRET, source: 'internal', requested_by_contact_id: 'ct_coxanh_minh' });
    ideaId = idea.id;
    assertEqual(idea.requested_by, null, 'no requester');
    await api.updateChangeRequest(idea.id, { status: 'planned', promised_date: '2026-12-15', plan_ref: 'Đợt 9', owner_id: 'u_member_tuan' });
  });
  for (const role of ['client_owner', 'client_member'] as const) {
    await api.loginDemo(role);
    await check(suite, `care · ${role} · internal proposals are not in the client's requests, feed or bell`, () => api.listMyRequests(), 'ok', (x) => {
      assert(!(x as { id: ID }[]).some((r) => r.id === ideaId), 'not listed');
      assertClientSafe(x, 'listMyRequests');
    });
    await check(suite, `care · ${role} · feed and bell carry nothing of the internal proposal`, async () => [await api.listActivities({ accountId: CX, limit: 300 }), await api.listNotifications()], 'ok', (x) =>
      assertClientSafe(x, 'feed+bell', false),
    );
  }
}
