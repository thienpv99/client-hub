import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';

const HasProviderContext = React.createContext(false);

function TooltipProvider({
  delayDuration = 250,
  skipDelayDuration = 300,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <HasProviderContext.Provider value={true}>
      <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
    </HasProviderContext.Provider>
  );
}
TooltipProvider.displayName = 'TooltipProvider';

/** Uses the nearest TooltipProvider; brings its own when there is none. */
function Tooltip(props: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const hasProvider = React.useContext(HasProviderContext);
  const root = <TooltipPrimitive.Root {...props} />;
  return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>;
}
Tooltip.displayName = 'Tooltip';

const TooltipTrigger = TooltipPrimitive.Trigger;

// Dark ink chip, 12px medium text. Never the only way to get information (touch screens show no tooltip).
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'z-50 max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] rounded-lg bg-ink px-2.5 py-1.5 text-micro font-medium text-primary-foreground shadow-pop',
        // scale + fade from the trigger side (DESIGN.md §8), 2px nudge
        'data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-fade-in data-[state=closed]:animate-fade-out',
        'data-[side=bottom]:[--pop-y:-2px] data-[side=top]:[--pop-y:2px] data-[side=left]:[--pop-x:2px] data-[side=left]:[--pop-y:0px] data-[side=right]:[--pop-x:-2px] data-[side=right]:[--pop-y:0px]',
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-ink" width={10} height={5} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
