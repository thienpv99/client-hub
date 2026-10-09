// Read endpoints: director dashboard, accounts, projects, tasks, activities, files, contacts, users,
// client portal home and quick search. Everything is built through views.ts for the current viewer.

import type { Account, ActivityAction, ID, ISODate, Task } from '@/domain/types';
import {
  ApiError,
  type AccountFilter,
  type ActivityView,
  type Api,
  type AttentionItem,
  type DirectorDashboard,
  type PortalHome,
  type SearchResult,
  type TaskFilter,
  type TaskView,
  type UserRef,
  type Viewer,
} from '@/services/contract';
import { dateOf, todayISO } from '@/domain/clock';
import { addDays, endOfWeek } from '@/domain/dates';
import { addressName } from '@/domain/naming';
import { paymentOverdueDays } from '@/domain/payments';
import { compareClientTasks, dueInfo } from '@/domain/taskRules';
import { normalizeText } from '@/lib/utils';
import { t } from '@/i18n';
import { canAccessCommercial, cashflowForYear, overduePayments, quotesPendingApproval, quoteSummary } from '@/services/commercialViews';
import { noAccess, requireViewer, toUserRef } from '@/services/context';
import { crmSearchEntries, isCrmViewer } from '@/services/crmViews';
import { db } from '@/services/db';
import { isCrmActivity } from '@/services/sanitize';
import {
  accessibleIds,
  accountDetail,
  accountIdOfProject,
  accountProjects,
  accountRef,
  accountSummary,
  accountTasks,
  activityProjectId,
  activityView,
  canViewTask,
  clientShouldAct,
  compareContacts,
  contactView,
  countsFor,
  graphForAccount,
  groupFileVersions,
  headlineFor,
  healthFor,
  isClientViewer,
  isQuoteTaskEcho,
  newestFirst,
  nonNull,
  projectView,
  statusLineFor,
  taskDetail,
  taskMentionVisible,
  taskView,
  userRefAny,
} from '@/services/views';

const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');

const HEALTH_ORDER = { blocked: 0, attention: 1, on_track: 2 } as const;

const APPROVAL_ACTIONS: ReadonlySet<ActivityAction> = new Set<ActivityAction>([
  'task.approved',
  'task.changes_requested',
  'quote.accepted',
  'quote.changes_requested',
  'quote.approved',
  'quote.approval_rejected',
]);

function assertAccess(v: Viewer, accountId: ID): Account {
  const account = db.find('accounts', accountId);
  if (!account) throw notFound();
  if (!accessibleIds(v).has(accountId)) throw noAccess(v);
  return account;
}

/**
 * Internal viewers: forbidden for a task of an account they cannot read. Clients: not_found for another company's
 * task as for a hidden or unknown one (no id probing). Hidden from this viewer: not_found.
 */
export function assertTaskVisible(task: Task, v: Viewer): void {
  if (canViewTask(task, v)) return;
  const accountId = accountIdOfProject(task.project_id);
  if (accountId && !accessibleIds(v).has(accountId)) throw noAccess(v);
  throw notFound();
}

// ───────────────────────────── tasks query (shared with portal home) ─────────────────────────────

export function queryTasks(v: Viewer, filter: TaskFilter = {}): TaskView[] {
  const ids = accessibleIds(v);
  if (filter.accountId && !ids.has(filter.accountId)) {
    if (!db.find('accounts', filter.accountId)) throw notFound();
    throw noAccess(v);
  }
  const client = isClientViewer(v);
  const openOnly = filter.openOnly ?? true;
  const q = filter.search ? normalizeText(filter.search) : '';
  const me = v.user.id;
  const out: TaskView[] = [];
  for (const task of db.rows('tasks')) {
    const accountId = accountIdOfProject(task.project_id);
    if (!accountId || !ids.has(accountId)) continue;
    if (filter.accountId && accountId !== filter.accountId) continue;
    if (filter.projectId && task.project_id !== filter.projectId) continue;
    if (filter.milestoneId && task.milestone_id !== filter.milestoneId) continue;
    if (filter.side && task.side !== filter.side) continue;
    if (filter.assigneeId && task.assignee_id !== filter.assigneeId) continue;
    if (filter.waitingOn && task.waiting_on !== filter.waitingOn) continue;
    if ((openOnly || filter.mine) && task.status === 'done') continue;
    if (!canViewTask(task, v)) continue;
    if (q && !normalizeText(task.title).includes(q)) continue;
    if (filter.delegatedByMe && !(task.delegated_by === me && task.assignee_id !== me)) continue;
    if (filter.mine && !(client ? clientShouldAct(task, v) : task.assignee_id === me)) continue;
    const view = taskView(task, v);
    if (filter.mine && client && view.blocked) continue;
    if (filter.overdue && !view.due.overdue) continue;
    if (filter.blocking && !view.is_blocking_milestone) continue;
    if (filter.blocked && !view.blocked) continue;
    out.push(view);
  }
  if (client) return out.sort(compareClientTasks);
  return out.sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.priority_rank - b.priority_rank || a.title.localeCompare(b.title, 'vi'),
  );
}

