// /app/crm/:tab? — Bán hàng: KPI row, then Pipeline · Danh sách · Dự báo · Cần theo dõi (tabs follow the URL).
// Owner filter in `?owner=` (director: everyone by default; AM: their own deals by default).
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { ErrorState } from '@/components/common/error-state';
import { PAGE_TABS_BLEED, PageHeader } from '@/components/common/page-header';
import { KpiSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateOpportunityDialog } from '@/components/crm/CreateOpportunityDialog';
import { useDealOwners } from '@/components/crm/fields';
import { CrmKpis } from './CrmKpis';
import { CRM_TABS, crmTabPath, isCrmTab, ownerParams, resolveOwner } from './crmModel';
import type { CrmTab } from './crmModel';
import { useCloseFlow } from './dialogs/useCloseFlow';
import { FollowUpsTab } from './followups/FollowUpsTab';
import { ForecastTab } from './forecast/ForecastTab';
import { OpportunityList } from './list/OpportunityList';
import { PipelineBoard } from './pipeline/PipelineBoard';

function OwnerFilter({ viewer, value, onChange }: { viewer: Viewer; value: string; onChange: (v: string) => void }) {
  const isDirector = viewer.role === 'director';
  const { owners } = useDealOwners(isDirector);
  const me = viewer.user.id;
  return (
    <NativeSelect
      size="sm"
      aria-label={t('crm.owner.label')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      wrapperClassName="min-w-0 flex-1 sm:w-48 sm:flex-none"
    >
      {isDirector ? (
        <>
          <option value="all">{t('crm.owner.team')}</option>
          <option value={me}>{t('crm.owner.mine')}</option>
          {owners
            .filter((u) => u.id !== me)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
        </>
      ) : (
        <>
          <option value={me}>{t('crm.owner.mine')}</option>
          <option value="all">{t('crm.owner.allVisible')}</option>
        </>
      )}
    </NativeSelect>
  );
}

/** same frame as the board: 4 columns from xl, a 2×2 grid from md, one column on phones */
function BoardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
      <span className="sr-only">{t('common.a11y.loading')}</span>
      {Array.from({ length: 4 }, (_, c) => (
        <div key={c} className={c > 0 ? 'hidden md:block' : undefined}>
          <div className="space-y-2 rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60">
            <div className="space-y-2 px-2 pb-1.5 pt-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 3 - (c % 2) }, (_, i) => (
              <div key={i} className="space-y-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-xs">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card>
      <ErrorState error={error} onRetry={onRetry} />
    </Card>
  );
}

export function CrmPage() {
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const viewer = useViewer();
  const [createOpen, setCreateOpen] = useState(false);
  const close = useCloseFlow();
  const today = todayISO();

  const tab: CrmTab = isCrmTab(rawTab) ? rawTab : 'pipeline';
  const owner = resolveOwner(params.get('owner'), viewer);
  const needOpps = tab === 'pipeline' || tab === 'list';
  const dash = useQuery(() => api.getCrmDashboard(ownerParams(owner)), [owner], { keepPreviousData: true });
  const opps = useQuery(() => api.listOpportunities(ownerParams(owner) ?? {}), [owner], { keepPreviousData: true, enabled: needOpps });

  if (rawTab !== undefined && !isCrmTab(rawTab)) return <Navigate to={crmTabPath('pipeline')} replace />;
  if (!viewer) return null;

  const setOwner = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === resolveOwner(null, viewer)) next.delete('owner');
    else next.set('owner', value);
    setParams(next, { replace: true });
  };

  const ownerSearch = params.get('owner') ? `?owner=${encodeURIComponent(params.get('owner') ?? '')}` : '';
  const listHref = (stage: 'won' | 'lost') => {
    const p = new URLSearchParams();
    const o = params.get('owner');
    if (o) p.set('owner', o);
    p.set('stage', stage);
    return crmTabPath('list', `?${p.toString()}`);
  };
  const followUps = dash.data?.follow_ups;
  const followUpCount = followUps ? followUps.overdue + followUps.today : 0;

  const oppsBody = (render: (items: NonNullable<typeof opps.data>) => ReactElement, skeleton: ReactElement) =>
    opps.data ? render(opps.data) : opps.loading ? skeleton : <Failed error={opps.error} onRetry={opps.refetch} />;

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      <PageHeader
        title={t('crm.page.title')}
        description={t('crm.page.description')}
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <OwnerFilter viewer={viewer} value={owner} onChange={setOwner} />
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus aria-hidden="true" />
              {t('crm.page.create')}
            </Button>
          </div>
        }
      />

      {dash.data ? (
        <CrmKpis data={dash.data} year={today.slice(0, 4)} />
      ) : dash.loading ? (
        <KpiSkeleton count={4} className="grid-cols-2 gap-3 sm:gap-4" />
      ) : (
        <Failed error={dash.error} onRetry={dash.refetch} />
      )}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isCrmTab(next)) navigate(crmTabPath(next, ownerSearch));
        }}
      >
        <TabsList variant="underline" aria-label={t('crm.tabs.label')} className={PAGE_TABS_BLEED}>
          {CRM_TABS.map((id) => (
            <TabsTrigger
              key={id}
              value={id}
              count={id === 'followups' && followUpCount > 0 ? followUpCount : null}
              countTone={followUps && followUps.overdue > 0 ? 'danger' : 'neutral'}
              countLabel={t('crm.tabs.followupsCount', { count: followUpCount })}
            >
              {t(`crm.tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="pipeline" className="mt-6 md:mt-8">
          {tab === 'pipeline'
            ? oppsBody((items) => <PipelineBoard items={items} today={today} close={close} listHref={listHref} />, <BoardSkeleton />)
            : null}
        </TabsContent>
        <TabsContent value="list" className="mt-6 md:mt-8">
          {tab === 'list' ? oppsBody((items) => <OpportunityList items={items} today={today} />, <TableSkeleton rows={6} cols={6} />) : null}
        </TabsContent>
        <TabsContent value="forecast" className="mt-6 md:mt-8">
          {tab === 'forecast' ? (
            dash.data ? (
              <ForecastTab dashboard={dash.data} />
            ) : dash.loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
              <Failed error={dash.error} onRetry={dash.refetch} />
            )
          ) : null}
        </TabsContent>
        <TabsContent value="followups" className="mt-6 md:mt-8">
          {tab === 'followups' ? <FollowUpsTab owner={owner} today={today} /> : null}
        </TabsContent>
      </Tabs>

      <CreateOpportunityDialog open={createOpen} onOpenChange={setCreateOpen} />
      {close.dialogs}
    </div>
  );
}
