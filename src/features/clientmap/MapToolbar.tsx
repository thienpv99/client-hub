// Controls above the map: size metric (segmented), "Hiện khách hàng mục tiêu" and the AM filter (director); the
// Bản đồ / Bảng switch sits in the page header. Phones: a compact toolbar — the view switch one tap away, the
// rest in a "Bộ lọc" bottom sheet.
import { useId, useState } from 'react';
import { Loader2, Network, SlidersHorizontal, Table2 } from 'lucide-react';
import type { UserRef } from '@/services/contract';
import type { ClientMapMetric } from '@/services/crmContract';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { isMetric, METRICS } from './mapModel';

export type MapView = 'map' | 'table';

export interface MapToolbarProps {
  metric: ClientMapMetric;
  onMetric(m: ClientMapMetric): void;
  showLeads: boolean;
  onShowLeads(v: boolean): void;
  /** AM filter (director only); null = everyone */
  ams: UserRef[] | null;
  amId: string | null;
  onAm(id: string | null): void;
  view: MapView;
  onView(v: MapView): void;
  refreshing: boolean;
  /** phones */
  compact: boolean;
  /** phones: the "Quản lý hệ sinh thái" entry (an icon button in the compact toolbar) */
  onEcosystems?(): void;
}

const ALL = '__all__';

function MetricControl({ metric, onMetric, full }: { metric: ClientMapMetric; onMetric(m: ClientMapMetric): void; full?: boolean }) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={metric}
      onValueChange={(v) => {
        if (isMetric(v)) onMetric(v);
      }}
      aria-label={t('clientmap.metric.label')}
      className={cn(full && 'grid w-full grid-cols-3')}
    >
      {METRICS.map((m) => (
        <ToggleGroupItem key={m} value={m} className={cn('px-3', full && 'w-full')}>
          {t(`clientmap.metric.${m}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function LeadsSwitch({ checked, onChange, id, short }: { checked: boolean; onChange(v: boolean): void; id: string; short?: boolean }) {
  return (
    <label htmlFor={id} className="flex min-h-tap cursor-pointer items-center gap-2.5 md:min-h-0">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <span className="whitespace-nowrap text-table font-medium text-foreground">
        {short ? t('clientmap.controls.leadsShort') : t('clientmap.controls.leads')}
      </span>
    </label>
  );
}

function AmSelect({ ams, amId, onAm, id, full }: { ams: UserRef[]; amId: string | null; onAm(id: string | null): void; id: string; full?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', full && 'flex-col items-stretch')}>
      {/* toolbar: the visible label only from xl (the select reads "Tất cả AM" / a name), so the row never wraps at 1024 */}
      <label
        htmlFor={id}
        className={cn('shrink-0 text-table', full ? 'font-medium text-foreground' : 'sr-only text-muted-foreground xl:not-sr-only')}
      >
        {t('clientmap.controls.am')}
      </label>
      <NativeSelect
        id={id}
        size="sm"
        value={amId ?? ALL}
        onChange={(e) => onAm(e.target.value === ALL ? null : e.target.value)}
        wrapperClassName={full ? 'w-full' : 'w-40'}
      >
        <option value={ALL}>{t('clientmap.controls.amAll')}</option>
        {ams.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Bản đồ / Bảng — in the page header from md, in the compact toolbar on phones */
export function ViewSwitch({ view, onView, full }: { view: MapView; onView(v: MapView): void; full?: boolean }) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={view}
      onValueChange={(v) => {
        if (v === 'map' || v === 'table') onView(v);
      }}
      aria-label={t('clientmap.controls.view')}
      className={cn(full && 'grid flex-1 grid-cols-2')}
    >
      <ToggleGroupItem value="map" className="min-w-0 px-3">
        {full ? null : <Network aria-hidden="true" />}
        {t('clientmap.controls.viewMap')}
      </ToggleGroupItem>
      <ToggleGroupItem value="table" className="min-w-0 px-3">
        {full ? null : <Table2 aria-hidden="true" />}
        {t('clientmap.controls.viewTable')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** fixed 16px slot so a background refresh never changes the toolbar's size (and so the map's) */
function Refreshing({ show }: { show: boolean }) {
  return (
    <span role="status" className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-caption" title={show ? t('clientmap.controls.refreshing') : undefined}>
      {show ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="sr-only">{t('clientmap.controls.refreshing')}</span>
        </>
      ) : null}
    </span>
  );
}

export function MapToolbar(p: MapToolbarProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);

  if (p.compact) {
    const active = (p.metric !== 'total' ? 1 : 0) + (p.showLeads ? 1 : 0) + (p.amId ? 1 : 0);
    return (
      <div className="flex items-center gap-2">
        <ViewSwitch view={p.view} onView={p.onView} full />
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="shrink-0 px-3"
          aria-label={active > 0 ? t('clientmap.controls.filtersActive', { count: active }) : undefined}
        >
          <SlidersHorizontal aria-hidden="true" />
          {t('clientmap.controls.filters')}
          {active > 0 ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-micro font-semibold tabular text-primary-foreground" aria-hidden="true">
              {active}
            </span>
          ) : null}
        </Button>
        {p.onEcosystems ? (
          <Button
            variant="secondary"
            size="icon"
            onClick={p.onEcosystems}
            aria-label={t('clientmap.controls.ecosystems')}
            title={t('clientmap.controls.ecosystems')}
            className="shrink-0"
          >
            <Network aria-hidden="true" />
          </Button>
        ) : null}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{t('clientmap.controls.filtersTitle')}</SheetTitle>
              <SheetDescription>{t('clientmap.controls.filtersDescription')}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <div className="space-y-2">
                <p className="text-table font-medium text-foreground">{t('clientmap.metric.label')}</p>
                <MetricControl metric={p.metric} onMetric={p.onMetric} full />
              </div>
              <LeadsSwitch checked={p.showLeads} onChange={p.onShowLeads} id={`${uid}-leads-m`} />
              {p.ams ? <AmSelect ams={p.ams} amId={p.amId} onAm={p.onAm} id={`${uid}-am-m`} full /> : null}
            </SheetBody>
            <SheetFooter>
              <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">
                {t('clientmap.controls.filtersDone')}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex items-center gap-3">
        <span className="hidden text-table text-muted-foreground xl:inline" aria-hidden="true">
          {t('clientmap.metric.label')}
        </span>
        <MetricControl metric={p.metric} onMetric={p.onMetric} />
      </div>
      <LeadsSwitch checked={p.showLeads} onChange={p.onShowLeads} id={`${uid}-leads`} short />
      <div className="flex items-center gap-2">
        {p.ams ? <AmSelect ams={p.ams} amId={p.amId} onAm={p.onAm} id={`${uid}-am`} /> : null}
        <Refreshing show={p.refreshing} />
      </div>
    </div>
  );
}
