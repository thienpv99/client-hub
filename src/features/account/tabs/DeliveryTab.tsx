// "Triển khai" (SPEC-CARE §6.4): what the client already uses and how their requests are handled — answered in one
// glance by the KPI row (solutions running, users, open requests, delivery debt), then the solution cards, then the
// request list with its triage sheet. The gate banner leads the tab while delivery debt blocks expanding.
// Members see the same (the api leaves out the contract value) and may log / open requests; only the director and
// the account's AM edit solutions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Inbox, Plus, TriangleAlert, Users } from 'lucide-react';
import type { AccountDetail } from '@/services/contract';
import type { AccountCareView, DeploymentView } from '@/services/careContract';
import type { QueryResult } from '@/hooks/useQuery';
import { jumpScrollTo, useArrivalMotion, useStagger } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ExpansionGateBanner } from '@/components/care/ExpansionGateBanner';
import { EmptyState } from '@/components/common/empty-state';
import { KpiCard } from '@/components/common/kpi-card';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton, KpiSkeleton } from '@/components/common/skeletons';
import type { AccountAccess } from '../accountAccess';
import { CareErrorCard } from '../care/careParts';
import { DeploymentCard } from './delivery/DeploymentCard';
import { DeploymentSheet } from './delivery/DeploymentSheet';
import { RequestsSection, isRequestFilter } from './delivery/RequestsSection';
import type { RequestFilter } from './delivery/RequestsSection';
import { sortDeployments } from './overview/CareCards';

/** sticky rows above the tab content (app bar 56 + identity row 56 + tab bar 44) and a little air */
const STICKY_OFFSET = 56 + 56 + 44 + 16;

function Kpis({ care, filter, onDebt }: { care: AccountCareView; filter: RequestFilter; onDebt: () => void }) {
  const active = care.deployments.filter((d) => d.status === 'live' || d.status === 'rolling_out' || d.status === 'pilot');
  const live = active.filter((d) => d.status === 'live').length;
  const counted = care.deployments.filter((d) => d.status === 'live' || d.status === 'pilot');
  const users = counted.reduce((sum, d) => sum + (d.active_users ?? 0), 0);
  // "18 người dùng ở 2 phòng ban": only the departments of the solutions those users are counted from
  const usedBy = new Set(counted.filter((d) => (d.active_users ?? 0) > 0).flatMap((d) => d.departments));
  const r = care.requests;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        icon={Boxes}
        label={t('careAccount.delivery.kpi.running')}
        value={String(active.length)}
        sub={
          active.length === 0
            ? t('careAccount.delivery.kpi.runningNone')
            : live === active.length
              ? t('careAccount.delivery.kpi.runningSubLive')
              : live === 0
                ? t('careAccount.delivery.kpi.runningSubProgress', { other: active.length })
                : t('careAccount.delivery.kpi.runningSub', { live, other: active.length - live })
        }
      />
      <KpiCard
        icon={Users}
        label={t('careAccount.delivery.kpi.users')}
        value={users > 0 ? formatNumber(users) : '—'}
        sub={users > 0 ? t('careAccount.delivery.kpi.usersSub', { count: usedBy.size }) : t('careAccount.delivery.kpi.usersNone')}
      />
      <KpiCard
        icon={Inbox}
        label={t('careAccount.delivery.kpi.open')}
        value={String(r.open)}
        sub={t('careAccount.delivery.kpi.openSub', { count: r.done_30d })}
      />
      <KpiCard
        icon={TriangleAlert}
        tone={r.debt > 0 ? 'danger' : 'neutral'}
        label={t('careAccount.delivery.kpi.debt')}
        value={String(r.debt)}
        sub={
          r.untriaged > 0
            ? t('careAccount.delivery.kpi.debtSub', { count: r.untriaged })
            : r.debt > 0
              ? t('careAccount.delivery.kpi.debtBlocks')
              : t('careAccount.delivery.kpi.debtNone')
        }
        onClick={r.debt > 0 ? onDebt : undefined}
        active={filter === 'debt'}
      />
    </div>
  );
}

