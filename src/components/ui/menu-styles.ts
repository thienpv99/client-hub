// Shared look of floating menus (DropdownMenu, Select, Command lists) — DESIGN.md §4: rounded-xl panel with
// shadow-pop, 8px item radius, 36px items with the mouse (44px on phones), 16px icons in the secondary colour.

/**
 * Motion of every floating panel (DESIGN.md §8): scale 0.96 → 1 + fade (`animate-pop-in`, 150 ms out-quart) from the
 * Radix transform origin, nudged 4px from the trigger side; out = `animate-pop-out` (120 ms). Each panel adds its own
 * `origin-[var(--radix-<part>-content-transform-origin)]`.
 */
export const popMotion =
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out data-[side=bottom]:[--pop-y:-4px] data-[side=top]:[--pop-y:4px] data-[side=left]:[--pop-x:4px] data-[side=left]:[--pop-y:0px] data-[side=right]:[--pop-x:-4px] data-[side=right]:[--pop-y:0px]';

export const menuPanelBase = `z-50 overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-pop ${popMotion}`;

// touch-tap (index.css): 44px rows on every touch screen, iPad included
export const menuItemBase =
  'touch-tap relative flex min-h-tap cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-table text-foreground outline-none transition-colors duration-100 focus:bg-muted data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 md:min-h-9 md:py-1.5 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';

/** Group heading inside a menu (12px, secondary colour). */
export const menuLabelBase = 'px-2.5 pb-1 pt-2 text-micro font-medium text-muted-foreground';

export const menuSeparatorBase = '-mx-1.5 my-1.5 h-px bg-border/70';
