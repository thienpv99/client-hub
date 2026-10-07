// Accounts & people: create/update accounts, health override, AM assignment, contacts, client invites,
// and user administration (director).

import type { Account, Contact, DecisionRole, Health, ID, Role, Salutation, Stage, Tier, User } from '@/domain/types';
import { ApiError, type Api, type UserAdminView } from '@/services/contract';
import { nowISO } from '@/domain/clock';
import { t } from '@/i18n';
import { newId } from '@/lib/utils';
import { assertManagerOf, assertWritable, getViewer, isManagerOf, noAccess, requireViewer, toUserRef } from '@/services/context';
import { db } from '@/services/db';
import { logActivity, notifyUsers } from '@/services/effects';
import { accountDetail, contactView, fieldLabels, invalidateViewCache } from '@/services/views';
import { insertProject } from '@/services/api/roadmap';

const invalid = (key: string, details?: Record<string, unknown>): ApiError => new ApiError('validation', key, details);
const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');

const TIERS: readonly Tier[] = ['strategic', 'key', 'standard'];
const STAGES: readonly Stage[] = ['prospecting', 'negotiating', 'implementing', 'operating', 'paused'];
const HEALTHS: readonly Health[] = ['blocked', 'attention', 'on_track'];
const SALUTATIONS: readonly Salutation[] = ['anh', 'chị'];
const DECISION_ROLES: readonly DecisionRole[] = ['decision_maker', 'approver', 'ops_contact'];
const INTERNAL_ROLES: readonly Role[] = ['director', 'am', 'member'];
const CLIENT_ROLES: readonly Role[] = ['client_owner', 'client_member'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

export function normalizeDomain(domain: string): string {
  const d = (domain ?? '').trim().toLowerCase().replace(/^@+/, '');
  if (!DOMAIN_RE.test(d)) throw invalid('errors.invalid_domain');
  return d;
}

/** email format + company domain check (SPEC §2: invites only within the client's email domain) */
export function assertEmailInDomain(email: string, domain: string): void {
  if (!EMAIL_RE.test(email)) throw invalid('errors.invalid_email');
  if (!email.endsWith(`@${domain.toLowerCase()}`)) throw new ApiError('domain_mismatch', 'errors.domain_mismatch', { domain });
}

function liveUserByEmail(email: string): User | undefined {
  return db.rows('users').find((u) => u.email.toLowerCase() === email && u.status !== 'disabled');
}

export function userAdminView(u: User): UserAdminView {
  const account = u.account_id ? db.find('accounts', u.account_id) : undefined;
  return {
    ...toUserRef(u),
    account_id: u.account_id,
    account_name: account ? account.name : null,
    status: u.status,
    can_view_cost: u.role === 'director' || (u.role === 'am' && u.can_view_cost),
    last_login_at: u.last_login_at,
    invited_at: u.invited_at,
    notification_pref: u.notification_pref,
    auth_provider: u.auth_provider ?? null,
  };
}

/**
 * Create an invited client login + contact, send the invitation (bell + immediate email) and log it.
 * Call inside db.batch.
 */
export function createClientInvite(
  account: Account,
  input: { full_name: string; email: string; salutation: Salutation; title: string; role: 'client_owner' | 'client_member'; decision_role: DecisionRole },
  inviterId: ID,
): { user: User; contact: Contact } {
  const fullName = (input.full_name ?? '').trim();
  if (!fullName) throw invalid('errors.name_required');
  const email = normalizeEmail(input.email);
  assertEmailInDomain(email, account.email_domain);
  if (!SALUTATIONS.includes(input.salutation)) throw invalid('errors.salutation_required');
  if (!CLIENT_ROLES.includes(input.role)) throw invalid('errors.invalid_role');
  if (!DECISION_ROLES.includes(input.decision_role)) throw invalid('errors.invalid_decision_role');
  if (liveUserByEmail(email)) throw new ApiError('conflict', 'errors.email_exists');
  const at = nowISO();
  const user: User = {
    id: newId('u'),
    full_name: fullName,
    email,
    phone: null,
    org_type: 'client',
    account_id: account.id,
    role: input.role,
    can_view_cost: false,
    title: (input.title ?? '').trim() || null,
    salutation: input.salutation,
    avatar_url: null,
    notification_pref: 'all',
    onboarded_at: null,
    invited_at: at,
    invited_by: inviterId,
    last_login_at: null,
    status: 'invited',
    deleted_at: null,
  };
  db.insert('users', user);
  const existing = db.rows('contacts').find((c) => c.account_id === account.id && c.email.toLowerCase() === email);
  const contact = existing
    ? db.update('contacts', existing.id, { user_id: user.id })
    : db.insert('contacts', {
        id: newId('ct'),
        account_id: account.id,
        full_name: fullName,
        salutation: input.salutation,
        title: (input.title ?? '').trim(),
        decision_role: input.decision_role,
        email,
        phone: null,
        user_id: user.id,
        last_interaction_at: null,
        last_interaction_note: null,
        deleted_at: null,
      });
  const inviter = db.find('users', inviterId);
  notifyUsers(
    [user.id],
    {
      kind: 'system',
      title: t('activity.invite.title'),
      body: t('activity.invite.body', {
        inviter: inviter ? inviter.full_name : '',
        name: fullName,
        account: account.name,
      }),
      link: '/login',
      account_id: account.id,
    },
    { email: true, immediate: true },
  );
  logActivity({
    account_id: account.id,
    actor_id: inviterId,
    action: 'user.invited',
    target_type: 'user',
    target_id: user.id,
    params: { to: fullName, email },
    visibility: 'shared',
  });
  return { user, contact };
}

function findAccount(id: ID): Account {
  const v = getViewer();
  // clients: another company's account answers like an unknown id (no existence oracle on any mutation)
  if (v && v.org_type === 'client' && v.account_id !== id) throw noAccess(v);
  const account = db.find('accounts', id);
  if (!account) throw notFound();
  return account;
}

/** exec summary: at most 3 non-empty lines (SPEC §4.2) */
function normalizeSummary(text: string): string {
  const lines = (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 3) throw invalid('errors.exec_summary_lines');
  return lines.join('\n');
}

function assertDirector(): ReturnType<typeof requireViewer> {
  const v = requireViewer();
  assertWritable(v);
  if (v.org_type !== 'internal' || v.role !== 'director') throw forbidden();
  return v;
}

export const accountsApi: Pick<
  Api,
  | 'createAccount'
  | 'updateAccount'
  | 'overrideHealth'
  | 'assignAm'
  | 'inviteClientUser'
  | 'upsertContact'
  | 'listAllUsers'
  | 'setUserRole'
  | 'setUserCanViewCost'
  | 'inviteInternalUser'
> = {
  async createAccount(input) {
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'internal' || (v.role !== 'director' && v.role !== 'am')) throw forbidden();
    const c = input.company;
    const name = (c.name ?? '').trim();
    if (!name) throw invalid('errors.name_required');
    const domain = normalizeDomain(c.email_domain);
    if (!TIERS.includes(c.tier) || !STAGES.includes(c.stage)) throw invalid('errors.validation');
    const am = db.find('users', c.am_id);
    if (!am || am.org_type !== 'internal' || (am.role !== 'am' && am.role !== 'director') || am.status === 'disabled') {
      throw invalid('errors.invalid_am');
    }
    // an AM creates accounts for themself; the director assigns anyone
    if (v.role === 'am' && am.id !== v.user.id) throw forbidden();
    const at = nowISO();
    const { result } = db.batch(() => {
      const account: Account = {
        id: newId('acc'),
        name,
        short_name: (c.short_name ?? '').trim() || name,
        logo_url: c.logo_url,
        brand_color: c.brand_color || '#1D4ED8',
        industry: (c.industry ?? '').trim(),
        tier: c.tier,
        stage: c.stage,
        am_id: am.id,
        health_override: null,
        health_override_reason: null,
        health_override_by: null,
        health_override_at: null,
        exec_summary: '',
        exec_summary_updated_at: null,
        email_domain: domain,
        internal_notes: null,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('accounts', account);
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'account.created',
        target_type: 'account',
        target_id: account.id,
        params: { account: account.name },
        visibility: 'internal',
      });
      for (const contact of input.contacts ?? []) {
        if (contact.invite) {
          createClientInvite(
            account,
            {
              full_name: contact.full_name,
              email: contact.email,
              salutation: contact.salutation,
              title: contact.title,
              role: contact.decision_role === 'decision_maker' ? 'client_owner' : 'client_member',
              decision_role: contact.decision_role,
            },
            v.user.id,
          );
          const created = db.rows('contacts').find((x) => x.account_id === account.id && x.email === normalizeEmail(contact.email));
          if (created && contact.phone) db.update('contacts', created.id, { phone: contact.phone });
        } else {
          const fullName = (contact.full_name ?? '').trim();
          if (!fullName) throw invalid('errors.name_required');
          if (!SALUTATIONS.includes(contact.salutation)) throw invalid('errors.salutation_required');
          const email = normalizeEmail(contact.email);
          if (email && !EMAIL_RE.test(email)) throw invalid('errors.invalid_email');
          db.insert('contacts', {
            id: newId('ct'),
            account_id: account.id,
            full_name: fullName,
            salutation: contact.salutation,
            title: (contact.title ?? '').trim(),
            decision_role: DECISION_ROLES.includes(contact.decision_role) ? contact.decision_role : 'ops_contact',
            email,
            phone: contact.phone,
            user_id: null,
            last_interaction_at: null,
            last_interaction_note: null,
            deleted_at: null,
          });
        }
      }
      insertProject(
        account,
        { name: (input.project.name ?? '').trim() || account.short_name, start_date: input.project.start_date, template_id: input.project.template_id },
        v.user.id,
      );
      invalidateViewCache();
      return account;
    });
    return accountDetail(db.get('accounts', result.id), v);
  },

  async updateAccount(id, patch) {
    const v = requireViewer();
    assertWritable(v);
    const account = findAccount(id);
    assertManagerOf(v, id);
    const fields: Partial<Account> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw invalid('errors.name_required');
      fields.name = name;
    }
    if (patch.short_name !== undefined) fields.short_name = patch.short_name.trim() || fields.name || account.name;
    if (patch.industry !== undefined) fields.industry = patch.industry.trim();
    if (patch.tier !== undefined) {
      if (!TIERS.includes(patch.tier)) throw invalid('errors.validation');
      fields.tier = patch.tier;
    }
    if (patch.stage !== undefined) {
      if (!STAGES.includes(patch.stage)) throw invalid('errors.validation');
      fields.stage = patch.stage;
    }
    if (patch.logo_url !== undefined) fields.logo_url = patch.logo_url;
    if (patch.brand_color !== undefined) fields.brand_color = patch.brand_color;
    if (patch.email_domain !== undefined) fields.email_domain = normalizeDomain(patch.email_domain);
    if (patch.exec_summary !== undefined) fields.exec_summary = normalizeSummary(patch.exec_summary);
    if (patch.internal_notes !== undefined) fields.internal_notes = patch.internal_notes?.trim() || null;

    const before = account as unknown as Record<string, unknown>;
    const after = fields as unknown as Record<string, unknown>;
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    if (!changed.length) return accountDetail(account, v);
    const at = nowISO();
    const summaryChanged = changed.includes('exec_summary');
    const others = changed.filter((k) => k !== 'exec_summary');
    db.batch(() => {
      const update: Partial<Account> = { updated_at: at };
      for (const k of changed) (update as unknown as Record<string, unknown>)[k] = after[k];
      if (summaryChanged) update.exec_summary_updated_at = at;
      db.update('accounts', id, update);
      if (summaryChanged) {
        logActivity({
          account_id: id,
          actor_id: v.user.id,
          action: 'account.exec_summary_updated',
          target_type: 'account',
          target_id: id,
          params: { account: fields.name ?? account.name },
          visibility: 'shared',
        });
      }
      if (others.length) {
        logActivity({
          account_id: id,
          actor_id: v.user.id,
          action: 'account.updated',
          target_type: 'account',
          target_id: id,
          params: { account: fields.name ?? account.name, fields: fieldLabels(others) },
          visibility: 'internal',
        });
      }
    });
    return accountDetail(db.get('accounts', id), v);
  },

  async overrideHealth(id, health, reason) {
    const v = requireViewer();
    assertWritable(v);
    const account = findAccount(id);
    assertManagerOf(v, id);
    const why = (reason ?? '').trim();
    if (health !== null) {
      if (!HEALTHS.includes(health)) throw invalid('errors.validation');
      if (!why) throw invalid('errors.reason_required');
    }
    const at = nowISO();
    db.batch(() => {
      db.update('accounts', id, {
        health_override: health,
        health_override_reason: health === null ? null : why,
        health_override_by: health === null ? null : v.user.id,
        health_override_at: health === null ? null : at,
        updated_at: at,
      });
      logActivity(
        health === null
          ? {
              account_id: id,
              actor_id: v.user.id,
              action: 'account.updated',
              target_type: 'account',
              target_id: id,
              params: { account: account.name, fields: fieldLabels(['health_override']) },
              visibility: 'internal',
            }
          : {
              account_id: id,
              actor_id: v.user.id,
              action: 'account.health_overridden',
              target_type: 'account',
              target_id: id,
              params: { account: account.name, health, health_label: t(`enums.health.${health}`), reason: why },
              visibility: 'internal',
            },
      );
    });
    return accountDetail(db.get('accounts', id), v);
  },

  async assignAm(accountId, amId) {
    const v = assertDirector();
    const account = findAccount(accountId);
    const am = db.find('users', amId);
    if (!am || am.org_type !== 'internal' || (am.role !== 'am' && am.role !== 'director') || am.status === 'disabled') {
      throw invalid('errors.invalid_am');
    }
    if (account.am_id !== amId) {
      db.batch(() => {
        db.update('accounts', accountId, { am_id: amId, updated_at: nowISO() });
        logActivity({
          account_id: accountId,
          actor_id: v.user.id,
          action: 'account.am_assigned',
          target_type: 'account',
          target_id: accountId,
          params: { account: account.name, am: am.full_name },
          visibility: 'internal',
        });
      });
    }
    return accountDetail(db.get('accounts', accountId), v);
  },

  async inviteClientUser(accountId, input) {
    const v = requireViewer();
    assertWritable(v);
    // a client naming another company's account gets the same answer as for an unknown id (findAccount)
    const account = findAccount(accountId);
    const ownerOfAccount = v.org_type === 'client' && v.role === 'client_owner' && v.account_id === accountId;
    if (!isManagerOf(v, accountId) && !ownerOfAccount) throw forbidden();
    // a decision maker invites colleagues (SPEC §2); new decision makers — who get commercial access and quote
    // decisions — are added by New Era
    if (v.org_type === 'client' && (input.role !== 'client_member' || input.decision_role === 'decision_maker')) throw forbidden();
    const { result } = db.batch(() => createClientInvite(account, input, v.user.id));
    return contactView(db.get('contacts', result.contact.id), v);
  },

  async upsertContact(accountId, input) {
    const v = requireViewer();
    assertWritable(v);
    findAccount(accountId);
    assertManagerOf(v, accountId);
    const fullName = (input.full_name ?? '').trim();
    if (!fullName) throw invalid('errors.name_required');
    if (input.salutation !== undefined && !SALUTATIONS.includes(input.salutation)) throw invalid('errors.salutation_required');
    if (input.decision_role !== undefined && !DECISION_ROLES.includes(input.decision_role)) throw invalid('errors.invalid_decision_role');
    const email = input.email !== undefined ? normalizeEmail(input.email) : undefined;
    if (email && !EMAIL_RE.test(email)) throw invalid('errors.invalid_email');

    const { result } = db.batch(() => {
      let contact: Contact;
      if (input.id) {
        const existing = db.find('contacts', input.id);
        if (!existing || existing.account_id !== accountId) throw notFound();
        const fields: Partial<Contact> = { full_name: fullName };
        if (input.salutation !== undefined) fields.salutation = input.salutation;
        if (input.title !== undefined) fields.title = (input.title ?? '').trim();
        if (input.decision_role !== undefined) fields.decision_role = input.decision_role;
        if (email !== undefined) fields.email = email;
        if (input.phone !== undefined) fields.phone = input.phone?.trim() || null;
        if (input.last_interaction_at !== undefined) fields.last_interaction_at = input.last_interaction_at;
        if (input.last_interaction_note !== undefined) fields.last_interaction_note = input.last_interaction_note?.trim() || null;
        contact = db.update('contacts', existing.id, fields);
      } else {
        if (!input.salutation) throw invalid('errors.salutation_required');
        contact = db.insert('contacts', {
          id: newId('ct'),
          account_id: accountId,
          full_name: fullName,
          salutation: input.salutation,
          title: (input.title ?? '').trim(),
          decision_role: input.decision_role ?? 'ops_contact',
          email: email ?? '',
          phone: input.phone?.trim() || null,
          user_id: null,
          last_interaction_at: input.last_interaction_at ?? null,
          last_interaction_note: input.last_interaction_note?.trim() || null,
          deleted_at: null,
        });
      }
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'contact.updated',
        target_type: 'contact',
        target_id: contact.id,
        params: { name: contact.full_name },
        visibility: 'internal',
      });
      return contact;
    });
    return contactView(db.get('contacts', result.id), v);
  },

  async listAllUsers() {
    const v = requireViewer();
    if (v.org_type !== 'internal' || v.role !== 'director') throw forbidden();
    const orgOrder = (u: User): number => (u.org_type === 'internal' ? 0 : 1);
    return db
      .rows('users')
      .slice()
      .sort(
        (a, b) =>
          orgOrder(a) - orgOrder(b) ||
          (a.account_id ?? '').localeCompare(b.account_id ?? '') ||
          a.full_name.localeCompare(b.full_name, 'vi'),
      )
      .map(userAdminView);
  },

  async setUserRole(userId, role) {
    const v = assertDirector();
    const user = db.find('users', userId);
    if (!user) throw notFound();
    if (user.id === v.user.id) throw invalid('errors.cannot_change_self');
    const allowed = user.org_type === 'internal' ? INTERNAL_ROLES : CLIENT_ROLES;
    if (!allowed.includes(role)) throw invalid('errors.invalid_role');
    if (user.role !== role) {
      db.batch(() => {
        db.update('users', userId, {
          role,
          can_view_cost: role === 'director' ? true : role === 'am' ? user.can_view_cost : false,
        });
        logActivity({
          account_id: user.account_id,
          actor_id: v.user.id,
          action: 'user.role_changed',
          target_type: 'user',
          target_id: userId,
          params: { to: user.full_name, role },
          visibility: 'internal',
        });
      });
    }
    return userAdminView(db.get('users', userId));
  },

  async setUserCanViewCost(userId, allowed) {
    const v = assertDirector();
    const user = db.find('users', userId);
    if (!user) throw notFound();
    if (user.role !== 'am') throw invalid('errors.cost_am_only');
    if (user.can_view_cost !== allowed) {
      db.batch(() => {
        db.update('users', userId, { can_view_cost: allowed });
        logActivity({
          account_id: null,
          actor_id: v.user.id,
          action: 'user.role_changed',
          target_type: 'user',
          target_id: userId,
          params: { to: user.full_name, role: user.role, can_view_cost: allowed ? 1 : 0 },
          visibility: 'internal',
        });
      });
    }
    return userAdminView(db.get('users', userId));
  },

  async inviteInternalUser(input) {
    const v = assertDirector();
    const fullName = (input.full_name ?? '').trim();
    if (!fullName) throw invalid('errors.name_required');
    const email = normalizeEmail(input.email);
    const domain = v.user.email.split('@')[1] ?? '';
    if (domain) assertEmailInDomain(email, domain);
    else if (!EMAIL_RE.test(email)) throw invalid('errors.invalid_email');
    if (!INTERNAL_ROLES.includes(input.role)) throw invalid('errors.invalid_role');
    if (liveUserByEmail(email)) throw new ApiError('conflict', 'errors.email_exists');
    const at = nowISO();
    const { result } = db.batch(() => {
      const user: User = {
        id: newId('u'),
        full_name: fullName,
        email,
        phone: null,
        org_type: 'internal',
        account_id: null,
        role: input.role,
        can_view_cost: input.role === 'director',
        title: (input.title ?? '').trim() || null,
        salutation: null,
        avatar_url: null,
        notification_pref: 'all',
        onboarded_at: null,
        invited_at: at,
        invited_by: v.user.id,
        last_login_at: null,
        status: 'invited',
        deleted_at: null,
      };
      db.insert('users', user);
      notifyUsers(
        [user.id],
        {
          kind: 'system',
          title: t('activity.invite.internal_title'),
          body: t('activity.invite.internal_body', { inviter: v.user.full_name, name: fullName }),
          link: '/login',
          account_id: null,
        },
        { email: true, immediate: true },
      );
      logActivity({
        account_id: null,
        actor_id: v.user.id,
        action: 'user.invited',
        target_type: 'user',
        target_id: user.id,
        params: { to: fullName, email },
        visibility: 'internal',
      });
      return user;
    });
    return userAdminView(db.get('users', result.id));
  },
};
