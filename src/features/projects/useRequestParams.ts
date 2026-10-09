// "Yêu cầu" tab state in the URL (/app/projects/requests?view=timeline&flag=debt&account=acc_x&mine=1&q=…&cr=<id>)
// so a filtered view can be shared and survives "Back"; `cr` opens that request's sheet (deep links, notifications).
// Updates replace the history entry; other params are kept. Defaults are left out of the URL.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isRequestFlag, isRequestView, type RequestFlag, type RequestView } from './requestsModel';

export interface RequestParams {
  view: RequestView;
  flag: RequestFlag | null;
  accountId: string | null;
  mine: boolean;
  query: string;
  /** request whose sheet is open */
  crId: string | null;
}

export interface RequestParamsApi extends RequestParams {
  update(patch: Partial<RequestParams>): void;
  /** clears the filters and the search (keeps the view) */
  clear(): void;
}

export function useRequestParams(): RequestParamsApi {
  const [sp, setSp] = useSearchParams();
  const rawView = sp.get('view');
  const rawFlag = sp.get('flag');
  const rawAccount = sp.get('account');
  const rawMine = sp.get('mine');
  const rawQuery = sp.get('q');
  const rawCr = sp.get('cr');

  const state = useMemo<RequestParams>(
    () => ({
      view: isRequestView(rawView) ? rawView : 'board',
      flag: isRequestFlag(rawFlag) ? rawFlag : null,
      accountId: rawAccount && rawAccount.trim() ? rawAccount : null,
      mine: rawMine === '1',
      query: rawQuery ?? '',
      crId: rawCr && rawCr.trim() ? rawCr : null,
    }),
    [rawView, rawFlag, rawAccount, rawMine, rawQuery, rawCr],
  );

  const update = useCallback(
    (patch: Partial<RequestParams>) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (key: string, value: string | null) => {
            if (value === null || value.trim() === '') next.delete(key);
            else next.set(key, value);
          };
          if ('view' in patch) put('view', patch.view === 'timeline' ? 'timeline' : null);
          if ('flag' in patch) put('flag', patch.flag ?? null);
          if ('accountId' in patch) put('account', patch.accountId ?? null);
          if ('mine' in patch) put('mine', patch.mine ? '1' : null);
          if ('query' in patch) put('q', patch.query ?? null);
          if ('crId' in patch) put('cr', patch.crId ?? null);
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const clear = useCallback(() => update({ flag: null, accountId: null, mine: false, query: '' }), [update]);

  return { ...state, update, clear };
}
