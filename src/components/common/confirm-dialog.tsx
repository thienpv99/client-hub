import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { t } from '@/i18n';
import { useDelayedFlag } from '@/hooks/useMotion';
import { cn } from '@/components/ui/cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  /** red confirm button for irreversible actions (delete…) */
  destructive?: boolean;
  /** may be async: pending state until it settles; returning `false` (or throwing) keeps the dialog open */
  onConfirm: () => unknown;
}

/** Only for irreversible actions (SPEC §7). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open) setPending(false);
  }, [open]);
  // spinner + disabled look only when the action takes longer than 150 ms (DESIGN.md §8); `pending` guards at once
  const busy = useDelayedFlag(pending);

  async function handleConfirm(e: MouseEvent<HTMLButtonElement>) {
    // keep the dialog open while the action runs
    e.preventDefault();
    if (pending) return;
    setPending(true);
    let close = false;
    try {
      const result: unknown = await onConfirm();
      close = result !== false;
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setPending(false);
    }
    if (close) onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {destructive ? (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger ring-1 ring-inset ring-danger/15"
              aria-hidden="true"
            >
              <TriangleAlert className="h-5 w-5" />
            </span>
          ) : null}
          {/* arbitrary sizes: the kit's cn() may not know the text-title token yet */}
          <AlertDialogHeader className="min-w-0 flex-1 text-left">
            <AlertDialogTitle className="text-title font-semibold tracking-tightish text-ink">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-table text-muted-foreground">{description}</AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            disabled={busy}
            className="mt-0"
            onClick={(e) => {
              // the action is running: the guard is immediate even before the busy look shows
              if (pending) e.preventDefault();
            }}
          >
            {cancelLabel ?? t('components.dialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => void handleConfirm(e)}
            disabled={busy}
            variant={destructive ? 'destructive' : 'default'}
            aria-busy={pending || undefined}
          >
            {/* the label keeps its box (transparent while busy, still read out) and the spinner sits on top: the button
                never changes width mid-action (same as Button spinnerOverlay) */}
            <span className={cn('inline-flex items-center justify-center gap-[inherit]', busy && 'opacity-0')}>{confirmLabel}</span>
            {busy ? (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                <LoaderCircle className="h-4 w-4 animate-spin" />
              </span>
            ) : null}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
