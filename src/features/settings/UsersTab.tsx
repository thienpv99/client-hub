// "Người dùng & vai trò": every New Era and client login with role, company, status and last sign-in.
// Director: change roles, grant AMs "Được xem giá vốn", invite internal users (action in the "Nội bộ New Era" card
// header, so the toolbar keeps search + filter on one row on iPad). Others: read-only list of what they may see
// (their team + the client users of their own accounts).
import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import type { ISODateTime, UserStatus } from '@/domain/types';
import type { AccountRef, Role, UserRef, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import { emailDomainOf } from './emailRules';
import { InviteInternalDialog } from './InviteInternalDialog';
import { UserListRow, WIDE_GRID, type UserRow } from './UserListRow';

type Group = 'internal' | 'client';
type GroupFilter = Group | 'all';

const ROLE_ORDER: Record<Role, number> = { director: 0, am: 1, member: 2, client_owner: 3, client_member: 4 };

function sortRows(rows: UserRow[]): UserRow[] {
  return rows.sort(
    (a, b) =>
      (a.user.org_type === 'internal' ? 0 : 1) - (b.user.org_type === 'internal' ? 0 : 1) ||
      (a.account?.name ?? '').localeCompare(b.account?.name ?? '', 'vi') ||
      ROLE_ORDER[a.user.role] - ROLE_ORDER[b.user.role] ||
      a.user.full_name.localeCompare(b.user.full_name, 'vi'),
  );
}

/** director: the full admin list */
async function loadAdminRows(): Promise<UserRow[]> {
  const [users, accounts] = await Promise.all([api.listAllUsers(), api.listAccounts()]);
  const byId = new Map<string, AccountRef>(accounts.map((a) => [a.id, a]));
  return sortRows(
    users.map((u) => {
      const account: AccountRef | null = u.account_id
        ? byId.get(u.account_id) ?? {
            id: u.account_id,
            name: u.account_name ?? '',
            short_name: u.account_name ?? '',
            logo_url: null,
            brand_color: '',
          }
        : null;
      return {
        user: u,
        account,
        status: u.status,
        lastLoginAt: u.last_login_at,
        loginKnown: true,
        canViewCost: u.can_view_cost,
      };
    }),
  );
}

/** AM: New Era's team + the client users of the accounts this AM manages (no admin endpoint needed) */
async function loadTeamRows(): Promise<UserRow[]> {
  const [internal, accounts] = await Promise.all([api.listUsers({ orgType: 'internal' }), api.listAccounts()]);
  const contactLists = await Promise.all(accounts.map((a) => api.listContacts(a.id)));
  const rows: UserRow[] = internal.map((u: UserRef) => ({
    user: u,
    account: null,
    status: null,
    lastLoginAt: null,
    loginKnown: false,
    canViewCost: null,
  }));
  contactLists.forEach((contacts, i) => {
    const account = accounts[i];
    for (const c of contacts) {
      if (!c.user || !account) continue;
      const status: UserStatus = c.user.status;
      const lastLoginAt: ISODateTime | null = c.user.last_login_at;
      rows.push({ user: c.user, account, status, lastLoginAt, loginKnown: true, canViewCost: null });
    }
  });
  return sortRows(rows);
}

interface Pending {
  role?: Role;
  cost?: boolean;
}

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center" aria-hidden="true">
        <Skeleton className="h-11 w-full rounded-lg sm:w-[280px] md:h-8" />
        <Skeleton className="h-11 w-56 rounded-full sm:h-8" />
      </div>
      <ListSkeleton rows={4} />
      <ListSkeleton rows={3} />
    </div>
  );
}

