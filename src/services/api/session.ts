// Session: demo logins, client OTP, internal password, "Xem như khách hàng", onboarding, preferences.

import type { ID, NotificationPref, Role, User } from '@/domain/types';
import { ApiError, type Api, type DemoLogin, type Viewer } from '@/services/contract';
import { nowISO } from '@/domain/clock';
import { assertWritable, getSession, getViewer, isManagerOf, requireViewer, setSession, toUserRef } from '@/services/context';
import { db } from '@/services/db';

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

export const sessionApi: Pick<
  Api,
  | 'listDemoLogins'
  | 'loginDemo'
  | 'requestOtp'
  | 'verifyOtp'
  | 'loginWithPassword'
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
