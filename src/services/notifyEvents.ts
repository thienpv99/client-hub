// Who gets told what (SPEC §6). Every notify*Event function is called INSIDE the caller's db.batch,
// so bell items and simulated emails are undone together with the action.
// Also hosts the small helpers shared by notifyEngine.ts and digest.ts (formatting, links, addressing, delivery).

import type { Account, ID, ISODate, NotificationKind, Salutation, Task, User } from '@/domain/types';
import type { DueInfo } from './contract';
import type { TParams } from '@/i18n';
import { nowISO, todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { addressName } from '@/domain/naming';
import { dueInfo } from '@/domain/taskRules';
import { capitalize, hasKey, t } from '@/i18n';
import { db } from './db';
import { accountUsers, deliverEmail, internalOwners, notifyUsers } from './effects';

export type TaskEventKind =
  | 'client_approved'
  | 'client_changes_requested'
  | 'client_submitted'
  | 'client_payment_reported'
  | 'client_confirmed'
  | 'client_answered'
  | 'client_question'
  | 'delegated'
  | 'returned_to_client'
  | 'submission_accepted'
  | 'task_assigned_client'
  | 'comment_shared'
  | 'unblocked';
export type QuoteEventKind = 'approval_requested' | 'approved' | 'approval_rejected' | 'sent' | 'accepted' | 'changes_requested';
export type PaymentEventKind = 'invoice_due' | 'invoiced' | 'reported' | 'paid' | 'overdue';

const TPL = 'notifyTemplates';

// ───────────────────────────── formatting ─────────────────────────────

/** 'YYYY-MM-DD' → 'dd/mm' in the current year, 'dd/mm/yyyy' otherwise (same rule as formatDateShort) */
export function fmtDay(d: ISODate): string {
  const short = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return d.slice(0, 4) === todayISO().slice(0, 4) ? short : `${short}/${d.slice(0, 4)}`;
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' */
export function fmtDate(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** 1250000000 → '1.250.000.000 ₫' */
export function fmtMoney(v: number): string {
  const n = Math.round(v);
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${digits} ₫`;
}

/** one line, at most `max` characters */
export function clip(text: string, max = 180): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

/** in-app path → full URL for emails / Zalo text */
export function absoluteUrl(path: string): string {
  try {
    if (typeof window !== 'undefined' && (window as { __CH_STANDALONE__?: boolean }).__CH_STANDALONE__) {
      // single-file demo opened from file:// → hash routing
      return `${window.location.href.split('#')[0]}#${path}`;
    }
    if (typeof window !== 'undefined' && window.location && window.location.origin) return `${window.location.origin}${path}`;
  } catch {
    // no window (tests) → keep the path
  }
  return path;
}

/** due info of a task as if still open (reminders are about what is left to do) */
export function openDue(task: Task, today: ISODate = todayISO()): DueInfo {
  return dueInfo(task.due_date, false, today);
}

/** 'đã quá hạn 6 ngày' | 'đến hạn hôm nay' | 'còn 2 ngày' */
export function dueRelative(due: DueInfo): string {
  if (due.overdue) return t(`${TPL}.due.overdue`, { days: due.overdue_days });
  if (due.days_left <= 0) return t(`${TPL}.due.today`);
  return t(`${TPL}.due.left`, { days: due.days_left });
}

/** ' Nếu chưa làm: …' (or the impact sentence as-is when it already starts with "Nếu …"), '' when empty */
export function impactText(task: Task): string {
  const impact = task.impact_text ? clip(task.impact_text, 260) : '';
  if (!impact) return '';
  const lead = t(`${TPL}.common.impactLead`).toLocaleLowerCase('vi');
  const plain = impact.toLocaleLowerCase('vi').startsWith(`${lead} `);
  return t(plain ? `${TPL}.common.impactPlain` : `${TPL}.common.impact`, { impact });
}

// ───────────────────────────── links ─────────────────────────────

export function clientTaskLink(taskId: ID): string {
  return `/portal/tasks/${taskId}`;
}

export function internalTaskLink(accountId: ID, taskId: ID): string {
  return `/app/accounts/${accountId}/tasks?task=${taskId}`;
}

export function taskLinkFor(user: User, accountId: ID, taskId: ID): string {
  return user.org_type === 'client' ? clientTaskLink(taskId) : internalTaskLink(accountId, taskId);
}

/** task id a stored link points to: '/portal/tasks/<id>' or '…?task=<id>' */
export function linkedTaskId(link: string | null): ID | null {
  if (!link) return null;
  const m = /\/portal\/tasks\/([^/?#]+)/.exec(link) ?? /[?&]task=([^&#]+)/.exec(link);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** every task a stored mail names: its `task_ids`, plus the task its link opens (rows older than task_ids) */
export function mailTaskIds(mail: { link: string | null; task_ids?: ID[] }): ID[] {
  const ids = [...(mail.task_ids ?? [])];
  const linked = linkedTaskId(mail.link);
  if (linked && !ids.includes(linked)) ids.push(linked);
  return ids;
}

// ───────────────────────────── addressing ─────────────────────────────

export interface Addressing {
  /** 'anh Minh' */
  address: string;
  /** 'anh' (or 'anh/chị' when unknown) */
  pronoun: string;
  /** 'Anh' — sentence start */
  Pronoun: string;
}

export function salutationOf(user: User): Salutation | null {
  if (user.salutation) return user.salutation;
  const contact = db.rows('contacts').find((c) => c.user_id === user.id);
  return contact ? contact.salutation : null;
}

export function addressing(fullName: string | null, salutation: Salutation | null): Addressing {
  const pronoun = salutation ?? t(`${TPL}.common.pronoun`);
  return {
    address: fullName ? addressName(salutation, fullName) : t(`${TPL}.common.genericAddress`),
    pronoun,
    Pronoun: capitalize(pronoun),
  };
}

export function addressingOf(user: User): Addressing {
  return addressing(user.full_name, salutationOf(user));
}

// ───────────────────────────── recipients ─────────────────────────────

export function unique(ids: ID[]): ID[] {
  return [...new Set(ids)];
}

export function directorIds(): ID[] {
  return db
    .rows('users')
    .filter((u) => u.role === 'director' && u.status === 'active')
    .map((u) => u.id);
}

/** The client who must act on a task: its client assignee, else the account's decision makers (client_owner). */
export function clientRecipients(task: Task, accountId: ID): ID[] {
  const assignee = task.assignee_id ? db.find('users', task.assignee_id) : undefined;
  if (assignee && assignee.org_type === 'client' && assignee.status !== 'disabled' && assignee.account_id === accountId) return [assignee.id];
  return accountUsers(accountId, ['client_owner']);
}

export interface TaskContext {
  task: Task;
  account: Account;
}

export function taskContext(taskId: ID): TaskContext | null {
  const task = db.find('tasks', taskId);
  if (!task) return null;
  const project = db.find('projects', task.project_id);
  const account = project ? db.find('accounts', project.account_id) : undefined;
  return account ? { task, account } : null;
}

// ───────────────────────────── delivery ─────────────────────────────

export type EmailMode = 'none' | 'policy' | 'immediate';

export interface Notice {
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  accountId: ID | null;
  taskId?: ID | null;
  urgent?: boolean;
  dedupeKey?: string | null;
  /** 'policy' = deliverEmail rules (1/day, preference); 'immediate' = send now ("Nhắc khách", delegation) */
  email: EmailMode;
}

export function composeEmailBody(user: User, body: string, link: string | null, openKey = `${TPL}.email.open`): string {
  const lines = [t(`${TPL}.email.greeting`, { name: addressingOf(user).address }), '', body];
  if (link) lines.push('', t(openKey, { url: absoluteUrl(link) }));
  lines.push('', t(`${TPL}.email.signoff`));
  return lines.join('\n');
}

/** Bell item (+ email) for one user. Returns false when skipped (dedupe hit, inactive user). */
export function sendNotice(userId: ID, n: Notice): boolean {
  const created = notifyUsers([userId], {
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    account_id: n.accountId,
    task_id: n.taskId ?? null,
    urgent: !!n.urgent,
    dedupe_key: n.dedupeKey ?? null,
  });
  if (created.length === 0) return false;
  if (n.email !== 'none') {
    const user = db.find('users', userId);
    if (user) {
      deliverEmail(userId, {
        subject: t(n.urgent ? `${TPL}.email.subjectUrgent` : `${TPL}.email.subject`, { title: n.title }),
        body_text: composeEmailBody(user, n.body, n.link),
        link: n.link,
        kind: n.kind,
        urgent: !!n.urgent,
        immediate: n.email === 'immediate',
        task_ids: n.taskId ? [n.taskId] : undefined,
      });
    }
  }
  return true;
}

/**
 * Same key for the same subject inside one db.batch (db.version only moves when a batch commits).
 * Merges events fired together for one thing — e.g. "quote sent" + "approval task assigned",
 * "payment reported" (task) + "payment reported" (installment) — into a single bell item per person.
 */
export function coalesceKey(scope: string): string {
  return `co:${scope}:${nowISO().slice(0, 16)}:${db.version}`;
}

function render(base: string, params: TParams, note: string | undefined): { title: string; body: string } {
  const noteText = note && note.trim() && hasKey(`${base}.note`) ? t(`${base}.note`, { note: clip(note) }) : '';
  const p: TParams = { ...params, note: noteText };
  return { title: t(`${base}.title`, p), body: t(`${base}.body`, p) };
}

// ───────────────────────────── task events ─────────────────────────────

type Audience = 'internal' | 'client';

interface Route {
  audience: Audience;
  recipients: ID[];
  email: EmailMode;
}

const visibleToClient = (task: Task): boolean => task.side === 'client' || task.client_visible;

function routeTaskEvent(kind: TaskEventKind, task: Task, accountId: ID, actor: User | undefined, toUserId: ID | undefined): Route {
  switch (kind) {
    case 'client_approved':
    case 'client_changes_requested':
    case 'client_submitted':
    case 'client_payment_reported':
    case 'client_confirmed':
    case 'client_answered':
    case 'client_question':
      return { audience: 'internal', recipients: internalOwners(accountId), email: 'policy' };
    case 'comment_shared':
      if (actor?.org_type === 'client') return { audience: 'internal', recipients: internalOwners(accountId), email: 'policy' };
      return { audience: 'client', recipients: visibleToClient(task) ? clientRecipients(task, accountId) : [], email: 'policy' };
    case 'returned_to_client':
    case 'submission_accepted':
    case 'task_assigned_client':
      return { audience: 'client', recipients: clientRecipients(task, accountId), email: 'policy' };
    case 'delegated': {
      const to = toUserId ?? task.assignee_id;
      return { audience: 'client', recipients: to ? [to] : [], email: 'immediate' };
    }
    case 'unblocked': {
      if (task.side === 'client') {
        return { audience: 'client', recipients: task.waiting_on === 'client' ? clientRecipients(task, accountId) : [], email: 'policy' };
      }
      const assignee = task.assignee_id ? db.find('users', task.assignee_id) : undefined;
      const recipients = assignee && assignee.org_type === 'internal' ? [assignee.id] : internalOwners(accountId);
      return { audience: 'internal', recipients, email: 'policy' };
    }
  }
}

function taskNotificationKind(kind: TaskEventKind, task: Task): NotificationKind {
  switch (kind) {
    case 'client_question':
    case 'comment_shared':
      return 'comment';
    case 'delegated':
      return 'delegated';
    case 'client_payment_reported':
      return 'payment';
    case 'returned_to_client':
    case 'task_assigned_client':
      if (task.type === 'payment') return 'payment';
      return task.type === 'approval' ? 'approval_needed' : 'task_update';
    case 'submission_accepted':
      return task.type === 'payment' ? 'payment' : 'task_update';
    case 'client_approved':
    case 'client_changes_requested':
    case 'client_submitted':
    case 'client_confirmed':
    case 'client_answered':
    case 'unblocked':
      return 'task_update';
  }
}

function taskCoalesceKey(kind: TaskEventKind, task: Task): string {
  if (task.quote_id && (kind === 'client_approved' || kind === 'client_changes_requested' || kind === 'task_assigned_client')) {
    return coalesceKey(`q:${task.quote_id}`);
  }
  if (task.payment_schedule_id && (kind === 'client_payment_reported' || kind === 'submission_accepted' || kind === 'task_assigned_client')) {
    return coalesceKey(`p:${task.payment_schedule_id}`);
  }
  if (kind === 'client_question' || kind === 'comment_shared') return coalesceKey(`c:${task.id}`);
  return coalesceKey(`t:${kind}:${task.id}`);
}

/** the user never got a bell item about this task (e.g. a client task that started blocked) */
function neverToldAbout(userId: ID, taskId: ID): boolean {
  return !db.rows('notifications').some((n) => n.user_id === userId && n.task_id === taskId);
}

/**
 * `actorId` null = system (daily sweep). The actor is never told about their own action — except 'unblocked' for a
 * task they were never told about: a client task that starts blocked is announced only when it becomes ready, and
 * that moment may be the assignee's own completion of the blocker.
 */
export function notifyTaskEvent(kind: TaskEventKind, taskId: ID, actorId: ID | null, extra: { note?: string; toUserId?: ID } = {}): void {
  const ctx = taskContext(taskId);
  if (!ctx) return;
  const { task, account } = ctx;
  const actor = actorId ? db.find('users', actorId) : undefined;
  const route = routeTaskEvent(kind, task, account.id, actor, extra.toUserId);
  const base = `${TPL}.task.${kind}.${route.audience}`;
  const notifKind = taskNotificationKind(kind, task);
  const dedupeKey = taskCoalesceKey(kind, task);
  const relative = dueRelative(openDue(task));

  for (const userId of unique(route.recipients)) {
    if (userId === actorId && !(kind === 'unblocked' && route.audience === 'client' && neverToldAbout(userId, task.id))) continue;
    const user = db.find('users', userId);
    if (!user) continue;
    const text = render(
      base,
      {
        account: account.name,
        task: task.title,
        due: fmtDay(task.due_date),
        relative,
        actor: actor ? actor.full_name : t(`${TPL}.common.newEra`),
        impact: impactText(task),
        ...addressingOf(user),
      },
      extra.note,
    );
    sendNotice(userId, {
      kind: notifKind,
      title: text.title,
      body: text.body,
      link: taskLinkFor(user, account.id, task.id),
      accountId: account.id,
      taskId: task.id,
      dedupeKey,
      email: route.email,
    });
  }
}

// ───────────────────────────── quote events ─────────────────────────────

function quoteRecipients(kind: QuoteEventKind, requester: ID, accountId: ID): ID[] {
  switch (kind) {
    case 'approval_requested':
      return directorIds();
    case 'approved':
    case 'approval_rejected':
      return [requester];
    case 'sent':
      return accountUsers(accountId, ['client_owner']);
    case 'accepted':
    case 'changes_requested':
      return [...internalOwners(accountId), ...directorIds()];
  }
}

export function notifyQuoteEvent(kind: QuoteEventKind, quoteId: ID, actorId: ID, extra: { note?: string } = {}): void {
  const quote = db.find('quotes', quoteId);
  const account = quote ? db.find('accounts', quote.account_id) : undefined;
  if (!quote || !account) return;
  const actor = db.find('users', actorId);
  const recipients = quoteRecipients(kind, quote.approval_requested_by ?? quote.created_by, account.id);
  const notifKind: NotificationKind = kind === 'approval_requested' || kind === 'sent' ? 'approval_needed' : 'quote';
  const dedupeKey =
    kind === 'sent' || kind === 'accepted' || kind === 'changes_requested' ? coalesceKey(`q:${quote.id}`) : coalesceKey(`qa:${kind}:${quote.id}`);

  for (const userId of unique(recipients)) {
    if (userId === actorId) continue;
    const user = db.find('users', userId);
    if (!user) continue;
    const text = render(
      `${TPL}.quote.${kind}`,
      {
        account: account.name,
        code: quote.code,
        version: quote.version,
        quote: quote.title,
        valid: fmtDate(quote.valid_until),
        actor: actor ? actor.full_name : account.name,
        ...addressingOf(user),
      },
      extra.note,
    );
    const link = user.org_type === 'client' ? `/portal/commercial/quotes/${quote.id}` : `/app/commercial/quotes/${quote.id}`;
    sendNotice(userId, {
      kind: notifKind,
      title: text.title,
      body: text.body,
      link,
      accountId: account.id,
      dedupeKey,
      email: 'policy',
    });
  }
}

// ───────────────────────────── payment events ─────────────────────────────

function paymentRecipients(kind: PaymentEventKind, accountId: ID): ID[] {
  switch (kind) {
    case 'invoice_due':
    case 'reported':
      return internalOwners(accountId);
    case 'invoiced':
    case 'paid':
      return accountUsers(accountId, ['client_owner']);
    case 'overdue':
      return [...internalOwners(accountId), ...accountUsers(accountId, ['client_owner'])];
  }
}

function paymentLink(user: User, accountId: ID, kind: PaymentEventKind, task: Task | undefined): string {
  if (user.org_type === 'client') {
    if (task && task.status !== 'done' && (kind === 'invoiced' || kind === 'overdue')) return clientTaskLink(task.id);
    return '/portal/commercial';
  }
  if (task && kind === 'reported') return internalTaskLink(accountId, task.id);
  return `/app/accounts/${accountId}/commercial`;
}

export function notifyPaymentEvent(kind: PaymentEventKind, paymentId: ID, actorId: ID | null): void {
  const payment = db.find('payment_schedules', paymentId);
  const contract = payment ? db.find('contracts', payment.contract_id) : undefined;
  const account = contract ? db.find('accounts', contract.account_id) : undefined;
  if (!payment || !account) return;
  const actor = actorId ? db.find('users', actorId) : undefined;
  const task = payment.task_id ? db.find('tasks', payment.task_id) : undefined;
  const days = Math.max(0, diffDays(todayISO(), payment.due_date));
  const dedupeKey =
    kind === 'overdue'
      ? `payov:${payment.id}:${payment.due_date}`
      : kind === 'invoice_due'
        ? coalesceKey(`pd:${payment.id}`)
        : coalesceKey(`p:${payment.id}`);

  for (const userId of unique(paymentRecipients(kind, account.id))) {
    if (actorId && userId === actorId) continue;
    const user = db.find('users', userId);
    if (!user) continue;
    const base = `${TPL}.payment.${kind}.${user.org_type === 'client' ? 'client' : 'internal'}`;
    if (!hasKey(`${base}.title`)) continue;
    const params: TParams = {
      account: account.name,
      name: payment.name,
      amount: fmtMoney(payment.amount),
      due: fmtDate(payment.due_date),
      days,
      actor: actor ? actor.full_name : account.name,
      invoice: payment.invoice_no ? t(`${TPL}.payment.invoiced.invoice`, { invoice: payment.invoice_no }) : '',
      ...addressingOf(user),
    };
    sendNotice(userId, {
      kind: 'payment',
      title: t(`${base}.title`, params),
      body: t(`${base}.body`, params),
      link: paymentLink(user, account.id, kind, task),
      accountId: account.id,
      taskId: task ? task.id : null,
      dedupeKey,
      email: 'policy',
    });
  }
}
