// Kanban (DESIGN §5): Cần làm / Đang làm / Chờ phản hồi / Xong on quiet `bg-subtle` columns with a header (name +
// count pill + overdue pill) and white cards. 4 columns from 1280px; below that the board scrolls sideways inside its
// own container with snap points (never the page), with column shortcuts on top.
import { useId, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import type { TaskStatus, TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { canDropOn, STATUS_ICONS, STATUS_ORDER, statusLabel } from '../shared/taskStatus';
import { KanbanCard } from './KanbanCard';
import type { TaskMoves } from './useTaskMoves';

const DONE_PAGE = 8;

function byDue(a: TaskView, b: TaskView): number {
  return a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'vi');
}

export interface KanbanBoardProps {
  tasks: TaskView[];
  moves: TaskMoves;
}

export function KanbanBoard({ tasks, moves }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<TaskView | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  // card moved with the keyboard menu: it keeps the focus in its new column (and again if it snaps back)
  const [focusId, setFocusId] = useState<string | null>(null);
  const hintId = useId();

  const menuMove = (task: TaskView, to: TaskStatus) => {
    setFocusId(task.id);
    void moves.move(task, to).finally(() => {
      window.setTimeout(() => setFocusId((id) => (id === task.id ? null : id)), 100);
    });
  };

  const columns = useMemo(() => {
    const map: Record<TaskStatus, TaskView[]> = { todo: [], in_progress: [], waiting: [], done: [] };
    for (const task of tasks) map[moves.statusOf(task)].push(task);
    for (const s of ['todo', 'in_progress', 'waiting'] as const) map[s].sort(byDue);
    // Xong: latest first; a card just moved here (no completed_at yet) goes on top
    map.done.sort((a, b) => {
      const ka = a.status === 'done' && a.completed_at ? a.completed_at : '9999';
      const kb = b.status === 'done' && b.completed_at ? b.completed_at : '9999';
      return kb.localeCompare(ka) || a.title.localeCompare(b.title, 'vi');
    });
    return map;
  }, [tasks, moves]);

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  const dropAllowed = (status: TaskStatus): boolean =>
    dragging !== null && canDropOn(dragging, moves.statusOf(dragging), status);

  const onDragOver = (status: TaskStatus) => (e: DragEvent<HTMLElement>) => {
    if (!dropAllowed(status)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== status) setOver(status);
  };

  const onDragLeave = (status: TaskStatus) => (e: DragEvent<HTMLElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    if (over === status) setOver(null);
  };

  const onDrop = (status: TaskStatus) => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const task = dragging;
    endDrag();
    if (task && canDropOn(task, moves.statusOf(task), status)) void moves.move(task, status);
  };

  return (
    <div className="space-y-3">
      <p id={hintId} className="sr-only">
        {t('tasks.kanban.dragHint')}
      </p>
      {/* `relative`: the containing block of the sr-only texts inside, so they never widen the page */}
      <div
        aria-describedby={hintId}
        className={cn(
          'relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3',
          'md:mx-0 md:scroll-px-0 md:px-0',
          'xl:grid xl:grid-cols-4 xl:gap-4 xl:overflow-visible xl:pb-0',
        )}
      >
        {STATUS_ORDER.map((status) => {
          const Icon = STATUS_ICONS[status];
          const all = columns[status];
          const list = status === 'done' ? all.slice(0, doneLimit) : all;
          const hiddenDone = status === 'done' ? all.length - list.length : 0;
          const overdue = status === 'done' ? 0 : all.filter((x) => x.due.overdue).length;
          const allowed = dropAllowed(status);
          const isOver = over === status && allowed;
          const headingId = `kanban-col-${status}`;
          return (
            <section
              key={status}
              aria-labelledby={headingId}
              onDragOver={onDragOver(status)}
              onDragLeave={onDragLeave(status)}
              onDrop={onDrop(status)}
              className={cn(
                'flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60',
                'transition-[background-color,opacity] duration-150 ease-out-quart md:w-[300px] xl:w-auto xl:min-w-0 xl:max-w-none',
                dragging && allowed && 'outline-dashed outline-2 -outline-offset-2 outline-primary-border',
                dragging && !allowed && moves.statusOf(dragging) !== status && 'opacity-60',
                isOver && 'bg-primary-soft/70',
              )}
            >
              <header className="flex min-h-9 items-center gap-2 px-1.5 pb-2 pt-1">
                <Icon className={cn('h-4 w-4 shrink-0', status === 'done' ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
                <h3 id={headingId} className="truncate text-table font-semibold text-ink">
                  {statusLabel(status)}
                </h3>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-micro font-medium tabular text-muted-foreground ring-1 ring-inset ring-border/70">
                  <span aria-hidden="true">{all.length}</span>
                  <span className="sr-only">{t('tasks.kanban.columnCount', { count: all.length })}</span>
                </span>
                {overdue > 0 ? (
                  <span className="ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-danger-soft px-1.5 text-micro font-medium tabular text-danger">
                    <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                    {t('tasks.kanban.overdue', { count: overdue })}
                  </span>
                ) : null}
              </header>

              <ul className="flex min-h-24 flex-1 flex-col gap-2" aria-labelledby={headingId}>
                {list.map((task) => (
                  <li key={task.id}>
                    <KanbanCard
                      task={task}
                      status={moves.statusOf(task)}
                      moving={moves.isMoving(task.id)}
                      dragging={dragging?.id === task.id}
                      focusRequest={focusId === task.id}
                      onMove={(to) => menuMove(task, to)}
                      onDragStart={setDragging}
                      onDragEnd={endDrag}
                    />
                  </li>
                ))}
                {all.length === 0 ? (
                  <li
                    className={cn(
                      'flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-strong/70 px-3 py-6 text-center text-caption',
                      isOver && 'border-primary-border text-primary',
                    )}
                  >
                    {isOver ? t('tasks.kanban.dropHere') : t('tasks.empty.column')}
                  </li>
                ) : null}
              </ul>

              {status === 'done' && (hiddenDone > 0 || doneLimit > DONE_PAGE) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setDoneLimit((n) => (hiddenDone > 0 ? n + DONE_PAGE * 3 : DONE_PAGE))}
                >
                  {hiddenDone > 0 ? t('tasks.kanban.showMore', { count: hiddenDone }) : t('tasks.kanban.showLess')}
                </Button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
