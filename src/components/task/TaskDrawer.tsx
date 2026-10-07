// Task drawer content (SPEC §5.2, DESIGN §4 sheet): sticky header (context eyebrow, title, status + due badges),
// then — in reading order — what to do (description), what happens if it waits ("Nếu chưa làm" + impact chain in one
// inset), the file / quote to approve, attachments, delegation, comments and history, and a sticky action bar.
// Shared by the portal and the internal app; what each viewer may do comes from TaskView.can / primary_action.
import { useEffect, useRef } from 'react';
import { Unlock } from 'lucide-react';
import type { TaskDetail } from '@/services/contract';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { BlockedNote } from '@/components/common/blocked-note';
import { DueLabel } from '@/components/common/due-label';
import { FileList } from '@/components/common/file-list';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { sideLabel } from '@/components/common/labels';
import { SideBadge } from '@/components/common/side-badge';
import { taskTypeLabel } from '@/components/common/taskLabels';
import { ClientActions, hasClientActions } from './ClientActions';
import { CommentsPanel } from './CommentsPanel';
import { takeDrawerFocus } from './drawerFocus';
import { InternalFooterActions, InternalManagePanel, InternalTaskMenu, hasInternalFooter, useInternalTaskActions } from './InternalControls';
import { ApprovalPreview, useFilePreview } from './TaskAttachments';
import {
  DelegationInfo,
  ImpactPanel,
  QuoteSummaryBlock,
  ReviewSection,
  Section,
  StatusBadge,
  TaskContext,
  TaskHistory,
  WaitingCheckNote,
} from './TaskDrawerSections';
import { INSET, reviewMode as reviewModeOf, statusPhrase } from './taskHelpers';

export interface TaskDrawerProps {
  task: TaskDetail;
  onClose: () => void;
}

