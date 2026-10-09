// Map state in the URL (?view=table|matrix&metric=contract_value&leads=1&am=u_am_ha&group=1&eco=eco_x) so "Back" from
// an account restores the same picture. Defaults are left out of the URL. `eco` is the selected group: highlighted on
// the map, opened in the matrix (/app/map?view=matrix&eco=<ecosystemId>; ?group=<ecosystemId> is accepted there too —
// `group=1` stays the table's "Theo tập đoàn" mode). Feature flags (SPEC-CARE §1): without `targets` leads are never
// shown, without `sales` the "Cơ hội" and "Tổng giá trị" size metrics are refused and the map opens on "Hợp đồng"
// (signed value only).
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isFeatureOn } from '@/config/features';
import type { ClientMapMetric } from '@/services/crmContract';
import type { TableMode } from './ClientTable';
import type { MapView } from './MapToolbar';
import { defaultMetric, isMetric, isMetricAvailable } from './mapModel';

export interface MapParams {
  view: MapView;
  metric: ClientMapMetric;
  showLeads: boolean;
  amId: string | null;
  tableMode: TableMode;
  /** selected ecosystem id */
  eco: string | null;
}

type Patch = Partial<MapParams>;

function readView(v: string | null): MapView {
  return v === 'table' || v === 'matrix' ? v : 'map';
}

export function useMapParams(): MapParams & { update(patch: Patch): void } {
  const [sp, setSp] = useSearchParams();
  const metric = sp.get('metric');
  const view = readView(sp.get('view'));
  const group = sp.get('group');
  const params: MapParams = {
    view,
    metric: isMetric(metric) && isMetricAvailable(metric) ? metric : defaultMetric(),
    // customers only by default: target budgets are large and would crowd out real clients on one honest scale
    showLeads: isFeatureOn('targets') && sp.get('leads') === '1',
    amId: sp.get('am') || null,
    tableMode: group === '1' ? 'group' : 'rank',
    eco: sp.get('eco') || (view === 'matrix' && group && group !== '1' ? group : null),
  };

  const update = useCallback(
    (patch: Patch) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (key: string, value: string | null) => {
            if (value === null) next.delete(key);
            else next.set(key, value);
          };
          if ('view' in patch) put('view', patch.view === 'table' || patch.view === 'matrix' ? patch.view : null);
          if ('metric' in patch) put('metric', patch.metric && patch.metric !== defaultMetric() ? patch.metric : null);
          if ('showLeads' in patch) put('leads', patch.showLeads === true ? '1' : null);
          if ('amId' in patch) put('am', patch.amId ?? null);
          if ('tableMode' in patch) put('group', patch.tableMode === 'group' ? '1' : null);
          if ('eco' in patch) {
            put('eco', patch.eco ?? null);
            // the matrix link form (?group=<ecosystemId>) is rewritten as ?eco=
            const g = next.get('group');
            if (g && g !== '1') next.delete('group');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  return { ...params, update };
}
