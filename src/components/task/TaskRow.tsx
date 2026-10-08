// Internal compact task row (owner: task-views). Scannable in one line on desktop, two on phones.
// The whole row opens the task drawer; the optional checkbox sits above the stretched click target.
// DESIGN §7.5 list row: type tile · title (semibold-ish) + one quiet meta line · due chip · assignee; hover bg-subtle.
import { BellRing, EyeOff, Flag, Lock } from 'lucide-react';
import type { TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { Checkbox } from '@/components/ui/checkbox';
import { AccountLogo } from '@/components/common/account-logo';
import { blockerText } from '@/components/common/blocked-note';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { sideLabel } from '@/components/common/labels';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { UserAvatar } from '@/components/common/user-avatar';

export interface TaskRowProps {
  task: TaskView;
  /** account tag (company-wide lists) */
  showAccount?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** keep an empty checkbox column so rows of a partly selectable list stay aligned */
  reserveSelectSpace?: boolean;
  /** leave the "Mốc …" tag out (the list is already grouped under that milestone) */
  hideMilestone?: boolean;
  /** leave the assignee avatar out (the list is already grouped by person) */
  hideAssignee?: boolean;
  className?: string;
}

/** Assignee avatar; an unassigned task shows a dashed placeholder ("Chưa phân công"), never the system icon. */
export function AssigneeAvatar({ user, size = 'sm', className }: { user: TaskView['assignee']; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  if (user) return <UserAvatar user={user} size={size} className={className} />;
  const box = size === 'xs' ? 'h-5 w-5' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <span
      role="img"
      aria-label={t('tasks.row.unassigned')}
      title={t('tasks.row.unassigned')}
      className={cn('inline-flex shrink-0 rounded-full border border-dashed border-caption/60 bg-card', box, className)}
    />
  );
}

/**
 * Side + who holds the ball in one short phrase: an open client task says "Chờ khách" / "Chờ New Era kiểm tra"
 * (a New Era task always waits on New Era, a blocked one waits on its blocker), everything else names the side.
 */
export function sideText(task: Pick<TaskView, 'side' | 'status' | 'blocked' | 'waiting_on'>): string {
  if (task.side === 'client' && task.status !== 'done' && !task.blocked && task.waiting_on) {
    return t(task.waiting_on === 'client' ? 'tasks.row.waitClient' : 'tasks.row.waitReview');
  }
  return sideLabel(task.side);
}

/** 28px neutral tile with the task-type icon (rows, tables, agenda). */
export function TaskTypeTile({ task, className }: { task: Pick<TaskView, 'type' | 'status'>; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-subtle ring-1 ring-inset ring-border/70',
        task.status === 'done' ? 'text-caption' : 'text-muted-foreground',
        className,
      )}
    >
      <TaskTypeIcon type={task.type} labelled />
    </span>
  );
}

export function TaskRow({
  task,
  showAccount = false,
  selectable = false,
  selected = false,
  onSelectedChange,
  reserveSelectSpace = false,
  hideMilestone = false,
  hideAssignee = false,
  className,
}: TaskRowProps) {
  const { open } = useTaskDrawer();
  const done = task.status === 'done';
  const firstBlocker = task.blocked ? task.blocked_by[0] : undefined;
  const hiddenFromClient = task.side === 'internal' && !task.client_visible;
  const due = <DueLabel due={task.due} done={done} completedAt={task.completed_at} compact />;

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-out-quart hover:bg-subtle focus-within:bg-subtle sm:items-center sm:px-5',
        selected && 'bg-primary-soft/60 hover:bg-primary-soft/70 focus-within:bg-primary-soft/70',
        className,
      )}
    >
      {selectable ? (
        <div className="relative z-10 flex h-7 shrink-0 items-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectedChange?.(v === true)}
            aria-label={t('tasks.row.select', { task: task.title })}
          />
        </div>
      ) : reserveSelectSpace ? (
        <span className="w-5 shrink-0" aria-hidden="true" />
      ) : null}

      {/* phones: the title takes the room (the meta line still carries the side and the due chip) */}
      <TaskTypeTile task={task} className="hidden sm:inline-flex" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-1.5">
          {task.blocked ? (
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={t('tasks.row.blocked')} role="img" />
          ) : null}
          <button
            type="button"
            onClick={() => open(task.id)}
            title={task.title}
            className={cn(
              'min-w-0 text-left text-table font-medium leading-5 line-clamp-2 sm:line-clamp-1',
              done ? 'text-muted-foreground' : 'text-ink',
              // stretched target: the whole row opens the drawer
              "after:absolute after:inset-0 after:rounded-none after:content-['']",
              'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary',
            )}
          >
            {task.title}
          </button>
        </div>

        <div className={cn('mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground', SMALL)}>
          {/* phones: who + when lead the meta line (no right-hand column, so the line has room to flow) */}
          <span className="inline-flex items-center gap-1.5 sm:hidden">
            {hideAssignee ? null : <AssigneeAvatar user={task.assignee} size="xs" />}
            {due}
          </span>
          {showAccount ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <AccountLogo account={task.account} size="xs" />
              <span className="truncate font-medium text-foreground">{task.account.short_name}</span>
            </span>
          ) : null}
          {/* one phrase for side + who holds the ball: "Chờ khách" already says it is the client's task */}
          <span>{sideText(task)}</span>
          {task.milestone && !hideMilestone ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Flag className="h-3.5 w-3.5 shrink-0 text-caption" aria-hidden="true" />
              <span className="truncate">
                <span className="sr-only">{t('tasks.filters.milestone')} </span>
                {task.milestone.name}
              </span>
            </span>
          ) : null}
          {firstBlocker ? (
            <span className="min-w-0 truncate">
              {blockerText(firstBlocker)}
              {task.blocked_by.length > 1 ? ` ${t('tasks.row.moreBlockers', { count: task.blocked_by.length - 1 })}` : ''}
            </span>
          ) : null}
          {task.reminder_count > 0 ? (
            <span className="inline-flex items-center gap-1 tabular">
              <BellRing className="h-3.5 w-3.5 shrink-0 text-caption" aria-hidden="true" />
              {t('tasks.row.reminded', { count: task.reminder_count })}
            </span>
          ) : null}
          {hiddenFromClient ? (
            <span className="inline-flex items-center gap-1">
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-caption" aria-hidden="true" />
              {t('tasks.row.hiddenFromClient')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {due}
        {hideAssignee ? null : <AssigneeAvatar user={task.assignee} size="sm" />}
      </div>
    </div>
  );
}
