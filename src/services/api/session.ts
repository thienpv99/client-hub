// Session: demo logins, client OTP, internal password, Google sign-in (New Era staff), "Xem như khách hàng",
// onboarding, preferences.

import type { ID, NotificationPref, Role, User } from '@/domain/types';
import { ApiError, type Api, type DemoLogin, type Viewer } from '@/services/contract';
import { GOOGLE_CLIENT_ID, SSO_ADMIN_EMAILS, SSO_ALLOWED_DOMAIN, SSO_DEFAULT_ROLE, type InternalRole } from '@/config/auth';
import { nowISO } from '@/domain/clock';
import { t } from '@/i18n';
import {
  createGoogleKeyFetcher,
  GoogleTokenError,
  verifyGoogleIdToken,
  type KeyFetcher,
  type VerifiedGoogleIdentity,
} from '@/lib/googleIdToken';
import { newId } from '@/lib/utils';
import { assertWritable, getSession, getViewer, isManagerOf, requireViewer, setSession, toUserRef } from '@/services/context';
import { db } from '@/services/db';
import { logActivity, notifyUsers } from '@/services/effects';

/** Demo login buttons (ARCHITECTURE §9 keeps these ids stable). */
const DEMO_USERS: readonly { role: Role; user_id: ID }[] = [
  { role: 'director', user_id: 'u_director' },
  { role: 'am', user_id: 'u_am_ha' },
  { role: 'member', user_id: 'u_member_tuan' },
  { role: 'client_owner', user_id: 'u_client_minh' },
  { role: 'client_member', user_id: 'u_client_lan' },
];

/** Demo-only secrets (no real auth in the mock build). */
export const DEMO_OTP_CODE = '246810';
export const DEMO_PASSWORD = 'newera2026';

const PREFS: readonly NotificationPref[] = ['all', 'digest_and_urgent'];

function currentViewer(): Viewer {
  const v = getViewer();
  if (!v) throw new ApiError('unauthenticated', 'errors.unauthenticated');
  return v;
}

function userByEmail(email: string): User | undefined {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return undefined;
  return db.rows('users').find((u) => u.email.toLowerCase() === e && u.status !== 'disabled');
}

/** Start a session for `user`, stamp last_login_at (and activate an invited login). */
function startSession(user: User, remember: boolean): Viewer {
  setSession({ user_id: user.id, remember, view_as_account_id: null });
  const patch: Partial<User> = { last_login_at: nowISO() };
  if (user.status === 'invited') patch.status = 'active';
  db.batch(() => {
    db.update('users', user.id, patch);
  });
  return currentViewer();
}

/** A non-impersonating viewer for an internal user (used to check view-as access). */
function internalViewerOf(u: User, remember: boolean): Viewer {
  return {
    user: { ...toUserRef(u), account_id: u.account_id, notification_pref: u.notification_pref, onboarded_at: u.onboarded_at },
    role: u.role,
    org_type: u.org_type,
    account_id: u.account_id,
    can_view_cost: u.role === 'director' || (u.role === 'am' && u.can_view_cost),
    read_only: false,
    impersonating: null,
    remember_device: remember,
  };
}

function subtitleOf(u: User): string {
  const company = u.org_type === 'internal' ? db.settings.company_name : db.find('accounts', u.account_id)?.name ?? '';
  return [u.title ?? '', company].filter(Boolean).join(' · ');
}

// ───────────────────────────── Google sign-in (New Era staff) ─────────────────────────────

/** What the Google check runs against: the config (src/config/auth.ts), or a self test's client id and key. */
export interface SsoRuntime {
  clientId: string;
  adminEmails: readonly string[];
  fetchKey: KeyFetcher;
}

let googleKeys: KeyFetcher | null = null;
let ssoTestRuntime: Partial<SsoRuntime> | null = null;

/**
 * Self tests only (src/dev/ssoTests.ts, inside db.isolated): verify against a test client id / key; null restores
 * the config. The allowed domain is never overridable. A test runtime counts only while the db is a self test's
 * private copy (db.isIsolated): a test key can never sign anyone into, or create anyone in, the shared data.
 */
export function setSsoTestRuntime(runtime: Partial<SsoRuntime> | null): void {
  ssoTestRuntime = runtime && db.isIsolated ? runtime : null;
}