export function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const viewer = useViewer();
  const client = viewer?.org_type === 'client';
  const internal = !client;
  const open = task.status !== 'done';
  const files = useFilePreview();
  const internalActions = useInternalTaskActions(task, onClose);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // the file to approve: the newest New Era file of an open approval task
  const approval = task.type === 'approval' && open;
  const previewFile = approval ? (task.files.find((f) => f.uploaded_by.org_type === 'internal') ?? task.files[0] ?? null) : null;
  const reviewing = internal && task.primary_action === 'review_submission';
  const reviewMode = reviewing ? reviewModeOf(task) : null;
  // files the client just sent are listed in the review section
  const listedInReview = reviewMode === 'files' || reviewMode === 'payment';
  const otherFiles = task.files.filter((f) => f.id !== previewFile?.id && !(listedInReview && f.uploaded_by.org_type === 'client'));
  const showQuote = approval && !!task.quote_id;
  const submittedToNewEra = open && task.side === 'client' && task.waiting_on === 'internal';
  // "Nếu chưa làm" speaks to whoever still has to act: not to a client whose part is already with New Era
  const showImpactText = open && !(client && submittedToNewEra) && (task.impact_text.trim() !== '' || task.blocks_milestones.length > 0);
  const showChain = open && task.chain.length > 1;

  // "Xem & duyệt" from a card: land on the file to approve
  useEffect(() => {
    const target = takeDrawerFocus(task.id);
    const body = bodyRef.current;
    const el = focusRef.current;
    // scroll the drawer body only (scrollIntoView would also scroll the sheet itself and hide its header)
    if (target === 'preview' && body && el) {
      body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
    }
  }, [task.id]);

  const footer = client ? (
    hasClientActions(task, viewer) ? <ClientActions task={task} layout="footer" onCompleted={onClose} className="w-full" /> : null
  ) : hasInternalFooter(task) ? (
    <InternalFooterActions task={task} actions={internalActions} />
  ) : null;

  return (
    <>
      {/* row 1 = context line + "…" level with the close button (absolute, top right); the title below gets the
          full width, so it rarely wraps on phones */}
      <SheetHeader className="gap-0 border-b border-border/70 pb-4 pr-4 pt-2 md:pb-5 md:pr-6 md:pt-4">
        <div className="flex min-h-11 items-center gap-2 pr-11 md:min-h-9 md:pr-10">
          <TaskContext task={task} internal={internal} className="min-w-0 flex-1" />
          {internal ? <InternalTaskMenu task={task} actions={internalActions} /> : null}
        </div>
        <SheetTitle className="mt-1.5 break-words text-heading sm:text-title">{task.title}</SheetTitle>
        <SheetDescription className="sr-only">
          {t('task.drawer.description', { type: taskTypeLabel(task.type), side: sideLabel(task.side) })}
        </SheetDescription>
        <SheetMeta className="mt-2.5 gap-x-2">
          <StatusBadge phrase={statusPhrase(task, viewer)} />
          {open ? <DueLabel due={task.due} className="h-6 text-micro" /> : null}
          {/* "Đang chờ khách" / "Đang chờ New Era kiểm tra" already says whose task it is */}
          {internal && !(task.side === 'client' && open && !task.blocked) ? <SideBadge side={task.side} /> : null}
        </SheetMeta>
      </SheetHeader>

      <SheetBody ref={bodyRef} className="space-y-7 pt-5 md:space-y-8 md:pt-6">
        {/* the focal block first: why it cannot move (blocked), or what the client just sent (review) */}
        {task.blocked ? (
          <div className="space-y-3">
            <BlockedNote blockers={task.blocked_by} />
            {task.can.unblock ? (
              <Button type="button" variant="secondary" size="sm" onClick={internalActions.openUnblock}>
                <Unlock aria-hidden="true" />
                {t('task.action.unblock')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {reviewing ? <ReviewSection task={task} onPreview={files.preview} /> : null}

        {internal ? <InternalManagePanel task={task} actions={internalActions} /> : null}

        {internal && task.manual_unblock_reason ? (
          <InternalNoteBox title={t('task.manage.unblockedBy', { name: task.manual_unblocked_by?.full_name ?? t('common.unknownUser') })}>
            {t('task.manage.unblockedReason', { reason: task.manual_unblock_reason })}
          </InternalNoteBox>
        ) : null}

        {client && submittedToNewEra ? <WaitingCheckNote task={task} /> : null}

        {task.description || task.answer_text ? (
          <Section title={t('task.drawer.sections.description')}>
            {task.description ? <p className="whitespace-pre-line break-words text-body text-foreground">{task.description}</p> : null}
            {task.answer_text ? (
              <div className={INSET}>
                <p className="text-micro font-semibold text-muted-foreground">
                  {task.type === 'answer' ? t('task.drawer.answer') : t('task.drawer.note')}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-table text-foreground">{task.answer_text}</p>
              </div>
            ) : null}
          </Section>
        ) : null}

        {showImpactText || showChain ? (
          <ImpactPanel
            text={task.impact_text}
            milestones={task.blocks_milestones}
            chain={task.chain}
            showText={showImpactText}
            showChain={showChain}
            overdueDays={task.due.overdue_days}
          />
        ) : null}

        {showQuote && task.quote_id ? (
          <div ref={focusRef} className="scroll-mt-4">
            <Section title={t('task.drawer.sections.quote')}>
              <QuoteSummaryBlock quoteId={task.quote_id} client={client} />
            </Section>
          </div>
        ) : previewFile ? (
          <div ref={focusRef}>
            <Section title={t('task.drawer.sections.preview')}>
              <ApprovalPreview file={previewFile} onOpen={files.preview} />
            </Section>
          </div>
        ) : null}

        {otherFiles.length > 0 ? (
          <Section title={t('task.drawer.sections.attachments')}>
            <FileList files={otherFiles} onPreview={files.preview} showVisibility={internal} />
          </Section>
        ) : null}

        {task.delegated_by ? (
          <Section title={t('task.drawer.sections.delegation')}>
            <DelegationInfo task={task} />
          </Section>
        ) : null}

        {/* the conversation and the log: separated from the task content by one hairline */}
        <div className="space-y-7 border-t border-border/60 pt-6 md:space-y-8 md:pt-7">
          <Section title={t('task.drawer.sections.comments')}>
            <CommentsPanel task={task} />
          </Section>

          <Section title={t('task.drawer.sections.history')}>
            <TaskHistory items={task.history} />
          </Section>
        </div>
      </SheetBody>

      {footer ? <SheetFooter className="sm:flex-col sm:justify-start">{footer}</SheetFooter> : null}

      {files.dialog}
      {internal ? internalActions.dialogs : null}
    </>
  );
}
