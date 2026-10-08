// Tailwind CSS precompiled in the browser, without Node — shared by tools/build-standalone.html (build) and
// tools/css-audit.html (coverage audit).
//
// How it works: the Tailwind Play runtime (vendor/tailwindcss-play-3.4.16.js, the same engine the dev app uses) runs
// inside a hidden same-origin iframe with the app's tailwind.config.js and src/*.css. Play generates CSS for every
// token found in the class attribute of any element (it splits classList, nothing else), so one hidden element whose
// class attribute holds every class candidate of the sources makes it emit the app's whole stylesheet. Its output is
// already compact; we read it once it has settled and inline it as a plain <style>.

export const TAILWIND_LOCAL = '/vendor/tailwindcss-play-3.4.16.js';

/**
 * Sidecar the builder writes next to a precompiled output (dist/ClientHub-demo.html → dist/ClientHub-demo.tailwind-inputs.json):
 * the config, app CSS and class candidates the CSS was compiled from. Dev-only (dist/ is git-ignored and the deploy
 * uploads the HTML alone); tools/css-audit.html reads it to recompile exactly what the build compiled.
 */
export function inputsFileName(outName) {
  return outName.replace(/\.html$/i, '') + '.tailwind-inputs.json';
}

// An arbitrary-property class nobody uses: Play emits `.\[--ch-tw-ready\:1\]{--ch-tw-ready:1}` in the same build as
// the candidates, so its presence proves the output includes them (an older build without them cannot contain it).
const SENTINEL_CLASS = '[--ch-tw-ready:1]';
const SENTINEL_PROP = '--ch-tw-ready';
const SENTINEL_RULE = /\.\\\[--ch-tw-ready\\:1\\\]\s*\{[^}]*\}/g;

// Never write the HTML comment opener literally in a script that may be inlined into HTML.
const COMMENT_OPEN = new RegExp('<' + '!' + '--', 'g');
export function escapeScript(s) {
  return s.replace(/<\/script/gi, '<\\/script').replace(COMMENT_OPEN, '<\\u0021--');
}
export function escapeStyle(s) {
  return s.replace(/<\/style/gi, '<\\/style');
}

/** tailwind.config.js (an ES module) → classic script that assigns window.tailwind.config, as Play expects. */
export function configScriptFrom(configSource) {
  return configSource.replace(/export\s+default/, 'window.tailwind.config =').replace(/^const c =/m, 'var c =');
}

/** App CSS for Play: Play prepends its own @tailwind base/components/utilities, so drop the file's directives. */
export function stripTailwindDirectives(css) {
  return css.replace(/^\s*@tailwind\s+[a-z]+;\s*$/gim, '');
}

// ---------- class candidates ----------

