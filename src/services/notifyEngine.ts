// Daily notification sweep (SPEC §6) + "Nhắc khách" + "Nhắc qua Zalo".
// The sweep is a system job: it reads the db directly and never depends on the current viewer's permissions.

import type { Account, EmailMessage, ID, ISODate, Milestone, NotificationKind, Project, Task, User } from '@/domain/types';
import type { AccountGraph } from '@/domain/graph';
import type { SweepResult, ZaloReminder } from './contract';
import { dateOf, nowISO, todayISO } from '@/domain/clock';
import { addDays, diffDays, startOfWeek, weekday } from '@/domain/dates';
import { capitalize, t } from '@/i18n';
import { db } from './db';
import { primaryOwnerOf } from './context';
import {
  accountUsers,
  deliverEmail,
  HELD_MAIL_REASON,
  holdingPolicyMail,
  logActivity,
  nonUrgentSentToday,
  notifyUsers,
} from './effects';
import { graphForAccount, invalidateViewCache, taskMentionVisible } from './views';
import { ensurePaymentTask, refreshOverduePayments } from './commercialEffects';
import { effectiveQuoteStatus, isQuoteSuperseded } from './commercialViews';
import {
  absoluteUrl,
  addressing,
  addressingOf,
  clientRecipients,
  clientTaskLink,
  composeEmailBody,
  directorIds,
  dueRelative,
  fmtDay,
  impactText,
  internalTaskLink,
  mailTaskIds,
  notifyPaymentEvent,
  openDue,
  sendNotice,
  taskContext,
  taskLinkFor,
  unique,
  type TaskContext,
} from './notifyEvents';
import { buildWeeklyDigest, digestEmailText, digestRecipients, digestTaskIds, viewerForUser } from './digest';

const TPL = 'notifyTemplates';

export function emptySweepResult(date: ISODate): SweepResult {
  return { date, reminders: 0, overdue: 0, escalations: 0, payment_tasks: 0, emails_sent: 0, emails_batched: 0 };
}

interface OpenTask {
  task: Task;
  account: Account;
}

/** open tasks of live, not-paused projects/accounts */
function openTasks(): OpenTask[] {
  const projects = new Map(db.rows('projects').map((p): [ID, Project] => [p.id, p]));
  const accounts = new Map(db.rows('accounts').map((a): [ID, Account] => [a.id, a]));
  const out: OpenTask[] = [];
  for (const task of db.rows('tasks')) {
    if (task.status === 'done') continue;
    const project = projects.get(task.project_id);
    if (!project || project.status === 'paused') continue;
    const account = accounts.get(project.account_id);
    if (!account || account.stage === 'paused') continue;
    out.push({ task, account });
  }
  return out;
}

function milestoneNames(ms: Milestone[]): string {
  return [...ms]
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.order_no - b.order_no)
    .map((m) => m.name)
    .join(', ');
}

function maxDelay(graph: AccountGraph, ms: Milestone[]): number {
  return ms.reduce((max, m) => Math.max(max, graph.forecast(m.id).delay_days), 0);
}

// ───────────────────────────── (1) + (2) client tasks ─────────────────────────────

function autoReminder(task: Task, account: Account, kind: 'due_soon' | 'overdue', dedupeKey: string): boolean {
  const relative = dueRelative(openDue(task));
  let sent = false;
  for (const userId of clientRecipients(task, account.id)) {
    const user = db.find('users', userId);
    if (!user) continue;
    const params = {
      task: task.title,
      due: fmtDay(task.due_date),
      relative: capitalize(relative),
      relativeLower: relative,
      impact: impactText(task),
      ...addressingOf(user),
    };
    const ok = sendNotice(userId, {
      kind,
      title: t(`${TPL}.reminder.auto.title`, params),
      body: t(`${TPL}.reminder.auto.body`, params),
      link: clientTaskLink(task.id),
      accountId: account.id,
      taskId: task.id,
      dedupeKey,
      email: 'policy',
    });
    if (ok) sent = true;
  }
  return sent;
}

/** an escalation about the same task reaches each person at most once in this many days (rolling, not per week) */
const ESCALATION_INTERVAL_DAYS = 7;

