// Pure helpers of the "Tải việc" heat map.
import type { ISODate } from '@/domain/types';
import type { WorkloadView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';

export type WorkloadPerson = WorkloadView['people'][number];
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** most loaded first: overdue → open → name */
export function sortPeople(people: WorkloadPerson[]): WorkloadPerson[] {
  return [...people].sort(
    (a, b) => b.overdue - a.overdue || b.open - a.open || a.user.full_name.localeCompare(b.user.full_name, 'vi'),
  );
}

/** 0 · 1 · 2 · 3–4 · 5+ open tasks due that week */
export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * chart blue ramp only (never status colours); text keeps ≥ 4.5:1 on every step. An empty week is a quiet dash (the
 * cell's sr-only label says it in words), so the loaded weeks carry the row.
 */
export const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: 'bg-transparent text-border-strong',
  1: 'bg-primary-soft text-foreground',
  2: 'bg-chart-4 text-foreground',
  3: 'bg-chart-3 text-ink',
  4: 'bg-primary text-primary-foreground',
};

/** totals for the one-line summary above the heat map */
export function workloadTotals(people: WorkloadPerson[]): { people: number; open: number; overdue: number; blocked: number } {
  return {
    people: people.length,
    open: people.reduce((s, p) => s + p.open, 0),
    overdue: people.reduce((s, p) => s + p.overdue, 0),
    blocked: people.reduce((s, p) => s + p.blocked, 0),
  };
}

export const HEAT_LEVELS: readonly HeatLevel[] = [1, 2, 3, 4];

/**
 * "Phạm Minh Tuấn: 4 việc tuần 12/10"; first week: "… tuần này (05/10)", plus "gồm 2 việc đã quá hạn" only when
 * the person has overdue work (it is counted in this week).
 */
export function cellLabel(name: string, count: number, week: ISODate, index: number, overdue = 0): string {
  const params = { name, count, week: formatDateShort(week), overdue };
  if (count <= 0) return t(index === 0 ? 'projects.workload.cellLabelFirstNone' : 'projects.workload.cellLabelNone', params);
  if (index !== 0) return t('projects.workload.cellLabel', params);
  return t(overdue > 0 ? 'projects.workload.cellLabelFirstOverdue' : 'projects.workload.cellLabelFirst', params);
}
