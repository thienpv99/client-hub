// Project portfolio & team workload (ARCHITECTURE §13 "Dự án"): read-only, every internal role.
// Members see the accounts they work on (accessibleAccountIds); clients and "Xem như khách hàng" get forbidden.

import type { Health, ID, Project } from '@/domain/types';
import type { AccountRef, UserRef, Viewer } from '@/services/contract';
import type { CrmApi, ProjectPortfolioRow, WorkloadView } from '@/services/crmContract';
import { todayISO } from '@/domain/clock';
import { normalizeLabel, workloadWeekIndex, workloadWeeks } from '@/domain/crm';
import { computeHealth } from '@/domain/health';
import { requireViewer, toUserRef } from '@/services/context';
import { forbidden } from '@/services/crmViews';
import { db } from '@/services/db';
import { accessibleIds, accountProjects, accountRef, accountTasks, countsFor, graphForAccount, projectView, userRefAny } from '@/services/views';

const HEALTH_ORDER: Record<Health, number> = { blocked: 0, attention: 1, on_track: 2 };
const STATUS_ORDER: Record<Project['status'], number> = { active: 0, paused: 1, done: 2 };
const DEFAULT_WEEKS = 6;
const MAX_WEEKS = 26;

function portfolioViewer(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'internal' || v.read_only) throw forbidden();
  return v;
}

let healthCache: { key: string; map: Map<ID, Health> } = { key: '', map: new Map() };

/** project-scoped health: the account rules applied to the project's own tasks (payments and the AM override ignored) */
export function projectHealth(p: Project): Health {
  const key = `${db.version}|${todayISO()}`;
  if (healthCache.key !== key) healthCache = { key, map: new Map() };
  let h = healthCache.map.get(p.id);
  if (!h) {
    const tasks = accountTasks(p.account_id).filter((x) => x.project_id === p.id);
    h = computeHealth(graphForAccount(p.account_id), tasks, [], todayISO()).auto;
    healthCache.map.set(p.id, h);
  }
  return h;
}

function byName(a: UserRef, b: UserRef): number {
  return a.full_name.localeCompare(b.full_name, 'vi');
}

function portfolioRow(p: Project, v: Viewer): ProjectPortfolioRow | null {
  const account = db.find('accounts', p.account_id);
  if (!account) return null;
  const view = projectView(p, v);
  const tasks = accountTasks(p.account_id).filter((x) => x.project_id === p.id);
  const open = tasks.filter((x) => x.status !== 'done');
  const team = new Map<ID, UserRef>();
  for (const task of open) {
    if (!task.assignee_id || team.has(task.assignee_id)) continue;
    const u = db.find('users', task.assignee_id);
    if (u && u.org_type === 'internal') team.set(u.id, toUserRef(u));
  }
  const slip = view.milestones.filter((m) => m.status !== 'done').reduce((max, m) => Math.max(max, m.delay_days), 0);
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    status: p.status,
    account: accountRef(account),
    am: userRefAny(account.am_id),
    health: projectHealth(p),
    start_date: p.start_date,
    end_date: p.end_date,
    forecast_end_date: view.final_milestone ? view.final_milestone.forecast_date : p.end_date,
    slip_days: slip,
    progress_pct: view.progress_pct,
    milestones: view.milestones,
    next_milestone: view.next_milestone,
    counts: countsFor(p.account_id, v, { projectId: p.id }),
    open_tasks: open.length,
    done_tasks: tasks.length - open.length,
    team: [...team.values()].sort(byName),
  };
}

export const projectsApi: Pick<CrmApi, 'listProjectPortfolio' | 'getWorkload'> = {
  async listProjectPortfolio(filter) {
    const v = portfolioViewer();
    const f = filter ?? {};
    const q = f.search ? normalizeLabel(f.search) : '';
    const rows: ProjectPortfolioRow[] = [];
    for (const accountId of accessibleIds(v)) {
      const account = db.find('accounts', accountId);
      if (!account) continue;
      if (f.amId && account.am_id !== f.amId) continue;
      for (const p of accountProjects(accountId)) {
        if (f.status && p.status !== f.status) continue;
        if (q && !normalizeLabel(`${p.name} ${p.code} ${account.name} ${account.short_name}`).includes(q)) continue;
        if (f.health && projectHealth(p) !== f.health) continue;
        const row = portfolioRow(p, v);
        if (row) rows.push(row);
      }
    }
    return rows.sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
        b.slip_days - a.slip_days ||
        a.account.name.localeCompare(b.account.name, 'vi') ||
        a.name.localeCompare(b.name, 'vi'),
    );
  },

  async getWorkload(params) {
    const v = portfolioViewer();
    const requested = Number(params?.weeks ?? DEFAULT_WEEKS);
    const n = Number.isFinite(requested) ? Math.min(MAX_WEEKS, Math.max(1, Math.round(requested))) : DEFAULT_WEEKS;
    const today = todayISO();
    const weeks = workloadWeeks(today, n);
    const people = new Map<ID, WorkloadView['people'][number] & { accountMap: Map<ID, AccountRef> }>();
    for (const accountId of accessibleIds(v)) {
      const account = db.find('accounts', accountId);
      if (!account) continue;
      const g = graphForAccount(accountId);
      for (const task of accountTasks(accountId)) {
        if (task.side !== 'internal' || task.status === 'done' || !task.assignee_id) continue;
        let entry = people.get(task.assignee_id);
        if (!entry) {
          const u = db.find('users', task.assignee_id);
          if (!u || u.org_type !== 'internal') continue;
          entry = { user: toUserRef(u), open: 0, overdue: 0, blocked: 0, per_week: weeks.map(() => 0), accounts: [], accountMap: new Map() };
          people.set(u.id, entry);
        }
        entry.open += 1;
        if (task.due_date < today) entry.overdue += 1;
        if (g.isBlocked(task.id)) entry.blocked += 1;
        const w = workloadWeekIndex(task.due_date, today, n);
        if (w >= 0) entry.per_week[w] += 1;
        entry.accountMap.set(account.id, accountRef(account));
      }
    }
    const list = [...people.values()]
      .map(({ accountMap, ...rest }) => ({
        ...rest,
        accounts: [...accountMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      }))
      .sort((a, b) => b.open - a.open || b.overdue - a.overdue || byName(a.user, b.user));
    return { weeks, people: list };
  },
};
