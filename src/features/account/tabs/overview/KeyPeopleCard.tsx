// "Quan hệ chính" (SPEC-CARE §6.4): the client's decision maker and the strongest champion — how close New Era is to
// each (strength) and who at New Era holds the relationship. One row when the same person is both.
import { Mail, Phone } from 'lucide-react';
import type { StakeholderView } from '@/services/careContract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { StrengthBadge } from '@/components/care/badges';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { shortPersonName } from '@/features/dashboard/portfolioModel';
import { telHref } from '../../contactParts';
import { TabLink } from './TabLink';

function PersonRow({ person, roles }: { person: StakeholderView; roles: string[] }) {
  const c = person.contact;
  return (
    <li className="flex items-start gap-3 py-3 pl-4 pr-2 sm:pl-5 sm:pr-3">
      <UserAvatar user={{ full_name: c.full_name, avatar_url: null, org_type: 'client' }} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-micro font-medium text-muted-foreground">{roles.join(t('common.separator'))}</p>
        <p className="truncate text-table font-semibold text-ink" title={c.full_name}>
          {c.full_name}
        </p>
        {c.title ? <p className="truncate text-caption">{c.title}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StrengthBadge strength={person.strength} />
          {person.ne_owner ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-micro text-muted-foreground">
              <UserAvatar user={person.ne_owner} size="xs" />
              <span className="truncate" title={person.ne_owner.full_name}>
                {t('careAccount.overview.people.holder', { name: shortPersonName(person.ne_owner.full_name) })}
              </span>
            </span>
          ) : (
            <span className="text-micro font-medium text-warning">{t('careAccount.overview.people.noHolder')}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {c.phone ? (
          <Button asChild variant="ghost" size="icon-sm">
            <a href={telHref(c.phone)} aria-label={t('account.contacts.call', { name: c.full_name, phone: c.phone })} title={c.phone}>
              <Phone aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        {c.email ? (
          <Button asChild variant="ghost" size="icon-sm">
            <a href={`mailto:${c.email}`} aria-label={t('account.contacts.mail', { name: c.full_name, email: c.email })} title={c.email}>
              <Mail aria-hidden="true" />
            </a>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export interface KeyPeopleCardProps {
  accountId: string;
  keyPeople: { decision_maker: StakeholderView | null; champion: StakeholderView | null };
  /** every person of the account: the other decision makers are listed too (often the riskiest relationship) */
  people?: StakeholderView[];
  peopleCount: number;
  className?: string;
}

export function KeyPeopleCard({ accountId, keyPeople, people = [], peopleCount, className }: KeyPeopleCardProps) {
  const dm = keyPeople.decision_maker;
  const champion = keyPeople.champion;
  const same = !!dm && !!champion && dm.contact_id === champion.contact_id;
  const dmLabel = t('careAccount.overview.people.decisionMaker');
  const championLabel = t('careAccount.overview.people.champion');
  const otherDeciders = people.filter(
    (p) => p.influence === 'decision_maker' && p.contact_id !== dm?.contact_id && p.contact_id !== (same ? null : champion?.contact_id),
  );
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('careAccount.overview.people.title')}
      flush
      footer={
        <TabLink accountId={accountId} tab="relationships">
          {t('careAccount.overview.people.all', { count: peopleCount })}
        </TabLink>
      }
    >
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {dm ? (
          <PersonRow person={dm} roles={same ? [dmLabel, championLabel] : [dmLabel]} />
        ) : (
          <li className="px-4 py-3 text-table text-muted-foreground sm:px-5">{t('careAccount.overview.people.noDecisionMaker')}</li>
        )}
        {otherDeciders.map((p) => (
          <PersonRow key={p.contact_id} person={p} roles={[dmLabel]} />
        ))}
        {same ? null : champion ? (
          <PersonRow person={champion} roles={[championLabel]} />
        ) : (
          <li className="px-4 py-3 sm:px-5">
            <p className="text-table font-medium text-foreground">{t('careAccount.overview.people.noChampion')}</p>
            <p className="mt-0.5 text-caption">{t('careAccount.overview.people.noChampionHint')}</p>
          </li>
        )}
      </ul>
    </SectionCard>
  );
}
