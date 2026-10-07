import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';

// 40×24 track, 20px thumb. The ::after pseudo-element enlarges the hit area to 48×44px without changing layout.
// It is positioned against the padding box (inside the 2px border): 20px + 2×12px = 44px tall, 36px + 2×6px = 48px wide.
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-colors duration-200 ease-out-quart',
      'after:absolute after:-inset-x-1.5 after:-inset-y-3',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-caption/50 hover:data-[state=unchecked]:bg-caption/60',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-card shadow-[0_1px_3px_rgb(var(--ink)/0.18),0_1px_1px_rgb(var(--ink)/0.06)] ring-0 transition-transform duration-200 ease-out-quart data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export { Switch };
