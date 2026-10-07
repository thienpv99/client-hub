// Small display pieces shared by the portfolio table (≥1280), the cards (<1280) and the timeline list.
import { CircleAlert, Clock } from 'lucide-react';
import type { UserRef, WaitingCounts } from '@/services/contract';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { ForecastLabel } from '@/components/common/forecast-label';
import { UserAvatar } from '@/components/common/user-avatar';
import { SMALL } from '@/components/common/cx';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { plannedEndDate, shortPersonName, slipTone } from './projectsModel';

const TONE_TEXT = { danger: 'text-danger', warning: 'text-warning' } as const;

/** "Thu Hà" with a small avatar (full name as tooltip) */
export function AmName({ user, className }: { user: UserRef; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)} title={user.full_name}>
      <UserAvatar user={user} size="xs" />
      <span className="truncate">{shortPersonName(user.full_name)}</span>
    </span>
  );
}

/** Overlapping avatars of the people with open work on the project (+N when more). */
export function TeamStack({ team, max = 4, size = 'xs' }: { team: UserRef[]; max?: number; size?: 'xs' | 'sm' }) {
  if (team.length === 0) return <span className="text-micro text-muted-foreground">{t('projects.team.none')}</span>;
  const shown = team.slice(0, max);
  const rest = team.length - shown.length;
  const names = team.map((u) => u.full_name).join(', ');
  return (
    <span className="inline-flex items-center" title={names}>
      <span className="sr-only">{t('projects.team.label', { names })}</span>
      {/* small overlap: on 20px avatars a deeper one hides the second initial ("NQ" would read "NC") */}
      <span aria-hidden="true" className={cn('inline-flex items-center', size === 'xs' ? '-space-x-0.5' : '-space-x-1.5')}>
        {shown.map((u) => (
          <UserAvatar key={u.id} user={u} size={size} ring />
        ))}
        {rest > 0 ? (
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-muted px-1 font-semibold tabular text-muted-foreground ring-2 ring-card',
              size === 'xs' ? 'h-5 min-w-[1.25rem] text-[11px]' : 'h-7 min-w-[1.75rem] text-micro',
            )}
          >
            +{rest}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Progress bar + "45%" (table cell). `detail` (cards): the KPI recipe — the bar, then "12/30 việc đã xong" with the
 * percentage on the right.
 */
export function ProgressInfo({ project: p, detail = false, className }: { project: ProjectPortfolioRow; detail?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(p.progress_pct)));
  const totalTasks = p.open_tasks + p.done_tasks;
  const tasksText = t('projects.progress.tasks', { done: p.done_tasks, total: totalTasks });
  if (detail) {
    return (
      <div className={cn('min-w-0', className)}>
        <Progress
          value={pct}
          aria-label={t('projects.progress.label', { name: p.name })}
          aria-valuetext={t('projects.progress.valueText', { pct })}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-micro text-muted-foreground">
          <span className="min-w-0 truncate tabular">{totalTasks > 0 ? tasksText : t('projects.progress.noTasks')}</span>
          <span className="shrink-0 font-medium tabular text-foreground" aria-hidden="true">
            {t('projects.progress.pct', { pct })}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)} title={tasksText}>
      <Progress
        value={pct}
        className="min-w-[3rem] flex-1"
        aria-label={t('projects.progress.label', { name: p.name })}
        aria-valuetext={t('projects.progress.valueText', { pct })}
      />
      <span className="w-9 shrink-0 text-right text-table font-medium tabular text-foreground">{t('projects.progress.pct', { pct })}</span>
    </div>
  );
}