function escalatedRecently(userId: ID, taskId: ID, today: ISODate): boolean {
  const since = addDays(today, -(ESCALATION_INTERVAL_DAYS - 1));
  return db
    .rows('notifications')
    .some((n) => n.user_id === userId && n.kind === 'escalation' && n.task_id === taskId && dateOf(n.created_at) >= since);
}

/** client task holding a milestone, overdue ≥ N days → decision makers + directors, urgent, once per 7 days */
function escalate(task: Task, account: Account, graph: AccountGraph, overdueDays: number, today: ISODate): boolean {
  const held = graph.milestonesHeldBy(task.id).filter((m) => m.status !== 'done');
  if (held.length === 0) return false;
  const dedupeKey = `esc:${task.id}:${today}`;
  const assignee = task.assignee_id ? db.find('users', task.assignee_id) : undefined;
  const reached: string[] = [];

  for (const userId of unique([...accountUsers(account.id, ['client_owner']), ...directorIds()])) {
    const user = db.find('users', userId);
    if (!user || escalatedRecently(userId, task.id, today)) continue;
    const isClient = user.org_type === 'client';
    const shown = isClient ? held.filter((m) => m.client_visible) : held;
    const variant = !isClient ? 'internal' : shown.length > 0 ? 'client' : 'clientPlain';
    const params = {
      account: account.name,
      task: task.title,
      due: fmtDay(task.due_date),
      days: overdueDays,
      milestones: milestoneNames(shown),
      delay: maxDelay(graph, shown.length > 0 ? shown : held),
      assignee: assignee ? assignee.full_name : account.name,
      ...addressingOf(user),
    };
    const ok = sendNotice(userId, {
      kind: 'escalation',
      title: t(`${TPL}.escalation.${variant}.title`, params),
      body: t(`${TPL}.escalation.${variant}.body`, params),
      link: taskLinkFor(user, account.id, task.id),
      accountId: account.id,
      taskId: task.id,
      urgent: true,
      dedupeKey,
      email: 'policy',
    });
    if (ok) reached.push(user.full_name);
  }

  if (reached.length === 0) return false;
  logActivity({
    account_id: account.id,
    actor_id: null,
    action: 'escalation.sent',
    target_type: 'task',
    target_id: task.id,
    params: { task: task.title, days: overdueDays, milestone: milestoneNames(held), to: reached.join(', ') },
    visibility: 'internal',
  });
  return true;
}

function sweepClientTasks(open: OpenTask[], today: ISODate, result: SweepResult): void {
  const settings = db.settings;
  const daysBefore = new Set(settings.reminder_days_before);
  for (const { task, account } of open) {
    if (task.side !== 'client' || task.waiting_on !== 'client' || quoteClosed(task)) continue;
    const graph = graphForAccount(account.id);
    if (graph.isBlocked(task.id)) continue;
    const daysLeft = diffDays(task.due_date, today);
    if (daysLeft >= 0) {
      if (daysBefore.has(daysLeft) && autoReminder(task, account, 'due_soon', `due${daysLeft}:${task.id}:${task.due_date}`)) {
        result.reminders += 1;
      }
      continue;
    }
    if (autoReminder(task, account, 'overdue', `overdue:${task.id}:${today}`)) result.overdue += 1;
    if (-daysLeft >= settings.escalation_overdue_days && escalate(task, account, graph, -daysLeft, today)) result.escalations += 1;
  }
}

// ───────────────────────────── (3) payments ─────────────────────────────

function sweepPayments(today: ISODate, result: SweepResult): void {
  const becomingOverdue = db
    .rows('payment_schedules')
    .filter((p) => p.status === 'invoiced' && today > p.due_date)
    .map((p) => p.id);
  refreshOverduePayments(today);
  // D already notifies inside refreshOverduePayments; the per-installment dedupe key makes this a safety net only
  for (const id of becomingOverdue) {
    if (db.find('payment_schedules', id)?.status === 'overdue') notifyPaymentEvent('overdue', id, null);
  }

  if (!db.settings.payment_task_auto) return;
  for (const p of db.rows('payment_schedules')) {
    if (!p.auto_task_enabled || (p.status !== 'invoiced' && p.status !== 'overdue')) continue;
    if (!db.find('contracts', p.contract_id)) continue;
    if (p.task_id && db.find('tasks', p.task_id)) continue;
    if (ensurePaymentTask(p.id, null)) result.payment_tasks += 1;
  }
}

