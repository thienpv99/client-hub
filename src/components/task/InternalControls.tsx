// Internal (New Era) controls of the task drawer: status, "Khách thấy được", reminders, manual unblock, review of
// client submissions, edit / delete. Every control follows TaskView.can — the service layer enforces the same rules.
import { Suspense, lazy, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, CircleCheck, ExternalLink, Lock, MoreHorizontal, Pencil, Play, Send, Trash2, Unlock } from 'lucide-react';
import type { TaskDetail, TaskStatus } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { UserAvatar } from '@/components/common/user-avatar';
import { RemindClientButton, ZaloRemindButton } from '@/components/remind/RemindButtons';
import { ReturnToClientDialog } from './ReturnToClientDialog';
import { reviewMode } from './taskHelpers';

// loaded on first "Sửa" (task-views owns the form)
const TaskFormDialog = lazy(() => import('@/features/tasks/TaskFormDialog').then((m) => ({ default: m.TaskFormDialog })));

const ALL_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'done'];

type Busy = 'status' | 'accept' | 'visible' | null;

export interface InternalTaskActions {
  busy: Busy;
  setStatus(status: TaskStatus): Promise<void>;
  accept(): void;
  openReturn(): void;
  openUnblock(): void;
  openEdit(): void;
  openDelete(): void;
  setVisible(visible: boolean): void;
  /** dialogs to render once */
  dialogs: ReactNode;
}

export function useInternalTaskActions(task: TaskDetail, onDeleted: () => void): InternalTaskActions {
  const { run } = useAction();
  const [busy, setBusy] = useState<Busy>(null);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editMounted, setEditMounted] = useState(false);

  async function setStatus(status: TaskStatus): Promise<void> {
    if (status === task.status) return;
    setBusy('status');
    await run(() => api.setTaskStatus(task.id, status), {
      success: 'task.toast.status_changed',
      successParams: { status: t(`enums.taskStatus.${status}`) },
    });
    setBusy(null);
  }

  const mode = reviewMode(task);

  function accept() {
    setBusy('accept');
    void run(() => api.acceptSubmission(task.id), {
      success: mode === 'payment' ? 'task.toast.payment_confirmed' : 'task.toast.accepted',
    }).finally(() => setBusy(null));
  }

  function setVisible(visible: boolean) {
    setBusy('visible');
    void run(() => api.setTaskClientVisible(task.id, visible), {
      success: visible ? 'task.toast.visible_on' : 'task.toast.visible_off',
    }).finally(() => setBusy(null));
  }

  const dialogs = (
    <>
      <ReasonDialog
        open={unblockOpen}
        onOpenChange={setUnblockOpen}
        title={t('task.dialog.unblock.title')}
        description={t('task.dialog.unblock.description')}
        label={t('task.dialog.unblock.label')}
        placeholder={t('task.dialog.unblock.placeholder')}
        confirmLabel={t('task.dialog.unblock.confirm')}
        onConfirm={async (reason) => (await run(() => api.manualUnblock(task.id, reason), { success: 'task.toast.unblocked' })) !== undefined}
      />
      <ReturnToClientDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        mode={mode === 'newVersion' ? 'newVersion' : 'return'}
        onSubmit={async (input) =>
          (await run(() => api.returnToClient(task.id, input.files.length ? input : { message: input.message }), {
            success: mode === 'newVersion' ? 'task.toast.new_version_sent' : 'task.toast.returned',
          })) !== undefined
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('task.dialog.delete.title')}
        description={t('task.dialog.delete.description', { title: task.title })}
        confirmLabel={t('task.dialog.delete.confirm')}
        destructive
        onConfirm={async () => {
          const ok = await run(
            async () => {
              await api.deleteTask(task.id);
              return true as const;
            },
            { success: 'task.toast.deleted' },
          );
          if (!ok) return false;
          onDeleted();
          return true;
        }}
      />
      {editMounted ? (
        <Suspense fallback={null}>
          <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} accountId={task.account.id} task={task} />
        </Suspense>
      ) : null}
    </>
  );

  return {
    busy,
    setStatus,
    accept,
    openReturn: () => setReturnOpen(true),
    openUnblock: () => setUnblockOpen(true),
    openEdit: () => {
      setEditMounted(true);
      setEditOpen(true);
    },
    openDelete: () => setDeleteOpen(true),
    setVisible,
    dialogs,
  };
}

