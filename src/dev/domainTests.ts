// Domain engine self tests (pure functions, small hand-built fixtures).
// Run in the browser: (await import('/src/dev/domainTests')).runDomainTests().filter(r => !r.ok)
import type { ID, ISODate, Milestone, PaymentSchedule, PriceUnit, QuoteLine, Task, TaskDependency } from '@/domain/types';
import type { HealthReason, TaskView } from '@/services/contract';
import type { TestResult } from '@/dev/testkit';
import type { PricingLookup } from '@/domain/quoteMath';
import { assert, assertEqual, createSuite } from '@/dev/testkit';
import { addDays } from '@/domain/dates';
import { atTime } from '@/domain/clock';
import { buildAccountGraph, findCycle, isLaunchMilestoneName, launchMilestone, taskDelayDays } from '@/domain/graph';
import { buildStatusLine, computeHealth, effectiveHealth } from '@/domain/health';
import {
  actionForType,
  canMoveTo,
  clientActionAllowed,
  clientActionPatch,
  compareClientTasks,
  dueInfo,
  priorityRank,
  reviewPatch,
  statusPatch,
} from '@/domain/taskRules';
import { computeQuote, diffQuoteLines, needsDirectorApproval } from '@/domain/quoteMath';
import { effectivePaymentStatus, isReceivable, paymentOverdueDays } from '@/domain/payments';
import { addressName, givenName, initials } from '@/domain/naming';

// ───────────────────────────── fixtures ─────────────────────────────

const TODAY: ISODate = '2026-10-06';
const AT = atTime(TODAY, '10:00');

function day(n: number): ISODate {
  return addDays(TODAY, n);
}

function mkTask(id: ID, over: Partial<Task> = {}): Task {
  return {
    id,
    project_id: 'p1',
    milestone_id: null,
    title: id,
    description: '',
    side: 'internal',
    type: 'work',
    assignee_id: null,
    delegated_by: null,
    delegated_at: null,
    delegation_note: null,
    requires_owner: false,
    waiting_on: 'internal',
    due_date: day(10),
    status: 'todo',
    impact_text: '',
    client_visible: true,
    reminder_count: 0,
    last_reminded_at: null,
    manual_unblock_reason: null,
    manual_unblocked_by: null,
    manual_unblocked_at: null,
    completed_at: null,
    quote_id: null,
    payment_schedule_id: null,
    revision: 1,
    answer_text: null,
    created_by: 'u_am',
    created_at: atTime(day(-30)),
    updated_at: atTime(day(-30)),
    deleted_at: null,
    ...over,
  };
}

function clientTask(id: ID, type: Task['type'], over: Partial<Task> = {}): Task {
  return mkTask(id, { side: 'client', type, waiting_on: 'client', ...over });
}

function mkMs(id: ID, orderNo: number, planned: ISODate, over: Partial<Milestone> = {}): Milestone {
  return {
    id,
    project_id: 'p1',
    name: id,
    order_no: orderNo,
    planned_date: planned,
    forecast_override_date: null,
    forecast_override_reason: null,
    status: 'upcoming',
    completed_at: null,
    client_visible: true,
    description: null,
    deleted_at: null,
    ...over,
  };
}

let depSeq = 0;
function blocks(from: ID, toTask: ID): TaskDependency {
  depSeq += 1;
  return { id: `d${depSeq}`, task_id: from, blocks_task_id: toTask, blocks_milestone_id: null, created_by: 'u_am', created_at: AT };
}
function holds(from: ID, milestone: ID): TaskDependency {
  depSeq += 1;
  return { id: `d${depSeq}`, task_id: from, blocks_task_id: null, blocks_milestone_id: milestone, created_by: 'u_am', created_at: AT };
}

function graph(tasks: Task[], deps: TaskDependency[], milestones: Milestone[]) {
  return buildAccountGraph({ tasks, deps, milestones, today: TODAY });
}

function ids(list: { id: ID }[]): ID[] {
  return list.map((x) => x.id);
}

function mkPay(id: ID, over: Partial<PaymentSchedule> = {}): PaymentSchedule {
  return {
    id,
    contract_id: 'c1',
    name: `Đợt ${id}`,
    percent: 30,
    amount: 300_000_000,
    milestone_id: null,
    due_date: day(-12),
    status: 'invoiced',
    invoice_no: 'HD-001',
    invoiced_at: atTime(day(-40)),
    paid_at: null,
    client_reported_at: null,
    proof_file_id: null,
    auto_task_enabled: true,
    task_id: null,
    deleted_at: null,
    ...over,
  };
}

function mkLine(id: ID, priceItemId: ID, over: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id,
    quote_id: 'q1',
    price_item_id: priceItemId,
    description: null,
    qty: 1,
    unit_price: 0,
    discount_pct: 0,
    vat_rate: 10,
    sort_order: 0,
    ...over,
  };
}

interface FakeItem {
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  cost_price: number;
}
const ITEMS: Record<string, FakeItem> = {
  pA: { code: 'A', name: 'Gói A', unit: 'user', list_price: 1_000_000, cost_price: 600_000 },
  pB: { code: 'B', name: 'Gói B', unit: 'month', list_price: 500_000, cost_price: 200_000 },
  pC: { code: 'C', name: 'Gói C', unit: 'package', list_price: 1_000_000, cost_price: 0 },
};
const NEGOTIATED: Record<string, number> = { pA: 900_000 };
const pricing: PricingLookup = {
  item: (id) => ITEMS[id],
  applicable: (id) => NEGOTIATED[id] ?? ITEMS[id]?.list_price ?? 0,
};

function view(id: ID, title: string, due: ISODate, rank: 1 | 2 | 3 | 4): TaskView {
  return { id, title, due_date: due, priority_rank: rank } as unknown as TaskView;
}

// ───────────────────────────── graph ─────────────────────────────