// ───────────────────────────── (4) internal overdue ─────────────────────────────

function sweepInternalOverdue(open: OpenTask[], today: ISODate, result: SweepResult): void {
  for (const { task, account } of open) {
    if (task.side !== 'internal' || !(today > task.due_date)) continue;
    const assignee = task.assignee_id ? db.find('users', task.assignee_id) : undefined;
    if (!assignee || assignee.org_type !== 'internal') continue;
    const held = graphForAccount(account.id).milestonesHeldBy(task.id);
    const params = {
      account: account.name,
      task: task.title,
      due: fmtDay(task.due_date),
      days: diffDays(today, task.due_date),
      held: held.length > 0 ? t(`${TPL}.internalOverdue.held`, { milestones: milestoneNames(held) }) : '',
    };
    const ok = sendNotice(assignee.id, {
      kind: 'overdue',
      title: t(`${TPL}.internalOverdue.title`, params),
      body: t(`${TPL}.internalOverdue.body`, params),
      link: internalTaskLink(account.id, task.id),
      accountId: account.id,
      taskId: task.id,
      dedupeKey: `int_overdue:${task.id}:${today}`,
      email: 'none',
    });
    if (ok) result.overdue += 1;
  }
}

// ───────────────────────────── (5) the day's one mail ─────────────────────────────

const SUMMARIZED = 'summarized';
/** mails that ask the recipient to act: pointless once the task is done */
const ACTION_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  'due_soon',
  'overdue',
  'reminder',
  'escalation',
  'approval_needed',
  'delegated',
]);
/** reminders: one line per task, re-dated today */
const REMINDER_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>(['due_soon', 'overdue', 'reminder']);

interface MailItem {
  line: string;
  /** deep link of this line (the task itself for task mails) */
  link: string | null;
  taskIds: ID[];
  /** stored mail the line comes from (the newest one for a merged reminder) */
  mail: EmailMessage;
  /** the line is still exactly the stored mail's subject */
  asStored: boolean;
}

/**
 * What is still worth telling `user` from their pending mails, rebuilt from the CURRENT data: a mail naming a task
 * that is deleted or no longer visible to this client (SPEC §2 — stored text never outlives the task's visibility)
 * is dropped, as is a request to act on a task that is already done; reminders are merged per task and re-dated
 * today ("Đã quá hạn 9 ngày", not yesterday's 8).
 */
function pendingItems(user: User, mails: EmailMessage[], today: ISODate): MailItem[] {
  const viewer = user.org_type === 'client' ? viewerForUser(user) : null;
  const items = new Map<string, MailItem>();
  for (const mail of mails) {
    const taskIds = mailTaskIds(mail);
    const tasks = taskIds.map((id) => db.find('tasks', id));
    if (tasks.some((x) => !x || (viewer !== null && !taskMentionVisible(x.id, viewer)))) continue;
    const task = tasks[0];
    if (task && ACTION_KINDS.has(mail.kind) && task.status === 'done') continue;
    if (task && REMINDER_KINDS.has(mail.kind)) {
      if (task.side === 'client' && task.waiting_on !== 'client') continue;
      const line = t(`${TPL}.summary.reminderLine`, {
        relative: capitalize(dueRelative(openDue(task, today))),
        task: task.title,
      });
      const key = `task:${task.id}`;
      // the newest reminder of a task replaces the earlier ones (and takes its place in the order)
      items.delete(key);
      items.set(key, { line, link: mail.link, taskIds, mail, asStored: line === mail.subject });
      continue;
    }
    items.set(mail.id, { line: mail.subject, link: mail.link, taskIds, mail, asStored: true });
  }
  return [...items.values()];
}

/**
 * Runs LAST in the daily sweep, after every reminder of the day was HELD (effects.holdingPolicyMail): each person
 * gets ONE non-urgent mail for the day — through the 1-mail/day policy, not around it — made of the mails still
 * pending (yesterday's batch + today's reminders), rebuilt from the current data. A single fresh item is sent as
 * it is (with its own deep link); several items become a summary whose every line carries its own deep link.
 * When the day's quota is already used, everything waits for tomorrow's mail.
 */
