// Weekly digest ("Bản tin tuần", SPEC §6): the model shown on /app/digest and the plain-text email body.
// Built for a RECIPIENT viewer (not necessarily the current one), so every view is filtered as they would see it.

import type { Account, Health, ID, ISODate, Stage, Task, User } from '@/domain/types';
import type { DigestSection, HealthInfo, StatusLine, TaskView, UserRef, Viewer, WeeklyDigest } from './contract';
import { atTime, dateOf, todayISO } from '@/domain/clock';
import { addDays, startOfWeek } from '@/domain/dates';
import { buildStatusLine } from '@/domain/health';
import { compareClientTasks } from '@/domain/taskRules';
import { t } from '@/i18n';
import { db } from './db';
import { accessibleAccountIds, toUserRef } from './context';
import {
  accountRef,
  canViewTask,
  clientShouldAct,
  graphForAccount,
  headlineFor,
  healthFor,
  milestoneView,
  taskView,
} from './views';
import { addressingOf, composeEmailBody, dueRelative, fmtDate, fmtDay } from './notifyEvents';

const TPL = 'notifyTemplates';
/** director digest covers accounts in these stages */
const DIGEST_STAGES: Stage[] = ['implementing', 'operating', 'negotiating'];
const HEALTH_ORDER: Record<Health, number> = { blocked: 0, attention: 1, on_track: 2 };
const UPCOMING_DAYS = 21;
/** tasks listed per section in the email (the preview page shows all) */
const EMAIL_ITEMS = 5;

/** A non-impersonating viewer for any user (digest recipients, previews). */
export function viewerForUser(u: User): Viewer {
  return {
    user: { ...toUserRef(u), account_id: u.account_id, notification_pref: u.notification_pref, onboarded_at: u.onboarded_at },
    role: u.role,
    org_type: u.org_type,
    account_id: u.account_id,
    can_view_cost: u.role === 'director' || (u.role === 'am' && u.can_view_cost),
    read_only: false,
    impersonating: null,
    remember_device: false,
  };
}

/** C-level recipients of the Monday bulletin: directors, AMs with accounts, decision makers of active accounts. */
export function digestRecipients(): User[] {
  const accounts = db.rows('accounts');
  return db.rows('users').filter((u) => {
    if (u.status !== 'active') return false;
    switch (u.role) {
      case 'director':
        return true;
      case 'am':
        return accounts.some((a) => a.am_id === u.id);
      case 'client_owner': {
        const account = accounts.find((a) => a.id === u.account_id);
        return !!account && DIGEST_STAGES.includes(account.stage);
      }
      case 'member':
      case 'client_member':
        return false;
    }
  });
}

function digestAccounts(rv: Viewer): Account[] {
  const accounts = db.rows('accounts');
  switch (rv.role) {
    case 'client_owner':
    case 'client_member':
      return accounts.filter((a) => a.id === rv.account_id);
    case 'am':
      return accounts.filter((a) => a.am_id === rv.user.id);
    case 'director':
      return accounts.filter((a) => DIGEST_STAGES.includes(a.stage));
    case 'member': {
      const ids = accessibleAccountIds(rv);
      return accounts.filter((a) => ids.has(a.id) && DIGEST_STAGES.includes(a.stage));
    }
  }
}

/** Status band sentence for an account, as `rv` would see it (same headline rule as the client home). */
export function statusLineFor(rv: Viewer, health: HealthInfo): StatusLine {
  return buildStatusLine({
    health: health.value,
    overridden: health.overridden,
    reasons: health.reasons,
    headline: (milestoneId: ID) => headlineFor(milestoneId, rv),
  });
}

/** internal: open work waiting on New Era — own tasks, or everything for the AM / director */
function isWaitingOnInternal(task: Task, rv: Viewer): boolean {
  if (task.waiting_on !== 'internal') return false;
  return task.assignee_id === rv.user.id || rv.role === 'am' || rv.role === 'director';
}

function compareByDue(a: TaskView, b: TaskView): number {
  return a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'vi');
}

function sectionFor(account: Account, rv: Viewer, today: ISODate): DigestSection {
  const isClient = rv.org_type === 'client';
  const graph = graphForAccount(account.id);
  const projectIds = new Set(
    db
      .rows('projects')
      .filter((p) => p.account_id === account.id)
      .map((p) => p.id),
  );
  const tasks = db.rows('tasks').filter((x) => projectIds.has(x.project_id) && canViewTask(x, rv));

  const weekAgo = addDays(today, -7);
  const doneLastWeek = tasks
    .filter((x) => x.status === 'done' && x.completed_at !== null && dateOf(x.completed_at) >= weekAgo && dateOf(x.completed_at) <= today)
    .sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))
    .map((x) => taskView(x, rv));

  const waiting = tasks
    .filter((x) => x.status !== 'done' && !graph.isBlocked(x.id) && (isClient ? clientShouldAct(x, rv) : isWaitingOnInternal(x, rv)))
    .map((x) => taskView(x, rv))
    .sort(isClient ? compareClientTasks : compareByDue);

  const horizon = addDays(today, UPCOMING_DAYS);
  const upcoming = db
    .rows('milestones')
    .filter((m) => projectIds.has(m.project_id) && m.status !== 'done' && (!isClient || m.client_visible))
    .map((m) => milestoneView(m, rv))
    .filter((m) => m.forecast_date <= horizon)
    .sort((x, y) => x.forecast_date.localeCompare(y.forecast_date) || x.order_no - y.order_no);

  const health = healthFor(account.id, rv);
  return {
    account: accountRef(account),
    health,
    status_line: statusLineFor(rv, health),
    done_last_week: doneLastWeek,
    waiting_on_you: waiting,
    upcoming_milestones: upcoming,
  };
}

