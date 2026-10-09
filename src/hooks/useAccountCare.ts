// Care data of one account (SPEC-CARE §4 getAccountCare) — deployments, request roll-up and, for the director / AM,
// the expansion map, people, relations and care. Refetches after every mutation like any useQuery.
import type { ID } from '@/domain/types';
import type { AccountCareView } from '@/services/careContract';
import { api } from '@/services/api';
import { useQuery, type QueryResult } from '@/hooks/useQuery';

export function useAccountCare(accountId: ID | null | undefined, opts?: { enabled?: boolean }): QueryResult<AccountCareView> {
  const enabled = (opts?.enabled ?? true) && !!accountId;
  return useQuery(() => api.getAccountCare(accountId as ID), [accountId], { enabled });
}
