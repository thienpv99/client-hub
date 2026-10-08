import type { MouseEvent } from 'react';
import { t } from '@/i18n';
import { jumpScrollTo } from '@/hooks/useMotion';

/** height of the sticky top bar (h-14): main's top lands just under it */
const TOP_BAR_PX = 56;

/**
 * First focusable element of each layout: jumps over the navigation. The href keeps the link's meaning, but the jump
 * is done here: under the hash router of the single-file build a plain `#main-content` would become the route
 * `/main-content` (404). Focus moves to `main` (tabIndex -1 in both layouts) and the page jumps without gliding.
 */
export function SkipLink() {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const main = document.getElementById('main-content');
    if (!main) return;
    main.focus({ preventScroll: true });
    const top = main.getBoundingClientRect().top + window.scrollY - TOP_BAR_PX;
    if (window.scrollY > top) jumpScrollTo(Math.max(0, top));
  };
  return (
    <a
      href="#main-content"
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-table focus:font-medium focus:text-primary focus:shadow-pop"
    >
      {t('common.a11y.skipToContent')}
    </a>
  );
}
