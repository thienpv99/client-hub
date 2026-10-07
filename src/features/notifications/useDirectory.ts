// People the director / AM may look at in the outbox and the digest preview, with each client user's company.
// Everything comes from the api (already scoped to the viewer's accounts).
import type { AccountRef, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import type { QueryResult } from '@/hooks/useQuery';

export interface Directory {
  /** New Era staff, sorted by name */
  internal: UserRef[];
  /** accessible accounts (sorted by name) and their client users */
  clients: { account: AccountRef; users: UserRef[] }[];
  /** client user id → company */
  accountByUser: Map<string, AccountRef>;
}

function refOf(a: AccountRef): AccountRef {
  return { id: a.id, name: a.name, short_name: a.short_name, logo_url: a.logo_url, brand_color: a.brand_color };
}

export function useDirectory(enabled: boolean): QueryResult<Directory> {
  return useQuery<Directory>(
    async () => {
      const [internal, accounts] = await Promise.all([api.listUsers({ orgType: 'internal' }), api.listAccounts()]);
      const clients = await Promise.all(
        [...accounts]
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          .map(async (a) => ({ account: refOf(a), users: await api.listUsers({ accountId: a.id }) })),
      );
      const accountByUser = new Map<string, AccountRef>();
      for (const group of clients) for (const u of group.users) accountByUser.set(u.id, group.account);
      return { internal, clients, accountByUser };
    },
    [],
    { enabled },
  );
}
