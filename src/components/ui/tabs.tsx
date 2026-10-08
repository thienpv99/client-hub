import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';
import { SCROLL_FADE_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { useSlidingIndicator } from '@/components/ui/use-sliding-indicator';

/**
 * 'underline' = page tabs right under a PageHeader (full-bleed hairline, 2px primary bar under the active tab).
 * 'segmented' (= 'pill' = 'default') = in-card switch: muted track, white active segment.
 * Both draw ONE active indicator (white segment / 2px bar) that glides between the tabs (DESIGN.md §8.3); until it
 * is measured, the active tab draws its own.
 */
export type TabsListVariant = 'default' | 'pill' | 'segmented' | 'underline';

const TabsVariantContext = React.createContext<'pill' | 'underline'>('pill');

/** width of the scroll-fade mask (index.css `.scroll-fade-x`) + a little air */
const EDGE_FADE = 44;

const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsListVariant;
}

/** the sliding active indicator: white segment (pill) · 2px primary bar (underline). Positioned by useSlidingIndicator. */
const INDICATOR = {
  pill: 'pointer-events-none absolute left-0 top-0 rounded-md bg-card opacity-0 shadow-segment transition-[transform,width,height] duration-250 ease-out-quart',
  underline:
    'pointer-events-none absolute left-0 top-0 h-0.5 rounded-full bg-primary opacity-0 transition-transform duration-250 ease-out-quart',
} as const;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const kind = variant === 'underline' ? 'underline' : 'pill';
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    const indicatorRef = React.useRef<HTMLSpanElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);
    useSlidingIndicator(innerRef, indicatorRef, {
      activeSelector: '[role="tab"][data-state="active"]',
      itemSelector: '[role="tab"]',
      mode: kind === 'underline' ? 'underline' : 'box',
    });

    // Keep the active tab visible when the list scrolls horizontally (mobile), also when the
    // value changes from outside (URL, uncontrolled state) — clear of the 40px edge fade (index.css .scroll-fade-x),
    // so the active tab is never half under the fade.
    React.useEffect(() => {
      const list = innerRef.current;
      if (!list) return;
      const reveal = () => {
        const max = list.scrollWidth - list.clientWidth;
        if (max <= 1) return;
        const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
        if (!active) return;
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        const current = list.scrollLeft;
        let target = current;
        if (left - EDGE_FADE < current) target = left - EDGE_FADE;
        else if (right + EDGE_FADE > current + list.clientWidth) target = right + EDGE_FADE - list.clientWidth;
        target = Math.max(0, Math.min(max, target));
        if (Math.abs(target - current) > 1) list.scrollTo({ left: target });
      };
      reveal();
      // the strip often starts to overflow only after first paint (web font, counts arriving): reveal again when
      // the list or a tab changes size
      const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => reveal());
      const watchTabs = () => {
        if (!sizes) return;
        sizes.disconnect();
        sizes.observe(list);
        list.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => sizes.observe(tab));
      };
      watchTabs();
      const observer = new MutationObserver((records) => {
        if (records.some((r) => r.type === 'childList')) watchTabs();
        reveal();
      });
      observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
      return () => {
        observer.disconnect();
        sizes?.disconnect();
      };
    }, []);
    // a strip that scrolls (phones) fades its cut edge
    useScrollFade(innerRef);

    return (
      <TabsVariantContext.Provider value={kind}>
        <TabsPrimitive.List
          ref={innerRef}
          data-variant={kind}
          className={cn(
            'group/tabs no-scrollbar relative max-w-full overflow-x-auto overflow-y-hidden',
            SCROLL_FADE_CLASS,
            kind === 'pill'
              ? // the hairline keeps the track readable on the page background (bg-muted ≈ bg-background); inside a white
                // card it is barely there
                'inline-flex items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground ring-1 ring-inset ring-border/70'
              : 'flex w-full items-stretch gap-1 shadow-[inset_0_-1px_0_0_rgb(var(--border))] md:gap-2',
            className,
          )}
          {...props}
        >
          {/* first child: the tabs (position: relative) paint above it */}
          <span ref={indicatorRef} aria-hidden="true" data-tabs-indicator="" className={INDICATOR[kind]} />
          {children}
        </TabsPrimitive.List>
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
  // once the sliding indicator is placed (list data-indicator="ready"), it draws the segment instead of the tab
  pill: cn(
    'h-11 rounded-md px-3 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-segment md:h-8',
    'group-data-[indicator=ready]/tabs:data-[state=active]:bg-transparent group-data-[indicator=ready]/tabs:data-[state=active]:shadow-none',
  ),
  // the 2px bar is a pseudo element as wide as the label (inset by the padding); hovering an inactive tab previews it.
  // Once the sliding bar is placed, the active tab's own bar steps aside.
  underline: cn(
    'h-11 rounded-t-md px-3 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground',
    'after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors after:duration-150',
    'data-[state=inactive]:hover:after:bg-border-strong data-[state=active]:after:bg-primary',
    'group-data-[indicator=ready]/tabs:data-[state=active]:after:bg-transparent',
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