function sendDailyMail(today: ISODate): void {
  const byUser = new Map<ID, EmailMessage[]>();
  for (const e of db.rows('emails')) {
    if (e.status !== 'batched' || e.reason === SUMMARIZED) continue;
    const list = byUser.get(e.to_user_id) ?? [];
    list.push(e);
    byUser.set(e.to_user_id, list);
  }
  for (const [userId, unsorted] of byUser) {
    const mails = [...unsorted].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const user = db.find('users', userId);
    let released: ID | null = null;
    if (user && user.status !== 'disabled' && user.notification_pref === 'all') {
      if (nonUrgentSentToday(userId) >= db.settings.max_emails_per_day) {
        // quota already used today: everything waits for tomorrow's mail
        for (const m of mails) if (m.reason === HELD_MAIL_REASON) db.update('emails', m.id, { reason: 'daily_limit' });
        continue;
      }
      const items = pendingItems(user, mails, today);
      const only = items.length === 1 ? items[0] : undefined;
      if (only && only.asStored && dateOf(only.mail.created_at) === today) {
        released = only.mail.id;
        db.update('emails', only.mail.id, { status: 'sent', sent_at: nowISO(), reason: null, batch_key: null });
      } else if (items.length > 0) {
        sendSummary(user, items, today);
      }
    }
    for (const m of mails) if (m.id !== released) db.update('emails', m.id, { reason: SUMMARIZED });
  }
}

function sendSummary(user: User, items: MailItem[], today: ISODate): void {
  const lines = [t(`${TPL}.summary.intro`, { pronoun: addressingOf(user).pronoun })];
  for (const item of items) {
    lines.push(t(`${TPL}.summary.item`, { subject: item.line }));
    if (item.link) lines.push(t(`${TPL}.summary.itemLink`, { url: absoluteUrl(item.link) }));
  }
  const link = user.org_type === 'client' ? '/portal' : '/app/notifications';
  const mail = deliverEmail(user.id, {
    subject: t(`${TPL}.summary.subject`, { count: items.length }),
    body_text: composeEmailBody(user, lines.join('\n'), link, `${TPL}.summary.open`),
    link,
    kind: 'system',
    urgent: false,
    task_ids: unique(items.flatMap((i) => i.taskIds)),
  });
  if (mail) db.update('emails', mail.id, { batch_key: `summary:${user.id}:${today}` });
}

// ───────────────────────────── (6) weekly bulletin ─────────────────────────────

function vietnamHour(): number {
  return Number(nowISO().slice(11, 13));
}

function sendWeeklyBulletins(today: ISODate): void {
  const settings = db.settings;
  const targetWeekday = ((settings.weekly_digest_weekday % 7) + 7) % 7;
  if (weekday(today) !== targetWeekday || vietnamHour() < settings.weekly_digest_hour) return;
  const weekStart = startOfWeek(today);
  for (const user of digestRecipients()) {
    const key = `weekly:${user.id}:${weekStart}`;
    if (db.rows('emails').some((e) => e.batch_key === key)) continue;
    const digest = buildWeeklyDigest(viewerForUser(user), 'current');
    if (digest.sections.length === 0) continue;
    const link = user.org_type === 'client' ? '/portal' : '/app/digest';
    const mail = deliverEmail(user.id, {
      subject: t(`${TPL}.digest.subject`, { week: fmtDay(weekStart) }),
      body_text: digestEmailText(digest, user, link),
      link,
      kind: 'digest',
      urgent: false,
      // the body names these tasks: the stored mail is hidden from a client once one of them is hidden
      task_ids: digestTaskIds(digest),
    });
    if (mail) db.update('emails', mail.id, { batch_key: key });
    const { pronoun } = addressingOf(user);
    notifyUsers([user.id], {
      kind: 'digest',
      title: t(`${TPL}.digest.notifTitle`, { week: fmtDay(weekStart) }),
      body: t(user.org_type === 'client' ? `${TPL}.digest.notifBodyClient` : `${TPL}.digest.notifBody`, {
        pronoun,
        count: digest.sections.length,
      }),
      link,
      account_id: user.account_id,
      dedupe_key: key,
    });
  }
}

// ───────────────────────────── the sweep ─────────────────────────────

