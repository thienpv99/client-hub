import * as React from 'react';
import { cn } from '@/components/ui/cn';

// Keyboard key chip (Ctrl K in the sidebar search, palette hints). 11px is the floor for visible text (ARCHITECTURE §3).
const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded-[5px] border border-border-strong bg-card px-1.5 font-sans text-[11px] font-medium leading-none text-muted-foreground shadow-[inset_0_-1px_0_0_rgb(var(--border))]',
      className,
    )}
    {...props}
  />
));
Kbd.displayName = 'Kbd';

function KbdGroup({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center gap-1', className)} {...props} />;
}
KbdGroup.displayName = 'KbdGroup';

export { Kbd, KbdGroup };
