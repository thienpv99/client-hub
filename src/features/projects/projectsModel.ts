// Pure helpers of the project portfolio screens (/app/projects): tabs, filters, sorting, KPIs and links.
import type { ISODate, ProjectStatus } from '@/domain/types';
import type { Health, MilestoneView, UserRef } from '@/services/contract';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { normalizeText } from '@/lib/utils';

// ───────────── tabs ─────────────

/** "Yêu cầu" (SPEC-CARE §6.5) sits next to the portfolio: client requests are part of caring for signed accounts */
export const PROJECT_TABS = ['portfolio', 'requests', 'timeline', 'workload'] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

export function isProjectTab(v: string | null | undefined): v is ProjectTab {
  return typeof v === 'string' && (PROJECT_TABS as readonly string[]).includes(v);
}

/** portfolio is the index route */
export function projectsTabPath(tab: ProjectTab, search = ''): string {
  return `${tab === 'portfolio' ? '/app/projects' : `/app/projects/${tab}`}${search}`;
}

// ───────────── links ─────────────

export function roadmapHref(p: Pick<ProjectPortfolioRow, 'id' | 'account'>): string {
  return `/app/accounts/${encodeURIComponent(p.account.id)}/roadmap?project=${encodeURIComponent(p.id)}`;
}

export function accountTasksHref(accountId: string): string {
  return `/app/accounts/${encodeURIComponent(accountId)}/tasks`;
}

export function assigneeTasksHref(userId: string): string {
  return `/app/tasks?assignee=${encodeURIComponent(userId)}`;
}

// ───────────── filters ─────────────

/** health chips + the KPI shortcuts (at risk, slipping, overdue work) */
export type ProjectFilter = Health | 'at_risk' | 'slipping' | 'overdue';

export const HEALTH_CHIPS: readonly Health[] = ['blocked', 'attention', 'on_track'];
const PROJECT_FILTERS: readonly ProjectFilter[] = ['blocked', 'attention', 'on_track', 'at_risk', 'slipping', 'overdue'];

export function isProjectFilter(v: string | null | undefined): v is ProjectFilter {
  return typeof v === 'string' && (PROJECT_FILTERS as readonly string[]).includes(v);
}

export function isHealthFilter(f: ProjectFilter | null): f is Health {
  return f !== null && (HEALTH_CHIPS as readonly string[]).includes(f);
}

export const PROJECT_STATUSES: readonly ProjectStatus[] = ['active', 'paused', 'done'];

export function isProjectStatus(v: string | null | undefined): v is ProjectStatus {
  return typeof v === 'string' && (PROJECT_STATUSES as readonly string[]).includes(v);
}

export function overdueCount(p: ProjectPortfolioRow): number {
  return p.counts.overdue_client + p.counts.overdue_internal;
}

export function matchesFilter(p: ProjectPortfolioRow, f: ProjectFilter): boolean {
  switch (f) {
    case 'blocked':
    case 'attention':
    case 'on_track':
      return p.health === f;
    case 'at_risk':
      return p.status !== 'done' && (p.health === 'blocked' || p.health === 'attention');
    case 'slipping':
      return p.status !== 'done' && p.slip_days > 0;
    case 'overdue':
      return overdueCount(p) > 0;
  }
}

/** `query` already normalized with normalizeText */
export function matchesSearch(p: ProjectPortfolioRow, query: string): boolean {
  if (!query) return true;
  return normalizeText(`${p.name} ${p.code} ${p.account.name} ${p.account.short_name} ${p.am.full_name}`).includes(query);
}

export interface ProjectCriteria {
  filter: ProjectFilter | null;
  amId: string | null;
  status: ProjectStatus | null;
  /** raw text typed by the user */
  query: string;
}

export function applyCriteria(rows: ProjectPortfolioRow[], c: ProjectCriteria): ProjectPortfolioRow[] {
  const q = normalizeText(c.query);
  return rows.filter(
    (p) =>
      (!c.filter || matchesFilter(p, c.filter)) &&
      (!c.amId || p.am.id === c.amId) &&
      (!c.status || p.status === c.status) &&
      matchesSearch(p, q),
  );
}

// ───────────── sorting ─────────────