/**
 * Runs steps 1–5 at most once per Vietnam calendar day (db.meta.last_sweep_date; `force` bypasses).
 * Step 6 (weekly bulletin) is idempotent per recipient and week, so it is also checked on later runs
 * of the same day — an app opened at 7:00 on Monday still sends the 8:00 bulletin when reopened after 8:00.
 */
export function runSweep(force: boolean): SweepResult {
  const today = todayISO();
  const result = emptySweepResult(today);
  const fullRun = force || db.meta.last_sweep_date !== today;
  const before = new Set(db.allRows('emails').map((e) => e.id));

  db.batch(() => {
    if (fullRun) {
      // every policy mail of the run is held, then merged into each person's one mail of the day
      holdingPolicyMail(() => {
        const existing = new Set(db.allRows('tasks').map((x) => x.id));
        // payments & quotes FIRST: an approval task withdrawn because its quote expired is never reminded the
        // same day (it would link to a task that no longer exists)
        sweepPayments(today, result);
        // payments/tasks changed inside this batch: memoized graphs & health must be rebuilt before reading views again
        invalidateViewCache();
        // tasks this run created (payment tasks) are not reminded on their first day
        const open = openTasks().filter((o) => existing.has(o.task.id));
        sweepClientTasks(open, today, result);
        sweepInternalOverdue(open, today, result);
      });
      invalidateViewCache();
      sendDailyMail(today);
      db.updateMeta({ last_sweep_date: today });
    }
    sendWeeklyBulletins(today);
  });

  for (const e of db.allRows('emails')) {
    if (before.has(e.id)) continue;
    if (e.status === 'sent') result.emails_sent += 1;
    else if (e.status === 'batched') result.emails_batched += 1;
  }
  return result;
}

// ───────────────────────────── "Nhắc khách" ─────────────────────────────

/** an approval task of a quote the client can no longer decide on (expired, or a later version was sent) */
function quoteClosed(task: Task): boolean {
  if (!task.quote_id) return false;
  const q = db.find('quotes', task.quote_id);
  return !q || effectiveQuoteStatus(q) !== 'sent' || isQuoteSuperseded(q);
}

/** open client task waiting on the client that the client can act on now */
export function isRemindable(task: Task, accountId: ID): boolean {
  return (
    task.side === 'client' &&
    task.status !== 'done' &&
    task.waiting_on === 'client' &&
    !quoteClosed(task) &&
    !graphForAccount(accountId).isBlocked(task.id)
  );
}

function manualReminderText(task: Task, user: User): { title: string; body: string } {
  const params = {
    task: task.title,
    due: fmtDay(task.due_date),
    relative: dueRelative(openDue(task)),
    impact: impactText(task),
    ...addressingOf(user),
  };
  return { title: t(`${TPL}.reminder.manual.title`, params), body: t(`${TPL}.reminder.manual.body`, params) };
}

/**
 * The "Nhắc khách" mail of one person, sent now: one task → that task's own mail; several (bulk "Nhắc khách (N)") →
 * ONE mail listing every task with its deep link, never N mails in the same second.
 */
function sendReminderMail(user: User, tasks: Task[]): void {
  const only = tasks.length === 1 ? tasks[0] : undefined;
  if (only) {
    const { title, body } = manualReminderText(only, user);
    const link = clientTaskLink(only.id);
    deliverEmail(user.id, {
      subject: t(`${TPL}.email.subject`, { title }),
      body_text: composeEmailBody(user, body, link),
      link,
      kind: 'reminder',
      urgent: false,
      immediate: true,
      task_ids: [only.id],
    });
    return;
  }
  const addr = addressingOf(user);
  const lines = [t(`${TPL}.reminder.manyMail.intro`, { count: tasks.length, pronoun: addr.pronoun })];
  for (const task of tasks) {
    lines.push(t(`${TPL}.reminder.manyMail.item`, { task: task.title, due: fmtDay(task.due_date), relative: dueRelative(openDue(task)) }));
    lines.push(t(`${TPL}.summary.itemLink`, { url: absoluteUrl(clientTaskLink(task.id)) }));
  }
  lines.push('', t(`${TPL}.reminder.manyMail.outro`, { ...addr }));
  const link = '/portal/tasks';
  deliverEmail(user.id, {
    subject: t(`${TPL}.reminder.manyMail.subject`, { count: tasks.length }),
    body_text: composeEmailBody(user, lines.join('\n'), link, `${TPL}.reminder.manyMail.open`),
    link,
    kind: 'reminder',
    urgent: false,
    immediate: true,
    task_ids: tasks.map((x) => x.id),
  });
}

