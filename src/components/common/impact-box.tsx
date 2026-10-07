import { ArrowRight, Clock, Flag } from 'lucide-react';
import type { MilestoneRef } from '@/services/contract';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';

/** Milestone tag: "⚑ UAT 28/10 → ◷ 03/11" (slip in danger) or "⚑ Chạy thử 30/10". */
export function MilestoneTag({ milestone: m, className }: { milestone: MilestoneRef; className?: string }) {
  const shifted = m.forecast_date !== m.planned_date;
  const later = m.forecast_date > m.planned_date;
  return (
    <span
      className={cx(
        'inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-card px-2 py-1 text-muted-foreground shadow-xs ring-1 ring-inset ring-border/80',
        SMALL,
        className,
      )}
    >
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{m.name}</span>
      <span className="inline-flex shrink-0 items-center gap-1 tabular">
        {shifted ? <span className="sr-only">{t('components.forecast.plannedSr')} </span> : null}
        {formatDateShort(shifted ? m.planned_date : m.forecast_date)}
        {shifted ? (
          <>
            <ArrowRight className="h-3 w-3 text-caption" aria-hidden="true" />
            <span className={cx('inline-flex items-center gap-0.5', later ? 'font-semibold text-danger' : 'font-medium text-foreground')}>
              <span className="sr-only">{t('components.forecast.forecastSr')} </span>
              {later ? <Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
              {formatDateShort(m.forecast_date)}
            </span>
          </>
        ) : null}
      </span>
    </span>
  );
}

export interface ImpactBoxProps {
  /** the task's impact_text ("Nếu chưa duyệt trước 15/10, …") */
  text: string;
  /** milestones this task holds back */
  milestones: MilestoneRef[];
  className?: string;
}

/** "Nếu chưa làm" inset panel: 1–2 consequence sentences + tags of the affected milestones (SPEC §5.1). */
export function ImpactBox({ text, milestones, className }: ImpactBoxProps) {
  const body = text.trim();
  if (!body && milestones.length === 0) return null;
  return (
    <div className={cx('rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4', className)}>
      <p className="text-micro font-semibold text-muted-foreground">{t('components.impact.title')}</p>
      {body ? <p className="mt-1 text-table text-foreground sm:text-body">{body}</p> : null}
      {milestones.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t('components.impact.milestones')}>
          {milestones.map((m) => (
            <li key={m.id} className="max-w-full">
              <MilestoneTag milestone={m} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
