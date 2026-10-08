// AM in charge of the account. The director reassigns it from a small menu (with a 5-second undo).
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AccountDetail, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { toastApiError, useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/common/user-avatar';

function AmName({ am }: { am: UserRef }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {/* the header sits on the page background: a white disc keeps the initials reading as an avatar */}
      <UserAvatar user={am} size="xs" className="bg-card" />
      <span className="truncate text-table font-medium text-foreground">{am.full_name}</span>
    </span>
  );
}

export interface AmMenuProps {
  account: AccountDetail;
  canAssign: boolean;
}

export function AmMenu({ account, canAssign }: AmMenuProps) {
  const [open, setOpen] = useState(false);
  const { run, pending, pendingVisible } = useAction();
  const ams = useQuery(() => api.listUsers({ orgType: 'internal', role: 'am' }), [], { enabled: canAssign && open });

  if (!canAssign) return <AmName am={account.am} />;

  async function assign(amId: string) {
    const previous = account.am;
    if (amId === previous.id || pending) return;
    const next = ams.data?.find((u) => u.id === amId);
    const result = await run(() => api.assignAm(account.id, amId));
    if (!result) return;
    toastSuccess(t('account.am.assigned', { name: next?.full_name ?? result.am.full_name, account: account.name }), {
      onUndo: async () => {
        try {
          await api.assignAm(account.id, previous.id);
          toastSuccess(t('common.toast.undone'));
        } catch (err) {
          toastApiError(err);
        }
      },
    });
  }

  // the current AM may be the director or someone outside the list: keep them selectable
  const options: UserRef[] = ams.data ? [...ams.data] : [];
  if (ams.data && !options.some((u) => u.id === account.am.id)) options.unshift(account.am);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // dims only once the reassignment takes 150 ms (DESIGN §8.2); `assign` itself ignores a second pick
          disabled={pendingVisible}
          aria-busy={pending || undefined}
          aria-label={t('account.am.change', { name: account.am.full_name })}
          className={cn(
            // -ml-1.5 aligns the avatar with the label above; the max width gives that margin back (no early ellipsis)
            'touch-tap -ml-1.5 inline-flex min-h-tap max-w-[calc(100%+0.375rem)] items-center gap-1.5 rounded-lg px-1.5 transition-colors duration-150 ease-out-quart hover:bg-muted sm:shrink-0 md:min-h-8',
            'disabled:opacity-60 data-[state=open]:bg-muted',
          )}
        >
          <AmName am={account.am} />
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('account.am.menuTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ams.loading || !ams.data ? (
          <div className="space-y-2 p-2" role="status" aria-label={t('account.am.loading')}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-32" />
          </div>
        ) : (
          <DropdownMenuRadioGroup value={account.am.id} onValueChange={(v) => void assign(v)}>
            {options.map((u) => (
              <DropdownMenuRadioItem key={u.id} value={u.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{u.full_name}</span>
                  {u.title ? <span className="block truncate text-micro text-muted-foreground">{u.title}</span> : null}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
