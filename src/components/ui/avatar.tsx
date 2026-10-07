import * as React from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4: 28px in rows, 36px in headers; initials 12px semibold. Stacks: wrap in <AvatarGroup>.
const avatarSizes = {
  xs: 'h-6 w-6 text-[11px]',
  sm: 'h-7 w-7 text-micro',
  md: 'h-9 w-9 text-micro',
  lg: 'h-11 w-11 text-table',
} as const;

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  /** xs 24 · sm 28 (rows) · md 36 (headers, default) · lg 44. */
  size?: keyof typeof avatarSizes;
}

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn('relative flex shrink-0 select-none overflow-hidden rounded-full', avatarSizes[size], className)}
      {...props}
    />
  ),
);
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full object-cover', className)} {...props} />
));
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_rgb(var(--border))]',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';

/** Overlapping avatar stack (`-space-x-2`, each ringed in the card colour). */
function AvatarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center -space-x-2 [&>*]:ring-2 [&>*]:ring-card', className)} {...props} />;
}
AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
