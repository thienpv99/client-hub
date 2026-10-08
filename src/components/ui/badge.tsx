import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4 status pill: 24px tall, 12px medium text, soft tint. Status variants (success/warning/danger) must
// always come with an icon (12px) or a `dot` AND a word — never colour alone.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-muted text-muted-foreground',
        // tinted pills carry a hairline in their own colour — the same edge as HealthBadge (v3 consistency)
        primary: 'border-primary-border/60 bg-primary-soft text-primary',
        success: 'border-success/15 bg-success-soft text-success',
        warning: 'border-warning/20 bg-warning-soft text-warning',
        danger: 'border-danger/15 bg-danger-soft text-danger',
        outline: 'border-border-strong bg-card text-muted-foreground',
        note: 'border-note-border bg-note text-foreground',
      },
      size: {
        default: 'h-6 px-2 text-micro',
        /** dense tables and inline meta rows */
        sm: 'h-5 gap-1 px-1.5 text-micro',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  /** Leading 6px dot in the text colour (compact alternative to an icon in dense tables). */
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, asChild = false, dot = false, children, ...props }, ref) => {
    const classes = cn(badgeVariants({ variant, size }), className);
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={classes} {...props}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <span ref={ref} className={classes} {...props}>
        {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
        {children}
      </span>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
