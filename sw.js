// No-build dev runtime: transpiles /src/**/*.ts(x) to ES modules in the browser.
// Only used by nobuild.html (this machine has no usable Node). Vite builds ignore it.
import { transform } from './vendor/sucrase.mjs';

const SW_VERSION = 'ch-sw-4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data === 'claim') event.waitUntil(self.clients.claim());
  if (event.data === 'version' && event.source) event.source.postMessage({ swVersion: SW_VERSION });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/src/')) return;
  // ?raw → untouched source (used by tools/typecheck.html)
  if (url.searchParams.has('raw')) return;
  event.respondWith(handle(event.request, url));
});

const JS_HEADERS = { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' };

async function handle(request, url) {
  const res = await fetch(url.pathname + url.search, { cache: 'no-store' });
  if (!res.ok) {
    if (request.destination === 'script') {
      const msg = `Module not found: ${url.pathname} (HTTP ${res.status})`;
      return new Response(`throw new Error(${JSON.stringify(msg)});`, { headers: JS_HEADERS });
    }
    return res;
  }
  const resolved = res.headers.get('X-Resolved-Path') || url.pathname;

  if (/\.css$/i.test(resolved)) {
    if (request.destination !== 'script') return res;
    // CSS imported from a module: inject as Tailwind Play CDN stylesheet.
    const css = (await res.text()).replace(/^\s*@tailwind\s+[a-z]+;\s*$/gim, '');
    const js =
      `const css = ${JSON.stringify(css)};\n` +
      `const id = ${JSON.stringify('css:' + resolved)};\n` +
      `let el = document.querySelector('style[data-src="' + id + '"]');\n` +
      `if (!el) { el = document.createElement('style'); el.type = 'text/tailwindcss'; el.dataset.src = id; document.head.appendChild(el); }\n` +
      `el.textContent = css;\n` +
      `export default css;\n`;
    return new Response(js, { headers: JS_HEADERS });
  }

  if (/\.(tsx?|jsx?|mjs)$/i.test(resolved)) {
    const source = await res.text();
    try {
      const { code } = transform(source, {
        transforms: /\.m?js$/i.test(resolved) ? ['jsx'] : ['typescript', 'jsx'],
        jsxRuntime: 'automatic',
        production: true,
        filePath: resolved,
      });
      return new Response(code + `\n//# sourceURL=${location.origin}${resolved}`, { headers: JS_HEADERS });
    } catch (err) {
      const msg = `Transpile error in ${resolved}: ${err && err.message ? err.message : err}`;
      return new Response(`throw new SyntaxError(${JSON.stringify(msg)});`, { headers: JS_HEADERS });
    }
  }
  return res;
}
