// Phone timeline (<768px): a vertical agenda — overdue first, then week by week, milestones slotted in at their
// forecast date. Every row opens the task drawer.
import { CircleAlert, Flag, Lock } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { TaskView } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { addDays, startOfWeek, weekday } from '@/domain/dates';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { formatDateShort } from '@/lib/format';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { Card } from '@/components/ui/card';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { ForecastLabel } from '@/components/common/forecast-label';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { AssigneeAvatar, sideText } from '@/components/task/TaskRow';
import type { AgendaSection } from './timelineModel';

function weekTitle(week: ISODate, today: ISODate): string {
  const range = { from: formatDateShort(week), to: formatDateShort(addDays(week, 6)) };
  const current = startOfWeek(today);
  if (week === current) return t('tasks.timeline.agenda.thisWeek', range);
  if (week === addDays(current, 7)) return t('tasks.timeline.agenda.nextWeek', range);
  return t('tasks.timeline.agenda.week', range);
}

function weekdayShort(d: ISODate): string {
  return t(`common.weekdayShort.${weekday(d)}`);
}

export function TimelineAgenda({ sections, multiProject }: { sections: AgendaSection[]; multiProject: boolean }) {
  const today = todayISO();
  return (
    <div className="space-y-5">
      {sections.map((s) => {
        const taskCount = s.entries.filter((e) => e.kind === 'task').length;
        return (
          <section key={s.id} aria-labelledby={`agenda-${s.id}`}>
            <h3 id={`agenda-${s.id}`} className="mb-2 flex items-center gap-1.5 px-1 text-table font-semibold text-ink">
              {s.kind === 'overdue' ? <CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" /> : null}
              {s.kind === 'overdue' ? t('tasks.timeline.agenda.overdue') : weekTitle(s.week ?? today, today)}
              {taskCount > 0 ? <span className="font-normal text-muted-foreground tabular">· {t('tasks.filters.total', { count: taskCount })}</span> : null}
            </h3>
            <Card className="divide-y divide-border/60 overflow-hidden">
              {s.entries.map((e) =>
                e.kind === 'milestone' ? (
                  <div key={`m:${e.milestone.id}`} className="flex items-start gap-3 bg-subtle px-4 py-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-xs ring-1 ring-inset ring-border/70">
                      <Flag className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-table font-semibold text-ink">
                        {t('tasks.timeline.agenda.milestone', { name: e.milestone.name })}
                        {multiProject ? <span className="font-normal text-muted-foreground"> · {e.project.name}</span> : null}
                      </p>
                      <ForecastLabel milestone={e.milestone} className="mt-0.5" />
                    </div>
                  </div>
                ) : (
                  <AgendaTask key={e.task.id} task={e.task} />
                ),
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function AgendaTask({ task }: { task: TaskView }) {
  const { open } = useTaskDrawer();
  return (
    <button
      type="button"
      onClick={() => open(task.id)}
      className="flex min-h-tap w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out-quart hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-subtle py-1 tabular ring-1 ring-inset ring-border/70">
        <span className={cn('font-semibold text-foreground', SMALL)}>{formatDateShort(task.due_date)}</span>
        <span className="text-micro text-muted-foreground">{weekdayShort(task.due_date)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          {task.blocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="line-clamp-2 text-table font-medium leading-5 text-ink">{task.title}</span>
        </span>
        <span className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground', SMALL)}>
          <span className="inline-flex items-center gap-1">
            <TaskTypeIcon type={task.type} className="h-3.5 w-3.5" />
            {sideText(task)}
          </span>
          {task.due.overdue || task.due.due_soon ? <DueLabel due={task.due} compact /> : null}
        </span>
      </span>
      <AssigneeAvatar user={task.assignee} size="sm" />
    </button>
  );
}
