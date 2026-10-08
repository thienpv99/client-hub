// "Dòng thời gian" tab: the cross-project Gantt from 768px; on phones a list of projects ordered by their next
// milestone (soonest first) with the milestone steps and the end date. Both open with a one-line summary.
import { Link } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { HealthBadge } from '@/components/common/health-badge';
import { MICRO_MUTED, SMALL } from '@/components/common/cx';
import { ListSkeleton } from '@/components/common/skeletons';
import { StageStepper } from '@/components/common/stage-stepper';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { GanttChart } from './GanttChart';
import { CARD_INTERACTIVE, STRETCHED_LINK } from './PortfolioCards';
import { EndDates, NextMilestone, SlipLabel } from './ProjectBits';
import { roadmapHref } from './projectsModel';
import { sortForList } from './timelineModel';

export interface TimelineTabProps {
  rows: ProjectPortfolioRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry(): void;
}

/** "2 dự án đang trễ kế hoạch, trễ nhất là App bán hàng (+6 ngày)." / "Mọi dự án đang chạy đúng kế hoạch." */
export function timelineSummary(rows: ProjectPortfolioRow[]): string {
  const slipping = rows.filter((p) => p.status !== 'done' && p.slip_days > 0);
  if (slipping.length === 0) return t('projects.timeline.summaryCalm');
  const worst = slipping.reduce((a, b) => (b.slip_days > a.slip_days ? b : a));
  return t('projects.timeline.summarySlipping', { count: slipping.length, name: worst.name, days: worst.slip_days });
}

function GanttSkeleton() {
  return (
    <Card className="skeleton-reveal overflow-hidden" role="status" aria-busy="true">
      <span className="sr-only">{t('components.loading')}</span>
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-[18px] w-2/5 max-w-[22rem]" />
          <Skeleton className="h-3 w-3/5 max-w-[28rem]" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="h-12 border-y border-border/60 bg-subtle" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-[60px] items-center gap-4 border-b border-border/60 px-4 last:border-b-0 sm:px-5">
          <div className="flex w-52 shrink-0 items-center gap-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-2 rounded-full" style={{ marginLeft: `${(i * 7) % 30}%`, width: `${24 + ((i * 11) % 20)}%` }} />
        </div>
      ))}
    </Card>
  );
}

export function TimelineTab({ rows, loading, error, onRetry }: TimelineTabProps) {
  const chart = useMediaQuery('(min-width: 768px)');

  if (!rows) {
    if (loading) return chart ? <GanttSkeleton /> : <ListSkeleton rows={4} />;
    return (
      <Card>
        <ErrorState error={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarRange}
          title={t('projects.timeline.empty.title')}
          description={t('projects.timeline.empty.description')}
        />
      </Card>
    );
  }

  const summary = timelineSummary(rows);
  if (chart) return <GanttChart rows={rows} summary={summary} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-heading font-semibold tracking-tightish text-ink">{summary}</h2>
        <p className="mt-0.5 text-caption">{t('projects.timeline.hintList')}</p>
      </div>
      <TimelineList rows={rows} />
    </div>
  );
}

/**
 * Phone card: the same entity header as the portfolio cards (name full width, then health · slip), the next
 * milestone (plan → forecast) beside the end date, and the milestone steps.
 */
function TimelineList({ rows }: { rows: ProjectPortfolioRow[] }) {
  return (
    <ul className="space-y-3">
      {sortForList(rows).map((p) => (
        <li key={p.id} className={cn(CARD_INTERACTIVE, 'space-y-4 p-4 text-table')}>
          <div className="flex items-start gap-3">
            <AccountLogo account={p.account} size="md" />
            <div className="min-w-0 flex-1">
              <Link to={roadmapHref(p)} className={cn('line-clamp-2 break-words text-body font-semibold text-ink', STRETCHED_LINK)}>
                {p.name}
              </Link>
              <p className="truncate text-caption">
                {p.account.short_name || p.account.name} · {p.code}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <HealthBadge health={p.health} size="sm" />
                {p.status !== 'done' && p.slip_days > 0 ? <SlipLabel project={p} className={SMALL} /> : null}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
            <div className="min-w-0">
              <dt className={MICRO_MUTED}>{t('projects.next.label')}</dt>
              <dd className="mt-1">
                <NextMilestone project={p} />
              </dd>
            </div>
            <div className="text-right">
              <dt className={MICRO_MUTED}>{t('projects.portfolio.columns.end')}</dt>
              <dd className="mt-1">
                <EndDates project={p} className="items-end" />
              </dd>
            </div>
          </dl>

          {p.milestones.length > 0 ? (
            // above the stretched link so the steps can be scrolled sideways
            <div className="relative z-10">
              <StageStepper milestones={p.milestones} compact />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
