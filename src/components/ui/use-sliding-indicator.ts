// Sliding active indicator (DESIGN.md §8.3): one absolutely positioned element that glides between the items of a
// tab strip / segmented control / nav list instead of every item drawing its own active background.
//
// Contract:
// - `containerRef` is `position: relative` (the indicator's containing block). It may scroll: the indicator is a child
//   of the scroll content, so it scrolls with the items.
// - `indicatorRef` is an absolutely positioned child at `left-0 top-0` with a transform transition in its classes (box
//   mode: also width/height — see place()); it starts with `opacity-0`; the hook shows it once it knows where to go.
// - Once placed, the container carries `data-indicator="ready"`; items drop their own active fill with a
//   `group-data-[indicator=ready]/<name>:…` class, so without JS / before measuring, the item itself still shows the
//   active state (no frame without one).
// Measuring is sub-pixel (getBoundingClientRect relative to the container, divided by the ancestors' scale), so it is
// right even while an ancestor is mid-animation (a dialog scaling in, a page fading up). First placement never animates; later moves do
// (CSS transition; reduced motion zeroes it). Re-measured on item / container resize (fonts, counts, window) and when
// the active item changes (data-state / aria-current / aria-selected attributes, items added or removed).
import * as React from 'react';

/** layout width of an underline bar; its visible width is a scaleX of it */
const UNDERLINE_BASE = 100;

export interface SlidingIndicatorOptions {
  /** selects the active item inside the container, e.g. `[role="tab"][data-state="active"]` */
  activeSelector: string;
  /** selects every item (watched for size changes), e.g. `[role="tab"]` */
  itemSelector: string;
  /** 'box' covers the item; 'underline' = a bar along the item's bottom edge, as wide as its content box */
  mode?: 'box' | 'underline';
  /** false: the hook does nothing (the items keep their own active look) */
  enabled?: boolean;
}

/**
 * Box of `el` in the coordinates of `container`'s scrollable padding box (where an absolute child at left/top 0 sits),
 * in layout pixels: sub-pixel exact, and divided by the ancestors' scale so a panel that is still zooming in (dialog,
 * popover) measures as it will be at rest. Null when `el` is not rendered.
 */
function boxWithin(el: HTMLElement, container: HTMLElement): { x: number; y: number; width: number; height: number } | null {
  if (el.getClientRects().length === 0 || container.offsetWidth === 0) return null;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const scale = c.width / container.offsetWidth || 1;
  return {
    x: (r.left - c.left) / scale - container.clientLeft + container.scrollLeft,
    y: (r.top - c.top) / scale - container.clientTop + container.scrollTop,
    width: r.width / scale,
    height: r.height / scale,
  };
}

export function useSlidingIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  indicatorRef: React.RefObject<HTMLElement | null>,
  { activeSelector, itemSelector, mode = 'box', enabled = true }: SlidingIndicatorOptions,
): void {
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!enabled || !container || !indicator) return undefined;
    let placed = false;
    let last = '';

    const hide = () => {
      if (!placed && last === 'hidden') return;
      placed = false;
      last = 'hidden';
      indicator.style.opacity = '0';
      container.removeAttribute('data-indicator');
    };

    const place = () => {
      const active = container.querySelector<HTMLElement>(activeSelector);
      const box = active ? boxWithin(active, container) : null;
      if (!active || !box || box.width === 0) {
        hide();
        return;
      }
      const cs = window.getComputedStyle(active);
      let { x, y, width, height } = box;
      if (mode === 'underline') {
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        x += padLeft;
        width = Math.max(0, width - padLeft - padRight);
        height = indicator.offsetHeight || 2;
        y = box.y + box.height - height;
      }
      // 1/100 px is plenty and keeps the "nothing moved" comparison stable
      const round = (v: number) => Math.round(v * 100) / 100;
      x = round(x);
      y = round(y);
      width = round(width);
      height = round(height);
      const radius = mode === 'box' ? cs.borderRadius : '';
      const key = `${x}|${y}|${width}|${height}|${radius}`;
      if (placed && key === last) return;
      last = key;
      const style = indicator.style;
      const first = !placed;
      if (first) style.transition = 'none';
      if (mode === 'underline') {
        // a 2px bar: a fixed base width scaled along x, so a glide between tabs of different widths animates
        // transform only (no layout per frame); the 1px rounded ends barely change under the scale
        style.width = `${UNDERLINE_BASE}px`;
        style.transformOrigin = '0 0';
        style.transform = `translate3d(${x}px, ${y}px, 0) scaleX(${(width / UNDERLINE_BASE).toFixed(4)})`;
      } else {
        // box pills keep a real width / height (a scaled box would distort its radius and shadow): sidebar, rail and
        // portal items share one size, so only segmented controls resize while gliding (DESIGN §8.8 exception)
        style.transform = `translate3d(${x}px, ${y}px, 0)`;
        style.width = `${width}px`;
        style.height = `${height}px`;
        style.borderRadius = radius;
      }
      style.opacity = '1';
      if (first) {
        // commit the jump without a transition, then hand the transition back to the classes for later moves
        void indicator.offsetWidth;
        style.transition = '';
        placed = true;
        container.setAttribute('data-indicator', 'ready');
      }
    };

    place();

    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place());
    const watchItems = () => {
      if (!sizes) return;
      sizes.disconnect();
      sizes.observe(container);
      container.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => sizes.observe(item));
    };
    watchItems();

    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            if (records.some((r) => r.type === 'childList')) watchItems();
            place();
          });
    mutations?.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state', 'aria-current', 'aria-selected', 'hidden'],
    });

    // web fonts change item widths after first paint
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    let alive = true;
    fonts?.ready.then(() => {
      if (alive) place();
    }).catch(() => undefined);

    return () => {
      alive = false;
      sizes?.disconnect();
      mutations?.disconnect();
      container.removeAttribute('data-indicator');
    };
  }, [containerRef, indicatorRef, activeSelector, itemSelector, mode, enabled]);
}
