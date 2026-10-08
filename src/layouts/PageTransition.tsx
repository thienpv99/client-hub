// Page enter (DESIGN.md §8.2): when the PAGE changes, its content fades up (opacity 0 → 1, translateY 6px → 0,
// 220 ms ease-out-quart). Played with the Web Animations API on a wrapper that is never re-keyed, so the page is not
// remounted and nothing replays when only a tab segment (/:tab?), the query string (filters, ?task= drawer) or a
// drawer route (/portal/tasks/:taskId) changes — component state (filters, scroll, open drawers) is kept.
// A new page reached by a link starts at the top (instant, never the smooth anchor scroll) — the first page of a frame
// too; back / forward keeps the browser's own scroll handling. Each page change also marks the page's arrival
// (markPageEnter: count-ups and progress bars only play then, never on a tab switch). Reduced motion: no animation.
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { matchPath, useLocation, useNavigationType } from 'react-router-dom';
import { EASE_OUT_QUART, jumpScrollTo, markPageEnter, prefersReducedMotion } from '@/hooks/useMotion';

const PAGE_ENTER_MS = 220;

/**
 * Routes whose trailing segment is NOT a new page (App.tsx): tabs, and drawers opened by URL. Longest patterns first;
 * a path matching one of them is keyed by the pattern's page part.
 */
const SAME_PAGE_PATTERNS: Array<{ pattern: string; key: (params: Record<string, string | undefined>) => string }> = [
  { pattern: '/app/accounts/new', key: () => '/app/accounts/new' },
  { pattern: '/app/accounts/:accountId/:tab?', key: (p) => `/app/accounts/${p.accountId ?? ''}` },
  { pattern: '/app/crm/opportunities/:opportunityId', key: (p) => `/app/crm/opportunities/${p.opportunityId ?? ''}` },
  { pattern: '/app/crm/:tab?', key: () => '/app/crm' },
  // the lead drawer (/app/targets/leads/:leadId) opens over the leads tab of the same page
  { pattern: '/app/targets/leads/:leadId', key: () => '/app/targets' },
  { pattern: '/app/targets/:tab?', key: () => '/app/targets' },
  { pattern: '/app/projects/:tab?', key: () => '/app/projects' },
  // a new quote becomes /quotes/:id after its first save: still the same editor
  { pattern: '/app/commercial/quotes/:quoteId', key: () => '/app/commercial/quotes' },
  { pattern: '/app/commercial/:tab?', key: () => '/app/commercial' },
  { pattern: '/app/settings/:tab?', key: () => '/app/settings' },
  { pattern: '/portal/tasks/:taskId?', key: () => '/portal/tasks' },
];

/** The page a pathname belongs to: same key = same page (no enter animation, no scroll reset). */
export function pageKeyFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const { pattern, key } of SAME_PAGE_PATTERNS) {
    const match = matchPath({ path: pattern, end: true }, path);
    if (match) return key(match.params);
  }
  return path;
}

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const key = pageKeyFor(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(null);
  const rendered = useRef<string | null>(null);
  const animation = useRef<Animation | null>(null);

  // the page's arrival motion (KPI count-up, progress grow: useArrivalMotion) is decided while the page renders, so
  // the mark is set here, before the children render — idempotent for one key (StrictMode renders twice)
  if (rendered.current !== key) {
    rendered.current = key;
    markPageEnter();
  }

  useLayoutEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    // a link to another page starts at its top — also the first page of a frame (sign-in → /app, "Xem như khách hàng"
    // → /portal: the window keeps the previous frame's scroll otherwise). Back / forward and a fresh load (POP) keep
    // the browser's own scroll.
    if (navigationType !== 'POP') jumpScrollTo(0);
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    animation.current?.cancel();
    // fill 'backwards' only: no transform stays on the wrapper afterwards (it would trap position: fixed children)
    const enter = el.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: PAGE_ENTER_MS, easing: EASE_OUT_QUART, fill: 'backwards' },
    );
    animation.current = enter;
    // a window that is not painting (background tab, hidden preview) does not advance animations: never leave the
    // page transparent — settle it shortly after it should have ended anyway
    window.setTimeout(() => {
      if (enter.playState === 'running') enter.finish();
    }, PAGE_ENTER_MS + 200);
    // no cleanup: StrictMode's simulated unmount must not cancel the enter of the first page
  }, [key, navigationType]);

  return (
    <div ref={ref} data-page-key={key} className={className}>
      {children}
    </div>
  );
}
