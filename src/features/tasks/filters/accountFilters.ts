// Filter state of the account Tasks tab, kept in the URL (?view=&q=&side=&who=&prj=&ms=&flag=) so links and
// the back button work. Filtering happens on the list the api already returned for this viewer (no RBAC here).
import type { TaskSide, TaskView } from '@/services/contract';
import { normalizeText } from '@/lib/utils';

export type TaskViewMode = 'kanban' | 'list' | 'timeline';
export type FlagFilter = 'overdue' | 'blocking' | 'blocked';

/** '' never appears: null = no filter. 'none' = unassigned / no milestone. `q` = search text. */
export interface AccountTaskFilters {
  q: string | null;
  side: TaskSide | null;
  assignee: string | null;
  project: string | null;
  milestone: string | null;
  flag: FlagFilter | null;
}

export type FilterGroup = keyof AccountTaskFilters;

export const NONE = 'none';

const PARAM: Record<FilterGroup, string> = {
  q: 'q',
  side: 'side',
  assignee: 'who',
  project: 'prj',
  milestone: 'ms',
  flag: 'flag',
};

/** the filters that live in the "Bộ lọc" popover (the chips and the search box are always visible) */
export const POPOVER_GROUPS: readonly FilterGroup[] = ['project', 'milestone', 'assignee'];

const VIEWS: readonly TaskViewMode[] = ['kanban', 'list', 'timeline'];
const FLAGS: readonly FlagFilter[] = ['overdue', 'blocking', 'blocked'];

export function readView(params: URLSearchParams): TaskViewMode {
  const v = params.get('view');
  return VIEWS.find((x) => x === v) ?? 'kanban';
}

export function readFilters(params: URLSearchParams): AccountTaskFilters {
  const side = params.get(PARAM.side);
  const flag = params.get(PARAM.flag);
  return {
    q: params.get(PARAM.q)?.trim() ? params.get(PARAM.q) : null,
    side: side === 'client' || side === 'internal' ? side : null,
    assignee: params.get(PARAM.assignee) || null,
    project: params.get(PARAM.project) || null,
    milestone: params.get(PARAM.milestone) || null,
    flag: FLAGS.find((x) => x === flag) ?? null,
  };
}

/** returns a new URLSearchParams with the patch applied (null removes the param) */
export function writeFilters(prev: URLSearchParams, patch: Partial<AccountTaskFilters> & { view?: TaskViewMode }): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const [key, value] of Object.entries(patch) as [FilterGroup | 'view', string | null | undefined][]) {
    if (value === undefined) continue;
    const name = key === 'view' ? 'view' : PARAM[key];
    if (value === null || value === '') next.delete(name);
    else next.set(name, value);
  }
  return next;
}

export function clearFilters(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const name of Object.values(PARAM)) next.delete(name);
  return next;
}

export function activeFilterCount(f: AccountTaskFilters): number {
  return (Object.keys(f) as FilterGroup[]).filter((k) => f[k] !== null).length;
}

function matchesGroup(task: TaskView, f: AccountTaskFilters, group: FilterGroup): boolean {
  switch (group) {
    case 'q': {
      const q = f.q ? normalizeText(f.q) : '';
      if (!q) return true;
      return normalizeText(`${task.title} ${task.assignee?.full_name ?? ''} ${task.milestone?.name ?? ''}`).includes(q);
    }
    case 'side':
      return f.side === null || task.side === f.side;
    case 'assignee':
      if (f.assignee === null) return true;
      return f.assignee === NONE ? task.assignee === null : task.assignee?.id === f.assignee;
    case 'project':
      return f.project === null || task.project_id === f.project;
    case 'milestone':
      if (f.milestone === null) return true;
      return f.milestone === NONE ? task.milestone_id === null : task.milestone_id === f.milestone;
    case 'flag':
      return f.flag === null || matchesFlag(task, f.flag);
    default: {
      const never: never = group;
      return never;
    }
  }
}

export function matchesFlag(task: TaskView, flag: FlagFilter): boolean {
  if (task.status === 'done') return false;
  if (flag === 'overdue') return task.due.overdue;
  if (flag === 'blocking') return task.is_blocking_milestone;
  return task.blocked;
}

const GROUPS: readonly FilterGroup[] = ['q', 'side', 'assignee', 'project', 'milestone', 'flag'];

/** every filter, or every filter except `except` (faceted counts) */
export function matchesFilters(task: TaskView, f: AccountTaskFilters, except?: FilterGroup): boolean {
  return GROUPS.every((g) => g === except || matchesGroup(task, f, g));
}

/** count of tasks per value of `group`, with every OTHER active filter applied */
export function facetCounts(tasks: TaskView[], f: AccountTaskFilters, group: FilterGroup, valueOf: (t: TaskView) => string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const task of tasks) {
    if (!matchesFilters(task, f, group)) continue;
    for (const v of valueOf(task)) out.set(v, (out.get(v) ?? 0) + 1);
  }
  return out;
}

export function flagValues(task: TaskView): string[] {
  return FLAGS.filter((flag) => matchesFlag(task, flag));
}
