import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { useDelayedFlag } from '@/hooks/useMotion';

// DESIGN.md §4 Button. One primary per view region; destructive only in confirm dialogs.
// Motion (DESIGN.md §8): colour / border / shadow / transform transitions 150 ms ease-out-quart (reduced motion: 0);
// press = scale 0.98 on filled and outlined buttons — not on inline links nor on ghost icon buttons (a scaling glyph
// looks like a glitch). Disabled buttons take no pointer events, so they never press.
const pressable = 'active:scale-[0.98] active:duration-100';

const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-table font-medium',
    'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out-quart',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50',
    // a button that is busy (loading) reads as working, not as unavailable: dimmed less than a disabled one
    'aria-busy:disabled:opacity-80 aria-busy:aria-disabled:opacity-80',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      // touch-tap / touch-tap-square (index.css): 44px on every touch screen, iPad included (inline links excepted)
      variant: {
        default: cn('touch-tap bg-primary text-primary-foreground shadow-btn hover:bg-primary-hover', pressable),
        secondary: cn(
          'touch-tap border border-border-strong bg-card text-foreground shadow-btn-secondary hover:border-caption/40 hover:bg-subtle',
          pressable,
        ),
        outline: cn(
          'touch-tap border border-primary-border bg-card text-primary shadow-btn-secondary hover:border-primary/40 hover:bg-primary-soft',
          pressable,
        ),
        ghost: cn('touch-tap text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted', pressable),
        link: 'rounded-md text-primary underline-offset-4 hover:text-primary-hover hover:underline',
        destructive: cn('touch-tap bg-danger text-primary-foreground shadow-xs hover:bg-danger/90', pressable),
        soft: cn('touch-tap bg-primary-soft text-primary hover:bg-primary-border/50', pressable),
      },
      size: {
        default: 'h-11 px-4 md:h-10',
        // compact look, but still a 44px tap target on phones (SPEC §7)
        sm: 'h-9 min-h-tap gap-1.5 px-3 md:h-8 md:min-h-0',
        lg: 'h-12 px-6 text-body',
        /** always 44px: the full-width primary action on phones / iPad (DESIGN §5 client home) */
        touch: 'h-11 px-5 text-body',
        icon: 'touch-tap-square h-11 w-11 md:h-10 md:w-10',
        /** dense rows (table / card row actions): 32px with the mouse, 44px on touch screens */
        'icon-sm': 'touch-tap-square h-11 w-11 md:h-8 md:w-8',
      },
    },
    compoundVariants: [
      { variant: 'link', className: 'h-auto px-0 py-0.5 md:h-auto' },
      // a standalone link button (size sm) keeps the 44px target on touch screens too
      { variant: 'link', size: 'sm', className: 'touch-tap' },
      // ghost icon buttons (close, menu, bell…) answer a press with their fill only
      { variant: 'ghost', size: ['icon', 'icon-sm'], className: 'active:scale-100' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element (e.g. a router Link) with button styles. */
  asChild?: boolean;
  /**
   * Busy: the button ignores clicks (and Enter in its form) at once; after 150 ms (DESIGN.md §8) it also shows a
   * small spinner in place of its leading icon and turns disabled — a fast action never flickers. Keep the icon as
   * a child: the button swaps it for the spinner itself.
   */
  loading?: boolean;
  /**
   * For text buttons WITHOUT a leading icon (a spinner added beside the label would widen the button mid-action):
   * while busy the label stays in place but transparent (screen readers still read it) and the spinner sits centred
   * on top, so the button keeps its exact size. Not for buttons whose label changes while busy ("Đang gửi mã…").
   */
  spinnerOverlay?: boolean;
}

const spinner = <Loader2 className="animate-spin" data-button-spinner="" aria-hidden="true" />;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, spinnerOverlay = false, disabled, children, onClick, ...props },
    ref,
  ) => {
    // the look waits 150 ms; the guard (aria-busy + swallowed clicks) is immediate
    const busyVisible = useDelayedFlag(loading);
    const iconOnly = size === 'icon' || size === 'icon-sm';
    const overlay = spinnerOverlay && !iconOnly && !asChild;
    const classes = cn(
      buttonVariants({ variant, size }),
      // the spinner takes the place of the leading icon (direct svg children other than the spinner)
      busyVisible && !overlay && '[&>svg:not([data-button-spinner])]:hidden',
      className,
    );
    const guardedClick = loading
      ? (event: React.MouseEvent<HTMLButtonElement>) => {
          // a busy button never runs its action twice — also covers Enter in a form (implicit submit = click)
          event.preventDefault();
        }
      : onClick;

    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          className={classes}
          aria-disabled={disabled || busyVisible || undefined}
          aria-busy={loading || undefined}
          onClick={guardedClick}
          {...props}
        >
          {children}
        </Slot.Root>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || busyVisible}
        aria-busy={loading || undefined}
        onClick={guardedClick}
        {...props}
      >
        {overlay ? (
          <>
            {/* same tree busy or not (the label never remounts); `gap-[inherit]` keeps the button's own gap */}
            <span className={cn('inline-flex items-center justify-center gap-[inherit]', busyVisible && 'opacity-0')}>
              {children}
            </span>
            {busyVisible ? (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                {spinner}
              </span>
            ) : null}
          </>
        ) : busyVisible && iconOnly ? (
          spinner
        ) : (
          <>
            {busyVisible && spinner}
            {children}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