function userRefOf(v: Viewer): UserRef {
  const u = v.user;
  return {
    id: u.id,
    full_name: u.full_name,
    title: u.title,
    salutation: u.salutation,
    org_type: u.org_type,
    role: u.role,
    avatar_url: u.avatar_url,
    email: u.email,
    phone: u.phone,
  };
}

/** The digest `rv` receives this week. */
export function buildWeeklyDigest(rv: Viewer): WeeklyDigest {
  const today = todayISO();
  const settings = db.settings;
  const weekOf = startOfWeek(today);
  // weekly_digest_weekday: Monday = 1 … Sunday = 0 or 7
  const offset = (((settings.weekly_digest_weekday % 7) + 6) % 7 + 7) % 7;
  const hour = String(Math.min(23, Math.max(0, Math.floor(settings.weekly_digest_hour)))).padStart(2, '0');
  const sections = digestAccounts(rv)
    .map((a) => sectionFor(a, rv, today))
    .sort((x, y) => HEALTH_ORDER[x.health.value] - HEALTH_ORDER[y.health.value] || x.account.name.localeCompare(y.account.name, 'vi'));
  return {
    recipient: userRefOf(rv),
    week_of: weekOf,
    send_at: atTime(addDays(weekOf, offset), `${hour}:00`),
    sections,
  };
}

// ───────────────────────────── email rendering ─────────────────────────────

/** every task whose title the digest mail may name (waiting lists, and the task of a status sentence) */
export function digestTaskIds(digest: WeeklyDigest): ID[] {
  const ids = new Set<ID>();
  for (const s of digest.sections) {
    for (const tv of s.waiting_on_you) ids.add(tv.id);
    for (const r of s.health.reasons) if (r.kind !== 'overdue_payment') ids.add(r.task_id);
  }
  return [...ids];
}

export function statusLineText(line: StatusLine, isClient: boolean, pronoun: string): string {
  const k = `${TPL}.digest.status`;
  switch (line.kind) {
    case 'on_track':
      return t(`${k}.on_track`);
    case 'due_soon_blocking':
      return t(`${k}.due_soon_blocking`, { count: line.count, milestone: line.milestone_name });
    case 'overdue':
      return t(`${k}.overdue`, { count: line.count });
    case 'payment_overdue':
      return t(`${k}.payment_overdue`, { count: line.count });
    case 'waiting_client':
      return t(`${k}.waiting_client.${isClient ? 'client' : 'internal'}`, {
        milestone: line.milestone_name,
        count: line.count,
        delay: line.delay_days,
        pronoun,
      });
    case 'waiting_internal':
      return line.task_title
        ? t(`${k}.waiting_internal`, { milestone: line.milestone_name, delay: line.delay_days, task: line.task_title })
        : t(`${k}.waiting_internal_hidden`, { milestone: line.milestone_name, delay: line.delay_days });
    case 'generic':
      return t(`${k}.generic.${line.tone}`);
  }
}

export function digestEmailText(digest: WeeklyDigest, user: User, link: string): string {
  const isClient = user.org_type === 'client';
  const { pronoun } = addressingOf(user);
  const lines: string[] = [t(`${TPL}.digest.intro`, { week: fmtDate(digest.week_of) })];
  if (digest.sections.length === 0) lines.push('', t(`${TPL}.digest.empty`));
  for (const s of digest.sections) {
    lines.push('', t(`${TPL}.digest.section`, { account: s.account.name, health: t(`enums.health.${s.health.value}`) }));
    lines.push(statusLineText(s.status_line, isClient, pronoun));
    lines.push(t(`${TPL}.digest.done`, { count: s.done_last_week.length }));
    lines.push(t(isClient ? `${TPL}.digest.waitingClient` : `${TPL}.digest.waitingInternal`, { count: s.waiting_on_you.length, pronoun }));
    for (const tv of s.waiting_on_you.slice(0, EMAIL_ITEMS)) {
      lines.push(t(`${TPL}.digest.item`, { title: tv.title, due: fmtDay(tv.due_date), relative: dueRelative(tv.due) }));
    }
    if (s.waiting_on_you.length > EMAIL_ITEMS) lines.push(t(`${TPL}.digest.more`, { count: s.waiting_on_you.length - EMAIL_ITEMS }));
    if (s.upcoming_milestones.length === 0) {
      lines.push(t(`${TPL}.digest.noMilestone`));
    } else {
      lines.push(t(`${TPL}.digest.milestones`));
      for (const m of s.upcoming_milestones) {
        const key = m.forecast_date !== m.planned_date ? `${TPL}.digest.milestone` : `${TPL}.digest.milestoneOnPlan`;
        lines.push(t(key, { name: m.name, planned: fmtDay(m.planned_date), forecast: fmtDay(m.forecast_date) }));
      }
    }
  }
  return composeEmailBody(user, lines.join('\n'), link, `${TPL}.digest.open`);
}
