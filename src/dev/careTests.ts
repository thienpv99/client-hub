// Self-test suite 'care' (SPEC-CARE §8): the pure rules of src/domain/care.ts (untriaged boundary at exactly 7 days,
// each delivery-debt reason, roll-ups, effective department status, coverage, the expansion gate, care status, room
// to sell), the API flows (client request → triage → plan → done with notifications, decline, gate refusal +
// director override, care touch), the portfolio / matrix reads, and the care seed checks.
// The API part runs on a private copy of the db (db.isolated) reset to a fresh seed: nothing reaches localStorage.
// Run in the browser: (await import('/src/dev/careTests')).runCareTests().then(r => r.filter(x => !x.ok))

import type { ID, ISODate } from '@/domain/types';
import type { AccountDepartment, ChangeRequest, Deployment } from '@/domain/careTypes';
import { atTime, nowISO, todayISO } from '@/domain/clock';
import { addDays } from '@/domain/dates';
import {
  careStatus,
  coverage,
  crRollup,
  deliveryDebtReason,
  deliveryDebtReasons,
  effectiveDepartmentStatus,
  expansionBlocked,
  hasOpportunity,
  isExpansionMove,
  isUndated,
  isUntriaged,
  matrixCellState,
  nextCrCode,
  whitespaceCategories,
} from '@/domain/care';
import type { CarePlanView } from '@/services/careContract';
import { careDraftChanged, careDraftError, carePlanDraft, planSettledBy } from '@/components/care/CareNextStep';
import { buildSeed } from '@/data/seed';
import { checkCare } from '@/data/seed/careChecks';
import { api } from '@/services/api';
import { ApiError } from '@/services/contract';
import { getSession, setSession } from '@/services/context';
import { db } from '@/services/db';
import { assert, assertEqual, AssertionError, createSuite, type TestResult } from '@/dev/testkit';

const CX = 'acc_coxanh';
const MINH = 'u_client_minh';

type Suite = ReturnType<typeof createSuite>;

// ───────────────────────────── fixtures ─────────────────────────────

function cr(over: Partial<ChangeRequest>, today: ISODate): ChangeRequest {
  return {
    id: 'cr_t',
    code: 'YC-01',
    account_id: 'acc_t',
    project_id: null,
    deployment_id: null,
    title: 'Kiểm thử',
    description: '',
    source: 'meeting',
    requested_by_contact_id: null,
    requested_by_user_id: null,
    received_at: atTime(addDays(today, -2), '09:00'),
    status: 'new',
    priority: 'normal',
    triaged_at: null,
    owner_id: null,
    promised_date: null,
    plan_ref: null,
    task_id: null,
    client_note: null,
    internal_note: null,
    decline_reason: null,
    done_at: null,
    created_at: atTime(addDays(today, -2), '09:00'),
    updated_at: atTime(addDays(today, -2), '09:00'),
    deleted_at: null,
    ...over,
  };
}

function dep(over: Partial<Deployment>): Deployment {
  return {
    id: 'd',
    account_id: 'acc_t',
    project_id: null,
    name: 'Giải pháp',
    category: 'mobile_app',
    summary: '',
    status: 'live',
    go_live_date: null,
    departments: [],
    active_users: null,
    contract_value: null,
    adoption: null,
    notes: null,
    owner_id: 'u_director',
    created_at: '2026-01-01T09:00:00.000+07:00',
    updated_at: '2026-01-01T09:00:00.000+07:00',
    deleted_at: null,
    ...over,
  };
}

function dept(over: Partial<AccountDepartment>): AccountDepartment {
  return {
    id: 'x',
    account_id: 'acc_t',
    department: 'sales',
    status: 'untouched',
    need_note: null,
    opportunity_note: null,
    opportunity_category: null,
    est_value: null,
    contact_id: null,
    ne_owner_id: null,
    next_step: null,
    next_step_due: null,
    updated_at: '2026-01-01T09:00:00.000+07:00',
    ...over,
  };
}

function errorCode(err: unknown): string {
  return err instanceof ApiError ? `${err.code}:${err.messageKey}` : `unexpected (${err instanceof Error ? err.message : String(err)})`;
}

async function expectError(p: Promise<unknown>, code: string, key?: string): Promise<ApiError> {
  try {
    await p;
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== code || (key && err.messageKey !== key)) {
      throw new AssertionError(`expected ${code}${key ? `:${key}` : ''}, got ${errorCode(err)}`);
    }
    return err;
  }
  throw new AssertionError(`expected ${code}, but the call succeeded`);
}

// ───────────────────────────── pure rules ─────────────────────────────

