// One user in Settings › Người dùng. The card is a size container: on a wide card (≥ 56rem) the row has three
// columns (person · company / title + sign-in · role); narrower cards keep person + role side by side (md), and
// phones stack them. Active accounts show only their last sign-in; "Đã mời" / "Đã khóa" get a status pill.
import { Ban, KeyRound, Mail } from 'lucide-react';
import type { ISODateTime, UserStatus } from '@/domain/types';
import type { AccountRef, Role, UserRef } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { t } from '@/i18n';

export interface UserRow {
  user: UserRef;
  account: AccountRef | null;
  /** null when the viewer's data source does not tell (AM view of New Era staff) */
  status: UserStatus | null;
  lastLoginAt: ISODateTime | null;
  /** false = last sign-in unknown to this viewer (do not print "Chưa đăng nhập") */
  loginKnown: boolean;
  /** null = not known to this viewer */
  canViewCost: boolean | null;
}

const INTERNAL_ROLES: Role[] = ['director', 'am', 'member'];
const CLIENT_ROLES: Role[] = ['client_owner', 'client_member'];

// Container-query classes are written out in full (never composed) so Tailwind finds them when scanning sources.
/** grid of a wide row (≥ 48rem card), also used by the column header */
export const WIDE_GRID = '[@container_(min-width:48rem)]:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_15rem]';

function sameText(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');
}

/** pill for the statuses that need attention; an active account shows nothing */
export function UserStatusTag({ status }: { status: UserStatus }) {
  if (status === 'active') return null;
  if (status === 'invited') {
    return (
      <Badge size="sm">
        <Mail aria-hidden="true" />
        {t('enums.userStatus.invited')}
      </Badge>
    );
  }
  return (
    <Badge size="sm">
      <Ban aria-hidden="true" />
      {t('enums.userStatus.disabled')}
    </Badge>
  );
}

function LastLogin({ row }: { row: UserRow }) {
  if (!row.loginKnown) return null;
  if (!row.lastLoginAt) return <span className="text-micro text-muted-foreground">{t('settings.users.neverLoggedIn')}</span>;
  return (
    <span className="text-micro text-muted-foreground">
      {t('settings.users.lastLogin')} <DateText value={row.lastLoginAt} relative />
    </span>
  );
}

/** status pill + last sign-in on one line (nothing when neither is known) */
function StatusLine({ row, className }: { row: UserRow; className?: string }) {
  const pill = row.status && row.status !== 'active';
  if (!pill && !row.loginKnown) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {row.status ? <UserStatusTag status={row.status} /> : null}
      <LastLogin row={row} />
    </span>
  );
}

export function UserListRow({
  row,
  editable,
  isSelf,
  role,
  canViewCost,
  busy,
  onRoleChange,
  onCostChange,
}: {
  row: UserRow;
  /** director: role select + cost switch */
  editable: boolean;
  isSelf: boolean;
  /** shown role (optimistic while saving) */
  role: Role;
  canViewCost: boolean | null;
  busy: boolean;
  onRoleChange: (role: Role) => void;
  onCostChange: (allowed: boolean) => void;
}) {
  const u = row.user;
  const internal = u.org_type === 'internal';
  const roles = internal ? INTERNAL_ROLES : CLIENT_ROLES;
  const selectId = `user-role-${u.id}`;
  const costId = `user-cost-${u.id}`;

  const org = internal ? (
    u.title ? <span className="truncate">{u.title}</span> : null
  ) : (
    <>
      {row.account ? <AccountLogo account={row.account} size="xs" /> : null}
      <span className="truncate">{[row.account?.name, u.title].filter(Boolean).join(t('common.separator'))}</span>
    </>
  );
  // stacked layout: the role sits right under this line, so a job title that only repeats it ("Giám đốc") is dropped
  const titleRepeatsRole = internal && !!u.title && sameText(u.title, t(`enums.role.${role}`));
  const compactOrg = titleRepeatsRole ? null : org;

  return (
    <li
      className={cn(
        'grid gap-3 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-x-6',
        WIDE_GRID,
        '[@container_(min-width:48rem)]:items-center',
      )}
    >
      {/* person (+ company / title and sign-in below it until the card is wide) */}
      <div className="flex min-w-0 items-start gap-3">
        <UserAvatar user={u} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-table font-semibold text-foreground">{u.full_name}</span>
            {isSelf ? (
              <Badge size="sm" title={t('settings.users.self')}>
                {t('settings.users.selfShort')}
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-caption">{u.email}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 [@container_(min-width:48rem)]:hidden">
            {compactOrg ? (
              <span className="flex min-w-0 max-w-full items-center gap-1.5 text-micro text-muted-foreground">{compactOrg}</span>
            ) : null}
            {compactOrg && (row.loginKnown || (row.status && row.status !== 'active')) ? (
              <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-muted-foreground/60" />
            ) : null}
            <StatusLine row={row} />
          </div>
        </div>
      </div>

      {/* wide card: its own column */}
      <div className="hidden min-w-0 space-y-1 [@container_(min-width:48rem)]:block">
        {org ? (
          <p className="flex min-w-0 items-center gap-1.5 text-table text-foreground">{org}</p>
        ) : (
          <p className="text-caption">{t('settings.users.noTitle')}</p>
        )}
        <StatusLine row={row} />
      </div>

      {/* role and the cost permission */}
      <div className="min-w-0 space-y-2 pl-10 md:pl-0">
        {editable && !isSelf ? (
          <>
            <label htmlFor={selectId} className="sr-only">
              {t('settings.users.roleFor', { name: u.full_name })}
            </label>
            <NativeSelect id={selectId} size="sm" value={role} disabled={busy} onChange={(e) => onRoleChange(e.target.value as Role)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`enums.role.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </>
        ) : (
          <p className="text-table font-medium text-foreground">{t(`enums.role.${role}`)}</p>
        )}
        {internal && role === 'director' && canViewCost !== null ? (
          <p className="flex items-center gap-1.5 text-micro text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('settings.users.cost.always')}
          </p>
        ) : null}
        {internal && role === 'am' && canViewCost !== null ? (
          editable ? (
            <label htmlFor={costId} className="flex min-h-tap w-fit cursor-pointer items-center gap-2.5 md:min-h-8">
              <Switch
                id={costId}
                checked={canViewCost}
                disabled={busy || u.role !== 'am'}
                onCheckedChange={onCostChange}
                aria-label={t('settings.users.cost.aria', { name: u.full_name })}
              />
              <span className="text-table text-foreground">{t('settings.users.cost.label')}</span>
            </label>
          ) : (
            <p className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {canViewCost ? t('settings.users.cost.granted') : t('settings.users.cost.notGranted')}
            </p>
          )
        ) : null}
      </div>
    </li>
  );
}
