// Account detail tab "Bán hàng" (wired by the integrator): the account's deals as a divided list (main 2/3) and its
// CRM interactions (side 1/3 on xl).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, MessageSquarePlus, Plus } from 'lucide-react';
import type { AccountRef } from '@/services/contract';
import type { OpportunityView } from '@/services/crmContract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatMoneyCompact, formatPercent } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { crmPaths, isOpenStage, STAGE_ORDER } from '@/components/crm/crmLabels';
import { CreateOpportunityDialog } from '@/components/crm/CreateOpportunityDialog';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { LogInteractionDialog } from '@/components/crm/LogInteractionDialog';
import { OpportunityStageBadge } from '@/components/crm/OpportunityStageBadge';
import { CloseDateLine, NextStepLine } from './pipeline/OpportunityCard';
import { sumValue, sumWeighted } from './crmModel';

function DealRow({ o, today }: { o: OpportunityView; today: string }) {
  const open = isOpenStage(o.stage);
  return (
    <div className="relative flex min-w-0 flex-col gap-2 transition-colors hover:bg-subtle focus-within:bg-subtle sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={crmPaths.opportunity(o.id)}
            className="min-w-0 text-table font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
          >
            {o.name}
          </Link>
          <OpportunityStageBadge stage={o.stage} />
        </div>
        {open ? (
          <NextStepLine opp={o} today={today} />
        ) : o.lost_reason ? (
          <p className={cn('line-clamp-2 text-muted-foreground', SMALL)}>{t('crm.list.lostReason', { reason: o.lost_reason })}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
            <UserAvatar user={o.owner} size="xs" />
            {o.owner.full_name}
          </span>
          {open ? <CloseDateLine opp={o} today={today} compact /> : null}
        </div>
      </div>
      <p className="shrink-0 tabular sm:text-right">
        <span className="text-body font-semibold text-ink">{formatMoneyCompact(o.value)}</span>
        {/* the weighted value means something only while the deal is open (a closed one is 100 % or 0 %) */}
        {open ? (
          <span className="ml-1.5 text-micro text-muted-foreground sm:ml-0 sm:block">
            {t('crm.list.weightedLine', { weighted: formatMoneyCompact(o.weighted_value), pct: formatPercent(o.probability) })}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-4" aria-hidden="true">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </>
  );
}

export function AccountSalesTab({ account }: { account: AccountRef }) {
  const today = todayISO();
  const [createOpen, setCreateOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const opps = useQuery(() => api.listOpportunities({ accountId: account.id }), [account.id]);
  const interactions = useQuery(() => api.listInteractions({ accountId: account.id, limit: 30 }), [account.id]);

  const sorted = useMemo(() => {
    const rank = (o: OpportunityView) => STAGE_ORDER.indexOf(o.stage);
    return [...(opps.data ?? [])].sort((a, b) => {
      const ao = isOpenStage(a.stage) ? 0 : 1;
      const bo = isOpenStage(b.stage) ? 0 : 1;
      return ao - bo || (ao === 0 ? rank(b) - rank(a) : b.updated_at.localeCompare(a.updated_at)) || a.name.localeCompare(b.name, 'vi');
    });
  }, [opps.data]);
  const openDeals = sorted.filter((o) => isOpenStage(o.stage));
  const logDefaults = useMemo(() => ({ account_id: account.id }), [account.id]);
  const dealsListed = opps.data !== undefined && sorted.length > 0;

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-3">
      <SectionCard
        className="xl:col-span-2"
        title={t('crm.accountTab.deals')}
        description={
          openDeals.length > 0
            ? t('crm.accountTab.dealsSummary', {
                count: openDeals.length,
                value: formatMoneyCompact(sumValue(openDeals)),
                weighted: formatMoneyCompact(sumWeighted(openDeals)),
              })
            : undefined
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t('crm.page.create')}
          </Button>
        }
        divided={dealsListed || opps.loading}
      >
        {opps.data ? (
          sorted.length === 0 ? (
            <EmptyState compact icon={Handshake} title={t('crm.accountTab.noDeals')} description={t('crm.accountTab.noDealsHint')} />
          ) : (
            sorted.map((o) => <DealRow key={o.id} o={o} today={today} />)
          )
        ) : opps.loading ? (
          <RowsSkeleton rows={2} />
        ) : (
          <ErrorState compact error={opps.error} onRetry={opps.refetch} />
        )}
      </SectionCard>

      <SectionCard
        title={t('crm.accountTab.interactions')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>
            <MessageSquarePlus aria-hidden="true" />
            {t('crm.accountTab.log')}
          </Button>
        }
      >
        {interactions.data ? (
          <InteractionTimeline items={interactions.data} compact hideLinks={['account']} emptyText={t('crm.accountTab.noInteractions')} />
        ) : interactions.loading ? (
          <div className="space-y-5" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ErrorState compact error={interactions.error} onRetry={interactions.refetch} />
        )}
      </SectionCard>

      <CreateOpportunityDialog open={createOpen} onOpenChange={setCreateOpen} accountId={account.id} onCreated={() => undefined} />
      <LogInteractionDialog open={logOpen} onOpenChange={setLogOpen} defaults={logDefaults} />
    </div>
  );
}
