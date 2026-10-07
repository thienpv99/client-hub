// client-hub/tools/typecheck.worker.js — in-browser `tsc --noEmit` for client-hub.
// This machine cannot run Node, so tools/typecheck.html starts this classic Web Worker:
//  - TypeScript (official npm lib/typescript.js) comes from jsDelivr (fallback unpkg) via importScripts.
//  - Sources: GET /__ls, then every /src/**/*.ts(x) with '?raw' (the service worker leaves ?raw untouched).
//  - Types: a virtual /node_modules filled on demand from jsDelivr. Versions are pinned from the import map in
//    /nobuild.html; any other package is "installed" only when a loaded package.json declares it
//    (dependencies / peerDependencies / optionalDependencies), at the range declared there — like npm install.
//    The program is rebuilt until module resolution stops asking for files we do not have, then checked once.
//  - Every CDN response is kept in Cache Storage (CACHE_NAME), so later runs are offline and fast.
// Why not @typescript/ata: it fetches @types/* and transitive deps at "latest" (e.g. @types/react 19),
// which would not match the React 18.3 runtime in the import map.
'use strict';

const TS_VERSION = '5.6.3';
// The official npm build. (cdnjs' re-minified typescript.min.js 5.6.3 crashes inside the checker with
// "Class constructors cannot be invoked without 'new'", so it is deliberately not used.)
const TS_SCRIPT_URLS = [
  `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/typescript.js`,
  `https://unpkg.com/typescript@${TS_VERSION}/lib/typescript.js`,
];
const CACHE_NAME = 'tc-cache-v1';
const MAX_PARALLEL = 12;
const MAX_ROUNDS = 40;
const AMBIENT_PATH = '/__typecheck_ambient.d.ts';
const TOOL_MSG_CODE = 99000; // our own diagnostic: source/type fetch problems
const IMPORT_MAP_CODE = 99001; // our own diagnostic: bare import missing from the nobuild.html import map

// Used only if /nobuild.html cannot be read; the import map there is the source of truth.
const FALLBACK_PINS = {
  react: '18.3.1',
  'react-dom': '18.3.1',
  'react-router-dom': '6.28.0',
  'radix-ui': '1.4.3',
  'lucide-react': '0.468.0',
  recharts: '2.15.0',
  sonner: '1.7.1',
  clsx: '2.1.1',
  'tailwind-merge': '2.5.5',
  'class-variance-authority': '0.7.1',
};
// Packages declared as `declare module 'x';` (everything any) instead of fetching their types.
const DEFAULT_LOOSE = [];

const COMPILER_OPTIONS = {
  strict: true,
  noEmit: true,
  jsx: 'react-jsx',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  target: 'ES2022',
  lib: ['DOM', 'DOM.Iterable', 'ES2022'],
  verbatimModuleSyntax: true,
  isolatedModules: true,
  skipLibCheck: true,
  noUnusedLocals: false,
  baseUrl: '.',
  paths: { '@/*': ['src/*'] },
  allowImportingTsExtensions: false,
  types: [], // no implicit @types/* globals (only what imports pull in)
};

let TS = null; // the `ts` namespace (not named `ts`: typescript.js declares a global `var ts`)
let tsUrl = '';
const stats = { network: 0, cacheHits: 0 };
const fetchErrors = [];

const post = (msg) => self.postMessage(msg);
const progress = (text) => post({ type: 'progress', text });

// ---------------------------------------------------------------- TypeScript

function loadTypeScript() {
  if (TS) return;
  let lastErr = null;
  for (const url of TS_SCRIPT_URLS) {
    try {
      importScripts(url);
      if (self.ts && typeof self.ts.createProgram === 'function') {
        TS = self.ts;
        tsUrl = url;
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('Could not load TypeScript ' + TS_VERSION + ': ' + (lastErr && lastErr.message));
}

// ---------------------------------------------------------------- network + Cache Storage

let cacheP = null;
function openCache() {
  if (!cacheP) {
    cacheP = (async () => {
      try {
        return self.caches ? await caches.open(CACHE_NAME) : null;
      } catch {
        return null;
      }
    })();
  }
  return cacheP;
}

let active = 0;
const waiting = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const start = () => {
      active++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = waiting.shift();
          if (next) next();
        });
    };
    if (active < MAX_PARALLEL) start();
    else waiting.push(start);
  });
}

