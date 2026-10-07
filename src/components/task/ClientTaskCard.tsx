// Client task card (SPEC §1.2, §5.1, DESIGN §5 client home): verb-first title, due chip, "Nếu chưa làm" inset with
// milestone tags ("Đang ảnh hưởng" + what has slipped once overdue) and ONE primary button by type (full width on phones) with "Giao cho đồng nghiệp" / "Hỏi lại New Era"
// as quiet links. A 3px left accent marks only tasks that hold a milestone and are overdue (danger) or due soon
// (warning). Clicking the card opens the task drawer.
// variant 'delegated': who it was handed to, its state and the delegation note; 'waiting': submitted, New Era checks.
import { CircleCheck, Clock, FolderKanban, Hourglass, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TaskView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { capitalize, t } from '@/i18n';
import { formatDateShort, formatRelativeTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Card } from '@/components/ui/card';
import { BlockedNote } from '@/components/common/blocked-note';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { ImpactBox } from '@/components/common/impact-box';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { UserAvatar } from '@/components/common/user-avatar';
import { ClientActions } from './ClientActions';
import { INSET, NEUTRAL_TYPE_TILE, personAddress, submittedKey } from './taskHelpers';

export interface ClientTaskCardProps {
  task: TaskView;
  showProject?: boolean;
  variant?: 'action' | 'delegated' | 'waiting';
}

/** project tag as a quiet eyebrow above the title (keeps the due chip alone on its line, even on phones) */
function ProjectTag({ name }: { name: string }) {
  return (
    <p className="mb-1 flex min-w-0 items-center gap-1.5 text-micro font-medium text-muted-foreground" title={t('task.card.project', { name })}>
      <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('task.card.projectSr')} </span>
      <span className="truncate">{name}</span>
    </p>
  );
}

function delegatedState(task: TaskView): { text: string; icon: LucideIcon; cls: string } {
  const who = task.assignee ? personAddress(task.assignee) : '';
  if (task.status === 'done') {
    const date = task.completed_at ? formatDateShort(dateOf(task.completed_at)) : null;
    return {
      text: date ? t('task.card.delegatedState.doneOn', { date }) : t('task.card.delegatedState.done'),
      icon: CircleCheck,
      cls: 'text-success',
    };
  }
  if (task.waiting_on === 'internal') {
    return { text: capitalize(t('task.card.delegatedState.submitted', { name: who })), icon: Send, cls: 'text-muted-foreground' };
  }
  return { text: t('task.card.delegatedState.todo', { name: who }), icon: Clock, cls: 'text-muted-foreground' };
}

/** 'danger' / 'warning' when the task holds a milestone and is overdue / due soon (DESIGN §5: the only accents). */
function accentOf(task: TaskView, variant: ClientTaskCardProps['variant']): 'danger' | 'warning' | null {
  if (variant !== 'action' || task.status === 'done' || task.blocked || !task.is_blocking_milestone) return null;
  if (task.due.overdue) return 'danger';
  if (task.due.due_soon) return 'warning';
  return null;
}

export function ClientTaskCard({ task, showProject = false, variant = 'action' }: ClientTaskCardProps) {
  const { open } = useTaskDrawer();
  const done = task.status === 'done';
  const accent = accentOf(task, variant);

  const header = (
    <div className="flex items-start gap-3">
      {/* phones: the title and its chips take the full card width (the primary button names the action) */}
      <TaskTypeIcon type={task.type} boxed labelled className={cn('hidden sm:inline-flex', NEUTRAL_TYPE_TILE)} />
      <div className="min-w-0 flex-1">
        {showProject ? <ProjectTag name={task.project.name} /> : null}
        <h3 className="text-heading font-semibold tracking-tightish text-ink">
          {/* stretched button: the whole card opens the drawer; the action row sits above it */}
          <button
            type="button"
            onClick={() => open(task.id)}
            aria-label={t('task.card.open', { title: task.title })}
            className="block w-full rounded-sm text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            <span className="line-clamp-2 break-words" title={task.title}>
              {task.title}
            </span>
          </button>
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {variant === 'waiting' ? (
            // same chip shape as the due chip, then when it was sent — one line, no extra paragraph
            <>
              <span className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 font-medium text-muted-foreground', SMALL)}>
                <Hourglass className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                {t('task.status.checking')}
              </span>
              <span className="text-caption">{t(submittedKey(task), { when: formatRelativeTime(task.updated_at) })}</span>
            </>
          ) : (
            <DueLabel due={task.due} done={done} completedAt={task.completed_at} />
          )}
        </div>
      </div>
    </div>
  );

  let body: ReactNode = null;
  if (variant === 'delegated') {
    const state = delegatedState(task);
    const StateIcon = state.icon;
    body = (
      <div className={cn('mt-4 flex items-start gap-3', INSET)}>
        <UserAvatar user={task.assignee} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-table text-foreground">
            {task.assignee ? t('task.card.delegatedTo', { name: task.assignee.full_name }) : null}
            {task.assignee?.title ? <span className="text-muted-foreground"> · {task.assignee.title}</span> : null}
          </p>
          <p className={cn('mt-0.5 inline-flex items-center gap-1.5 font-medium', SMALL, state.cls)}>
            <StateIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {state.text}
          </p>
          {task.delegation_note ? (
            <p className="mt-2 break-words text-table text-muted-foreground">{t('task.card.note', { note: task.delegation_note })}</p>
          ) : null}
          {task.delegated_at ? (
            <p className="mt-1 text-micro text-muted-foreground">{t('task.card.delegatedAt', { when: formatRelativeTime(task.delegated_at) })}</p>
          ) : null}
        </div>
      </div>
    );
  } else if (variant !== 'waiting' && !done) {
    body = (
      <>
        <ImpactBox text={task.impact_text} milestones={task.blocks_milestones} overdueDays={task.due.overdue_days} className="mt-4" />
        {task.blocked ? <BlockedNote blockers={task.blocked_by} className="mt-3" /> : null}
      </>
    );
  }

  return (
    <Card interactive asChild className="group relative p-4 sm:p-5">
      <article aria-label={task.title}>
        {accent ? (
          // follows the card's own rounded corner: a 12px strip with only its left border drawn
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -inset-y-px -left-px w-3 rounded-l-xl border-l-[3px]',
              accent === 'danger' ? 'border-l-danger' : 'border-l-warning',
            )}
          />
        ) : null}
        {header}
        {body}
        {done ? null : <ClientActions task={task} layout="card" className="relative z-10 mt-4" />}
      </article>
    </Card>
  );
}
