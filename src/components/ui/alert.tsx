import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/ui/cn';

// Put a lucide icon as the first child: <Alert variant="warning"><TriangleAlert /><AlertTitle/>…</Alert>.
// Status variants must always carry an icon + text (design rule). Soft tint, hairline border, no heavy blocks.
const alertVariants = cva(
  'relative grid w-full items-start gap-y-0.5 rounded-xl border px-4 py-3.5 text-table has-[>svg]:grid-cols-[1.125rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-[18px] [&>svg]:translate-y-px',
  {
    variants: {
      variant: {
        default: 'border-border/70 bg-card text-foreground shadow-xs [&>svg]:text-muted-foreground',
        info: 'border-primary-border/70 bg-primary-soft text-foreground [&>svg]:text-primary',
        success: 'border-success/15 bg-success-soft text-foreground [&>svg]:text-success',
        warning: 'border-warning/15 bg-warning-soft text-foreground [&>svg]:text-warning',
        danger: 'border-danger/15 bg-danger-soft text-foreground [&>svg]:text-danger',
        note: 'border-note-border bg-note text-foreground [&>svg]:text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant, role, ...props }, ref) => (
  <div
    ref={ref}
    role={role ?? (variant === 'danger' ? 'alert' : undefined)}
    data-variant={variant ?? 'default'}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('col-start-2 font-medium leading-5 text-foreground', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('col-start-2 grid gap-1 leading-5 text-muted-foreground [&_p]:leading-5', className)}
      {...props}
    />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
