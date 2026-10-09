// Weekly digest ("Bản tin tuần", SPEC §6): the model shown on /app/digest and the plain-text email body.
// Built for a RECIPIENT viewer (not necessarily the current one), so every view is filtered as they would see it.

import type { Account, Health, ID, ISODate, ISODateTime, Stage, Task, User } from '@/domain/types';
import type { DigestCareBrief, DigestRequestLine, DigestSection, StatusLine, TaskView, UserRef, Viewer, WeeklyDigest } from './contract';
import { compareCrs, isDeliveryDebt, isOpenCr, isUndated, isUntriaged } from '@/domain/care';
import { accountCrs, careStatusFor, crRollupFor } from './careData';
import { atTime, dateOf, nowISO, todayISO } from '@/domain/clock';
import { addDays, startOfWeek } from '@/domain/dates';
import { compareClientTasks } from '@/domain/taskRules';
import { t } from '@/i18n';
import { db } from './db';
import { accessibleAccountIds, toUserRef } from './context';
import {
  accountRef,
  canViewTask,
  clientShouldAct,
  graphForAccount,
  healthFor,
  milestoneView,
  statusLineFor,
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

/**
 * Accounts a bulletin reports on: a delivery stage AND at least one project. A prospect, or a deal still being
 * negotiated without a project, has no plan to be "on track" against and would only add empty sections.
 */
function digestEligibleAccounts(): Account[] {
  const withProject = new Set(db.rows('projects').map((p) => p.account_id));
  return db.rows('accounts').filter((a) => DIGEST_STAGES.includes(a.stage) && withProject.has(a.id));
}

/** C-level recipients of the Monday bulletin: directors, AMs with active accounts, decision makers of active accounts. */
export function digestRecipients(): User[] {
  const accounts = digestEligibleAccounts();
  return db.rows('users').filter((u) => {
    if (u.status !== 'active') return false;
    switch (u.role) {
      case 'director':
        return true;
      case 'am':
        return accounts.some((a) => a.am_id === u.id);
      case 'client_owner':
        return accounts.some((a) => a.id === u.account_id);
      case 'member':
      case 'client_member':
        return false;
    }
  });
}

function digestAccounts(rv: Viewer): Account[] {
  const accounts = digestEligibleAccounts();
  switch (rv.role) {
    case 'client_owner':
    case 'client_member':
      return accounts.filter((a) => a.id === rv.account_id);
    case 'am':
      return accounts.filter((a) => a.am_id === rv.user.id);
    case 'director':
      return accounts;
    case 'member': {
      const ids = accessibleAccountIds(rv);
      return accounts.filter((a) => ids.has(a.id));
    }
  }
}

/** internal: open work waiting on New Era — own tasks, or everything for the AM / director */
function isWaitingOnInternal(task: Task, rv: Viewer): boolean {
  if (task.waiting_on !== 'internal') return false;
  return task.assignee_id === rv.user.id || rv.role === 'am' || rv.role === 'director';
}

function compareByDue(a: TaskView, b: TaskView): number {
  return a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'vi');
}

/**
 * The account's open change requests as the recipient reads them: a client sees their company's own requests in client
 * wording (never New Era's internal proposals, never a flag), a late promise first, then the promised date; New Era
 * sees every open request in the list order of the app (debt → waiting → undated …) with its flag.
 */
function requestLines(account: Account, rv: Viewer, today: ISODate): DigestRequestLine[] {
  const isClient = rv.org_type === 'client';
  const open = accountCrs(account.id).filter((cr) => isOpenCr(cr.status) && (!isClient || cr.source !== 'internal'));
  const late = (d: ISODate | null): boolean => !!d && d < today;
  const sorted = isClient
    ? open.sort(
        (a, b) =>
          Number(late(b.promised_date)) - Number(late(a.promised_date)) ||
          (a.promised_date ?? '9999').localeCompare(b.promised_date ?? '9999') ||
          a.received_at.localeCompare(b.received_at),
      )
    : open.sort((a, b) => compareCrs(a, b, today));
  return sorted.map((cr) => ({
    id: cr.id,
    code: cr.code,
    title: cr.title,
    status_label: t(isClient ? `care.crStatusClient.${cr.status}` : `care.crStatus.${cr.status}`),
    promised_date: cr.promised_date,
    late: late(cr.promised_date),
    flag: isClient ? null : isDeliveryDebt(cr, today) ? 'debt' : isUntriaged(cr, today) ? 'untriaged' : isUndated(cr, today) ? 'undated' : null,
  }));
}