function ruleTests(s: Suite): void {
  const today = '2026-10-08';
  const daysAgo = (n: number): string => atTime(addDays(today, -n), '10:00');

  s.test('untriaged: exactly 7 days is not yet flagged, 8 days is', () => {
    assertEqual(isUntriaged(cr({ received_at: daysAgo(7) }, today), today), false, '7 days');
    assertEqual(isUntriaged(cr({ received_at: daysAgo(8) }, today), today), true, '8 days');
    assertEqual(isUntriaged(cr({ received_at: daysAgo(30), status: 'triaged', triaged_at: daysAgo(1) }, today), today), false, 'triaged requests are never untriaged');
  });

  s.test('untriaged counts calendar days in Vietnam (late evening receipt)', () => {
    // 23:30 on day −7 is still day −7, not −8
    assertEqual(isUntriaged(cr({ received_at: atTime(addDays(today, -7), '23:30') }, today), today), false, '23:30 seven days ago');
  });

  s.test('debt reason: promised date without an owner', () => {
    const x = cr({ status: 'planned', promised_date: addDays(today, 5), plan_ref: 'Đợt 4', owner_id: null }, today);
    assertEqual(deliveryDebtReasons(x, today), ['no_owner'], 'reasons');
    assertEqual(deliveryDebtReason(x, today), 'no_owner', 'main reason');
  });

  s.test('debt reason: promised date without a plan (no plan_ref, no task)', () => {
    const x = cr({ status: 'triaged', promised_date: addDays(today, 5), owner_id: 'u_member_quang' }, today);
    assertEqual(deliveryDebtReasons(x, today), ['no_plan'], 'reasons');
    const withTask = cr({ status: 'triaged', promised_date: addDays(today, 5), owner_id: 'u_member_quang', task_id: 't_1' }, today);
    assertEqual(deliveryDebtReasons(withTask, today), [], 'a linked task is a plan');
  });

  s.test('debt reason: the promised date has passed (main reason even with others)', () => {
    const x = cr({ status: 'in_progress', promised_date: addDays(today, -1), owner_id: null, plan_ref: null }, today);
    assertEqual(deliveryDebtReasons(x, today), ['no_owner', 'no_plan', 'date_passed'], 'all three');
    assertEqual(deliveryDebtReason(x, today), 'date_passed', 'date_passed first');
    const due = cr({ status: 'in_progress', promised_date: today, owner_id: 'u', plan_ref: 'p' }, today);
    assertEqual(deliveryDebtReasons(due, today), [], 'due today is not passed');
  });

  s.test('no promise, new, done or declined requests are never debt', () => {
    assertEqual(deliveryDebtReasons(cr({ status: 'triaged', promised_date: null }, today), today), [], 'no promised date');
    assertEqual(deliveryDebtReasons(cr({ status: 'new', promised_date: addDays(today, -3) }, today), today), [], 'new');
    assertEqual(deliveryDebtReasons(cr({ status: 'done', promised_date: addDays(today, -3), done_at: daysAgo(4) }, today), today), [], 'done');
    assertEqual(deliveryDebtReasons(cr({ status: 'declined', promised_date: addDays(today, -3), decline_reason: 'x' }, today), today), [], 'declined');
  });

  s.test('roll-up: open / untriaged / debt / done in 30 days / delivery health', () => {
    const list = [
      cr({ id: 'a', status: 'new', received_at: daysAgo(9) }, today),
      cr({ id: 'b', status: 'new', received_at: daysAgo(2) }, today),
      cr({ id: 'c', status: 'planned', promised_date: addDays(today, 3), owner_id: 'u', plan_ref: 'p' }, today),
      cr({ id: 'd', status: 'done', done_at: daysAgo(10) }, today),
      cr({ id: 'e', status: 'done', done_at: daysAgo(40) }, today),
    ];
    assertEqual(crRollup(list, today), { open: 3, untriaged: 1, undated: 0, debt: 0, done_30d: 1, delivery_health: 'attention' }, 'attention');
    const withDebt = [...list, cr({ id: 'f', status: 'triaged', promised_date: addDays(today, 3), owner_id: null }, today)];
    assertEqual(crRollup(withDebt, today).delivery_health, 'debt', 'debt wins');
    assertEqual(crRollup([list[2], list[3]], today).delivery_health, 'ok', 'ok');
    const undated = cr({ id: 'g', status: 'triaged', received_at: daysAgo(20), triaged_at: daysAgo(15), owner_id: 'u' }, today);
    const r = crRollup([list[2], undated], today);
    assertEqual([r.undated, r.delivery_health], [1, 'attention'], 'taken in 15 days ago without a date → attention');
  });

  s.test('undated: taken in more than 14 days ago with no promised date (exactly 14 is not yet)', () => {
    const at = (n: number, over: Partial<ChangeRequest> = {}) =>
      cr({ status: 'triaged', received_at: daysAgo(n + 1), triaged_at: daysAgo(n), owner_id: 'u', ...over }, today);
    assertEqual(isUndated(at(14), today), false, '14 days');
    assertEqual(isUndated(at(15), today), true, '15 days');
    assertEqual(isUndated(at(30, { promised_date: addDays(today, 5), plan_ref: 'p' }), today), false, 'a date was told to the client');
    assertEqual(isUndated(at(30, { status: 'in_progress' }), today), false, 'only requests still at "Đã tiếp nhận"');
    assertEqual(isUndated(cr({ status: 'triaged', received_at: daysAgo(20), triaged_at: null }, today), today), true, 'no triage date → the received date');
  });

  s.test('department: using when a live / rolling-out / pilot deployment lists it, else the stored status', () => {
    const deps = [dep({ status: 'live', departments: ['sales'] }), dep({ status: 'pilot', departments: ['it'] }), dep({ status: 'paused', departments: ['hr'] })];
    assertEqual(effectiveDepartmentStatus(dept({ department: 'sales', status: 'untouched' }), deps), 'using', 'live');
    assertEqual(effectiveDepartmentStatus(dept({ department: 'it', status: 'not_fit' }), deps), 'using', 'pilot');
    assertEqual(effectiveDepartmentStatus(dept({ department: 'hr', status: 'engaged' }), deps), 'engaged', 'paused does not count');
    assertEqual(effectiveDepartmentStatus(dept({ department: 'finance', status: 'untouched' }), deps), 'untouched', 'stored');
  });

  s.test('coverage: using + engaged over the map minus not_fit', () => {
    const deps = [dep({ status: 'rolling_out', departments: ['sales'] }), dep({ status: 'retired', departments: ['marketing'] })];
    const rows = [
      dept({ department: 'sales', status: 'untouched' }),
      dept({ department: 'finance', status: 'engaged' }),
      dept({ department: 'marketing', status: 'untouched' }),
      dept({ department: 'hr', status: 'not_fit' }),
    ];
    assertEqual(coverage(rows, deps), { covered: 2, total: 3 }, '2/3');
  });

  s.test('expansion gate: debt > 0 blocks a move into a new department', () => {
    assertEqual(expansionBlocked({ debt: 1 }), true, 'blocked');
    assertEqual(expansionBlocked({ debt: 0 }), false, 'open');
    assertEqual(isExpansionMove('untouched', 'engaged'), true, 'untouched → engaged');
    assertEqual(isExpansionMove(null, 'engaged'), true, 'new department → engaged');
    assertEqual(isExpansionMove('not_fit', 'engaged'), true, 'not_fit → engaged');
    assertEqual(isExpansionMove('using', 'engaged'), false, 'already in use');
    assertEqual(isExpansionMove('engaged', 'engaged'), false, 'already engaged');
    assertEqual(isExpansionMove('untouched', 'not_fit'), false, 'closing is not expanding');
  });

  s.test('care status: ok / due soon (last 3 days of the cadence) / overdue; next action passed; never touched', () => {
    const base = { cadence_days: 14, next_action_due: null as ISODate | null, today };
    assertEqual(careStatus({ ...base, last_touch_at: daysAgo(11) }).status, 'ok', '11 of 14');
    assertEqual(careStatus({ ...base, last_touch_at: daysAgo(12) }).status, 'due_soon', '12 of 14');
    assertEqual(careStatus({ ...base, last_touch_at: daysAgo(14) }).status, 'due_soon', '14 of 14');
    assertEqual(careStatus({ ...base, last_touch_at: daysAgo(15) }).status, 'overdue', '15 of 14');
    const nextPassed = careStatus({ ...base, last_touch_at: daysAgo(1), next_action_due: addDays(today, -1) });
    assertEqual([nextPassed.status, nextPassed.next_action_overdue], ['overdue', true], 'next action passed');
    assertEqual(careStatus({ ...base, last_touch_at: daysAgo(1), next_action_due: today }).status, 'ok', 'next action due today');
    assertEqual(careStatus({ ...base, last_touch_at: null }), { status: 'overdue', days_since: null, next_action_overdue: false }, 'never touched');
  });

  s.test('room to sell: categories without a deployment, departments with a concrete opportunity', () => {
    const deps = [dep({ category: 'mobile_app' }), dep({ category: 'crm_erp', status: 'retired' })];
    const ws = whitespaceCategories(deps);
    assert(!ws.includes('mobile_app') && ws.includes('crm_erp') && ws.length === 6, 'retired deployments free their category');
    assertEqual(hasOpportunity(dept({ status: 'engaged', opportunity_note: 'Bảng điều hành' })), true, 'note');
    assertEqual(hasOpportunity(dept({ status: 'untouched', est_value: 300_000_000 })), true, 'value');
    assertEqual(hasOpportunity(dept({ status: 'not_fit', opportunity_note: 'x', est_value: 1 })), false, 'not_fit');
    assertEqual(hasOpportunity(dept({ status: 'engaged' })), false, 'nothing concrete');
  });

  s.test('group matrix cell: live > in progress > opportunity > none', () => {
    const rows = [dept({ status: 'engaged', opportunity_category: 'data_bi', opportunity_note: 'Bảng điều hành' })];
    assertEqual(matrixCellState('mobile_app', [dep({ category: 'mobile_app', status: 'pilot' }), dep({ category: 'mobile_app', status: 'live' })], rows), 'live', 'live');
    assertEqual(matrixCellState('mobile_app', [dep({ category: 'mobile_app', status: 'rolling_out' })], rows), 'in_progress', 'in progress');
    assertEqual(matrixCellState('data_bi', [], rows), 'opportunity', 'opportunity');
    assertEqual(matrixCellState('support', [], rows), 'none', 'none');
  });

  s.test('a paused solution does not hold its category: the matrix cell and "chưa có" read it as open again', () => {
    const rows = [dept({ status: 'engaged', opportunity_category: 'data_bi', opportunity_note: 'Bảng điều hành' })];
    assertEqual(matrixCellState('mobile_app', [dep({ category: 'mobile_app', status: 'paused' })], rows), 'none', 'paused → none');
    assertEqual(matrixCellState('data_bi', [dep({ category: 'data_bi', status: 'paused' })], rows), 'opportunity', 'paused + opportunity → opportunity');
    assert(whitespaceCategories([dep({ category: 'mobile_app', status: 'paused' })]).includes('mobile_app'), 'paused category is room to sell');
    assert(!whitespaceCategories([dep({ category: 'mobile_app', status: 'pilot' })]).includes('mobile_app'), 'a pilot holds its category');
  });

  s.test('request codes are numbered per account', () => {
    assertEqual(nextCrCode([]), 'YC-01', 'first');
    assertEqual(nextCrCode(['YC-01', 'YC-09', 'YC-03']), 'YC-10', 'max + 1');
    assertEqual(nextCrCode(['YC-01', 'ĐX-04', 'YC-02'], 'ĐX'), 'ĐX-05', 'proposals numbered apart');
    assertEqual(nextCrCode(['YC-01', 'ĐX-04', 'YC-02']), 'YC-03', 'client numbering skips proposals');
  });

  s.test('care touch: a due next action is closed by the touch, a future one is kept', () => {
    const today = todayISO();
    const plan = (action: string | null, due: ISODate | null): CarePlanView => ({
      id: 'care_x',
      cadence_days: 21,
      cadence_is_default: true,
      next_action: action,
      next_action_due: due,
      next_action_owner: null,
      updated_at: null,
    });
    const passed = plan('Gặp anh Hùng', addDays(today, -3));
    assert(planSettledBy(passed, today) && planSettledBy(plan('Gọi chị Vy', today), today), 'passed / today = settled');
    assertEqual(carePlanDraft(passed, today), { action: '', due: '' }, 'settled → empty draft');
    assert(careDraftChanged(passed, carePlanDraft(passed, today)), 'clearing a settled action is a change');
    const future = plan('Demo báo cáo', addDays(today, 5));
    assertEqual(carePlanDraft(future, today), { action: 'Demo báo cáo', due: addDays(today, 5) }, 'future kept');
    assert(!careDraftChanged(future, carePlanDraft(future, today)), 'unchanged → nothing saved');
    assert(careDraftError({ action: ' ', due: addDays(today, 2) }) !== null && careDraftError({ action: '', due: '' }) === null, 'a date needs an action');
  });
}