function graphTests(): TestResult[] {
  const s = createSuite('graph');

  s.test('taskDelayDays: open task counts days past due, 0 when due today or later', () => {
    assertEqual(taskDelayDays(mkTask('a', { due_date: day(-6) }), TODAY), 6, 'overdue 6');
    assertEqual(taskDelayDays(mkTask('a', { due_date: TODAY }), TODAY), 0, 'due today');
    assertEqual(taskDelayDays(mkTask('a', { due_date: day(3) }), TODAY), 0, 'future');
  });

  s.test('taskDelayDays: done task uses the Vietnam calendar day of completed_at', () => {
    // 2026-10-03 20:00 UTC = 2026-10-04 03:00 in Vietnam → 3 days after a 2026-10-01 due date
    const late = mkTask('a', { status: 'done', due_date: '2026-10-01', completed_at: '2026-10-03T20:00:00.000Z' });
    assertEqual(taskDelayDays(late, TODAY), 3, 'done late');
    const onTime = mkTask('b', { status: 'done', due_date: day(-2), completed_at: atTime(day(-3)) });
    assertEqual(taskDelayDays(onTime, TODAY), 0, 'done early');
  });

  s.test('direct block: open blocker blocks, done blocker does not', () => {
    const g = graph([mkTask('A'), mkTask('B')], [blocks('A', 'B')], []);
    assert(g.isBlocked('B'), 'B blocked');
    assertEqual(ids(g.blockersOf('B')), ['A'], 'blockers');
    assertEqual(ids(g.blocksTasks('A')), ['B'], 'downstream');
    assert(!g.isBlocked('A'), 'A free');
    const g2 = graph([mkTask('A', { status: 'done', completed_at: AT }), mkTask('B')], [blocks('A', 'B')], []);
    assert(!g2.isBlocked('B'), 'B free once A done');
    assertEqual(g2.blockersOf('B'), [], 'no unfinished blockers');
  });

  s.test('blockersOf lists only unfinished blockers, earliest due first', () => {
    const g = graph(
      [mkTask('A', { due_date: day(5) }), mkTask('C', { due_date: day(-2) }), mkTask('D', { status: 'done', completed_at: AT }), mkTask('B')],
      [blocks('A', 'B'), blocks('C', 'B'), blocks('D', 'B')],
      [],
    );
    assertEqual(ids(g.blockersOf('B')), ['C', 'A'], 'order');
  });

  s.test('indirect A→B→M: A delays M and holds it', () => {
    const tasks = [mkTask('A', { due_date: day(-6) }), mkTask('B', { due_date: day(10) })];
    const g = graph(tasks, [blocks('A', 'B'), holds('B', 'M')], [mkMs('M', 1, day(22))]);
    const f = g.forecast('M');
    assertEqual(
      [f.source, f.delay_days, f.forecast_date, f.cause_task_id, f.cause_delay_days],
      ['dependency', 6, day(28), 'A', 6],
      'forecast',
    );
    assertEqual(ids(g.milestonesHeldBy('A')), ['M'], 'A holds M indirectly');
    assertEqual(ids(g.milestonesHeldBy('B')), ['M'], 'B holds M directly');
  });

  s.test('done-late blocker still delays its milestone', () => {
    const a = mkTask('A', { status: 'done', due_date: day(-10), completed_at: atTime(day(-6)) });
    const g = graph([a], [holds('A', 'M')], [mkMs('M', 1, day(5))]);
    const f = g.forecast('M');
    assertEqual([f.source, f.delay_days, f.cause_task_id], ['dependency', 4, 'A'], 'forecast');
    assertEqual(g.milestonesHeldBy('A'), [], 'a done task holds nothing');
  });

  s.test('done blocker stops the upstream walk', () => {
    const tasks = [
      mkTask('X', { due_date: day(-8) }),
      mkTask('A', { status: 'done', due_date: day(-4), completed_at: atTime(day(-2)) }),
    ];
    const g = graph(tasks, [blocks('X', 'A'), holds('A', 'M')], [mkMs('M', 1, day(5))]);
    const f = g.forecast('M');
    assertEqual([f.delay_days, f.cause_task_id], [2, 'A'], 'only A counts');
    assertEqual(g.milestonesHeldBy('X'), [], 'X does not hold M through a done task');
  });

  s.test('manual unblock: not blocked, edges into it ignored for delay', () => {
    const tasks = [
      mkTask('A', { due_date: day(-5) }),
      mkTask('B', { due_date: day(4), manual_unblock_reason: 'Khách đồng ý làm song song' }),
    ];
    const g = graph(tasks, [blocks('A', 'B'), holds('B', 'M')], [mkMs('M', 1, day(10))]);
    assert(!g.isBlocked('B'), 'B not blocked');
    assertEqual(g.blockersOf('B'), [], 'no blockers');
    assertEqual(g.forecast('M').source, 'on_plan', 'M on plan');
    assertEqual(g.milestonesHeldBy('A'), [], 'A no longer holds M');
    assertEqual(ids(g.milestonesHeldBy('B')), ['M'], 'B still holds M');
  });

  s.test('multiple blockers: max delay wins', () => {
    const tasks = [mkTask('A', { due_date: day(-3) }), mkTask('C', { due_date: day(-7) })];
    const g = graph(tasks, [holds('A', 'M'), holds('C', 'M')], [mkMs('M', 1, day(10))]);
    const f = g.forecast('M');
    assertEqual([f.delay_days, f.cause_task_id], [7, 'C'], 'C is the cause');
  });

  s.test('equal delays: cause is the task with the earliest due date', () => {
    const tasks = [
      mkTask('C', { due_date: day(-7) }),
      mkTask('D', { status: 'done', due_date: day(-20), completed_at: atTime(day(-13)) }),
    ];
    const g = graph(tasks, [holds('C', 'M'), holds('D', 'M')], [mkMs('M', 1, day(10))]);
    const f = g.forecast('M');
    assertEqual([f.delay_days, f.cause_task_id], [7, 'D'], 'tie → earliest due');
  });

  s.test('cascade: later milestones shift with the earlier one', () => {
    const tasks = [mkTask('A', { due_date: day(-6) }), mkTask('Y', { due_date: day(-2) }), mkTask('Z', { due_date: day(-9) })];
    const ms = [mkMs('M1', 1, day(10)), mkMs('M2', 2, day(20)), mkMs('M3', 3, day(30)), mkMs('M4', 4, day(40)), mkMs('M5', 5, day(50))];
    const g = graph(tasks, [holds('A', 'M1'), holds('Y', 'M3'), holds('Z', 'M4')], ms);
    const f2 = g.forecast('M2');
    assertEqual(
      [f2.source, f2.delay_days, f2.forecast_date, f2.cascade_from_milestone_id, f2.cause_task_id, f2.cause_delay_days],
      ['cascade', 6, day(26), 'M1', 'A', 6],
      'M2 cascades from M1',
    );
    const f3 = g.forecast('M3');
    assertEqual([f3.source, f3.delay_days, f3.cascade_from_milestone_id], ['cascade', 6, 'M1'], 'M3: 6 > own 2');
    const f4 = g.forecast('M4');
    assertEqual([f4.source, f4.delay_days, f4.cause_task_id, f4.cascade_from_milestone_id], ['dependency', 9, 'Z', null], 'M4 own 9');
    const f5 = g.forecast('M5');
    assertEqual([f5.source, f5.delay_days, f5.cascade_from_milestone_id, f5.cause_task_id], ['cascade', 9, 'M4', 'Z'], 'M5 from M4');
  });

  s.test('own delay equal to the carried shift stays "dependency"', () => {
    const tasks = [mkTask('A', { due_date: day(-6) }), mkTask('B', { due_date: day(-6) })];
    const g = graph(tasks, [holds('A', 'M1'), holds('B', 'M2')], [mkMs('M1', 1, day(10)), mkMs('M2', 2, day(20))]);
    assertEqual([g.forecast('M2').source, g.forecast('M2').cause_task_id], ['dependency', 'B'], 'not strictly greater');
  });

  s.test('manual override sets the date and pushes later milestones', () => {
    const ms = [
      mkMs('M1', 1, day(10), { forecast_override_date: day(14), forecast_override_reason: 'Khách dời lịch họp' }),
      mkMs('M2', 2, day(20)),
    ];
    const g = graph([], [], ms);
    const f1 = g.forecast('M1');
    assertEqual(
      [f1.source, f1.forecast_date, f1.delay_days, f1.override_reason, f1.cause_task_id],
      ['manual', day(14), 4, 'Khách dời lịch họp', null],
      'M1 manual',
    );
    const f2 = g.forecast('M2');
    assertEqual([f2.source, f2.delay_days, f2.cascade_from_milestone_id, f2.cause_task_id], ['cascade', 4, 'M1', null], 'M2 cascade');
  });

  s.test('manual override earlier than plan does not pull later milestones', () => {
    const ms = [mkMs('M1', 1, day(10), { forecast_override_date: day(7), forecast_override_reason: 'Sớm hơn' }), mkMs('M2', 2, day(20))];
    const g = graph([], [], ms);
    assertEqual(g.forecast('M1').delay_days, -3, 'negative delay kept on M1');
    assertEqual([g.forecast('M2').source, g.forecast('M2').delay_days], ['on_plan', 0], 'M2 unaffected');
  });

  s.test('done milestone: forecast = completion day, does not cascade', () => {
    const tasks = [mkTask('A', { status: 'done', due_date: day(-12), completed_at: atTime(day(-7)) })];
    const ms = [mkMs('M1', 1, day(-10), { status: 'done', completed_at: atTime(day(-5)) }), mkMs('M2', 2, day(20))];
    const g = graph(tasks, [holds('A', 'M1')], ms);
    const f1 = g.forecast('M1');
    assertEqual([f1.source, f1.forecast_date, f1.delay_days], ['done', day(-5), 5], 'M1 done');
    assertEqual(g.forecast('M2').source, 'on_plan', 'M2 not pushed');
  });

  s.test('a delayed milestone keeps pushing past a done milestone; other projects untouched', () => {
    const tasks = [mkTask('A', { due_date: day(-6) })];
    const ms = [
      mkMs('M1', 1, day(10)),
      mkMs('M2', 2, day(-1), { status: 'done', completed_at: atTime(day(-1)) }),
      mkMs('M3', 3, day(30)),
      mkMs('Q1', 1, day(30), { project_id: 'p2' }),
    ];
    const g = graph(tasks, [holds('A', 'M1')], ms);
    assertEqual([g.forecast('M3').source, g.forecast('M3').delay_days, g.forecast('M3').cascade_from_milestone_id], ['cascade', 6, 'M1'], 'M3');
    assertEqual(g.forecast('Q1').source, 'on_plan', 'other project');
  });

  s.test('findCycle: self dependency is rejected', () => {
    assertEqual(findCycle([], [{ task_id: 'a', blocks_task_id: 'a' }]), ['a', 'a'], 'self edge');
  });

  s.test('findCycle: two-task cycle', () => {
    assertEqual(findCycle([{ task_id: 'a', blocks_task_id: 'b' }], [{ task_id: 'b', blocks_task_id: 'a' }]), ['b', 'a', 'b'], 'cycle');
  });

  s.test('findCycle: long cycle path', () => {
    const existing = [
      { task_id: 'a', blocks_task_id: 'b' },
      { task_id: 'b', blocks_task_id: 'c' },
      { task_id: 'c', blocks_task_id: 'd' },
      { task_id: 'd', blocks_task_id: 'e' },
      { task_id: 'x', blocks_task_id: null },
    ];
    assertEqual(findCycle(existing, [{ task_id: 'e', blocks_task_id: 'a' }]), ['e', 'a', 'b', 'c', 'd', 'e'], 'path');
  });

  s.test('findCycle: acyclic additions return null', () => {
    const existing = [
      { task_id: 'a', blocks_task_id: 'b' },
      { task_id: 'b', blocks_task_id: null },
    ];
    assertEqual(findCycle(existing, [{ task_id: 'a', blocks_task_id: 'c' }, { task_id: 'c', blocks_task_id: 'b' }]), null, 'no cycle');
  });

  // Seed-like chain: approval (client, overdue 6) → dev → UAT; approval → Thiết kế; Go-live last.
  const chainTasks = [
    clientTask('appr', 'approval', { due_date: day(-6) }),
    mkTask('dev', { due_date: day(12) }),
    mkTask('z', { due_date: day(30) }),
  ];
  const chainDeps = [blocks('appr', 'dev'), holds('dev', 'UAT'), holds('appr', 'TK'), holds('z', 'GL')];
  const chainMs = [
    mkMs('KO', 1, day(-30), { status: 'done', completed_at: atTime(day(-30)) }),
    mkMs('TK', 2, day(5)),
    mkMs('UAT', 3, day(22)),
    mkMs('GL', 4, day(40)),
  ];

  s.test('chain: blocker → task → first milestone → final milestone', () => {
    const g = graph(chainTasks, chainDeps, chainMs);
    assertEqual(
      g.chain('dev'),
      [
        { kind: 'task', id: 'appr', state: 'stuck' },
        { kind: 'task', id: 'dev', state: 'pending' },
        { kind: 'milestone', id: 'UAT', state: 'pending' },
        { kind: 'milestone', id: 'GL', state: 'pending' },
      ],
      'chain(dev)',
    );
    assertEqual(
      g.chain('appr').map((n) => `${n.id}:${n.state}`),
      ['appr:stuck', 'dev:pending', 'UAT:pending', 'GL:pending'],
      'chain(appr) follows the route to the milestone with the most impact (UAT over the direct Thiết kế)',
    );
    assertEqual(g.chain('z').map((n) => n.id), ['z', 'GL'], 'final not repeated');
  });

  s.test('chain: same highest milestone → shortest route wins', () => {
    const tasks = [mkTask('a', { due_date: day(-2) }), mkTask('b'), mkTask('c'), mkTask('d')];
    const deps = [blocks('a', 'b'), blocks('b', 'c'), holds('c', 'UAT'), blocks('a', 'd'), holds('d', 'UAT'), holds('a', 'TK')];
    const g = graph(tasks, deps, chainMs);
    assertEqual(g.chain('a').map((n) => n.id), ['a', 'd', 'UAT', 'GL'], 'shortest route to UAT');
  });

  s.test('chain + launch milestone: ends on Go-live, not on a trailing “Hỗ trợ sau go-live”', () => {
    const tasks = [clientTask('appr', 'approval', { due_date: day(-6) }), mkTask('dev', { due_date: day(12) })];
    const ms = [
      mkMs('TK', 1, day(5), { name: 'Thiết kế' }),
      mkMs('UAT', 2, day(22), { name: 'UAT' }),
      mkMs('GL', 3, day(40), { name: 'Go-live' }),
      mkMs('SUP', 4, day(70), { name: 'Hỗ trợ sau go-live' }),
    ];
    const g = graph(tasks, [blocks('appr', 'dev'), holds('dev', 'UAT'), holds('appr', 'TK')], ms);
    assertEqual(g.chain('appr').map((n) => n.id), ['appr', 'dev', 'UAT', 'GL'], 'chain ends on Go-live');
    assertEqual(launchMilestone(ms)?.id, 'GL', 'launch milestone');
    assertEqual(launchMilestone(ms.filter((m) => m.id !== 'GL'))?.id, 'SUP', 'no Go-live → last milestone');
    assertEqual([isLaunchMilestoneName('Go live'), isLaunchMilestoneName('GO-LIVE'), isLaunchMilestoneName('Hỗ trợ sau go-live')], [true, true, false], 'names');
  });

  s.test('chain for a client: hidden milestones are skipped', () => {
    const visible = (m: { client_visible: boolean }) => m.client_visible;
    // the most impact is a hidden milestone: the client chain takes the route to a visible one
    const ms = [...chainMs, mkMs('SECRET', 5, day(60), { client_visible: false })];
    const g = graph(chainTasks, [...chainDeps, holds('appr', 'SECRET')], ms);
    assertEqual(g.chain('appr').map((n) => n.id), ['appr', 'SECRET'], 'internal: most impact');
    assertEqual(g.chain('appr', visible).map((n) => n.id), ['appr', 'dev', 'UAT', 'GL'], 'client: visible route');
    // only a hidden milestone downstream: the visible launch milestone it pushes back (cascade) ends the chain
    const ms2 = [
      mkMs('TK', 1, day(5)),
      mkMs('HID', 2, day(15), { client_visible: false }),
      mkMs('UAT', 3, day(22)),
      mkMs('GL', 4, day(40)),
    ];
    const g2 = graph([mkTask('h', { due_date: day(-2) })], [holds('h', 'HID')], ms2);
    assertEqual(g2.chain('h').map((n) => n.id), ['h', 'HID', 'GL'], 'internal');
    assertEqual(g2.chain('h', visible).map((n) => n.id), ['h', 'GL'], 'client');
  });

  s.test('chain: at most one stuck node', () => {
    const tasks = [clientTask('appr', 'approval', { due_date: day(-6) }), mkTask('dev', { due_date: day(-1) })];
    const g = graph(tasks, chainDeps, chainMs);
    assertEqual(g.chain('dev').map((n) => n.state), ['stuck', 'pending', 'pending', 'pending'], 'states');
  });

  s.test('chain: done nodes, late milestone as stuck, no milestone', () => {
    const tasks = [
      clientTask('appr', 'approval', { status: 'done', waiting_on: null, due_date: day(-6), completed_at: atTime(day(-7)) }),
      mkTask('dev', { due_date: day(12) }),
      mkTask('lonely'),
      mkTask('q', { project_id: 'p3', due_date: day(3) }),
    ];
    const ms = [...chainMs, mkMs('L1', 1, day(-2), { project_id: 'p3' }), mkMs('L2', 2, day(30), { project_id: 'p3' })];
    const g = graph(tasks, [blocks('appr', 'dev'), holds('dev', 'UAT'), holds('q', 'L1')], ms);
    assertEqual(g.chain('appr').map((n) => `${n.id}:${n.state}`), ['appr:done', 'dev:pending', 'UAT:pending', 'GL:pending'], 'done start');
    assertEqual(g.chain('q').map((n) => `${n.id}:${n.state}`), ['q:pending', 'L1:stuck', 'L2:pending'], 'late milestone');
    assertEqual(g.chain('lonely').map((n) => n.id), ['lonely'], 'no milestone');
    assertEqual(g.chain('unknown'), [], 'unknown task');
  });

  s.test('milestonesHeldBy ignores done milestones and done tasks', () => {
    const tasks = [mkTask('A', { due_date: day(-1) }), mkTask('B', { status: 'done', completed_at: AT })];
    const ms = [mkMs('M1', 1, day(-3), { status: 'done', completed_at: AT }), mkMs('M2', 2, day(9))];
    const g = graph(tasks, [holds('A', 'M1'), holds('A', 'M2'), holds('B', 'M2')], ms);
    assertEqual(ids(g.milestonesHeldBy('A')), ['M2'], 'A');
    assertEqual(g.milestonesHeldBy('B'), [], 'B done');
    assert(g.forecast('M2').delay_days === 1, 'M2 delayed 1 by A');
  });

  return s.results;
}