/**
 * Call inside db.batch after the permission checks. Sends now (bypasses the 1-email/day limit) and logs: a bell item
 * per task, ONE mail per person (all their reminded tasks), reminder_count + task.reminded per task.
 */
export function remindClientTasks(taskIds: ID[], actorId: ID): { reminded: number; skipped: number } {
  const at = nowISO();
  let reminded = 0;
  let skipped = 0;
  const contexts: TaskContext[] = [];
  /** recipient → the tasks they are reminded of, in the order asked */
  const byUser = new Map<ID, TaskContext[]>();
  for (const id of unique(taskIds)) {
    const ctx = taskContext(id);
    if (!ctx || !isRemindable(ctx.task, ctx.account.id)) {
      skipped += 1;
      continue;
    }
    contexts.push(ctx);
    for (const userId of clientRecipients(ctx.task, ctx.account.id)) {
      const list = byUser.get(userId) ?? [];
      list.push(ctx);
      byUser.set(userId, list);
    }
  }

  const reached = new Map<ID, string[]>();
  for (const [userId, list] of byUser) {
    const user = db.find('users', userId);
    if (!user) continue;
    const sent: Task[] = [];
    for (const { task, account } of list) {
      const { title, body } = manualReminderText(task, user);
      const ok = sendNotice(userId, {
        kind: 'reminder',
        title,
        body,
        link: clientTaskLink(task.id),
        accountId: account.id,
        taskId: task.id,
        email: 'none',
      });
      if (!ok) continue;
      sent.push(task);
      reached.set(task.id, [...(reached.get(task.id) ?? []), user.full_name]);
    }
    if (sent.length > 0) sendReminderMail(user, sent);
  }

  for (const { task, account } of contexts) {
    const names = reached.get(task.id) ?? [];
    if (names.length === 0) {
      skipped += 1;
      continue;
    }
    db.update('tasks', task.id, { reminder_count: (task.reminder_count || 0) + 1, last_reminded_at: at });
    logActivity({
      account_id: account.id,
      actor_id: actorId,
      action: 'task.reminded',
      target_type: 'task',
      target_id: task.id,
      params: { task: task.title, to: names.join(', ') },
      visibility: 'internal',
    });
    reminded += 1;
  }
  return { reminded, skipped };
}

// ───────────────────────────── "Nhắc qua Zalo" ─────────────────────────────

/** Ready-to-paste text for the client assignee (else the primary decision maker) + zalo.me link. */
export function buildZaloReminder(task: Task, accountId: ID): ZaloReminder {
  const assignee = task.assignee_id ? db.find('users', task.assignee_id) : undefined;
  const user = assignee && assignee.org_type === 'client' && assignee.status !== 'disabled' ? assignee : primaryOwnerOf(accountId);
  const contacts = db.rows('contacts').filter((c) => c.account_id === accountId);
  const contact = user
    ? (contacts.find((c) => c.user_id === user.id) ?? contacts.find((c) => c.email.toLowerCase() === user.email.toLowerCase()))
    : (contacts.find((c) => c.decision_role === 'decision_maker') ?? contacts[0]);
  const salutation = (user ? user.salutation : null) ?? (contact ? contact.salutation : null);
  const name = user ? user.full_name : contact ? contact.full_name : null;
  const addr = addressing(name, salutation);

  const phone = ((user ? user.phone : null) || (contact ? contact.phone : null) || '').trim();
  const digits = phone.replace(/\D/g, '');
  const text = t(`${TPL}.zalo.text`, {
    address: addr.address,
    pronoun: addr.pronoun,
    Pronoun: addr.Pronoun,
    task: task.title,
    due: fmtDay(task.due_date),
    relative: dueRelative(openDue(task)),
    url: absoluteUrl(clientTaskLink(task.id)),
  });
  return { phone: digits ? phone : null, text, url: digits ? `https://zalo.me/${digits}` : null };
}
