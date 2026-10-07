// Notification API (owner E): bell, simulated outbox, daily sweep, weekly digest, "Nhắc khách", "Nhắc qua Zalo".
// Merged into `api` by src/services/api.ts (latency, sanitizeOutgoing, JSON clone, __CH_NET__ log).

import type { EmailMessage, ID, User } from '@/domain/types';
import type { Api, EmailView, NotificationView, Viewer } from '@/services/contract';
import { ApiError } from '@/services/contract';
import { nowISO, todayISO } from '@/domain/clock';
import { db } from '@/services/db';
import { accessibleAccountIds, assertManagerOf, assertRole, assertWritable, requireViewer, toUserRef } from '@/services/context';
import { buildWeeklyDigest, viewerForUser } from '@/services/digest';
import { buildZaloReminder, emptySweepResult, isRemindable, remindClientTasks, runSweep } from '@/services/notifyEngine';
import { isClientViewer, taskMentionVisible } from '@/services/views';
import { linkedTaskId, mailTaskIds } from '@/services/notifyEvents';

type NotifyApi = Pick<
  Api,
  'listNotifications' | 'markNotificationsRead' | 'listOutbox' | 'runNotificationSweep' | 'getWeeklyDigest' | 'remindClient' | 'getZaloReminder'
>;

const DEFAULT_NOTIFICATION_LIMIT = 100;
const DEFAULT_OUTBOX_LIMIT = 200;

function forbidden(): ApiError {
  return new ApiError('forbidden', 'errors.forbidden');
}

function notFound(): ApiError {
  return new ApiError('not_found', 'errors.not_found');
}

function timeOf(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Bell items and mails are stored text. A client only keeps reading those about tasks it may still see
 * (a task switched to client_visible = false later, a commercial task for a client_member…).
 */
function mentionAllowed(v: Viewer, taskId: ID | null, link: string | null): boolean {
  if (!isClientViewer(v)) return true;
  const id = taskId ?? linkedTaskId(link);
  return !id || taskMentionVisible(id, v);
}

/** a stored mail may name several tasks (daily summary, weekly bulletin): every one of them must still be visible */
function mailAllowed(v: Viewer, mail: EmailMessage): boolean {
  if (!isClientViewer(v)) return true;
  return mailTaskIds(mail).every((id) => taskMentionVisible(id, v));
}

/** newest first; rows inserted later win ties */
function newestFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].reverse().sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at));
}

/** Whose emails the viewer may read: director all; AM own accounts' users + self; everyone else self. */
function outboxScope(v: Viewer): (userId: ID) => boolean {
  if (v.org_type === 'internal' && v.role === 'director') return () => true;
  if (v.org_type === 'internal' && v.role === 'am') {
    const accounts = accessibleAccountIds(v);
    const users = new Set(
      db
        .allRows('users')
        .filter((u) => u.account_id !== null && accounts.has(u.account_id))
        .map((u) => u.id),
    );
    users.add(v.user.id);
    return (id) => users.has(id);
  }
  return (id) => id === v.user.id;
}

/** director: anyone; AM: users of own accounts + self; others: self only */
function canPreviewDigestOf(v: Viewer, user: User): boolean {
  if (user.id === v.user.id) return true;
  if (v.org_type !== 'internal' || v.read_only) return false;
  if (v.role === 'director') return true;
  if (v.role === 'am') return user.org_type === 'client' && user.account_id !== null && accessibleAccountIds(v).has(user.account_id);
  return false;
}

export const notifyApi: NotifyApi = {
  async listNotifications(params) {
    const v = requireViewer();
    const unreadOnly = params?.unreadOnly ?? false;
    const limit = Math.max(0, params?.limit ?? DEFAULT_NOTIFICATION_LIMIT);
    const own = db
      .rows('notifications')
      .filter((n) => n.user_id === v.user.id && (!unreadOnly || !n.read_at) && mentionAllowed(v, n.task_id, n.link));
    return newestFirst(own)
      .slice(0, limit)
      .map((n): NotificationView => ({ ...n }));
  },

  async markNotificationsRead(ids) {
    const v = requireViewer();
    assertWritable(v);
    const wanted = ids ? new Set(ids) : null;
    const targets = db.rows('notifications').filter((n) => n.user_id === v.user.id && !n.read_at && (!wanted || wanted.has(n.id)));
    if (targets.length === 0) return;
    const at = nowISO();
    db.batch(() => {
      for (const n of targets) db.update('notifications', n.id, { read_at: at });
    });
  },

  async listOutbox(params) {
    const v = requireViewer();
    const allowed = outboxScope(v);
    const userId = params?.userId;
    if (userId && !allowed(userId)) throw forbidden();
    const limit = Math.max(0, params?.limit ?? DEFAULT_OUTBOX_LIMIT);
    const users = new Map(db.allRows('users').map((u): [ID, User] => [u.id, u]));
    const out: EmailView[] = [];
    for (const e of newestFirst(db.rows('emails'))) {
      if (out.length >= limit) break;
      if (userId ? e.to_user_id !== userId : !allowed(e.to_user_id)) continue;
      if (!mailAllowed(v, e)) continue;
      const to = users.get(e.to_user_id);
      if (!to) continue;
      out.push({ ...e, to_user: toUserRef(to) });
    }
    return out;
  },

  async runNotificationSweep(force) {
    // System job: any logged-in viewer may trigger it; it never uses the viewer's permissions.
    const v = requireViewer();
    if (v.read_only) return emptySweepResult(todayISO());
    return runSweep(force === true);
  },

  async getWeeklyDigest(userId) {
    const v = requireViewer();
    if (!userId || userId === v.user.id) return buildWeeklyDigest(v);
    if (v.org_type !== 'internal' || v.role === 'member') throw forbidden();
    const user = db.find('users', userId);
    if (!user) throw notFound();
    if (!canPreviewDigestOf(v, user)) throw forbidden();
    return buildWeeklyDigest(viewerForUser(user));
  },

  async remindClient(taskIds) {
    const v = requireViewer();
    assertWritable(v);
    assertRole(v, ['director', 'am']);
    const ids = [...new Set(taskIds)];
    // check every task first so a forbidden one never leaves half the reminders sent
    for (const id of ids) {
      const task = db.find('tasks', id);
      const project = task ? db.find('projects', task.project_id) : undefined;
      if (project) assertManagerOf(v, project.account_id);
    }
    return db.batch(() => remindClientTasks(ids, v.user.id)).result;
  },

  async getZaloReminder(taskId) {
    const v = requireViewer();
    assertRole(v, ['director', 'am']);
    const task = db.find('tasks', taskId);
    const project = task ? db.find('projects', task.project_id) : undefined;
    if (!task || !project) throw notFound();
    assertManagerOf(v, project.account_id);
    // the text goes to the client: only for a client task the client can act on now (same rule as "Nhắc khách")
    if (task.side !== 'client') throw new ApiError('validation', 'errors.action_not_allowed');
    if (!isRemindable(task, project.account_id)) throw new ApiError('conflict', 'errors.task_not_waiting');
    return buildZaloReminder(task, project.account_id);
  },
};
