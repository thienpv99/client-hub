// List of client task cards (home "Việc cần anh xử lý" and the tasks page). ClientTaskCard (components/task) draws
// the card, including the DESIGN §5 left accent for overdue / due-soon tasks that hold a milestone.
import type { TaskView } from '@/services/contract';
import type { RiseProps } from '@/hooks/useMotion';
import { cn } from '@/lib/utils';
import { ClientTaskCard } from '@/components/task/ClientTaskCard';

export type CardVariant = 'action' | 'delegated' | 'waiting';

export function TaskCardList({
  tasks,
  variant = 'action',
  showProject,
  rise,
  className,
}: {
  tasks: TaskView[];
  variant?: CardVariant;
  showProject: boolean;
  /**
   * The page's focal list only (DESIGN.md §8.4): `useStagger(ready)` of the page, so the cards fade up one after the
   * other on the list's first appearance — never on a refetch, a tab switch or a task finished from the drawer.
   */
  rise?: (index: number) => RiseProps;
  className?: string;
}) {
  return (
    <ul className={cn('space-y-3', className)}>
      {tasks.map((task, i) => {
        const motion = rise ? rise(i) : {};
        return (
          <li key={task.id} className={motion.className} style={motion.style}>
            <ClientTaskCard task={task} variant={variant} showProject={showProject} />
          </li>
        );
      })}
    </ul>
  );
}
