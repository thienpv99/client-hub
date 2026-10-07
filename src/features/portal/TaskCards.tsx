// List of client task cards (home "Việc cần anh xử lý" and the tasks page). ClientTaskCard (components/task) draws
// the card, including the DESIGN §5 left accent for overdue / due-soon tasks that hold a milestone.
import type { TaskView } from '@/services/contract';
import { cn } from '@/lib/utils';
import { ClientTaskCard } from '@/components/task/ClientTaskCard';

export type CardVariant = 'action' | 'delegated' | 'waiting';

export function TaskCardList({
  tasks,
  variant = 'action',
  showProject,
  className,
}: {
  tasks: TaskView[];
  variant?: CardVariant;
  showProject: boolean;
  className?: string;
}) {
  return (
    <ul className={cn('space-y-3', className)}>
      {tasks.map((task) => (
        <li key={task.id}>
          <ClientTaskCard task={task} variant={variant} showProject={showProject} />
        </li>
      ))}
    </ul>
  );
}
