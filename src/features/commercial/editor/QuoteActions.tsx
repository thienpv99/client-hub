// Workflow actions of a quote, from QuoteDetail.can: Gửi Giám đốc duyệt · Duyệt / Từ chối (director) ·
// Gửi khách (locked with an explanation while a discount above the threshold is not approved) · Tạo phiên bản mới.
// Stacked full width in the summary card, primary first. Unsaved edits are saved first, then the action uses the
// fresh permissions the api returns ("Lưu nháp" itself lives in the sticky unsaved-changes bar).
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Clock, CopyPlus, Info, Lock, MessageSquareWarning, Send, ShieldCheck, ShieldX } from 'lucide-react';
import type { QuoteDetail } from '@/services/contract';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatDateTime, formatMoney } from '@/lib/format';
import { toastInfo, toastSuccess } from '@/lib/toast';
import { api } from '@/services/api';
import { fmtPct } from '../lib';

export interface LiveState {
  effective: number;
  needsApproval: boolean;
  /** approval still valid for the current (possibly unsaved) prices */
  approved: boolean;
  grandTotal: number;
}

export interface QuoteActionsProps {
  quote: QuoteDetail;
  dirty: boolean;
  invalid: boolean;
  saving: boolean;
  live: LiveState;
  /** saves the draft; resolves to the saved quote, or undefined when it failed */
  save: () => Promise<QuoteDetail | undefined>;
}

