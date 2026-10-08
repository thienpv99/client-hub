// "Nhắc khách" and "Nhắc qua Zalo" (SPEC §6) — owner: notify.
// Both render nothing for viewers who can never remind (clients, internal members, "Xem như khách hàng").
// The api enforces the account rule (director, or the account's AM) and which tasks can be reminded;
// callers show the buttons for tasks whose `TaskView.can.remind` is true.
import { useId, useRef, useState } from 'react';
import { BellRing, Copy, MessageCircle, Phone, PhoneOff } from 'lucide-react';
import type { Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { errorMessage } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useAction } from '@/hooks/useAction';
import { useDelayedFlag } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { copyText } from './clipboard';

/** 'icon' renders the icon alone (the label stays the accessible name and tooltip) */
export type RemindButtonSize = 'default' | 'sm' | 'lg' | 'icon';
export type RemindButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'soft';

export interface RemindClientButtonProps {
  taskIds: string[];
  size?: RemindButtonSize;
  variant?: RemindButtonVariant;
  /** button text, default "Nhắc khách" */
  label?: string;
  /** called once the api answered (reminders sent or every task skipped) — e.g. to clear a selection */
  onDone?: () => void;
  className?: string;
}

export interface ZaloRemindButtonProps {
  taskId: string;
  size?: RemindButtonSize;
  variant?: RemindButtonVariant;
  className?: string;
}

/** Staff who may press "Nhắc khách" at all (the account-level rule is the api's). */
export function canRemindClients(viewer: Viewer | null): boolean {
  return (
    !!viewer &&
    viewer.org_type === 'internal' &&
    !viewer.read_only &&
    (viewer.role === 'director' || viewer.role === 'am')
  );
}

function announce(result: { reminded: number; skipped: number }, asked: number): void {
  const { reminded, skipped } = result;
  if (reminded === 0) {
    toastInfo(asked > 1 ? t('notify.remind.noneSentMany', { count: asked }) : t('notify.remind.noneSent'));
  } else if (skipped > 0) {
    toastSuccess(t('notify.remind.sentPartial', { count: reminded, skipped }));
  } else if (reminded > 1) {
    toastSuccess(t('notify.remind.sentMany', { count: reminded }));
  } else {
    toastSuccess(t('notify.remind.sent'));
  }
}

/** "Nhắc khách": sends the reminder email right away, logs it and bumps "Đã nhắc N lần" (one or many tasks). */
export function RemindClientButton({
  taskIds,
  size = 'sm',
  variant = 'secondary',
  label,
  onDone,
  className,
}: RemindClientButtonProps) {
  const viewer = useViewer();
  const { run, pending } = useAction();
  if (!canRemindClients(viewer)) return null;

  const ids = [...new Set(taskIds)];
  const text = label ?? t('notify.remind.label');
  const iconOnly = size === 'icon';

  async function remind() {
    const result = await run(() => api.remindClient(ids));
    if (!result) return;
    announce(result, ids.length);
    onDone?.();
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      loading={pending}
      disabled={ids.length === 0}
      aria-label={iconOnly ? text : undefined}
      title={iconOnly ? text : undefined}
      onClick={() => void remind()}
    >
      {/* kept while busy: the Button swaps it for its spinner after 150 ms (DESIGN §8.2) */}
      <BellRing aria-hidden="true" />
      {iconOnly ? null : text}
    </Button>
  );
}

/**
 * "Nhắc qua Zalo": a popover previews the ready-to-paste message (recipient, task, due date, deep link);
 * the button copies it and opens zalo.me/<phone> in a new tab for the AM to paste and send.
 */
export function ZaloRemindButton({ taskId, size = 'sm', variant = 'secondary', className }: ZaloRemindButtonProps) {
  const viewer = useViewer();
  const allowed = canRemindClients(viewer);
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  // the sibling's disabled look waits 150 ms (a fast copy never flashes it); copying still guards the click
  const copyingVisible = useDelayedFlag(copying);
  const contentRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const messageId = useId();
  const query = useQuery(() => api.getZaloReminder(taskId), [taskId], { enabled: open && allowed });

  if (!allowed) return null;

  const reminder = query.data;
  const label = t('notify.zalo.label');
  const iconOnly = size === 'icon';

  async function send(openZalo: boolean) {
    if (!reminder) return;
    setCopying(true);
    const copied = await copyText(reminder.text, contentRef.current);
    setCopying(false);
    if (!copied) {
      // leave the popover open with the message selected, ready for Ctrl/Cmd + C
      const el = messageRef.current;
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (el && selection) selection.selectAllChildren(el);
      toastError(t('notify.zalo.copyFailed'));
      return;
    }
    if (openZalo && reminder.url) {
      toastSuccess(t('notify.zalo.copied'));
      window.open(reminder.url, '_blank', 'noopener');
    } else if (reminder.url) {
      toastSuccess(t('notify.zalo.copied'));
    } else {
      toastInfo(t('notify.zalo.copiedNoPhone'));
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          aria-label={iconOnly ? label : undefined}
          title={iconOnly ? label : undefined}
        >
          <MessageCircle aria-hidden="true" />
          {iconOnly ? null : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent ref={contentRef} align="end" sideOffset={8} className="w-[24rem] p-0">
        <div className="space-y-0.5 px-4 pb-2 pt-4">
          <p className="text-heading font-semibold tracking-tightish text-ink">{t('notify.zalo.title')}</p>
          {reminder ? (
            <p className="flex items-center gap-1.5 text-caption">
              {reminder.phone ? (
                <>
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular">{t('notify.zalo.to', { phone: reminder.phone })}</span>
                </>
              ) : (
                <>
                  <PhoneOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('notify.zalo.noPhone')}</span>
                </>
              )}
            </p>
          ) : null}
        </div>

        <div className="space-y-2.5 px-4 pb-4 pt-2">
          {query.loading || (!reminder && !query.error) ? (
            <div role="status" aria-busy="true" className="skeleton-reveal space-y-2 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
              <span className="sr-only">{t('notify.zalo.loading')}</span>
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : query.error && !reminder ? (
            <p role="alert" className="rounded-lg bg-subtle p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/60">
              {errorMessage(query.error)}
            </p>
          ) : reminder ? (
            <>
              <p id={messageId} className="sr-only">
                {t('notify.zalo.messageLabel')}
              </p>
              <p
                ref={messageRef}
                aria-labelledby={messageId}
                className="max-h-56 select-text overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-subtle p-3 text-table text-foreground ring-1 ring-inset ring-border/60 [overflow-wrap:anywhere]"
              >
                {reminder.text}
              </p>
              <p className="text-caption">{reminder.url ? t('notify.zalo.hint') : t('notify.zalo.hintNoPhone')}</p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-subtle/60 px-4 py-3">
          {reminder?.url ? (
            <Button type="button" variant="ghost" size="sm" disabled={copyingVisible} onClick={() => { if (!copying) void send(false); }}>
              {t('notify.zalo.copyOnly')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            loading={copying}
            disabled={!reminder}
            className={cn(!reminder?.url && 'min-w-[9rem]')}
            onClick={() => void send(true)}
          >
            <Copy aria-hidden="true" />
            {reminder?.url ? t('notify.zalo.copyAndOpen') : t('notify.zalo.copy')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
