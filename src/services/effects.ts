// Side effects shared by every service module: activity log, in-app notifications, simulated email.
// Call these inside db.batch(...) so they are undone together with the action.

import type {
  Activity,
  ActivityAction,
  ActivityTargetType,
  AppNotification,
  EmailMessage,
  ID,
  NotificationKind,
  Role,
  Visibility,
} from '@/domain/types';
import { dateOf, nowISO, todayISO } from '@/domain/clock';
import { newId } from '@/lib/utils';
import { db } from './db';

export function logActivity(input: {
  account_id: ID | null;
  actor_id: ID | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_id: ID;
  params?: Record<string, string | number>;
  visibility: Visibility;
}): Activity {
  const row: Activity = {
    id: newId('act'),
    account_id: input.account_id,
    actor_id: input.actor_id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    params: input.params ?? {},
    visibility: input.visibility,
    created_at: nowISO(),
  };
  return db.insert('activities', row);
}

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  account_id: ID | null;
  task_id?: ID | null;
  urgent?: boolean;
  dedupe_key?: string | null;
}

/** In-app notification (bell) for each user; skips users who already got the same dedupe_key. */
export function notifyUsers(userIds: ID[], input: NotifyInput, opts: { email?: boolean; emailSubject?: string; immediate?: boolean } = {}): AppNotification[] {
  const created: AppNotification[] = [];
  for (const userId of [...new Set(userIds)]) {
    const user = db.find('users', userId);
    if (!user || user.status === 'disabled') continue;
    if (input.dedupe_key && db.rows('notifications').some((n) => n.user_id === userId && n.dedupe_key === input.dedupe_key)) continue;
    const row: AppNotification = {
      id: newId('ntf'),
      user_id: userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link,
      account_id: input.account_id,
      task_id: input.task_id ?? null,
      urgent: !!input.urgent,
      read_at: null,
      created_at: nowISO(),
      dedupe_key: input.dedupe_key ?? null,
    };
    created.push(db.insert('notifications', row));
    if (opts.email) {
      deliverEmail(userId, {
        subject: opts.emailSubject ?? input.title,
        body_text: input.body,
        link: input.link,
        kind: input.kind,
        urgent: !!input.urgent,
        immediate: !!opts.immediate,
      });
    }
  }
  return created;
}

/** Non-urgent mails (digest excepted) already sent to the user today — what the 1-email/day policy counts. */
export function nonUrgentSentToday(userId: ID): number {
  const today = todayISO();
  return db
    .rows('emails')
    .filter((e) => e.to_user_id === userId && e.status === 'sent' && !e.urgent && e.kind !== 'digest' && dateOf(e.created_at) === today).length;
}

let holdDepth = 0;

/** `reason` of a mail held by `holdingPolicyMail` (the daily sweep merges them into the day's one mail) */
export const HELD_MAIL_REASON = 'held';

/**
 * Runs `fn` with policy mail HELD: a non-urgent mail that the 1-email/day policy would send now is stored as
 * 'batched' (reason 'held') instead, so the caller can merge everything a person gets from one job into a single
 * mail (the daily sweep: yesterday's leftovers + today's reminders). Urgent, immediate and digest mails, and the
 * "chỉ nhận bản tin tuần và việc gấp" preference, are unaffected.
 */
export function holdingPolicyMail<R>(fn: () => R): R {
  holdDepth += 1;
  try {
    return fn();
  } finally {
    holdDepth -= 1;
  }
}

/**
 * Simulated email with the section-6 policy:
 * - urgent (escalation) or immediate (AM pressed "Nhắc khách") → sent now
 * - user chose "chỉ nhận bản tin tuần và việc gấp" → non-urgent mail suppressed (digest still goes out)
 * - otherwise at most `max_emails_per_day` non-urgent mails per person per day; the rest are batched
 *   into the next daily summary (inside `holdingPolicyMail` every non-urgent mail is batched)
 * `task_ids`: the tasks the mail names (see EmailMessage.task_ids).
 */
export function deliverEmail(
  userId: ID,
  msg: {
    subject: string;
    body_text: string;
    link: string | null;
    kind: NotificationKind;
    urgent: boolean;
    immediate?: boolean;
    task_ids?: ID[];
  },
): EmailMessage | null {
  const user = db.find('users', userId);
  if (!user) return null;
  const today = todayISO();
  const at = nowISO();
  let status: EmailMessage['status'] = 'sent';
  let reason: string | null = null;
  let batch_key: string | null = null;

  if (!msg.urgent && !msg.immediate && msg.kind !== 'digest') {
    if (user.notification_pref === 'digest_and_urgent') {
      status = 'suppressed';
      reason = 'pref_digest_only';
    } else {
      const quotaUsed = nonUrgentSentToday(userId) >= db.settings.max_emails_per_day;
      if (quotaUsed || holdDepth > 0) {
        status = 'batched';
        batch_key = `daily:${userId}:${today}`;
        reason = quotaUsed ? 'daily_limit' : HELD_MAIL_REASON;
      }
    }
  }

  const row: EmailMessage = {
    id: newId('mail'),
    to_user_id: userId,
    to_email: user.email,
    subject: msg.subject,
    body_text: msg.body_text,
    link: msg.link,
    kind: msg.kind,
    urgent: msg.urgent,
    status,
    batch_key,
    created_at: at,
    sent_at: status === 'sent' ? at : null,
    reason,
  };
  const taskIds = [...new Set((msg.task_ids ?? []).filter((id) => typeof id === 'string' && id))];
  if (taskIds.length > 0) row.task_ids = taskIds;
  return db.insert('emails', row);
}

/** Users of an account with the given roles (e.g. all client_owner of account). */
export function accountUsers(accountId: ID, roles: Role[]): ID[] {
  return db
    .rows('users')
    .filter((u) => u.account_id === accountId && roles.includes(u.role) && u.status !== 'disabled')
    .map((u) => u.id);
}

/** New Era people responsible for an account: its AM (+ director when asked). */
export function internalOwners(accountId: ID, opts: { includeDirector?: boolean } = {}): ID[] {
  const account = db.find('accounts', accountId);
  const ids = account ? [account.am_id] : [];
  if (opts.includeDirector) ids.push(...db.rows('users').filter((u) => u.role === 'director' && u.status === 'active').map((u) => u.id));
  return [...new Set(ids)];
}
