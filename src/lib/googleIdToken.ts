// Google ID token (JWT, RS256) verification in the browser with WebCrypto — no claim is trusted before the signature
// is checked. Pure module: the caller passes the client id, the allowed Workspace domain, the time and a key fetcher
// (Google's JWKS in the app, a generated test key in the self tests).
// Rules: header alg RS256 + kid → key (RSA ≥ 2048 bits) → RSASSA-PKCS1-v1_5 / SHA-256 signature → iss ∈
// GOOGLE_ISSUERS, aud (and azp when present) = client id, exp > now − skew, iat / nbf sane, email_verified === true,
// ASCII email, hd = domain AND the email's domain = domain. Errors carry a code only — never the token or a claim value.

export const GOOGLE_ISSUERS: readonly string[] = ['accounts.google.com', 'https://accounts.google.com'];
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export type GoogleTokenErrorCode =
  | 'no_client_id'
  | 'malformed'
  | 'unsupported_alg'
  | 'unknown_key'
  | 'keys_unavailable'
  | 'bad_signature'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'expired'
  | 'bad_iat'
  | 'email_unverified'
  | 'wrong_domain';

export class GoogleTokenError extends Error {
  code: GoogleTokenErrorCode;
  constructor(code: GoogleTokenErrorCode) {
    super(`google id token: ${code}`);
    this.name = 'GoogleTokenError';
    this.code = code;
  }
}

/** Public RSA signing key of Google (one entry of the JWKS). */
export interface GoogleJwk {
  kid: string;
  kty: 'RSA';
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

/** Returns the key for `kid`, null when unknown; throws when the key set cannot be loaded. */
export type KeyFetcher = (kid: string) => Promise<GoogleJwk | null>;

export interface VerifiedGoogleIdentity {
  sub: string;
  /** lower case */
  email: string;
  hd: string;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  iat: number;
  exp: number;
}

export interface VerifyGoogleIdTokenOptions {
  clientId: string;
  /** Workspace domain, e.g. 'newera.inc' */
  allowedDomain: string;
  /** current time, epoch milliseconds */
  now: number;
  fetchKey: KeyFetcher;
  /** clock skew tolerance in seconds (default 60) */
  skewSec?: number;
}

const MAX_TOKEN_LENGTH = 8192;
const MAX_LIFETIME_SEC = 24 * 3600;
/** Google signs with 2048-bit RSA keys; anything weaker is refused */
const MIN_RSA_BITS = 2048;
const B64URL = /^[A-Za-z0-9_-]*$/;
/**
 * printable ASCII only, one '@': Workspace addresses are ASCII, and toLowerCase() of some non-ASCII letters gives
 * ASCII ones (U+212A KELVIN SIGN → 'k'), which could otherwise land on another person's address
 */
const EMAIL = /^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+$/;

function fail(code: GoogleTokenErrorCode): never {
  throw new GoogleTokenError(code);
}

export function base64UrlToBytes(part: string): Uint8Array {
  if (!B64URL.test(part) || part.length % 4 === 1) fail('malformed');
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    fail('malformed');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJsonPart(part: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(part)));
  } catch (err) {
    if (err instanceof GoogleTokenError) throw err;
    fail('malformed');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('malformed');
  return parsed as Record<string, unknown>;
}

function isGoogleJwk(v: unknown): v is GoogleJwk {
  if (!v || typeof v !== 'object') return false;
  const k = v as Record<string, unknown>;
  return (
    typeof k.kid === 'string' &&
    k.kty === 'RSA' &&
    typeof k.n === 'string' &&
    typeof k.e === 'string' &&
    B64URL.test(k.n) &&
    B64URL.test(k.e) &&
    (k.alg === undefined || k.alg === 'RS256') &&
    (k.use === undefined || k.use === 'sig')
  );
}

function optionalText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function importRsaKey(jwk: GoogleJwk): Promise<CryptoKey> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) fail('keys_unavailable');
  let key: CryptoKey;
  try {
    key = await subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    return fail('unknown_key');
  }
  const bits = (key.algorithm as RsaHashedKeyAlgorithm).modulusLength;
  if (typeof bits !== 'number' || bits < MIN_RSA_BITS) fail('unknown_key');
  return key;
}

/**
 * Verifies a Google ID token and returns the identity it proves. Throws GoogleTokenError (code only) otherwise.
 */
