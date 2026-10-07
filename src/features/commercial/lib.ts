// Small helpers shared by the commercial screens (no React).
import type { ApiErrorCode, Viewer } from '@/services/contract';
import { formatNumber } from '@/lib/format';

export const COMMERCIAL_TABS = ['quotes', 'contracts', 'receivables', 'prices'] as const;
export type CommercialTab = (typeof COMMERCIAL_TABS)[number];

export function isCommercialTab(x: string | undefined): x is CommercialTab {
  return !!x && (COMMERCIAL_TABS as readonly string[]).includes(x);
}

/** 15 → '15%', 12.35 → '12,4%' (at most one decimal) */
export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return `${formatNumber(Math.round(v * 10) / 10)}%`;
}

/** '12,5' | '12.5' → 12.5; '' → 0; anything else → NaN */
export function parseDecimal(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return 0;
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return Number.NaN;
  return Number(s);
}

/** '4.300.000' → 4300000; '' → 0 */
export function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/** 4300000 → '4.300.000' (no currency, for inputs) */
export function groupDigits(v: number): string {
  if (!Number.isFinite(v)) return '';
  return Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** director or AM, signed in as themselves (not "Xem như khách hàng"). AMs only ever read their own accounts. */
export function canManageCommercial(viewer: Viewer | null): boolean {
  return !!viewer && viewer.org_type === 'internal' && !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');
}

/** director or AM (commercial data is theirs; members and clients use other screens) */
export function canReadInternalCommercial(viewer: Viewer | null): boolean {
  return !!viewer && viewer.org_type === 'internal' && (viewer.role === 'director' || viewer.role === 'am');
}

export function errorCode(err: unknown): ApiErrorCode | null {
  if (!err || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? (code as ApiErrorCode) : null;
}
