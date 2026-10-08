// /app/map — "Bản đồ khách hàng" (director + AM). Each company (customer or target) is a bubble sized by its value on
// one shared scale; lines join the companies of one ecosystem (business group) through the group's hub, sized on a
// scale of its own (the subtitle and legend say so). The "Bảng" view is the accessible ranking.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Network } from 'lucide-react';
import { api } from '@/services/api';
import type { EcosystemView } from '@/services/crmContract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { BubbleMap } from './BubbleMap';
import { ClientTable } from './ClientTable';
import { EcosystemDialog } from './EcosystemDialog';
import { EcosystemSheet } from './EcosystemSheet';
import { MapKpis, MapKpisSkeleton } from './MapKpis';
import { MapToolbar, ViewSwitch } from './MapToolbar';
import { isCompany, mapKpis, rankedRows } from './mapModel';
import { useMapParams } from './useMapParams';

/**
 * The map fills the viewport below its top edge (the CSS fallback is calc(100dvh − 276px)), never shorter than
 * `min`; measured on mount and on window resize.
 */
function useFillHeight(el: HTMLElement | null, min: number, remeasure: unknown): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      // leave the page's bottom padding (py-6 / md:py-8) visible
      const bottom = window.innerWidth >= 768 ? 32 : 24;
      setHeight(Math.max(min, Math.round(window.innerHeight - top - bottom)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [el, min, remeasure]);
  return height;
}

/** the map card while the first map loads: top bar, a packed cloud of soft circles, legend bar */
function MapSkeleton() {
  const dots = [
    'left-[34%] top-[16%] h-44 w-44',
    'left-[52%] top-[30%] h-36 w-36',
    'left-[20%] top-[36%] h-28 w-28',
    'left-[64%] top-[12%] h-24 w-24',
    'left-[44%] top-[58%] h-24 w-24',
    'left-[70%] top-[52%] h-20 w-20',
    'left-[12%] top-[20%] h-14 w-14',
    'left-[80%] top-[30%] h-14 w-14',
    'left-[26%] top-[66%] h-12 w-12',
  ];
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal flex h-full w-full flex-col">
      <span className="sr-only">{t('components.loading')}</span>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 md:px-4">
        <Skeleton className="h-11 w-full max-w-[280px] md:h-8" />
        <Skeleton className="h-11 w-[136px] shrink-0 md:h-8 md:w-[96px]" />
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-subtle">
        {dots.map((d) => (
          <Skeleton key={d} className={`absolute rounded-full ${d}`} />
        ))}
      </div>
      <div className="flex gap-5 border-t border-border/60 px-4 py-3 md:px-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="hidden h-3 w-24 sm:block" />
      </div>
    </div>
  );
}

