// Vietnamese formatting helpers (owner G1). Thousands separator '.', decimal ',', dates dd/mm/yyyy,
// currency '₫' after a non-breaking space. Dates are interpreted in Asia/Ho_Chi_Minh (see domain/clock).
import type { ISODate, ISODateTime } from '@/domain/types';
import { dateOf, now, todayISO } from '@/domain/clock';
import { diffDays, weekday } from '@/domain/dates';
import { t } from '@/i18n';

const NBSP = ' ';
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DASH = '—';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Fixed or trimmed decimal formatting without Intl (stable across browsers). */
function formatDecimal(v: number, digits: number, trim: boolean): string {
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(digits);
  let [intPart, frac = ''] = fixed.split('.');
  if (trim) frac = frac.replace(/0+$/, '');
  const isZero = /^0*$/.test(intPart + frac);
  const body = groupThousands(intPart) + (frac ? `,${frac}` : '');
  return neg && !isZero ? `-${body}` : body;
}

/** 1234.5 → '1.234,5'. Without `digits`: up to 2 decimals, trailing zeros trimmed. */
export function formatNumber(v: number, digits?: number): string {
  if (!Number.isFinite(v)) return DASH;
  if (digits === undefined) return formatDecimal(v, 2, true);
  return formatDecimal(v, Math.max(0, Math.min(20, Math.floor(digits))), false);
}

/** 1250000000 → '1.250.000.000 ₫' (whole VND) */
export function formatMoney(v: number): string {
  if (!Number.isFinite(v)) return DASH;
  return `${formatDecimal(Math.round(v), 0, false)}${NBSP}${t('common.money.currency')}`;
}

/** KPI form: '1,25 tỷ ₫' · '850 tr ₫' · '12,5 tr ₫' · '950.000 ₫' */
export function formatMoneyCompact(v: number): string {
  if (!Number.isFinite(v)) return DASH;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const currency = t('common.money.currency');
  if (abs >= 1e6) {
    const millions = Number((abs / 1e6).toFixed(1));
    if (abs >= 1e9 || millions >= 1000) {
      return `${sign}${formatDecimal(abs / 1e9, 2, true)}${NBSP}${t('common.money.billion')}${NBSP}${currency}`;
    }
    return `${sign}${formatDecimal(abs / 1e6, 1, true)}${NBSP}${t('common.money.million')}${NBSP}${currency}`;
  }
  return formatMoney(v);
}

/** 15 → '15%' (value already in percent) */
export function formatPercent(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return DASH;
  return `${formatNumber(v, digits)}%`;
}

function vnDate(d: ISODate | ISODateTime | null | undefined): ISODate | null {
  if (!d) return null;
  try {
    const day = dateOf(d);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

/** '2026-10-06' or an ISODateTime → '06/10/2026' */
export function formatDate(d: ISODate | ISODateTime): string {
  const day = vnDate(d);
  if (!day) return DASH;
  const [y, m, dd] = day.split('-');
  return `${dd}/${m}/${y}`;
}

/**
 * '06/10' in the current year (Asia/Ho_Chi_Minh); another year keeps it: '08/01/2027' — a chain "18/10 → 08/01"
 * would read backwards in time.
 */
export function formatDateShort(d: ISODate | ISODateTime): string {
  const day = vnDate(d);
  if (!day) return DASH;
  const [y, m, dd] = day.split('-');
  return y === todayISO().slice(0, 4) ? `${dd}/${m}` : `${dd}/${m}/${y}`;
}

/** '06/10/2026 14:05' (Vietnam wall time) */
export function formatDateTime(dt: ISODateTime): string {
  if (!dt) return DASH;
  if (dt.length === 10) return formatDate(dt);
  const ms = new Date(dt).getTime();
  if (Number.isNaN(ms)) return DASH;
  const iso = new Date(ms + OFFSET_MS).toISOString(); // YYYY-MM-DDTHH:mm…
  const [y, m, dd] = iso.slice(0, 10).split('-');
  return `${dd}/${m}/${y} ${iso.slice(11, 16)}`;
}

/** 'Thứ Hai' */
export function formatWeekday(d: ISODate | ISODateTime): string {
  const day = vnDate(d);
  if (!day) return DASH;
  return t(`common.weekday.${weekday(day)}`);
}

/** 'hôm nay' | 'ngày mai' | 'còn 5 ngày' | 'quá hạn 3 ngày' */
export function formatRelativeDays(daysLeft: number): string {
  if (!Number.isFinite(daysLeft)) return DASH;
  const n = Math.trunc(daysLeft);
  if (n === 0) return t('common.relative.today');
  if (n === 1) return t('common.relative.tomorrow');
  if (n > 1) return t('common.relative.daysLeft', { n });
  return t('common.relative.overdueDays', { n: Math.abs(n) });
}

/** 'vừa xong' | '5 phút trước' | '2 giờ trước' | 'hôm qua' | '3 ngày trước' | '06/10/2026' */
export function formatRelativeTime(dt: ISODateTime): string {
  if (!dt) return DASH;
  const ms = new Date(dt).getTime();
  if (Number.isNaN(ms)) return DASH;
  const diffMs = now().getTime() - ms;
  if (diffMs < -60_000) return formatDate(dt); // future instant: show the date
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('common.relative.justNow');
  if (minutes < 60) return t('common.relative.minutesAgo', { n: minutes });
  const days = diffDays(todayISO(), dateOf(dt));
  if (days <= 0) return t('common.relative.hoursAgo', { n: Math.max(1, Math.floor(minutes / 60)) });
  if (days === 1) return t('common.relative.yesterday');
  if (days < 7) return t('common.relative.daysAgo', { n: days });
  return formatDate(dt);
}

/** 1234567 → '1,2 MB' */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return DASH;
  if (bytes < 1024) return `${Math.round(bytes)}${NBSP}${t('common.fileSize.b')}`;
  const units = ['kb', 'mb', 'gb'] as const;
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${formatDecimal(value, 1, true)}${NBSP}${t(`common.fileSize.${units[i]}`)}`;
}