function Solutions({
  care,
  onAdd,
  onEdit,
}: {
  care: AccountCareView;
  onAdd: () => void;
  onEdit: (d: DeploymentView) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const sorted = sortDeployments(care.deployments);
  const current = sorted.filter((d) => d.status !== 'retired');
  const retired = sorted.filter((d) => d.status === 'retired');
  // first appearance on page arrival only (a tab switch just fades the tab in)
  const rise = useStagger(useArrivalMotion());
  const add = care.can_manage ? (
    <Button type="button" size="sm" onClick={onAdd} className="w-full sm:w-auto">
      <Plus aria-hidden="true" />
      {t('careAccount.delivery.solutions.add')}
    </Button>
  ) : null;
  return (
    <section aria-labelledby="account-solutions-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="account-solutions-title" className="flex items-center gap-2 text-heading font-semibold tracking-tightish text-ink">
            {t('careAccount.delivery.solutions.title')}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
              {current.length}
            </span>
          </h2>
          <p className="mt-0.5 max-w-reading text-pretty text-caption">{t('careAccount.delivery.solutions.description')}</p>
        </div>
        {add && current.length > 0 ? <div className="shrink-0">{add}</div> : null}
      </div>
      {current.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Boxes} title={t('careAccount.delivery.solutions.empty')} description={t('careAccount.delivery.solutions.emptyHint')} action={add} />
        </SectionCard>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {current.map((d, i) => {
            const p = rise(i);
            return <DeploymentCard key={d.id} deployment={d} onEdit={onEdit} className={p.className} style={p.style} />;
          })}
        </ul>
      )}
      {retired.length > 0 ? (
        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" aria-expanded={showRetired} onClick={() => setShowRetired((s) => !s)}>
            {showRetired ? t('careAccount.delivery.solutions.retiredHide') : t('careAccount.delivery.solutions.retired', { count: retired.length })}
          </Button>
          {showRetired ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {retired.map((d) => (
                <DeploymentCard key={d.id} deployment={d} onEdit={onEdit} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export interface DeliveryTabProps {
  account: AccountDetail;
  access: AccountAccess;
  care: QueryResult<AccountCareView>;
}

export function DeliveryTab({ account, access, care }: DeliveryTabProps) {
  const [params, setParams] = useSearchParams();
  const requestsRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<{ open: boolean; deployment: DeploymentView | null }>({ open: false, deployment: null });
  const data = care.data;
  const rawFilter = params.get('filter');
  const filter: RequestFilter = isRequestFilter(rawFilter) ? rawFilter : 'all';
  const openId = params.get('cr');

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const showDebt = useCallback(() => {
    setParam('filter', 'debt');
    const el = requestsRef.current;
    if (el) jumpScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET));
  }, [setParam]);

  // arriving with a request filter (the overview's "Xem triển khai" on a debt / waiting row): bring the filtered list
  // into view once the cards above it have their real height — once, never on a later filter change
  const arrivedFiltered = useRef(filter !== 'all' && !openId);
  useEffect(() => {
    if (!arrivedFiltered.current || !data) return;
    arrivedFiltered.current = false;
    requestAnimationFrame(() => {
      const el = requestsRef.current;
      if (el) jumpScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET));
    });
  }, [data]);

  return (
    <div className="space-y-6 md:space-y-8">
      {data && data.requests.debt > 0 ? (
        <ExpansionGateBanner debtCount={data.requests.debt} onViewDebt={showDebt} canOverride={access.director} />
      ) : null}

      {data ? (
        <Kpis care={data} filter={filter} onDebt={() => (filter === 'debt' ? setParam('filter', null) : showDebt())} />
      ) : care.error ? null : (
        <KpiSkeleton className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" />
      )}

      {data ? (
        <Solutions care={data} onAdd={() => setPanel({ open: true, deployment: null })} onEdit={(d) => setPanel({ open: true, deployment: d })} />
      ) : care.error ? (
        <CareErrorCard error={care.error} onRetry={care.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} className="hidden md:block" />
        </div>
      )}

      <div ref={requestsRef}>
        <RequestsSection
          // remount per account: the first render after a client switch must not judge a ?cr= link against the
          // previous client's list (it would toast "không tìm thấy" and drop the link)
          key={account.id}
          accountId={account.id}
          canCreate={access.internal}
          filter={filter}
          onFilterChange={(f) => setParam('filter', f === 'all' ? null : f)}
          openId={openId}
          onOpenIdChange={(id) => setParam('cr', id)}
        />
      </div>

      {data?.can_manage ? (
        <DeploymentSheet
          account={account}
          care={data}
          deployment={panel.deployment}
          open={panel.open}
          onOpenChange={(o) => setPanel((p) => ({ ...p, open: o }))}
          showValue
          canOverride={access.director}
        />
      ) : null}
    </div>
  );
}