const MAX_TOKEN = 200;
const WS = /\s/;
const QUOTE = /["'`]/;

/**
 * Classes the sources derive at runtime from a literal one. ARCHITECTURE wants every class literal; these are the known
 * exceptions, each mirroring the code that builds it, so the precompiled CSS still has their rules. Any new one shows up
 * in tools/css-audit.html as a miss (DOM class with Tailwind CSS that the inlined sheet lacks).
 */
const DERIVED = [
  // components/ui/skeleton.tsx forceRadius(): a radius class given to <Skeleton> gets `!` after its variants
  // (`rounded-full` → `!rounded-full`, `sm:rounded-lg` → `sm:!rounded-lg`) to beat the `.skeleton` 8px radius.
  (tok) => {
    const i = tok.lastIndexOf(':');
    const base = tok.slice(i + 1);
    return base.startsWith('rounded') ? tok.slice(0, i + 1) + '!' + base : null;
  },
];

function addCandidate(set, tok) {
  if (tok.length < 2 || tok.length > MAX_TOKEN) return;
  if (!/[A-Za-z]/.test(tok)) return; // every Tailwind class has a letter
  if (/[{};$\\\x00-\x1f\x7f]/.test(tok)) return; // code punctuation that never appears in a class name
  // plain words of the Vietnamese UI text: a class only carries non-ASCII inside an arbitrary value (`content-['…']`)
  if (/[^\x00-\x7f]/.test(tok) && !tok.includes('[')) return;
  set.add(tok);
  for (const derive of DERIVED) {
    const extra = derive(tok);
    if (extra && extra.length <= MAX_TOKEN) set.add(extra);
  }
}

/**
 * Adds every class candidate of one source file to `set`. Classes in this codebase are literal strings, so splitting
 * the raw text on whitespace and quote characters finds them all; a second, bracket-aware pass keeps quotes that sit
 * inside an arbitrary value (`after:content-['']`), which the plain split would cut in two. Junk tokens (identifiers,
 * punctuation) are harmless: Tailwind ignores what is not a utility, and a rule it does emit for a stray word only
 * matches elements that carry that word as a class.
 */
export function extractCandidates(source, set = new Set()) {
  for (const tok of source.split(/[\s"'`]+/)) if (tok) addCandidate(set, tok);
  let start = -1;
  let depth = 0;
  let quoted = false;
  const flush = (end) => {
    if (start >= 0 && quoted) addCandidate(set, source.slice(start, end));
    start = -1;
    depth = 0;
    quoted = false;
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (WS.test(ch)) { flush(i); continue; }
    if (QUOTE.test(ch) && depth === 0) { flush(i); continue; }
    if (start < 0) start = i;
    if (ch === '[') depth++;
    else if (ch === ']') { if (depth > 0) depth--; }
    else if (QUOTE.test(ch)) quoted = true;
  }
  flush(source.length);
  return set;
}

// ---------- compile ----------

/** The <style> Play appends to <head> (the only untyped <style> of the compile document). */
function generatedStyle(doc) {
  const all = doc.head ? doc.head.querySelectorAll('style:not([type])') : [];
  return all.length ? all[all.length - 1] : null;
}

/**
 * Runs Tailwind Play on `candidates` and resolves with its CSS once the output contains the sentinel and has not
 * changed for `stableMs`. Pass the runtime as `runtimeJs` (source text, inlined) or `runtimeUrl` (script src).
 * Rejects with a clear message on a Tailwind error (e.g. an @apply of an unknown class) or after `timeoutMs`.
 */
export async function compileTailwind({ runtimeJs, runtimeUrl = TAILWIND_LOCAL, configJs, css, candidates, stableMs = 600, timeoutMs = 120000 }) {
  const t0 = performance.now();
  const list = Array.from(candidates);
  const runtimeTag = runtimeJs
    ? '<script>' + escapeScript(runtimeJs) + '<\/script>'
    : '<script src="' + new URL(runtimeUrl, location.href).href + '"><\/script>';
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Tailwind precompile';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;border:0;visibility:hidden;pointer-events:none';
  frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8">'
    + '<script>window.__chErrors=[];'
    + 'addEventListener("error",function(e){__chErrors.push(String(e.message||e.error))});'
    + 'addEventListener("unhandledrejection",function(e){var r=e.reason;__chErrors.push(String(r&&r.message?r.message:r))});<\/script>'
    + runtimeTag
    + '<script>' + escapeScript(configJs) + '\n;window.__chConfigOk=true;<\/script>'
    + '<style type="text/tailwindcss">' + escapeStyle(css) + '</style>'
    + '</head><body><div id="ch-candidates" hidden></div></body></html>';
  const loaded = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Khung biên dịch Tailwind không tải xong sau 30 s.')), 30000);
    frame.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
  });
  document.body.appendChild(frame);
  try {
    await loaded;
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const errors = () => (win.__chErrors && win.__chErrors.length ? win.__chErrors.join(' | ') : '');
    if (errors()) throw new Error('Tailwind báo lỗi khi khởi động: ' + errors());
    if (!win.tailwind) throw new Error('Tailwind Play không chạy trong khung biên dịch (' + (runtimeJs ? 'mã nhúng' : runtimeUrl) + ').');
    if (!win.__chConfigOk) throw new Error('tailwind.config.js không chạy được trong khung biên dịch.');

    const text = await new Promise((resolve, reject) => {
      let last = '';
      let seen = false;
      let pokes = 0;
      let settle = 0;
      const host = doc.getElementById('ch-candidates');
      const finish = (fn, v) => { observer.disconnect(); clearTimeout(settle); clearTimeout(timer); clearInterval(errPoll); fn(v); };
      const check = () => {
        const el = generatedStyle(doc);
        const now = el ? el.textContent : '';
        if (now !== last) last = now;
        clearTimeout(settle);
        if (last.includes(SENTINEL_PROP)) {
          seen = true;
          settle = setTimeout(() => finish(resolve, last), stableMs);
        } else if (seen && pokes < 3) {
          // an older, concurrent build overwrote the complete one: one more class forces a fresh incremental build
          pokes += 1;
          host.classList.add('ch-rebuild-' + pokes);
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
      const errPoll = setInterval(() => { if (errors()) finish(reject, new Error('Tailwind báo lỗi khi biên dịch: ' + errors())); }, 250);
      const timer = setTimeout(() => {
        finish(reject, new Error('Tailwind chưa biên dịch xong sau ' + Math.round(timeoutMs / 1000) + ' s ('
          + (!last ? 'chưa có CSS' : last.includes(SENTINEL_PROP) ? 'CSS vẫn đang thay đổi' : 'CSS chưa có lớp đánh dấu') + ').'));
      }, timeoutMs);
      host.className = list.concat(SENTINEL_CLASS).join(' ');
      check();
    });

    const out = text.replace(SENTINEL_RULE, '');
    if (out.includes(SENTINEL_PROP)) throw new Error('Không gỡ được lớp đánh dấu ' + SENTINEL_CLASS + ' khỏi CSS.');
    if (!/\bbox-sizing\s*:\s*border-box/.test(out)) throw new Error('CSS Tailwind thiếu preflight (không có box-sizing: border-box).');
    return { css: out, candidateCount: list.length, ms: Math.round(performance.now() - t0) };
  } finally {
    frame.remove();
  }
}

// ---------- reading stylesheets ----------

function skipString(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length && s[j] !== q) j += s[j] === '\\' ? 2 : 1;
  return j + 1;
}

/** Class names (unescaped) of one selector: `.hover\:bg-muted:hover` → ['hover:bg-muted']. */
export function selectorClassNames(sel) {
  const out = [];
  const n = sel.length;
  let i = 0;
  while (i < n) {
    const ch = sel[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '"' || ch === "'") { i = skipString(sel, i); continue; }
    if (ch === '[') { // attribute selector — its value is not a class
      i++;
      while (i < n && sel[i] !== ']') {
        if (sel[i] === '\\') i += 2;
        else if (sel[i] === '"' || sel[i] === "'") i = skipString(sel, i);
        else i++;
      }
      i++;
      continue;
    }
    if (ch !== '.') { i++; continue; }
    let j = i + 1;
    let name = '';
    while (j < n) {
      const c = sel[j];
      if (c === '\\') {
        const hex = /^[0-9a-fA-F]{1,6}/.exec(sel.slice(j + 1, j + 7));
        if (hex) {
          const cp = parseInt(hex[0], 16);
          name += cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '�';
          j += 1 + hex[0].length;
          if (sel[j] === '\r' && sel[j + 1] === '\n') j += 2;
          else if (sel[j] === ' ' || sel[j] === '\t' || sel[j] === '\n' || sel[j] === '\r' || sel[j] === '\f') j += 1;
        } else {
          name += sel[j + 1] ?? '';
          j += 2;
        }
      } else if (/[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) >= 0x80) {
        name += c;
        j++;
      } else break;
    }
    if (name) out.push(name);
    i = j;
  }
  return out;
}

/** Every class name used in the selectors of `rules` (CSSRuleList), recursing into @media / @supports / @container / @layer. */
export function ruleClassNames(rules, into = new Set()) {
  for (const r of rules) {
    if (r.selectorText) for (const c of selectorClassNames(r.selectorText)) into.add(c);
    // grouping rules (and CSS nesting) carry cssRules; a @keyframes' children have keyText, no selectorText
    if (r.cssRules) ruleClassNames(r.cssRules, into);
  }
  return into;
}

/** Class names of every readable stylesheet of a document. */
export function documentClassNames(doc, into = new Set()) {
  for (const sheet of doc.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    ruleClassNames(rules, into);
  }
  return into;
}

/** A CSS text parsed by this browser (constructable stylesheet, never attached to a document). */
export function parseCss(cssText) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText.replace(/@import[^;]*;/g, ''));
  return sheet;
}

/** Class names of a CSS text. */
export function cssTextClassNames(cssText, into = new Set()) {
  return ruleClassNames(parseCss(cssText).cssRules, into);
}

/**
 * Every rule of `rules` as one normalised line, in cascade order: grouping rules (@media, @supports, @layer…) become a
 * prefix of their children (`@media (min-width: 640px) .sm\:flex { display: flex; }`), anything else (style rules,
 * @keyframes, @font-face) is its own cssText. Two sheets parsed by the same browser give equal lines for equal rules.
 */
export function flattenRules(rules, prefix = '', out = []) {
  for (const r of rules) {
    const grouping = r.cssRules && !r.selectorText && !/^@(-webkit-)?keyframes\b/i.test(r.cssText);
    if (grouping) {
      const text = r.cssText;
      flattenRules(r.cssRules, prefix + text.slice(0, text.indexOf('{')).trim() + ' ', out);
    } else {
      out.push(prefix + r.cssText);
    }
  }
  return out;
}
