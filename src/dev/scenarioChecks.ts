// Demo scenario checks (SPEC §9, ARCHITECTURE §9) through the real `api`, on a FRESH database.
// Called by runApiSmoke() right after api.resetDemoData(); logs in as several users (the caller restores the session).
// Run alone: const m = await import('/src/dev/scenarioChecks'); await m.runScenarioChecks()  (reset the db first)

import type { ID } from '@/domain/types';
import type { AccountSummary, PortalHome, StatusLine } from '@/services/contract';
import { addDays } from '@/domain/dates';
import { api } from '@/services/api';
import { statusLineText } from '@/components/common/status-band';
import { assert, assertEqual, createSuite, type TestResult } from '@/dev/testkit';

const CX = 'acc_coxanh';
const DESIGN_APPROVAL = 't_coxanh_design_approval';
const ORDER_DEV = 't_coxanh_order_dev';
const CATALOG_UPLOAD = 't_coxanh_catalog_upload';
const LAN = 'u_client_lan';

/** Logs in as the first active decision maker of an account (email OTP, like the real client login). */
async function loginAsOwnerOf(accountId: ID): Promise<void> {
  await api.loginDemo('director');
  const owners = await api.listUsers({ accountId, role: 'client_owner' });
  const owner = owners[0];
  assert(owner, `${accountId} has a client_owner`);
  const { demo_code } = await api.requestOtp(owner.email);
  await api.verifyOtp(owner.email, demo_code, false);
}

async function portalHomeOf(accountId: ID): Promise<PortalHome> {
  if (accountId === CX) await api.loginDemo('client_owner');
  else await loginAsOwnerOf(accountId);
  return api.getPortalHome();
}

function kindOf(line: StatusLine): string {
  return `${line.tone}/${line.kind}`;
}

export async function runScenarioChecks(): Promise<TestResult[]> {
  const s = createSuite('scenario');

  await api.loginDemo('director');
  const accounts = await api.listAccounts();
  const byId = new Map<ID, AccountSummary>(accounts.map((a) => [a.id, a]));
  const health = (id: ID): string => byId.get(id)?.health.value ?? 'missing';

  s.test('six accounts with the expected health', () => {
    assertEqual(
      ['acc_coxanh', 'acc_thientruong', 'acc_giongan', 'acc_haidang', 'acc_maytrang'].map(health),
      ['blocked', 'attention', 'blocked', 'attention', 'on_track'],
      'health',
    );
    assert(health('acc_thinhan') !== 'blocked' && health('acc_thinhan') !== 'missing', 'Thịnh An is not blocked');
  });

  s.test('Mây Trắng: on track, nothing waiting on the client', () => {
    const a = byId.get('acc_maytrang');
    assert(a, 'Mây Trắng listed');
    assertEqual([a.health.value, a.counts.waiting_client], ['on_track', 0], 'health / waiting_client');
  });

  s.test('Thiên Trường: attention only because of the overdue installment', () => {
    const a = byId.get('acc_thientruong');
    assert(a, 'Thiên Trường listed');
    assertEqual(a.health.reasons.map((r) => r.kind), ['overdue_payment'], 'reasons');
  });

  const cx = await api.getAccount(CX);
  s.test('Cỏ Xanh: UAT and Go-live forecast = planned + 6, caused by the design approval', () => {
    const ms = cx.projects.flatMap((p) => p.milestones);
    for (const name of ['UAT', 'Go-live']) {
      const m = ms.find((x) => x.name === name && x.project_id === 'prj_coxanh_app');
      assert(m, `milestone ${name}`);
      assertEqual(m.forecast_date, addDays(m.planned_date, 6), `${name} forecast`);
      assertEqual(m.cause?.task_id ?? null, DESIGN_APPROVAL, `${name} cause`);
    }
  });

  const dash = await api.getDirectorDashboard();
  s.test('dashboard attention: Cỏ Xanh client_overdue_blocking + Thịnh An quote ~15% pending approval', () => {
    const cxItem = dash.attention.find((i) => i.kind === 'client_overdue_blocking' && i.account.id === CX);
    assert(cxItem, 'client_overdue_blocking for Cỏ Xanh');
    assertEqual([cxItem.task_id, cxItem.params.milestone, cxItem.params.days], [DESIGN_APPROVAL, 'Go-live', 6], 'Cỏ Xanh item');
    const quote = dash.attention.find((i) => i.kind === 'quote_pending_approval' && i.account.id === 'acc_thinhan');
    assert(quote, 'quote_pending_approval for Thịnh An');
    assertEqual(quote.params.discount, 15, 'discount');
    assert(dash.attention.length <= 7, 'at most 7 attention lines');
  });

  const [approval, orderDev] = await Promise.all([api.getTask(DESIGN_APPROVAL), api.getTask(ORDER_DEV)]);
  s.test('impact chain reads like SPEC §3 from the approval and from the blocked task', () => {
    const want = ['Duyệt thiết kế màn hình Đặt hàng', 'Lập trình phần Đặt hàng', 'UAT', 'Go-live'];
    assertEqual(approval.chain.map((n) => n.label), want, 'chain(approval)');
    assertEqual(orderDev.chain.map((n) => n.label), want, 'chain(Lập trình phần Đặt hàng)');
    assertEqual(approval.chain.map((n) => n.state), ['stuck', 'pending', 'pending', 'pending'], 'states');
  });

  s.test('Lập trình phần Đặt hàng is blocked by the approval and gives no health reason of its own', () => {
    assert(orderDev.blocked, 'blocked');
    assertEqual(orderDev.blocked_by.map((b) => b.id), [DESIGN_APPROVAL], 'blocked_by');
    const reasons = byId.get(CX)?.health.reasons ?? [];
    assert(!reasons.some((r) => r.kind !== 'overdue_payment' && r.task_id === ORDER_DEV), 'no reason for the blocked task');
  });

  // client side
  const minh = await portalHomeOf(CX);
  s.test('Minh: status line waiting_client on Go-live, overdue approval first, delegation to Lan, week count', () => {
    assertEqual(kindOf(minh.status_line), 'blocked/waiting_client', 'status line');
    assertEqual(
      statusLineText(minh.status_line, minh.viewer.salutation),
      'Mốc Go-live đang chờ 1 việc từ phía anh. Mỗi ngày chậm, Go-live lùi thêm 1 ngày.',
      'sentence',
    );
    const first = minh.my_tasks[0];
    assert(first, 'Minh has tasks');
    assertEqual([first.id, first.priority_rank], [DESIGN_APPROVAL, 1], 'first task');
    const delegated = minh.delegated_tasks.find((x) => x.id === CATALOG_UPLOAD);
    assert(delegated && delegated.assignee?.id === LAN, 'catalog upload delegated to Lan');
    assert(minh.week_count > 0, 'week_count > 0');
  });

  const lines: [ID, string][] = [
    ['acc_thientruong', 'attention/payment_overdue'],
    ['acc_giongan', 'blocked/waiting_internal'],
    ['acc_haidang', 'attention/due_soon_blocking'],
    ['acc_maytrang', 'on_track/on_track'],
  ];
  for (const [accountId, want] of lines) {
    const home = await portalHomeOf(accountId);
    s.test(`${accountId}: client status line ${want}`, () => {
      assertEqual(kindOf(home.status_line), want, 'status line');
      if (accountId === 'acc_maytrang') assertEqual(home.counts.waiting_client, 0, 'waiting_client');
    });
  }

  return s.results;
}
