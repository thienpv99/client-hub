// Media query hooks (owner G1). Breakpoints follow the design system: md 768, xl 1280.
import { useCallback, useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/**
 * One shared watcher of the viewport size for every hook instance. Besides the MediaQueryList `change` event (added
 * per query below) it listens to every signal a size change may give: window `resize` / `orientationchange`,
 * `visualViewport` resize, and a ResizeObserver on <html> — some viewport emulations (devtools device mode, the
 * Browser pane) resize the page without firing the MediaQueryList event nor `resize`. useSyncExternalStore only
 * re-renders when a snapshot really flips, so the extra signals cost nothing.
 */
const viewportListeners = new Set<() => void>();
let stopViewportWatch: (() => void) | null = null;

function notifyViewport(): void {
  for (const cb of [...viewportListeners]) cb();
}

function watchViewport(cb: () => void): () => void {
  viewportListeners.add(cb);
  if (!stopViewportWatch && typeof window !== 'undefined') {
    window.addEventListener('resize', notifyViewport);
    window.addEventListener('orientationchange', notifyViewport);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', notifyViewport);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function' && typeof document !== 'undefined') {
      ro = new ResizeObserver(() => notifyViewport());
      ro.observe(document.documentElement);
    }
    stopViewportWatch = () => {
      window.removeEventListener('resize', notifyViewport);
      window.removeEventListener('orientationchange', notifyViewport);
      vv?.removeEventListener('resize', notifyViewport);
      ro?.disconnect();
    };
  }
  return () => {
    viewportListeners.delete(cb);
    if (viewportListeners.size === 0 && stopViewportWatch) {
      stopViewportWatch();
      stopViewportWatch = null;
    }
  };
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      const unwatch = watchViewport(onChange);
      // a size change between the first render and this subscription (fonts, emulation) is caught on the next frame
      const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(onChange) : null;
      const stopFrame = () => {
        if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
        return () => {
          mql.removeEventListener('change', onChange);
          unwatch();
          stopFrame();
        };
      }
      // Safari < 14
      mql.addListener(onChange);
      return () => {
        mql.removeListener(onChange);
        unwatch();
        stopFrame();
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}

/** 'mobile' < 768 ≤ 'tablet' < 1280 ≤ 'desktop' */
export function useBreakpoint(): Breakpoint {
  const desktop = useMediaQuery('(min-width: 1280px)');
  const tablet = useMediaQuery('(min-width: 768px)');
  if (desktop) return 'desktop';
  return tablet ? 'tablet' : 'mobile';
}
