// Client task actions (SPEC §3, §1.6): ONE primary button by task type + "Giao cho đồng nghiệp" / "Hỏi lại New Era".
// layout 'card'  : the card row ("Xem & duyệt" opens the drawer at the file to approve).
// layout 'footer': the drawer's sticky action bar ("Duyệt" + "Yêu cầu chỉnh sửa").
import { useId, useState } from 'react';
import { Check, Eye, MessageCircleQuestion, MoreHorizontal, UserPlus } from 'lucide-react';
import type { ActionResult, TaskView } from '@/services/contract';
import { api } from '@/services/api';
import { useAction, type ActionOptions } from '@/hooks/useAction';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { toastError } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { taskActionLabel } from '@/components/common/taskLabels';
import { DelegateDialog, type DelegateInput } from './DelegateDialog';
import { PaymentDialog } from './PaymentDialog';
import { requestDrawerFocus } from './drawerFocus';
import { PRIMARY_ICONS, clientAffordances, salutationParams } from './taskHelpers';
import { toUploadInputs, useFilePicker } from './uploads';

const UNDO: ActionOptions<ActionResult> = { undoToken: (r) => r.undo_token };

export function ReadOnlyHint({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-caption', className)}>
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('task.readOnly')}
    </p>
  );
}

/** true when ClientActions renders anything for this task (the drawer only shows its footer then) */
export function hasClientActions(task: TaskView, viewer: ReturnType<typeof useViewer>): boolean {
  const aff = clientAffordances(task, viewer);
  return !!aff.primary || aff.delegate || aff.ask || aff.ownerOnly;
}

export interface ClientActionsProps {
  task: TaskView;
  layout: 'card' | 'footer';
  /** after an action that hands the task over (approve, submit, delegate…) went through */
  onCompleted?: () => void;
  className?: string;
}

type Busy = 'primary' | 'changes' | null;

