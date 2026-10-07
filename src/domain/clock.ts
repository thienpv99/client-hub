// Single clock for the whole app. Timezone is fixed to Asia/Ho_Chi_Minh (UTC+7, no DST).
import type { ISODate, ISODateTime } from './types';

export const TIMEZONE = 'Asia/Ho_Chi_Minh';
const OFFSET_MS = 7 * 60 * 60 * 1000;

let fixedNow: Date | null = null;

/** Tests/demo only: freeze the clock (null = real time). */
export function setNow(date: Date | null): void {
  fixedNow = date;
}

export function now(): Date {
  return fixedNow ? new Date(fixedNow.getTime()) : new Date();
}

/** Today's calendar date in Vietnam, 'YYYY-MM-DD'. */
export function todayISO(): ISODate {
  return new Date(now().getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Current instant as '2026-10-06T08:30:12.345+07:00'. */
export function nowISO(): ISODateTime {
  return toVnISO(now());
}

export function toVnISO(date: Date): ISODateTime {
  return new Date(date.getTime() + OFFSET_MS).toISOString().replace('Z', '+07:00');
}

/** Calendar date (Vietnam) of an instant. Accepts ISODate too (returned as-is). */
export function dateOf(value: ISODateTime | ISODate): ISODate {
  if (value.length === 10) return value;
  return new Date(new Date(value).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' + 'HH:mm' (Vietnam wall time) → ISODateTime */
export function atTime(date: ISODate, hhmm = '09:00'): ISODateTime {
  return `${date}T${hhmm}:00.000+07:00`;
}
