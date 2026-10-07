// Portfolio filters live in the URL (?filter=, ?am=, ?status=, ?q=) so a filtered view can be shared and survives
// the back button. Updates replace the history entry; other params are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectStatus } from '@/domain/types';
import { isProjectFilter, isProjectStatus, type ProjectFilter } from './projectsModel';

export interface ProjectParams {
  filter: ProjectFilter | null;
  amId: string | null;
  status: ProjectStatus | null;
  query: string;
}

export interface ProjectParamsApi extends ProjectParams {
  update(patch: Partial<ProjectParams>): void;
  /** clears every filter and the search */
  clear(): void;
}

const KEYS = { filter: 'filter', amId: 'am', status: 'status', query: 'q' } as const;

export function useProjectParams(): ProjectParamsApi {
  const [params, setParams] = useSearchParams();

  const rawFilter = params.get(KEYS.filter);
  const rawAm = params.get(KEYS.amId);
  const rawStatus = params.get(KEYS.status);
  const rawQuery = params.get(KEYS.query);

  const state = useMemo<ProjectParams>(
    () => ({
      filter: isProjectFilter(rawFilter) ? rawFilter : null,
      amId: rawAm && rawAm.trim() ? rawAm : null,
      status: isProjectStatus(rawStatus) ? rawStatus : null,
      query: rawQuery ?? '',
    }),
    [rawFilter, rawAm, rawStatus, rawQuery],
  );

  const update = useCallback(
    (patch: Partial<ProjectParams>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (key: string, value: string | null | undefined) => {
            if (value === undefined) return;
            if (value === null || value.trim() === '') next.delete(key);
            else next.set(key, value);
          };
          if ('filter' in patch) put(KEYS.filter, patch.filter ?? null);
          if ('amId' in patch) put(KEYS.amId, patch.amId ?? null);
          if ('status' in patch) put(KEYS.status, patch.status ?? null);
          if ('query' in patch) put(KEYS.query, patch.query ?? null);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => update({ filter: null, amId: null, status: null, query: '' }), [update]);

  return { ...state, update, clear };
}
