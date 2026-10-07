// Map state in the URL (?view=table&metric=pipeline&leads=0&am=u_am_ha&group=1&eco=eco_x) so "Back" from an
// account restores the same picture. Defaults are left out of the URL.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ClientMapMetric } from '@/services/crmContract';
import type { TableMode } from './ClientTable';
import type { MapView } from './MapToolbar';
import { isMetric } from './mapModel';

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

export function useMapParams(): MapParams & { update(patch: Patch): void } {
  const [sp, setSp] = useSearchParams();
  const metric = sp.get('metric');
  const params: MapParams = {
    view: sp.get('view') === 'table' ? 'table' : 'map',
    metric: isMetric(metric) ? metric : 'total',
    showLeads: sp.get('leads') !== '0',
    amId: sp.get('am') || null,
    tableMode: sp.get('group') === '1' ? 'group' : 'rank',
    eco: sp.get('eco') || null,
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
          if ('view' in patch) put('view', patch.view === 'table' ? 'table' : null);
          if ('metric' in patch) put('metric', patch.metric && patch.metric !== 'total' ? patch.metric : null);
          if ('showLeads' in patch) put('leads', patch.showLeads === false ? '0' : null);
          if ('amId' in patch) put('am', patch.amId ?? null);
          if ('tableMode' in patch) put('group', patch.tableMode === 'group' ? '1' : null);
          if ('eco' in patch) put('eco', patch.eco ?? null);
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  return { ...params, update };
}