// ───────────────────────────── director dashboard ─────────────────────────────

interface Candidate {
  item: AttentionItem;
  magnitude: number;
}

const KIND_ORDER: Record<AttentionItem['kind'], number> = {
  client_overdue_blocking: 0,
  internal_overdue_blocking: 1,
  escalation: 2,
  quote_pending_approval: 3,
  payment_overdue: 4,
  due_soon_blocking: 5,
  quote_changes_requested: 6,
  internal_overdue: 7,
};

function firstHeldMilestone(task: Task): { id: ID; name: string } | null {
  const accountId = accountIdOfProject(task.project_id);
  if (!accountId) return null;
  const held = graphForAccount(accountId).milestonesHeldBy(task.id);
  if (!held.length) return null;
  const first = [...held].sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.order_no - b.order_no)[0];
  return { id: first.id, name: first.name };
}

function attentionItems(accounts: Account[], v: Viewer, ids: Set<ID>): AttentionItem[] {
  const today = todayISO();
  const out: Candidate[] = [];
  const listedTasks = new Set<ID>();

  for (const a of accounts) {
    const g = graphForAccount(a.id);
    const account = accountRef(a);
    for (const task of accountTasks(a.id)) {
      if (task.status === 'done' || g.isBlocked(task.id)) continue;
      const due = dueInfo(task.due_date, false, today);
      if (!due.overdue && !due.due_soon) continue;
      const held = firstHeldMilestone(task);
      const base = { account, task_id: task.id };
      if (task.side === 'client' && task.waiting_on === 'client' && held) {
        if (due.overdue) {
          const headline = headlineFor(held.id, v);
          listedTasks.add(task.id);
          out.push({
            item: {
              ...base,
              id: `client_overdue_blocking:${task.id}`,
              severity: 1,
              kind: 'client_overdue_blocking',
              milestone_id: held.id,
              params: { account: a.name, task: task.title, milestone: headline.name || held.name, days: due.overdue_days },
              actions: ['remind_client', 'open_account'],
            },
            magnitude: due.overdue_days,
          });
        } else {
          out.push({
            item: {
              ...base,
              id: `due_soon_blocking:${task.id}`,
              severity: 3,
              kind: 'due_soon_blocking',
              milestone_id: held.id,
              params: { account: a.name, task: task.title, milestone: held.name, days: due.days_left },
              actions: ['remind_client', 'open_account'],
            },
            magnitude: 4 - due.days_left,
          });
        }
      } else if (task.side === 'internal' && due.overdue) {
        if (held) {
          const headline = headlineFor(held.id, v);
          listedTasks.add(task.id);
          out.push({
            item: {
              ...base,
              id: `internal_overdue_blocking:${task.id}`,
              severity: 1,
              kind: 'internal_overdue_blocking',
              milestone_id: held.id,
              params: { account: a.name, task: task.title, milestone: headline.name || held.name, days: due.overdue_days },
              actions: ['open_task', 'open_account'],
            },
            magnitude: due.overdue_days,
          });
        } else {
          out.push({
            item: {
              ...base,
              id: `internal_overdue:${task.id}`,
              severity: 3,
              kind: 'internal_overdue',
              params: { account: a.name, task: task.title, days: due.overdue_days },
              actions: ['open_task'],
            },
            magnitude: due.overdue_days,
          });
        }
      }
    }
  }

  // escalations sent in the last 7 days that are not already listed above
  const since = addDays(today, -7);
  for (const act of db.rows('activities')) {
    if (act.action !== 'escalation.sent' || !act.account_id || !ids.has(act.account_id)) continue;
    if (dateOf(act.created_at) < since) continue;
    const taskId = act.target_type === 'task' ? act.target_id : typeof act.params.task_id === 'string' ? act.params.task_id : null;
    if (!taskId || listedTasks.has(taskId)) continue;
    const task = db.find('tasks', taskId);
    const a = db.find('accounts', act.account_id);
    if (!task || !a || task.status === 'done') continue;
    // a blocked task is not the one to chase: its blocker carries the responsibility
    if (graphForAccount(a.id).isBlocked(task.id)) continue;
    listedTasks.add(taskId);
    const due = dueInfo(task.due_date, false, today);
    out.push({
      item: {
        id: `escalation:${taskId}`,
        severity: 1,
        kind: 'escalation',
        account: accountRef(a),
        task_id: taskId,
        params: { account: a.name, task: task.title, days: due.overdue_days },
        actions: ['remind_client', 'open_account'],
      },
      magnitude: due.overdue_days,
    });
  }

  for (const q of quotesPendingApproval(ids)) {
    const a = db.find('accounts', q.account_id);
    if (!a) continue;
    const summary = quoteSummary(q, v);
    out.push({
      item: {
        id: `quote_pending_approval:${q.id}`,
        severity: 2,
        kind: 'quote_pending_approval',
        account: accountRef(a),
        quote_id: q.id,
        params: {
          account: a.name,
          version: q.version,
          discount: Math.round(summary.effective_discount_pct),
          amount: summary.grand_total,
        },
        actions: v.role === 'director' ? ['approve_quote', 'view_quote'] : ['view_quote'],
      },
      magnitude: summary.grand_total,
    });
  }

  for (const p of overduePayments(ids)) {
    const contract = db.find('contracts', p.contract_id);
    const a = contract ? db.find('accounts', contract.account_id) : undefined;
    if (!a) continue;
    out.push({
      item: {
        id: `payment_overdue:${p.id}`,
        severity: 2,
        kind: 'payment_overdue',
        account: accountRef(a),
        payment_id: p.id,
        params: { account: a.name, payment: p.name, amount: p.amount, days: paymentOverdueDays(p, today) },
        actions: ['view_receivables', 'open_account'],
      },
      magnitude: p.amount,
    });
  }

  const quotes = db.rows('quotes').filter((q) => ids.has(q.account_id));
  for (const q of quotes) {
    if (q.status !== 'changes_requested') continue;
    if (quotes.some((o) => o.code === q.code && o.version > q.version)) continue;
    const a = db.find('accounts', q.account_id);
    if (!a) continue;
    out.push({
      item: {
        id: `quote_changes_requested:${q.id}`,
        severity: 3,
        kind: 'quote_changes_requested',
        account: accountRef(a),
        quote_id: q.id,
        params: { account: a.name, version: q.version, quote: q.title, note: q.client_note ?? '' },
        actions: ['view_quote'],
      },
      magnitude: 0,
    });
  }

  return out
    .sort(
      (x, y) =>
        x.item.severity - y.item.severity ||
        y.magnitude - x.magnitude ||
        KIND_ORDER[x.item.kind] - KIND_ORDER[y.item.kind] ||
        x.item.id.localeCompare(y.item.id),
    )
    .slice(0, 7)
    .map((c) => c.item);
}

