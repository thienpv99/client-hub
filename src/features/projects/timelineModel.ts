// Pure layout model of the cross-project timeline (light Gantt with a month scale, and the phone list).
import type { ISODate } from '@/domain/types';
import type { MilestoneView } from '@/services/contract';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { dateOf } from '@/domain/clock';
import { addDays, diffDays, maxDate, minDate } from '@/domain/dates';

export interface GanttRange {
  /** first day of a month */
  start: ISODate;
  /** last day of a month */
  end: ISODate;
  days: number;
}

const PAD_DAYS = 10;
const MAX_BACK_DAYS = 400;
const MAX_AHEAD_DAYS = 800;

export function firstOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

/** first day of the month after d */
export function nextMonth(d: ISODate): ISODate {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/** where a milestone stands now: completion day when done, else the forecast */
export function milestoneDate(m: MilestoneView): ISODate {
  if (m.status === 'done' || m.forecast_source === 'done') return m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
  return m.forecast_date;
}

/** whole months covering every project (start → max(end, forecast end, milestones)) and today, ± padding */
export function buildGanttRange(rows: ProjectPortfolioRow[], today: ISODate): GanttRange {
  let lo = today;
  let hi = today;
  for (const p of rows) {
    lo = minDate(lo, p.start_date);
    hi = maxDate(hi, maxDate(p.end_date, p.forecast_end_date));
    for (const m of p.milestones) {
      const at = milestoneDate(m);
      lo = minDate(lo, minDate(m.planned_date, at));
      hi = maxDate(hi, maxDate(m.planned_date, at));
    }
  }
  lo = maxDate(lo, addDays(today, -MAX_BACK_DAYS));
  hi = minDate(hi, addDays(today, MAX_AHEAD_DAYS));
  const start = firstOfMonth(addDays(lo, -PAD_DAYS));
  const end = addDays(nextMonth(addDays(hi, PAD_DAYS)), -1);
  return { start, end, days: diffDays(end, start) + 1 };
}

export function monthStarts(range: GanttRange): ISODate[] {
  const out: ISODate[] = [];
  for (let d = range.start; d <= range.end; d = nextMonth(d)) out.push(d);
  return out;
}

function byName(a: ProjectPortfolioRow, b: ProjectPortfolioRow): number {
  return a.account.name.localeCompare(b.account.name, 'vi') || a.name.localeCompare(b.name, 'vi');
}

/** Gantt rows: by start date (earliest first) */
export function sortForGantt(rows: ProjectPortfolioRow[]): ProjectPortfolioRow[] {
  return [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date) || byName(a, b));
}

/** phone list: by next milestone forecast (soonest first); finished projects last */
export function sortForList(rows: ProjectPortfolioRow[]): ProjectPortfolioRow[] {
  const key = (p: ProjectPortfolioRow): string => p.next_milestone?.forecast_date ?? '9999-12-31';
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)) || byName(a, b));
}
