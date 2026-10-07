// Task status presentation shared by the Kanban, list and timeline views (task-views).
import { Circle, CircleCheck, CircleDot, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskStatus, TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/badge';

/** Kanban column order: Cần làm / Đang làm / Chờ phản hồi / Xong */
export const STATUS_ORDER: readonly TaskStatus[] = ['todo', 'in_progress', 'waiting', 'done'];

export const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  todo: Circle,
  in_progress: CircleDot,
  waiting: Hourglass,
  done: CircleCheck,
};

export function statusLabel(status: TaskStatus): string {
  return t(`enums.taskStatus.${status}`);
}

/**
 * Columns a card can be moved to from the board. Only hides moves the task rules never allow (a client task is
 * moved by staff to Cần làm or Xong only); everything else — blocked tasks included — is decided by the service.
 */
export function moveTargets(task: Pick<TaskView, 'side'>, current: TaskStatus): TaskStatus[] {
  const all: readonly TaskStatus[] = task.side === 'client' ? ['todo', 'done'] : STATUS_ORDER;
  return all.filter((s) => s !== current);
}

export function canDropOn(task: Pick<TaskView, 'side'>, current: TaskStatus, target: TaskStatus): boolean {
  return moveTargets(task, current).includes(target);
}

/** Neutral pill with icon + label (done in success colours: a status, always icon + text). */
export function StatusPill({ status, size = 'default', className }: { status: TaskStatus; size?: 'default' | 'sm'; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={status === 'done' ? 'success' : 'default'} size={size} className={className}>
      <Icon aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  );
}

const STATUS_RANK: Record<TaskStatus, number> = { todo: 0, in_progress: 1, waiting: 2, done: 3 };

export function compareStatus(a: TaskStatus, b: TaskStatus): number {
  return STATUS_RANK[a] - STATUS_RANK[b];
}