function sortAccounts<T extends { name: string; health: { value: keyof typeof HEALTH_ORDER } }>(list: T[]): T[] {
  return list.sort((a, b) => HEALTH_ORDER[a.health.value] - HEALTH_ORDER[b.health.value] || a.name.localeCompare(b.name, 'vi'));
}

// ───────────────────────────── portal home helpers ─────────────────────────────

function pickNewEraWorking(tasks: TaskView[], today: ISODate): TaskView[] {
  const weekEnd = endOfWeek(today);
  const bucket = (x: TaskView): number => (x.due.overdue ? 0 : x.due_date <= weekEnd ? 1 : 2);
  const sorted = [...tasks].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    if (ba === 0) return b.due.overdue_days - a.due.overdue_days;
    return a.due_date.localeCompare(b.due_date);
  });
  const thisWeek = sorted.filter((x) => bucket(x) < 2).length;
  return sorted.slice(0, Math.max(3, Math.min(5, thisWeek)));
}

/** results returned by search (the palette shows the first few per group and says how many more there are) */
const SEARCH_LIMIT = 40;

function searchScore(text: string, q: string): number {
  const n = normalizeText(text);
  if (n.startsWith(q)) return 0;
  if (n.includes(` ${q}`)) return 1;
  return n.includes(q) ? 2 : -1;
}