async function netGet(url) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw lastErr;
}

const inflight = new Map();
/** Text of an immutable CDN URL (null = 404), served from Cache Storage when possible. */
function getText(url) {
  let p = inflight.get(url);
  if (!p) {
    p = (async () => {
      const cache = await openCache();
      if (cache) {
        try {
          const hit = await cache.match(url);
          if (hit) {
            stats.cacheHits++;
            return hit.headers.get('x-tc-missing') ? null : await hit.text();
          }
        } catch {}
      }
      const text = await limited(() => netGet(url));
      stats.network++;
      if (cache) {
        try {
          await cache.put(
            url,
            text === null
              ? new Response('', { headers: { 'x-tc-missing': '1' } })
              : new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } }),
          );
        } catch {}
      }
      return text;
    })();
    inflight.set(url, p);
    p.finally(() => inflight.delete(url)).catch(() => {});
  }
  return p;
}

// background work tracker (file fetches spawn more fetches; drain() waits for all of them)
const work = new Set();
function track(p) {
  const q = p.catch((e) => fetchErrors.push(String((e && e.message) || e)));
  work.add(q);
  q.finally(() => work.delete(q));
  return q;
}
async function drain() {
  while (work.size) await Promise.all([...work]);
}

// ---------------------------------------------------------------- versions (import map = source of truth)

async function readImportMap() {
  try {
    const res = await fetch('/nobuild.html', { cache: 'no-store' });
    const html = await res.text();
    const m = /<script\s+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    return m ? JSON.parse(m[1]).imports || null : null;
  } catch {
    return null;
  }
}

function pinsFrom(imports) {
  const pins = { ...FALLBACK_PINS };
  if (imports) {
    for (const url of Object.values(imports)) {
      const m = /^https:\/\/esm\.sh\/((?:@[^/@]+\/)?[^/@?]+)@([^/?&]+)/.exec(String(url));
      if (m) pins[m[1]] = m[2];
    }
  }
  const sameMinor = (v) => {
    const m = /^(\d+)\.(\d+)/.exec(v || '');
    return m ? `~${m[1]}.${m[2]}.0` : 'latest';
  };
  pins['@types/react'] = sameMinor(pins.react);
  pins['@types/react-dom'] = sameMinor(pins['react-dom']);
  pins.typescript = TS_VERSION;
  return pins;
}

// ---------------------------------------------------------------- virtual /node_modules

/** name -> { name, range, version, status: 'pending'|'ok'|'missing', files, dirs, contents, pkgJson, reason } */
const pkgs = new Map();
let pins = {};
let loose = new Set();
const want = { pkgs: new Set(), files: new Set() };

function splitNM(p) {
  if (!p.startsWith('/node_modules/')) return null;
  const parts = p.slice('/node_modules/'.length).split('/').filter(Boolean);
  if (!parts.length) return { name: null, sub: '' };
  let n = 1;
  if (parts[0].startsWith('@')) {
    if (parts.length < 2) return { name: null, sub: '' };
    n = 2;
  }
  const rest = parts.slice(n);
  return { name: parts.slice(0, n).join('/'), sub: rest.length ? '/' + rest.join('/') : '' };
}

function declaredRange(name) {
  if (pins[name]) return pins[name];
  for (const st of pkgs.values()) {
    if (st.status !== 'ok' || !st.pkgJson) continue;
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const r = st.pkgJson[field] && st.pkgJson[field][name];
      if (typeof r === 'string') return r.trim() === '' || r.trim() === '*' ? 'latest' : r.trim();
    }
  }
  return null;
}

