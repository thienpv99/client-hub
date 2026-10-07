// Pure helpers for the roadmap tab: timeline scale, delay tone, today placement.
import type { ISODate, ProjectTemplate } from '@/domain/types';
import type { MilestoneView, ProjectView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { addDays, diffDays, maxDate, minDate } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';

export type DelayTone = 'danger' | 'warning' | 'neutral';

/** Date a milestone sits on the timeline: completion day when done, else its forecast. */
export function effectiveDate(m: MilestoneView): ISODate {
  if (m.status === 'done') return m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
  return m.forecast_date;
}

export function isDone(m: MilestoneView): boolean {
  return m.status === 'done' || m.forecast_source === 'done';
}

/** Delay shown on the chip ("+6 ngày"); 0 when on plan or done. */
export function delayOf(m: MilestoneView): number {
  if (isDone(m)) return 0;
  return diffDays(m.forecast_date, m.planned_date);
}

/**
 * Chip tone: a delay pushed by an overdue task (directly or through an earlier milestone) is red — the same
 * "Đang bị chặn" signal as the account health; a manual re-plan (or a cascade of one) is amber; earlier is neutral.
 */
export function delayTone(m: MilestoneView): DelayTone {
  const delay = delayOf(m);
  if (delay <= 0) return 'neutral';
  if (m.forecast_source === 'manual') return 'warning';
  if (m.forecast_source === 'cascade' && !m.cause) return 'warning';
  return 'danger';
}

/** The milestone the team is working towards: first not done in order. */
export function currentMilestoneId(milestones: MilestoneView[]): string | null {
  const sorted = [...milestones].sort((a, b) => a.order_no - b.order_no);
  return sorted.find((m) => !isDone(m))?.id ?? null;
}

/**
 * Index in the ordered list before which the "Hôm nay" divider goes: before the first not-done milestone whose
 * forecast is today or later; after the list when everything is done or already behind today.
 */
export function todayIndex(milestones: MilestoneView[], today: ISODate): number {
  const i = milestones.findIndex((m) => !isDone(m) && m.forecast_date >= today);
  return i === -1 ? milestones.length : i;
}

// ───────────────────────────── timeline scale ─────────────────────────────

export interface Tick {
  date: ISODate;
  /** 0–100 */
  pos: number;
  label: string;
}

export interface TimelineScale {
  start: ISODate;
  end: ISODate;
  /** 0–100 along the track */
  pos(d: ISODate): number;
  ticks: Tick[];
  /** null when today is outside the visible range */
  todayPos: number | null;
}

function monthLabel(d: ISODate, withYear: boolean): string {
  const month = Number(d.slice(5, 7));
  return withYear
    ? t('roadmap.timeline.monthYear', { month, year: d.slice(0, 4) })
    : t('roadmap.timeline.month', { month });
}

function firstOfNextMonth(d: ISODate): ISODate {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/** Axis covering the project dates, every milestone (planned, forecast, completion) and — when close — today. */
export function buildScale(project: ProjectView, today: ISODate): TimelineScale {
  let lo = project.start_date;
  let hi = project.end_date;
  for (const m of project.milestones) {
    lo = minDate(lo, minDate(m.planned_date, effectiveDate(m)));
    hi = maxDate(hi, maxDate(m.planned_date, effectiveDate(m)));
  }
  const rawSpan = Math.max(1, diffDays(hi, lo));
  // today joins the axis only when it is near the project (a far-away today would squash the milestones)
  const near = diffDays(today, lo) >= -Math.max(14, rawSpan * 0.25) && diffDays(today, hi) <= Math.max(14, rawSpan * 0.25);
  if (near) {
    lo = minDate(lo, today);
    hi = maxDate(hi, today);
  }
  const span0 = Math.max(1, diffDays(hi, lo));
  const pad = Math.max(3, Math.round(span0 * 0.04));
  const start = addDays(lo, -pad);
  const end = addDays(hi, pad);
  const span = Math.max(1, diffDays(end, start));
  const pos = (d: ISODate): number => Math.min(100, Math.max(0, (diffDays(d, start) / span) * 100));

  const ticks: Tick[] = [];
  const multiYear = start.slice(0, 4) !== end.slice(0, 4);
  let cursor = firstOfNextMonth(start);
  const months: ISODate[] = [];
  while (cursor <= end) {
    months.push(cursor);
    cursor = firstOfNextMonth(cursor);
  }
  if (months.length >= 2) {
    const step = Math.max(1, Math.ceil(months.length / 8));
    months.forEach((d, i) => {
      if (i % step !== 0) return;
      const withYear = multiYear && (i === 0 || d.slice(5, 7) === '01');
      ticks.push({ date: d, pos: pos(d), label: monthLabel(d, withYear) });
    });
  } else {
    // short project: weekly ticks (Mondays)
    let w = start;
    while (new Date(`${w}T00:00:00Z`).getUTCDay() !== 1) w = addDays(w, 1);
    for (; w <= end; w = addDays(w, 7)) ticks.push({ date: w, pos: pos(w), label: formatDateShort(w) });
  }

  const todayPos = today >= start && today <= end ? pos(today) : null;
  return { start, end, pos, ticks, todayPos };
}

// ───────────────────────────── templates ─────────────────────────────

/** Planned dates of a template's milestones for a start date. */
export function templateSchedule(template: ProjectTemplate, start: ISODate): { name: string; date: ISODate }[] {
  return template.milestones.map((m) => ({ name: m.name, date: addDays(start, m.offset_days) }));
}

/** Template length in weeks (last offset), at least 1. */
export function templateWeeks(template: ProjectTemplate): number {
  const last = template.milestones.reduce((max, m) => Math.max(max, m.offset_days), 0);
  return Math.max(1, Math.round(last / 7));
}
