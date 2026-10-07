import { ArrowRight, CircleCheck, Clock } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';
import { assertNever, lowerFirst } from './labels';

function causeText(m: MilestoneView): string | null {
  const c = m.cause;
  if (!c) return null;
  const days = c.delay_days > 0 ? c.delay_days : m.delay_days;
  const withDays = days > 0;
  if (c.task_title === null || c.task_title.trim() === '') {
    return withDays ? t('components.forecast.causeHidden', { days }) : t('components.forecast.causeHiddenNoDays');
  }
  const task = lowerFirst(c.task_title.trim());
  if (c.side === 'internal') {
    return withDays ? t('components.forecast.causeInternal', { task, days }) : t('components.forecast.causeInternalNoDays', { task });
  }
  return withDays ? t('components.forecast.causeClient', { task, days }) : t('components.forecast.causeClientNoDays', { task });
}

/**
 * Why the forecast moved, without the dates:
 * "do chờ duyệt thiết kế màn hình Đặt hàng 6 ngày" · "do New Era chậm …" · "do mốc Thiết kế lùi 6 ngày" ·
 * "{reason} (điều chỉnh tay)". null when on plan / done.
 * `bareManual`: the caller already shows an "Điều chỉnh tay" tag → the reason alone (null without a reason).
 */
export function forecastReasonText(m: MilestoneView, bareManual = false): string | null {
  switch (m.forecast_source) {
    case 'on_plan':
    case 'done':
      return null;
    case 'manual': {
      // override_reason is stripped for client viewers (key may be missing entirely)
      const reason = typeof m.override_reason === 'string' ? m.override_reason.trim() : '';
      if (bareManual) return reason || null;
      return reason ? t('components.forecast.manual', { reason }) : t('components.forecast.manualNoReason');
    }
    case 'cascade':
      if (m.cascade_from) {
        return m.delay_days > 0
          ? t('components.forecast.cascade', { milestone: m.cascade_from.milestone_name, days: m.delay_days })
          : t('components.forecast.cascadeNoDays', { milestone: m.cascade_from.milestone_name });
      }
      return causeText(m);
    case 'dependency':
      return causeText(m);
    default:
      return assertNever(m.forecast_source);
  }
}

/** "Kế hoạch 28/10 → Dự báo 03/11 · do chờ duyệt thiết kế 6 ngày" as plain text (tooltips, emails, digest). */
export function forecastSentence(m: MilestoneView, showReason = true): string {
  if (m.status === 'done' || m.forecast_source === 'done') {
    const d = m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
    return t('components.forecast.done', { date: formatDateShort(d) });
  }
  const planned = t('components.forecast.planned', { date: formatDateShort(m.planned_date) });
  const reason = showReason ? forecastReasonText(m) : null;
  if (m.forecast_date === m.planned_date) {
    const parts = [planned, t('components.forecast.onPlan')];
    if (reason && m.forecast_source === 'manual') parts.push(reason);
    return parts.join(' · ');
  }
  const head = `${planned} → ${t('components.forecast.forecast', { date: formatDateShort(m.forecast_date) })}`;
  return reason ? `${head} · ${reason}` : head;
}

export interface ForecastLabelProps {
  milestone: MilestoneView;
  /** show the "do …" caption (default true) */
  showReason?: boolean;
  /** table cell: "28/10 → 03/11 · lùi 6 ngày" on one line, full sentence in the tooltip */
  compact?: boolean;
  /** the caller shows its own "Điều chỉnh tay" tag next to the label: leave the "(điều chỉnh tay)" suffix out */
  manualTagShown?: boolean;
  className?: string;
}

/**
 * Planned → forecast dates of a milestone: "28/10 → 03/11  [◷ lùi 6 ngày]" with the reason as a caption below
 * ("do chờ duyệt thiết kế màn hình Đặt hàng 6 ngày"). The planned / forecast words are read to screen readers.
 */
export function ForecastLabel({ milestone: m, showReason = true, compact = false, manualTagShown = false, className }: ForecastLabelProps) {
  const sentence = forecastSentence(m, true);
  const textSize = compact ? SMALL : 'text-table';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (m.status === 'done' || m.forecast_source === 'done') {
    const d = m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
    return (
      <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap font-medium tabular text-success', textSize, className)} title={sentence}>
        <CircleCheck className={cx('shrink-0', iconSize)} aria-hidden="true" />
        {t(compact ? 'components.forecast.doneCompact' : 'components.forecast.done', { date: formatDateShort(d) })}
      </span>
    );
  }

  const plannedShort = formatDateShort(m.planned_date);
  const forecastShort = formatDateShort(m.forecast_date);
  const shift = diffDays(m.forecast_date, m.planned_date);
  const reason = showReason ? forecastReasonText(m, manualTagShown) : null;

  if (shift === 0) {
    const manualReason = !compact && reason && m.forecast_source === 'manual' ? reason : null;
    return (
      <span className={cx('inline-flex min-w-0 flex-col gap-0.5', textSize, className)} title={sentence}>
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular">
          <span className="whitespace-nowrap text-foreground">
            <span className="sr-only">{t('components.forecast.plannedSr')} </span>
            {plannedShort}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-success">
            <CircleCheck className={cx('shrink-0', iconSize)} aria-hidden="true" />
            {t('components.forecast.onPlan')}
          </span>
        </span>
        {manualReason ? <span className="text-caption">{manualReason}</span> : null}
      </span>
    );
  }

  const later = shift > 0;
  const dates = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular">
      <span className="text-muted-foreground">
        <span className="sr-only">{t('components.forecast.plannedSr')} </span>
        {plannedShort}
      </span>
      <ArrowRight className={cx('shrink-0 text-caption', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
      <span className={cx('font-semibold', later ? 'text-danger' : 'text-foreground')}>
        <span className="sr-only">{t('components.forecast.forecastSr')} </span>
        {forecastShort}
      </span>
    </span>
  );
  const shiftText = t(later ? 'components.forecast.later' : 'components.forecast.earlier', { days: Math.abs(shift) });

  if (compact) {
    return (
      <span className={cx('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5', textSize, className)} title={sentence}>
        {dates}
        <span className={cx('inline-flex items-center gap-1 whitespace-nowrap', later ? 'font-medium text-danger' : 'text-muted-foreground')}>
          {later ? <Clock className={cx('shrink-0', iconSize)} aria-hidden="true" /> : <span aria-hidden="true">·</span>}
          {shiftText}
        </span>
      </span>
    );
  }

  return (
    <span className={cx('inline-flex min-w-0 flex-col gap-1', textSize, className)} title={sentence}>
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        {dates}
        <span
          className={cx(
            'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-micro font-medium',
            later ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground',
          )}
        >
          {later ? <Clock className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" /> : null}
          {shiftText}
        </span>
      </span>
      {reason ? <span className="text-caption">{reason}</span> : null}
    </span>
  );
}
