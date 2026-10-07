// Media query hooks (owner G1). Breakpoints follow the design system: md 768, xl 1280.
import { useCallback, useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      // `resize` as well: some viewport emulations (devtools device mode) change the size without firing the
      // MediaQueryList change event; useSyncExternalStore only re-renders when the snapshot really flips.
      window.addEventListener('resize', onChange);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
        return () => {
          mql.removeEventListener('change', onChange);
          window.removeEventListener('resize', onChange);
        };
      }
      // Safari < 14
      mql.addListener(onChange);
      return () => {
        mql.removeListener(onChange);
        window.removeEventListener('resize', onChange);
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
