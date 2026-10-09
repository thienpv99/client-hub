// Pure helpers of the group matrix ("Ma trận", /app/map?view=matrix&eco=<ecosystemId>, SPEC-CARE §6.6): which groups
// the viewer can open, the room-to-sell figures and where a cell leads (the account's Triển khai or Mở rộng tab).
import type { SolutionCategory } from '@/domain/careTypes';
import type { ID } from '@/domain/types';
import type { CarePortfolioRow, EcosystemRef, GroupMatrix, MatrixCellState, MatrixCellView } from '@/services/careContract';

/** the URL of the matrix of one group (the dashboard and the command palette link here) */
export function matrixHref(ecosystemId?: ID | null): string {
  return ecosystemId ? `/app/map?view=matrix&eco=${encodeURIComponent(ecosystemId)}` : '/app/map?view=matrix';
}

export function accountHref(accountId: ID): string {
  return `/app/accounts/${encodeURIComponent(accountId)}`;
}

/**
 * Where a cell leads: the opportunity of ONE department (also inside a cell already in use) → that department on
 * "Mở rộng" (`?dept=`); otherwise in use / being rolled out → "Triển khai"; an opportunity or an empty cell → "Mở rộng".
 */
export function cellTarget(cell: Pick<MatrixCellView, 'state' | 'opportunities'>): 'delivery' | 'expansion' {
  if (cell.opportunities.length === 1) return 'expansion';
  const state: MatrixCellState = cell.state;
  return state === 'live' || state === 'in_progress' ? 'delivery' : 'expansion';
}

export function cellHref(accountId: ID, cell: Pick<MatrixCellView, 'state' | 'opportunities'>): string {
  const tab = cellTarget(cell);
  const base = `/app/accounts/${encodeURIComponent(accountId)}/${tab}`;
  const only = tab === 'expansion' && cell.opportunities.length === 1 ? cell.opportunities[0] : undefined;
  return only ? `${base}?dept=${encodeURIComponent(only.department)}` : base;
}

/** a cell already in use (or being rolled out) where another department still wants something of that category */
export function hasExtraOpportunity(cell: Pick<MatrixCellView, 'state' | 'opportunities'>): boolean {
  return (cell.state === 'live' || cell.state === 'in_progress') && cell.opportunities.length > 0;
}

export interface GroupOption {
  eco: EcosystemRef;
  /** companies of the group the viewer may read (an AM: her own) */
  units: number;
}

/** groups holding at least one account the viewer reads (= the groups getGroupMatrix answers for), by name */
export function groupOptions(rows: CarePortfolioRow[]): GroupOption[] {
  const map = new Map<ID, GroupOption>();
  for (const r of rows) {
    if (!r.ecosystem) continue;
    const o = map.get(r.ecosystem.id) ?? { eco: r.ecosystem, units: 0 };
    o.units += 1;
    map.set(r.ecosystem.id, o);
  }
  return [...map.values()].sort((a, b) => a.eco.name.localeCompare(b.eco.name, 'vi'));
}

export interface RoomToSell {
  /** department opportunities of the signed companies — wherever they sit (the count that matches estValue) */
  opportunities: number;
  /** cells where the unit uses nothing of that category yet */
  none: number;
  /** Σ estimated value of the opportunities, VND */
  estValue: number;
  live: number;
  inProgress: number;
  /** prospects shown in the matrix but left out of these figures */
  unsigned: number;
}

export function roomToSell(m: GroupMatrix): RoomToSell {
  return {
    opportunities: m.totals.opportunities,
    none: m.totals.none,
    estValue: m.totals.est_value,
    live: m.totals.live,
    inProgress: m.totals.in_progress,
    unsigned: m.totals.unsigned_units,
  };
}

/**
 * per category: signed companies that could still buy it (an opportunity — also inside a cell already in use — or an
 * empty cell) — the footer of the matrix; never "Đã phủ hết" while an opportunity is open
 */
export function categoryRoom(m: GroupMatrix): Record<SolutionCategory, number> {
  const out = {} as Record<SolutionCategory, number>;
  for (const c of m.categories) out[c.category] = 0;
  for (const u of m.units) {
    if (!u.signed) continue;
    for (const cell of u.cells) {
      if (cell.state === 'opportunity' || cell.state === 'none' || cell.opportunities.length > 0) out[cell.category] = (out[cell.category] ?? 0) + 1;
    }
  }
  return out;
}

/** Σ estimated value of a cell's opportunities */
export function cellValue(cell: MatrixCellView): number {
  return cell.opportunities.reduce((s, o) => s + (o.est_value ?? 0), 0);
}
