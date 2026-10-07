// Google sign-in self test (README §3): the pure ID-token verifier (src/lib/googleIdToken.ts) against tokens signed
// here with a WebCrypto RSA key pair, the JWKS cache, and api.loginWithGoogle (existing staff, first-sign-in
// provisioning, refusals) through the real api wrapper.
// The service part runs on a private copy of the db (db.isolated) with a test client id + key injected
// (setSsoTestRuntime); the session is restored at the end and nothing reaches the shared demo data.
// Run in the browser: (await import('/src/dev/ssoTests')).runSsoTests().then(r => r.filter(x => !x.ok))

import type { ID } from '@/domain/types';
import { SSO_ALLOWED_DOMAIN, SSO_DEFAULT_ROLE } from '@/config/auth';
import {
  createGoogleKeyFetcher,
  GoogleTokenError,
  verifyGoogleIdToken,
  type GoogleJwk,
  type GoogleTokenErrorCode,
  type KeyFetcher,
  type VerifyGoogleIdTokenOptions,
} from '@/lib/googleIdToken';
import { api } from '@/services/api';
import { setSsoTestRuntime } from '@/services/api/session';
import { ApiError } from '@/services/contract';
import { getSession, setSession } from '@/services/context';
import { db } from '@/services/db';
import { AssertionError, assert, assertEqual, createSuite, type TestResult } from '@/dev/testkit';

type Suite = ReturnType<typeof createSuite>;

const CLIENT_ID = 'selftest-client.apps.googleusercontent.com';
const KID = 'selftest-key-1';
const DOMAIN = SSO_ALLOWED_DOMAIN;
const HEADER = { alg: 'RS256', kid: KID, typ: 'JWT' };
const PICTURE = 'https://lh3.googleusercontent.com/a/selftest-photo=s96-c';

interface Keys {
  privateKey: CryptoKey;
  /** another key pair: signatures that must not verify */
  otherPrivateKey: CryptoKey;
  otherPublicKey: CryptoKey;
  jwk: GoogleJwk;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function makeKeys(): Promise<Keys> {
  const algorithm: RsaHashedKeyGenParams = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  };
  const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const other = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  if (!pub.n || !pub.e) throw new Error('JWK export failed');
  return {
    privateKey: pair.privateKey,
    otherPrivateKey: other.privateKey,
    otherPublicKey: other.publicKey,
    jwk: { kid: KID, kty: 'RSA', n: pub.n, e: pub.e, alg: 'RS256', use: 'sig' },
  };
}

