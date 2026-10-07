// Compact task rows of the portal (delegated, submitted, New Era work, done) + the client-worded waiting counts.
// Rows are full-bleed lines of a card list (DESIGN §4): parent `CARD_LIST`, row `LIST_ROW`.
import type { ReactNode } from 'react';
import { ChevronRight, Circle, CircleAlert, CircleDot, FolderKanban, Hourglass, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskView, WaitingCounts } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { LIST_ROW } from './styles';

export interface CompactTaskRowProps {
  task: TaskView;
  onOpen(id: string): void;
  /** icon / avatar column */
  leading?: ReactNode;
  /** status line under the title */
  meta?: ReactNode;
  showProject?: boolean;
  /** the task currently open in the drawer */
  current?: boolean;
}

/** One tappable line: leading visual, title (2 lines max), meta line; opens the task drawer. */
export function CompactTaskRow({ task, onOpen, leading, meta, showProject = false, current = false }: CompactTaskRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        aria-current={current || undefined}
        className={cn(LIST_ROW, current && 'bg-subtle')}
      >
        {leading ? (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            {leading}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-table font-medium text-foreground">{task.title}</span>
          {meta ? <span className={cn('mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground', SMALL)}>{meta}</span> : null}
          {showProject ? (
            <span className="mt-1 flex min-w-0 items-center gap-1 text-micro text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{task.project.name}</span>
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-caption transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

function Quiet({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Status of a client task in a compact list: done date, "Đã gửi, chờ New Era kiểm tra", blocked, or the due label. */
export function ClientRowStatus({ task }: { task: TaskView }) {
  if (task.status === 'done') return <DueLabel due={task.due} done completedAt={task.completed_at} compact variant="text" />;
  if (task.waiting_on === 'internal') return <Quiet icon={Hourglass}>{t('portal.rowStatus.submitted')}</Quiet>;
  if (task.blocked) return <Quiet icon={Lock}>{t('portal.rowStatus.blocked')}</Quiet>;
  return <DueLabel due={task.due} compact variant="text" />;
}

const NEW_ERA_ICON: Record<TaskView['status'], LucideIcon> = {
  todo: Circle,
  in_progress: CircleDot,
  waiting: Hourglass,
  done: Circle,
};

/** "◉ Đang làm  [Quá hạn 2 ngày]" for a New Era task — late work stays visible (SPEC §1.4). */
export function NewEraRowStatus({ task }: { task: TaskView }) {
  if (task.status === 'done') return <DueLabel due={task.due} done completedAt={task.completed_at} compact variant="text" />;
  return (
    <>
      <Quiet icon={NEW_ERA_ICON[task.status]}>{t(`portal.rowStatus.newEra.${task.status}`)}</Quiet>
      <DueLabel due={task.due} compact variant="text" />
    </>
  );
}

/**
 * "Đang chờ phía anh 6 · Đang chờ New Era 4" (WaitingCountsLine worded for a client reader), as two side-by-side
 * figures so it never wraps mid-sentence in a narrow column. "phía": it counts the whole company side.
 */
export function ClientWaitingLine({ counts, you, className }: { counts: WaitingCounts; you: string; className?: string }) {
  const cell = (label: string, count: number, overdue: number) => (
    <div className="min-w-0">
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-heading font-semibold tabular text-ink">{count}</span>
        {overdue > 0 ? (
          <span className={cn('inline-flex items-center gap-1 self-center whitespace-nowrap font-medium text-danger', SMALL)}>
            <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular">{t('portal.waitingLine.overdue', { count: overdue })}</span>
          </span>
        ) : null}
      </dd>
    </div>
  );
  return (
    <dl className={cn('grid w-full grid-cols-2 gap-4', className)}>
      {cell(t('portal.waitingLine.client', { you }), counts.waiting_client, counts.overdue_client)}
      {cell(t('portal.waitingLine.internal'), counts.waiting_internal, counts.overdue_internal)}
    </dl>
  );
}