export async function verifyGoogleIdToken(token: string, opts: VerifyGoogleIdTokenOptions): Promise<VerifiedGoogleIdentity> {
  const clientId = (opts.clientId ?? '').trim();
  const domain = (opts.allowedDomain ?? '').trim().toLowerCase();
  if (!clientId || !domain) fail('no_client_id');
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) fail('malformed');
  const parts = token.split('.');
  if (parts.length !== 3) fail('malformed');
  const [headPart, bodyPart, sigPart] = parts as [string, string, string];

  // 1. header: only what is needed to pick the key
  const header = decodeJsonPart(headPart);
  if (header.alg !== 'RS256') fail('unsupported_alg');
  if (header.typ !== undefined && header.typ !== 'JWT') fail('malformed');
  if (header.crit !== undefined) fail('malformed');
  const kid = header.kid;
  if (typeof kid !== 'string' || !kid || kid.length > 256) fail('malformed');
  if (!bodyPart || !sigPart) fail('malformed');

  // 2. key + signature
  let jwk: GoogleJwk | null;
  try {
    jwk = await opts.fetchKey(kid);
  } catch {
    fail('keys_unavailable');
  }
  if (!jwk || !isGoogleJwk(jwk) || jwk.kid !== kid) fail('unknown_key');
  const key = await importRsaKey(jwk);
  const signature = base64UrlToBytes(sigPart);
  const signed = new TextEncoder().encode(`${headPart}.${bodyPart}`);
  let valid = false;
  try {
    valid = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, signature, signed);
  } catch {
    valid = false;
  }
  if (!valid) fail('bad_signature');

  // 3. claims (now authentic)
  const c = decodeJsonPart(bodyPart);
  if (typeof c.iss !== 'string' || !GOOGLE_ISSUERS.includes(c.iss)) fail('wrong_issuer');
  if (typeof c.aud !== 'string' || c.aud !== clientId) fail('wrong_audience');
  if (c.azp !== undefined && c.azp !== clientId) fail('wrong_audience');

  const nowSec = Math.floor(opts.now / 1000);
  const skew = Math.max(0, opts.skewSec ?? 60);
  const exp = c.exp;
  const iat = c.iat;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) fail('malformed');
  if (!(exp > nowSec - skew)) fail('expired');
  if (typeof iat !== 'number' || !Number.isFinite(iat) || iat > nowSec + skew || iat >= exp || exp - iat > MAX_LIFETIME_SEC) {
    fail('bad_iat');
  }
  if (c.nbf !== undefined && (typeof c.nbf !== 'number' || c.nbf > nowSec + skew)) fail('bad_iat');

  if (typeof c.sub !== 'string' || !c.sub) fail('malformed');
  if (typeof c.email !== 'string' || !EMAIL.test(c.email)) fail('malformed');
  if (c.email_verified !== true) fail('email_unverified');
  const email = c.email.toLowerCase();
  // exact (case-insensitive) match: no trimming of a signed claim
  const hd = typeof c.hd === 'string' ? c.hd.toLowerCase() : '';
  const emailDomain = email.slice(email.lastIndexOf('@') + 1);
  if (hd !== domain || emailDomain !== domain) fail('wrong_domain');

  return {
    sub: c.sub,
    email,
    hd,
    name: optionalText(c.name),
    given_name: optionalText(c.given_name),
    family_name: optionalText(c.family_name),
    picture: optionalText(c.picture),
    iat,
    exp,
  };
}

// ───────────────────────────── Google's key set (JWKS) ─────────────────────────────

interface KeySet {
  keys: GoogleJwk[];
  /** epoch ms */
  expiresAt: number;
}

export interface GoogleKeyFetcherOptions {
  url?: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  /** sessionStorage by default; null = memory only */
  storage?: Storage | null;
  now?: () => number;
}

const STORAGE_KEY = 'clienthub.gsi.jwks.v1';
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MIN_TTL_MS = 5 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
/** after a failed download, do not ask again for this long (each sign-in attempt answers at once) */
const FAILURE_BACKOFF_MS = 30 * 1000;
/** an unknown kid (key rotation) refetches at most this often */
const REFRESH_MIN_INTERVAL_MS = 60 * 1000;

function ttlFrom(cacheControl: string | null): number {
  const m = /max-age=(\d+)/i.exec(cacheControl ?? '');
  const ms = m ? Number(m[1]) * 1000 : DEFAULT_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, ms));
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Key fetcher for Google's JWKS: cached in memory and sessionStorage by kid until the Cache-Control max-age runs
 * out; an unknown kid refetches (rate limited); a failed download is remembered for 30 s.
 */
export function createGoogleKeyFetcher(options: GoogleKeyFetcherOptions = {}): KeyFetcher {
  const url = options.url ?? GOOGLE_JWKS_URL;
  const fetchImpl = options.fetchImpl ?? ((u: string, init?: RequestInit) => fetch(u, init));
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => Date.now());
  let cache: KeySet | null = readStored();
  let lastFetchAt = 0;
  let failedAt = 0;
  let inflight: Promise<KeySet> | null = null;

  function readStored(): KeySet | null {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { keys?: unknown; expiresAt?: unknown };
      if (!Array.isArray(parsed.keys) || typeof parsed.expiresAt !== 'number') return null;
      // a stored set can never outlive the longest TTL we ever grant (a planted far-future copy is ignored)
      if (!(parsed.expiresAt <= now() + MAX_TTL_MS)) return null;
      const keys = parsed.keys.filter(isGoogleJwk);
      return keys.length ? { keys, expiresAt: parsed.expiresAt } : null;
    } catch {
      return null;
    }
  }

  async function download(): Promise<KeySet> {
    lastFetchAt = now();
    try {
      const res = await fetchImpl(url, { credentials: 'omit', cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { keys?: unknown };
      const keys = Array.isArray(body.keys) ? body.keys.filter(isGoogleJwk) : [];
      if (keys.length === 0) throw new Error('empty key set');
      const set: KeySet = { keys, expiresAt: now() + ttlFrom(res.headers.get('cache-control')) };
      cache = set;
      failedAt = 0;
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(set));
      } catch {
        // storage full / blocked: memory cache only
      }
      return set;
    } catch (err) {
      failedAt = now();
      throw err;
    }
  }

  function refresh(): Promise<KeySet> {
    if (failedAt && now() - failedAt < FAILURE_BACKOFF_MS) return Promise.reject(new GoogleTokenError('keys_unavailable'));
    if (!inflight) {
      inflight = download().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  return async (kid: string) => {
    const fresh = cache && cache.expiresAt > now() ? cache : null;
    const hit = fresh?.keys.find((k) => k.kid === kid);
    if (hit) return hit;
    // unknown kid with a fresh set: Google may have rotated its keys — refetch, but not on every bad token
    if (fresh && now() - lastFetchAt < REFRESH_MIN_INTERVAL_MS) return null;
    const set = await refresh();
    return set.keys.find((k) => k.kid === kid) ?? null;
  };
}
