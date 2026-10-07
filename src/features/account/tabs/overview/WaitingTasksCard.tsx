// "Việc chờ khách" / "Việc chờ New Era" on the account overview: open, not blocked tasks (same rule as the
// counters), most urgent first. Overdue client tasks can be reminded right here.
import type { ReactNode } from 'react';
import { BellRing, Flag, FolderKanban, Inbox, Lock, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskView, WaitingOn } from '@/services/contract';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { DueLabel } from '@/components/common/due-label';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { RemindClientButton } from '@/components/remind/RemindButtons';
import { TabLink } from './TabLink';

const MAX_ROWS = 5;

function byUrgency(a: TaskView, b: TaskView): number {
  return (
    a.priority_rank - b.priority_rank ||
    b.due.overdue_days - a.due.overdue_days ||
    a.due_date.localeCompare(b.due_date) ||
    a.title.localeCompare(b.title, 'vi')
  );
}

/** names truncate; a sentence (`wrap`) may take two lines */
function MetaItem({
  icon: Icon,
  children,
  className,
  wrap = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  wrap?: boolean;
}) {
  return (
    <span className={cn('inline-flex min-w-0 max-w-full gap-1', wrap ? 'items-start' : 'items-center', className)}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', wrap && 'mt-0.5')} aria-hidden="true" />
      <span className={cn('min-w-0', wrap ? 'break-words' : 'truncate')}>{children}</span>
    </span>
  );
}

function TaskLine({ task, showProject, remind }: { task: TaskView; showProject: boolean; remind: boolean }) {
  const drawer = useTaskDrawer();
  const milestone = task.blocks_milestones[0];
  /** a client submission (files, payment proof, change request) New Era has to check */
  const review = task.side === 'client' && task.waiting_on === 'internal';
  return (
    <li className="relative flex flex-col gap-2 px-4 py-3.5 transition-colors duration-150 hover:bg-subtle sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* phones: no type tile — the title starts with the verb, and the meta gets the full width */}
        <span
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted-foreground ring-1 ring-inset ring-border/80 sm:flex"
          aria-hidden="true"
        >
          <TaskTypeIcon type={task.type} />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => drawer.open(task.id)}
            className="block max-w-full rounded text-left text-table font-medium text-foreground after:absolute after:inset-0 after:content-['']"
          >
            <span className="line-clamp-2">{task.title}</span>
          </button>
          {/* icon-led items with a gap instead of "·": a wrapped line never starts or ends on a separator */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
            <DueLabel due={task.due} compact />
            {review ? (
              <MetaItem icon={Inbox} className="font-medium text-foreground" wrap>
                {task.assignee
                  ? t('account.overview.tasks.needsReview', { name: task.assignee.full_name })
                  : t('account.overview.tasks.needsReviewClient')}
              </MetaItem>
            ) : (
              <MetaItem icon={UserRound}>
                {task.assignee ? task.assignee.full_name : t('account.overview.tasks.unassigned')}
              </MetaItem>
            )}
            {milestone ? (
              <MetaItem icon={Flag}>{t('account.overview.tasks.holdsMilestone', { milestone: milestone.name })}</MetaItem>
            ) : null}
            {showProject ? <MetaItem icon={FolderKanban}>{task.project.name}</MetaItem> : null}
            {task.waiting_on === 'client' && task.reminder_count > 0 ? (
              <MetaItem icon={BellRing} className="tabular">
                {t('account.overview.tasks.reminded', { count: task.reminder_count })}
              </MetaItem>
            ) : null}
          </div>
        </div>
      </div>
      {remind ? (
        <div className="relative z-10">
          <RemindClientButton taskIds={[task.id]} size="sm" variant="secondary" />
        </div>
      ) : null}
    </li>
  );
}

function RowsSkeleton() {
  return (
    <div className="divide-y divide-border/60 border-t border-border/60" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="hidden h-8 w-8 shrink-0 rounded-lg sm:block" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className={cn('h-3.5', i === 1 ? 'w-1/2' : 'w-3/4')} />
            <Skeleton className="h-5 w-40 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface WaitingTasksCardProps {
  side: WaitingOn;
  accountId: string;
  tasks: TaskView[] | undefined;
  error: unknown;
  onRetry: () => void;
  showProject: boolean;
  className?: string;
}

export function WaitingTasksCard({ side, accountId, tasks, error, onRetry, showProject, className }: WaitingTasksCardProps) {
  const waiting = (tasks ?? []).filter((x) => x.waiting_on === side && x.status !== 'done');
  const open = waiting.filter((x) => !x.blocked).sort(byUrgency);
  const blockedCount = waiting.length - open.length;
  const remindable = side === 'client' ? open.filter((x) => x.due.overdue && x.can.remind).map((x) => x.id) : [];
  const shown = open.slice(0, MAX_ROWS);
  const isClient = side === 'client';
  const showFooter = !!tasks && (blockedCount > 0 || open.length > MAX_ROWS);

  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={
        <span className="inline-flex items-center gap-2">
          {t(isClient ? 'account.overview.tasks.clientTitle' : 'account.overview.tasks.internalTitle')}
          {tasks ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
              {open.length}
            </span>
          ) : null}
        </span>
      }
      actions={
        remindable.length > 1 ? (
          <RemindClientButton
            taskIds={remindable}
            size="sm"
            variant="secondary"
            label={t('account.overview.tasks.remindAll', { count: remindable.length })}
          />
        ) : null
      }
      flush
      footer={
        showFooter ? (
          <>
            {blockedCount > 0 ? (
              <p className="flex min-w-0 flex-1 items-center gap-1.5 text-caption">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('account.overview.tasks.blockedNote', { count: blockedCount })}
              </p>
            ) : (
              <span className="flex-1" />
            )}
            <TabLink accountId={accountId} tab="tasks">
              {open.length > MAX_ROWS
                ? t('account.overview.tasks.viewAll', { count: open.length })
                : t('account.overview.tasks.openTab')}
            </TabLink>
          </>
        ) : undefined
      }
    >
      {!tasks && error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : !tasks ? (
        <RowsSkeleton />
      ) : open.length === 0 ? (
        <EmptyState
          compact
          className="pt-4"
          title={t(isClient ? 'account.overview.tasks.clientEmpty' : 'account.overview.tasks.internalEmpty')}
          description={t(isClient ? 'account.overview.tasks.clientEmptyHint' : 'account.overview.tasks.internalEmptyHint')}
        />
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {shown.map((task) => (
            <TaskLine key={task.id} task={task} showProject={showProject} remind={isClient && task.due.overdue && task.can.remind} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
