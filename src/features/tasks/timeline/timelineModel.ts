// Pure layout model of the Tasks-tab timeline (light Gantt grouped by milestone, and the phone agenda).
import type { ISODate } from '@/domain/types';
import type { MilestoneView, ProjectView, TaskView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { addDays, diffDays, endOfWeek, maxDate, minDate, startOfWeek } from '@/domain/dates';

export interface TimelineRange {
  /** a Monday */
  start: ISODate;
  /** a Sunday */
  end: ISODate;
  days: number;
}

export interface TimelineGroup {
  id: string;
  /** milestone name, or null = "Chưa gắn mốc" */
  milestone: MilestoneView | null;
  project: ProjectView;
  tasks: TaskView[];
}

export interface TaskSpan {
  start: ISODate;
  end: ISODate;
  /** created on (or after) the due day: drawn as a dot */
  dot: boolean;
  /** overdue extension due+1 → today (open overdue tasks) */
  overdueUntil: ISODate | null;
}

const LOOK_BACK_DAYS = 42;
const LOOK_AHEAD_MAX_DAYS = 210;

export function taskSpan(task: TaskView, today: ISODate): TaskSpan {
  const created = dateOf(task.created_at);
  if (task.status === 'done') {
    const end = task.completed_at ? dateOf(task.completed_at) : task.due_date;
    const start = minDate(created, end);
    return { start, end, dot: diffDays(end, start) <= 0, overdueUntil: null };
  }
  const start = minDate(created, task.due_date);
  return {
    start,
    end: task.due_date,
    dot: diffDays(task.due_date, start) <= 0,
    overdueUntil: task.due.overdue ? today : null,
  };
}

/** the date where a milestone marker of interest sits (forecast when live, completion when done) */
function milestoneDates(m: MilestoneView): ISODate[] {
  if (m.status === 'done') return [m.completed_at ? dateOf(m.completed_at) : m.forecast_date];
  return [m.planned_date, m.forecast_date];
}

export function buildRange(tasks: TaskView[], projects: ProjectView[], today: ISODate): TimelineRange {
  let lo = addDays(today, -7);
  let hi = addDays(today, 21);
  for (const task of tasks) {
    const span = taskSpan(task, today);
    if (task.status !== 'done') lo = minDate(lo, span.start);
    hi = maxDate(hi, span.overdueUntil ?? span.end);
  }
  for (const p of projects) {
    for (const m of p.milestones) {
      if (m.status === 'done') continue;
      for (const d of milestoneDates(m)) {
        lo = minDate(lo, d);
        hi = maxDate(hi, d);
      }
    }
  }
  lo = maxDate(lo, addDays(today, -LOOK_BACK_DAYS));
  hi = minDate(hi, addDays(today, LOOK_AHEAD_MAX_DAYS));
  const start = startOfWeek(lo);
  const end = endOfWeek(addDays(hi, 4));
  return { start, end, days: diffDays(end, start) + 1 };
}

/** done tasks that ended before the range are left out of the chart (counted for a footnote) */
export function isBeforeRange(task: TaskView, range: TimelineRange, today: ISODate): boolean {
  if (task.status !== 'done') return false;
  return taskSpan(task, today).end < range.start;
}

function byStart(today: ISODate) {
  return (a: TaskView, b: TaskView): number =>
    taskSpan(a, today).start.localeCompare(taskSpan(b, today).start) ||
    a.due_date.localeCompare(b.due_date) ||
    a.title.localeCompare(b.title, 'vi');
}

/**
 * Groups in project order → milestone order, then "Chưa gắn mốc". A milestone without (filtered) tasks is kept
 * when it is not done, so its planned / forecast markers stay visible.
 */
export function buildGroups(tasks: TaskView[], projects: ProjectView[], today: ISODate, showEmptyMilestones: boolean): TimelineGroup[] {
  const sort = byStart(today);
  const groups: TimelineGroup[] = [];
  const placed = new Set<string>();
  for (const p of projects) {
    const inProject = tasks.filter((x) => x.project_id === p.id);
    for (const m of p.milestones) {
      const list = inProject.filter((x) => x.milestone_id === m.id).sort(sort);
      list.forEach((x) => placed.add(x.id));
      if (list.length || (showEmptyMilestones && m.status !== 'done')) groups.push({ id: m.id, milestone: m, project: p, tasks: list });
    }
    const loose = inProject.filter((x) => !placed.has(x.id)).sort(sort);
    loose.forEach((x) => placed.add(x.id));
    if (loose.length) groups.push({ id: `${p.id}:none`, milestone: null, project: p, tasks: loose });
  }
  return groups;
}

export function weekStarts(range: TimelineRange): ISODate[] {
  const out: ISODate[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 7)) out.push(d);
  return out;
}

// ───────────── phone agenda ─────────────

export type AgendaEntry = { kind: 'task'; date: ISODate; task: TaskView } | { kind: 'milestone'; date: ISODate; milestone: MilestoneView; project: ProjectView };

export interface AgendaSection {
  id: string;
  kind: 'overdue' | 'week';
  /** Monday of the week (week sections) */
  week: ISODate | null;
  entries: AgendaEntry[];
}

/** open tasks by due date (overdue first) with milestone markers (at their forecast) slotted into their week */
export function buildAgenda(tasks: TaskView[], projects: ProjectView[], today: ISODate): AgendaSection[] {
  const open = tasks.filter((x) => x.status !== 'done');
  const overdue = open
    .filter((x) => x.due.overdue)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'vi'));
  const weeks = new Map<ISODate, AgendaEntry[]>();
  const push = (week: ISODate, e: AgendaEntry) => {
    const list = weeks.get(week) ?? [];
    list.push(e);
    weeks.set(week, list);
  };
  for (const task of open) {
    if (task.due.overdue) continue;
    push(startOfWeek(task.due_date), { kind: 'task', date: task.due_date, task });
  }
  const firstWeek = startOfWeek(today);
  for (const p of projects) {
    for (const m of p.milestones) {
      if (m.status === 'done') continue;
      const d = maxDate(m.forecast_date, today);
      push(maxDate(startOfWeek(d), firstWeek), { kind: 'milestone', date: d, milestone: m, project: p });
    }
  }
  const sections: AgendaSection[] = [];
  if (overdue.length) {
    sections.push({ id: 'overdue', kind: 'overdue', week: null, entries: overdue.map((task) => ({ kind: 'task', date: task.due_date, task })) });
  }
  const order = (e: AgendaEntry): string => `${e.date}:${e.kind === 'milestone' ? '1' : '0'}`;
  for (const week of [...weeks.keys()].sort()) {
    const entries = (weeks.get(week) ?? []).sort((a, b) => order(a).localeCompare(order(b)));
    // a week with only milestones of projects that have no visible task is still useful context
    sections.push({ id: week, kind: 'week', week, entries });
  }
  return sections;
}