/** "+6 ngày" (status tone, clock icon) or "Mốc chưa lùi" */
export function SlipLabel({ project: p, className }: { project: ProjectPortfolioRow; className?: string }) {
  if (p.status === 'done') {
    return <span className={cn('text-muted-foreground', className)}>{t('enums.projectStatus.done')}</span>;
  }
  if (p.slip_days <= 0) {
    return <span className={cn('text-muted-foreground', className)}>{t('projects.slip.onPlan')}</span>;
  }
  const full = t('projects.slip.title', { days: p.slip_days });
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium tabular', TONE_TEXT[slipTone(p)], className)}
      title={full}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{t('projects.slip.value', { days: p.slip_days })}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

/**
 * Planned end (final milestone) "11/11/2026", then "Dự báo 17/11/2026" when its forecast moved, else the relative
 * "còn 36 ngày". The tooltip names the final milestone and the project's end date. `compact` (table cell):
 * "◷ 17/11/2026" with the word "Dự báo" for screen readers only.
 */
export function EndDates({ project: p, compact = false, className }: { project: ProjectPortfolioRow; compact?: boolean; className?: string }) {
  const planned = plannedEndDate(p);
  const moved = p.forecast_end_date !== planned;
  const later = p.forecast_end_date > planned;
  const daysLeft = diffDays(planned, todayISO());
  const title = t('projects.end.title', {
    planned: formatDate(planned),
    forecast: formatDate(p.forecast_end_date),
    end: formatDate(p.end_date),
  });
  if (p.status === 'done') {
    // table cell: two short lines like the other rows ("24/06/2026" / "Đã xong") — keeps the column narrow
    if (compact) {
      return (
        <span className={cn('flex flex-col gap-0.5 tabular', className)} title={title}>
          <span className="whitespace-nowrap text-muted-foreground">{formatDate(p.forecast_end_date)}</span>
          <span className="whitespace-nowrap text-micro text-muted-foreground">{t('projects.end.doneShort')}</span>
        </span>
      );
    }
    return (
      <span className={cn('whitespace-nowrap tabular text-muted-foreground', className)} title={title}>
        {t('projects.end.done', { date: formatDate(p.forecast_end_date) })}
      </span>
    );
  }
  return (
    <span className={cn('flex flex-col gap-0.5 tabular', className)} title={title}>
      <span className={cn('whitespace-nowrap', moved ? 'text-muted-foreground' : 'text-foreground')}>{formatDate(planned)}</span>
      {moved ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 whitespace-nowrap font-medium',
            SMALL,
            later ? TONE_TEXT[slipTone(p)] : 'text-foreground',
          )}
        >
          {later ? <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
          {compact ? (
            <>
              <span className="sr-only">{t('projects.end.forecastSr')}</span>
              {formatDate(p.forecast_end_date)}
            </>
          ) : (
            t('projects.end.forecast', { date: formatDate(p.forecast_end_date) })
          )}
        </span>
      ) : (
        <span className="whitespace-nowrap text-micro text-muted-foreground">{formatRelativeDays(daysLeft)}</span>
      )}
    </span>
  );
}

/** Next milestone name + compact "28/10 → 03/11 · lùi 6 ngày" */
export function NextMilestone({ project: p, full = false }: { project: ProjectPortfolioRow; full?: boolean }) {
  const m = p.next_milestone;
  if (!m) {
    const key = p.milestones.length === 0 ? 'projects.next.none' : 'projects.next.allDone';
    return <span className="text-muted-foreground">{t(key)}</span>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="line-clamp-2 min-w-0 break-words font-medium text-foreground" title={m.name}>
        {m.name}
      </span>
      <ForecastLabel milestone={m} compact={!full} />
    </div>
  );
}

function OverdueBit({ count }: { count: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium text-danger', SMALL)}>
      <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('projects.waiting.overdue', { count })}
    </span>
  );
}

/** Two short lines for a table cell: "Khách 3 · ⓘ 1 quá hạn" / "New Era 2". */
export function WaitingCompact({ counts }: { counts: WaitingCounts }) {
  const rows = [
    { key: 'client', label: t('projects.waiting.client'), count: counts.waiting_client, overdue: counts.overdue_client },
    { key: 'internal', label: t('projects.waiting.internal'), count: counts.waiting_internal, overdue: counts.overdue_internal },
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <span key={r.key} className="inline-flex flex-wrap items-center gap-x-1.5 whitespace-nowrap">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="font-semibold tabular text-foreground">{r.count}</span>
          {r.overdue > 0 ? <OverdueBit count={r.overdue} /> : null}
        </span>
      ))}
    </div>
  );
}
