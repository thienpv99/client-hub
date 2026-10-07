// Scenario sanity for the seed, computed with a tiny stand-alone version of the health / forecast rules
// (ARCHITECTURE §7) so it does not depend on the domain engine.

import type { ID, ISODate, Milestone, PaymentSchedule, Quote, Task, TaskDependency } from '@/domain/types';
import type { DbData } from '@/services/db';
import { addDays, diffDays } from '@/domain/dates';
import { dateOf } from '@/domain/clock';

type Seed = Omit<DbData, 'meta'>;
type Color = 'blocked' | 'attention' | 'on_track';

export interface AccountSlice {
  tasks: Task[];
  milestones: Milestone[];
  deps: TaskDependency[];
  payments: PaymentSchedule[];
}

export function accountSlice(data: Seed, accountId: ID): AccountSlice {
  const projectIds = new Set(data.projects.filter((p) => p.account_id === accountId).map((p) => p.id));
  const tasks = data.tasks.filter((t) => projectIds.has(t.project_id) && !t.deleted_at);
  const taskIds = new Set(tasks.map((t) => t.id));
  const contractIds = new Set(data.contracts.filter((c) => c.account_id === accountId).map((c) => c.id));
  return {
    tasks,
    milestones: data.milestones.filter((m) => projectIds.has(m.project_id) && !m.deleted_at),
    deps: data.task_dependencies.filter((d) => taskIds.has(d.task_id)),
    payments: data.payment_schedules.filter((p) => contractIds.has(p.contract_id) && !p.deleted_at),
  };
}

const open = (t: Task): boolean => t.status !== 'done';
const overdue = (t: Task, today: ISODate): boolean => open(t) && today > t.due_date;

export function taskDelay(t: Task, today: ISODate): number {
  if (open(t)) return Math.max(0, diffDays(today, t.due_date));
  return t.completed_at ? Math.max(0, diffDays(dateOf(t.completed_at), t.due_date)) : 0;
}

/** unfinished direct blockers (none when manually unblocked) */
export function blockersOf(s: AccountSlice, task: Task): Task[] {
  if (task.manual_unblock_reason) return [];
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  return s.deps
    .filter((d) => d.blocks_task_id === task.id)
    .map((d) => byId.get(d.task_id))
    .filter((t): t is Task => !!t && open(t));
}

/** not-done milestones a not-done task holds back, directly or through downstream not-done tasks */
export function heldMilestones(s: AccountSlice, task: Task): ID[] {
  if (!open(task)) return [];
  const done = new Set(s.milestones.filter((m) => m.status === 'done').map((m) => m.id));
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  const held = new Set<ID>();
  const seen = new Set<ID>([task.id]);
  const queue = [task.id];
  while (queue.length) {
    const id = queue.shift() as ID;
    for (const d of s.deps.filter((x) => x.task_id === id)) {
      if (d.blocks_milestone_id && !done.has(d.blocks_milestone_id)) held.add(d.blocks_milestone_id);
      const next = d.blocks_task_id ? byId.get(d.blocks_task_id) : undefined;
      if (next && open(next) && !next.manual_unblock_reason && !seen.has(next.id)) {
        seen.add(next.id);
        queue.push(next.id);
      }
    }
  }
  return [...held];
}

/** forecast shift per not-done milestone: max(own upstream delay, shift of earlier not-done milestones) */
export function milestoneShifts(s: AccountSlice, today: ISODate): Map<ID, { shift: number; own: number }> {
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  const own = (m: Milestone): number => {
    let max = 0;
    const seen = new Set<ID>();
    const queue = s.deps.filter((d) => d.blocks_milestone_id === m.id).map((d) => d.task_id);
    while (queue.length) {
      const t = byId.get(queue.shift() as ID);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      max = Math.max(max, taskDelay(t, today));
      if (open(t) && !t.manual_unblock_reason) queue.push(...s.deps.filter((d) => d.blocks_task_id === t.id).map((d) => d.task_id));
    }
    return max;
  };
  const out = new Map<ID, { shift: number; own: number }>();
  for (const projectId of new Set(s.milestones.map((m) => m.project_id))) {
    let carried = 0;
    for (const m of s.milestones.filter((x) => x.project_id === projectId).sort((a, b) => a.order_no - b.order_no)) {
      if (m.status === 'done') continue;
      const n = m.forecast_override_date ? Math.max(0, diffDays(m.forecast_override_date, m.planned_date)) : own(m);
      const shift = Math.max(n, carried);
      out.set(m.id, { shift, own: n });
      carried = shift;
    }
  }
  return out;
}