/** one quiet sentence with an icon (who asked / approved, why something is locked, what happens next) */
export function ActionNote({
  icon: Icon,
  tone = 'neutral',
  inset = false,
  id,
  children,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning';
  /** inset panel (the explanation next to a locked button) */
  inset?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      className={cn(
        'flex items-start gap-2 text-table',
        inset ? 'rounded-lg bg-subtle p-3 text-foreground ring-1 ring-inset ring-border/60' : 'text-muted-foreground',
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-caption')}
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

const LOCKED_ICON: Record<string, LucideIcon> = {
  sent: Send,
  accepted: CircleCheck,
  changes_requested: MessageSquareWarning,
  expired: Clock,
};

export function QuoteActions({ quote, dirty, invalid, saving, live, save }: QuoteActionsProps) {
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const [sendOpen, setSendOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const busy = pending || saving;
  const can = quote.can;
  const isDraft = quote.status === 'draft';
  const pendingApproval = quote.status === 'pending_approval';
  const manager = can.edit || can.send || can.request_approval || can.new_version || (pendingApproval && quote.send_block_reason !== null);
  // the server's reason wins for the saved quote; unsaved edits use the live numbers
  const serverLocked = !dirty && quote.send_block_reason === 'needs_director_approval';
  const sendLocked = (isDraft || pendingApproval) && (pendingApproval || serverLocked || (live.needsApproval && !live.approved));
  const showRequest = can.edit && live.needsApproval && !live.approved;
  const showSend = (isDraft || pendingApproval) && manager;
  const noLines = quote.lines.length === 0;

  async function current(): Promise<QuoteDetail | undefined> {
    return dirty ? save() : quote;
  }

  async function requestApproval() {
    const q = await current();
    if (!q) return;
    if (!q.can.request_approval) {
      toastInfo(t('commercial.actions.toast.approvalNotNeeded'));
      return;
    }
    await run(() => api.requestQuoteApproval(q.id), { success: 'commercial.actions.toast.approvalRequested' });
  }

  async function send(): Promise<boolean> {
    const q = await current();
    if (!q) return false;
    if (!q.can.send) {
      toastInfo(t('commercial.actions.toast.sendBlocked'));
      return true;
    }
    const r = await run(() => api.sendQuote(q.id), { success: 'commercial.actions.toast.sent', successParams: { account: q.account.name } });
    return r !== undefined;
  }

  async function newVersion() {
    const r = await run(() => api.createQuoteVersion(quote.id));
    if (r) {
      toastSuccess(t('commercial.actions.toast.versionCreated', { version: r.version }));
      navigate(`/app/commercial/quotes/${r.id}`);
    }
  }

  const explanation = sendLocked
    ? pendingApproval
      ? t('commercial.actions.sendLockedPending', { pct: fmtPct(live.effective), threshold: fmtPct(quote.threshold_pct) })
      : t('commercial.actions.sendLocked', { pct: fmtPct(live.effective), threshold: fmtPct(quote.threshold_pct) })
    : null;
  const lockedText = !isDraft && !pendingApproval ? t(`commercial.actions.locked.${quote.status}`) : null;
  const hasButtons = can.approve || showRequest || showSend || can.new_version;

  return (
    <div className="space-y-3">
      {pendingApproval && quote.approval_requested_at ? (
        <ActionNote icon={Clock}>
          {t('commercial.actions.requestedBy', {
            name: quote.approval_requested_by?.full_name ?? t('common.unknownUser'),
            time: formatDateTime(quote.approval_requested_at),
          })}
        </ActionNote>
      ) : null}
      {quote.approved && isDraft && live.approved && quote.director_approved_at ? (
        <ActionNote icon={ShieldCheck} tone="success">
          {t('commercial.actions.approvedBy', {
            name: quote.director_approved_by?.full_name ?? t('common.unknownUser'),
            time: formatDateTime(quote.director_approved_at),
          })}
        </ActionNote>
      ) : null}
      {lockedText ? <ActionNote icon={LOCKED_ICON[quote.status] ?? Info}>{lockedText}</ActionNote> : null}

      {hasButtons ? (
        <div className="grid gap-2">
          {can.approve ? (
            <>
              <Button
                className="w-full"
                onClick={() => void run(() => api.approveQuote(quote.id), { success: 'commercial.actions.toast.approved' })}
                loading={pending}
              >
                {pending ? null : <ShieldCheck aria-hidden="true" />}
                {t('commercial.actions.approve')}
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => setRejectOpen(true)} disabled={busy}>
                <ShieldX aria-hidden="true" />
                {t('commercial.actions.reject')}
              </Button>
            </>
          ) : null}
          {showRequest ? (
            <Button className="w-full" onClick={() => void requestApproval()} loading={busy} disabled={invalid}>
              {busy ? null : <ShieldCheck aria-hidden="true" />}
              {t('commercial.actions.requestApproval')}
            </Button>
          ) : null}
          {showSend ? (
            <Button
              className="w-full"
              variant={showRequest || can.approve ? 'secondary' : 'default'}
              onClick={() => setSendOpen(true)}
              disabled={sendLocked || busy || invalid || noLines}
              aria-describedby={explanation ? 'quote-send-lock' : undefined}
            >
              {sendLocked ? <Lock aria-hidden="true" /> : <Send aria-hidden="true" />}
              {t('commercial.actions.send')}
            </Button>
          ) : null}
          {can.new_version ? (
            <Button className="w-full" variant={quote.status === 'changes_requested' ? 'default' : 'secondary'} onClick={() => void newVersion()} loading={pending}>
              {pending ? null : <CopyPlus aria-hidden="true" />}
              {t('commercial.actions.newVersion', { version: quote.version + 1 })}
            </Button>
          ) : null}
        </div>
      ) : null}

      {explanation ? (
        <ActionNote icon={Lock} tone="warning" inset id="quote-send-lock">
          {explanation}
        </ActionNote>
      ) : null}
      {isDraft && manager && !sendLocked && noLines ? <ActionNote icon={Info}>{t('commercial.actions.needLines')}</ActionNote> : null}

      <ConfirmDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={t('commercial.actions.sendTitle', { version: quote.version, account: quote.account.name })}
        description={t('commercial.actions.sendDescription', { total: formatMoney(live.grandTotal) })}
        confirmLabel={t('commercial.actions.sendConfirm')}
        onConfirm={() => send()}
      />
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('commercial.actions.rejectTitle')}
        description={t('commercial.actions.rejectDescription')}
        label={t('commercial.actions.rejectLabel')}
        placeholder={t('commercial.actions.rejectPlaceholder')}
        confirmLabel={t('commercial.actions.rejectConfirm')}
        onConfirm={async (reason) => {
          const r = await run(() => api.rejectQuoteApproval(quote.id, reason), { success: 'commercial.actions.toast.rejected' });
          return r !== undefined;
        }}
      />
    </div>
  );
}
