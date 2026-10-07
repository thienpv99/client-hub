// Timeline tab view: Gantt from 768px, agenda on phones; legend + footnote for done tasks outside the window.
import { useMemo } from 'react';
import type { ProjectView, TaskView } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { useMediaQuery } from '@/hooks/useMedia';
import { Card } from '@/components/ui/card';
import { SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { CalendarCheck } from 'lucide-react';
import { buildAgenda, buildGroups, buildRange, isBeforeRange } from './timelineModel';
import { TaskTimeline } from './TaskTimeline';
import { TimelineAgenda } from './TimelineAgenda';

export interface TimelineViewProps {
  tasks: TaskView[];
  /** projects / milestones in scope of the current filters */
  projects: ProjectView[];
  /** keep upcoming milestones without matching tasks (no task-level filter active) */
  showEmptyMilestones: boolean;
  multiProject: boolean;
}

export function TimelineView({ tasks, projects, showEmptyMilestones, multiProject }: TimelineViewProps) {
  const tablet = useMediaQuery('(min-width: 768px)');
  const today = todayISO();

  const model = useMemo(() => {
    const range = buildRange(tasks, projects, today);
    const inChart = tasks.filter((x) => !isBeforeRange(x, range, today));
    return {
      range,
      groups: buildGroups(inChart, projects, today, showEmptyMilestones),
      hiddenDone: tasks.length - inChart.length,
      agenda: buildAgenda(tasks, projects, today),
      doneCount: tasks.filter((x) => x.status === 'done').length,
    };
  }, [tasks, projects, today, showEmptyMilestones]);

  if (!tablet) {
    if (model.agenda.length === 0) {
      return (
        <Card>
          <EmptyState icon={CalendarCheck} title={t('tasks.timeline.agenda.empty')} />
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        <TimelineAgenda sections={model.agenda} multiProject={multiProject} />
        {model.doneCount > 0 ? <p className="px-1 text-caption">{t('tasks.timeline.agenda.doneHidden', { count: model.doneCount })}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TaskTimeline groups={model.groups} range={model.range} multiProject={multiProject} />
      <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-muted-foreground', SMALL)}>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-foreground/80" aria-hidden="true" />
          {t('tasks.timeline.legend.planned')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-danger bg-card" aria-hidden="true" />
          {t('tasks.timeline.legend.forecast')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-0.5 bg-primary/70" aria-hidden="true" />
          {t('tasks.timeline.legend.today')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-sm border border-primary-border bg-primary-soft" aria-hidden="true" />
          {t('tasks.timeline.legend.task')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-sm border border-danger/40 bg-danger-soft" aria-hidden="true" />
          {t('tasks.timeline.legend.overdue')}
        </span>
        {model.hiddenDone > 0 ? <span className="ml-auto">{t('tasks.timeline.doneHidden', { count: model.hiddenDone })}</span> : null}
      </div>
    </div>
  );
}
