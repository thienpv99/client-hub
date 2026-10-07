// Small wording helpers for the notification settings (digest time, reminder days).
import { t } from '@/i18n';

/** 8 → '08:00' */
export function digestTime(hour: number): string {
  const h = Math.min(23, Math.max(0, Math.floor(Number.isFinite(hour) ? hour : 8)));
  return `${String(h).padStart(2, '0')}:00`;
}

/** 1 → 'Thứ Hai' (0 or 7 → 'Chủ nhật') */
export function weekdayName(weekday: number): string {
  return t(`common.weekday.${((Math.floor(weekday) % 7) + 7) % 7}`);
}

/** [1, 3] → '3 ngày và 1 ngày' (largest first) */
export function reminderDaysText(days: number[]): string {
  const parts = [...new Set(days)]
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a)
    .map((n) => t('notify.rules.day', { n }));
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}${t('notify.rules.daysJoin')}${parts[parts.length - 1]}`;
}
