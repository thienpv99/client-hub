import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/ui/cn';
import { useSlidingIndicator } from '@/components/ui/use-sliding-indicator';

// variant 'segmented' = view switcher (Danh sách / Bảng, Tuần / Tháng): muted track + white active segment
// (DESIGN.md §4, same look as segmented Tabs). 'outline' = separate choice chips. Icon-only items need aria-label.
const toggleVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-table font-medium text-muted-foreground',
    'transition-[color,background-color,border-color,box-shadow] duration-150 ease-out-quart',
    'hover:bg-muted hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=on]:bg-primary-soft data-[state=on]:text-primary',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: '',
        outline:
          'rounded-lg border border-border-strong bg-card shadow-xs hover:bg-subtle data-[state=on]:border-primary-border data-[state=on]:bg-primary-soft data-[state=on]:shadow-none',
        segmented:
          // shadow-segment (not a ring): the keyboard focus ring still shows on the active segment. Single-choice groups
          // draw one sliding segment (DESIGN.md §8.3); once it is placed the item's own fill steps aside.
          'relative hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-segment group-data-[indicator=ready]/toggle:data-[state=on]:bg-transparent group-data-[indicator=ready]/toggle:data-[state=on]:shadow-none',
      },
      // touch-tap-square (index.css): 44px on touch screens (phones and iPad)
      size: {
        default: 'touch-tap-square h-11 min-w-11 px-3 md:h-9 md:min-w-9',
        sm: 'touch-tap-square h-9 min-w-9 px-2.5 md:h-8 md:min-w-8',
        lg: 'h-12 min-w-12 px-4',
      },
    },
    compoundVariants: [{ variant: 'segmented', size: 'default', className: 'h-10 md:h-8' }],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ToggleStyle = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = React.createContext<ToggleStyle>({ variant: 'default', size: 'default' });

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & ToggleStyle
>(({ className, variant, size, children, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const indicatorRef = React.useRef<HTMLSpanElement | null>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);
  // one sliding white segment for single-choice segmented controls (several "on" items cannot share one)
  const sliding = variant === 'segmented' && props.type === 'single';
  useSlidingIndicator(innerRef, indicatorRef, {
    activeSelector: 'button[data-state="on"]',
    itemSelector: 'button',
    enabled: sliding,
  });
  return (
    <ToggleGroupPrimitive.Root
      ref={innerRef}
      className={cn(
        'group/toggle inline-flex max-w-full items-center gap-1',
        // hairline: the track stays readable on the page background (bg-muted ≈ bg-background), as segmented Tabs
        variant === 'segmented' && 'relative gap-0.5 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/70',
        className,
      )}
      {...props}
    >
      {sliding ? (
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-md bg-card opacity-0 shadow-segment transition-[transform,width,height] duration-250 ease-out-quart"
        />
      ) : null}
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});
ToggleGroup.displayName = 'ToggleGroup';

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & ToggleStyle
>(({ className, variant, size, ...props }, ref) => {
  const ctx = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(toggleVariants({ variant: ctx.variant ?? variant, size: ctx.size ?? size }), className)}
      {...props}
    />
  );
});
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem, toggleVariants };
