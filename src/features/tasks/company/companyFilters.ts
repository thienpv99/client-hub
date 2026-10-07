// URL state of /app/tasks: ?mine=1&side=&wait=&flag=&q=&group= (members land on ?mine=1).
import type { TaskSide, TaskView, WaitingOn } from '@/services/contract';
import { normalizeText } from '@/lib/utils';

export type CompanyFlag = 'overdue' | 'blocking';
export type GroupBy = 'account' | 'assignee';

export interface CompanyFilters {
  mine: boolean;
  side: TaskSide | null;
  wait: WaitingOn | null;
  flag: CompanyFlag | null;
  q: string;
}

type Group = keyof CompanyFilters;

export function readCompanyFilters(params: URLSearchParams): CompanyFilters {
  const side = params.get('side');
  const wait = params.get('wait');
  const flag = params.get('flag');
  return {
    mine: params.get('mine') === '1',
    side: side === 'client' || side === 'internal' ? side : null,
    wait: wait === 'client' || wait === 'internal' ? wait : null,
    flag: flag === 'overdue' || flag === 'blocking' ? flag : null,
    q: params.get('q') ?? '',
  };
}

export function readGroupBy(params: URLSearchParams): GroupBy {
  return params.get('group') === 'assignee' ? 'assignee' : 'account';
}

export function writeCompanyParams(prev: URLSearchParams, patch: Partial<CompanyFilters> & { group?: GroupBy }): URLSearchParams {
  const next = new URLSearchParams(prev);
  const put = (name: string, value: string | null) => (value ? next.set(name, value) : next.delete(name));
  if (patch.mine !== undefined) put('mine', patch.mine ? '1' : null);
  if (patch.side !== undefined) put('side', patch.side);
  if (patch.wait !== undefined) put('wait', patch.wait);
  if (patch.flag !== undefined) put('flag', patch.flag);
  if (patch.q !== undefined) put('q', patch.q.trim() ? patch.q : null);
  if (patch.group !== undefined) put('group', patch.group === 'account' ? null : patch.group);
  return next;
}

export function clearCompanyFilters(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const name of ['mine', 'side', 'wait', 'flag', 'q']) next.delete(name);
  return next;
}

export function hasCompanyFilters(f: CompanyFilters): boolean {
  return f.mine || f.side !== null || f.wait !== null || f.flag !== null || f.q.trim() !== '';
}

function matchesGroup(task: TaskView, f: CompanyFilters, g: Group, me: string | null): boolean {
  switch (g) {
    case 'mine':
      return !f.mine || (me !== null && task.assignee?.id === me);
    case 'side':
      return f.side === null || task.side === f.side;
    case 'wait':
      return f.wait === null || task.waiting_on === f.wait;
    case 'flag':
      if (f.flag === null) return true;
      return f.flag === 'overdue' ? task.due.overdue : task.is_blocking_milestone;
    case 'q': {
      const q = normalizeText(f.q);
      return !q || normalizeText(`${task.title} ${task.account.name} ${task.assignee?.full_name ?? ''}`).includes(q);
    }
    default: {
      const never: never = g;
      return never;
    }
  }
}

const GROUPS: readonly Group[] = ['mine', 'side', 'wait', 'flag', 'q'];

export function matchesCompany(task: TaskView, f: CompanyFilters, me: string | null, except?: Group): boolean {
  return GROUPS.every((g) => g === except || matchesGroup(task, f, g, me));
}

export function countWhere(tasks: TaskView[], f: CompanyFilters, me: string | null, except: Group, pred: (t: TaskView) => boolean): number {
  let n = 0;
  for (const task of tasks) if (matchesCompany(task, f, me, except) && pred(task)) n += 1;
  return n;
}

/** "Nhắc khách" applies to open client tasks waiting on the client, overdue, not blocked, that this viewer may chase */
export function isRemindEligible(task: TaskView): boolean {
  return task.can.remind && task.status !== 'done' && task.waiting_on === 'client' && task.due.overdue;
}
