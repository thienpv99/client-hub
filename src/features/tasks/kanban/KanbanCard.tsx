// One Kanban card (DESIGN §5): white `rounded-lg border shadow-xs p-3 space-y-2`, hover lift; drag ghost lifted
// (`shadow-pop rotate-1`). Type + side, title (2 lines), blocker, due chip, reminders, assignee.
// Click anywhere opens the task drawer; HTML5 drag (mouse) or the "Chuyển sang…" menu (keyboard, touch) moves it.
import { useEffect, useRef } from 'react';
import type { DragEvent } from 'react';
import { BellRing, EyeOff, Lock } from 'lucide-react';
import type { TaskStatus, TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { blockerText } from '@/components/common/blocked-note';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { AssigneeAvatar, sideText } from '@/components/task/TaskRow';
import { MoveMenu } from './MoveMenu';

export interface KanbanCardProps {
  task: TaskView;
  status: TaskStatus;
  moving: boolean;
  dragging: boolean;
  /** moved with the keyboard menu: take the focus when (re-)mounted in its new column */
  focusRequest?: boolean;
  onMove: (to: TaskStatus) => void;
  onDragStart: (task: TaskView) => void;
  onDragEnd: () => void;
}

export const DRAG_MIME = 'application/x-clienthub-task';

/** classes the browser's drag image is captured with (applied for one frame at dragstart) */
const GHOST = ['shadow-pop', 'rotate-1', 'border-primary-border'];

export function KanbanCard({ task, status, moving, dragging, focusRequest = false, onMove, onDragStart, onDragEnd }: KanbanCardProps) {
  const { open } = useTaskDrawer();
  const moveRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLButtonElement | null>(null);
  const done = status === 'done';
  const canMove = task.can.change_status;
  const hiddenFromClient = task.side === 'internal' && !task.client_visible;
  const firstBlocker = task.blocked ? task.blocked_by[0] : undefined;

  useEffect(() => {
    if (!focusRequest) return;
    // after the menu has closed: keep the keyboard user on the card they just moved
    const id = window.setTimeout(() => (moveRef.current ?? titleRef.current)?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [focusRequest, status]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, task.id);
    e.dataTransfer.setData('text/plain', task.title);
    // the drag image is a snapshot taken right after this handler: lift the card for that snapshot only
    const el = e.currentTarget;
    el.classList.add(...GHOST);
    window.requestAnimationFrame(() => el.classList.remove(...GHOST));
    onDragStart(task);
  };

  return (
    <div
      draggable={canMove}
      onDragStart={canMove ? handleDragStart : undefined}
      onDragEnd={canMove ? onDragEnd : undefined}
      aria-busy={moving || undefined}
      className={cn(
        'group relative space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-xs',
        'transition-[transform,border-color,opacity,box-shadow] duration-150 ease-out-quart',
        'hover:-translate-y-px hover:border-primary-border hover:shadow-card-hover focus-within:border-primary-border',
        canMove && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
        moving && 'opacity-70',
      )}
    >
      <div className="flex min-h-6 items-center gap-1.5 text-micro font-medium text-muted-foreground">
        <TaskTypeIcon type={task.type} labelled className="h-3.5 w-3.5" />
        <span className="truncate">{sideText({ ...task, status })}</span>
        {hiddenFromClient ? (
          <span className="inline-flex shrink-0 items-center text-caption" title={t('tasks.row.hiddenFromClient')}>
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('tasks.row.hiddenFromClient')}</span>
          </span>
        ) : null}
        {task.blocked ? (
          <span className="inline-flex shrink-0 items-center" title={t('tasks.row.blocked')}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('tasks.row.blocked')}</span>
          </span>
        ) : null}
        <span className="flex-1" />
        {canMove ? <MoveMenu task={task} current={status} onMove={onMove} triggerRef={moveRef} className="-my-1.5 -mr-1.5" /> : null}
      </div>

      <button
        ref={titleRef}
        type="button"
        onClick={() => open(task.id)}
        title={task.title}
        className={cn(
          'block w-full text-left text-table font-medium leading-5 line-clamp-2',
          done ? 'text-muted-foreground' : 'text-ink',
          "after:absolute after:inset-0 after:rounded-lg after:content-['']",
          'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary',
        )}
      >
        {task.title}
      </button>

      {firstBlocker ? (
        <p className={cn('flex items-start gap-1.5 text-muted-foreground', SMALL)}>
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2 min-w-0">
            {blockerText(firstBlocker)}
            {task.blocked_by.length > 1 ? ` ${t('tasks.row.moreBlockers', { count: task.blocked_by.length - 1 })}` : ''}
          </span>
        </p>
      ) : null}

      {/* wraps in narrow columns: due first, reminders next, the avatar always flush right */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <DueLabel due={task.due} done={done} completedAt={task.completed_at} compact />
        {task.reminder_count > 0 && !done ? (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground tabular', SMALL)}>
            <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('tasks.row.reminded', { count: task.reminder_count })}
          </span>
        ) : null}
        <AssigneeAvatar user={task.assignee} size="xs" className="ml-auto" />
      </div>
    </div>
  );
}
