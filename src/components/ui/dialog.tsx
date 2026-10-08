import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { CaptureOpener, useReturnFocus } from '@/components/ui/use-return-focus';

// Dialog = only for irreversible actions or short required input (design rule). Details use Sheet.
// DESIGN.md §4: phones (<640px) = bottom sheet (full width, rounded top, handle bar, actions stacked full width);
// from sm: centered card, max-w-md, rounded-xl, p-6, actions bottom-right (primary last).

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

// Motion (DESIGN.md §8): the scrim fades with a light blur; the panel scales 0.96 → 1 on the spring curve (220 ms)
// and leaves faster (150 ms). Radix unmounts each part on its own animationend (reduced motion: 1 ms animations).
const overlayClassName =
  'fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClassName, className)} {...props} />
));
DialogOverlay.displayName = 'DialogOverlay';

/** Shared look of dialog-like panels (also used by AlertDialog). The handle bar (phones) is a ::before. */
const dialogPanelClassName = [
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto overscroll-contain',
  'rounded-t-2xl border border-border/70 bg-card px-5 pt-8 text-foreground shadow-pop outline-none',
  'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
  'before:absolute before:left-1/2 before:top-2.5 before:h-1 before:w-9 before:-translate-x-1/2 before:rounded-full before:bg-border-strong',
  'data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
  'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-xl sm:p-6',
  'sm:before:hidden sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out',
].join(' ');

/**
 * `mobileFullScreen`: phones get a full screen (no handle bar, fades/zooms in instead of sliding up like a sheet) —
 * for flows that own the whole screen (first-login intro); from sm it is the same centred card as every dialog.
 */
const fullScreenPhoneClassName = [
  'top-0 h-[100dvh] max-h-[100dvh] rounded-none border-0 before:hidden',
  'data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
  'sm:h-fit sm:border',
].join(' ');

const closeButtonBase =
  'touch-tap-square absolute inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none sm:h-9 sm:w-9';

/**
 * The X sits in the panel's top-right corner and scrolls away with a long form. It is deliberately NOT sticky: a pinned
 * X ends up on top of the right end of fields scrolling under it (hiding a select's arrow and turning a tap on the
 * field into "close", which resets a half-filled create form). Escape, the scrim and the sticky footer's "Hủy" still
 * close a scrolled dialog. It is the last child, so Radix still focuses the first field on open.
 */
const closeButtonCornerClassName = 'right-2 top-3 sm:right-4 sm:top-4';

/**
 * Keeps `data-scrollable` on the dialog panel while its content is taller than the panel (a long form on a short
 * screen or the phone bottom sheet): DialogFooter then shows its hairline bar. Re-checked whenever the panel or one of
 * its direct children changes size, and when content is added or removed anywhere inside (fields appearing, errors,
 * async options).
 */
function useScrollableFlag(panel: HTMLElement | null) {
  React.useEffect(() => {
    if (!panel) return undefined;
    const check = () => {
      const scrollable = panel.scrollHeight > panel.clientHeight + 1;
      if (scrollable !== panel.hasAttribute('data-scrollable')) panel.toggleAttribute('data-scrollable', scrollable);
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    const observe = () => {
      if (!sizes) return;
      sizes.disconnect();
      sizes.observe(panel);
      for (const child of Array.from(panel.children)) sizes.observe(child);
    };
    observe();
    const content = new MutationObserver((records) => {
      if (records.some((r) => r.target === panel)) observe();
      check();
    });
    content.observe(panel, { childList: true, subtree: true });
    check();
    return () => {
      sizes?.disconnect();
      content.disconnect();
    };
  }, [panel]);
}

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** aria-label of the close (X) button. */
  closeLabel?: string;
  showCloseButton?: boolean;
  overlayClassName?: string;
  /** phones: full screen instead of a bottom sheet (no handle, no slide-up); sm+: the usual centred card */
  mobileFullScreen?: boolean;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    {
      className,
      children,
      closeLabel,
      showCloseButton = true,
      overlayClassName: overlayClass,
      mobileFullScreen = false,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    // focus goes back to whatever opened the dialog (most are opened without a DialogTrigger)
    const { opener, focusProps } = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus);
    const [panel, setPanel] = React.useState<HTMLDivElement | null>(null);
    const panelRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        setPanel(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    useScrollableFlag(panel);
    const panelClassName = cn('group/dialog', dialogPanelClassName, mobileFullScreen && fullScreenPhoneClassName, className);
    const label = closeLabel ?? t('common.close');
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClass} />
        <DialogPrimitive.Content ref={panelRef} className={panelClassName} {...props} {...focusProps}>
          <CaptureOpener into={opener} />
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close aria-label={label} title={label} className={cn(closeButtonBase, closeButtonCornerClassName)}>
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pr-10 text-left sm:pr-8', className)} {...props} />;
}
DialogHeader.displayName = 'DialogHeader';

/**
 * Actions: stacked full width on phones (primary on top), bottom-right from sm (primary last). Sticky at the bottom of
 * the panel (DESIGN §6: primary actions keep their position): in a long form that scrolls, the actions stay in view
 * on a card-coloured bar under a hairline; a short dialog looks as before (the bar only shows while the panel scrolls).
 * The negative margins = the panel's padding, so the bar runs edge to edge; the negative `bottom` (= the panel's bottom
 * padding: sticky insets count from the content box) makes it rest flush on the panel's bottom edge. The negative bottom
 * margin is !important because forms space their fields with space-y-*, whose sibling rule (higher specificity)
 * would otherwise reset it to 0 and leave a padding-high blank band under the bar at the end of the scroll.
 */
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 -mx-5 !-mb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col-reverse gap-2 border-t border-transparent bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1',
        'sm:-bottom-6 sm:-mx-6 sm:!-mb-6 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-6',
        'group-data-[scrollable]/dialog:-mt-2 group-data-[scrollable]/dialog:border-border/70 group-data-[scrollable]/dialog:bg-card/95 group-data-[scrollable]/dialog:pt-3 group-data-[scrollable]/dialog:backdrop-blur',
        className,
      )}
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