export function UsersTab({ viewer }: { viewer: Viewer }) {
  const isDirector = viewer.role === 'director';
  const { data, loading, error, refetch } = useQuery(() => (isDirector ? loadAdminRows() : loadTeamRows()), [isDirector]);
  const { run } = useAction();
  const [group, setGroup] = useState<GroupFilter>('all');
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  // optimistic values while a change is saved (cleared when fresh data arrives)
  const [optimistic, setOptimistic] = useState<Record<string, Pending>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => setOptimistic({}), [data]);

  const rows = data ?? [];
  const counts = useMemo(
    () => ({
      all: rows.length,
      internal: rows.filter((r) => r.user.org_type === 'internal').length,
      client: rows.filter((r) => r.user.org_type === 'client').length,
    }),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return rows.filter((r) => {
      if (group !== 'all' && r.user.org_type !== group) return false;
      if (!q) return true;
      const hay = normalizeText(`${r.user.full_name} ${r.user.email} ${r.user.title ?? ''} ${r.account?.name ?? ''}`);
      return hay.includes(q);
    });
  }, [rows, group, query]);

  async function changeRole(row: UserRow, role: Role) {
    if (role === row.user.role) return;
    const id = row.user.id;
    setOptimistic((o) => ({ ...o, [id]: { ...o[id], role } }));
    setBusy((b) => ({ ...b, [id]: true }));
    const result = await run(() => api.setUserRole(id, role), {
      success: 'settings.users.toast.role',
      successParams: { name: row.user.full_name, role: t(`enums.role.${role}`) },
    });
    setBusy((b) => ({ ...b, [id]: false }));
    if (!result) setOptimistic((o) => ({ ...o, [id]: { ...o[id], role: undefined } }));
  }

  async function changeCost(row: UserRow, allowed: boolean) {
    const id = row.user.id;
    setOptimistic((o) => ({ ...o, [id]: { ...o[id], cost: allowed } }));
    setBusy((b) => ({ ...b, [id]: true }));
    const result = await run(() => api.setUserCanViewCost(id, allowed), {
      success: allowed ? 'settings.users.toast.costOn' : 'settings.users.toast.costOff',
      successParams: { name: row.user.full_name },
    });
    setBusy((b) => ({ ...b, [id]: false }));
    if (!result) setOptimistic((o) => ({ ...o, [id]: { ...o[id], cost: undefined } }));
  }

  if (loading) return <UsersSkeleton />;
  if (error && !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const groups: Group[] = (['internal', 'client'] as const).filter((g) => filtered.some((r) => r.user.org_type === g));
  const searching = query.trim() !== '';
  // inviting a New Era user is an action of the "Nội bộ New Era" card (its header), not of the whole list
  const canInvite = isDirector && !viewer.read_only;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          inputSize="sm"
          icon={<Search />}
          wrapperClassName="w-full sm:w-[240px] lg:w-[280px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('settings.users.searchPlaceholder')}
          aria-label={t('settings.users.searchLabel')}
        />
        <ChipFilter<GroupFilter>
          ariaLabel={t('settings.users.filter.label')}
          allowDeselect={false}
          value={group}
          onChange={(v) => setGroup(v ?? 'all')}
          options={[
            { value: 'all', label: t('settings.users.filter.all'), count: counts.all },
            { value: 'internal', label: t('settings.users.filter.internal'), count: counts.internal },
            { value: 'client', label: t('settings.users.filter.client'), count: counts.client },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={searching ? t('settings.users.empty.search', { query: query.trim() }) : t('settings.users.empty.group')}
            action={
              searching || group !== 'all' ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setGroup('all');
                  }}
                >
                  {t('settings.users.empty.clear')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        groups.map((g) => {
          const list = filtered.filter((r) => r.user.org_type === g);
          return (
            <SectionCard
              key={g}
              title={
                <span className="inline-flex items-center gap-2">
                  {t(`settings.users.groups.${g}`)}
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
                    <span aria-hidden="true">{list.length}</span>
                    <span className="sr-only">{t('settings.users.groupCount', { count: list.length })}</span>
                  </span>
                </span>
              }
              description={
                g === 'internal'
                  ? t(isDirector ? 'settings.users.groupHint.internal' : 'settings.users.groupHint.internalReadOnly')
                  : t('settings.users.groupHint.client')
              }
              actions={
                g === 'internal' && canInvite ? (
                  // phones: short label, so the card title keeps its width (the header row does not wrap)
                  <Button size="sm" variant="secondary" aria-label={t('settings.users.invite.open')} onClick={() => setInviteOpen(true)}>
                    <UserPlus aria-hidden="true" />
                    <span className="sm:hidden">{t('settings.users.invite.openShort')}</span>
                    <span className="hidden sm:inline">{t('settings.users.invite.open')}</span>
                  </Button>
                ) : null
              }
              as="h3"
              flush
              className="overflow-hidden [container-type:inline-size]"
            >
              <div
                aria-hidden="true"
                className={cn(
                  'hidden h-9 items-center gap-x-6 border-t border-border/60 bg-subtle px-5 text-micro font-medium text-muted-foreground [@container_(min-width:48rem)]:grid',
                  WIDE_GRID,
                )}
              >
                <span>{t('settings.users.columns.user')}</span>
                <span>{g === 'internal' ? t('settings.users.columns.title') : t('settings.users.columns.account')}</span>
                <span>{t('settings.users.columns.role')}</span>
              </div>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {list.map((row) => {
                  const o = optimistic[row.user.id];
                  return (
                    <UserListRow
                      key={row.user.id}
                      row={row}
                      editable={isDirector && !viewer.read_only}
                      isSelf={row.user.id === viewer.user.id}
                      role={o?.role ?? row.user.role}
                      canViewCost={o?.cost ?? row.canViewCost}
                      busy={Boolean(busy[row.user.id])}
                      onRoleChange={(role) => void changeRole(row, role)}
                      onCostChange={(allowed) => void changeCost(row, allowed)}
                    />
                  );
                })}
              </ul>
            </SectionCard>
          );
        })
      )}

      {isDirector ? (
        <InviteInternalDialog open={inviteOpen} onOpenChange={setInviteOpen} domain={emailDomainOf(viewer.user.email)} />
      ) : null}
    </div>
  );
}