/** State of a package, creating (and requesting) it when it is installable. null = not installed. */
function pkgState(name) {
  if (loose.has(name)) return null;
  let st = pkgs.get(name);
  if (st) return st;
  const range = declaredRange(name);
  if (range == null) return null;
  st = { name, range, version: null, status: 'pending', files: new Set(), dirs: new Set(), contents: new Map(), pkgJson: null, reason: '' };
  pkgs.set(name, st);
  want.pkgs.add(name);
  return st;
}

async function loadPkg(st) {
  try {
    let version = st.range;
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
      const r = await getText(`https://data.jsdelivr.com/v1/package/resolve/npm/${st.name}@${encodeURIComponent(version)}`);
      version = r ? JSON.parse(r).version : null;
      if (!version) {
        st.status = 'missing';
        st.reason = `no published version matches "${st.range}"`;
        return;
      }
    }
    st.version = version;
    const [listing, pj] = await Promise.all([
      getText(`https://data.jsdelivr.com/v1/package/npm/${st.name}@${version}/flat`),
      getText(`https://cdn.jsdelivr.net/npm/${st.name}@${version}/package.json`),
    ]);
    if (!listing || !pj) {
      st.status = 'missing';
      st.reason = `${st.name}@${version} not found on jsDelivr`;
      return;
    }
    for (const f of JSON.parse(listing).files || []) {
      st.files.add(f.name);
      let i = f.name.lastIndexOf('/');
      while (i > 0) {
        const d = f.name.slice(0, i);
        if (st.dirs.has(d)) break;
        st.dirs.add(d);
        i = d.lastIndexOf('/');
      }
    }
    st.pkgJson = JSON.parse(pj);
    st.contents.set('/package.json', pj);
    st.status = 'ok';
  } catch (e) {
    st.status = 'missing';
    st.reason = String((e && e.message) || e);
  }
}

