import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';
import { useArrivalMotion } from '@/hooks/useMotion';

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** e.g. 'bg-success' for a completed bar (status colour must still come with text nearby). */
  indicatorClassName?: string;
  /** sm 6px (default, DESIGN.md §4) · md 8px. */
  size?: 'sm' | 'md';
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, size = 'sm', ...props }, ref) => {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const safeValue =
      value === null || value === undefined || !Number.isFinite(value) ? null : Math.min(safeMax, Math.max(0, value));
    const pct = safeValue === null ? 0 : (safeValue / safeMax) * 100;
    // grows from empty only on page arrival — a tab switch or a drawer remounting the bar shows it at once (§8.5)
    const arrival = useArrivalMotion();
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={safeValue}
        max={safeMax}
        className={cn('relative w-full overflow-hidden rounded-full bg-muted', size === 'md' ? 'h-2' : 'h-1.5', className)}
        {...props}
      >
        {/* grows from empty on page arrival (animate-progress-grow ends on the inline transform), then eases to new values */}
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full w-full flex-1 rounded-full bg-primary transition-transform duration-500 ease-out-quart',
            arrival && 'animate-progress-grow',
            indicatorClassName,
          )}
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
