// One project on /portal/progress (SPEC 5.4): a summary strip (milestones done + the launch milestone's planned →
// forecast, the question a C-level asks first) and the vertical milestone timeline — planned + forecast + reason when
// late, the current milestone in an inset panel. Markers follow StageStepper (done = soft check, current = solid).
import { Check, Flag } from 'lucide-react';
import type { MilestoneView, ProjectView } from '@/services/contract';
import { launchMilestone } from '@/domain/graph';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import type { RiseProps } from '@/hooks/useMotion';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/common/empty-state';
import { ForecastLabel } from '@/components/common/forecast-label';
import { SectionCard } from '@/components/common/section-card';
import { ForecastWithReason } from './ForecastWithReason';

type StepState = 'done' | 'current' | 'upcoming';

function stateOf(m: MilestoneView, currentId: string | null): StepState {
  if (m.status === 'done') return 'done';
  return m.id === currentId ? 'current' : 'upcoming';
}

function StepMarker({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold tabular',
        state === 'done' && 'bg-primary-soft text-primary ring-1 ring-inset ring-primary-border',
        state === 'current' && 'bg-primary text-primary-foreground shadow-btn ring-4 ring-primary-soft',
        state === 'upcoming' && 'bg-card text-muted-foreground ring-1 ring-inset ring-border-strong',
      )}
    >
      {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
    </span>
  );
}

function MilestoneItem({
  m,
  state,
  index,
  last,
  nextState,
  motion,
}: {
  m: MilestoneView;
  state: StepState;
  index: number;
  last: boolean;
  nextState: StepState | null;
  /** stagger props of the timeline's first appearance */
  motion: RiseProps;
}) {
  const totalTasks = m.open_task_count + m.done_task_count;
  const stateText = t(state === 'done' ? 'portal.progress.done' : state === 'current' ? 'portal.progress.current' : 'portal.progress.upcoming');
  const current = state === 'current';
  return (
    <li className={cn('relative flex gap-3 sm:gap-4', motion.className)} style={motion.style} aria-current={current ? 'step' : undefined}>
      {!last ? (
        // connector from this marker down to the next one: filled up to the current milestone (as StageStepper)
        <span
          aria-hidden="true"
          className={cn('absolute bottom-0 left-[13px] top-7 w-0.5 rounded-full', state === 'done' && nextState !== 'upcoming' ? 'bg-primary/50' : 'bg-border')}
        />
      ) : null}
      <StepMarker state={state} index={index} />
      {/* done milestones stay compact (name + completion date) so the current one is reached quickly on a phone */}
      <div className={cn('min-w-0 flex-1', last ? '' : current ? 'mb-5' : 'pb-5', current &&'-mt-2.5 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:-mt-3.5 sm:p-4')}>
        <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', current ? '' : 'min-h-7')}>
          <h3 className={cn('break-words text-body font-semibold', state === 'upcoming' ? 'font-medium text-foreground' : 'text-ink')}>{m.name}</h3>
          {current ? (
            <span className="inline-flex h-6 items-center rounded-full bg-primary-soft px-2 text-micro font-medium text-primary">{stateText}</span>
          ) : (
            <span className="sr-only">({stateText})</span>
          )}
        </div>
        <ForecastWithReason milestone={m} className="mt-1" />
        {m.description && state !== 'done' ? <p className="mt-2 break-words text-table text-muted-foreground">{m.description}</p> : null}
        {current && totalTasks > 0 ? (
          <p className="mt-2 text-micro tabular text-muted-foreground">{t('portal.progress.tasksDone', { done: m.done_task_count, total: totalTasks })}</p>
        ) : null}
      </div>
    </li>
  );
}

/** "Đã xong 2/6 mốc" bar + "Go-live 12/11 → 18/11 · lùi 6 ngày" (or "all done"). */
function ProjectSummary({ steps, done }: { steps: MilestoneView[]; done: number }) {
  const pct = steps.length ? Math.round((done * 100) / steps.length) : 0;
  const launch = launchMilestone(steps.filter((m) => m.status !== 'done'));
  const doneLabel = t('portal.progress.milestonesDone', { done, total: steps.length });
  return (
    <div className="space-y-4">
      {launch ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-body font-semibold text-ink">
            <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {launch.name}
          </span>
          <ForecastLabel milestone={launch} showReason={false} />
        </div>
      ) : (
        <p className="text-table text-muted-foreground">{t('portal.progress.allDone')}</p>
      )}
      <div>
        <div className="flex items-baseline justify-between gap-3 text-micro">
          <span className="text-muted-foreground">{doneLabel}</span>
          <span className="font-medium tabular text-foreground" aria-hidden="true">
            {t('portal.progress.pct', { pct })}
          </span>
        </div>
        <Progress value={pct} className="mt-1.5" aria-label={doneLabel} />
      </div>
    </div>
  );
}

const NO_RISE = (): RiseProps => ({});

/**
 * `rise`: the page's `useStagger` (DESIGN §8.4) — the focal list of /portal/progress, so the milestones unfold top to
 * bottom on the page's first load; held by the page, so switching the project selector never replays it.
 */
export function ProjectTimelineCard({ project, rise = NO_RISE }: { project: ProjectView; rise?: (index: number) => RiseProps }) {
  const steps = [...project.milestones].sort((a, b) => a.order_no - b.order_no);
  const done = steps.filter((m) => m.status === 'done').length;
  const states = steps.map((m) => stateOf(m, project.current_milestone_id));

  return (
    <SectionCard title={project.name} flush className="overflow-hidden">
      {steps.length === 0 ? (
        <EmptyState compact title={t('portal.progress.empty')} description={t('portal.progress.emptyHint')} />
      ) : (
        <>
          <div className="px-4 pb-4 sm:px-5">
            <ProjectSummary steps={steps} done={done} />
          </div>
          <ol aria-label={t('portal.progress.milestonesLabel', { name: project.name })} className="border-t border-border/60 px-4 py-5 sm:px-5">
            {steps.map((m, i) => (
              <MilestoneItem
                key={m.id}
                m={m}
                state={states[i] ?? 'upcoming'}
                index={i}
                last={i === steps.length - 1}
                nextState={states[i + 1] ?? null}
                motion={rise(i)}
              />
            ))}
          </ol>
        </>
      )}
    </SectionCard>
  );
}
