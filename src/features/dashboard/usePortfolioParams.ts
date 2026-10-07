// Portfolio filters live in the URL (?filter=, ?am=, ?q=, ?sort=) so a filtered view can be shared and survives
// the back button. Other params (e.g. the task drawer's ?task=) are kept. Updates replace the history entry.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_SORT, isSortKey, isStatusFilter, type SortKey, type StatusFilter } from './portfolioModel';

export interface PortfolioParams {
  status: StatusFilter | null;
  amId: string | null;
  query: string;
  sort: SortKey;
}

export interface PortfolioParamsApi extends PortfolioParams {
  update(patch: Partial<PortfolioParams>): void;
  /** clears filter, AM and search (keeps the sort) */
  clear(): void;
}

const KEYS = { status: 'filter', amId: 'am', query: 'q', sort: 'sort' } as const;

export function usePortfolioParams(): PortfolioParamsApi {
  const [params, setParams] = useSearchParams();

  const rawFilter = params.get(KEYS.status);
  const rawAm = params.get(KEYS.amId);
  const rawQuery = params.get(KEYS.query);
  const rawSort = params.get(KEYS.sort);

  const state = useMemo<PortfolioParams>(
    () => ({
      status: isStatusFilter(rawFilter) ? rawFilter : null,
      amId: rawAm && rawAm.trim() ? rawAm : null,
      query: rawQuery ?? '',
      sort: isSortKey(rawSort) ? rawSort : DEFAULT_SORT,
    }),
    [rawFilter, rawAm, rawQuery, rawSort],
  );

  const update = useCallback(
    (patch: Partial<PortfolioParams>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (key: string, value: string | null | undefined, fallback?: string) => {
            if (value === undefined) return;
            if (value === null || value === '' || value === fallback) next.delete(key);
            else next.set(key, value);
          };
          if ('status' in patch) put(KEYS.status, patch.status ?? null);
          if ('amId' in patch) put(KEYS.amId, patch.amId ?? null);
          if ('query' in patch) put(KEYS.query, patch.query?.trim() ? patch.query : null);
          if ('sort' in patch) put(KEYS.sort, patch.sort ?? null, DEFAULT_SORT);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => update({ status: null, amId: null, query: '' }), [update]);

  return { ...state, update, clear };
}
