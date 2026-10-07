// Portfolio filtering and sorting (pure, client-side). Shared by the dashboard and the accounts page.
import type { AccountSummary, Health, HealthReason, UserRef } from '@/services/contract';
import { normalizeText } from '@/lib/utils';

/** Quick chips of SPEC §4.1 plus the KPI shortcuts of the dashboard. */
export type StatusFilter = 'blocked' | 'waiting_client' | 'overdue_receivable' | 'at_risk' | 'overdue_tasks' | 'receivable';

/** Filters shown as chips (the others are applied from the KPI cards). */
export const CHIP_FILTERS = ['blocked', 'waiting_client', 'overdue_receivable'] as const;
export type ChipFilterValue = (typeof CHIP_FILTERS)[number];

/** Filters that need money columns (hidden from internal members, who get no commercial data). */
const MONEY_FILTERS: ReadonlySet<StatusFilter> = new Set<StatusFilter>(['overdue_receivable', 'receivable']);

const STATUS_FILTERS: readonly StatusFilter[] = [
  'blocked',
  'waiting_client',
  'overdue_receivable',
  'at_risk',
  'overdue_tasks',
  'receivable',
];

export type SortKey = 'health' | 'name' | 'receivable' | 'next';
export const SORT_KEYS: readonly SortKey[] = ['health', 'name', 'receivable', 'next'];
export const DEFAULT_SORT: SortKey = 'health';

export function isStatusFilter(v: string | null | undefined): v is StatusFilter {
  return typeof v === 'string' && (STATUS_FILTERS as readonly string[]).includes(v);
}

export function isChipFilter(v: StatusFilter | null): v is ChipFilterValue {
  return v !== null && (CHIP_FILTERS as readonly string[]).includes(v);
}

export function isSortKey(v: string | null | undefined): v is SortKey {
  return typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);
}

export function needsMoney(f: StatusFilter): boolean {
  return MONEY_FILTERS.has(f);
}

export function matchesStatus(a: AccountSummary, f: StatusFilter): boolean {
  switch (f) {
    case 'blocked':
      return a.health.value === 'blocked';
    case 'at_risk':
      return a.health.value === 'blocked' || a.health.value === 'attention';
    case 'waiting_client':
      return a.counts.waiting_client > 0;
    case 'overdue_tasks':
      return a.counts.overdue_client + a.counts.overdue_internal > 0;
    case 'overdue_receivable':
      return a.receivable_overdue > 0;
    case 'receivable':
      return a.receivable > 0;
  }
}

/** `query` already normalized with normalizeText */
export function matchesSearch(a: AccountSummary, query: string): boolean {
  if (!query) return true;
  return normalizeText(`${a.name} ${a.short_name} ${a.industry} ${a.am.full_name}`).includes(query);
}

export interface PortfolioCriteria {
  status: StatusFilter | null;
  amId: string | null;
  /** raw text typed by the user */
  query: string;
}

export function applyCriteria(list: AccountSummary[], c: PortfolioCriteria): AccountSummary[] {
  const q = normalizeText(c.query);
  return list.filter(
    (a) => (!c.status || matchesStatus(a, c.status)) && (!c.amId || a.am.id === c.amId) && matchesSearch(a, q),
  );
}

const HEALTH_RANK: Record<Health, number> = { blocked: 0, attention: 1, on_track: 2 };

/** How late the worst reason is (overdue days, or a due-soon task counts as "almost late"). */
function worstDelay(reasons: HealthReason[]): number {
  let worst = 0;
  for (const r of reasons) {
    if (r.kind === 'due_soon_blocking') worst = Math.max(worst, 0.5);
    else worst = Math.max(worst, r.overdue_days);
  }
  return worst;
}

function byName(a: AccountSummary, b: AccountSummary): number {
  return a.name.localeCompare(b.name, 'vi');
}

export function sortPortfolio(list: AccountSummary[], key: SortKey): AccountSummary[] {
  const out = [...list];
  switch (key) {
    case 'name':
      return out.sort(byName);
    case 'receivable':
      return out.sort((a, b) => b.receivable_overdue - a.receivable_overdue || b.receivable - a.receivable || byName(a, b));
    case 'next':
      return out.sort((a, b) => {
        const fa = a.next_milestone?.forecast_date ?? null;
        const fb = b.next_milestone?.forecast_date ?? null;
        if (fa === fb) return byName(a, b);
        if (fa === null) return 1;
        if (fb === null) return -1;
        return fa.localeCompare(fb);
      });
    case 'health':
      return out.sort(
        (a, b) =>
          HEALTH_RANK[a.health.value] - HEALTH_RANK[b.health.value] ||
          worstDelay(b.health.reasons) - worstDelay(a.health.reasons) ||
          byName(a, b),
      );
  }
}

export interface AmOption {
  user: UserRef;
  count: number;
}

/** Distinct AMs of the given accounts (count = accounts in `scope` managed by that AM), sorted by name. */
export function amOptions(all: AccountSummary[], scope: AccountSummary[]): AmOption[] {
  const users = new Map<string, UserRef>();
  for (const a of all) users.set(a.am.id, a.am);
  return [...users.values()]
    .map((user) => ({ user, count: scope.filter((a) => a.am.id === user.id).length }))
    .sort((x, y) => x.user.full_name.localeCompare(y.user.full_name, 'vi'));
}

/** 'Nguyễn Thu Hà' → 'Thu Hà' (how colleagues call each other); two-word names stay whole. */
export function shortPersonName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 ? words.slice(-2).join(' ') : fullName.trim();
}
