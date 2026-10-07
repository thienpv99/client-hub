// State of the quiet internal top bar (DESIGN §3):
// - `scrolled`: the page has scrolled, so the bar shows its hairline (at rest it melts into the page background).
// - `titleInView`: the page's own <h1> is still visible below the bar. A root page's crumb says the same words as
//   that heading, so the bar keeps it hidden and fades it in once the heading has scrolled under the bar (the large
//   title → compact title pattern). While a page has no <h1> yet (skeleton) it counts as "in view": the bar does not
//   flash a title before the page arrives.
import { useEffect, useState } from 'react';

const MAIN_ID = 'main-content';

export function useTopBarState(barHeight = 56): { scrolled: boolean; titleInView: boolean } {
  const [scrolled, setScrolled] = useState(false);
  const [titleInView, setTitleInView] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const main = document.getElementById(MAIN_ID);
    if (!main || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
    let heading: Element | null = null;
    let io: IntersectionObserver | null = null;
    // pages swap their content (skeleton → page, route → route): follow whichever <h1> main holds now
    const attach = () => {
      const next = main.querySelector('h1');
      if (next === heading) return;
      io?.disconnect();
      io = null;
      heading = next;
      if (!next) {
        setTitleInView(true);
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (entry) setTitleInView(entry.isIntersecting);
        },
        { rootMargin: `-${barHeight}px 0px 0px 0px` },
      );
      io.observe(next);
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io?.disconnect();
    };
  }, [barHeight]);

  return { scrolled, titleInView };
}