/** the director's / AM's care figures of the account (members and clients get none: SPEC-CARE §5) */
function careBrief(account: Account, rv: Viewer, today: ISODate): DigestCareBrief | null {
  if (rv.org_type !== 'internal' || (rv.role !== 'director' && rv.role !== 'am')) return null;
  const rollup = crRollupFor(account.id, today);
  const care = careStatusFor(account, today);
  return {
    debt: rollup.debt,
    untriaged: rollup.untriaged,
    undated: rollup.undated,
    care_status: care.status,
    care_status_label: t(`care.careStatus.${care.status}`),
    next_action: care.plan.next_action,
    next_action_due: care.plan.next_action_due,
  };
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
    // same sentence as the client home (headline rule, override, whose task the milestone waits on)
    status_line: statusLineFor(account.id, rv),
    done_last_week: doneLastWeek,
    waiting_on_you: waiting,
    upcoming_milestones: upcoming,
    requests: requestLines(account, rv, today),
    care_brief: careBrief(account, rv, today),
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

/**
 * The bulletin's send slot: this week's (settings weekday + hour) or, with `upcoming` once that slot has passed, next
 * week's — a preview never carries a date in the past while its content runs to today.
 */
function sendSlot(today: ISODate, upcoming: boolean): { weekOf: ISODate; sendAt: ISODateTime } {
  const settings = db.settings;
  // weekly_digest_weekday: Monday = 1 … Sunday = 0 or 7
  const offset = (((settings.weekly_digest_weekday % 7) + 6) % 7 + 7) % 7;
  const hour = String(Math.min(23, Math.max(0, Math.floor(settings.weekly_digest_hour)))).padStart(2, '0');
  const thisWeek = startOfWeek(today);
  const slot = atTime(addDays(thisWeek, offset), `${hour}:00`);
  if (!upcoming || nowISO() < slot) return { weekOf: thisWeek, sendAt: slot };
  const nextWeek = addDays(thisWeek, 7);
  return { weekOf: nextWeek, sendAt: atTime(addDays(nextWeek, offset), `${hour}:00`) };
}

/**
 * The digest `rv` gets: the preview of the NEXT bulletin (`when` 'upcoming', default — the content is as of now) or the
 * one sent in this week's slot ('current', the Monday send of notifyEngine).
 */
export function buildWeeklyDigest(rv: Viewer, when: 'upcoming' | 'current' = 'upcoming'): WeeklyDigest {
  const today = todayISO();
  const { weekOf, sendAt } = sendSlot(today, when === 'upcoming');
  const sections = digestAccounts(rv)
    .map((a) => sectionFor(a, rv, today))
    .sort((x, y) => HEALTH_ORDER[x.health.value] - HEALTH_ORDER[y.health.value] || x.account.name.localeCompare(y.account.name, 'vi'));
  return {
    recipient: userRefOf(rv),
    week_of: weekOf,
    send_at: sendAt,
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
    case 'waiting_client': {
      // a client reads "từ phía anh" only for their own tasks; a colleague is named ("từ chị Lan (Cỏ Xanh)")
      const who = isClient ? line.waiting_for : undefined;
      const variant = !isClient ? 'internal' : !who ? 'client' : who.name ? 'person' : 'company';
      return t(`${k}.waiting_client.${variant}`, {
        milestone: line.milestone_name,
        count: line.count,
        delay: line.delay_days,
        pronoun,
        name: who?.name ?? '',
        company: who?.company ?? '',
      });
    }
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
    lines.push(...requestEmailLines(s, isClient, pronoun));
  }
  return composeEmailBody(user, lines.join('\n'), link, `${TPL}.digest.open`);
}

/** "Yêu cầu & chăm sóc" of one section: the care rhythm (director / AM), the open requests and the first few of them */
function requestEmailLines(s: DigestSection, isClient: boolean, pronoun: string): string[] {
  const out: string[] = [];
  const b = s.care_brief;
  if (b) {
    out.push(
      b.next_action && b.next_action_due
        ? t(`${TPL}.digest.careNext`, { status: b.care_status_label, action: b.next_action, due: fmtDay(b.next_action_due) })
        : t(`${TPL}.digest.careLine`, { status: b.care_status_label }),
    );
  }
  if (s.requests.length === 0) {
    out.push(t(isClient ? `${TPL}.digest.noRequestsClient` : `${TPL}.digest.noRequests`, { pronoun }));
    return out;
  }
  const flags = b
    ? [
        b.debt > 0 ? t(`${TPL}.digest.flagDebt`, { count: b.debt }) : '',
        b.untriaged > 0 ? t(`${TPL}.digest.flagUntriaged`, { count: b.untriaged }) : '',
        b.undated > 0 ? t(`${TPL}.digest.flagUndated`, { count: b.undated }) : '',
      ].filter(Boolean)
    : [];
  out.push(
    t(isClient ? `${TPL}.digest.requestsClient` : `${TPL}.digest.requestsInternal`, { count: s.requests.length, pronoun }) +
      (flags.length > 0 ? t(`${TPL}.digest.requestsFlags`, { parts: flags.join(', ') }) : ''),
  );
  for (const r of s.requests.slice(0, EMAIL_ITEMS)) {
    const date = r.promised_date
      ? t(!isClient && r.late ? `${TPL}.digest.requestDateLate` : `${TPL}.digest.requestDate`, { date: fmtDay(r.promised_date) })
      : '';
    out.push(t(`${TPL}.digest.requestItem`, { code: r.code, title: r.title, status: r.status_label, date }));
  }
  if (s.requests.length > EMAIL_ITEMS) out.push(t(`${TPL}.digest.requestsMore`, { count: s.requests.length - EMAIL_ITEMS }));
  return out;
}
