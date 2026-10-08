import * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4 Card: quiet surface (hairline border at 70 %, soft shadow). Padding follows SectionCard
// (components/common): 16px on phones, 20px from sm. Inside a card separate rows with `divide-y divide-border/60`,
// never with nested boxes.

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Clickable card: hover lift (-1px + shadow-card-hover), press feedback, pointer cursor. */
  interactive?: boolean;
  /** Render the single child (e.g. a router Link) with the card styles — use with `interactive`. */
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, asChild = false, children, ...props }, ref) => {
    // asChild: the child's own classes join the merge, so a child's `flex` replaces the card's `block` instead of
    // sitting next to it (Slot alone just concatenates both — two display utilities on one element, DESIGN §7.1)
    const child = asChild && React.isValidElement<{ className?: string }>(children) ? children : null;
    const classes = cn(
      'rounded-xl border border-border/70 bg-card text-foreground shadow-card',
      interactive &&
        'block cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-px hover:border-border hover:shadow-card-hover active:translate-y-0 active:shadow-card',
      child?.props.className,
      className,
    );
    if (asChild) {
      return (
        <Slot.Root ref={ref} data-interactive={interactive || undefined} className={classes} {...props}>
          {child ? React.cloneElement(child, { className: undefined }) : children}
        </Slot.Root>
      );
    }
    return (
      <div ref={ref} data-interactive={interactive || undefined} className={classes} {...props}>
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

/** Title + description; a <CardAction> child sits at the right of the title row. */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-0.5 px-4 pb-3 pt-4 sm:px-5 sm:pt-5',
        'has-[>[data-card-action]]:grid-cols-[minmax(0,1fr)_auto]',
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

/** Right side of the header row (ghost / link buttons, a menu). Spans the title and description rows. */
const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-card-action=""
      className={cn('col-start-2 row-span-2 row-start-1 -my-1 flex items-center gap-1.5 self-start justify-self-end', className)}
      {...props}
    />
  ),
);
CardAction.displayName = 'CardAction';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Render the child heading (e.g. an h2) instead of the default h3. */
  asChild?: boolean;
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'h3';
    return (
      <Comp
        ref={ref}
        className={cn('text-heading font-semibold tracking-tightish text-ink', className)}
        {...props}
      />
    );
  },
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-caption', className)} {...props} />,
);
CardDescription.displayName = 'CardDescription';

/** Body. Without a header above it (first child) it gets the top padding too. */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pb-4 first:pt-4 sm:px-5 sm:pb-5 sm:first:pt-5', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

/** Footer bar under a hairline (secondary actions, "Xem tất cả", a summary line). */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3 text-table sm:px-5', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardAction, CardTitle, CardDescription, CardContent, CardFooter };
