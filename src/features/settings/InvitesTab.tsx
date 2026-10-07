// "Mời khách": invite a client user into the portal (email locked to the account's domain) and see who has not
// signed in yet. Director: every account; AM: the accounts they manage (the api scopes the list).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, MailCheck, Send } from 'lucide-react';
import type { DecisionRole, Salutation } from '@/domain/types';
import type { AccountSummary, ContactView, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { t } from '@/i18n';
import { emailLocalProblem, fullEmail } from './emailRules';
import { CHOICE_CARD, CHOICE_CARD_OFF, CHOICE_CARD_ON, DomainEmailInput, GroupField, SalutationToggle } from './fieldParts';

type ClientRole = 'client_owner' | 'client_member';
type MemberContactRole = Exclude<DecisionRole, 'decision_maker'>;

interface ClientInviteForm {
  full_name: string;
  email: string;
  salutation: Salutation | '';
  title: string;
  role: ClientRole;
  member_role: MemberContactRole;
}

const EMPTY: ClientInviteForm = { full_name: '', email: '', salutation: '', title: '', role: 'client_member', member_role: 'ops_contact' };
const CLIENT_ROLES: ClientRole[] = ['client_owner', 'client_member'];
const MEMBER_CONTACT_ROLES: MemberContactRole[] = ['ops_contact', 'approver'];

interface PendingInvite {
  account: AccountSummary;
  contact: ContactView;
}

async function loadInvites(): Promise<{ accounts: AccountSummary[]; pending: PendingInvite[] }> {
  const accounts = (await api.listAccounts()).slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const contacts = await Promise.all(accounts.map((a) => api.listContacts(a.id)));
  return {
    accounts,
    pending: accounts.flatMap((account, i) =>
      (contacts[i] ?? []).filter((c) => c.user?.status === 'invited').map((contact) => ({ account, contact })),
    ),
  };
}

export function InvitesTab({ viewer }: { viewer: Viewer }) {
  const { data, loading, error, refetch } = useQuery(loadInvites, []);
  const [params, setParams] = useSearchParams();
  const { run, pending } = useAction();
  const [form, setForm] = useState<ClientInviteForm>(EMPTY);
  const [attempted, setAttempted] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton lines={6} />
        <ListSkeleton rows={2} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const accounts = data?.accounts ?? [];
  if (accounts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title={t('settings.invites.noAccounts')}
          action={
            <Button asChild variant="secondary">
              <Link to="/app/accounts/new">{t('settings.invites.createAccount')}</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const requested = params.get('account');
  const selected = accounts.find((a) => a.id === requested) ?? accounts[0];
  if (!selected) return null;
  const domain = selected.email_domain;
  const canInvite = !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');

  const nameError = form.full_name.trim() ? null : t('settings.invites.nameRequired');
  const emailProblem = emailLocalProblem(form.email, true);
  const emailError = emailProblem ? t(emailProblem, { domain }) : null;
  const salutationError = form.salutation ? null : t('settings.salutation.required');
  const show = (msg: string | null) => (attempted ? msg : null);

  const set = (p: Partial<ClientInviteForm>) => setForm((f) => ({ ...f, ...p }));

  function selectAccount(id: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('account', id);
        return next;
      },
      { replace: true },
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canInvite || !selected) return;
    setAttempted(true);
    if (nameError || emailError || salutationError || !form.salutation) {
      const first = nameError ? 'invite-name' : emailError ? 'invite-email' : 'invite-salutation';
      const el = document.getElementById(first);
      (el?.querySelector<HTMLElement>('button') ?? el)?.focus();
      return;
    }
    const name = form.full_name.trim();
    const email = fullEmail(form.email, domain);
    const created = await run(
      () =>
        api.inviteClientUser(selected.id, {
          full_name: name,
          email,
          salutation: form.salutation as Salutation,
          title: form.title.trim(),
          role: form.role,
          decision_role: form.role === 'client_owner' ? 'decision_maker' : form.member_role,
        }),
      { success: 'settings.invites.toast', successParams: { name, email } },
    );
    if (created) {
      setForm((f) => ({ ...EMPTY, role: f.role, member_role: f.member_role }));
      setAttempted(false);
    }
  }

  // the selected account's invitations first, then the others
  const invites = (data?.pending ?? [])
    .slice()
    .sort((a, b) => Number(b.account.id === selected.id) - Number(a.account.id === selected.id));

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <SectionCard
          as="h3"
          title={t('settings.invites.formTitle')}
          contentClassName="space-y-5"
          footer={
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption">{t('settings.invites.after')}</p>
              <Button type="submit" loading={pending} disabled={!canInvite} className="w-full sm:w-auto">
                {!pending ? <Send aria-hidden="true" /> : null}
                {t('settings.invites.submit')}
              </Button>
            </div>
          }
        >
          <FormField label={t('settings.invites.account')} htmlFor="invite-account" hint={t('settings.invites.domainHint', { domain })}>
            <NativeSelect id="invite-account" value={selected.id} onChange={(e) => selectAccount(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={t('settings.invites.name')} htmlFor="invite-name" required error={show(nameError)}>
              <Input
                id="invite-name"
                autoComplete="off"
                value={form.full_name}
                disabled={!canInvite}
                placeholder={t('settings.invites.namePlaceholder')}
                onChange={(e) => set({ full_name: e.target.value })}
              />
            </FormField>
            <GroupField id="invite-salutation" label={t('settings.salutation.label')} required error={show(salutationError)}>
              {(a11y) => (
                <SalutationToggle
                  id="invite-salutation"
                  value={form.salutation}
                  disabled={!canInvite}
                  a11y={a11y}
                  onChange={(salutation) => set({ salutation })}
                />
              )}
            </GroupField>
            <FormField label={t('settings.invites.email')} htmlFor="invite-email" required error={show(emailError)}>
              <DomainEmailInput
                id="invite-email"
                domain={domain}
                value={form.email}
                disabled={!canInvite}
                placeholder={t('settings.invites.emailPlaceholder')}
                onValueChange={(email) => set({ email })}
              />
            </FormField>
            <FormField label={t('settings.invites.jobTitle')} htmlFor="invite-title">
              <Input
                id="invite-title"
                autoComplete="off"
                value={form.title}
                disabled={!canInvite}
                placeholder={t('settings.invites.jobTitlePlaceholder')}
                onChange={(e) => set({ title: e.target.value })}
              />
            </FormField>
          </div>

          <GroupField id="invite-role" label={t('settings.invites.role')}>
            {(a11y) => (
              <RadioGroup
                value={form.role}
                disabled={!canInvite}
                onValueChange={(v: string) => {
                  if (v === 'client_owner' || v === 'client_member') set({ role: v });
                }}
                aria-labelledby={a11y.labelId}
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {CLIENT_ROLES.map((r) => (
                  <label key={r} htmlFor={`invite-role-${r}`} className={cn(CHOICE_CARD, form.role === r ? CHOICE_CARD_ON : CHOICE_CARD_OFF)}>
                    <RadioGroupItem id={`invite-role-${r}`} value={r} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-table font-medium text-foreground">{t(`enums.role.${r}`)}</span>
                      <span className="mt-0.5 block text-caption">{t(`settings.invites.roleHint.${r}`)}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </GroupField>

          {form.role === 'client_member' ? (
            <FormField
              label={t('settings.invites.contactRole')}
              htmlFor="invite-contact-role"
              hint={t('settings.invites.contactRoleHint')}
              className="sm:max-w-xs"
            >
              <NativeSelect
                id="invite-contact-role"
                value={form.member_role}
                disabled={!canInvite}
                onChange={(e) => set({ member_role: e.target.value as MemberContactRole })}
              >
                {MEMBER_CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`enums.decisionRole.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
        </SectionCard>
      </form>

      <SectionCard
        as="h3"
        title={
          <span className="inline-flex items-center gap-2">
            {t('settings.invites.pendingTitle')}
            {invites.length > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
                <span aria-hidden="true">{invites.length}</span>
                <span className="sr-only">{t('settings.invites.pendingCount', { count: invites.length })}</span>
              </span>
            ) : null}
          </span>
        }
        description={t('settings.invites.pendingDescription')}
        divided={invites.length > 0}
      >
        {invites.length === 0 ? (
          <EmptyState compact icon={MailCheck} title={t('settings.invites.pendingEmpty')} />
        ) : (
          invites.map(({ account, contact: c }) => (
            <div key={c.id} className="flex items-center gap-3">
              <UserAvatar user={c.user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-table font-semibold text-foreground">{c.full_name}</p>
                <p className="truncate text-caption">{c.email}</p>
                <p className="truncate text-micro text-muted-foreground sm:hidden">
                  {[account.short_name || account.name, t(`enums.decisionRole.${c.decision_role}`)].join(t('common.separator'))}
                </p>
              </div>
              <div className="hidden min-w-0 max-w-[45%] flex-col items-end gap-0.5 sm:flex">
                <span className="flex min-w-0 max-w-full items-center gap-1.5 text-table text-foreground">
                  <AccountLogo account={account} size="xs" />
                  <span className="truncate">{account.short_name || account.name}</span>
                </span>
                <span className="text-micro text-muted-foreground">{t(`enums.decisionRole.${c.decision_role}`)}</span>
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
