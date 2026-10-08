import * as React from 'react';

/** Put on a horizontal scroller together with `useScrollFade(ref)` (the CSS lives in index.css). */
export const SCROLL_FADE_CLASS = 'scroll-fade-x';
/** Same, end edge only: scrollers whose first column is pinned (sticky) — the start edge never fades over it. */
export const SCROLL_FADE_END_CLASS = 'scroll-fade-end';

/**
 * Keeps `data-fade` = 'start' | 'end' | 'both' on a horizontal scroller while its content is cut off on that side, so
 * `.scroll-fade-x` fades the cut edge (a tab strip or chip row that scrolls on phones shows it can scroll).
 */
export function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = el.scrollWidth - el.clientWidth;
      const start = max > 1 && el.scrollLeft > 1;
      const end = max > 1 && el.scrollLeft < max - 1;
      const next = start && end ? 'both' : start ? 'start' : end ? 'end' : null;
      if (next === null) el.removeAttribute('data-fade');
      else if (el.getAttribute('data-fade') !== next) el.setAttribute('data-fade', next);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', schedule, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(el);
    // items can change width after the first paint (counts arriving, labels switching)
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
    mutations?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [ref]);
}