function ssoRuntime(): SsoRuntime {
  if (!googleKeys) googleKeys = createGoogleKeyFetcher();
  const test = db.isIsolated ? ssoTestRuntime : null;
  return {
    clientId: test?.clientId ?? GOOGLE_CLIENT_ID,
    adminEmails: test?.adminEmails ?? SSO_ADMIN_EMAILS,
    fetchKey: test?.fetchKey ?? googleKeys,
  };
}

/** token problems → calm sign-in errors (never the token or a claim value) */
function ssoError(err: unknown): ApiError {
  const code = err instanceof GoogleTokenError ? err.code : null;
  switch (code) {
    case 'no_client_id':
    case 'keys_unavailable':
      return new ApiError('conflict', 'errors.sso_unavailable');
    case 'wrong_domain':
      return new ApiError('forbidden', 'errors.sso_domain', { domain: SSO_ALLOWED_DOMAIN });
    case 'expired':
      return new ApiError('unauthenticated', 'errors.sso_expired');
    default:
      return new ApiError('unauthenticated', 'errors.sso_invalid');
  }
}

/** control and invisible / bidi-override characters: a Google profile name is chosen by its owner */
const UNSAFE_NAME_CHARS = /[\u0000-\u001F\u007F-\u009F؜​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function googleDisplayName(identity: VerifiedGoogleIdentity): string {
  const raw = identity.name ?? [identity.given_name, identity.family_name].filter(Boolean).join(' ');
  const name = raw.replace(UNSAFE_NAME_CHARS, '').replace(/\s+/g, ' ').trim();
  return (name || identity.email.slice(0, identity.email.indexOf('@'))).slice(0, 120);
}

/** the Google profile photo (https, googleusercontent.com only) */
function googleAvatar(url: string | null): string | null {
  if (!url || url.length > 2048) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** First Google sign-in of a verified staff email: an active internal user (default role), logged + directors told. */
function provisionGoogleUser(identity: VerifiedGoogleIdentity, adminEmails: readonly string[]): User {
  const role: InternalRole = adminEmails.some((e) => e.trim().toLowerCase() === identity.email) ? 'director' : SSO_DEFAULT_ROLE;
  const fullName = googleDisplayName(identity);
  const { result } = db.batch(() => {
    const user: User = {
      id: newId('u'),
      full_name: fullName,
      email: identity.email,
      phone: null,
      org_type: 'internal',
      account_id: null,
      role,
      can_view_cost: role === 'director',
      title: null,
      salutation: null,
      avatar_url: googleAvatar(identity.picture),
      notification_pref: 'all',
      onboarded_at: null,
      invited_at: null,
      invited_by: null,
      last_login_at: null,
      status: 'active',
      deleted_at: null,
      auth_provider: 'google',
    };
    db.insert('users', user);
    logActivity({
      account_id: null,
      actor_id: user.id,
      action: 'user.sso_provisioned',
      target_type: 'user',
      target_id: user.id,
      params: { to: fullName, email: identity.email, role },
      visibility: 'internal',
    });
    const directors = db
      .rows('users')
      .filter((u) => u.org_type === 'internal' && u.role === 'director' && u.status === 'active' && u.id !== user.id)
      .map((u) => u.id);
    notifyUsers(directors, {
      kind: 'system',
      title: t('activity.invite.sso_title'),
      body: t('activity.invite.sso_body', { name: fullName, email: identity.email, role: t(`enums.role.${role}`) }),
      link: '/app/settings',
      account_id: null,
    });
    return user;
  });
  return result;
}

export const sessionApi: Pick<
  Api,
  | 'listDemoLogins'
  | 'loginDemo'
  | 'requestOtp'
  | 'verifyOtp'
  | 'loginWithPassword'
  | 'loginWithGoogle'
  | 'logout'
  | 'startViewAsClient'
  | 'stopViewAsClient'
  | 'completeOnboarding'
  | 'updateMyPreferences'
> = {
  listDemoLogins(): DemoLogin[] {
    const out: DemoLogin[] = [];
    for (const d of DEMO_USERS) {
      const u = db.find('users', d.user_id);
      if (!u) continue;
      out.push({ role: d.role, user_id: u.id, label_key: `auth.demo.${d.role}`, full_name: u.full_name, subtitle: subtitleOf(u) });
    }
    return out;
  },

  async loginDemo(role) {
    const demo = DEMO_USERS.find((d) => d.role === role);
    const user = demo ? db.find('users', demo.user_id) : undefined;
    if (!user || user.status === 'disabled') throw new ApiError('not_found', 'errors.not_found');
    return startSession(user, true);
  },

  async requestOtp(email) {
    const user = userByEmail(email);
    // clients sign in with a one-time code; New Era staff use their password
    if (!user || user.org_type !== 'client') throw new ApiError('not_found', 'errors.unknown_email');
    return { sent: true as const, demo_code: DEMO_OTP_CODE };
  },

  async verifyOtp(email, code, remember) {
    const user = userByEmail(email);
    if (!user || user.org_type !== 'client') throw new ApiError('not_found', 'errors.unknown_email');
    if ((code ?? '').trim() !== DEMO_OTP_CODE) throw new ApiError('validation', 'errors.invalid_otp');
    return startSession(user, !!remember);
  },

  async loginWithPassword(email, password, remember) {
    const user = userByEmail(email);
    if (!user || user.org_type !== 'internal') throw new ApiError('not_found', 'errors.unknown_email');
    if ((password ?? '') !== (user.password ?? DEMO_PASSWORD)) throw new ApiError('validation', 'errors.invalid_password');
    return startSession(user, !!remember);
  },

  async loginWithGoogle(idToken, remember) {
    const rt = ssoRuntime();
    if (!rt.clientId.trim()) throw new ApiError('conflict', 'errors.sso_unavailable');
    // never trust the UI: the token is verified here again (signature, issuer, audience, expiry, verified email, domain)
    let identity: VerifiedGoogleIdentity;
    try {
      identity = await verifyGoogleIdToken(typeof idToken === 'string' ? idToken : '', {
        clientId: rt.clientId,
        allowedDomain: SSO_ALLOWED_DOMAIN,
        now: Date.now(),
        fetchKey: rt.fetchKey,
      });
    } catch (err) {
      throw ssoError(err);
    }
    // every row with this email, disabled and removed ones too. A usable row wins (the director may have invited the
    // person again after locking an old login — the password form signs in the same row); with none, a locked or
    // removed person is refused and never re-created as a new member.
    const same = db.allRows('users').filter((u) => u.email.trim().toLowerCase() === identity.email);
    const usable = same.filter((u) => !u.deleted_at && u.status !== 'disabled');
    const existing = usable.find((u) => u.org_type === 'internal') ?? usable[0];
    if (existing) {
      if (existing.org_type !== 'internal') throw new ApiError('forbidden', 'errors.sso_internal_only');
      return startSession(existing, !!remember);
    }
    if (same.length > 0) throw new ApiError('forbidden', 'errors.sso_disabled');
    return startSession(provisionGoogleUser(identity, rt.adminEmails), !!remember);
  },

  async logout() {
    setSession(null);
  },

  async startViewAsClient(accountId) {
    const s = getSession();
    if (!s) throw new ApiError('unauthenticated', 'errors.unauthenticated');
    const real = db.find('users', s.user_id);
    if (!real || real.status === 'disabled') throw new ApiError('unauthenticated', 'errors.unauthenticated');
    if (real.org_type !== 'internal') throw new ApiError('forbidden', 'errors.forbidden');
    if (!db.find('accounts', accountId)) throw new ApiError('not_found', 'errors.not_found');
    // the director, or the AM of the account: view-as shows the decision maker's own bell and mail as well
    if (!isManagerOf(internalViewerOf(real, s.remember), accountId)) throw new ApiError('forbidden', 'errors.forbidden');
    setSession({ ...s, view_as_account_id: accountId });
    return currentViewer();
  },

  async stopViewAsClient() {
    const s = getSession();
    if (!s) throw new ApiError('unauthenticated', 'errors.unauthenticated');
    if (s.view_as_account_id !== null) setSession({ ...s, view_as_account_id: null });
    return currentViewer();
  },

  async completeOnboarding() {
    const v = requireViewer();
    assertWritable(v);
    const user = db.find('users', v.user.id);
    if (!user) throw new ApiError('not_found', 'errors.not_found');
    if (user.onboarded_at) return;
    db.batch(() => {
      db.update('users', user.id, { onboarded_at: nowISO() });
    });
  },

  async updateMyPreferences(patch) {
    const v = requireViewer();
    assertWritable(v);
    const pref = patch.notification_pref;
    if (pref !== undefined) {
      if (!PREFS.includes(pref)) throw new ApiError('validation', 'errors.invalid_preference');
      if (db.find('users', v.user.id)?.notification_pref !== pref) {
        db.batch(() => {
          db.update('users', v.user.id, { notification_pref: pref });
        });
      }
    }
    return currentViewer();
  },
};