function normalizePath(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

function candidates(base) {
  const js = /^(.*)\.([mc]?)js$/.exec(base);
  if (js) return [`${js[1]}.d.${js[2]}ts`, `${js[1]}.${js[2]}ts`, `${js[1]}.d.ts`];
  if (/\.d\.[mc]?ts$|\.[mc]?tsx?$/.test(base)) return [base];
  return [`${base}.ts`, `${base}.tsx`, `${base}.d.ts`, `${base}.d.mts`, `${base}/index.ts`, `${base}/index.d.ts`, `${base}/index.d.mts`];
}

const fetching = new Set();
/** Fetch one file of a loaded package, then eagerly its relative imports (saves resolution rounds). */
function fetchPkgFile(st, sub) {
  if (!st.files.has(sub) || st.contents.has(sub)) return;
  const key = `${st.name}@${st.version}${sub}`;
  if (fetching.has(key)) return;
  fetching.add(key);
  track(
    (async () => {
      let text = null;
      try {
        text = await getText(`https://cdn.jsdelivr.net/npm/${st.name}@${st.version}${sub}`);
      } finally {
        st.contents.set(sub, text == null ? '' : text);
        fetching.delete(key);
      }
      if (text && /\.d\.[mc]?ts$|\.[mc]?tsx?$/.test(sub)) prefetchRelated(st, sub, text);
    })(),
  );
}

function prefetchRelated(st, sub, text) {
  let info;
  try {
    info = TS.preProcessFile(text, true, true);
  } catch {
    return;
  }
  const dir = sub.slice(0, sub.lastIndexOf('/'));
  for (const f of [...info.importedFiles, ...info.referencedFiles]) {
    if (!f.fileName.startsWith('.')) continue;
    const base = normalizePath(dir + '/' + f.fileName);
    const hit = candidates(base).find((c) => st.files.has(c));
    if (hit) fetchPkgFile(st, hit);
  }
  if (st.name === 'typescript') {
    for (const l of info.libReferenceDirectives) fetchPkgFile(st, `${dir}/lib.${l.fileName.toLowerCase()}.d.ts`);
  }
}

async function fetchWanted() {
  const names = [...want.pkgs];
  const files = [...want.files];
  await Promise.all(
    names
      .map((n) => pkgs.get(n))
      .filter((st) => st && st.status === 'pending')
      .map(loadPkg),
  );
  for (const p of files) {
    const nm = splitNM(p);
    const st = nm && nm.name ? pkgs.get(nm.name) : null;
    if (st && st.status === 'ok') fetchPkgFile(st, nm.sub);
  }
  await drain();
}

// ---------------------------------------------------------------- sources

const src = new Map(); // absolute path -> text (all root files)
let srcDirs = new Set();

async function loadSources(extra) {
  const res = await fetch('/__ls', { cache: 'no-store' });
  if (!res.ok) throw new Error('GET /__ls failed: HTTP ' + res.status + ' (is .claude/serve-hub.ps1 serving client-hub?)');
  const list = (await res.json()).filter((p) => /\.(ts|tsx|mts|cts)$/i.test(p));
  const extras = extra.map((p) => '/' + String(p).trim().replace(/^\.?\/+/, '')).filter((p) => p.length > 1);
  const all = [...new Set([...list, ...extras])];
  const loaded = new Map();
  const missing = [];
  let i = 0;
  const worker = async () => {
    while (i < all.length) {
      const p = all[i++];
      const r = await fetch(encodeURI(p) + '?raw', { cache: 'no-store' });
      if (r.ok) loaded.set(p, (await r.text()).replace(/^﻿/, ''));
      else missing.push(`${p} (HTTP ${r.status})`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  src.clear();
  for (const p of all) if (loaded.has(p)) src.set(p, loaded.get(p));
  const looseDecl = [...loose].map((n) => `declare module '${n}';\ndeclare module '${n}/*';\n`).join('');
  src.set(AMBIENT_PATH, `declare module '*.css';\n${looseDecl}`);
  srcDirs = new Set(['/']);
  for (const p of src.keys()) {
    let d = p.slice(0, p.lastIndexOf('/'));
    while (d && !srcDirs.has(d)) {
      srcDirs.add(d);
      d = d.slice(0, d.lastIndexOf('/'));
    }
  }
  return { missing, count: src.size - 1 };
}

// ---------------------------------------------------------------- compiler host

function fileExists(p) {
  if (src.has(p)) return true;
  const nm = splitNM(p);
  if (!nm || !nm.name) return false;
  const st = pkgState(nm.name);
  return !!st && st.status === 'ok' && st.files.has(nm.sub);
}

function directoryExists(p) {
  p = p.replace(/\/+$/, '') || '/';
  if (srcDirs.has(p) || p === '/node_modules') return true;
  const nm = splitNM(p);
  if (!nm) return false;
  if (!nm.name) return true; // scope folder (/node_modules/@types)
  const st = pkgState(nm.name);
  return !!st && st.status === 'ok' && (nm.sub === '' || st.dirs.has(nm.sub));
}

function readFile(p) {
  if (src.has(p)) return src.get(p);
  const nm = splitNM(p);
  if (!nm || !nm.name) return undefined;
  const st = pkgState(nm.name);
  if (!st) return undefined;
  if (st.status === 'pending') {
    want.files.add(p);
    return undefined;
  }
  if (st.status !== 'ok' || !st.files.has(nm.sub)) return undefined;
  const text = st.contents.get(nm.sub);
  if (text === undefined) want.files.add(p);
  return text;
}

const sfCache = new Map(); // path -> { text, key, sf }
function getSourceFile(fileName, langOpts) {
  const text = readFile(fileName);
  if (text === undefined) return undefined;
  const key = typeof langOpts === 'object' ? `${langOpts.languageVersion}|${langOpts.impliedNodeFormat}` : String(langOpts);
  const hit = sfCache.get(fileName);
  if (hit && hit.text === text && hit.key === key) return hit.sf;
  const sf = TS.createSourceFile(fileName, text, langOpts, false);
  sfCache.set(fileName, { text, key, sf });
  return sf;
}

function createHost() {
  return {
    getSourceFile,
    getDefaultLibFileName: (o) => '/node_modules/typescript/lib/' + TS.getDefaultLibFileName(o),
    getDefaultLibLocation: () => '/node_modules/typescript/lib',
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists,
    readFile,
    directoryExists,
    getDirectories: () => [],
    realpath: (p) => p,
    jsDocParsingMode: TS.JSDocParsingMode ? TS.JSDocParsingMode.ParseForTypeErrors : undefined,
  };
}

// ---------------------------------------------------------------- import-map check (runtime safety)

function importMapDiagnostics(sf, imports, push) {
  if (!imports) return;
  const keys = Object.keys(imports);
  const allowed = (s) => keys.some((k) => k === s || (k.endsWith('/') && s.startsWith(k)));
  const check = (lit) => {
    if (!lit || !TS.isStringLiteralLike(lit)) return;
    const s = lit.text;
    if (s.startsWith('.') || s.startsWith('/') || allowed(s)) return;
    push({
      file: sf,
      start: lit.getStart(sf),
      code: IMPORT_MAP_CODE,
      message: `'${s}' is not in the nobuild.html import map, so this import fails at runtime. Import only packages listed there (or '@/…' paths); type-only imports are fine.`,
    });
  };
  const allTypeOnly = (els) => els.length > 0 && els.every((e) => e.isTypeOnly);
  const visit = (node) => {
    if (TS.isImportDeclaration(node)) {
      const c = node.importClause;
      const typeOnly = !!c && (c.isTypeOnly || (!c.name && !!c.namedBindings && TS.isNamedImports(c.namedBindings) && allTypeOnly(c.namedBindings.elements)));
      if (!typeOnly) check(node.moduleSpecifier);
      return;
    }
    if (TS.isExportDeclaration(node)) {
      const typeOnly = node.isTypeOnly || (!!node.exportClause && TS.isNamedExports(node.exportClause) && allTypeOnly(node.exportClause.elements));
      if (node.moduleSpecifier && !typeOnly) check(node.moduleSpecifier);
      return;
    }
    if (TS.isCallExpression(node) && node.expression.kind === TS.SyntaxKind.ImportKeyword) check(node.arguments[0]);
    TS.forEachChild(node, visit);
  };
  TS.forEachChild(sf, visit);
}

// ---------------------------------------------------------------- run

async function run(opts) {
  const t0 = performance.now();
  fetchErrors.length = 0;
  const net0 = stats.network;
  const hit0 = stats.cacheHits;

  progress(`Loading TypeScript ${TS_VERSION}…`);
  loadTypeScript();

  const imports = await readImportMap();
  const newPins = pinsFrom(imports);
  const newLoose = new Set([...DEFAULT_LOOSE, ...(opts.loose || [])]);
  if (JSON.stringify(newPins) !== JSON.stringify(pins)) {
    pkgs.clear(); // import map changed → forget resolved packages (file texts stay in Cache Storage)
    sfCache.clear();
  }
  pins = newPins;
  loose = newLoose;

  progress('Reading /src…');
  const srcInfo = await loadSources(opts.extra || []);
  const tLoaded = performance.now();

  const conv = TS.convertCompilerOptionsFromJson(COMPILER_OPTIONS, '/');
  const options = conv.options;
  const rootNames = [...src.keys()];

  let program = null;
  let round = 0;
  for (;;) {
    round++;
    want.pkgs.clear();
    want.files.clear();
    program = TS.createProgram({ rootNames, options, host: createHost() });
    if ((!want.pkgs.size && !want.files.size) || round >= MAX_ROUNDS) break;
    progress(`Fetching types · round ${round} · ${want.pkgs.size} package(s), ${want.files.size} file(s)…`);
    await fetchWanted();
  }
  const tResolved = performance.now();

  const roots = rootNames.filter((p) => p !== AMBIENT_PATH);
  progress(`Type-checking ${roots.length} files…`);
  const byFile = {};
  const seen = new Set();
  let total = 0;
  const push = (d) => {
    const file = d.file ? d.file.fileName.replace(/^\//, '') : '(global)';
    let line = 0;
    let col = 0;
    if (d.file && typeof d.start === 'number') {
      const lc = d.file.getLineAndCharacterOfPosition(d.start);
      line = lc.line + 1;
      col = lc.character + 1;
    }
    const message = typeof d.message === 'string' ? d.message : TS.flattenDiagnosticMessageText(d.messageText, '\n');
    const category = d.category === undefined ? 'error' : TS.DiagnosticCategory[d.category].toLowerCase();
    const key = `${file}|${line}|${col}|${d.code}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    (byFile[file] = byFile[file] || []).push({ line, col, code: d.code, message, category });
    if (category === 'error') total++;
  };
  const globalMsg = (message, code = TOOL_MSG_CODE) => push({ code, message });

  for (const m of srcInfo.missing) globalMsg(`Could not read source ${m}`);
  for (const d of conv.errors) push(d);
  for (const d of program.getOptionsDiagnostics()) push(d);
  for (const d of program.getGlobalDiagnostics()) push(d);
  let i = 0;
  for (const p of roots) {
    const sf = program.getSourceFile(p);
    if (!sf) {
      globalMsg(`Root file not in program: ${p}`);
      continue;
    }
    for (const d of program.getSyntacticDiagnostics(sf)) push(d);
    for (const d of program.getSemanticDiagnostics(sf)) push(d);
    importMapDiagnostics(sf, imports, push);
    if (++i % 15 === 0) progress(`Type-checking… ${i}/${roots.length}`);
  }
  if (round >= MAX_ROUNDS) globalMsg(`Type acquisition stopped after ${MAX_ROUNDS} rounds; some library types may be missing.`);
  for (const e of [...new Set(fetchErrors)]) globalMsg(`Fetch error: ${e}`);
  for (const list of Object.values(byFile)) list.sort((a, b) => a.line - b.line || a.col - b.col);
  const sortedByFile = {};
  for (const k of Object.keys(byFile).sort()) sortedByFile[k] = byFile[k];

  const tDone = performance.now();
  const packages = {};
  const missingPackages = [];
  for (const st of [...pkgs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    if (st.status === 'ok') packages[st.name] = st.version;
    else missingPackages.push({ name: st.name, range: st.range, reason: st.reason });
  }
  return {
    done: true,
    total,
    byFile: sortedByFile,
    durationMs: Math.round(tDone - t0),
    timings: {
      sourcesMs: Math.round(tLoaded - t0),
      typesMs: Math.round(tResolved - tLoaded),
      checkMs: Math.round(tDone - tResolved),
    },
    filesChecked: roots.length,
    rounds: round,
    network: stats.network - net0,
    cacheHits: stats.cacheHits - hit0,
    tsVersion: TS.version,
    tsUrl,
    packages,
    missingPackages,
    ignoredPackages: [...loose],
  };
}

let queue = Promise.resolve();
self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'run') {
    queue = queue
      .then(() => run(msg.opts || {}))
      .then(
        (result) => post({ type: 'result', id: msg.id, result }),
        (err) => post({ type: 'error', id: msg.id, error: String((err && (err.stack || err.message)) || err) }),
      );
  } else if (msg.type === 'clear-cache') {
    queue = queue.then(async () => {
      try {
        if (self.caches) await caches.delete(CACHE_NAME);
      } catch {}
      cacheP = null;
      pkgs.clear();
      sfCache.clear();
      pins = {};
      post({ type: 'cleared', id: msg.id });
    });
  }
};