export function ClientMapPage() {
  const viewer = useViewer();
  const isDirector = viewer?.role === 'director';
  const breakpoint = useBreakpoint();
  const phone = breakpoint === 'mobile';
  const desktop = breakpoint === 'desktop';
  const params = useMapParams();
  const [mapBox, setMapBox] = useState<HTMLDivElement | null>(null);
  const { update } = params;

  const query = useQuery(
    () => api.getClientMap({ metric: params.metric, includeLeads: params.showLeads, ownerId: params.amId ?? undefined }),
    [params.metric, params.showLeads, params.amId, viewer?.user.id],
    { keepPreviousData: true },
  );
  const users = useQuery(() => api.listUsers({ orgType: 'internal' }), [viewer?.user.id], { enabled: isDirector });
  const ams = useMemo(
    () => (isDirector ? (users.data ?? []).filter((u) => u.role === 'am').sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')) : null),
    [isDirector, users.data],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; eco: EcosystemView | null }>({ open: false, eco: null });
  const allEcos = useQuery(() => api.listEcosystems(), [viewer?.user.id], { enabled: dialog.open });

  const map = query.data;
  // measured again once the first data (KPI strip) is in
  const fillHeight = useFillHeight(mapBox, phone ? 420 : desktop ? 520 : 440, map !== undefined);
  // the map view keeps the figures above it only on desktop; the table always has them on top
  const kpisFirst = desktop || params.view === 'table';
  const kpis = useMemo(() => (map ? mapKpis(map) : null), [map]);
  const rows = useMemo(() => (map ? rankedRows(map) : []), [map]);
  const hasCompanies = Boolean(map?.nodes.some(isCompany));
  const filtered = params.amId !== null || !params.showLeads;

  const selectEco = useCallback((id: string | null) => update({ eco: id }), [update]);
  const editEco = useCallback((eco: EcosystemView | null) => setDialog({ open: true, eco }), []);

  const header = (
    <PageHeader
      title={t('clientmap.page.title')}
      description={t('clientmap.page.description')}
      actions={
        // phones: both live in the compact toolbar
        phone ? undefined : (
          <>
            <ViewSwitch view={params.view} onView={(v) => update({ view: v })} />
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              <Network aria-hidden="true" />
              {desktop ? t('clientmap.controls.ecosystems') : t('clientmap.controls.ecosystemsShort')}
            </Button>
          </>
        )
      }
    />
  );

  const kpiStrip = kpis && hasCompanies ? (
    <MapKpis kpis={kpis} metric={map?.metric ?? params.metric} showLeads={params.showLeads} />
  ) : query.loading ? (
    <MapKpisSkeleton />
  ) : null;

  let content: ReactNode;
  if (query.error && !map) {
    content = (
      <div className="rounded-xl border border-border/70 bg-card shadow-card">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  } else if (map && !hasCompanies) {
    content = (
      <div className="rounded-xl border border-border/70 bg-card shadow-card">
        <EmptyState
          icon={Network}
          title={filtered ? t('clientmap.map.emptyFilteredTitle') : t('clientmap.map.emptyTitle')}
          description={filtered ? t('clientmap.map.emptyFilteredDescription') : t('clientmap.map.emptyDescription')}
          action={
            filtered ? (
              <Button variant="soft" onClick={() => update({ amId: null, showLeads: true })}>
                {t('clientmap.map.clearFilters')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  } else if (params.view === 'table') {
    content = map ? (
      <ClientTable rows={rows} metric={params.metric} mode={params.tableMode} onMode={(m) => update({ tableMode: m })} />
    ) : (
      <TableSkeleton rows={6} cols={7} />
    );
  } else {
    content = (
      <div
        ref={setMapBox}
        className="h-[calc(100dvh-276px)] min-h-[420px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-card md:min-h-[440px] xl:min-h-[520px]"
        style={fillHeight ? { height: fillHeight } : undefined}
      >
        {map ? (
          <BubbleMap map={map} showLeads={params.showLeads} selectedEco={params.eco} onSelectEco={selectEco} onEditEco={editEco} />
        ) : (
          <MapSkeleton />
        )}
      </div>
    );
  }

  return (
    // same rhythm as every list page: header, then (section gap) the toolbar row grouped with its content
    <div className="space-y-6 md:space-y-8">
      {header}
      <div className="space-y-4">
        <MapToolbar
          metric={params.metric}
          onMetric={(m) => update({ metric: m })}
          showLeads={params.showLeads}
          onShowLeads={(v) => update({ showLeads: v })}
          ams={ams}
          amId={params.amId}
          onAm={(id) => update({ amId: id, eco: null })}
          view={params.view}
          onView={(v) => update({ view: v })}
          refreshing={query.refreshing}
          compact={phone}
          onEcosystems={() => setSheetOpen(true)}
        />
        {/* below 1280 (phones, iPad) the map — the focal point — comes first, the figures right under it */}
        {kpisFirst ? kpiStrip : null}
        {content}
        {kpisFirst ? null : kpiStrip}
      </div>

      <EcosystemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreate={() => editEco(null)}
        onEdit={(eco) => editEco(eco)}
        onShowOnMap={(eco) => {
          setSheetOpen(false);
          update({ view: 'map', eco: eco.id });
        }}
      />
      <EcosystemDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        eco={dialog.eco}
        ecosystems={allEcos.data ?? map?.ecosystems ?? []}
        onSaved={(eco) => {
          if (!sheetOpen) update({ eco: eco.id, view: 'map' });
        }}
      />
    </div>
  );
}
