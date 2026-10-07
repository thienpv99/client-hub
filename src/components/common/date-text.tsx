import type { ISODate, ISODateTime } from '@/domain/types';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { cx } from './cx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Relative wording for a calendar date: 'hôm nay', 'hôm qua', 'ngày mai', '3 ngày trước', '5 ngày nữa'. */
export function relativeDayText(d: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(d, today);
  if (n === 0) return t('components.date.today');
  if (n === -1) return t('components.date.yesterday');
  if (n === 1) return t('components.date.tomorrow');
  return n < 0 ? t('components.date.daysAgo', { days: -n }) : t('components.date.inDays', { days: n });
}

export interface DateTextProps {
  value: ISODate | ISODateTime | null | undefined;
  /** "2 giờ trước" with the absolute date/time in a tooltip */
  relative?: boolean;
  /** include the time (date-times only): "06/10/2026 14:05" */
  time?: boolean;
  className?: string;
}

export function DateText({ value, relative = false, time = false, className }: DateTextProps) {
  if (!value) {
    return <span className={cx('text-caption', className)}>{t('components.date.none')}</span>;
  }
  const dateOnly = value.length === 10;
  const absolute = dateOnly || !time ? formatDate(value) : formatDateTime(value);
  if (!relative) {
    return (
      <time dateTime={value} className={cx('tabular whitespace-nowrap', className)}>
        {absolute}
      </time>
    );
  }
  const rel = dateOnly ? relativeDayText(value) : formatRelativeTime(value);
  const full = dateOnly ? formatDate(value) : formatDateTime(value);
  // Tooltip uses the app's TooltipProvider, or brings its own
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={value} className={cx('tabular whitespace-nowrap', className)}>
          {rel}
        </time>
      </TooltipTrigger>
      <TooltipContent>
        <span className="tabular">{full}</span>
      </TooltipContent>
    </Tooltip>
  );
}
