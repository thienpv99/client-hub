import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4 Button. One primary per view region; destructive only in confirm dialogs.
// Press feedback (scale 0.98) on every filled/outlined variant; transitions 150 ms ease-out-quart (reduced motion: 0).
const pressable = 'active:scale-[0.98]';

const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-table font-medium',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-quart',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50',
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
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element (e.g. a router Link) with button styles. */
  asChild?: boolean;
  /** Shows a small inline spinner and disables the button. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          className={classes}
          aria-disabled={disabled || loading || undefined}
          aria-busy={loading || undefined}
          {...props}
        >
          {children}
        </Slot.Root>
      );
    }

    const spinner = <Loader2 className="animate-spin" aria-hidden="true" />;
    const iconOnly = size === 'icon' || size === 'icon-sm';
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && iconOnly ? (
          spinner
        ) : (
          <>
            {loading && spinner}
            {children}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