// ───────────────────────────── health ─────────────────────────────

function healthTests(): TestResult[] {
  const s = createSuite('health');
  const M = [mkMs('M', 1, day(20))];

  s.test('red: overdue task holding a milestone; reason carries every field', () => {
    const tasks = [clientTask('appr', 'approval', { title: 'Duyệt thiết kế', due_date: day(-6) })];
    const g = graph(tasks, [holds('appr', 'M')], M);
    const h = computeHealth(g, tasks, [], TODAY);
    assertEqual(h.auto, 'blocked', 'auto');
    assertEqual(
      h.reasons,
      [
        {
          kind: 'overdue_blocking',
          task_id: 'appr',
          task_title: 'Duyệt thiết kế',
          side: 'client',
          waiting_on: 'client',
          overdue_days: 6,
          milestone_id: 'M',
          milestone_name: 'M',
        },
      ],
      'reasons',
    );
  });

  s.test('red through indirect blocking (A→B→M)', () => {
    const tasks = [mkTask('A', { due_date: day(-2) }), mkTask('B', { due_date: day(9) })];
    const g = graph(tasks, [blocks('A', 'B'), holds('B', 'M')], M);
    assertEqual(computeHealth(g, tasks, [], TODAY).auto, 'blocked', 'auto');
  });

  s.test('manual unblock turns red into yellow (overdue task no longer holds the milestone)', () => {
    const tasks = [mkTask('A', { due_date: day(-2) }), mkTask('B', { due_date: day(9), manual_unblock_reason: 'Làm song song' })];
    const g = graph(tasks, [blocks('A', 'B'), holds('B', 'M')], M);
    const h = computeHealth(g, tasks, [], TODAY);
    assertEqual([h.auto, h.reasons.map((r) => r.kind)], ['attention', ['overdue_task']], 'attention');
  });

  s.test('an overdue task that is itself blocked gives no reason — its blocker carries it', () => {
    const tasks = [
      clientTask('appr', 'approval', { due_date: day(-6) }),
      mkTask('dev', { due_date: day(-2) }),
      mkTask('doc', { due_date: day(-1) }),
    ];
    const g = graph(tasks, [blocks('appr', 'dev'), holds('dev', 'M'), blocks('appr', 'doc')], M);
    const h = computeHealth(g, tasks, [], TODAY);
    assertEqual(h.auto, 'blocked', 'auto');
    assertEqual(h.reasons.map((r) => (r.kind === 'overdue_payment' ? r.payment_id : `${r.kind}:${r.task_id}`)), ['overdue_blocking:appr'], 'only the blocker');
    const line = buildStatusLine({ health: h.auto, overridden: false, reasons: h.reasons, headline: (id) => ({ name: id, delay_days: 6 }) });
    assertEqual(line.kind, 'waiting_client', 'New Era is not blamed');
  });

  s.test('manually unblocked overdue task gives its own reason again', () => {
    const tasks = [clientTask('appr', 'approval', { due_date: day(-6) }), mkTask('dev', { due_date: day(-2), manual_unblock_reason: 'Làm song song' })];
    const g = graph(tasks, [blocks('appr', 'dev'), holds('dev', 'M')], M);
    const h = computeHealth(g, tasks, [], TODAY);
    assertEqual(h.reasons.map((r) => (r.kind === 'overdue_payment' ? r.payment_id : `${r.kind}:${r.task_id}`)), ['overdue_blocking:dev', 'overdue_task:appr'], 'reasons');
  });

  s.test('overdue payment task is represented by its overdue installment (one reason)', () => {
    const tasks = [clientTask('pt', 'payment', { due_date: day(-12), payment_schedule_id: 'pay1' })];
    const h = computeHealth(graph(tasks, [], M), tasks, [mkPay('pay1')], TODAY);
    assertEqual([h.auto, h.reasons.map((r) => r.kind)], ['attention', ['overdue_payment']], 'reasons');
    const line = buildStatusLine({ health: h.auto, overridden: false, reasons: h.reasons, headline: (id) => ({ name: id, delay_days: 0 }) });
    assertEqual(line, { tone: 'attention', kind: 'payment_overdue', count: 1 }, 'status line');
    const notOverdue = computeHealth(graph(tasks, [], M), tasks, [mkPay('pay1', { due_date: day(2) })], TODAY);
    assertEqual(notOverdue.reasons.map((r) => r.kind), ['overdue_task'], 'installment not overdue → the task itself counts');
  });

  s.test('yellow: overdue task not holding a milestone', () => {
    const tasks = [mkTask('A', { due_date: day(-1) })];
    const h = computeHealth(graph(tasks, [], M), tasks, [], TODAY);
    assertEqual(h.auto, 'attention', 'auto');
    assertEqual(h.reasons[0], { kind: 'overdue_task', task_id: 'A', task_title: 'A', side: 'internal', waiting_on: 'internal', overdue_days: 1 }, 'reason');
  });

  s.test('yellow: payment overdue', () => {
    const h = computeHealth(graph([], [], M), [], [mkPay('pay1')], TODAY);
    assertEqual(h.auto, 'attention', 'auto');
    assertEqual(h.reasons, [{ kind: 'overdue_payment', payment_id: 'pay1', name: 'Đợt pay1', overdue_days: 12, amount: 300_000_000 }], 'reason');
  });

  s.test('due-soon boundary: 3 days left → yellow, 4 days left → green', () => {
    const t3 = [mkTask('A', { due_date: day(3) })];
    const h3 = computeHealth(graph(t3, [holds('A', 'M')], M), t3, [], TODAY);
    assertEqual([h3.auto, h3.reasons[0]?.kind], ['attention', 'due_soon_blocking'], '3 days');
    const t4 = [mkTask('A', { due_date: day(4) })];
    const h4 = computeHealth(graph(t4, [holds('A', 'M')], M), t4, [], TODAY);
    assertEqual([h4.auto, h4.reasons.length], ['on_track', 0], '4 days');
  });

  s.test('due today (0 days left) holding a milestone is due soon, not overdue', () => {
    const t = [mkTask('A', { due_date: TODAY })];
    const h = computeHealth(graph(t, [holds('A', 'M')], M), t, [], TODAY);
    const r = h.reasons[0];
    assert(r !== undefined && r.kind === 'due_soon_blocking' && r.days_left === 0, 'due_soon_blocking with days_left 0');
  });

  s.test('green: nothing late, done/paid things ignored', () => {
    const tasks = [mkTask('A', { status: 'done', due_date: day(-9), completed_at: atTime(day(-3)) }), mkTask('B', { due_date: day(8) })];
    const h = computeHealth(graph(tasks, [holds('A', 'M')], M), tasks, [mkPay('p', { status: 'paid' })], TODAY);
    assertEqual([h.auto, h.reasons], ['on_track', []], 'green');
  });

  s.test('reasons ordering', () => {
    const tasks = [
      mkTask('b2', { due_date: day(-2) }),
      clientTask('b6', 'approval', { due_date: day(-6) }),
      mkTask('s3', { due_date: day(3) }),
      mkTask('s1', { due_date: day(1) }),
      mkTask('o4', { due_date: day(-4) }),
      mkTask('o9', { due_date: day(-9) }),
    ];
    const g = graph(tasks, [holds('b2', 'M'), holds('b6', 'M'), holds('s3', 'M'), holds('s1', 'M')], M);
    const h = computeHealth(g, tasks, [mkPay('pay')], TODAY);
    assertEqual(
      h.reasons.map((r) => (r.kind === 'overdue_payment' ? r.payment_id : r.task_id)),
      ['b6', 'b2', 's1', 's3', 'o9', 'o4', 'pay'],
      'order',
    );
    assertEqual(h.auto, 'blocked', 'auto');
  });

  s.test('override wins over the computed value', () => {
    assertEqual(effectiveHealth('blocked', 'on_track'), { value: 'on_track', overridden: true }, 'override');
    assertEqual(effectiveHealth('attention', null), { value: 'attention', overridden: false }, 'auto');
  });

  return s.results;
}

