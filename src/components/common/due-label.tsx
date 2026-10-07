import { CalendarDays, Check, CircleAlert, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DueInfo } from '@/services/contract';
import type { ISODateTime } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import { t } from '@/i18n';
import { formatDate, formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';

export type DueTone = 'done' | 'overdue' | 'soon' | 'normal';

/** "Còn 2 ngày · 15/10", "Hôm nay · 06/10", "Ngày mai · 07/10", "Đã quá hạn 3 ngày", "Xong · 03/10" */
export function dueLabelText(
  due: DueInfo,
  opts: { done?: boolean; completedAt?: ISODateTime | null; compact?: boolean } = {},
): { text: string; tone: DueTone } {
  if (opts.done) {
    const at = opts.completedAt ? formatDateShort(dateOf(opts.completedAt)) : null;
    return { text: at ? t('components.due.done', { date: at }) : t('components.due.doneNoDate'), tone: 'done' };
  }
  const date = formatDateShort(due.due_date);
  if (due.overdue) {
    const days = Math.max(1, due.overdue_days);
    return { text: t(opts.compact ? 'components.due.overdueCompact' : 'components.due.overdue', { days }), tone: 'overdue' };
  }
  const tone: DueTone = due.due_soon ? 'soon' : 'normal';
  if (due.days_left === 0) return { text: t('components.due.today', { date }), tone };
  if (due.days_left === 1) return { text: t('components.due.tomorrow', { date }), tone };
  if (due.days_left > 1) return { text: t('components.due.daysLeft', { days: due.days_left, date }), tone };
  return { text: t('components.due.plain', { date }), tone: 'normal' };
}

const TONES: Record<DueTone, { icon: LucideIcon; chip: string; text: string }> = {
  done: { icon: Check, chip: 'bg-success-soft text-success', text: 'text-success' },
  overdue: { icon: CircleAlert, chip: 'bg-danger-soft text-danger', text: 'font-medium text-danger' },
  soon: { icon: Clock, chip: 'bg-warning-soft text-warning', text: 'font-medium text-warning' },
  normal: { icon: CalendarDays, chip: 'bg-muted text-muted-foreground', text: 'text-muted-foreground' },
};

export interface DueLabelProps {
  due: DueInfo;
  done?: boolean;
  /** when done: the completion instant, shown as "Xong · 03/10" */
  completedAt?: ISODateTime | null;
  /** smaller chip for tables and dense rows ("Quá hạn 3 ngày") */
  compact?: boolean;
  /** 'chip' (default) = soft rounded chip; 'text' = icon + coloured text only (inside sentences) */
  variant?: 'chip' | 'text';
  className?: string;
}

export function DueLabel({ due, done = false, completedAt, compact = false, variant = 'chip', className }: DueLabelProps) {
  const { text, tone } = dueLabelText(due, { done, completedAt, compact });
  const style = TONES[tone];
  const Icon = style.icon;
  const title = t('components.due.title', { date: formatDate(due.due_date) });
  if (variant === 'text') {
    return (
      <span
        className={cx('inline-flex items-center whitespace-nowrap tabular', compact ? `gap-1 ${SMALL}` : 'gap-1.5 text-table', style.text, className)}
        title={title}
      >
        <Icon className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-medium tabular',
        compact ? 'h-6 gap-1 px-1.5 text-micro' : `h-7 gap-1.5 px-2 ${SMALL}`,
        style.chip,
        className,
      )}
      title={title}
    >
      <Icon className={compact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} strokeWidth={2.25} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
