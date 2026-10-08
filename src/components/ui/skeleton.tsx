import * as React from 'react';
import { cn } from '@/components/ui/cn';

// Shimmer block (`.skeleton` in index.css). Give it the real layout's sizes (DESIGN.md §4): title bar 40 %,
// text lines 70 / 50 %, a 36px-tall KPI number block, 28px avatars.
// The default 8px radius is a zero-specificity `:where(.skeleton)` rule (index.css), so a `rounded-*` class passed in
// simply wins — class names stay literal (no runtime `!rounded-*` rewriting).
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} aria-hidden="true" className={cn('skeleton', className)} {...props} />,
);
Skeleton.displayName = 'Skeleton';

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of text lines (default 2); the last one is shorter. */
  lines?: number;
}

/** Paragraph placeholder: 12px bars on a 20px rhythm, widths 100 / 70 / 50 %. */
function SkeletonText({ lines = 2, className, ...props }: SkeletonTextProps) {
  const widths = ['w-full', 'w-[70%]', 'w-1/2'];
  return (
    <div aria-hidden="true" className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3 rounded-full', i === lines - 1 && lines > 1 ? widths[2] : widths[Math.min(i, 1)])}
        />
      ))}
    </div>
  );
}
SkeletonText.displayName = 'SkeletonText';

export { Skeleton, SkeletonText };