export function ClientActions({ task, layout, onCompleted, className }: ClientActionsProps) {
  const viewer = useViewer();
  const aff = clientAffordances(task, viewer);
  const sal = salutationParams(viewer);
  const { run } = useAction();
  const drawer = useTaskDrawer();
  const uid = useId();
  const [busy, setBusy] = useState<Busy>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const disabled = aff.readOnly;
  // the card's "Xem & duyệt" only opens the drawer at the file: a view action, so "Xem như khách hàng" keeps it
  // (the drawer's "Duyệt" / "Yêu cầu chỉnh sửa" and every other client action stay disabled there)
  const viewOnlyPrimary = layout === 'card' && aff.primary === 'approve';

  async function act<T>(key: Exclude<Busy, null>, fn: () => Promise<T>, opts?: ActionOptions<T>, completes = true): Promise<boolean> {
    setBusy(key);
    const result = await run(fn, opts);
    setBusy(null);
    if (result === undefined) return false;
    if (completes) onCompleted?.();
    return true;
  }

  const picker = useFilePicker({
    multiple: true,
    onPick: (files) => {
      setBusy('primary');
      toUploadInputs(files)
        .then((uploads) => act('primary', () => api.submitTaskFiles(task.id, uploads), UNDO))
        .catch(() => {
          setBusy(null);
          toastError(t('task.files.readFailed'));
        });
    },
  });

  function onPrimary() {
    if (disabled && !viewOnlyPrimary) return;
    switch (aff.primary) {
      case 'approve':
        if (layout === 'card') {
          requestDrawerFocus(task.id, 'preview');
          drawer.open(task.id);
        } else {
          void act('primary', () => api.approveTask(task.id), task.quote_id ? { ...UNDO, success: 'task.toast.quote_accepted' } : UNDO);
        }
        return;
      case 'confirm':
      case 'attend':
        void act('primary', () => api.confirmTask(task.id), UNDO);
        return;
      case 'upload':
      case 'sign':
        picker.open();
        return;
      case 'payment':
        setPaymentOpen(true);
        return;
      case 'answer':
        setAnswerOpen(true);
        return;
      default:
        return;
    }
  }

  const primary = aff.primary;
  // a quote is accepted, not "approved" (SPEC 5.4: "Chấp thuận" / "Đề nghị điều chỉnh")
  const quote = !!task.quote_id;
  // the drawer's "Duyệt" approves (a check); the card's "Xem & duyệt" opens the file (an eye)
  const PrimaryIcon = primary === 'approve' && layout === 'footer' ? Check : primary ? PRIMARY_ICONS[primary] : undefined;
  const primaryLabel = primary
    ? primary === 'approve' && layout === 'footer'
      ? t(quote ? 'task.action.acceptQuote' : 'task.action.approve')
      : taskActionLabel(primary)
    : '';
  const changes = quote ? 'task.dialog.quoteChanges' : 'task.dialog.requestChanges';
  const showChanges = layout === 'footer' && primary === 'approve';
  const delegateLabel = task.delegated_by && task.delegated_by.id === viewer?.user.id ? t('task.action.redelegate') : t('task.action.delegate');
  const showDelegate = aff.delegate || aff.ownerOnly;
  const secondaryCount = (showDelegate ? 1 : 0) + (aff.ask ? 1 : 0);
  // phones: one secondary action fits next to the primary button; two go into the "…" menu
  const compactSecondary = secondaryCount > 1;
  const ownerHint = aff.ownerOnly ? t('task.requiresOwner', sal) : null;

  if (!primary && secondaryCount === 0) return null;

  const hintId = `${uid}-owner-hint`;
  // card: quiet text links under / next to the primary button (DESIGN §5 client home); footer: ghost buttons
  const secondaryStyle =
    layout === 'card'
      ? // phones: text only, so both links fit on one line under the full-width button
        ({ variant: 'link', className: 'text-muted-foreground hover:text-foreground max-sm:[&_svg]:hidden' } as const)
      : ({ variant: 'ghost', className: undefined } as const);
  const secondaryButtons = (
    <>
      {showDelegate ? (
        <Button
          type="button"
          variant={secondaryStyle.variant}
          size="sm"
          className={secondaryStyle.className}
          onClick={() => setDelegateOpen(true)}
          disabled={disabled || aff.ownerOnly}
          aria-describedby={aff.ownerOnly ? hintId : undefined}
          title={aff.ownerOnly ? t('task.requiresOwnerShort', sal) : undefined}
        >
          <UserPlus aria-hidden="true" />
          {delegateLabel}
        </Button>
      ) : null}
      {aff.ask ? (
        <Button
          type="button"
          variant={secondaryStyle.variant}
          size="sm"
          className={secondaryStyle.className}
          onClick={() => setAskOpen(true)}
          disabled={disabled}
        >
          <MessageCircleQuestion aria-hidden="true" />
          {t('task.action.ask')}
        </Button>
      ) : null}
    </>
  );

  const moreMenu =
    secondaryCount > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon" aria-label={t('task.action.more')} className="shrink-0">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {showDelegate ? (
            <DropdownMenuItem disabled={disabled || aff.ownerOnly} onSelect={() => setDelegateOpen(true)}>
              <UserPlus aria-hidden="true" />
              {delegateLabel}
            </DropdownMenuItem>
          ) : null}
          {aff.ask ? (
            <DropdownMenuItem disabled={disabled} onSelect={() => setAskOpen(true)}>
              <MessageCircleQuestion aria-hidden="true" />
              {t('task.action.ask')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const primaryButton = primary ? (
    <Button
      type="button"
      size={layout === 'card' ? 'touch' : 'default'}
      onClick={onPrimary}
      loading={busy === 'primary'}
      disabled={(disabled && !viewOnlyPrimary) || busy !== null}
      className={cn('min-w-0', layout === 'footer' ? 'order-3 flex-1 lg:flex-none' : 'w-full md:w-auto')}
    >
      {busy !== 'primary' && PrimaryIcon ? <PrimaryIcon aria-hidden="true" /> : null}
      <span className="truncate">{primaryLabel}</span>
    </Button>
  ) : null;

  const changesButton = showChanges ? (
    <Button
      type="button"
      variant="secondary"
      onClick={() => setChangesOpen(true)}
      disabled={disabled || busy !== null}
      loading={busy === 'changes'}
      className="order-2 shrink-0"
    >
      {quote ? t('task.action.quoteChanges') : t('enums.taskAction.request_changes')}
    </Button>
  ) : null;

  const hints =
    disabled || ownerHint ? (
      <div className="space-y-1">
        {ownerHint ? (
          <p id={hintId} className="text-caption">
            {ownerHint}
          </p>
        ) : null}
        {disabled ? <ReadOnlyHint /> : null}
      </div>
    ) : null;

  // footer: next to "Duyệt" + "Yêu cầu chỉnh sửa" the secondary actions go into "…" below lg.
  // The primary action is always last (right), as in every dialog and sheet footer; it fills the row on phones.
  const footerInline = !showChanges && !compactSecondary;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {layout === 'footer' ? hints : null}
      {layout === 'footer' ? (
        <div className="flex w-full items-center gap-2">
          {!primary ? (
            <div className="flex flex-wrap items-center gap-1">{secondaryButtons}</div>
          ) : footerInline ? (
            <div className="order-1 flex shrink-0 items-center gap-1 lg:mr-auto">{secondaryButtons}</div>
          ) : (
            <div className="order-1 hidden items-center gap-1 lg:mr-auto lg:flex">{secondaryButtons}</div>
          )}
          {changesButton}
          {primary && !footerInline ? <div className="order-2 lg:hidden">{moreMenu}</div> : null}
          {primaryButton}
        </div>
      ) : (
        // phones: the primary button full width, the secondary actions as links below it; from md: one row
        <div className="flex w-full flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-1">
          {primaryButton}
          {secondaryCount > 0 ? (
            <div className={cn('flex flex-wrap items-center gap-x-6 md:gap-x-5', primary ? 'justify-center md:justify-start' : '')}>
              {secondaryButtons}
            </div>
          ) : null}
        </div>
      )}
      {layout === 'card' ? hints : null}

      {picker.input}
      <ReasonDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        title={t(`${changes}.title`)}
        description={t(`${changes}.description`)}
        label={t(`${changes}.label`)}
        placeholder={t(`${changes}.placeholder`)}
        confirmLabel={t(`${changes}.confirm`)}
        onConfirm={(reason) =>
          act('changes', () => api.requestTaskChanges(task.id, reason), quote ? { ...UNDO, success: 'task.toast.quote_changes_requested' } : UNDO)
        }
      />
      <ReasonDialog
        open={answerOpen}
        onOpenChange={setAnswerOpen}
        title={t('task.dialog.answer.title')}
        description={task.description || task.title}
        label={t('task.dialog.answer.label')}
        placeholder={t('task.dialog.answer.placeholder')}
        confirmLabel={t('task.dialog.answer.confirm')}
        onConfirm={(answer) => act('primary', () => api.answerTask(task.id, answer), UNDO)}
      />
      <AskDialog open={askOpen} onOpenChange={setAskOpen} taskId={task.id} />
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSubmit={(proof, note) => act('primary', () => api.reportPayment(task.id, proof, note || undefined), UNDO)}
      />
      {showDelegate ? (
        <DelegateDialog
          open={delegateOpen}
          onOpenChange={setDelegateOpen}
          task={task}
          onSubmit={(input: DelegateInput) => act('primary', () => api.delegateTask(task.id, input), UNDO)}
        />
      ) : null}
    </div>
  );
}

/** "Hỏi lại New Era": the question becomes a shared comment of the task. */
export function AskDialog({ open, onOpenChange, taskId }: { open: boolean; onOpenChange: (open: boolean) => void; taskId: string }) {
  const { run } = useAction();
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('task.dialog.ask.title')}
      description={t('task.dialog.ask.description')}
      label={t('task.dialog.ask.label')}
      placeholder={t('task.dialog.ask.placeholder')}
      confirmLabel={t('task.dialog.ask.confirm')}
      onConfirm={async (question) => (await run(() => api.askNewEra(taskId, question), { success: 'task.toast.asked' })) !== undefined}
    />
  );
}
