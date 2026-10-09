// Portfolio filtering and sorting (pure, client-side). Shared by the dashboard and the accounts page.
// SPEC-CARE §6.2–6.3: each account may carry its care row (director / AM: deployments, departments, requests, care,
// decision maker) — the care filters, the care sort and the "Chăm sóc" view use it; members have none.
import type { AccountSummary, Health, HealthReason, UserRef } from '@/services/contract';
import type { CarePortfolioRow, CareStatus, DeliveryHealth } from '@/services/careContract';
import { isSignedStage } from '@/domain/care';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';

/** an account of the portfolio, with its care row when the viewer may read care data (director / AM) */
export type PortfolioAccount = AccountSummary & { careRow: CarePortfolioRow | null };

/** joins the care rows (api.getCarePortfolio) onto the summaries by account id */
export function withCare(accounts: AccountSummary[], rows: CarePortfolioRow[] | null | undefined): PortfolioAccount[] {
  const byId = new Map<string, CarePortfolioRow>();
  for (const r of rows ?? []) byId.set(r.account.id, r);
  return accounts.map((a) => ({ ...a, careRow: byId.get(a.id) ?? null }));
}

/** Quick chips of SPEC §4.1 / SPEC-CARE §6.3 plus the KPI shortcuts of the dashboard. */
export type StatusFilter =
  | 'blocked'
  | 'waiting_client'
  | 'overdue_receivable'
  | 'at_risk'
  | 'overdue_tasks'
  | 'receivable'
  | 'debt'
  | 'untriaged'
  | 'care_overdue';

/** Filters shown as chips (the others are applied from the KPI cards); care first — the page's focus. */
export const CHIP_FILTERS = ['debt', 'care_overdue', 'blocked', 'waiting_client', 'overdue_receivable'] as const;
export type ChipFilterValue = (typeof CHIP_FILTERS)[number];

/** Filters that need money columns (hidden from internal members, who get no commercial data). */
const MONEY_FILTERS: ReadonlySet<StatusFilter> = new Set<StatusFilter>(['overdue_receivable', 'receivable']);
/** Filters that need care data (director / AM only). */
const CARE_FILTERS: ReadonlySet<StatusFilter> = new Set<StatusFilter>(['debt', 'untriaged', 'care_overdue']);

const STATUS_FILTERS: readonly StatusFilter[] = [
  'blocked',
  'waiting_client',
  'overdue_receivable',
  'at_risk',
  'overdue_tasks',
  'receivable',
  'debt',
  'untriaged',
  'care_overdue',
];

export type SortKey = 'care' | 'health' | 'name' | 'receivable' | 'next';
export const SORT_KEYS: readonly SortKey[] = ['care', 'health', 'name', 'receivable', 'next'];
/** most in need of care first (delivery debt → overdue care → health); viewers without care data fall back to health */
export const DEFAULT_SORT: SortKey = 'care';

/** "Chăm sóc" (deployments, requests, next care action, decision maker) or "Tiến độ" (milestones, waiting, money) */
export type PortfolioView = 'care' | 'progress';
export const DEFAULT_VIEW: PortfolioView = 'care';

export function isPortfolioView(v: string | null | undefined): v is PortfolioView {
  return v === 'care' || v === 'progress';
}

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

export function needsCare(f: StatusFilter): boolean {
  return CARE_FILTERS.has(f);
}

/** what the viewer's data allows: money (director / AM) and care rows (director / AM) */
export interface PortfolioCaps {
  money: boolean;
  care: boolean;
}

/** The status filter in force for this viewer (money / care filters are ignored for viewers without that data). */
export function effectiveStatus(status: StatusFilter | null, caps: PortfolioCaps): StatusFilter | null {
  if (!status) return null;
  if (!caps.money && needsMoney(status)) return null;
  if (!caps.care && needsCare(status)) return null;
  return status;
}

export function effectiveSort(sort: SortKey, caps: PortfolioCaps): SortKey {
  if (!caps.care && sort === 'care') return 'health';
  if (!caps.money && sort === 'receivable') return 'health';
  return sort;
}

export function effectiveView(view: PortfolioView, caps: PortfolioCaps): PortfolioView {
  return caps.care ? view : 'progress';
}

/** the words of a filter on the "đang lọc" line / a chip */
export function filterLabel(f: StatusFilter): string {
  return needsCare(f) ? t(`carePortfolio.portfolio.filters.${f}`) : t(`dashboard.portfolio.filters.${f}`);
}

export function chipLabel(f: ChipFilterValue): string {
  return f === 'debt' || f === 'care_overdue' ? t(`carePortfolio.portfolio.chips.${f}`) : t(`dashboard.portfolio.chips.${f}`);
}

export function sortLabel(k: SortKey): string {
  return k === 'care' ? t('carePortfolio.sort.care') : t(`dashboard.accounts.sort.${k}`);
}

export function matchesStatus(a: PortfolioAccount, f: StatusFilter): boolean {
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
    case 'debt':
      return (a.careRow?.requests.debt ?? 0) > 0;
    case 'untriaged':
      return (a.careRow?.requests.untriaged ?? 0) > 0;
    case 'care_overdue':
      // the care rhythm is about signed clients (same rule as the KPI tile)
      return a.careRow?.care.status === 'overdue' && isSignedStage(a.stage);
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

export function applyCriteria(list: PortfolioAccount[], c: PortfolioCriteria): PortfolioAccount[] {
  const q = normalizeText(c.query);
  return list.filter(
    (a) => (!c.status || matchesStatus(a, c.status)) && (!c.amId || a.am.id === c.amId) && matchesSearch(a, q),
  );
}

const HEALTH_RANK: Record<Health, number> = { blocked: 0, attention: 1, on_track: 2 };
const DELIVERY_RANK: Record<DeliveryHealth, number> = { debt: 0, attention: 1, ok: 2 };
const CARE_RANK: Record<CareStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

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

function byHealth(a: AccountSummary, b: AccountSummary): number {
  return HEALTH_RANK[a.health.value] - HEALTH_RANK[b.health.value] || worstDelay(b.health.reasons) - worstDelay(a.health.reasons);
}

/**
 * the order of api.getCarePortfolio: delivery debt → requests waiting too long → overdue care → health; prospects (no
 * signed contract) come last — the care list is about the clients New Era serves
 */
function byCare(a: PortfolioAccount, b: PortfolioAccount): number {
  const ra = a.careRow;
  const rb = b.careRow;
  const signedA = isSignedStage(a.stage);
  const signedB = isSignedStage(b.stage);
  if (signedA !== signedB) return signedA ? -1 : 1;
  if (ra && rb) {
    return (
      DELIVERY_RANK[ra.requests.delivery_health] - DELIVERY_RANK[rb.requests.delivery_health] ||
      CARE_RANK[ra.care.status] - CARE_RANK[rb.care.status] ||
      byHealth(a, b)
    );
  }
  if (ra || rb) return ra ? -1 : 1;
  return byHealth(a, b);
}

export function sortPortfolio(list: PortfolioAccount[], key: SortKey): PortfolioAccount[] {
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
    case 'care':
      return out.sort((a, b) => byCare(a, b) || byName(a, b));
    case 'health':
      return out.sort((a, b) => byHealth(a, b) || byName(a, b));
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