// ───────────────────────────── seed ─────────────────────────────

function seedTests(s: Suite): void {
  s.test('care seed: referential integrity, rules and demo stories', () => {
    const today = todayISO();
    const problems = checkCare(buildSeed(today), today);
    assert(problems.length === 0, problems.slice(0, 8).join(' | '));
  });
}

// ───────────────────────────── API flows (isolated) ─────────────────────────────

async function apiTests(s: Suite): Promise<void> {
  await api.loginDemo('director');
  await api.resetDemoData();

  await s.testAsync('seeded stories through the API: Cỏ Xanh blocked, Thịnh An waiting, Mây Trắng healthy', async () => {
    const [cx, ta, mt] = await Promise.all([api.getAccountCare(CX), api.getAccountCare('acc_thinhan'), api.getAccountCare('acc_maytrang')]);
    assert(cx.requests.debt === 3 && cx.expansion?.blocked === true, `Cỏ Xanh debt ${cx.requests.debt}`);
    assert(cx.expansion?.gate_message?.includes('3') === true, 'gate sentence names the count');
    assert(ta.requests.untriaged >= 2 && ta.requests.delivery_health === 'attention', 'Thịnh An attention');
    assert(mt.requests.delivery_health === 'ok' && (mt.expansion?.opportunity_count ?? 0) >= 4, 'Mây Trắng healthy with room');
    assert(mt.expansion!.whitespace_categories.some((w) => w.category === 'web_portal'), 'Mây Trắng has no web portal yet');
    assert(cx.relations!.some((r) => r.cross_unit && r.from.account.id === 'acc_maytrang'), 'cross-unit link to Mây Trắng');
    assert(cx.key_people?.decision_maker?.contact_id === 'ct_coxanh_minh', 'decision maker');
    assert(cx.key_people?.champion !== null, 'a champion');
  });

  await s.testAsync('portfolio filters: debt, untriaged, care overdue', async () => {
    const [debt, waiting, overdue] = await Promise.all([
      api.getCarePortfolio({ flag: 'debt' }),
      api.getCarePortfolio({ flag: 'untriaged' }),
      api.getCarePortfolio({ flag: 'care_overdue' }),
    ]);
    assertEqual(debt.map((r) => r.account.id), [CX], 'debt');
    assert(waiting.some((r) => r.account.id === 'acc_thinhan'), 'untriaged');
    assertEqual(overdue.map((r) => r.account.id).sort(), ['acc_haidang', 'acc_thientruong'], 'care overdue');
    const all = await api.getCarePortfolio();
    assertEqual(all[0]?.account.id, CX, 'debt first');
    const mt = all.find((r) => r.account.id === 'acc_maytrang');
    assert(mt && mt.deployments.live === 3 && mt.departments.covered === 7 && mt.departments.total === 8, 'Mây Trắng counts');
    assert(mt.decision_maker?.strength === 'strong', 'decision maker strength');
  });

  await s.testAsync('group matrix: units × categories, cells and cross-unit links', async () => {
    const m = await api.getGroupMatrix('eco_coxanh');
    assertEqual(m.units.map((u) => u.account.id).sort(), [CX, 'acc_maytrang'], 'units');
    const cx = m.units.find((u) => u.account.id === CX)!;
    const cell = (u: typeof cx, c: string) => u.cells.find((x) => x.category === c)!;
    assertEqual(cell(cx, 'integration').state, 'live', 'Cỏ Xanh integration live');
    assertEqual(cell(cx, 'mobile_app').state, 'in_progress', 'Cỏ Xanh app rolling out');
    assertEqual(cell(cx, 'data_bi').state, 'opportunity', 'Cỏ Xanh dashboard opportunity');
    const mt = m.units.find((u) => u.account.id === 'acc_maytrang')!;
    assertEqual(cell(mt, 'web_portal').state, 'opportunity', 'Mây Trắng portal opportunity');
    assert(m.relations.length >= 3 && m.relations.every((r) => r.cross_unit), 'cross-unit links');
    assertEqual(m.categories.length, 7, 'seven categories');
  });

  // ── a client request end to end
  let crId: ID = '';
  await s.testAsync('client submits a request → status new, AM notified (bell + mail), shared activity', async () => {
    await api.loginDemo('client_owner');
    const sent = await api.submitRequest({ title: 'Kiểm thử: thêm bộ lọc theo vùng', description: 'Cần cho báo cáo tuần.', priority: 'high' });
    crId = sent.id;
    assertEqual([sent.status, sent.mine, sent.status_label], ['new', true, 'Đã gửi, chờ New Era tiếp nhận'], 'client view');
    assert(/^YC-\d{2,}$/.test(sent.code) && sent.code === 'YC-10', `next code (${sent.code})`);
    await api.loginDemo('am');
    const [bell, mail, list] = await Promise.all([api.listNotifications(), api.listOutbox({ userId: 'u_am_ha' }), api.listChangeRequests({ accountId: CX })]);
    assert(bell.some((n) => n.kind === 'request' && n.link.includes(crId)), 'AM bell item');
    assert(mail.some((m) => m.kind === 'request' && m.link?.includes(crId)), 'AM mail');
    const row = list.find((x) => x.id === crId);
    assert(row && row.source === 'client_portal' && row.requested_by?.user_id === MINH && row.priority === 'high', 'internal view');
    const acts = await api.listActivities({ accountId: CX, limit: 20 });
    assert(acts.some((a) => a.action === 'change_request.submitted' && a.target_id === crId && a.visibility === 'shared'), 'shared activity');
  });

  await s.testAsync('triage → plan needs a promised date → planned notifies the client with the date', async () => {
    const triaged = await api.updateChangeRequest(crId, { status: 'triaged', owner_id: 'u_member_quang' });
    assert(triaged.status === 'triaged' && triaged.triaged_at !== null && triaged.owner?.id === 'u_member_quang', 'triaged');
    await expectError(api.updateChangeRequest(crId, { status: 'planned' }), 'validation', 'errors.care.plannedNeedsDate');
    const promised = addDays(todayISO(), 9);
    const planned = await api.updateChangeRequest(crId, { status: 'planned', promised_date: promised, plan_ref: 'Đợt phát triển 5', client_note: 'Làm cùng đợt 5.' });
    assert(planned.status === 'planned' && !planned.flags.debt, 'planned, no debt');
    await api.loginDemo('client_owner');
    const [bell, mine] = await Promise.all([api.listNotifications(), api.listMyRequests()]);
    const item = bell.find((n) => n.kind === 'request' && n.link === `/portal/progress?cr=${crId}`);
    assert(item && item.body.includes(`${promised.slice(8, 10)}/${promised.slice(5, 7)}`), 'client told the date');
    const view = mine.find((x) => x.id === crId);
    assert(view && view.status_label === 'Đã lên kế hoạch' && view.promised_date === promised && view.client_note === 'Làm cùng đợt 5.', 'client view');
    const text = JSON.stringify(mine);
    for (const key of ['plan_ref', 'internal_note', 'owner', 'flags', 'task_id', 'priority']) assert(!text.includes(`"${key}"`), `client payload has no ${key}`);
  });

  await s.testAsync('done stamps done_at and notifies the client; the roll-up counts it', async () => {
    await api.loginDemo('am');
    const done = await api.updateChangeRequest(crId, { status: 'done' });
    assert(done.status === 'done' && done.done_at !== null, 'done');
    const care = await api.getAccountCare(CX);
    assert(care.requests.done_30d >= 1, 'done in 30 days');
    await api.loginDemo('client_owner');
    const bell = await api.listNotifications();
    assert(bell.some((n) => n.kind === 'request' && n.title.includes('hoàn thành') && n.link.includes(crId)), 'client told it is done');
  });

  await s.testAsync('decline needs a reason the client can read', async () => {
    await api.loginDemo('am');
    const created = await api.createChangeRequest({ account_id: CX, title: 'Kiểm thử: đổi màu nút', description: '', source: 'meeting', requested_by_contact_id: 'ct_coxanh_minh' });
    assertEqual(created.status, 'new', 'new');
    await expectError(api.updateChangeRequest(created.id, { status: 'declined' }), 'validation', 'errors.care.declineReasonRequired');
    const declined = await api.updateChangeRequest(created.id, { status: 'declined', decline_reason: 'Trái với bộ nhận diện đã duyệt.' });
    assert(declined.status === 'declined' && declined.triaged_at !== null, 'declined');
    await api.loginDemo('client_owner');
    const [mine, bell] = await Promise.all([api.listMyRequests(), api.listNotifications()]);
    const view = mine.find((x) => x.id === created.id);
    assert(view && view.decline_reason === 'Trái với bộ nhận diện đã duyệt.' && view.status_label === 'Chưa thực hiện được', 'client reads the reason');
    assert(bell.some((n) => n.kind === 'request' && n.body.includes('Trái với bộ nhận diện')), 'client notified with the reason');
  });

  // ── expansion gate
  await s.testAsync('gate: the AM cannot expand Cỏ Xanh into a new department while debt > 0', async () => {
    await api.loginDemo('am');
    const err = await expectError(api.saveDepartment({ account_id: CX, department: 'marketing', status: 'engaged' }), 'conflict', 'errors.care.expansionBlocked');
    assertEqual(err.details?.count, 3, 'details.count');
    // an AM's override reason is ignored: only the director may override
    await expectError(api.saveDepartment({ account_id: CX, department: 'marketing', status: 'engaged', override_reason: 'Thử' }), 'conflict');
    // closing a department or editing an engaged one is not expanding
    const it = await api.saveDepartment({ account_id: CX, department: 'it', status: 'engaged', next_step: 'Kiểm thử: hẹn anh Khoa' });
    assertEqual(it.next_step, 'Kiểm thử: hẹn anh Khoa', 'engaged department edited');
  });

  await s.testAsync('gate: the director overrides with a reason, logged to the activity', async () => {
    await api.loginDemo('director');
    await expectError(api.saveDepartment({ account_id: CX, department: 'marketing', status: 'engaged' }), 'conflict', 'errors.care.expansionBlocked');
    const row = await api.saveDepartment({ account_id: CX, department: 'marketing', status: 'engaged', override_reason: 'Kiểm thử: anh Minh yêu cầu gấp cho mùa Tết' });
    assertEqual([row.status, row.effective], ['engaged', 'engaged'], 'expanded');
    const acts = await api.listActivities({ accountId: CX, limit: 30 });
    const log = acts.find((a) => a.action === 'department.gate_overridden');
    assert(log && String(log.params.reason).includes('mùa Tết') && log.params.count === 3 && log.visibility === 'internal', 'override logged');
  });

  await s.testAsync('gate through a solution: a pilot in a new department is refused while debt > 0; the director override is logged', async () => {
    await api.loginDemo('am');
    const pilot = {
      account_id: CX,
      project_id: null,
      name: 'Kiểm thử: chạy thử ở xưởng',
      category: 'data_bi' as const,
      summary: '',
      status: 'pilot' as const,
      go_live_date: null,
      departments: ['production' as const],
      active_users: null,
      contract_value: null,
      adoption: null,
      notes: null,
    };
    const err = await expectError(api.saveDeployment(pilot), 'conflict', 'errors.care.expansionBlocked');
    assertEqual(err.details?.count, 3, 'details.count');
    // a paused solution puts nobody in use: not an expansion
    const paused = await api.saveDeployment({ ...pilot, status: 'paused' });
    await expectError(api.saveDeployment({ ...pilot, id: paused.id, status: 'pilot' }), 'conflict', 'errors.care.expansionBlocked');
    // departments already worked with are not new
    const ok = await api.saveDeployment({ ...pilot, name: 'Kiểm thử: bảng cho bán hàng', departments: ['sales', 'it'] });
    assertEqual(ok.status, 'pilot', 'engaged departments pass');
    await api.loginDemo('director');
    await expectError(api.saveDeployment({ ...pilot, override_reason: '   ' }), 'conflict', 'errors.care.expansionBlocked');
    const passed = await api.saveDeployment({ ...pilot, override_reason: 'Kiểm thử: xưởng mới cần thử ngay' });
    assertEqual(passed.departments, ['production'], 'saved with the override');
    const acts = await api.listActivities({ accountId: CX, limit: 40 });
    assert(acts.some((a) => a.action === 'department.gate_overridden' && String(a.params.reason).includes('xưởng mới')), 'override logged');
    await api.deleteDeployment(paused.id);
  });

  await s.testAsync('gate opens once the debt is cleared', async () => {
    await api.loginDemo('am');
    const debts = await api.listChangeRequests({ accountId: CX, flag: 'debt' });
    assertEqual(debts.length, 3, 'three debt requests');
    for (const d of debts) {
      await api.updateChangeRequest(d.id, {
        owner_id: d.owner?.id ?? 'u_member_tuan',
        plan_ref: d.plan_ref ?? 'Đợt phát triển 4',
        promised_date: d.promised_date && d.promised_date >= todayISO() ? d.promised_date : addDays(todayISO(), 7),
      });
    }
    const care = await api.getAccountCare(CX);
    assert(care.requests.debt === 0 && care.expansion?.blocked === false && care.expansion.gate_message === null, 'no debt left');
    const fin = await api.saveDepartment({ account_id: CX, department: 'finance', status: 'engaged' });
    assertEqual(fin.effective, 'engaged', 'expanded into finance');
  });

  // ── care plan & touch
  await s.testAsync('care: a passed next action makes the account overdue; a new plan and a touch clear it', async () => {
    await api.loginDemo('am');
    const before = await api.getAccountCare('acc_haidang');
    assertEqual(before.care?.status, 'overdue', 'Hải Đăng overdue by its next action');
    await api.saveCarePlan('acc_haidang', { next_action: 'Kiểm thử: gặp chị Vy', next_action_due: addDays(todayISO(), 3), cadence_days: 30 });
    await api.logInteraction({
      kind: 'meeting',
      occurred_at: nowISO(),
      subject: 'Kiểm thử: gặp chị Vy',
      summary: '',
      outcome: 'positive',
      account_id: 'acc_haidang',
      lead_id: null,
      opportunity_id: null,
      contact_id: 'ct_haidang_vy',
      next_follow_up_date: null,
    });
    const after = await api.getAccountCare('acc_haidang');
    assert(after.care?.status === 'ok' && after.care.days_since === 0, `care ok (${after.care?.status}, ${after.care?.days_since})`);
    await expectError(api.saveCarePlan('acc_haidang', { cadence_days: 0 }), 'validation', 'errors.care.cadenceRange');
  });

  await s.testAsync('deployments: add, edit, remove (logged); members never see the contract value', async () => {
    await api.loginDemo('am');
    const added = await api.saveDeployment({
      account_id: CX,
      project_id: null,
      name: 'Kiểm thử: bảng điều hành',
      category: 'data_bi',
      summary: 'Thử',
      status: 'pilot',
      go_live_date: todayISO(),
      departments: ['executive'],
      active_users: 3,
      contract_value: 120_000_000,
      adoption: 'low',
      notes: 'Ghi chú nội bộ kiểm thử',
      owner_id: null,
    });
    assert(added.contract_value === 120_000_000 && added.owner?.id === 'u_am_ha', 'AM sees the value; owner defaults to the AM');
    const edited = await api.saveDeployment({ ...added, id: added.id, account_id: CX, project_id: null, status: 'live', departments: ['executive', 'finance'], owner_id: added.owner?.id ?? null });
    assertEqual([edited.status, edited.departments], ['live', ['executive', 'finance']], 'edited');
    await api.loginDemo('member');
    const asMember = await api.getAccountCare(CX);
    assert(asMember.deployments.every((d) => d.contract_value === null || d.contract_value === undefined), 'no contract value for members');
    assert(asMember.departments === null && asMember.stakeholders === null && asMember.care === null && asMember.expansion === null, 'members: no expansion, people or care');
    await api.loginDemo('am');
    await api.deleteDeployment(added.id);
    const after = await api.getAccountCare(CX);
    assert(!after.deployments.some((d) => d.id === added.id), 'removed');
    const acts = await api.listActivities({ accountId: CX, limit: 40 });
    assert(['deployment.created', 'deployment.updated', 'deployment.deleted'].every((x) => acts.some((a) => a.action === x)), 'logged');
  });

  await s.testAsync('people: stakeholder upsert, reporting loops refused; relations only inside one group', async () => {
    await api.loginDemo('am');
    const s1 = await api.saveStakeholder({ contact_id: 'ct_coxanh_huong', stance: 'supporter', strength: 'warm' });
    assert(s1.stored && s1.stance === 'supporter', 'saved');
    await expectError(api.saveStakeholder({ contact_id: 'ct_coxanh_dat', reports_to_contact_id: 'ct_coxanh_lan' }), 'validation', 'errors.care.reportsToCycle');
    await expectError(api.saveRelationLink({ from_contact_id: 'ct_coxanh_minh', to_contact_id: 'ct_thinhan_long', kind: 'works_with', note: null }), 'validation', 'errors.care.relationScope');
    const link = await api.saveRelationLink({ from_contact_id: 'ct_coxanh_khoa', to_contact_id: 'ct_maytrang_quoc', kind: 'works_with', note: 'Kiểm thử' });
    assert(link.cross_unit && link.sentence.includes('Mây Trắng'), link.sentence);
    await api.deleteRelationLink(link.id);
  });

  await s.testAsync('a promised date that moves is told to the client (shared line + bell); a taken-in request never goes back to "Mới"', async () => {
    await api.loginDemo('am');
    const moved = addDays(todayISO(), 24);
    await api.updateChangeRequest('cr_coxanh_06', { promised_date: moved, client_note: 'Kiểm thử: dời vì chờ bảng giá mới.' });
    await expectError(api.updateChangeRequest('cr_coxanh_06', { status: 'new' }), 'validation', 'errors.care.cannotReopenAsNew');
    const acts = await api.listActivities({ accountId: CX, limit: 30 });
    assert(acts.some((a) => a.action === 'change_request.rescheduled' && a.visibility === 'shared'), 'shared line');
    await api.loginDemo('client_owner');
    const [bell, mine] = await Promise.all([api.listNotifications(), api.listMyRequests()]);
    const item = bell.find((n) => n.kind === 'request' && n.link.includes('cr_coxanh_06') && n.title.includes('đổi ngày'));
    assert(item && item.body.includes(`${moved.slice(8, 10)}/${moved.slice(5, 7)}`) && item.body.includes('bảng giá mới'), 'client told the new date and the note');
    assertEqual(mine.find((x) => x.id === 'cr_coxanh_06')?.promised_date, moved, 'client view');
  });

  await s.testAsync("New Era's own proposal stays internal: no requester, no client line, no client notice", async () => {
    await api.loginDemo('am');
    const idea = await api.createChangeRequest({ account_id: CX, title: 'Kiểm thử: ý tưởng nội bộ', description: 'Nội bộ', source: 'internal', requested_by_contact_id: 'ct_coxanh_minh' });
    assertEqual(idea.requested_by, null, 'no requester');
    await api.updateChangeRequest(idea.id, { status: 'planned', promised_date: addDays(todayISO(), 10), plan_ref: 'Đợt 9', owner_id: 'u_member_tuan' });
    const acts = await api.listActivities({ accountId: CX, limit: 30 });
    assert(acts.filter((a) => a.target_id === idea.id).every((a) => a.visibility === 'internal'), 'internal lines only');
    await api.loginDemo('client_owner');
    const [bell, mine] = await Promise.all([api.listNotifications(), api.listMyRequests()]);
    assert(!mine.some((x) => x.id === idea.id) && !bell.some((n) => n.link.includes(idea.id)), 'invisible to the client');
    // numbered apart (ĐX-), so the client's own list never shows a gap after an internal idea
    assert(idea.code.startsWith('ĐX-'), `proposal code ${idea.code}`);
    const sent = await api.submitRequest({ title: 'Kiểm thử: số yêu cầu liền mạch', description: '' });
    assertEqual(sent.code, nextCrCode(mine.map((x) => x.code)), 'next client number follows the client list');
  });

  await s.testAsync('the same relation saved twice stays one link', async () => {
    await api.loginDemo('am');
    const a = await api.saveRelationLink({ from_contact_id: 'ct_coxanh_khoa', to_contact_id: 'ct_maytrang_quoc', kind: 'works_with', note: 'Lần 1' });
    const b = await api.saveRelationLink({ from_contact_id: 'ct_maytrang_quoc', to_contact_id: 'ct_coxanh_khoa', kind: 'works_with', note: 'Lần 2' });
    assertEqual(b.id, a.id, 'updated, not duplicated');
    await expectError(api.saveRelationLink({ id: 'rel_cx_ops', from_contact_id: 'ct_coxanh_khoa', to_contact_id: 'ct_maytrang_quoc', kind: 'works_with', note: null }), 'conflict', 'errors.care.relationExists');
    await api.deleteRelationLink(a.id);
  });

  await s.testAsync("the care clock counts New Era's touches: a client's request or an internal note does not reset it", async () => {
    await api.loginDemo('am');
    const before = (await api.getAccountCare('acc_thinhan')).care?.last_touch_at ?? null;
    await api.logInteraction({
      kind: 'note',
      occurred_at: nowISO(),
      subject: 'Kiểm thử: ghi chú nội bộ',
      summary: '',
      outcome: null,
      account_id: 'acc_thinhan',
      lead_id: null,
      opportunity_id: null,
      contact_id: null,
      next_follow_up_date: null,
    });
    await api.loginDemo('client_owner');
    await api.submitRequest({ title: 'Kiểm thử: yêu cầu của khách', description: '' });
    await api.loginDemo('am');
    const [ta, cx] = await Promise.all([api.getAccountCare('acc_thinhan'), api.getAccountCare(CX)]);
    assertEqual(ta.care?.last_touch_at ?? null, before, 'a note is not a touch');
    assert((cx.care?.days_since ?? 0) >= 0 && cx.care?.last_touch_at !== null, 'Cỏ Xanh still has its last touch');
    const cxTouch = cx.care?.last_touch_at ?? '';
    assert(cxTouch < nowISO().slice(0, 16), `a client request is not a touch (${cxTouch})`);
  });

  await s.testAsync('the daily sweep tells the AM and the director about delivery debt and requests waiting too long, once', async () => {
    await api.loginDemo('director');
    await api.resetDemoData();
    await api.runNotificationSweep(true);
    await api.runNotificationSweep(true);
    const bell = await api.listNotifications();
    const debt = bell.filter((n) => n.kind === 'request' && n.title.includes('nợ triển khai'));
    const waiting = bell.filter((n) => n.kind === 'request' && n.title.includes('chưa xử lý'));
    const undated = bell.filter((n) => n.kind === 'request' && n.title.includes('chưa hẹn ngày'));
    assertEqual(debt.length, 3, 'one notice per debt request');
    assertEqual(waiting.length, 2, 'one notice per request waiting > 7 days');
    assertEqual(undated.length, 1, 'one notice per request taken in > 14 days ago without a date (Hải Đăng YC-01)');
  });

  await s.testAsync('clients see their solutions without internal fields, and only their own requests', async () => {
    await api.loginDemo('client_owner');
    const [deps, mine] = await Promise.all([api.listClientDeployments(), api.listMyRequests()]);
    assert(deps.length >= 2 && deps.every((d) => !('contract_value' in d) && !('adoption' in d) && !('notes' in d) && !('owner' in d)), 'client deployments');
    assert(!JSON.stringify(mine).includes('Thịnh An') && mine.length >= 9, 'own account requests only');
    await expectError(api.getAccountCare(CX), 'forbidden');
  });
}

export async function runCareTests(): Promise<TestResult[]> {
  const s = createSuite('care');
  ruleTests(s);
  seedTests(s);
  const saved = getSession();
  try {
    await db.isolated(() => apiTests(s));
  } catch (err) {
    s.test('care api run', () => {
      throw err instanceof Error ? err : new Error(String(err));
    });
  } finally {
    setSession(saved);
  }
  return s.results;
}