export interface HealthResult {
  color: Color;
  overdueBlocking: Task[];
  dueSoonBlocking: Task[];
  overdueOther: Task[];
  overduePayments: PaymentSchedule[];
}

export function computeHealth(s: AccountSlice, today: ISODate): HealthResult {
  const r: HealthResult = { color: 'on_track', overdueBlocking: [], dueSoonBlocking: [], overdueOther: [], overduePayments: [] };
  for (const t of s.tasks.filter(open)) {
    const holds = heldMilestones(s, t).length > 0;
    const left = diffDays(t.due_date, today);
    if (overdue(t, today)) (holds ? r.overdueBlocking : r.overdueOther).push(t);
    else if (holds && left >= 0 && left <= 3) r.dueSoonBlocking.push(t);
  }
  r.overduePayments = s.payments.filter((p) => (p.status === 'invoiced' || p.status === 'overdue') && today > p.due_date);
  if (r.overdueBlocking.length) r.color = 'blocked';
  else if (r.overdueOther.length || r.dueSoonBlocking.length || r.overduePayments.length) r.color = 'attention';
  return r;
}

/** effective discount % vs the account's applicable prices (unit-price cuts count as discount) */
export function effectiveDiscount(data: Seed, q: Quote): number {
  const lines = data.quote_lines.filter((l) => l.quote_id === q.id);
  let gross = 0;
  let net = 0;
  for (const l of lines) {
    const negotiated = data.account_prices.find((a) => a.account_id === q.account_id && a.price_item_id === l.price_item_id);
    const applicable = negotiated ? negotiated.negotiated_price : data.price_items.find((p) => p.id === l.price_item_id)?.list_price ?? 0;
    const subtotal = Math.round(l.qty * l.unit_price);
    const disc = Math.round((subtotal * l.discount_pct) / 100);
    const share = Math.round(((subtotal - disc) * q.discount_pct_total) / 100);
    gross += l.qty * applicable;
    net += subtotal - disc - share;
  }
  return gross > 0 ? Math.round((1 - net / gross) * 10000) / 100 : 0;
}

