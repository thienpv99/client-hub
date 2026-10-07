import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/ui/cn';

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
          // shadow-segment (not a ring): the keyboard focus ring still shows on the active segment
          'hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-segment',
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
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex max-w-full items-center gap-1',
      variant === 'segmented' && 'gap-0.5 rounded-lg bg-muted p-1',
      className,
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
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
