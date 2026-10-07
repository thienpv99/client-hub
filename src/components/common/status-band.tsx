import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Clock, Flag } from 'lucide-react';
import type { MilestoneView, StatusLine } from '@/services/contract';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx } from './cx';
import { HEALTH_TONES, healthLabel } from './health-badge';
import { assertNever } from './labels';

/**
 * The one-sentence status of SPEC §5.1, e.g.
 * "Mốc Go-live đang chờ 1 việc từ phía anh. Mỗi ngày chậm, Go-live lùi thêm 1 ngày."
 * `salutation` is the viewer's stored salutation ('anh' / 'chị'); without one the sentence says "khách hàng".
 */
export function statusLineText(line: StatusLine, salutation?: string | null): string {
  switch (line.kind) {
    case 'on_track':
      return t('components.statusBand.on_track');
    case 'due_soon_blocking':
      return t('components.statusBand.due_soon_blocking', { count: line.count, milestone: line.milestone_name });
    case 'overdue':
      return t('components.statusBand.overdue', { count: line.count });
    case 'payment_overdue':
      return t('components.statusBand.payment_overdue', { count: line.count });
    case 'waiting_client': {
      const who = salutation && salutation.trim() ? salutation.trim() : t('components.statusBand.clientSide');
      return t('components.statusBand.waiting_client', {
        count: line.count,
        milestone: line.milestone_name,
        salutation: who,
      });
    }
    case 'waiting_internal': {
      const hidden = line.task_title === null || line.task_title.trim() === '';
      const params = { milestone: line.milestone_name, days: line.delay_days, task: line.task_title };
      if (line.delay_days > 0) {
        return t(hidden ? 'components.statusBand.waiting_internal_hidden' : 'components.statusBand.waiting_internal', params);
      }
      return t(hidden ? 'components.statusBand.waiting_internal_risk_hidden' : 'components.statusBand.waiting_internal_risk', params);
    }
    case 'generic':
      return t(`components.statusBand.generic.${line.tone}`);
    default:
      return assertNever(line);
  }
}

/** The milestone the band talks about (usually the project's next / launch milestone). */
export type StatusBandMilestone = Pick<MilestoneView, 'name' | 'planned_date' | 'forecast_date'> & { status?: MilestoneView['status'] };

/** White chip on the tinted hero: "Go-live · 28/10 → 03/11" (slip in danger with a clock) or "Go-live · 24/10 ✓". */
function MilestoneChip({ milestone: m }: { milestone: StatusBandMilestone }) {
  const later = m.forecast_date > m.planned_date;
  const shifted = m.forecast_date !== m.planned_date;
  const planned = formatDateShort(m.planned_date);
  const forecast = formatDateShort(m.forecast_date);
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-table shadow-xs ring-1 ring-inset ring-border/70"
      title={shifted ? t('components.stepper.forecastTitle', { planned, forecast }) : undefined}
    >
      <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground" title={m.name}>
        <span className="sr-only">{t('components.statusBand.milestoneSr')} </span>
        {m.name}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 tabular text-muted-foreground">
        {shifted ? (
          <>
            <span className="sr-only">{t('components.forecast.plannedSr')} </span>
            <span>{planned}</span>
            <ArrowRight className="h-3.5 w-3.5 text-caption" aria-hidden="true" />
            <span className={cx('inline-flex items-center gap-1 font-semibold', later ? 'text-danger' : 'text-foreground')}>
              <span className="sr-only">{t('components.forecast.forecastSr')} </span>
              {later ? <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              {forecast}
            </span>
          </>
        ) : (
          <>
            <span>{planned}</span>
            <span className="inline-flex items-center gap-1 text-success">
              <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t('components.forecast.onPlan')}</span>
            </span>
          </>
        )}
      </span>
    </span>
  );
}

/** Without an explicit milestone: how far the waited-for milestone has already slipped ("Go-live lùi 6 ngày"). */
function DelayChip({ milestone, days }: { milestone: string; days: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-table shadow-xs ring-1 ring-inset ring-border/70">
      <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{milestone}</span>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular text-danger">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('components.statusBand.delayChip', { days })}
      </span>
    </span>
  );
}

export interface StatusBandProps {
  line: StatusLine;
  /** 'anh' | 'chị' (or a full address such as 'anh Minh'); null → "khách hàng" */
  salutation?: string | null;
  /** milestone chip on the right (below on phones): name + planned → forecast */
  milestone?: StatusBandMilestone | null;
  /** custom content in the chip slot (replaces the milestone chip) */
  aside?: ReactNode;
  /** small status word above the sentence ("Đang bị chặn"); default true */
  showLabel?: boolean;
  className?: string;
}

/**
 * The status hero of the client home (DESIGN §5): full-width soft tint, 24px icon in a white circle, one sentence,
 * milestone chip. Also used by the digest and the view-as-client screens.
 */
export function StatusBand({ line, salutation, milestone, aside, showLabel = true, className }: StatusBandProps) {
  const tone = HEALTH_TONES[line.tone];
  const Icon = tone.icon;
  const text = statusLineText(line, salutation);
  const chip: ReactNode =
    aside ??
    (milestone ? (
      <MilestoneChip milestone={milestone} />
    ) : line.kind === 'waiting_client' && line.delay_days > 0 ? (
      <DelayChip milestone={line.milestone_name} days={line.delay_days} />
    ) : null);
  return (
    <div
      className={cx(
        'flex w-full flex-col gap-3 rounded-xl p-4 ring-1 ring-inset sm:flex-row sm:items-center sm:gap-5 sm:p-5',
        tone.soft,
        tone.ring,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
        <span
          className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-xs', tone.text)}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          {showLabel ? (
            <p className={cx('text-micro font-semibold', tone.text)}>{healthLabel(line.tone)}</p>
          ) : (
            <span className="sr-only">{healthLabel(line.tone)}: </span>
          )}
          <p className={cx('text-pretty break-words text-body font-medium text-ink sm:text-heading', showLabel && 'mt-0.5')}>{text}</p>
        </div>
      </div>
      {chip ? <div className="flex min-w-0 pl-14 sm:shrink-0 sm:pl-0">{chip}</div> : null}
    </div>
  );
}
