import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

// Drawer for details (task drawer = side "right"). SheetContent has no padding of its own:
// compose SheetHeader (sticky top) + SheetBody (scrolls) + SheetFooter (sticky action bar).
// DESIGN.md §4: right sheet rounded-l-xl on desktop; phones = full screen (mobileFullScreen) or a bottom sheet
// (rounded-t-2xl + drag handle — drag it down to close).

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const sheetVariants = cva('fixed z-50 flex flex-col overflow-y-auto bg-card text-foreground outline-none', {
  variants: {
    side: {
      right:
        'inset-y-0 right-0 h-full w-full border-l border-border/70 shadow-drawer sm:max-w-xl sm:rounded-l-xl lg:max-w-2xl data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
      left: 'inset-y-0 left-0 h-full w-[85%] max-w-sm rounded-r-xl border-r border-border/70 shadow-pop data-[state=open]:animate-slide-in-left data-[state=closed]:animate-fade-out',
      bottom:
        'inset-x-0 bottom-0 max-h-[90dvh] w-full rounded-t-2xl border-t border-border/70 shadow-pop data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
      top: 'inset-x-0 top-0 max-h-[90dvh] w-full rounded-b-2xl border-b border-border/70 shadow-pop data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out',
    },
    mobileFullScreen: { true: '', false: '' },
  },
  compoundVariants: [
    {
      side: 'right',
      mobileFullScreen: true,
      className: 'border-l-0 sm:max-w-none sm:rounded-none md:max-w-xl md:rounded-l-xl md:border-l lg:max-w-2xl',
    },
    {
      side: 'left',
      mobileFullScreen: true,
      className: 'w-full max-w-none rounded-none border-r-0 md:w-[85%] md:max-w-sm md:rounded-r-xl md:border-r',
    },
    {
      side: 'bottom',
      mobileFullScreen: true,
      className: 'h-[100dvh] max-h-none rounded-none border-t-0 md:h-auto md:max-h-[90dvh] md:rounded-t-2xl md:border-t',
    },
    {
      side: 'top',
      mobileFullScreen: true,
      className: 'h-[100dvh] max-h-none rounded-none border-b-0 md:h-auto md:max-h-[90dvh] md:rounded-b-2xl md:border-b',
    },
  ],
  defaultVariants: { side: 'right', mobileFullScreen: false },
});

/** Distance (px) a bottom sheet must be dragged down before it closes on release. */
const DRAG_CLOSE_DISTANCE = 80;

/** Drag the handle down to close a bottom sheet; a short drag snaps back. Pointer events (mouse + touch). */
function useDragToClose(closeRef: React.RefObject<HTMLButtonElement>) {
  const drag = React.useRef<{ startY: number; dy: number; panel: HTMLElement; id: number } | null>(null);

  const reset = (panel: HTMLElement) => {
    panel.style.transition = 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)';
    panel.style.transform = '';
  };

  return {
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return;
      const panel = event.currentTarget.closest<HTMLElement>('[data-sheet-panel]');
      if (!panel) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startY: event.clientY, dy: 0, panel, id: event.pointerId };
      panel.style.transition = 'none';
    },
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      d.dy = Math.max(0, event.clientY - d.startY);
      d.panel.style.transform = `translateY(${d.dy}px)`;
    },
    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      if (d.dy < DRAG_CLOSE_DISTANCE) {
        reset(d.panel);
        return;
      }
      // finish the slide from where the finger left it, then close without replaying the exit animation
      const panel = d.panel;
      panel.style.transition = 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1)';
      panel.style.transform = 'translateY(100%)';
      window.setTimeout(() => {
        panel.style.animation = 'none';
        closeRef.current?.click();
      }, 180);
    },
    onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      reset(d.panel);
    },
  };
}

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** aria-label of the close (X) button. */
  closeLabel?: string;
  showCloseButton?: boolean;
  overlayClassName?: string;
  /** Bottom sheets only: the drag handle on top (default true; hidden on phones when mobileFullScreen). */
  showHandle?: boolean;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  (
    {
      side = 'right',
      mobileFullScreen = false,
      className,
      children,
      closeLabel,
      showCloseButton = true,
      overlayClassName,
      showHandle = true,
      ...props
    },
    ref,
  ) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const dragHandlers = useDragToClose(closeRef);
    const withHandle = side === 'bottom' && showHandle;
    const label = closeLabel ?? t('common.close');
    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <SheetPrimitive.Content
          ref={ref}
          data-side={side ?? 'right'}
          data-sheet-panel=""
          className={cn(sheetVariants({ side, mobileFullScreen }), className)}
          {...props}
        >
          {withHandle ? (
            <div
              aria-hidden="true"
              data-sheet-handle=""
              className={cn(
                'flex shrink-0 cursor-grab touch-none select-none justify-center pb-1 pt-2.5 active:cursor-grabbing',
                mobileFullScreen && 'hidden md:flex',
              )}
              {...dragHandlers}
            >
              <span className="h-1 w-9 rounded-full bg-border-strong" />
            </div>
          ) : null}
          {children}
          {showCloseButton ? (
            <SheetPrimitive.Close
              aria-label={label}
              title={label}
              className={cn(
                'touch-tap-square absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:right-4 md:top-4 md:h-9 md:w-9',
                // below the drag handle, level with the title
                withHandle && (mobileFullScreen ? 'md:top-8' : 'top-6 md:top-8'),
              )}
            >
              <X className="h-5 w-5 md:h-[18px] md:w-[18px]" aria-hidden="true" />
            </SheetPrimitive.Close>
          ) : null}
          {withHandle ? (
            <SheetPrimitive.Close ref={closeRef} tabIndex={-1} aria-hidden="true" className="hidden" />
          ) : null}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = 'SheetContent';

/** Title block. Sticky: it stays on top when the whole sheet scrolls (without a SheetBody). */
function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('sticky top-0 z-10 flex shrink-0 flex-col gap-1 bg-card p-4 pr-14 md:p-6 md:pr-16', className)}
      {...props}
    />
  );
}
SheetHeader.displayName = 'SheetHeader';

/** One row of meta under the title (badges, project · milestone, due). */
function SheetMeta({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption', className)} {...props} />;
}
SheetMeta.displayName = 'SheetMeta';

/** Scrollable middle area of a sheet. */
const SheetBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('min-h-0 flex-1 content-start overflow-y-auto px-4 pb-4 md:px-6 md:pb-6', className)}
      {...props}
    />
  ),
);
SheetBody.displayName = 'SheetBody';

/** Sticky action bar (primary action last = right on desktop, on top of the stack on phones). */
function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:flex-row sm:justify-end md:px-6 md:py-4',
        className,
      )}
      {...props}
    />
  );
}
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-title font-semibold tracking-tightish text-ink', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-table text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetMeta,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  sheetVariants,
};