/** "…" menu in the drawer header: edit, manual unblock, delete. */
export function InternalTaskMenu({ task, actions }: { task: TaskDetail; actions: InternalTaskActions }) {
  const canEdit = task.can.edit;
  const canUnblock = task.can.unblock;
  if (!canEdit && !canUnblock) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('task.action.manage')}
          title={t('task.action.manage')}
          className="shrink-0 md:h-9 md:w-9"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        {canEdit ? (
          <DropdownMenuItem onSelect={actions.openEdit}>
            <Pencil aria-hidden="true" />
            {t('task.action.edit')}
          </DropdownMenuItem>
        ) : null}
        {canUnblock ? (
          <DropdownMenuItem onSelect={actions.openUnblock}>
            <Unlock aria-hidden="true" />
            {t('task.action.unblock')}
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={actions.openDelete}>
              <Trash2 aria-hidden="true" />
              {t('task.action.delete')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface StatusOption {
  status: TaskStatus;
  /** the blocker stands in the way (shown disabled with the reason under the label, never hidden) */
  locked: boolean;
}

/** Same rules as the service (domain canMoveTo) and the Kanban "Chuyển sang…" menu. */
function statusOptions(task: TaskDetail): StatusOption[] {
  // staff move client tasks only back to "Cần làm" or to "Xong" (the client's own actions move the rest)
  const bySide = task.side === 'client' ? ALL_STATUSES.filter((s) => s === task.status || s === 'todo' || s === 'done') : ALL_STATUSES;
  // a blocked task only goes back to "Cần làm" until its blocker is done or it is unblocked by hand
  return bySide.map((status) => ({ status, locked: task.blocked && status !== task.status && status !== 'todo' }));
}

/**
 * One property of the panel: label (+ hint) on the left, value / control on the right; stacks on narrow phones.
 * `footnote`: a reason about the control, full width under the row (never squeezed into the label column on phones).
 */
function PropRow({
  label,
  hint,
  footnote,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
      <div className="min-w-0 flex-1 basis-28">
        <div className="text-table text-muted-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-micro text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">{children}</div>
      {footnote ? <div className="-mt-1 flex basis-full items-start gap-1.5 text-micro text-muted-foreground">{footnote}</div> : null}
    </div>
  );
}

/** Status, assignee, "Khách thấy được" and reminders as a quiet property list (one inset, hairline rows). */
export function InternalManagePanel({ task, actions }: { task: TaskDetail; actions: InternalTaskActions }) {
  const id = useId();
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const reminded =
    task.reminder_count > 0
      ? task.last_reminded_at
        ? t('task.manage.remindedLast', { count: task.reminder_count, when: formatRelativeTime(task.last_reminded_at) })
        : t('task.manage.reminded', { count: task.reminder_count })
      : t('task.manage.notReminded');
  const showRemind = task.side === 'client' && task.status !== 'done' && (task.can.remind || task.reminder_count > 0);

  const options = statusOptions(task);
  // why "Đang làm" / "Xong"… are greyed out: the blocker above, and the way forward (the unblock button sits right
  // above this panel, under the blocker note)
  const statusHint =
    task.blocked && task.can.change_status && options.some((o) => o.locked)
      ? t(task.can.unblock ? 'task.manage.statusBlockedUnblock' : 'task.manage.statusBlockedWait')
      : null;

  async function onStatus(value: string) {
    const next = options.find((o) => o.status === value && !o.locked)?.status;
    if (!next) return;
    setPendingStatus(next);
    await actions.setStatus(next);
    setPendingStatus(null);
  }

  return (
    <div className="divide-y divide-border/60 rounded-lg bg-subtle ring-1 ring-inset ring-border/60">
      <PropRow
        label={<label htmlFor={`${id}-status`}>{t('task.manage.status')}</label>}
        footnote={
          statusHint ? (
            <>
              <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span id={`${id}-status-hint`}>{statusHint}</span>
            </>
          ) : undefined
        }
      >
        <NativeSelect
          id={`${id}-status`}
          size="sm"
          wrapperClassName="w-44"
          value={pendingStatus ?? task.status}
          onChange={(e) => void onStatus(e.target.value)}
          disabled={!task.can.change_status || actions.busy === 'status'}
          aria-describedby={statusHint ? `${id}-status-hint` : undefined}
        >
          {options.map((o) => (
            <option key={o.status} value={o.status} disabled={o.locked}>
              {t(`enums.taskStatus.${o.status}`)}
            </option>
          ))}
        </NativeSelect>
      </PropRow>

      <PropRow label={t('task.manage.assignee')}>
        <UserAvatar user={task.assignee} size="sm" />
        <span className="min-w-0 max-w-[14rem]">
          <span className="block truncate text-table font-medium text-foreground">
            {task.assignee?.full_name ?? t('task.manage.noAssignee')}
          </span>
          {task.assignee?.title ? <span className="block truncate text-micro text-muted-foreground">{task.assignee.title}</span> : null}
        </span>
      </PropRow>

      {task.side === 'internal' ? (
        <PropRow
          label={<label htmlFor={`${id}-visible`}>{t('task.manage.visible')}</label>}
          hint={<span id={`${id}-visible-hint`}>{t('task.manage.visibleHint')}</span>}
        >
          <Switch
            id={`${id}-visible`}
            checked={task.client_visible}
            onCheckedChange={(v) => actions.setVisible(v)}
            disabled={!task.can.edit || actions.busy === 'visible'}
            aria-describedby={`${id}-visible-hint`}
          />
        </PropRow>
      ) : null}

      {showRemind ? (
        <PropRow label={t('task.manage.remindLabel')} hint={reminded}>
          {task.can.remind ? (
            <>
              <RemindClientButton taskIds={[task.id]} size="sm" variant="secondary" />
              <ZaloRemindButton taskId={task.id} size="sm" />
            </>
          ) : null}
        </PropRow>
      ) : null}
    </div>
  );
}

/** Sticky action bar for internal viewers: review a client submission, or start / complete own work. */
export function InternalFooterActions({ task, actions }: { task: TaskDetail; actions: InternalTaskActions }) {
  const primary = task.primary_action;
  if (primary === 'review_submission' && task.can.review) {
    const mode = reviewMode(task);
    if (mode === 'quote' && task.quote_id) {
      // a new quote version (sent from the quote page) closes this task and gives the client a new one
      return (
        <div className="flex w-full items-center sm:justify-end">
          <Button asChild className="flex-1 sm:flex-none">
            <Link to={`/app/commercial/quotes/${encodeURIComponent(task.quote_id)}`}>
              <ExternalLink aria-hidden="true" />
              {t('task.action.openQuote')}
            </Link>
          </Button>
        </div>
      );
    }
    if (mode === 'newVersion') {
      return (
        <div className="flex w-full items-center sm:justify-end">
          <Button type="button" onClick={actions.openReturn} disabled={actions.busy !== null} className="flex-1 sm:flex-none">
            <Send aria-hidden="true" />
            {t('task.action.sendNewVersion')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex w-full items-center gap-2 sm:justify-end">
        <Button type="button" variant="secondary" onClick={actions.openReturn} disabled={actions.busy !== null} className="flex-1 sm:flex-none">
          <Send aria-hidden="true" />
          {t('task.action.returnToClient')}
        </Button>
        <Button type="button" onClick={actions.accept} loading={actions.busy === 'accept'} disabled={actions.busy !== null} className="flex-1 sm:flex-none">
          {actions.busy !== 'accept' && <Check aria-hidden="true" />}
          {mode === 'payment' ? t('task.action.confirmPayment') : t('task.action.accept')}
        </Button>
      </div>
    );
  }
  if (ownWorkAction(task)) {
    const next: TaskStatus = primary === 'start' ? 'in_progress' : 'done';
    const Icon = primary === 'start' ? Play : CircleCheck;
    return (
      <div className="flex w-full items-center sm:justify-end">
        <Button
          type="button"
          onClick={() => void actions.setStatus(next)}
          loading={actions.busy === 'status'}
          disabled={actions.busy !== null}
          className="flex-1 sm:flex-none"
        >
          {actions.busy !== 'status' && <Icon aria-hidden="true" />}
          {t(`enums.taskAction.${primary}`)}
        </Button>
      </div>
    );
  }
  return null;
}

/**
 * "Bắt đầu" / "Hoàn thành" — never on a blocked task: the service refuses every move but "Cần làm" until the blocker
 * is done (a task already started whose blocker was reopened still gets 'complete' as its primary action).
 */
function ownWorkAction(task: TaskDetail): boolean {
  return (task.primary_action === 'start' || task.primary_action === 'complete') && !task.blocked;
}

export function hasInternalFooter(task: TaskDetail): boolean {
  return (task.primary_action === 'review_submission' && task.can.review) || ownWorkAction(task);
}
