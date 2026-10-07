import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** label of the required text area ("Lý do") */
  label: ReactNode;
  placeholder?: string;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  defaultValue?: string;
  /**
   * Receives the trimmed reason. The dialog shows a pending state while the promise runs and closes afterwards,
   * unless the handler returns (or resolves to) `false`, or throws.
   */
  onConfirm: (reason: string) => unknown;
}

/** Short required input (reason for a change request, manual unblock, override…). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  cancelLabel,
  destructive = false,
  defaultValue,
  onConfirm,
}: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState(defaultValue ?? '');
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setReason(defaultValue ?? '');
      setPending(false);
    }
  }, [open, defaultValue]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  async function submit() {
    if (!canSubmit) return;
    setPending(true);
    let close = false;
    try {
      const result: unknown = await onConfirm(trimmed);
      close = result !== false;
    } catch (err) {
      // the caller (useAction) normally toasts errors; keep the dialog open so nothing typed is lost
      console.error(err);
    } finally {
      if (mounted.current) setPending(false);
    }
    if (close) onOpenChange(false);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      {/* without a description, aria-describedby={undefined} tells Radix not to expect one */}
      <DialogContent className="sm:max-w-lg" {...(description ? {} : { 'aria-describedby': undefined })}>
        {/* arbitrary sizes: the kit's cn() may not know the text-title token yet */}
        <DialogHeader className="text-left">
          <DialogTitle className="text-[20px] leading-7 tracking-tightish text-ink">{title}</DialogTitle>
          {description ? <DialogDescription className="text-table text-muted-foreground">{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={id}>
              {label}
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            </Label>
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              rows={4}
              required
              aria-required="true"
              aria-describedby={`${id}-hint`}
              disabled={pending}
              autoFocus
              className="min-h-[104px] resize-y"
            />
            <p id={`${id}-hint`} className="hidden text-right text-micro text-muted-foreground md:block">
              {t('components.dialog.submitHint')}
            </p>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel ?? t('components.dialog.cancel')}
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={!canSubmit} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
