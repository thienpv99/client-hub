// Account health (red / yellow / green), its reasons, and the one-sentence status line for the client home.
import type { Health, ID, ISODate, Milestone, PaymentSchedule, Task } from './types';
import type { HealthReason, StatusLine, StatusLineWho } from '@/services/contract';
import type { AccountGraph } from './graph';
import { dueInfo } from './taskRules';
import { effectivePaymentStatus, paymentOverdueDays } from './payments';

const KIND_ORDER: Record<HealthReason['kind'], number> = {
  overdue_blocking: 0,
  due_soon_blocking: 1,
  overdue_task: 2,
  overdue_payment: 3,
};

function reasonLabel(r: HealthReason): string {
  return r.kind === 'overdue_payment' ? r.name : r.task_title;
}

function reasonId(r: HealthReason): ID {
  return r.kind === 'overdue_payment' ? r.payment_id : r.task_id;
}

/** overdue_blocking (overdue_days desc) → due_soon_blocking (days_left asc) → overdue_task → overdue_payment (overdue_days desc) */
export function compareHealthReasons(a: HealthReason, b: HealthReason): number {
  const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (k !== 0) return k;
  let d = 0;
  if (a.kind === 'due_soon_blocking' && b.kind === 'due_soon_blocking') d = a.days_left - b.days_left;
  else if (a.kind !== 'due_soon_blocking' && b.kind !== 'due_soon_blocking') d = b.overdue_days - a.overdue_days;
  if (d !== 0) return d;
  const byLabel = reasonLabel(a).localeCompare(reasonLabel(b), 'vi');
  if (byLabel !== 0) return byLabel;
  const ia = reasonId(a);
  const ib = reasonId(b);
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

/**
 * blocked: a not-done task is overdue AND holds a not-done milestone (directly or through downstream tasks).
 * attention: otherwise any other overdue not-done task, a not-done task holding a milestone due in 0–3 days,
 *            or an effectively overdue payment.
 * on_track: otherwise. (The AM override is applied by the caller — see effectiveHealth.)
 *
 * Responsibility rules (lead decisions):
 * - an overdue task that is itself BLOCKED (waiting on an unfinished blocker) gives no overdue reason of its own —
 *   its blocker carries the responsibility (otherwise New Era is blamed for work the client is holding up);
 * - the client "Thanh toán" task of an installment that is itself overdue gives no overdue_task reason —
 *   the overdue_payment reason already stands for it (one problem, one reason).
 */
export function computeHealth(
  g: AccountGraph,
  tasks: Task[],
  payments: PaymentSchedule[],
  today: ISODate,
): { auto: Health; reasons: HealthReason[] } {
  const reasons: HealthReason[] = [];
  const seen = new Set<ID>();
  const overduePaymentIds = new Set<ID>();
  for (const p of payments) {
    if (!p.deleted_at && effectivePaymentStatus(p, today) === 'overdue') overduePaymentIds.add(p.id);
  }

  for (const t of tasks) {
    if (t.deleted_at || t.status === 'done' || seen.has(t.id)) continue;
    seen.add(t.id);
    const due = dueInfo(t.due_date, false, today);
    if (due.overdue && g.isBlocked(t.id)) continue;
    const held: Milestone | undefined = g.milestonesHeldBy(t.id)[0];
    if (due.overdue && !held && t.payment_schedule_id !== null && overduePaymentIds.has(t.payment_schedule_id)) continue;
    if (due.overdue && held) {
      reasons.push({
        kind: 'overdue_blocking',
        task_id: t.id,
        task_title: t.title,
        side: t.side,
        waiting_on: t.waiting_on,
        overdue_days: due.overdue_days,
        milestone_id: held.id,
        milestone_name: held.name,
      });
    } else if (due.overdue) {
      reasons.push({
        kind: 'overdue_task',
        task_id: t.id,
        task_title: t.title,
        side: t.side,
        waiting_on: t.waiting_on,
        overdue_days: due.overdue_days,
      });
    } else if (due.due_soon && held) {
      reasons.push({
        kind: 'due_soon_blocking',
        task_id: t.id,
        task_title: t.title,
        side: t.side,
        waiting_on: t.waiting_on,
        days_left: due.days_left,
        milestone_id: held.id,
        milestone_name: held.name,
      });
    }
  }

  for (const p of payments) {
    if (p.deleted_at) continue;
    if (effectivePaymentStatus(p, today) !== 'overdue') continue;
    reasons.push({
      kind: 'overdue_payment',
      payment_id: p.id,
      name: p.name,
      overdue_days: paymentOverdueDays(p, today),
      amount: p.amount,
    });
  }

  reasons.sort(compareHealthReasons);
  const auto: Health = reasons.some((r) => r.kind === 'overdue_blocking')
    ? 'blocked'
    : reasons.length > 0
      ? 'attention'
      : 'on_track';
  return { auto, reasons };
}

/** The AM override (health_override) wins over the computed value. */
export function effectiveHealth(auto: Health, override: Health | null): { value: Health; overridden: boolean } {
  return override ? { value: override, overridden: true } : { value: auto, overridden: false };
}

function distinctTasks(reasons: HealthReason[]): number {
  const ids = new Set<ID>();
  for (const r of reasons) if (r.kind !== 'overdue_payment') ids.add(r.task_id);
  return ids.size;
}

/** Milestone named by a headline; `id` (when the caller knows it) tells apart same-named milestones of two projects. */
export interface Headline {
  name: string;
  delay_days: number;
  id?: ID;
}

function sameHeadline(a: Headline, b: Headline): boolean {
  return a.id !== undefined && b.id !== undefined ? a.id === b.id : a.name === b.name;
}

/**
 * One sentence for the client home band:
 * - on_track → on_track;
 * - overridden (blocked / attention) → generic for that tone;
 * - blocked: a client-waiting overdue_blocking reason → waiting_client (headline of the most overdue one; count =
 *   distinct client tasks holding that SAME headline milestone; delay = what the client's tasks cause, capped by
 *   the milestone's delay — a larger delay from another cause is not put on the client); only New Era ones →
 *   waiting_internal (same delay cap: the delay the named visible tasks cause, never a hidden task's); none visible → generic;
 * - attention: due_soon_blocking on a client task waiting on the client → overdue → payment_overdue → generic.
 * `waitingFor` (client viewers): told the ids of the tasks a waiting_client line counts; a non-null answer (they are
 * not the viewer's own) is set as `waiting_for`, so the sentence names their holder instead of "từ phía anh/chị".
 */
export function buildStatusLine(input: {
  health: Health;
  overridden: boolean;
  reasons: HealthReason[];
  headline(milestoneId: ID): Headline;
  waitingFor?(taskIds: ID[]): StatusLineWho | null;
}): StatusLine {
  const { health, overridden, reasons } = input;
  if (health === 'on_track') return { tone: 'on_track', kind: 'on_track' };
  if (overridden) return { tone: health, kind: 'generic' };

  if (health === 'blocked') {
    const blocking = reasons.filter(
      (r): r is Extract<HealthReason, { kind: 'overdue_blocking' }> => r.kind === 'overdue_blocking',
    );
    const client = blocking.filter((r) => r.waiting_on === 'client');
    const firstClient = client[0];
    if (firstClient) {
      const h = input.headline(firstClient.milestone_id);
      const same = client.filter((r) => r === firstClient || sameHeadline(input.headline(r.milestone_id), h));
      const clientDelay = same.reduce((max, r) => Math.max(max, r.overdue_days), 0);
      const line: Extract<StatusLine, { kind: 'waiting_client' }> = {
        tone: 'blocked',
        kind: 'waiting_client',
        count: distinctTasks(same),
        milestone_name: h.name,
        delay_days: Math.max(0, Math.min(h.delay_days, clientDelay)),
      };
      const who = input.waitingFor ? input.waitingFor([...new Set(same.map((r) => r.task_id))]) : null;
      return who ? { ...line, waiting_for: who } : line;
    }
    const firstInternal = blocking[0];
    if (firstInternal) {
      const h = input.headline(firstInternal.milestone_id);
      // same cap as waiting_client: the sentence names this (visible) task, so it reports only the delay the visible
      // tasks behind this headline cause — a larger delay from a hidden cause is not put on the named task
      const same = blocking.filter((r) => r === firstInternal || sameHeadline(input.headline(r.milestone_id), h));
      const visibleDelay = same.reduce((max, r) => Math.max(max, r.overdue_days), 0);
      return {
        tone: 'blocked',
        kind: 'waiting_internal',
        milestone_name: h.name,
        delay_days: Math.max(0, Math.min(h.delay_days, visibleDelay)),
        task_title: firstInternal.task_title,
      };
    }
    return { tone: 'blocked', kind: 'generic' };
  }

  // attention
  const dueSoon = reasons.filter(
    (r): r is Extract<HealthReason, { kind: 'due_soon_blocking' }> =>
      r.kind === 'due_soon_blocking' && r.side === 'client' && r.waiting_on === 'client',
  );
  const firstDueSoon = dueSoon[0];
  if (firstDueSoon) {
    return {
      tone: 'attention',
      kind: 'due_soon_blocking',
      count: distinctTasks(dueSoon),
      milestone_name: firstDueSoon.milestone_name,
    };
  }
  const overdue = reasons.filter((r) => r.kind === 'overdue_task' || r.kind === 'overdue_blocking');
  if (overdue.length > 0) return { tone: 'attention', kind: 'overdue', count: distinctTasks(overdue) };
  const payments = reasons.filter((r) => r.kind === 'overdue_payment');
  if (payments.length > 0) return { tone: 'attention', kind: 'payment_overdue', count: payments.length };
  return { tone: 'attention', kind: 'generic' };
}