// ───────────────────────────── endpoints ─────────────────────────────

export const readsApi: Pick<
  Api,
  | 'getDirectorDashboard'
  | 'listAccounts'
  | 'getAccount'
  | 'listProjects'
  | 'listTasks'
  | 'getTask'
  | 'listActivities'
  | 'listFiles'
  | 'listContacts'
  | 'listUsers'
  | 'getPortalHome'
  | 'search'
> = {
  async getDirectorDashboard(): Promise<DirectorDashboard> {
    const v = requireViewer();
    if (v.org_type !== 'internal' || (v.role !== 'director' && v.role !== 'am')) throw forbidden();
    const ids = accessibleIds(v);
    const accounts = db.rows('accounts').filter((a) => ids.has(a.id));
    const summaries = sortAccounts(accounts.map((a) => accountSummary(a, v)));
    const active = summaries.filter((s) => s.stage === 'implementing' || s.stage === 'operating');
    const year = todayISO().slice(0, 4);
    const signed = db
      .rows('contracts')
      .filter((c) => ids.has(c.account_id) && c.signed_date !== null && c.signed_date.slice(0, 4) === year);
    return {
      kpis: {
        accounts_at_risk: {
          blocked: active.filter((s) => s.health.value === 'blocked').length,
          attention: active.filter((s) => s.health.value === 'attention').length,
          active_total: active.length,
        },
        overdue_tasks: {
          client: summaries.reduce((sum, s) => sum + s.counts.overdue_client, 0),
          internal: summaries.reduce((sum, s) => sum + s.counts.overdue_internal, 0),
        },
        contract_value_ytd: signed.reduce((sum, c) => sum + c.value, 0),
        contract_count_ytd: signed.length,
        receivable: {
          total: summaries.reduce((sum, s) => sum + s.receivable, 0),
          overdue: summaries.reduce((sum, s) => sum + s.receivable_overdue, 0),
        },
      },
      attention: attentionItems(accounts, v, ids),
      accounts: summaries,
      cashflow: cashflowForYear(Number(year), ids),
    };
  },

  async listAccounts(filter?: AccountFilter) {
    const v = requireViewer();
    const f = filter ?? {};
    const ids = accessibleIds(v);
    const q = f.search ? normalizeText(f.search) : '';
    const list = db
      .rows('accounts')
      .filter((a) => ids.has(a.id))
      .filter((a) => !f.amId || a.am_id === f.amId)
      .filter((a) => !q || normalizeText(`${a.name} ${a.short_name} ${a.industry}`).includes(q))
      .map((a) => accountSummary(a, v))
      .filter((s) => !f.health || s.health.value === f.health)
      .filter((s) => !f.waitingClient || s.counts.waiting_client > 0)
      .filter((s) => !f.overdueReceivable || s.receivable_overdue > 0);
    return sortAccounts(list);
  },

  async getAccount(id: ID) {
    const v = requireViewer();
    return accountDetail(assertAccess(v, id), v);
  },

  async listProjects(accountId: ID) {
    const v = requireViewer();
    assertAccess(v, accountId);
    return accountProjects(accountId).map((p) => projectView(p, v));
  },

  async listTasks(filter?: TaskFilter) {
    const v = requireViewer();
    return queryTasks(v, filter ?? {});
  },

  async getTask(id: ID) {
    const v = requireViewer();
    const task = db.find('tasks', id);
    if (!task) throw notFound();
    assertTaskVisible(task, v);
    return taskDetail(task, v);
  },

  async listActivities(params) {
    const v = requireViewer();
    let accountScope: ID | null = null;
    if (params.accountId) {
      assertAccess(v, params.accountId);
      accountScope = params.accountId;
    }
    let taskId: ID | null = null;
    if (params.taskId) {
      const task = db.find('tasks', params.taskId) ?? db.allRows('tasks').find((x) => x.id === params.taskId);
      if (!task) throw notFound();
      const accountId = accountIdOfProject(task.project_id);
      if (!accountId || !accessibleIds(v).has(accountId)) throw noAccess(v);
      // deleted tasks keep their history; otherwise the task rules of canViewTask apply
      if (isClientViewer(v) && !taskMentionVisible(task.id, v)) throw notFound();
      taskId = task.id;
    }
    const limit = params.limit && params.limit > 0 ? params.limit : 100;
    // CRM lines (deals, leads, touchpoints) are for the director / AMs only; skip them before the limit so a
    // member's feed still gets `limit` rows (sanitizeOutgoing drops them too, as defence in depth)
    const crmVisible = isCrmViewer(v);
    const out: ActivityView[] = [];
    for (const a of [...db.rows('activities')].sort(newestFirst)) {
      if (accountScope && a.account_id !== accountScope) continue;
      if (!crmVisible && isCrmActivity(a)) continue;
      if (taskId && !((a.target_type === 'task' && a.target_id === taskId) || a.params.task_id === taskId)) continue;
      if (params.approvalsOnly && !APPROVAL_ACTIONS.has(a.action)) continue;
      // one decision, one line: drop the task twin of a quote decision (task histories keep it)
      if (!taskId && (params.approvalsOnly || isClientViewer(v)) && isQuoteTaskEcho(a)) continue;
      const view = activityView(a, v);
      if (!view) continue;
      out.push(view);
      if (out.length >= limit) break;
    }
    return out;
  },

  async listFiles(params) {
    const v = requireViewer();
    if (params.taskId) {
      const task = db.find('tasks', params.taskId);
      if (!task) throw notFound();
      assertTaskVisible(task, v);
      return groupFileVersions(
        db.rows('files').filter((f) => f.task_id === task.id),
        v,
      );
    }
    if (params.accountId) {
      assertAccess(v, params.accountId);
      const accountId = params.accountId;
      return groupFileVersions(
        db.rows('files').filter((f) => f.account_id === accountId),
        v,
      );
    }
    const ids = accessibleIds(v);
    return groupFileVersions(
      db.rows('files').filter((f) => ids.has(f.account_id)),
      v,
    );
  },

  async listContacts(accountId: ID) {
    const v = requireViewer();
    assertAccess(v, accountId);
    return db
      .rows('contacts')
      .filter((c) => c.account_id === accountId)
      .map((c) => contactView(c, v))
      .sort(compareContacts);
  },

  async listUsers(params) {
    const v = requireViewer();
    const p = params ?? {};
    const byName = (a: UserRef, b: UserRef): number => a.full_name.localeCompare(b.full_name, 'vi');
    if (isClientViewer(v)) {
      return db
        .rows('users')
        .filter((u) => u.org_type === 'client' && u.account_id === v.account_id)
        .filter((u) => u.status === 'active' || u.status === 'invited')
        .filter((u) => !p.role || u.role === p.role)
        .map(toUserRef)
        .sort(byName);
    }
    const ids = accessibleIds(v);
    if (p.accountId && !ids.has(p.accountId)) throw forbidden();
    return db
      .rows('users')
      .filter((u) => u.status !== 'disabled')
      .filter((u) => !p.orgType || u.org_type === p.orgType)
      .filter((u) => !p.role || u.role === p.role)
      .filter((u) => !p.accountId || u.account_id === p.accountId)
      .filter((u) => u.org_type === 'internal' || (u.account_id !== null && ids.has(u.account_id)))
      .map(toUserRef)
      .sort(byName);
  },

  async getPortalHome(params): Promise<PortalHome> {
    const v = requireViewer();
    if (v.org_type !== 'client' || !v.account_id) throw forbidden();
    const accountId = v.account_id;
    const account = db.find('accounts', accountId);
    if (!account) throw notFound();
    const projects = accountProjects(accountId);
    const projectId = params?.projectId ?? undefined;
    if (projectId && !projects.some((p) => p.id === projectId)) throw notFound();

    const today = todayISO();
    const me = v.user.id;
    const owner = v.role === 'client_owner';
    const scope: TaskFilter = { accountId, projectId };

    const myTasks = queryTasks(v, { ...scope, mine: true });
    const weekEnd = endOfWeek(today);
    const recentDone = addDays(today, -14);
    const delegated = owner
      ? queryTasks(v, { ...scope, delegatedByMe: true, openOnly: false }).filter(
          (x) => x.status !== 'done' || (x.completed_at !== null && dateOf(x.completed_at) >= recentDone),
        )
      : [];
    // the decision maker follows every submission of the company; a member only their own
    const waitingNewEra = queryTasks(v, { ...scope, side: 'client', waitingOn: 'internal' }).filter(
      (x) => owner || (x.assignee !== null && x.assignee.id === me),
    );
    const newEra = pickNewEraWorking(queryTasks(v, { ...scope, side: 'internal' }), today);
    // project selector: that project's news + the account-wide ones (no other project's events)
    const updates = db
      .rows('activities')
      .filter((a) => a.account_id === accountId && !isQuoteTaskEcho(a))
      .filter((a) => {
        if (!projectId) return true;
        const of = activityProjectId(a);
        return of === null || of === projectId;
      })
      .sort(newestFirst)
      .map((a) => activityView(a, v))
      .filter(nonNull)
      .slice(0, 8);

    const health = healthFor(accountId, v, { projectId });
    const status_line = statusLineFor(accountId, v, { projectId });
    const user: UserRef = {
      id: v.user.id,
      full_name: v.user.full_name,
      title: v.user.title,
      salutation: v.user.salutation,
      org_type: v.user.org_type,
      role: v.user.role,
      avatar_url: v.user.avatar_url,
      email: v.user.email,
      phone: v.user.phone,
    };
    return {
      viewer: {
        user,
        role: v.role,
        salutation: v.user.salutation,
        address_name: addressName(v.user.salutation, v.user.full_name),
      },
      account: { ...accountRef(account), exec_summary: account.exec_summary, email_domain: account.email_domain },
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      health,
      status_line,
      my_tasks: myTasks,
      week_count: myTasks.filter((x) => x.due_date <= weekEnd).length,
      delegated_tasks: delegated,
      waiting_new_era: waitingNewEra,
      progress: (projectId ? projects.filter((p) => p.id === projectId) : projects).map((p) => projectView(p, v)),
      new_era_working: newEra,
      updates,
      counts: countsFor(accountId, v, { projectId }),
      am: userRefAny(account.am_id),
    };
  },

  async search(query: string) {
    const v = requireViewer();
    const q = normalizeText(query);
    if (!q) return [];
    const client = isClientViewer(v);
    const ids = accessibleIds(v);
    const scored: { r: SearchResult; score: number; order: number; urgency: number }[] = [];
    /** urgency: lower first — an open overdue task that holds a milestone outranks a plain prefix match */
    const add = (r: SearchResult, text: string, order: number, urgency = 1): void => {
      const score = searchScore(text, q);
      if (score >= 0) scored.push({ r, score: score + (urgency - 1), order, urgency });
    };

    for (const a of db.rows('accounts')) {
      if (!ids.has(a.id)) continue;
      const am = db.find('users', a.am_id);
      add(
        {
          type: 'account',
          id: a.id,
          title: a.name,
          subtitle: [a.industry, am ? am.full_name : ''].filter(Boolean).join(' · '),
          href: client ? '/portal' : `/app/accounts/${a.id}`,
        },
        `${a.name} ${a.short_name}`,
        0,
      );
    }

    const today = todayISO();
    for (const task of db.rows('tasks')) {
      const accountId = accountIdOfProject(task.project_id);
      if (!accountId || !ids.has(accountId) || !canViewTask(task, v)) continue;
      const a = db.find('accounts', accountId);
      const project = db.find('projects', task.project_id);
      const open = task.status !== 'done';
      const overdue = open && today > task.due_date;
      const holding = overdue && graphForAccount(accountId).milestonesHeldBy(task.id).length > 0;
      add(
        {
          type: 'task',
          id: task.id,
          title: task.title,
          subtitle: [a ? a.name : '', project ? project.name : ''].filter(Boolean).join(' · '),
          href: client ? `/portal/tasks/${task.id}` : `/app/accounts/${accountId}/tasks?task=${task.id}`,
        },
        task.title,
        1,
        // overdue & holding a milestone → 0 (one rank up), other open → 1, done → 2 (one rank down)
        holding ? 0 : open ? 1 : 2,
      );
    }

    if (canAccessCommercial(v)) {
      const clientStatuses = new Set(['sent', 'accepted', 'changes_requested', 'expired']);
      for (const quote of db.rows('quotes')) {
        if (!ids.has(quote.account_id)) continue;
        if (client && !clientStatuses.has(quote.status)) continue;
        const summary = quoteSummary(quote, v);
        add(
          {
            type: 'quote',
            id: quote.id,
            title: summary.title,
            subtitle: [`${summary.code} v${summary.version}`, summary.account.name].join(' · '),
            href: client ? `/portal/commercial/quotes/${quote.id}` : `/app/commercial/quotes/${quote.id}`,
          },
          `${summary.title} ${summary.code}`,
          2,
        );
      }
    }

    if (!client) {
      for (const c of db.rows('contacts')) {
        if (!ids.has(c.account_id)) continue;
        const a = db.find('accounts', c.account_id);
        add(
          {
            type: 'contact',
            id: c.id,
            title: c.full_name,
            subtitle: [c.title, a ? a.name : ''].filter(Boolean).join(' · '),
            // the "Quan hệ" tab, opened on that person (the old /contacts path only bounced there without the person)
            href: `/app/accounts/${c.account_id}/relationships?contact=${encodeURIComponent(c.id)}`,
          },
          `${c.full_name} ${c.email}`,
          3,
        );
      }
    }

    if (!client) {
      // client care (SPEC-CARE): a request by its code ("YC-03") or words, and a deployed solution by its name — the
      // internal viewer's own accounts only (members included: they read requests and solutions too)
      for (const cr of db.rows('change_requests')) {
        if (!ids.has(cr.account_id)) continue;
        const a = db.find('accounts', cr.account_id);
        add(
          {
            type: 'request',
            id: cr.id,
            title: cr.title,
            subtitle: [cr.code, a ? a.name : '', t(`care.crStatus.${cr.status}`)].filter(Boolean).join(' · '),
            href: `/app/accounts/${cr.account_id}/delivery?cr=${encodeURIComponent(cr.id)}`,
          },
          `${cr.code} ${cr.title}`,
          2,
          cr.status === 'done' || cr.status === 'declined' ? 2 : 1,
        );
      }
      for (const d of db.rows('deployments')) {
        if (!ids.has(d.account_id)) continue;
        const a = db.find('accounts', d.account_id);
        add(
          {
            type: 'deployment',
            id: d.id,
            title: d.name,
            subtitle: [t(`care.category.${d.category}`), a ? a.name : '', t(`care.deploymentStatus.${d.status}`)].filter(Boolean).join(' · '),
            href: `/app/accounts/${d.account_id}/delivery`,
          },
          d.name,
          3,
          d.status === 'retired' ? 2 : 1,
        );
      }
    }

    // CRM (director / AM only): opportunities they may see, leads they own + the team pool. Kept while the sales /
    // targets modules are switched off (the crm suite reads them); the command palette leaves them out.
    for (const e of crmSearchEntries(v)) add(e.result, e.text, e.order);

    return scored
      .sort((a, b) => a.score - b.score || a.urgency - b.urgency || a.order - b.order || a.r.title.localeCompare(b.r.title, 'vi'))
      .slice(0, SEARCH_LIMIT)
      .map((x) => x.r);
  },
};