async function sign(header: Record<string, unknown>, payload: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const input = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(signature))}`;
}

/** Google-shaped claims, valid now; `over` replaces fields (undefined removes one) */
function claims(over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    azp: CLIENT_ID,
    aud: CLIENT_ID,
    sub: '110000000000000000001',
    hd: DOMAIN,
    email: `sso.selftest@${DOMAIN}`,
    email_verified: true,
    nbf: now - 40,
    name: 'Kiểm Thử Đăng Nhập',
    picture: PICTURE,
    given_name: 'Đăng Nhập',
    family_name: 'Kiểm Thử',
    iat: now - 10,
    exp: now + 3590,
    jti: 'selftest',
    ...over,
  };
}

async function expectTokenError(run: Promise<unknown>, code: GoogleTokenErrorCode): Promise<void> {
  try {
    await run;
  } catch (err) {
    assert(err instanceof GoogleTokenError, `expected GoogleTokenError ${code}, got ${String(err)}`);
    assertEqual(err.code, code, 'error code');
    return;
  }
  throw new AssertionError(`expected ${code}, the token was accepted`);
}

async function expectApiError(run: Promise<unknown>, messageKey: string, code?: string): Promise<void> {
  try {
    await run;
  } catch (err) {
    assert(err instanceof ApiError, `expected ApiError ${messageKey}, got ${String(err)}`);
    assertEqual(err.messageKey, messageKey, 'message key');
    if (code) assertEqual(err.code, code, 'error code');
    return;
  }
  throw new AssertionError(`expected ${messageKey}, the sign-in succeeded`);
}

// ───────────────────────────── the pure verifier ─────────────────────────────

async function verifierTests(suite: Suite, keys: Keys): Promise<void> {
  const fetchKey: KeyFetcher = async (kid) => (kid === KID ? keys.jwk : null);
  const verify = (token: string, over: Partial<VerifyGoogleIdTokenOptions> = {}) =>
    verifyGoogleIdToken(token, { clientId: CLIENT_ID, allowedDomain: DOMAIN, now: Date.now(), fetchKey, ...over });
  const signed = (over: Record<string, unknown> = {}, header: Record<string, unknown> = HEADER) => sign(header, claims(over), keys.privateKey);
  const now = Math.floor(Date.now() / 1000);

  await suite.testAsync('a valid token passes and returns the identity', async () => {
    const id = await verify(await signed({ email: `Sso.SelfTest@${DOMAIN.toUpperCase()}` }));
    assertEqual(id.email, `sso.selftest@${DOMAIN}`, 'email (lower case)');
    assertEqual(id.hd, DOMAIN, 'hd');
    assertEqual(id.name, 'Kiểm Thử Đăng Nhập', 'name (UTF-8)');
    assertEqual(id.picture, PICTURE, 'picture');
  });
  await suite.testAsync('issuer without scheme (accounts.google.com) passes', async () => {
    await verify(await signed({ iss: 'accounts.google.com' }));
  });
  await suite.testAsync('a token within the 60 s clock skew passes', async () => {
    await verify(await signed({ exp: now - 30, iat: now - 3630, nbf: now - 3660 }));
  });
  await suite.testAsync('wrong audience fails', async () => {
    await expectTokenError(verify(await signed({ aud: 'another-app.apps.googleusercontent.com' })), 'wrong_audience');
  });
  await suite.testAsync('azp of another client fails', async () => {
    await expectTokenError(verify(await signed({ azp: 'another-app.apps.googleusercontent.com' })), 'wrong_audience');
  });
  await suite.testAsync('wrong issuer fails', async () => {
    await expectTokenError(verify(await signed({ iss: 'https://accounts.example.com' })), 'wrong_issuer');
  });
  await suite.testAsync('an expired token fails', async () => {
    await expectTokenError(verify(await signed({ exp: now - 120, iat: now - 3720, nbf: now - 3750 })), 'expired');
  });
  await suite.testAsync('iat in the future fails', async () => {
    await expectTokenError(verify(await signed({ iat: now + 600, exp: now + 4200, nbf: now + 570 })), 'bad_iat');
  });
  await suite.testAsync('an unverified email fails', async () => {
    await expectTokenError(verify(await signed({ email_verified: false })), 'email_unverified');
    await expectTokenError(verify(await signed({ email_verified: 'true' })), 'email_unverified');
  });
  await suite.testAsync('hd of another domain fails', async () => {
    await expectTokenError(verify(await signed({ hd: 'coxanh.vn' })), 'wrong_domain');
  });
  await suite.testAsync('an email of another domain fails (hd matching)', async () => {
    await expectTokenError(verify(await signed({ email: 'someone@gmail.com' })), 'wrong_domain');
  });
  await suite.testAsync('a personal Google account (no hd) fails', async () => {
    await expectTokenError(verify(await signed({ hd: undefined, email: 'someone@gmail.com' })), 'wrong_domain');
    await expectTokenError(verify(await signed({ hd: undefined })), 'wrong_domain');
  });
  await suite.testAsync('look-alike domains fail', async () => {
    await expectTokenError(verify(await signed({ hd: `${DOMAIN}.evil.com`, email: `a@${DOMAIN}.evil.com` })), 'wrong_domain');
    await expectTokenError(verify(await signed({ hd: `evil${DOMAIN}`, email: `a@evil${DOMAIN}` })), 'wrong_domain');
  });
  await suite.testAsync('a signature of another key fails', async () => {
    await expectTokenError(verify(await sign(HEADER, claims(), keys.otherPrivateKey)), 'bad_signature');
  });
  await suite.testAsync('a tampered payload fails', async () => {
    const [h, , s] = (await signed()).split('.');
    const forged = `${h}.${b64urlJson(claims({ email: `director@${DOMAIN}` }))}.${s}`;
    await expectTokenError(verify(forged), 'bad_signature');
  });
  await suite.testAsync('alg none / HS256 fail before any key is used', async () => {
    let asked = 0;
    const counting: KeyFetcher = async (kid) => {
      asked += 1;
      return fetchKey(kid);
    };
    await expectTokenError(verify(`${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson(claims())}.`, { fetchKey: counting }), 'unsupported_alg');
    await expectTokenError(verify(await signed({}, { alg: 'HS256', kid: KID, typ: 'JWT' }), { fetchKey: counting }), 'unsupported_alg');
    assertEqual(asked, 0, 'key lookups');
  });
  await suite.testAsync('an unknown key id fails', async () => {
    await expectTokenError(verify(await signed({}, { ...HEADER, kid: 'rotated-away' })), 'unknown_key');
  });
  await suite.testAsync('a key named in the header (jwk / jku / x5u) is ignored', async () => {
    const evil = await crypto.subtle.exportKey('jwk', keys.otherPublicKey);
    const header = { ...HEADER, jwk: { kty: 'RSA', n: evil.n, e: evil.e }, jku: 'https://evil.example/jwks', x5u: 'https://evil.example/x5' };
    await expectTokenError(verify(await sign(header, claims(), keys.otherPrivateKey)), 'bad_signature');
  });
  await suite.testAsync('an RSA key under 2048 bits is refused', async () => {
    const weak = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const pub = await crypto.subtle.exportKey('jwk', weak.publicKey);
    const weakKey: KeyFetcher = async (kid) => (kid === KID && pub.n && pub.e ? { kid: KID, kty: 'RSA', n: pub.n, e: pub.e } : null);
    await expectTokenError(verify(await sign(HEADER, claims(), weak.privateKey), { fetchKey: weakKey }), 'unknown_key');
  });
  await suite.testAsync('a non-ASCII email (case-folds onto another address) fails', async () => {
    // U+212A KELVIN SIGN lower-cases to 'k': it must not reach "ka@…" of someone else
    await expectTokenError(verify(await signed({ email: `Ka@${DOMAIN}` })), 'malformed');
    await expectTokenError(verify(await signed({ email: `an@${DOMAIN}​` })), 'malformed');
  });
  await suite.testAsync('hd is compared exactly (no trimming of a signed claim)', async () => {
    await expectTokenError(verify(await signed({ hd: ` ${DOMAIN} ` })), 'wrong_domain');
    await verify(await signed({ hd: DOMAIN.toUpperCase() }));
  });
  await suite.testAsync('malformed tokens fail', async () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', '!!.@@.##', `${b64urlJson([1])}.${b64urlJson(claims())}.x`]) {
      await expectTokenError(verify(bad), 'malformed');
    }
  });
  await suite.testAsync('no client id configured → refused', async () => {
    await expectTokenError(verify(await signed(), { clientId: '' }), 'no_client_id');
  });
  await suite.testAsync('key set unreachable → keys_unavailable', async () => {
    const down: KeyFetcher = async () => {
      throw new Error('offline');
    };
    await expectTokenError(verify(await signed(), { fetchKey: down }), 'keys_unavailable');
  });

  await suite.testAsync('JWKS: cached by kid, refetched on rotation at most once a minute, failures remembered', async () => {
    let clock = 1_000_000;
    let calls = 0;
    let failNext = false;
    const response = () =>
      new Response(JSON.stringify({ keys: [keys.jwk] }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
    const fetcher = createGoogleKeyFetcher({
      storage: null,
      now: () => clock,
      fetchImpl: async () => {
        calls += 1;
        if (failNext) throw new Error('network down');
        return response();
      },
    });
    assertEqual((await fetcher(KID))?.kid, KID, 'first lookup');
    assertEqual((await fetcher(KID))?.kid, KID, 'second lookup');
    assertEqual(calls, 1, 'downloads after two lookups');
    assertEqual(await fetcher('unknown-kid'), null, 'unknown kid');
    assertEqual(calls, 1, 'no refetch within a minute of the last download');
    clock += 61_000;
    assertEqual(await fetcher('unknown-kid'), null, 'unknown kid after a minute');
    assertEqual(calls, 2, 'one refetch for the unknown kid');
    clock += 3_600_000;
    failNext = true;
    let threw = false;
    try {
      await fetcher(KID);
    } catch {
      threw = true;
    }
    assert(threw, 'expired cache + network down → throws');
    assertEqual(calls, 3, 'downloads');
    threw = false;
    try {
      await fetcher(KID);
    } catch (err) {
      threw = err instanceof GoogleTokenError && err.code === 'keys_unavailable';
    }
    assert(threw, 'a recent failure answers at once');
    assertEqual(calls, 3, 'no download during the failure back-off');
    clock += 31_000;
    failNext = false;
    assertEqual((await fetcher(KID))?.kid, KID, 'after the back-off');
    assertEqual(calls, 4, 'downloads');
  });

  await suite.testAsync('JWKS: a stored copy is reused, a planted far-future copy is ignored', async () => {
    const clock = 5_000_000;
    const stored = new Map<string, string>();
    const storage = {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => void stored.set(k, v),
      removeItem: (k: string) => void stored.delete(k),
    } as unknown as Storage;
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify({ keys: [keys.jwk] }), { status: 200, headers: { 'cache-control': 'public, max-age=3600' } });
    };
    // a fresh copy written by an earlier fetcher of this tab is reused without a download
    await createGoogleKeyFetcher({ storage, now: () => clock, fetchImpl })(KID);
    assertEqual(calls, 1, 'first download');
    assertEqual((await createGoogleKeyFetcher({ storage, now: () => clock, fetchImpl })(KID))?.kid, KID, 'stored key');
    assertEqual(calls, 1, 'no second download');
    // a planted set with an attacker key and a 10-year expiry is never trusted
    const evil = await crypto.subtle.exportKey('jwk', keys.otherPublicKey);
    const planted = { keys: [{ kid: 'planted', kty: 'RSA', n: evil.n, e: evil.e }], expiresAt: clock + 10 * 365 * 86_400_000 };
    assertEqual(stored.size, 1, 'one stored key set');
    for (const k of [...stored.keys()]) stored.set(k, JSON.stringify(planted));
    assertEqual(await createGoogleKeyFetcher({ storage, now: () => clock, fetchImpl })('planted'), null, 'planted key');
    assertEqual(calls, 2, 'the real set was downloaded instead');
  });
}

// ───────────────────────────── api.loginWithGoogle ─────────────────────────────

function liveUsersWithEmail(email: string): ID[] {
  return db
    .rows('users')
    .filter((u) => u.email.toLowerCase() === email.toLowerCase())
    .map((u) => u.id);
}

async function serviceTests(suite: Suite, keys: Keys): Promise<void> {
  const fetchKey: KeyFetcher = async (kid) => (kid === KID ? keys.jwk : null);
  const token = (over: Record<string, unknown> = {}) => sign(HEADER, claims(over), keys.privateKey);
  const bossEmail = `sso.boss@${DOMAIN}`;
  setSsoTestRuntime({ clientId: CLIENT_ID, fetchKey, adminEmails: [bossEmail] });
  const tokensSeen: string[] = [];

  await suite.testAsync('existing staff email (any case) signs in as that user', async () => {
    const tuan = db.get('users', 'u_member_tuan');
    const before = db.rows('users').length;
    setSession(null);
    const tk = await token({ email: tuan.email.toUpperCase(), name: 'Another Name', picture: PICTURE });
    tokensSeen.push(tk);
    const v = await api.loginWithGoogle(tk, false);
    assertEqual(v.user.id, 'u_member_tuan', 'signed-in user');
    assertEqual(v.role, 'member', 'role kept');
    assertEqual(v.remember_device, false, 'remember');
    assertEqual(db.rows('users').length, before, 'no user created');
    assertEqual(db.get('users', 'u_member_tuan').full_name, tuan.full_name, 'name not overwritten');
  });

  const newEmail = `sso.newbie@${DOMAIN}`;
  let newId: ID | null = null;
  const defaultCost = SSO_DEFAULT_ROLE === 'director';
  await suite.testAsync(`first sign-in of a verified staff account creates an active user (role ${SSO_DEFAULT_ROLE})`, async () => {
    setSession(null);
    const directorBells = db.rows('notifications').filter((n) => n.user_id === 'u_director').length;
    const tk = await token({ email: newEmail, sub: '110000000000000000002' });
    tokensSeen.push(tk);
    const v = await api.loginWithGoogle(tk, true);
    newId = v.user.id;
    const u = db.get('users', v.user.id);
    assertEqual([v.org_type, v.role, v.can_view_cost, v.remember_device], ['internal', SSO_DEFAULT_ROLE, defaultCost, true], 'viewer');
    assertEqual(
      [u.email, u.org_type, u.account_id, u.role, u.can_view_cost, u.status, u.auth_provider, u.full_name, u.avatar_url],
      [newEmail, 'internal', null, SSO_DEFAULT_ROLE, defaultCost, 'active', 'google', 'Kiểm Thử Đăng Nhập', PICTURE],
      'user row',
    );
    assert(u.last_login_at !== null, 'last sign-in stamped');
    const logged = db.rows('activities').filter((a) => a.action === 'user.sso_provisioned' && a.target_id === u.id);
    assertEqual(logged.length, 1, 'user.sso_provisioned activities');
    assertEqual([logged[0]?.actor_id, logged[0]?.visibility, logged[0]?.account_id], [u.id, 'internal', null], 'activity');
    const bells = db.rows('notifications').filter((n) => n.user_id === 'u_director');
    assertEqual(bells.length, directorBells + 1, 'the director is told');
  });
  await suite.testAsync('the next sign-in reuses that user (created once)', async () => {
    setSession(null);
    const users = db.rows('users').length;
    const tk = await token({ email: newEmail, sub: '110000000000000000002' });
    tokensSeen.push(tk);
    const v = await api.loginWithGoogle(tk, false);
    assertEqual(v.user.id, newId, 'same user');
    assertEqual(db.rows('users').length, users, 'no second user');
    assertEqual(liveUsersWithEmail(newEmail).length, 1, 'one row with that email');
    assertEqual(db.rows('activities').filter((a) => a.action === 'user.sso_provisioned' && a.target_id === newId).length, 1, 'logged once');
  });
  await suite.testAsync('an email of SSO_ADMIN_EMAILS is created as director', async () => {
    setSession(null);
    const tk = await token({ email: bossEmail, sub: '110000000000000000003' });
    tokensSeen.push(tk);
    const v = await api.loginWithGoogle(tk, false);
    assertEqual([v.role, v.can_view_cost], ['director', true], 'director with cost');
  });
  await suite.testAsync('a client-domain Google account is refused, nothing created', async () => {
    setSession(null);
    const minh = db.get('users', 'u_client_minh');
    const domain = minh.email.slice(minh.email.indexOf('@') + 1);
    const users = db.rows('users').length;
    await expectApiError(api.loginWithGoogle(await token({ email: minh.email, hd: domain }), false), 'errors.sso_domain', 'forbidden');
    await expectApiError(api.loginWithGoogle(await token({ email: minh.email }), false), 'errors.sso_domain', 'forbidden');
    assertEqual(api.getViewer(), null, 'still signed out');
    assertEqual(db.rows('users').length, users, 'no user created');
  });
  let lockedEmail = '';
  await suite.testAsync('a locked staff account is refused, not re-created', async () => {
    setSession(null);
    const other = db.rows('users').find((u) => u.org_type === 'internal' && u.role === 'member' && u.id !== 'u_member_tuan');
    assert(other, 'a second member in the seed');
    lockedEmail = other.email;
    db.batch(() => db.update('users', other.id, { status: 'disabled' }));
    await expectApiError(api.loginWithGoogle(await token({ email: other.email }), false), 'errors.sso_disabled', 'forbidden');
    assertEqual(liveUsersWithEmail(other.email).length, 1, 'no new row for that email');
    assertEqual(api.getViewer(), null, 'still signed out');
  });
  await suite.testAsync('invited again after a lock: Google signs in the new login (like the password form)', async () => {
    assert(lockedEmail, 'locked member from the previous check');
    await api.loginDemo('director');
    const again = await api.inviteInternalUser({ full_name: 'Thành viên mời lại', email: lockedEmail, role: 'member', title: '' });
    setSession(null);
    const v = await api.loginWithGoogle(await token({ email: lockedEmail.toUpperCase() }), false);
    assertEqual(v.user.id, again.id, 'the new login');
    assertEqual(db.get('users', again.id).status, 'active', 'invitation accepted');
  });
  await suite.testAsync('a newera.inc email held by a client login is refused, nothing created', async () => {
    setSession(null);
    const users = db.rows('users').length;
    db.batch(() => db.update('users', 'u_client_lan', { email: `lan.client@${DOMAIN}` }));
    await expectApiError(api.loginWithGoogle(await token({ email: `Lan.Client@${DOMAIN}` }), false), 'errors.sso_internal_only', 'forbidden');
    assertEqual(db.rows('users').length, users, 'no user created');
    assertEqual(api.getViewer(), null, 'still signed out');
  });
  await suite.testAsync('SSO_ADMIN_EMAILS never promotes an existing login; a provisioned user gets exactly the default role', async () => {
    setSsoTestRuntime({ clientId: CLIENT_ID, fetchKey, adminEmails: [bossEmail, db.get('users', 'u_member_tuan').email] });
    try {
      setSession(null);
      const v = await api.loginWithGoogle(await token({ email: db.get('users', 'u_member_tuan').email }), false);
      assertEqual([v.user.id, v.role, v.can_view_cost], ['u_member_tuan', 'member', false], 'existing member unchanged');
    } finally {
      setSsoTestRuntime({ clientId: CLIENT_ID, fetchKey, adminEmails: [bossEmail] });
    }
    setSession(null);
    const v = await api.loginWithGoogle(await token({ email: newEmail, sub: '110000000000000000002' }), false);
    assertEqual(v.role, SSO_DEFAULT_ROLE, 'provisioned with the default role');
    if (SSO_DEFAULT_ROLE === 'member') {
      await expectApiError(api.listAllUsers(), 'errors.forbidden');
      await expectApiError(api.setUserRole(v.user.id, 'director'), 'errors.forbidden');
      await expectApiError(api.startViewAsClient(db.rows('accounts')[0]?.id ?? 'none'), 'errors.forbidden');
    }
  });
  await suite.testAsync('the Google name is cleaned (control / bidi characters), the photo only from googleusercontent.com', async () => {
    setSession(null);
    const email = `sso.spoof@${DOMAIN}`;
    const v = await api.loginWithGoogle(
      await token({ email, sub: '110000000000000000004', name: '‮gnp.exe‬  Nguyễn\u0007 Văn', picture: 'javascript:alert(1)' }),
      false,
    );
    const u = db.get('users', v.user.id);
    assertEqual([u.full_name, u.avatar_url], ['gnp.exe Nguyễn Văn', null], 'name / photo');
  });
  await suite.testAsync('bad tokens: expired → sso_expired; forged / garbage / wrong audience → sso_invalid', async () => {
    setSession(null);
    const now = Math.floor(Date.now() / 1000);
    await expectApiError(api.loginWithGoogle(await token({ exp: now - 300, iat: now - 3900, nbf: now - 3930 }), false), 'errors.sso_expired');
    await expectApiError(api.loginWithGoogle(await sign(HEADER, claims(), keys.otherPrivateKey), false), 'errors.sso_invalid');
    await expectApiError(api.loginWithGoogle('not-a-token', false), 'errors.sso_invalid');
    await expectApiError(api.loginWithGoogle(await token({ aud: 'another-app.apps.googleusercontent.com' }), false), 'errors.sso_invalid');
    assertEqual(api.getViewer(), null, 'still signed out');
  });
  await suite.testAsync('no client id configured → sso_unavailable', async () => {
    setSsoTestRuntime({ clientId: '', fetchKey });
    try {
      await expectApiError(api.loginWithGoogle(await token(), false), 'errors.sso_unavailable');
    } finally {
      setSsoTestRuntime({ clientId: CLIENT_ID, fetchKey, adminEmails: [bossEmail] });
    }
  });
  await suite.testAsync('the raw token is never kept (data, network log, storage)', async () => {
    const signatures = tokensSeen.map((tk) => tk.slice(tk.lastIndexOf('.') + 1)).filter((s) => s.length > 40);
    assert(signatures.length >= 3, 'tokens were used');
    const haystacks = [JSON.stringify(db.dump()), JSON.stringify(window.__CH_NET__ ?? [])];
    for (const store of [window.sessionStorage, window.localStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (k) haystacks.push(store.getItem(k) ?? '');
      }
    }
    for (const sig of signatures) for (const h of haystacks) assert(!h.includes(sig), 'token signature found in stored data');
  });
}

/**
 * Outside db.isolated the test client id / key must be ignored: on the shared data only GOOGLE_CLIENT_ID and Google's
 * real keys count. A client-domain email is used, so nothing could be written even if the guard failed.
 */
async function sharedDataGuardTest(suite: Suite, keys: Keys): Promise<void> {
  await suite.testAsync('a test key is ignored outside the private copy (shared data untouched)', async () => {
    assert(!db.isIsolated, 'runs on the shared data');
    const fetchKey: KeyFetcher = async (kid) => (kid === KID ? keys.jwk : null);
    const before = { users: db.rows('users').length, viewer: api.getViewer()?.user.id ?? null };
    setSsoTestRuntime({ clientId: CLIENT_ID, fetchKey, adminEmails: [] });
    try {
      const tk = await sign(HEADER, claims({ email: 'someone@coxanh.vn', hd: 'coxanh.vn' }), keys.privateKey);
      let key = '';
      try {
        await api.loginWithGoogle(tk, false);
      } catch (err) {
        key = err instanceof ApiError ? err.messageKey : String(err);
      }
      // the config's (empty or real) client id answers: never the domain check that only the test key could reach
      assert(key === 'errors.sso_unavailable' || key === 'errors.sso_invalid', `expected sso_unavailable / sso_invalid, got ${key || 'a sign-in'}`);
    } finally {
      setSsoTestRuntime(null);
    }
    assertEqual([db.rows('users').length, api.getViewer()?.user.id ?? null], [before.users, before.viewer], 'shared data and session');
  });
}

/** Runs on a private copy of the db (db.isolated); the session is put back at the end. */
export async function runSsoTests(): Promise<TestResult[]> {
  const suite = createSuite('sso');
  let keys: Keys;
  try {
    keys = await makeKeys();
  } catch (err) {
    return [{ suite: 'sso', name: 'WebCrypto RSA key pair', ok: false, detail: err instanceof Error ? err.message : String(err) }];
  }
  await verifierTests(suite, keys);
  await sharedDataGuardTest(suite, keys);
  await db.isolated(async () => {
    const saved = getSession();
    try {
      await serviceTests(suite, keys);
    } finally {
      setSsoTestRuntime(null);
      setSession(saved);
    }
  });
  return suite.results;
}
