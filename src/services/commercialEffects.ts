// Commercial side effects (owner: D). Nothing here opens its own db.batch: every function runs inside the
// caller's batch (C's task actions, E's daily sweep, or D's api/commercial.ts), so it is undone with the action.

import type { Contract, ID, ISODate, PaymentSchedule, Quote, Task, TaskType } from '@/domain/types';
import { nowISO, todayISO } from '@/domain/clock';
import { addDays, minDate } from '@/domain/dates';
import { effectivePaymentStatus, paymentOverdueDays } from '@/domain/payments';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoney } from '@/lib/format';
import { newId } from '@/lib/utils';
import { ApiError } from './contract';
import { primaryOwnerOf } from './context';
import { db } from './db';
import { logActivity } from './effects';
import { notifyPaymentEvent, notifyQuoteEvent } from './notifyEvents';
import { effectiveQuoteStatus, isQuoteSuperseded, livePaymentTask } from './commercialViews';
import { withUnblockNotices } from './unblockNotices';

type Params = Record<string, string | number>;

// ───────────────────────────── activity params ─────────────────────────────

/** params of every quote.* activity: { quote: title, code, version } */
export function quoteParams(q: Quote): Params {
  return { quote: q.title, code: q.code, version: q.version };
}

/**
 * params of every payment.* activity — same convention as the seed:
 * { note: installment name, amount: '120.000.000 ₫', contract: code }
 */
export function paymentParams(p: PaymentSchedule, contract: Contract | undefined): Params {
  return { note: p.name, amount: formatMoney(p.amount), contract: contract?.code ?? '' };
}

/** adds `key: value` when value is a non-empty text */
export function withNote(params: Params, key: string, value: string | null | undefined): Params {
  const text = value?.trim();
  return text ? { ...params, [key]: text } : params;
}

// ───────────────────────────── generated client tasks ─────────────────────────────

const PROJECT_STATUS_RANK = { active: 0, paused: 1, done: 2 } as const;

/** project that hosts a generated task: preferred one if it belongs to the account, else the main active project */
function hostProjectId(accountId: ID, preferred: ID | null | undefined): ID | null {
  if (preferred) {
    const p = db.find('projects', preferred);
    if (p && p.account_id === accountId) return p.id;
  }
  const projects = db
    .rows('projects')
    .filter((p) => p.account_id === accountId)
    .sort((a, b) => PROJECT_STATUS_RANK[a.status] - PROJECT_STATUS_RANK[b.status] || a.start_date.localeCompare(b.start_date));
  return projects[0]?.id ?? null;
}

