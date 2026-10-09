// Client people (SPEC §4.2, moved into "Quan hệ" by SPEC-CARE §6.4): name, title, salutation, decision role, login
// status, last interaction — and, for the director / AM, the relationship fields (stakeholder). Managers edit
// contacts, invite them (company email domain only) and edit the relationship.
import { useEffect, useState } from 'react';
import { Send, UserPlus, Users } from 'lucide-react';
import type { AccountDetail, ContactView } from '@/services/contract';
import type { StakeholderView } from '@/services/careContract';
import { t } from '@/i18n';
import { jumpScrollTo } from '@/hooks/useMotion';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { useAccountAccess } from '../accountAccess';
import { ContactCard } from './contacts/ContactCard';
import { ContactSheet } from './contacts/ContactSheet';
import { InviteSheet } from './contacts/InviteSheet';

export interface ContactsTabProps {
  account: AccountDetail;
  /** director / AM: relationship data per contact (order = the api's: decision role, then closeness) */
  stakeholders?: StakeholderView[] | null;
  onEditRelation?: (contactId: string) => void;
  /**
   * `?contact=<id>` on the plain list (members, review QA-L6): scroll that person's card into view and ring it for a
   * moment — the director / AM open the relationship sheet instead
   */
  focusId?: string | null;
}

type Panel = { kind: 'edit'; contact: ContactView | null } | { kind: 'invite'; contact: ContactView | null } | null;

export function ContactsTab({ account, stakeholders = null, onEditRelation, focusId = null }: ContactsTabProps) {
  const access = useAccountAccess(account);
  const [ringed, setRinged] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId || !account.contacts.some((c) => c.id === focusId)) return;
    const el = document.getElementById(`contact-${focusId}`);
    if (!el) return;
    // under the sticky top bar and the tab strip (the card's scroll-mt-40 margin)
    jumpScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - 160));
    setRinged(focusId);
    const id = window.setTimeout(() => setRinged(null), 2400);
    return () => window.clearTimeout(id);
  }, [focusId, account.contacts]);
  const [panel, setPanel] = useState<Panel>(null);
  // keep the last panel's content while its drawer closes
  const [last, setLast] = useState<Exclude<Panel, null>>({ kind: 'edit', contact: null });
  const byContact = new Map((stakeholders ?? []).map((s) => [s.contact_id, s]));
  const rank = new Map((stakeholders ?? []).map((s, i) => [s.contact_id, i]));
  const contacts = stakeholders
    ? account.contacts.slice().sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
    : account.contacts;
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
    <section aria-labelledby="account-people-title" className="space-y-4">
      {contacts.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 id="account-people-title" className="flex items-center gap-2 text-heading font-semibold tracking-tightish text-ink">
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
      ) : (
        <h2 id="account-people-title" className="sr-only">
          {t('account.contacts.title')}
        </h2>
      )}

      {contacts.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Users} title={t('account.contacts.empty')} description={t('account.contacts.emptyHint')} action={actions(false)} />
        </SectionCard>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {contacts.map((c) => {
            const s = byContact.get(c.id) ?? null;
            const manager = s?.reports_to_contact_id ? account.contacts.find((x) => x.id === s.reports_to_contact_id) : undefined;
            return (
              <ContactCard
                key={c.id}
                contact={c}
                canManage={access.manage}
                onEdit={(contact) => open({ kind: 'edit', contact })}
                onInvite={(contact) => open({ kind: 'invite', contact })}
                stakeholder={s}
                reportsToName={manager ? manager.full_name : null}
                onEditRelation={onEditRelation ? (contact) => onEditRelation(contact.id) : undefined}
                className={ringed === c.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background transition-shadow duration-200' : undefined}
              />
            );
          })}
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
    </section>
  );
}
