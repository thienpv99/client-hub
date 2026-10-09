// "Quan hệ" (SPEC-CARE §6.4) — replaces the old "Liên hệ" tab (`/contacts` redirects here).
// Director / AM: "Điểm cần chú ý" (the few sentences that matter), the relationship map (who at New Era holds whom,
// how close, reports-to lines, sister companies of the group), the links inside the group as sentences, then the
// people with their relationship fields and the contact actions (add, edit, invite, edit relationship, log a touch).
// Phones: the people come before the map, which scrolls sideways.
// Members: the contact list only (the api returns no relationship data to them — SPEC-CARE §5).
// `?contact=<contactId>` opens that person's relationship sheet.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Users } from 'lucide-react';
import type { AccountDetail, UserRef } from '@/services/contract';
import type { AccountCareView, RelationView, StakeholderView } from '@/services/careContract';
import { api } from '@/services/api';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import type { QueryResult } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import type { AccountAccess } from '../accountAccess';
import { CareErrorCard } from '../care/careParts';
import { ContactsTab } from './ContactsTab';
import { GroupRelations } from './relationships/GroupRelations';
import type { MapInput, NePerson } from './relationships/mapLayout';
import { RelationInsights } from './relationships/RelationInsights';
import { RelationshipMap } from './relationships/RelationshipMap';
import { RelationSheet } from './relationships/RelationSheet';
import { StakeholderSheet } from './relationships/StakeholderSheet';

/** at most this many New Era teammates who hold no relationship yet are drawn (they show who could) */
const MAX_IDLE_TEAM = 3;

function newEraPeople(am: UserRef, people: StakeholderView[], team: UserRef[]): NePerson[] {
  const out = new Map<string, NePerson>();
  const roleOf = (u: UserRef): NePerson['role'] => (u.id === am.id ? 'am' : u.role === 'director' ? 'director' : 'member');
  out.set(am.id, { user: am, role: 'am' });
  for (const p of people) if (p.ne_owner && !out.has(p.ne_owner.id)) out.set(p.ne_owner.id, { user: p.ne_owner, role: roleOf(p.ne_owner) });
  let idle = 0;
  for (const u of team) {
    if (out.has(u.id) || idle >= MAX_IDLE_TEAM) continue;
    out.set(u.id, { user: u, role: roleOf(u) });
    idle += 1;
  }
  return [...out.values()];
}

function MapSkeleton() {
  return (
    <div className="skeleton-reveal grid grid-cols-[1fr_1.4fr_1fr] gap-8 py-2" aria-hidden="true">
      <div className="space-y-3 pt-16">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-3 pt-10">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export interface RelationshipsTabProps {
  account: AccountDetail;
  access: AccountAccess;
  care: QueryResult<AccountCareView>;
}

export function RelationshipsTab({ account, access, care }: RelationshipsTabProps) {
  const [params, setParams] = useSearchParams();
  const mobile = useBreakpoint() === 'mobile';
  const data = care.data;
  const people = data?.stakeholders ?? null;
  const relations = data?.relations ?? null;
  // New Era teammates working on the account (internal assignees of open tasks), for the left column of the map
  const portfolio = useQuery(() => api.listProjectPortfolio(), [], { enabled: access.care });
  const team = useMemo(() => {
    const seen = new Map<string, UserRef>();
    for (const row of portfolio.data ?? []) {
      if (row.account.id !== account.id) continue;
      for (const u of row.team) if (u.org_type === 'internal') seen.set(u.id, u);
    }
    return [...seen.values()];
  }, [portfolio.data, account.id]);

  const mapInput: MapInput | null = useMemo(
    () => (people && relations ? { accountId: account.id, people, ne: newEraPeople(account.am, people, team), relations } : null),
    [account.id, account.am, people, relations, team],
  );

  // relationship sheet (?contact=) — keep the last person while the drawer slides out
  const contactParam = params.get('contact');
  const person = people && contactParam ? (people.find((p) => p.contact_id === contactParam) ?? null) : null;
  const lastPerson = useRef<StakeholderView | null>(null);
  if (person) lastPerson.current = person;
  const setContact = useCallback(
    (id: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === null) next.delete('contact');
          else next.set('contact', id);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const [relationPanel, setRelationPanel] = useState<{ open: boolean; relation: RelationView | null }>({ open: false, relation: null });

  // members get the plain list: a search hit's ?contact= scrolls to that person there
  if (!access.care) return <ContactsTab account={account} focusId={contactParam} />;

  const canManage = !!data?.can_manage;
  const ecosystem = data?.account.ecosystem ?? null;

  const insights = people ? (
    <RelationInsights people={people} decisionMaker={data?.key_people?.decision_maker ?? null} cadenceDays={data?.care?.plan.cadence_days ?? null} />
  ) : care.error ? (
    <CareErrorCard error={care.error} onRetry={care.refetch} />
  ) : (
    <CardSkeleton lines={3} />
  );

  const map =
    care.error && !data ? null : (
      <SectionCard
        title={t('careAccount.relationships.map.title')}
        description={t('careAccount.relationships.map.description')}
        actions={
          canManage ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setRelationPanel({ open: true, relation: null })} className="text-primary hover:text-primary-hover">
              <Link2 aria-hidden="true" />
              {t('careAccount.relationships.group.add')}
            </Button>
          ) : null
        }
      >
        {!mapInput ? (
          <MapSkeleton />
        ) : mapInput.people.length === 0 ? (
          <EmptyState compact icon={Users} title={t('careAccount.relationships.map.empty')} description={t('careAccount.relationships.map.emptyHint')} />
        ) : (
          <RelationshipMap
            accountId={account.id}
            accountShortName={account.short_name || account.name}
            input={mapInput}
            onSelectPerson={canManage ? (id) => setContact(id) : undefined}
          />
        )}
      </SectionCard>
    );

  const group =
    relations && (relations.length > 0 || ecosystem) ? (
      <GroupRelations
        accountId={account.id}
        ecosystem={ecosystem}
        relations={relations}
        canAdd={canManage}
        onAdd={() => setRelationPanel({ open: true, relation: null })}
        onEdit={(r) => setRelationPanel({ open: true, relation: r })}
      />
    ) : null;

  const list = <ContactsTab account={account} stakeholders={people} onEditRelation={canManage ? (id) => setContact(id) : undefined} />;

  return (
    <div className="space-y-6 md:space-y-8">
      {insights}
      {mobile ? (
        <>
          {list}
          {map}
          {group}
        </>
      ) : (
        <>
          {map}
          {group}
          {list}
        </>
      )}

      {canManage && people ? (
        <StakeholderSheet
          person={person ?? lastPerson.current}
          people={people}
          open={!!person}
          onOpenChange={(o) => {
            if (!o) setContact(null);
          }}
        />
      ) : null}
      {canManage ? (
        <RelationSheet
          account={account}
          ecosystemId={ecosystem?.id ?? null}
          relation={relationPanel.relation}
          open={relationPanel.open}
          onOpenChange={(o) => setRelationPanel((p) => ({ ...p, open: o }))}
        />
      ) : null}
    </div>
  );
}