const HEALTH_RANK: Record<Health, number> = { blocked: 0, attention: 1, on_track: 2 };
const STATUS_RANK: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2 };

export function byProjectName(a: ProjectPortfolioRow, b: ProjectPortfolioRow): number {
  return a.account.name.localeCompare(b.account.name, 'vi') || a.name.localeCompare(b.name, 'vi');
}

/** most severe first: health → slip → overdue work; finished projects last */
export function sortBySeverity(rows: ProjectPortfolioRow[]): ProjectPortfolioRow[] {
  return [...rows].sort(
    (a, b) =>
      (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
      HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
      b.slip_days - a.slip_days ||
      overdueCount(b) - overdueCount(a) ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      byProjectName(a, b),
  );
}

// ───────────── KPIs ─────────────

export interface PortfolioKpis {
  /** status active */
  running: number;
  total: number;
  /** status done / paused */
  done: number;
  paused: number;
  /** distinct accounts of the projects */
  accounts: number;
  /** tasks of the running projects: done / all (portfolio-wide progress) */
  runningDoneTasks: number;
  runningTasks: number;
  /** projects not done (active + paused) */
  live: number;
  /** among projects not done */
  blocked: number;
  attention: number;
  slipping: number;
  /** the project with the largest slip (null when nothing slips) */
  worst: ProjectPortfolioRow | null;
  overdueClient: number;
  overdueInternal: number;
}

export function portfolioKpis(rows: ProjectPortfolioRow[]): PortfolioKpis {
  const live = rows.filter((p) => p.status !== 'done');
  let worst: ProjectPortfolioRow | null = null;
  for (const p of live) {
    if (p.slip_days > 0 && (!worst || p.slip_days > worst.slip_days)) worst = p;
  }
  const running = rows.filter((p) => p.status === 'active');
  return {
    running: running.length,
    total: rows.length,
    done: rows.filter((p) => p.status === 'done').length,
    paused: rows.filter((p) => p.status === 'paused').length,
    accounts: new Set(rows.map((p) => p.account.id)).size,
    runningDoneTasks: running.reduce((s, p) => s + p.done_tasks, 0),
    runningTasks: running.reduce((s, p) => s + p.done_tasks + p.open_tasks, 0),
    live: live.length,
    blocked: live.filter((p) => p.health === 'blocked').length,
    attention: live.filter((p) => p.health === 'attention').length,
    slipping: live.filter((p) => p.slip_days > 0).length,
    worst,
    overdueClient: rows.reduce((s, p) => s + p.counts.overdue_client, 0),
    overdueInternal: rows.reduce((s, p) => s + p.counts.overdue_internal, 0),
  };
}

// ───────────── people ─────────────

export interface AmOption {
  user: UserRef;
  count: number;
}

/** Distinct AMs of `all` (count = projects in `scope` managed by that AM), sorted by name. */
export function amOptions(all: ProjectPortfolioRow[], scope: ProjectPortfolioRow[]): AmOption[] {
  const users = new Map<string, UserRef>();
  for (const p of all) users.set(p.am.id, p.am);
  return [...users.values()]
    .map((user) => ({ user, count: scope.filter((p) => p.am.id === user.id).length }))
    .sort((x, y) => x.user.full_name.localeCompare(y.user.full_name, 'vi'));
}

/** 'Nguyễn Thu Hà' → 'Thu Hà' (how colleagues call each other); two-word names stay whole. */
export function shortPersonName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 ? words.slice(-2).join(' ') : fullName.trim();
}

/**
 * The planned date that `forecast_end_date` (forecast of the final milestone) is compared with: the final
 * milestone's planned date; the project's end date when it has no milestone.
 */
export function plannedEndDate(p: Pick<ProjectPortfolioRow, 'milestones' | 'end_date'>): ISODate {
  let last: MilestoneView | null = null;
  for (const m of p.milestones) if (!last || m.order_no > last.order_no) last = m;
  return last ? last.planned_date : p.end_date;
}

/** status tone of a slip: red when the project is blocked, amber otherwise */
export function slipTone(p: Pick<ProjectPortfolioRow, 'health'>): 'danger' | 'warning' {
  return p.health === 'blocked' ? 'danger' : 'warning';
}
