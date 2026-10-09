// "Giải pháp New Era triển khai" on /portal/progress (SPEC-CARE §6.7): what New Era has delivered to the company —
// name, kind, a one-line summary, status in client words, since when (or the forecast go-live of its project), how many
// people use it and which teams; the description says how many are already in use. Client-safe fields only
// (listClientDeployments: no contract value, adoption or internal notes; retired solutions left out).
// A section title outside the cards + a card grid (DESIGN §1.3: never boxes inside boxes).
import { useId } from 'react';
import { Layers } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import { diffDays } from '@/domain/dates';
import type { ClientDeploymentView } from '@/services/careContract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { formatDateShort, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_ICONS, DeploymentStatusChip } from '@/components/care/badges';
import { SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { bySolutionStatus, inProjectScope } from './requestModel';
import { COUNT_PILL, SECTION_TITLE } from './styles';

function SolutionCard({ solution: s, today }: { solution: ClientDeploymentView; today: ISODate }) {
  const Icon = CATEGORY_ICONS[s.category];
  const started = s.go_live_date !== null && s.go_live_date <= today;
  return (
    <Card className="flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-body font-semibold text-ink">{s.name}</h3>
          <p className="mt-0.5 text-micro text-muted-foreground">{s.category_label}</p>
        </div>
      </div>
      {s.summary ? <p className="mt-3 line-clamp-3 break-words text-table text-muted-foreground">{s.summary}</p> : null}
      <div className="mt-auto pt-4">
        {/* the facts move under the chip as one group when the card is narrow (never a line starting with "·") */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DeploymentStatusChip status={s.status} audience="client" />
          {s.go_live_date || s.active_users ? (
            <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular text-muted-foreground', SMALL)}>
              {s.go_live_forecast ? (
                // the project's go-live moved: the same date as the timeline above, with the slip
                <span className="whitespace-nowrap" title={formatDate(s.go_live_forecast)}>
                  {s.go_live_date && s.go_live_forecast > s.go_live_date
                    ? t('carePortal.solutions.plannedLate', { date: formatDateShort(s.go_live_forecast), days: diffDays(s.go_live_forecast, s.go_live_date) })
                    : t('carePortal.solutions.planned', { date: formatDateShort(s.go_live_forecast) })}
                </span>
              ) : s.go_live_date ? (
                <span className="whitespace-nowrap" title={formatDate(s.go_live_date)}>
                  {t(started ? 'carePortal.solutions.since' : 'carePortal.solutions.planned', { date: formatDateShort(s.go_live_date) })}
                </span>
              ) : null}
              {s.active_users ? (
                <span className="whitespace-nowrap">
                  {s.go_live_date ? (
                    <span aria-hidden="true" className="mr-1.5">
                      ·
                    </span>
                  ) : null}
                  {t('carePortal.solutions.users', { count: formatNumber(s.active_users) })}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {s.department_labels.length > 0 ? (
          <ul aria-label={t('carePortal.solutions.departments')} className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
            {s.department_labels.map((label) => (
              <li key={label} className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-micro text-muted-foreground">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

function SolutionsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal space-y-3">
      <Skeleton className="h-5 w-48 max-w-full" />
      <Skeleton className="h-3.5 w-64 max-w-full" />
      <div className="grid gap-4 pt-1 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
            <Skeleton className="mt-5 h-5 w-40 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export interface SolutionsSectionProps {
  projectId: string | null;
  projectName: string | null;
  company: string;
  today: ISODate;
  className?: string;
}

export function SolutionsSection({ projectId, projectName, company, today, className }: SolutionsSectionProps) {
  const viewer = useViewer();
  const headingId = useId();
  const query = useQuery<ClientDeploymentView[]>(() => api.listClientDeployments(), [viewer?.user.id, viewer?.account_id], {
    enabled: !!viewer,
  });

  if (!query.data) {
    if (query.error) {
      return (
        <Card className={className}>
          <ErrorState error={query.error} onRetry={query.refetch} compact />
        </Card>
      );
    }
    return <SolutionsSkeleton />;
  }

  const solutions = query.data.filter((s) => inProjectScope(s, projectId)).sort(bySolutionStatus);
  // "1 đang sử dụng · 2 đang triển khai": a solution still being rolled out is not one the client already uses
  const live = solutions.filter((s) => s.status === 'live').length;
  const progress = solutions.filter((s) => s.status === 'rolling_out' || s.status === 'pilot').length;
  const split =
    solutions.length === 0
      ? null
      : progress === 0
        ? t('carePortal.solutions.splitLive')
        : live === 0
          ? t('carePortal.solutions.splitProgress')
          : t('carePortal.solutions.split', { live, progress });
  return (
    <section aria-labelledby={headingId} className={cn('min-w-0', className)}>
      <div className="mb-3">
        <h2 id={headingId} className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
          {t('carePortal.solutions.title')}
          {solutions.length > 0 ? (
            <span className={COUNT_PILL}>
              <span aria-hidden="true">{solutions.length}</span>
              <span className="sr-only">{t('carePortal.solutions.count', { count: solutions.length })}</span>
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-pretty text-caption">
          {company ? t('carePortal.solutions.description', { company }) : t('carePortal.solutions.descriptionNoCompany')}
          {split ? ` ${split}.` : null}
        </p>
      </div>
      {solutions.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {solutions.map((s) => (
            <li key={s.id} className="min-w-0">
              <SolutionCard solution={s} today={today} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            compact
            icon={Layers}
            title={projectId && projectName ? t('carePortal.solutions.emptyProject', { name: projectName }) : t('carePortal.solutions.empty')}
            description={t('carePortal.solutions.emptyHint')}
          />
        </Card>
      )}
    </section>
  );
}
