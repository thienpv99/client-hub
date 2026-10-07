import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

// Dialog = only for irreversible actions or short required input (design rule). Details use Sheet.
// DESIGN.md §4: phones (<640px) = bottom sheet (full width, rounded top, handle bar, actions stacked full width);
// from sm: centered card, max-w-md, rounded-xl, p-6, actions bottom-right (primary last).

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const overlayClassName =
  'fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClassName, className)} {...props} />
));
DialogOverlay.displayName = 'DialogOverlay';

/** Shared look of dialog-like panels (also used by AlertDialog). The handle bar (phones) is a ::before. */
const dialogPanelClassName = [
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto',
  'rounded-t-2xl border border-border/70 bg-card px-5 pt-8 text-foreground shadow-pop outline-none',
  'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
  'before:absolute before:left-1/2 before:top-2.5 before:h-1 before:w-9 before:-translate-x-1/2 before:rounded-full before:bg-border-strong',
  'data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
  'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-xl sm:p-6',
  'sm:before:hidden sm:data-[state=open]:animate-zoom-in sm:data-[state=closed]:animate-fade-out',
].join(' ');

/**
 * `mobileFullScreen`: phones get a full screen (no handle bar, fades/zooms in instead of sliding up like a sheet) —
 * for flows that own the whole screen (first-login intro); from sm it is the same centred card as every dialog.
 */
const fullScreenPhoneClassName = [
  'top-0 h-[100dvh] max-h-[100dvh] rounded-none border-0 before:hidden',
  'data-[state=open]:animate-zoom-in data-[state=closed]:animate-fade-out',
  'sm:h-fit sm:border',
].join(' ');

const closeButtonClassName =
  'touch-tap-square absolute right-2 top-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none sm:right-4 sm:top-4 sm:h-9 sm:w-9';

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** aria-label of the close (X) button. */
  closeLabel?: string;
  showCloseButton?: boolean;
  overlayClassName?: string;
  /** phones: full screen instead of a bottom sheet (no handle, no slide-up); sm+: the usual centred card */
  mobileFullScreen?: boolean;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, closeLabel, showCloseButton = true, overlayClassName: overlayClass, mobileFullScreen = false, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay className={overlayClass} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogPanelClassName, mobileFullScreen && fullScreenPhoneClassName, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label={closeLabel ?? t('common.close')}
            title={closeLabel ?? t('common.close')}
            className={closeButtonClassName}
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pr-10 text-left sm:pr-8', className)} {...props} />;
}
DialogHeader.displayName = 'DialogHeader';

/** Actions: stacked full width on phones (primary on top), bottom-right from sm (primary last). */
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end', className)}
      {...props}
    />
  );
}
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-title font-semibold tracking-tightish text-ink', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-table text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogPanelClassName,
};
