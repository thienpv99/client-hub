// Motion helpers (DESIGN.md §8). CSS motion is already zeroed under prefers-reduced-motion by index.css; JS-driven
// motion (WAAPI, requestAnimationFrame) must ask `prefersReducedMotion()` itself.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** easings of tailwind.config.js, for WAAPI / rAF code */
export const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';
export const EASE_SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** ease-out-quart as a function (rAF count-ups) */
export function easeOutQuart(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 4);
}

/** Pending visuals (spinners, "Đang lưu…") wait this long, so a fast action never flashes them. */
export const PENDING_VISUAL_DELAY_MS = 150;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_QUERY).matches;
}

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Live `prefers-reduced-motion: reduce`. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
}

/**
 * `flag`, but it only turns true once it has stayed true for `delay` ms (default 150), and turns false at once.
 * For pending visuals: a fast action (< delay) never shows a spinner, a disabled look or a "Đang lưu…" label.
 * Keep the immediate flag for logic (double-submit guards, `disabled`), use this one for what is drawn.
 */
export function useDelayedFlag(flag: boolean, delay = PENDING_VISUAL_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      setShown(false);
      return undefined;
    }
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [flag, delay]);
  return flag && shown;
}

/** delay step of the stagger recipe and the index from which items share the last step */
export const STAGGER_STEP_MS = 35;
export const STAGGER_MAX_INDEX = 10;
/** how long a list counts as "first appearance" after it got its data */
const STAGGER_WINDOW_MS = 700;

export interface RiseProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Props of one item of the stagger recipe: `animate-rise` + `--i` (index, capped at 10 → 35 ms steps, 350 ms max).
 * Spread on a list / grid child: `<li {...riseProps(i)}>`. Under reduced motion index.css ends it at once.
 */
export function riseProps(index: number): RiseProps {
  return {
    className: 'animate-rise',
    style: { '--i': Math.min(Math.max(0, index), STAGGER_MAX_INDEX) } as CSSProperties,
  };
}

/**
 * Stagger only the FIRST appearance of a list (page mount), never a refetch: returns `rise(i)` → riseProps while the
 * list first shows its data (`ready`), `{}` afterwards (rows added later, filters, refetches appear without motion).
 *
 *   const rise = useStagger(!!data);
 *   {rows.map((r, i) => <Row key={r.id} {...rise(i)} />)}   // merge className with cn() if the row has its own
 */
export function useStagger(ready = true): (index: number) => RiseProps {
  const phase = useRef<'waiting' | 'running' | 'done'>('waiting');
  if (ready && phase.current === 'waiting') phase.current = 'running';
  useEffect(() => {
    if (!ready || phase.current !== 'running') return undefined;
    const id = window.setTimeout(() => {
      phase.current = 'done';
    }, STAGGER_WINDOW_MS);
    return () => window.clearTimeout(id);
  }, [ready]);
  return useCallback((index: number) => (phase.current === 'running' ? riseProps(index) : {}), []);
}

/**
 * Scroll the window at once. `html { scroll-behavior: smooth }` (index.css) makes in-page anchors glide; programmatic
 * jumps (a new page, keeping a sticky header in place on a tab switch) must not glide — use this instead of
 * `window.scrollTo`.
 */
export function jumpScrollTo(top: number, left?: number): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(left ?? window.scrollX, top);
  root.style.scrollBehavior = previous;
}

/** A Vietnamese-formatted number inside a display string ("1,25 tỷ ₫", "1.250.000 ₫", "3/6", "33%"). */
export interface FormattedNumber {
  /** the first number of the string, as a number (1.25 for "1,25 tỷ ₫") */
  value: number;
  /** the string with that number replaced by `v`, written like the original (same decimals, "." thousands) */
  format(v: number): string;
}

// "1.250.000,5" (grouped) or "1250,5" / "42" — the first number only
const VI_NUMBER = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;

