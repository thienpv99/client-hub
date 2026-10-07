// Data fetching hook (owner G1).
// - refetches automatically after any committed mutation (api.onDataChange) and on login/logout/view-as
//   (api.onViewerChange), keeping the previous data visible while refreshing
// - ignores stale responses (request id), StrictMode-safe
// - `loading` is true only while there is no data yet for the current deps (skeleton time);
//   later refreshes set `refreshing` instead
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

export interface QueryOptions {
  /** false = do not fetch (data stays undefined, loading false) */
  enabled?: boolean;
  /**
   * Keep the previous data visible when `deps` change (e.g. filter chips) instead of showing the skeleton again.
   * Default false: a new key (other account, other task) starts empty so stale data is never shown under it.
   */
  keepPreviousData?: boolean;
}

export interface QueryResult<T> {
  data: T | undefined;
  /** first load only (no data yet) */
  loading: boolean;
  /** a refetch is running while data is shown */
  refreshing: boolean;
  error: unknown;
  refetch(): void;
}

interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refreshing: boolean;
}

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], opts?: QueryOptions): QueryResult<T> {
  const enabled = opts?.enabled ?? true;
  const keepPrevious = opts?.keepPreviousData ?? false;

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const requestId = useRef(0);
  const alive = useRef(false);
  const started = useRef(false);

  const [state, setState] = useState<QueryState<T>>(() => ({
    data: undefined,
    error: undefined,
    loading: enabled,
    refreshing: false,
  }));

  const execute = useCallback((mode: 'reset' | 'refresh') => {
    const id = ++requestId.current;
    setState((prev) => {
      if (mode === 'reset' || prev.data === undefined) {
        return { data: undefined, error: undefined, loading: true, refreshing: false };
      }
      return { ...prev, refreshing: true };
    });
    let promise: Promise<T>;
    try {
      promise = Promise.resolve(fnRef.current());
    } catch (err) {
      promise = Promise.reject(err);
    }
    promise.then(
      (data) => {
        if (!alive.current || id !== requestId.current) return;
        setState({ data, error: undefined, loading: false, refreshing: false });
      },
      (error: unknown) => {
        if (!alive.current || id !== requestId.current) return;
        setState((prev) => ({ data: prev.data, error, loading: false, refreshing: false }));
      },
    );
  }, []);

  // (re)fetch when deps change
  useEffect(() => {
    alive.current = true;
    if (!enabled) {
      requestId.current += 1; // drop any in-flight response
      setState((prev) => (prev.loading || prev.refreshing ? { ...prev, loading: false, refreshing: false } : prev));
      return () => {
        alive.current = false;
      };
    }
    // first run for this hook instance always starts from empty; later deps changes honour keepPreviousData
    execute(started.current && keepPrevious ? 'refresh' : 'reset');
    started.current = true;
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, execute, ...deps]);

  // refetch after mutations and session changes (coalesced into one request per tick)
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        execute('refresh');
      }, 0);
    };
    const offData = api.onDataChange(schedule);
    const offViewer = api.onViewerChange(schedule);
    return () => {
      if (timer !== null) clearTimeout(timer);
      offData();
      offViewer();
    };
  }, [enabled, execute]);

  const refetch = useCallback(() => {
    if (enabled) execute('refresh');
  }, [enabled, execute]);

  return { data: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refetch };
}