// ───────────────────────────── status line ─────────────────────────────

function statusLineTests(): TestResult[] {
  const s = createSuite('statusLine');
  const headline = (id: ID) => (id === 'UAT' ? { name: 'Go-live', delay_days: 6 } : { name: id, delay_days: 4 });
  const ob = (id: ID, waitingOn: 'client' | 'internal', days: number, ms = 'UAT'): HealthReason => ({
    kind: 'overdue_blocking',
    task_id: id,
    task_title: `T ${id}`,
    side: waitingOn === 'client' ? 'client' : 'internal',
    waiting_on: waitingOn,
    overdue_days: days,
    milestone_id: ms,
    milestone_name: ms,
  });
  const ds = (id: ID, side: 'client' | 'internal'): HealthReason => ({
    kind: 'due_soon_blocking',
    task_id: id,
    task_title: `T ${id}`,
    side,
    waiting_on: side,
    days_left: 2,
    milestone_id: 'UAT',
    milestone_name: 'UAT',
  });
  const ot: HealthReason = { kind: 'overdue_task', task_id: 'o1', task_title: 'T o1', side: 'internal', waiting_on: 'internal', overdue_days: 2 };
  const op: HealthReason = { kind: 'overdue_payment', payment_id: 'pay', name: 'Đợt 2', overdue_days: 12, amount: 1 };

  s.test('blocked + client-waiting reason → waiting_client with headline', () => {
    const line = buildStatusLine({ health: 'blocked', overridden: false, reasons: [ob('a', 'client', 6), ob('i', 'internal', 5, 'TK'), ob('b', 'client', 2)], headline });
    assertEqual(line, { tone: 'blocked', kind: 'waiting_client', count: 2, milestone_name: 'Go-live', delay_days: 6 }, 'line');
  });

  s.test('waiting_client counts only tasks holding the same headline milestone (two projects)', () => {
    // UAT (project A) heads to A's Go-live; KS (project B) heads to B's Go-live — same name, different milestone
    const twoProjects = (id: ID) =>
      id === 'UAT' ? { name: 'Go-live', delay_days: 6, id: 'golive_a' } : { name: 'Go-live', delay_days: 3, id: 'golive_b' };
    const line = buildStatusLine({ health: 'blocked', overridden: false, reasons: [ob('a', 'client', 6), ob('b', 'client', 3, 'KS')], headline: twoProjects });
    assertEqual(line, { tone: 'blocked', kind: 'waiting_client', count: 1, milestone_name: 'Go-live', delay_days: 6 }, 'line');
  });

  s.test('waiting_client delay is what the client tasks cause, not a larger delay from another cause', () => {
    const hiddenCause = (_id: ID) => ({ name: 'Go-live', delay_days: 9, id: 'golive' });
    const line = buildStatusLine({ health: 'blocked', overridden: false, reasons: [ob('a', 'client', 6)], headline: hiddenCause });
    assertEqual(line, { tone: 'blocked', kind: 'waiting_client', count: 1, milestone_name: 'Go-live', delay_days: 6 }, 'line');
  });

  s.test('blocked + only New Era reasons → waiting_internal', () => {
    const line = buildStatusLine({ health: 'blocked', overridden: false, reasons: [ob('i', 'internal', 4, 'TK')], headline });
    assertEqual(line, { tone: 'blocked', kind: 'waiting_internal', milestone_name: 'TK', delay_days: 4, task_title: 'T i' }, 'line');
  });

  s.test('waiting_internal delay is what the named visible task causes, not a hidden task’s larger delay', () => {
    const hiddenCause = (_id: ID) => ({ name: 'Go-live', delay_days: 10, id: 'golive' });
    const line = buildStatusLine({ health: 'blocked', overridden: false, reasons: [ob('i', 'internal', 1, 'PT')], headline: hiddenCause });
    assertEqual(line, { tone: 'blocked', kind: 'waiting_internal', milestone_name: 'Go-live', delay_days: 1, task_title: 'T i' }, 'line');
  });

  s.test('blocked with no visible reason → generic', () => {
    assertEqual(buildStatusLine({ health: 'blocked', overridden: false, reasons: [], headline }), { tone: 'blocked', kind: 'generic' }, 'line');
  });

  s.test('overridden → generic with the override tone', () => {
    assertEqual(
      buildStatusLine({ health: 'attention', overridden: true, reasons: [ob('a', 'client', 6)], headline }),
      { tone: 'attention', kind: 'generic' },
      'line',
    );
  });

  s.test('attention: client due-soon blocking first', () => {
    const line = buildStatusLine({ health: 'attention', overridden: false, reasons: [ds('x', 'internal'), ds('c', 'client'), ot, op], headline });
    assertEqual(line, { tone: 'attention', kind: 'due_soon_blocking', count: 1, milestone_name: 'UAT' }, 'line');
  });

  s.test('attention: overdue, then payment_overdue, then generic', () => {
    assertEqual(
      buildStatusLine({ health: 'attention', overridden: false, reasons: [ds('x', 'internal'), ot, op], headline }),
      { tone: 'attention', kind: 'overdue', count: 1 },
      'overdue',
    );
    assertEqual(
      buildStatusLine({ health: 'attention', overridden: false, reasons: [op], headline }),
      { tone: 'attention', kind: 'payment_overdue', count: 1 },
      'payment',
    );
    assertEqual(buildStatusLine({ health: 'attention', overridden: false, reasons: [], headline }), { tone: 'attention', kind: 'generic' }, 'generic');
  });

  s.test('on_track → on_track', () => {
    assertEqual(buildStatusLine({ health: 'on_track', overridden: false, reasons: [], headline }), { tone: 'on_track', kind: 'on_track' }, 'auto');
    assertEqual(buildStatusLine({ health: 'on_track', overridden: true, reasons: [ot], headline }), { tone: 'on_track', kind: 'on_track' }, 'override');
  });

  return s.results;
}

