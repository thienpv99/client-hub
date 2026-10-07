// Client contacts (SPEC §4.2 "Tab Liên hệ"): name, title, salutation, decision role, login status, last interaction.
// Managers edit contacts and invite them (company email domain only).
import { useState } from 'react';
import { Send, UserPlus, Users } from 'lucide-react';
import type { AccountDetail, ContactView } from '@/services/contract';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { useAccountAccess } from '../accountAccess';
import { ContactCard } from './contacts/ContactCard';
import { ContactSheet } from './contacts/ContactSheet';
import { InviteSheet } from './contacts/InviteSheet';

export interface ContactsTabProps {
  account: AccountDetail;
}

type Panel = { kind: 'edit'; contact: ContactView | null } | { kind: 'invite'; contact: ContactView | null } | null;

export function ContactsTab({ account }: ContactsTabProps) {
  const access = useAccountAccess(account);
  const [panel, setPanel] = useState<Panel>(null);
  // keep the last panel's content while its drawer closes
  const [last, setLast] = useState<Exclude<Panel, null>>({ kind: 'edit', contact: null });
  const contacts = account.contacts;
  const active = contacts.filter((c) => c.user?.status === 'active').length;
  const invited = contacts.filter((c) => c.user?.status === 'invited').length;
  const noLogin = contacts.filter((c) => !c.user).length;

  function open(next: Exclude<Panel, null>) {
    setLast(next);
    setPanel(next);
  }

  function actions(toolbar: boolean) {
    if (!access.manage) return null;
    const size = toolbar ? 'sm' : 'default';
    return (
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size={size} onClick={() => open({ kind: 'edit', contact: null })} className="flex-1 sm:flex-none">
          <UserPlus aria-hidden="true" />
          {t('account.contacts.add')}
        </Button>
        <Button
          type="button"
          variant={toolbar ? 'default' : 'secondary'}
          size={size}
          onClick={() => open({ kind: 'invite', contact: null })}
          className="flex-1 sm:flex-none"
        >
          <Send aria-hidden="true" />
          {t('account.contacts.inviteNew')}
        </Button>
      </div>
    );
  }

  const current = panel ?? last;

  return (
    <div className="space-y-4">
      {contacts.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-heading font-semibold tracking-tightish text-ink">
              {t('account.contacts.title')}
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
                {contacts.length}
              </span>
            </h2>
            <p className="mt-0.5 text-caption">
              {[
                active > 0 ? t('account.contacts.countActive', { count: active }) : null,
                invited > 0 ? t('account.contacts.countInvited', { count: invited }) : null,
                noLogin > 0 ? t('account.contacts.countNoLogin', { count: noLogin }) : null,
                t('account.contacts.domainLine', { domain: account.email_domain }),
              ]
                .filter((x): x is string => x !== null)
                .join(t('common.separator'))}
            </p>
          </div>
          {actions(true)}
        </div>
      ) : null}

      {contacts.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Users} title={t('account.contacts.empty')} description={t('account.contacts.emptyHint')} action={actions(false)} />
        </SectionCard>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              canManage={access.manage}
              onEdit={(contact) => open({ kind: 'edit', contact })}
              onInvite={(contact) => open({ kind: 'invite', contact })}
            />
          ))}
        </ul>
      )}

      {access.manage ? (
        <>
          <ContactSheet
            account={account}
            contact={current.kind === 'edit' ? current.contact : null}
            open={panel?.kind === 'edit'}
            onOpenChange={(o) => {
              if (!o) setPanel(null);
            }}
          />
          <InviteSheet
            account={account}
            contact={current.kind === 'invite' ? current.contact : null}
            open={panel?.kind === 'invite'}
            onOpenChange={(o) => {
              if (!o) setPanel(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