function insertClientTask(input: {
  accountId: ID;
  projectId: ID;
  type: Extract<TaskType, 'approval' | 'payment'>;
  title: string;
  description: string;
  impact: string;
  due: ISODate;
  requiresOwner: boolean;
  quoteId: ID | null;
  paymentId: ID | null;
  createdBy: ID;
}): Task {
  const at = nowISO();
  const owner = primaryOwnerOf(input.accountId);
  const task: Task = {
    id: newId('t'),
    project_id: input.projectId,
    milestone_id: null,
    title: input.title,
    description: input.description,
    side: 'client',
    type: input.type,
    assignee_id: owner?.id ?? null,
    delegated_by: null,
    delegated_at: null,
    delegation_note: null,
    requires_owner: input.requiresOwner,
    waiting_on: 'client',
    due_date: input.due,
    status: 'todo',
    impact_text: input.impact,
    client_visible: true,
    reminder_count: 0,
    last_reminded_at: null,
    manual_unblock_reason: null,
    manual_unblocked_by: null,
    manual_unblocked_at: null,
    completed_at: null,
    quote_id: input.quoteId,
    payment_schedule_id: input.paymentId,
    revision: 1,
    answer_text: null,
    created_by: input.createdBy,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  return db.insert('tasks', task);
}

function donePatch(at: string): Partial<Task> {
  return { status: 'done', waiting_on: null, completed_at: at, updated_at: at };
}

/** Client approval task created when a quote is sent ("Báo giá cần duyệt cũng hiện thành 1 việc ở trang chủ"). */
export function createQuoteApprovalTask(q: Quote, actorId: ID): Task | null {
  const projectId = hostProjectId(q.account_id, q.project_id);
  if (!projectId) return null;
  const due = minDate(q.valid_until, addDays(todayISO(), 5));
  return insertClientTask({
    accountId: q.account_id,
    projectId,
    type: 'approval',
    title: t('activity.commercialGen.quote_task_title', { quote: q.title, version: q.version }),
    description: t('activity.commercialGen.quote_task_description', {
      code: q.code,
      version: q.version,
      valid_until: formatDate(q.valid_until),
    }),
    impact: t('activity.commercialGen.quote_task_impact', {
      quote: q.title,
      due: formatDateShort(due),
      valid_until: formatDateShort(q.valid_until),
    }),
    due,
    requiresOwner: true,
    quoteId: q.id,
    paymentId: null,
    createdBy: actorId,
  });
}

/**
 * When version n is sent, open approval tasks of earlier versions are closed:
 * the client already answered (waiting on New Era) → done; never answered → removed (soft delete).
 */
export function closeEarlierQuoteTasks(q: Quote, at: string, actorId: ID | null = null): void {
  const earlierIds = new Set(
    db
      .rows('quotes')
      .filter((x) => x.code === q.code && x.account_id === q.account_id && x.version < q.version)
      .map((x) => x.id),
  );
  if (earlierIds.size === 0) return;
  withUnblockNotices(q.account_id, actorId, () => {
    for (const task of db.rows('tasks')) {
      if (!task.quote_id || !earlierIds.has(task.quote_id) || task.status === 'done') continue;
      if (task.waiting_on === 'client') db.softDelete('tasks', task.id, at);
      else db.update('tasks', task.id, donePatch(at));
    }
  });
}

// ───────────────────────────── quote decisions ─────────────────────────────

/** the client may still accept / ask changes: stored 'sent', not expired, not superseded by a newer sent version */
export function assertQuoteDecidable(q: Quote): void {
  if (q.status === 'expired' || (q.status === 'sent' && effectiveQuoteStatus(q) === 'expired')) {
    throw new ApiError('conflict', 'errors.quote_expired', { reason: 'expired' });
  }
  if (q.status !== 'sent' || effectiveQuoteStatus(q) !== 'sent' || isQuoteSuperseded(q)) {
    throw new ApiError('conflict', 'errors.conflict');
  }
}

/**
 * Quote-side effects of a client decision. `touchTask` = also complete / hand back the linked approval task
 * (true from the commercial page; false when the client acted through the task, which C already updated).
 */
export function applyQuoteDecision(
  q: Quote,
  decision: 'accepted' | 'changes_requested',
  actorId: ID,
  note: string | null | undefined,
  opts: { touchTask: boolean },
): void {
  const at = nowISO();
  const text = note?.trim() || null;
  db.update('quotes', q.id, {
    status: decision,
    client_decision: decision,
    client_decided_by: actorId,
    client_decided_at: at,
    client_note: text,
    updated_at: at,
  });
  if (opts.touchTask) {
    // completing the approval task may make client tasks it blocked actionable ("Việc … đã sẵn sàng")
    withUnblockNotices(q.account_id, actorId, () => {
      for (const task of db.rows('tasks')) {
        if (task.quote_id !== q.id || task.status === 'done') continue;
        if (decision === 'accepted') db.update('tasks', task.id, donePatch(at));
        else db.update('tasks', task.id, { status: 'waiting', waiting_on: 'internal', updated_at: at });
      }
    });
  }
  logActivity({
    account_id: q.account_id,
    actor_id: actorId,
    action: decision === 'accepted' ? 'quote.accepted' : 'quote.changes_requested',
    target_type: 'quote',
    target_id: q.id,
    // seed + C's task sentences use `reason` for a change request, `note` for an approval comment
    params: withNote(quoteParams(q), decision === 'accepted' ? 'note' : 'reason', text),
    visibility: 'shared',
  });
  notifyQuoteEvent(decision, q.id, actorId, text ? { note: text } : undefined);
}

/** The client approved the quote's approval task (inside C's batch). */
export function onQuoteTaskApproved(quoteId: ID, actorId: ID, note?: string): void {
  const q = db.find('quotes', quoteId);
  if (!q) return;
  assertQuoteDecidable(q);
  applyQuoteDecision(q, 'accepted', actorId, note, { touchTask: false });
}

/** The client asked for changes through the quote's approval task (inside C's batch). */
export function onQuoteTaskChangesRequested(quoteId: ID, actorId: ID, reason: string): void {
  const q = db.find('quotes', quoteId);
  if (!q) return;
  assertQuoteDecidable(q);
  applyQuoteDecision(q, 'changes_requested', actorId, reason, { touchTask: false });
}

/** Persist 'expired' for sent quotes past valid_until; their unanswered approval tasks are withdrawn. */
export function refreshExpiredQuotes(today: ISODate): number {
  let count = 0;
  for (const q of db.rows('quotes')) {
    if (q.status !== 'sent' || q.valid_until >= today) continue;
    const at = nowISO();
    db.update('quotes', q.id, { status: 'expired', updated_at: at });
    // a withdrawn approval task no longer blocks anything: announce the client tasks it held (system actor)
    withUnblockNotices(q.account_id, null, () => {
      for (const task of db.rows('tasks')) {
        if (task.quote_id === q.id && task.status !== 'done' && task.waiting_on === 'client') db.softDelete('tasks', task.id, at);
      }
    });
    logActivity({
      account_id: q.account_id,
      actor_id: null,
      action: 'quote.expired',
      target_type: 'quote',
      target_id: q.id,
      params: quoteParams(q),
      visibility: 'internal',
    });
    count += 1;
  }
  return count;
}

// ───────────────────────────── payments ─────────────────────────────

/**
 * Creates the client "Thanh toán" task of an invoiced installment when settings.payment_task_auto,
 * auto_task_enabled and no live task yet. Returns the NEW task, or null when nothing was created.
 */
export function ensurePaymentTask(paymentId: ID, actorId: ID | null): Task | null {
  const p = db.find('payment_schedules', paymentId);
  if (!p || !db.settings.payment_task_auto || !p.auto_task_enabled) return null;
  const status = effectivePaymentStatus(p, todayISO());
  if (status !== 'invoiced' && status !== 'overdue') return null;
  if (livePaymentTask(p)) return null;
  const contract = db.find('contracts', p.contract_id);
  const account = contract ? db.find('accounts', contract.account_id) : undefined;
  if (!contract || !account) return null;

  const milestoneProject = p.milestone_id ? db.find('milestones', p.milestone_id)?.project_id : undefined;
  const quoteProject = contract.quote_id ? db.find('quotes', contract.quote_id)?.project_id : undefined;
  const projectId = hostProjectId(account.id, milestoneProject ?? quoteProject ?? null);
  if (!projectId) return null;

  const amount = formatMoney(p.amount);
  const task = insertClientTask({
    accountId: account.id,
    projectId,
    type: 'payment',
    title: t('activity.commercialGen.payment_task_title', { payment: p.name, contract: contract.code }),
    description: p.invoice_no
      ? t('activity.commercialGen.payment_task_description', { invoice: p.invoice_no, amount, due: formatDate(p.due_date) })
      : t('activity.commercialGen.payment_task_description_no_invoice', { amount, due: formatDate(p.due_date) }),
    impact: t('activity.commercialGen.payment_task_impact', { payment: p.name, amount, due: formatDateShort(p.due_date) }),
    due: p.due_date,
    requiresOwner: false,
    quoteId: null,
    paymentId: p.id,
    createdBy: actorId ?? account.am_id,
  });
  db.update('payment_schedules', p.id, { task_id: task.id });
  return task;
}

/** Mark an installment paid. `touchTask` = also close its client payment task (C closes it on the task path). */
export function markPaymentPaid(p: PaymentSchedule, actorId: ID | null, opts: { touchTask: boolean }): void {
  const at = nowISO();
  const contract = db.find('contracts', p.contract_id);
  db.update('payment_schedules', p.id, { status: 'paid', paid_at: at });
  if (opts.touchTask) {
    const task = livePaymentTask(p);
    if (task && task.status !== 'done' && contract) {
      withUnblockNotices(contract.account_id, actorId, () => db.update('tasks', task.id, donePatch(at)));
    } else if (task && task.status !== 'done') {
      db.update('tasks', task.id, donePatch(at));
    }
  }
  logActivity({
    account_id: contract?.account_id ?? null,
    actor_id: actorId,
    action: 'payment.paid',
    target_type: 'payment',
    target_id: p.id,
    params: paymentParams(p, contract),
    visibility: 'shared',
  });
  notifyPaymentEvent('paid', p.id, actorId);
}

/** Milestone done → linked installments not_due → invoice_due. */
export function onMilestoneCompleted(milestoneId: ID, actorId: ID): void {
  for (const p of db.rows('payment_schedules')) {
    if (p.milestone_id !== milestoneId || p.status !== 'not_due') continue;
    const contract = db.find('contracts', p.contract_id);
    if (!contract) continue;
    db.update('payment_schedules', p.id, { status: 'invoice_due' });
    logActivity({
      account_id: contract.account_id,
      actor_id: actorId,
      action: 'payment.invoice_due',
      target_type: 'payment',
      target_id: p.id,
      params: paymentParams(p, contract),
      visibility: 'internal',
    });
    notifyPaymentEvent('invoice_due', p.id, actorId);
  }
}

/** The client reported a transfer on the payment task (inside C's batch). */
export function onPaymentReported(taskId: ID, proofFileId: ID, actorId: ID): void {
  const task = db.find('tasks', taskId);
  const p = task?.payment_schedule_id ? db.find('payment_schedules', task.payment_schedule_id) : undefined;
  if (!task || !p) return;
  const contract = db.find('contracts', p.contract_id);
  db.update('payment_schedules', p.id, {
    client_reported_at: nowISO(),
    proof_file_id: proofFileId,
    task_id: p.task_id ?? task.id,
  });
  logActivity({
    account_id: contract?.account_id ?? null,
    actor_id: actorId,
    action: 'payment.reported',
    target_type: 'payment',
    target_id: p.id,
    params: paymentParams(p, contract),
    visibility: 'shared',
  });
  notifyPaymentEvent('reported', p.id, actorId);
}

/** New Era accepted the client's payment submission (inside C's batch) → installment paid. */
export function onPaymentTaskAccepted(taskId: ID, actorId: ID): void {
  const task = db.find('tasks', taskId);
  const p = task?.payment_schedule_id ? db.find('payment_schedules', task.payment_schedule_id) : undefined;
  if (!p || p.status === 'paid') return;
  markPaymentPaid(p, actorId, { touchTask: false });
}

/**
 * Daily sweep: persist 'overdue' for invoiced installments past due (activity + notification once per installment).
 * Returns the number of installments that became overdue. Also persists expired quotes (refreshExpiredQuotes).
 */
export function refreshOverduePayments(today: ISODate): number {
  let count = 0;
  for (const p of db.rows('payment_schedules')) {
    if (p.status !== 'invoiced' || effectivePaymentStatus(p, today) !== 'overdue') continue;
    const contract = db.find('contracts', p.contract_id);
    if (!contract) continue;
    db.update('payment_schedules', p.id, { status: 'overdue' });
    logActivity({
      account_id: contract.account_id,
      actor_id: null,
      action: 'payment.overdue',
      target_type: 'payment',
      target_id: p.id,
      params: { ...paymentParams(p, contract), days: paymentOverdueDays(p, today) },
      visibility: 'internal',
    });
    notifyPaymentEvent('overdue', p.id, null);
    count += 1;
  }
  refreshExpiredQuotes(today);
  return count;
}