// ───────────────────────────── task rules ─────────────────────────────

function taskRuleTests(): TestResult[] {
  const s = createSuite('taskRules');

  s.test('dueInfo: due today is not overdue, days_left 0, due soon', () => {
    assertEqual(dueInfo(TODAY, false, TODAY), { due_date: TODAY, days_left: 0, overdue: false, overdue_days: 0, due_soon: true }, 'today');
  });

  s.test('dueInfo: yesterday is overdue 1 day', () => {
    assertEqual(dueInfo(day(-1), false, TODAY), { due_date: day(-1), days_left: -1, overdue: true, overdue_days: 1, due_soon: false }, 'yesterday');
  });

  s.test('dueInfo: 3 days → due soon, 4 days → not; done is never overdue', () => {
    assert(dueInfo(day(3), false, TODAY).due_soon, '3 days due soon');
    assert(!dueInfo(day(4), false, TODAY).due_soon, '4 days not due soon');
    const done = dueInfo(day(-5), true, TODAY);
    assertEqual([done.overdue, done.overdue_days, done.due_soon, done.days_left], [false, 0, false, -5], 'done');
  });

  s.test('priorityRank buckets', () => {
    const od = dueInfo(day(-2), false, TODAY);
    const soon = dueInfo(day(2), false, TODAY);
    const later = dueInfo(day(9), false, TODAY);
    assertEqual(
      [
        priorityRank({ due: od, is_blocking_milestone: true }),
        priorityRank({ due: soon, is_blocking_milestone: true }),
        priorityRank({ due: od, is_blocking_milestone: false }),
        priorityRank({ due: soon, is_blocking_milestone: false }),
        priorityRank({ due: later, is_blocking_milestone: true }),
      ],
      [1, 2, 3, 4, 4],
      'ranks',
    );
  });

  s.test('compareClientTasks: rank, due date, then Vietnamese title', () => {
    const list = [
      view('r4', 'Trả lời câu hỏi', day(5), 4),
      view('r3', 'Tải dữ liệu', day(-1), 3),
      view('r1', 'Duyệt thiết kế', day(-6), 1),
      view('r2b', 'Xác nhận lịch', day(2), 2),
      view('r2a', 'Ấn định ngày', day(2), 2),
      view('r2c', 'Bổ sung hồ sơ', day(1), 2),
    ];
    const sorted = [...list].sort(compareClientTasks).map((v) => v.id);
    assertEqual(sorted, ['r1', 'r2c', 'r2a', 'r2b', 'r3', 'r4'], 'order');
  });

  s.test('actionForType for every client task type', () => {
    assertEqual(
      (['approval', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer'] as const).map(actionForType),
      ['approve', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer'],
      'actions',
    );
  });

  s.test('clientActionAllowed: type ↔ action matrix', () => {
    const allowed = (type: Task['type'], action: Parameters<typeof clientActionAllowed>[1]) =>
      clientActionAllowed(clientTask('t', type), action);
    assert(allowed('approval', 'approve') && allowed('approval', 'request_changes'), 'approval');
    assert(allowed('upload', 'submit_files') && allowed('sign', 'submit_files'), 'files');
    assert(allowed('payment', 'report_payment'), 'payment');
    assert(allowed('confirm', 'confirm') && allowed('attend', 'confirm'), 'confirm');
    assert(allowed('answer', 'answer'), 'answer');
    assert(!allowed('approval', 'submit_files') && !allowed('upload', 'approve') && !allowed('answer', 'confirm'), 'mismatch');
    assert(!allowed('payment', 'submit_files') && !allowed('attend', 'answer'), 'mismatch 2');
  });

  s.test('clientActionAllowed: only while waiting on the client and not done', () => {
    assert(!clientActionAllowed(clientTask('t', 'approval', { waiting_on: 'internal', status: 'waiting' }), 'approve'), 'waiting on New Era');
    assert(!clientActionAllowed(clientTask('t', 'approval', { status: 'done', waiting_on: null }), 'approve'), 'done');
    assert(!clientActionAllowed(mkTask('t', { type: 'approval', waiting_on: 'client' }), 'approve'), 'internal task');
  });

  s.test('clientActionPatch: approve / confirm / answer finish the task', () => {
    for (const action of ['approve', 'confirm', 'answer'] as const) {
      assertEqual(
        clientActionPatch(clientTask('t', 'approval'), action, AT),
        { status: 'done', waiting_on: null, completed_at: AT, updated_at: AT },
        action,
      );
    }
  });

  s.test('clientActionPatch: request_changes / submit_files / report_payment wait on New Era', () => {
    for (const action of ['request_changes', 'submit_files', 'report_payment'] as const) {
      assertEqual(
        clientActionPatch(clientTask('t', 'upload'), action, AT),
        { status: 'waiting', waiting_on: 'internal', completed_at: null, updated_at: AT },
        action,
      );
    }
  });

  s.test('reviewPatch: accept → done; return → todo, waiting on client, revision + 1', () => {
    const t = clientTask('t', 'upload', { status: 'waiting', waiting_on: 'internal', revision: 2 });
    assertEqual(reviewPatch(t, 'accept', AT), { status: 'done', waiting_on: null, completed_at: AT, updated_at: AT }, 'accept');
    assertEqual(
      reviewPatch(t, 'return', AT),
      { status: 'todo', waiting_on: 'client', completed_at: null, revision: 3, updated_at: AT },
      'return',
    );
  });

  s.test('canMoveTo: blocked tasks cannot leave todo; client tasks only todo/done', () => {
    const internal = mkTask('t');
    assertEqual(canMoveTo(internal, 'in_progress', true), { ok: false, reason: 'blocked' }, 'blocked → in_progress');
    assertEqual(canMoveTo(internal, 'done', true), { ok: false, reason: 'blocked' }, 'blocked → done');
    assertEqual(canMoveTo(internal, 'todo', true), { ok: true }, 'stay todo');
    assertEqual(canMoveTo(internal, 'in_progress', false), { ok: true }, 'free');
    const client = clientTask('c', 'approval');
    assertEqual(canMoveTo(client, 'in_progress', false), { ok: false, reason: 'invalid' }, 'client in_progress');
    assertEqual(canMoveTo(client, 'done', false), { ok: true }, 'client done');
  });

  s.test('statusPatch keeps completed_at and waiting_on consistent', () => {
    const t = mkTask('t', { status: 'in_progress' });
    assertEqual(statusPatch(t, 'done', AT), { status: 'done', waiting_on: null, completed_at: AT, updated_at: AT }, 'done');
    const done = mkTask('t', { status: 'done', waiting_on: null, completed_at: atTime(day(-1)) });
    assertEqual(statusPatch(done, 'todo', AT), { status: 'todo', waiting_on: 'internal', completed_at: null, updated_at: AT }, 'reopen');
    const c = clientTask('c', 'upload', { status: 'done', waiting_on: null, completed_at: AT });
    assertEqual(statusPatch(c, 'todo', AT), { status: 'todo', waiting_on: 'client', completed_at: null, updated_at: AT }, 'client reopen');
  });

  return s.results;
}

// ───────────────────────────── quote math ─────────────────────────────

function quoteTests(): TestResult[] {
  const s = createSuite('quoteMath');

  s.test('computeQuote: line and total numbers', () => {
    const lines = [
      mkLine('l2', 'pB', { qty: 3, unit_price: 500_000, vat_rate: 8, sort_order: 2 }),
      mkLine('l1', 'pA', { qty: 10, unit_price: 900_000, discount_pct: 5, vat_rate: 10, sort_order: 1 }),
    ];
    const { lines: out, totals } = computeQuote(lines, 2, pricing);
    assertEqual(out.map((l) => l.line.id), ['l1', 'l2'], 'sort_order');
    const a = out[0];
    assert(a !== undefined, 'line A');
    assertEqual(
      [a.code, a.list_price, a.applicable_price, a.subtotal, a.discount_amount, a.header_share, a.net, a.vat_amount, a.total, a.cost_total],
      ['A', 1_000_000, 900_000, 9_000_000, 450_000, 171_000, 8_379_000, 837_900, 9_216_900, 6_000_000],
      'line A',
    );
    assertEqual(totals, {
      gross_applicable: 10_500_000,
      subtotal: 10_500_000,
      line_discount: 450_000,
      header_discount: 201_000,
      net_before_vat: 9_849_000,
      vat: 955_500,
      grand_total: 10_804_500,
      effective_discount_pct: 6.2,
      cost_total: 6_600_000,
      margin: 3_249_000,
      margin_pct: 32.99,
    }, 'totals');
  });

  s.test('computeQuote: every money value is a whole VND', () => {
    const { lines: out, totals } = computeQuote([mkLine('l', 'pC', { qty: 3, unit_price: 333_333, discount_pct: 7.5, vat_rate: 8 })], 3.3, pricing);
    const l = out[0];
    assert(l !== undefined, 'line');
    for (const v of [l.subtotal, l.discount_amount, l.header_share, l.net, l.vat_amount, l.total, totals.grand_total]) {
      assert(Number.isInteger(v), `integer ${v}`);
    }
    assertEqual([l.subtotal, l.discount_amount, l.header_share, l.net, l.vat_amount, l.total], [999_999, 75_000, 30_525, 894_474, 71_558, 966_032], 'values');
  });

  s.test('unit price below the applicable price counts as discount; exactly 10% needs no approval', () => {
    const { totals } = computeQuote([mkLine('l', 'pC', { qty: 1, unit_price: 900_000 })], 0, pricing);
    assertEqual(totals.effective_discount_pct, 10, '10%');
    assert(!needsDirectorApproval(totals.effective_discount_pct, 10), '10 is not above 10');
  });

  s.test('threshold: 10.01% needs director approval', () => {
    const { totals } = computeQuote([mkLine('l', 'pC', { qty: 1, unit_price: 899_900 })], 0, pricing);
    assertEqual(totals.effective_discount_pct, 10.01, '10.01%');
    assert(needsDirectorApproval(totals.effective_discount_pct, 10), '10.01 > 10');
    assert(needsDirectorApproval(15, 10) && !needsDirectorApproval(9.99, 10), 'others');
  });

  s.test('diffQuoteLines: added / removed / modified / unchanged', () => {
    const prev = [
      mkLine('o1', 'pA', { qty: 1, unit_price: 900_000 }),
      mkLine('o2', 'pB', { qty: 2, unit_price: 500_000 }),
      mkLine('o3', 'pC', { description: 'Đào tạo', unit_price: 1_000_000 }),
    ];
    const next = [
      mkLine('n1', 'pA', { qty: 2, unit_price: 900_000 }),
      mkLine('n2', 'pB', { qty: 2, unit_price: 500_000 }),
      mkLine('n3', 'pC', { description: 'Triển khai', unit_price: 1_000_000 }),
      mkLine('n4', 'pD', { qty: 1, unit_price: 10 }),
    ];
    const d = diffQuoteLines(prev, next);
    assertEqual(d.byLineId.get('n1'), { change: 'modified', changed_fields: ['qty'] }, 'n1');
    assertEqual(d.byLineId.get('n2'), { change: null, changed_fields: [] }, 'n2');
    assertEqual(d.byLineId.get('n3'), { change: 'added', changed_fields: [] }, 'n3 (other description)');
    assertEqual(d.byLineId.get('n4'), { change: 'added', changed_fields: [] }, 'n4');
    assertEqual(d.removed.map((l) => l.id), ['o3'], 'removed');
  });

  s.test('diffQuoteLines: several changed fields; null and empty description match', () => {
    const prev = [mkLine('o1', 'pA', { description: null, unit_price: 900_000, vat_rate: 10, discount_pct: 0 })];
    const next = [mkLine('n1', 'pA', { description: '', unit_price: 850_000, vat_rate: 8, discount_pct: 0 })];
    const d = diffQuoteLines(prev, next);
    assertEqual(d.byLineId.get('n1'), { change: 'modified', changed_fields: ['unit_price', 'vat_rate'] }, 'n1');
    assertEqual(d.removed, [], 'nothing removed');
  });

  return s.results;
}

// ───────────────────────────── payments & naming ─────────────────────────────

function paymentTests(): TestResult[] {
  const s = createSuite('payments');

  s.test('effectivePaymentStatus', () => {
    assertEqual(effectivePaymentStatus(mkPay('a'), TODAY), 'overdue', 'invoiced past due');
    assertEqual(effectivePaymentStatus(mkPay('a', { due_date: TODAY }), TODAY), 'invoiced', 'due today');
    assertEqual(effectivePaymentStatus(mkPay('a', { status: 'paid' }), TODAY), 'paid', 'paid stays');
    assertEqual(effectivePaymentStatus(mkPay('a', { status: 'not_due' }), TODAY), 'not_due', 'not_due');
    assertEqual(effectivePaymentStatus(mkPay('a', { status: 'invoice_due' }), TODAY), 'invoice_due', 'invoice_due');
    assertEqual(effectivePaymentStatus(mkPay('a', { status: 'overdue' }), TODAY), 'overdue', 'stored overdue');
    assertEqual(effectivePaymentStatus(mkPay('a', { status: 'overdue', due_date: day(5) }), TODAY), 'invoiced', 'stored overdue, due moved');
  });

  s.test('paymentOverdueDays and isReceivable', () => {
    assertEqual(paymentOverdueDays(mkPay('a'), TODAY), 12, '12 days');
    assertEqual(paymentOverdueDays(mkPay('a', { status: 'paid' }), TODAY), 0, 'paid');
    assertEqual(paymentOverdueDays(mkPay('a', { status: 'not_due' }), TODAY), 0, 'not due');
    assertEqual(
      (['not_due', 'invoice_due', 'invoiced', 'paid', 'overdue'] as const).map(isReceivable),
      [false, false, true, false, true],
      'receivable',
    );
  });

  return s.results;
}

function namingTests(): TestResult[] {
  const s = createSuite('naming');

  s.test('givenName and addressName', () => {
    assertEqual(givenName('Trần Quang Minh'), 'Minh', 'given');
    assertEqual(givenName('  Phạm   Thu Lan '), 'Lan', 'spaces');
    assertEqual(addressName('anh', 'Trần Quang Minh'), 'anh Minh', 'anh');
    assertEqual(addressName('chị', 'Phạm Thu Lan'), 'chị Lan', 'chị');
    assertEqual(addressName(null, 'Trần Quang Minh'), 'Trần Quang Minh', 'no salutation');
  });

  s.test('given names ending in "Anh" keep the compound', () => {
    assertEqual(givenName('Trần Đức Anh'), 'Đức Anh', 'compound');
    assertEqual(addressName('anh', 'Trần Đức Anh'), 'anh Đức Anh', 'never "anh Anh"');
    assertEqual(addressName('chị', 'Lê Quỳnh Anh'), 'chị Quỳnh Anh', 'chị');
    assertEqual(givenName('Nguyễn Văn Anh'), 'Anh', 'gender marker is not part of the called name');
    assertEqual(givenName('Trần Anh'), 'Anh', 'two words');
    assertEqual(givenName('Phạm Anh Tuấn'), 'Tuấn', 'Anh as a middle name');
  });

  s.test('initials', () => {
    assertEqual(initials('Cỏ Xanh Retail'), 'CX', 'company');
    assertEqual(initials('Trần Quang Minh'), 'QM', 'person');
    assertEqual(initials('Nguyễn Thu Hà'), 'TH', 'person 2');
    assertEqual(initials('Mây Trắng Logistics'), 'MT', 'company 2');
    assertEqual(initials('Đức Anh'), 'ĐA', 'two words');
    assertEqual(initials('Minh'), 'MI', 'one word');
    assertEqual(initials(''), '', 'empty');
  });

  return s.results;
}

export function runDomainTests(): TestResult[] {
  return [
    ...graphTests(),
    ...healthTests(),
    ...statusLineTests(),
    ...taskRuleTests(),
    ...quoteTests(),
    ...paymentTests(),
    ...namingTests(),
  ];
}