export function checkScenarios(data: Seed, today: ISODate): string[] {
  const errors: string[] = [];
  const expect = (cond: unknown, msg: string): void => {
    if (!cond) errors.push(`scenario: ${msg}`);
  };
  const task = (id: ID): Task | undefined => data.tasks.find((t) => t.id === id);
  const ms = (id: ID): Milestone | undefined => data.milestones.find((m) => m.id === id);
  const hasDep = (from: ID, to: { task?: ID; milestone?: ID }): boolean =>
    data.task_dependencies.some((d) => d.task_id === from && (to.task ? d.blocks_task_id === to.task : d.blocks_milestone_id === to.milestone));
  const ids = (ts: Task[]): string => ts.map((t) => t.id).sort().join(',');
  const health = (acc: ID): HealthResult => computeHealth(accountSlice(data, acc), today);

  // 1 · Cỏ Xanh — blocked by the client, UAT 28/10 → 03/11 (+6), Go-live cascades +6
  const cx = accountSlice(data, 'acc_coxanh');
  const cxH = computeHealth(cx, today);
  expect(cxH.color === 'blocked', `Cỏ Xanh health should be blocked, got ${cxH.color}`);
  expect(ids(cxH.overdueBlocking) === 't_coxanh_design_approval', `Cỏ Xanh overdue blocking tasks: ${ids(cxH.overdueBlocking)}`);
  const appr = task('t_coxanh_design_approval');
  expect(appr && appr.side === 'client' && appr.type === 'approval' && appr.assignee_id === 'u_client_minh' && appr.waiting_on === 'client' && appr.due_date === addDays(today, -6), 'design approval: client approval for Minh due today−6 waiting on client');
  const dev = task('t_coxanh_order_dev');
  expect(dev && dev.side === 'internal' && dev.status === 'todo' && blockersOf(cx, dev).some((b) => b.id === 't_coxanh_design_approval'), 'order dev must be internal, todo and blocked by the approval');
  expect(hasDep('t_coxanh_design_approval', { task: 't_coxanh_order_dev' }) && hasDep('t_coxanh_order_dev', { milestone: 'ms_coxanh_uat' }) && hasDep('t_coxanh_design_approval', { milestone: 'ms_coxanh_design' }), 'Cỏ Xanh dependency chain');
  const cxShift = milestoneShifts(cx, today);
  expect(ms('ms_coxanh_uat')?.planned_date === addDays(today, 22), 'UAT planned today+22');
  expect(cxShift.get('ms_coxanh_uat')?.shift === 6 && cxShift.get('ms_coxanh_uat')?.own === 6, `UAT forecast +6 by dependency, got ${JSON.stringify(cxShift.get('ms_coxanh_uat'))}`);
  expect(cxShift.get('ms_coxanh_golive')?.shift === 6 && cxShift.get('ms_coxanh_golive')?.own === 0, 'Go-live forecast +6 by cascade');
  const cat = task('t_coxanh_catalog_upload');
  expect(cat && cat.delegated_by === 'u_client_minh' && cat.assignee_id === 'u_client_lan' && cat.delegated_at && cat.delegation_note && cat.type === 'upload', 'catalog upload delegated Minh → Lan with note');
  const qt = task('t_coxanh_quote_approval');
  const qtQuote = data.quotes.find((q) => q.id === qt?.quote_id);
  expect(qt && qt.requires_owner && qt.assignee_id === 'u_client_minh' && qtQuote?.status === 'sent' && qtQuote.title === 'Phụ lục mở rộng 20 người dùng', 'quote approval task for the sent quote');
  const cxOpenClient = cx.tasks.filter((t) => t.side === 'client' && open(t));
  expect(cxOpenClient.some((t) => (t.type === 'confirm' || t.type === 'attend') && t.due_date === addDays(today, 2)), 'Cỏ Xanh confirm/attend task due in 2 days');
  expect(cxOpenClient.some((t) => t.type === 'answer'), 'Cỏ Xanh open answer task');
  expect(cxOpenClient.some((t) => t.status === 'waiting' && t.waiting_on === 'internal'), 'Cỏ Xanh submission waiting for New Era');
  const doneApprovals = cx.tasks.filter((t) => t.side === 'client' && t.type === 'approval' && !open(t) && taskDelay(t, today) === 0);
  expect(doneApprovals.length >= 2 && doneApprovals.every((t) => data.activities.some((a) => a.target_id === t.id && a.action === 'task.approved' && a.visibility === 'shared') || t.quote_id), 'earlier approvals done on time with shared activities');

  // 2 · Thịnh An — v2 ≈15 % pending approval, v1 changes requested
  const taH = health('acc_thinhan');
  expect(taH.color !== 'blocked', `Thịnh An must not be blocked, got ${taH.color}`);
  const v1 = data.quotes.find((q) => q.id === 'q_thinhan_p2_v1');
  const v2 = data.quotes.find((q) => q.id === 'q_thinhan_p2_v2');
  if (!v1 || !v2) errors.push('scenario: Thịnh An quotes v1/v2 missing');
  else {
    const threshold = data.settings.discount_approval_threshold_pct;
    const eff2 = effectiveDiscount(data, v2);
    expect(v1.code === v2.code && v2.version === 2 && v2.parent_id === v1.id, 'v1/v2 share the code and v2.parent_id = v1');
    expect(v1.status === 'changes_requested' && v1.client_decision === 'changes_requested' && v1.client_note && v1.client_decided_by && v1.client_decided_at, 'v1 changes_requested with note / decided by / at');
    expect(v2.status === 'pending_approval' && v2.approval_requested_by && v2.approval_requested_at && !v2.director_approved_by, 'v2 pending approval, not approved');
    expect(eff2 >= 14.5 && eff2 < 15.5 && eff2 > threshold, `v2 effective discount ≈15 %, got ${eff2}`);
    expect(effectiveDiscount(data, v1) <= threshold || !!v1.director_approved_by, 'v1 was sendable');
    const l1 = data.quote_lines.filter((l) => l.quote_id === v1.id);
    const l2 = data.quote_lines.filter((l) => l.quote_id === v2.id);
    const match = (a: (typeof l1)[number]) => l1.find((b) => b.price_item_id === a.price_item_id && (b.description ?? '') === (a.description ?? ''));
    expect(l2.some((l) => match(l) && match(l)?.qty !== l.qty), 'v2 has a line with changed qty');
    expect(l2.some((l) => match(l) && match(l)?.discount_pct !== l.discount_pct), 'v2 has a line with changed discount');
    expect(l2.some((l) => !match(l)), 'v2 has an added line');
  }

  // 3 · Thiên Trường — overdue installment (invoiced, due today−12) + its payment task → yellow
  const tt = accountSlice(data, 'acc_thientruong');
  const ttH = computeHealth(tt, today);
  expect(ttH.color === 'attention', `Thiên Trường health should be attention, got ${ttH.color}`);
  const pay = ttH.overduePayments;
  expect(pay.length === 1 && pay[0].status === 'invoiced' && pay[0].invoice_no && !pay[0].paid_at && pay[0].due_date === addDays(today, -12), 'one invoiced installment due today−12, unpaid');
  const payTask = pay[0] ? task(pay[0].task_id ?? '') : undefined;
  expect(payTask && payTask.type === 'payment' && payTask.side === 'client' && payTask.payment_schedule_id === pay[0].id && overdue(payTask, today) && heldMilestones(tt, payTask).length === 0, 'payment task: overdue, linked, holding no milestone');

  // 4 · Gió Ngàn — New Era late: internal visible task 4 days overdue holding UAT directly
  const gn = accountSlice(data, 'acc_giongan');
  const gnH = computeHealth(gn, today);
  expect(gnH.color === 'blocked', `Gió Ngàn health should be blocked, got ${gnH.color}`);
  expect(gnH.overdueBlocking.length > 0 && gnH.overdueBlocking.every((t) => t.side === 'internal' && t.client_visible), 'Gió Ngàn: only internal visible tasks overdue & blocking');
  const uat = gn.milestones.find((m) => m.name === 'UAT');
  expect(uat && gnH.overdueBlocking.some((t) => taskDelay(t, today) === 4 && hasDep(t.id, { milestone: uat.id })), 'Gió Ngàn: a task 4 days overdue directly holds UAT');
  expect(!gn.tasks.some((t) => t.side === 'client' && overdue(t, today)), 'Gió Ngàn: no overdue client task');
  expect(uat && milestoneShifts(gn, today).get(uat.id)?.shift === 4, 'Gió Ngàn UAT forecast +4');

  // 5 · Hải Đăng — exactly yellow through one client task due in 2 days holding a milestone
  const hdH = health('acc_haidang');
  expect(hdH.color === 'attention', `Hải Đăng health should be attention, got ${hdH.color}`);
  expect(!hdH.overdueBlocking.length && !hdH.overdueOther.length && !hdH.overduePayments.length, 'Hải Đăng: nothing overdue');
  expect(hdH.dueSoonBlocking.length === 1 && hdH.dueSoonBlocking[0].side === 'client' && hdH.dueSoonBlocking[0].due_date === addDays(today, 2), 'Hải Đăng: exactly one client task due in 2 days holding a milestone');
  const owner = data.users.find((u) => u.account_id === 'acc_haidang' && u.role === 'client_owner');
  expect(owner && owner.onboarded_at === null, 'Hải Đăng owner not onboarded (first-login intro)');

  // 6 · Mây Trắng — operating, on track, nothing waiting on the client
  const mt = accountSlice(data, 'acc_maytrang');
  const mtH = computeHealth(mt, today);
  expect(mtH.color === 'on_track', `Mây Trắng health should be on_track, got ${mtH.color}`);
  expect(!mt.tasks.some((t) => open(t) && t.waiting_on === 'client'), 'Mây Trắng: no open task waiting on the client');
  expect(mt.payments.every((p) => p.status === 'paid' || p.status === 'not_due'), 'Mây Trắng: payments paid or not_due');
  expect(data.accounts.find((a) => a.id === 'acc_maytrang')?.stage === 'operating', 'Mây Trắng stage operating');

  // commercial: an installment became invoice_due because its milestone completed
  expect(data.payment_schedules.some((p) => p.status === 'invoice_due' && p.milestone_id && ms(p.milestone_id)?.status === 'done'), 'an invoice_due installment with a completed milestone');
  return errors;
}
