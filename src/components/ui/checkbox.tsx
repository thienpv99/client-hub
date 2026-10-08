import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/components/ui/cn';

// Supports checked="indeterminate". The ::after pseudo-element enlarges the hit area to 44px.
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'group peer relative h-5 w-5 shrink-0 rounded-md border border-caption/80 bg-card text-primary-foreground shadow-xs',
      'transition-[background-color,border-color,box-shadow] duration-150 ease-out-quart hover:border-caption',
      // hit area 44×44: the ::after is placed against the 18px padding box (inside the 1px border) → 18 + 2×13
      'after:absolute after:-inset-[13px]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
      className,
    )}
    {...props}
  >
    {/* the mark scales in on the spring curve (DESIGN.md §8) */}
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current data-[state=checked]:animate-check-in data-[state=indeterminate]:animate-check-in">
      <Check className="h-3.5 w-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} aria-hidden="true" />
      <Minus className="hidden h-3.5 w-3.5 group-data-[state=indeterminate]:block" strokeWidth={3} aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
