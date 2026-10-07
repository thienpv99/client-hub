// Pure calendar helpers on 'YYYY-MM-DD' strings (no timezone math needed).
import type { ISODate } from './types';
import { todayISO } from './clock';

const DAY_MS = 86_400_000;

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** a − b in whole days */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

/** Overdue = the due day has fully passed (after 23:59 of due_date, Vietnam time). */
export function isOverdue(due: ISODate, today: ISODate = todayISO()): boolean {
  return today > due;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay();
}

/** Monday of the week containing d */
export function startOfWeek(d: ISODate): ISODate {
  const wd = weekday(d);
  return addDays(d, wd === 0 ? -6 : 1 - wd);
}

/** Sunday of the week containing d */
export function endOfWeek(d: ISODate): ISODate {
  return addDays(startOfWeek(d), 6);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function isValidISODate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTC(toUTC(d)) === d;
}

/** 'YYYY-MM' */
export function monthOf(d: ISODate): string {
  return d.slice(0, 7);
}
