// "Tiến độ" card of the client home: stepper of the main project, then the next milestone with planned → forecast and
// the reason, then the other projects as hairline rows (DESIGN §5 client home: "Tiến độ stepper card").
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { MilestoneView, ProjectView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { SMALL } from '@/components/common/cx';
import { ForecastLabel } from '@/components/common/forecast-label';
import { SectionCard } from '@/components/common/section-card';
import { StageStepper } from '@/components/common/stage-stepper';
import { PROJECT_PARAM } from '@/hooks/usePortalProject';
import { ForecastWithReason } from './ForecastWithReason';
import { doneCount, mainProject } from './homeModel';
import { CARD_LIST, LIST_ROW, QUIET_LINK } from './styles';

function NextMilestone({ milestone }: { milestone: MilestoneView | null }) {
  if (!milestone) {
    return <p className="text-table text-muted-foreground">{t('portal.home.progress.allDone')}</p>;
  }
  return (
    <div className="min-w-0">
      <p className="text-micro font-medium text-muted-foreground">{t('portal.home.progress.next')}</p>
      <p className="mt-1 break-words text-body font-semibold text-ink">{milestone.name}</p>
      <ForecastWithReason milestone={milestone} className="mt-1" />
    </div>
  );
}

export interface HomeProgressCardProps {
  progress: ProjectView[];
  className?: string;
}

export function HomeProgressCard({ progress, className }: HomeProgressCardProps) {
  const main = mainProject(progress);
  const others = main ? progress.filter((p) => p.id !== main.id) : [];
  const multi = progress.length > 1;
  const linkTo = (projectId: string) => ({ pathname: '/portal/progress', search: `?${PROJECT_PARAM}=${encodeURIComponent(projectId)}` });

  return (
    <SectionCard
      title={t('portal.home.progress.title')}
      className={cn('overflow-hidden', className)}
      flush
      actions={
        main ? (
          // mt-1.5: centred on the 24px title line (the actions slot is pulled up by -my-1)
          <Link to={linkTo(main.id)} className={cn(QUIET_LINK, 'mt-1.5')}>
            {t('portal.home.progress.viewDetail')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      {main ? (
        <>
          <div className="px-4 pb-4 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              {multi ? <p className="min-w-0 text-table font-medium text-foreground">{main.name}</p> : null}
              <p className="text-micro tabular text-muted-foreground">
                {t('portal.home.progress.milestonesDone', { done: doneCount(main), total: main.milestones.length })}
              </p>
            </div>
            <StageStepper milestones={main.milestones} compact className="mt-3" />
          </div>
          <div className="border-t border-border/60 px-4 py-4 sm:px-5">
            <NextMilestone milestone={main.next_milestone} />
          </div>
          {others.length > 0 ? (
            <div className="border-t border-border/60">
              <p className="px-4 pb-1 pt-3 text-micro font-medium text-muted-foreground sm:px-5">{t('portal.home.progress.otherProjects')}</p>
              <ul className={cn(CARD_LIST, 'border-t-0')}>
                {others.map((p) => (
                  <li key={p.id}>
                    <Link to={linkTo(p.id)} className={cn(LIST_ROW, 'py-3')}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-table font-medium text-foreground">{p.name}</span>
                        {/* one 13px line: the milestone name at the size of the compact forecast beside it */}
                        {p.next_milestone ? (
                          <span className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground', SMALL)}>
                            <span className="truncate">{p.next_milestone.name}</span>
                            <ForecastLabel milestone={p.next_milestone} compact showReason={false} />
                          </span>
                        ) : (
                          <span className={cn('mt-1 block text-muted-foreground', SMALL)}>{t('portal.home.progress.noNext')}</span>
                        )}
                      </span>
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-caption transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="px-4 pb-4 text-table text-muted-foreground sm:px-5">{t('portal.progress.noProjects')}</p>
      )}
    </SectionCard>
  );
}