export function parseFormattedNumber(text: string): FormattedNumber | null {
  const match = VI_NUMBER.exec(text);
  if (!match) return null;
  const raw = match[0];
  const [intPart = '', frac = ''] = raw.split(',');
  const grouped = intPart.includes('.');
  const value = Number(`${intPart.replace(/\./g, '')}${frac ? `.${frac}` : ''}`);
  if (!Number.isFinite(value) || value <= 0) return null;
  const prefix = text.slice(0, match.index);
  const suffix = text.slice(match.index + raw.length);
  const decimals = frac.length;
  return {
    value,
    format(v: number) {
      const [i = '0', f = ''] = Math.max(0, v).toFixed(decimals).split('.');
      const int = grouped ? i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : i;
      return `${prefix}${int}${f ? `,${f}` : ''}${suffix}`;
    },
  };
}

/**
 * "First appearance" motion (count-up, progress grow, chart bars) belongs to arriving on a PAGE, not to a component
 * mounting: a tab or view switch remounts a KPI row, and re-counting every number on every click reads as busy
 * (DESIGN.md §8.3 / §8.5). PageTransition marks each page change; a component plays its arrival motion only when it
 * first renders within this window after the mark (data that loads with the page, `?latency=` included).
 */
export const PAGE_ARRIVAL_WINDOW_MS = 1500;
let pageEnteredAt = Number.NEGATIVE_INFINITY;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Called by layouts/PageTransition when the page (not a tab / query / drawer) changes, before the page renders. */
export function markPageEnter(): void {
  pageEnteredAt = now();
}

/** Has the current page arrived within `ms`? (see markPageEnter) */
export function pageEnteredRecently(ms = PAGE_ARRIVAL_WINDOW_MS): boolean {
  return now() - pageEnteredAt < ms;
}

/**
 * Whether this component plays its arrival motion: decided once, on its first render (page arrival and no reduced
 * motion). For CSS opt-ins: `className={cn('…', arrival && 'animate-progress-grow')}`.
 */
export function useArrivalMotion(): boolean {
  const [arrival] = useState(() => pageEnteredRecently() && !prefersReducedMotion());
  return arrival;
}

export const COUNT_UP_MS = 700;

/**
 * Count-up of a formatted number on FIRST mount during a page arrival (DESIGN.md §8.5): returns the text to draw while
 * counting (0 → value, ease-out-quart, requestAnimationFrame), then null = draw the real value. Null at once when the
 * value is not a string / number with a number in it, under reduced motion, when the component mounts outside a page
 * arrival (a tab / view switch remounting a KPI row: see useArrivalMotion), or when the value changes while counting
 * (a refetch never counts). The caller keeps the real text in the DOM for screen readers and copy (see CountUp).
 */
export function useCountUp(value: unknown, duration = COUNT_UP_MS): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : null;
  const initial = useRef(text);
  const arrival = useArrivalMotion();
  const [frame, setFrame] = useState<string | null>(() => {
    if (text === null || !arrival) return null;
    const parsed = parseFormattedNumber(text);
    return parsed ? parsed.format(0) : null;
  });
  useEffect(() => {
    const start = initial.current;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const parsed = start === null || hidden || !arrival || prefersReducedMotion() ? null : parseFormattedNumber(start);
    if (!parsed) {
      setFrame(null);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      if (p >= 1) {
        setFrame(null);
        return;
      }
      setFrame(parsed.format(parsed.value * easeOutQuart(p)));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    // a page that is not being painted (background tab, occluded window) gets no frames: show the value anyway
    const safety = window.setTimeout(() => setFrame(null), duration + 200);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
    // first mount only: later values are drawn as they are (`arrival` never changes after the first render)
  }, [duration, arrival]);
  return frame !== null && text === initial.current ? frame : null;
}

/** True during the first render(s) of a component, until it has committed once. */
export function useIsFirstRender(): boolean {
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return first.current;
}
