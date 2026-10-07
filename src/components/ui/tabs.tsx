import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';
import { SCROLL_FADE_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';

/**
 * 'underline' = page tabs right under a PageHeader (full-bleed hairline, 2px primary bar under the active tab).
 * 'segmented' (= 'pill' = 'default') = in-card switch: muted track, white active segment.
 */
export type TabsListVariant = 'default' | 'pill' | 'segmented' | 'underline';

const TabsVariantContext = React.createContext<'pill' | 'underline'>('pill');

const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsListVariant;
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const kind = variant === 'underline' ? 'underline' : 'pill';
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

    // Keep the active tab visible when the list scrolls horizontally (mobile), also when the
    // value changes from outside (URL, uncontrolled state).
    React.useEffect(() => {
      const list = innerRef.current;
      if (!list) return;
      const reveal = () => {
        if (list.scrollWidth <= list.clientWidth) return;
        const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
        if (!active) return;
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
          list.scrollTo({ left: Math.max(0, left - 16) });
        }
      };
      reveal();
      const observer = new MutationObserver(reveal);
      observer.observe(list, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
      return () => observer.disconnect();
    }, []);
    // a strip that scrolls (phones) fades its cut edge
    useScrollFade(innerRef);

    return (
      <TabsVariantContext.Provider value={kind}>
        <TabsPrimitive.List
          ref={innerRef}
          data-variant={kind}
          className={cn(
            'no-scrollbar relative max-w-full overflow-x-auto overflow-y-hidden',
            SCROLL_FADE_CLASS,
            kind === 'pill'
              ? 'inline-flex items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground'
              : 'flex w-full items-stretch gap-1 shadow-[inset_0_-1px_0_0_rgb(var(--border))] md:gap-2',
            className,
          )}
          {...props}
        />
      </TabsVariantContext.Provider>
    );
  },
);
TabsList.displayName = 'TabsList';

// touch-tap (index.css): 44px on touch screens, iPad included. `group` lets a count pill follow the active state.
const triggerBase =
  'group touch-tap relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-table font-medium transition-[color,background-color,box-shadow] duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

const triggerByKind = {
  // same active segment as ToggleGroup variant="segmented": white + shadow-segment (lift and hairline; a shadow, so
  // the focus ring still shows on the active tab)
  pill: 'h-11 rounded-md px-3 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-segment md:h-8',
  // the 2px bar is a pseudo element as wide as the label (inset by the padding); hovering an inactive tab previews it
  underline: cn(
    'h-11 rounded-t-md px-3 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground',
    'after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors after:duration-150',
    'data-[state=inactive]:hover:after:bg-border-strong data-[state=active]:after:bg-primary',
  ),
} as const;

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Small count pill after the label (hidden when null/undefined). Neutral; primary-tinted on the active tab. */
  count?: number | null;
  /** 'danger' for counts that need action (overdue). The label text must still say what is counted. */
  countTone?: 'neutral' | 'danger';
  /** Screen-reader text for the count, e.g. t('…', { count }) → "3 việc". Defaults to the number. */
  countLabel?: string;
}

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, count, countTone = 'neutral', countLabel, children, ...props }, ref) => {
    const kind = React.useContext(TabsVariantContext);
    return (
      <TabsPrimitive.Trigger ref={ref} className={cn(triggerBase, triggerByKind[kind], className)} {...props}>
        {children}
        {count !== null && count !== undefined ? <TabsCount tone={countTone} label={countLabel} value={count} /> : null}
      </TabsPrimitive.Trigger>
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsCountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  tone?: 'neutral' | 'danger';
  /** Screen-reader text (e.g. "3 việc quá hạn"); the visible number is then hidden from assistive tech. */
  label?: string;
}

/** Count pill for a TabsTrigger (also usable inside custom tab-like links). */
function TabsCount({ value, tone = 'neutral', label, className, ...props }: TabsCountProps) {
  // on the muted segmented track an inactive pill is white, under page tabs it is muted
  const kind = React.useContext(TabsVariantContext);
  return (
    <span
      data-tab-count=""
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-medium tabular transition-colors',
        tone === 'danger'
          ? 'bg-danger-soft text-danger'
          : cn(
              kind === 'pill' ? 'bg-card' : 'bg-muted',
              'text-muted-foreground group-data-[state=active]:bg-primary-soft group-data-[state=active]:text-primary',
            ),
        className,
      )}
      {...props}
    >
      {label ? (
        <>
          <span aria-hidden="true">{value}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        value
      )}
    </span>
  );
}
TabsCount.displayName = 'TabsCount';

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 data-[state=active]:animate-fade-in',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount };
