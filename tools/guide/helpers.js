// Page-side helpers for the guide capture (tools/guide/capture.ps1). Injected into every document via CDP.
// window.__g: find elements by visible text, wait for the UI to settle, record numbered callouts for a screenshot.
(() => {
  if (window.__g) return;
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const CLICKABLE = 'button,a,[role=tab],[role=menuitem],[role=menuitemradio],[role=option],[role=radio],[role=checkbox],[role=switch],[role=link],[role=button],summary,label';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const g = {
    marks: [],
    sleep,
    visible,
    /** first visible element matching a CSS selector (optionally inside root) */
    q(sel, root = document) {
      return [...root.querySelectorAll(sel)].find(visible) || null;
    },
    all(sel, root = document) {
      return [...root.querySelectorAll(sel)].filter(visible);
    },
    /** visible element whose text (or aria-label/title/placeholder) equals, else contains, `text`; smallest match wins */
    byText(text, sel = CLICKABLE, root = document) {
      const want = norm(text);
      const cands = [...root.querySelectorAll(sel)].filter(visible);
      const label = (el) => norm(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder'));
      const exact = cands.filter((el) => label(el) === want);
      const pool = exact.length ? exact : cands.filter((el) => label(el).includes(want));
      pool.sort((a, b) => a.textContent.length - b.textContent.length);
      return pool[0] || null;
    },
    /** any visible element (headings, cards…) containing text; the innermost one */
    anyText(text, sel = '*', root = document) {
      const want = norm(text);
      const cands = [...root.querySelectorAll(sel)].filter((el) => visible(el) && norm(el.textContent).includes(want));
      return cands.filter((el) => !cands.some((o) => o !== el && el.contains(o)))[0] || null;
    },
    /** nearest ancestor (or self) matching sel — e.g. the card around a title */
    up(el, sel) {
      return el ? el.closest(sel) : null;
    },
    field(labelText) {
      const lab = g.byText(labelText, 'label');
      if (lab && lab.htmlFor) return document.getElementById(lab.htmlFor);
      return lab ? lab.querySelector('input,textarea,select,button') : null;
    },
    /** wait until the DOM has been quiet for `quietMs` (max `maxMs`), fonts loaded, no skeletons */
    async idle(quietMs = 450, maxMs = 8000) {
      const start = performance.now();
      let last = performance.now();
      const mo = new MutationObserver(() => {
        last = performance.now();
      });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      try {
        await document.fonts.ready;
        while (performance.now() - start < maxMs) {
          await sleep(100);
          const busy = document.querySelector('.skeleton, [data-skeleton], [aria-busy="true"]');
          if (!busy && performance.now() - last >= quietMs) break;
        }
      } finally {
        mo.disconnect();
      }
      await sleep(150);
      return true;
    },
    /** go to an in-app route (HashRouter in the standalone build, MemoryRouter-free) */
    async nav(path) {
      if (location.hash !== '#' + path) location.hash = '#' + path;
      await sleep(60);
      await g.idle();
      window.scrollTo(0, 0);
      document.querySelectorAll('main, [data-scroll-root]').forEach((m) => (m.scrollTop = 0));
      await sleep(80);
      return location.hash;
    },
    async signOut() {
      try {
        localStorage.removeItem('clienthub.session.v1');
      } catch {}
      sessionStorage.clear();
    },
    /** viewport rectangle of an element (+padding), clipped to the viewport */
    rect(el, pad = 6) {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, r.left - pad);
      const y = Math.max(0, r.top - pad);
      return {
        x,
        y,
        w: Math.min(innerWidth, r.right + pad) - x,
        h: Math.min(innerHeight, r.bottom + pad) - y,
      };
    },
    /** record callout n on an element for the next screenshot; returns false when the element is missing */
    mark(n, el, opts = {}) {
      if (!el) return false;
      g.marks.push({ n, ...g.rect(el, opts.pad ?? 6), side: opts.side || 'auto', shape: opts.shape || 'box' });
      return true;
    },
    takeMarks() {
      const out = g.marks.map((m) => ({ ...m, vw: innerWidth, vh: innerHeight }));
      g.marks = [];
      return out;
    },
    /** hide transient UI that should not appear in a screenshot (toasts, tooltips, caret) */
    tidy() {
      document.querySelectorAll('[data-sonner-toast]').forEach((t) => (t.style.display = 'none'));
      if (document.activeElement && document.activeElement !== document.body && !document.activeElement.matches('input,textarea')) {
        document.activeElement.blur();
      }
    },
  };
  window.__g = g;
})();
