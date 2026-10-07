// Lead list filters, kept in the URL search params (?status=&owner=&grade=&segment=&sort=&due=&q=) so a filtered
// list survives opening a lead (/app/targets/leads/:leadId) and can be shared.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LeadStatus } from '@/domain/crmTypes';
import type { FitBreakdown } from '@/services/crmContract';
import { GRADES, LEAD_STATUSES } from '../targetLabels';

export type StatusFilter = 'open' | 'all' | LeadStatus;
/** 'me' | 'none' | 'all' | a user id */
export type OwnerFilter = string;
export type LeadSort = 'fit' | 'followup' | 'newest';
export const LEAD_SORTS: LeadSort[] = ['fit', 'followup', 'newest'];

export interface LeadParams {
  status: StatusFilter;
  owner: OwnerFilter;
  grade: FitBreakdown['grade'] | null;
  segmentId: string | null;
  sort: LeadSort;
  /** only leads to contact today or overdue */
  due: boolean;
  q: string;
  /** a filter other than the defaults is active */
  filtered: boolean;
  update(patch: Partial<Omit<LeadParams, 'update' | 'clear' | 'filtered'>>): void;
  clear(): void;
}

function isStatus(v: string | null): v is StatusFilter {
  return v === 'open' || v === 'all' || (v !== null && (LEAD_STATUSES as string[]).includes(v));
}

function isGrade(v: string | null): v is FitBreakdown['grade'] {
  return v !== null && (GRADES as string[]).includes(v);
}

function isSort(v: string | null): v is LeadSort {
  return v !== null && (LEAD_SORTS as string[]).includes(v);
}

/** @param defaultOwner 'me' for an AM, 'all' for the director */
export function useLeadParams(defaultOwner: 'me' | 'all'): LeadParams {
  const [search, setSearch] = useSearchParams();

  const status: StatusFilter = isStatus(search.get('status')) ? (search.get('status') as StatusFilter) : 'open';
  const owner = search.get('owner') || defaultOwner;
  const gradeRaw = search.get('grade');
  const grade = isGrade(gradeRaw) ? gradeRaw : null;
  const segmentId = search.get('segment') || null;
  const sortRaw = search.get('sort');
  const sort: LeadSort = isSort(sortRaw) ? sortRaw : 'fit';
  const due = search.get('due') === '1';
  const q = search.get('q') ?? '';

  const update = useCallback(
    (patch: Partial<Omit<LeadParams, 'update' | 'clear' | 'filtered'>>) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (key: string, value: string | null, fallback: string | null) => {
            if (value === null || value === '' || value === fallback) next.delete(key);
            else next.set(key, value);
          };
          if ('status' in patch) put('status', patch.status ?? null, 'open');
          if ('owner' in patch) put('owner', patch.owner ?? null, defaultOwner);
          if ('grade' in patch) put('grade', patch.grade ?? null, null);
          if ('segmentId' in patch) put('segment', patch.segmentId ?? null, null);
          if ('sort' in patch) put('sort', patch.sort ?? null, 'fit');
          if ('due' in patch) put('due', patch.due ? '1' : null, null);
          if ('q' in patch) put('q', patch.q?.trim() ? (patch.q ?? null) : null, null);
          return next;
        },
        { replace: true },
      );
    },
    [setSearch, defaultOwner],
  );

  const clear = useCallback(() => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of ['status', 'owner', 'grade', 'segment', 'due', 'q']) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [setSearch]);

  return useMemo(
    () => ({
      status,
      owner,
      grade,
      segmentId,
      sort,
      due,
      q,
      filtered: status !== 'open' || owner !== defaultOwner || grade !== null || segmentId !== null || due || q.trim() !== '',
      update,
      clear,
    }),
    [status, owner, grade, segmentId, sort, due, q, defaultOwner, update, clear],
  );
}
