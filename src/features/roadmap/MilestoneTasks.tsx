// Tasks of a milestone: the counts double as the toggle ("3 đang mở · 5 đã xong ▾"), the panel lists the tasks as
// TaskRows (each opens the task drawer) on an inset panel.
import { useMemo } from 'react';
import { ChevronDown, ListChecks } from 'lucide-react';
import type { MilestoneView, TaskView } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { SMALL } from '@/components/common/cx';
import { TaskRow } from '@/components/task/TaskRow';
import { taskCountsText } from './MilestoneBits';
import { useRoadmap } from './roadmapContext';

function byOpenThenDue(a: TaskView, b: TaskView): number {
  const ad = a.status === 'done' ? 1 : 0;
  const bd = b.status === 'done' ? 1 : 0;
  if (ad !== bd) return ad - bd;
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return a.title.localeCompare(b.title, 'vi');
}

/** Counts of the milestone's tasks; a button that shows / hides them when there are any. */
export function MilestoneTasksToggle({
  milestone,
  expanded,
  onToggle,
  panelId,
  className,
}: {
  milestone: MilestoneView;
  expanded: boolean;
  onToggle(): void;
  panelId: string;
  className?: string;
}) {
  const total = milestone.open_task_count + milestone.done_task_count;
  const text = taskCountsText(milestone);
  if (total === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-muted-foreground', SMALL, className)}>
        <ListChecks className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
        {text}
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={panelId}
      className={cn('-ml-2 gap-1.5 px-2 font-normal tabular', SMALL, expanded && 'bg-muted text-foreground', className)}
    >
      <ListChecks className="text-caption" aria-hidden="true" />
      {text}
      <span className="sr-only">{t('roadmap.tasks.toggleSr', { name: milestone.name })}</span>
      <ChevronDown className={cn('transition-transform duration-150 ease-out-quart', expanded && 'rotate-180')} aria-hidden="true" />
    </Button>
  );
}

export function MilestoneTasks({ milestone, id, className }: { milestone: MilestoneView; id: string; className?: string }) {
  const { accountId } = useRoadmap();
  const query = useQuery(
    () => api.listTasks({ accountId, milestoneId: milestone.id, openOnly: false }),
    [accountId, milestone.id],
  );
  const tasks = useMemo(() => (query.data ? [...query.data].sort(byOpenThenDue) : []), [query.data]);
  const panel = 'overflow-hidden rounded-lg bg-subtle ring-1 ring-inset ring-border/60';

  return (
    // mounts when the user opens it: a 150 ms fade (opacity only) instead of a pop
    <div
      id={id}
      role="region"
      aria-label={t('roadmap.tasks.title', { name: milestone.name })}
      className={cn('animate-fade-in', className)}
    >
      {query.loading ? (
        <div className={cn(panel, 'skeleton-reveal space-y-2.5 p-4')} role="status" aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ) : query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={query.refetch} compact />
      ) : tasks.length === 0 ? (
        <p className={cn(panel, 'px-4 py-3 text-table text-muted-foreground')}>{t('roadmap.tasks.empty')}</p>
      ) : (
        <div className={cn(panel, 'divide-y divide-border/60')}>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} hideMilestone />
          ))}
        </div>
      )}
    </div>
  );
}
