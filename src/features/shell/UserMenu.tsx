// Avatar menu of both layouts: identity, shortcuts, demo reset (internal), logout / leave view-as.
// variant 'avatar' (top bars) = round avatar button · 'sidebar' = full-width user card at the bottom of the sidebar.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ChevronsUpDown, FlaskConical, LogOut, Newspaper, RotateCcw } from 'lucide-react';
import { api } from '@/services/api';
import { UserAvatar } from '@/components/common/user-avatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExitViewAs } from '@/layouts/ViewAsClientBanner';
import { toastApiError } from '@/hooks/useAction';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { homePathFor, LOGIN_PATH } from './routing';
import { sweepNow } from './SessionEffects';

export interface UserMenuProps {
  side: 'internal' | 'client';
  /** client company name shown under the user's name */
  accountName?: string | null;
  className?: string;
  /** 'avatar' (default): round avatar button for top bars · 'sidebar': full-width user card */
  variant?: 'avatar' | 'sidebar';
}

const itemClass = 'min-h-tap gap-3 rounded-lg px-2.5 text-table md:min-h-9';

export function UserMenu({ side, accountName, className, variant = 'avatar' }: UserMenuProps) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const { exit: exitViewAs } = useExitViewAs();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!viewer) return null;
  const user = viewer.user;
  const roleLabel = t(`enums.role.${viewer.role}`);
  const subtitle = side === 'client' && accountName ? `${roleLabel}${t('common.separator')}${accountName}` : roleLabel;
  // the API allows the demo reset to the director and AMs only
  const canReset = !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');
  const isCard = variant === 'sidebar';

  async function logout() {
    try {
      await api.logout();
    } catch (err) {
      toastApiError(err);
      return;
    }
    navigate(LOGIN_PATH, { replace: true });
  }

  async function resetDemo() {
    setResetting(true);
    try {
      await api.resetDemoData();
      // the fresh data has no sweep date yet: today's reminders / bulletin run right away
      sweepNow();
      setResetOpen(false);
      toastSuccess(t('layout.userMenu.resetDone'));
      navigate(homePathFor(api.getViewer()), { replace: true });
    } catch (err) {
      toastApiError(err);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      {/* non-modal so the confirm dialog can open right after the menu closes */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {isCard ? (
            <button
              type="button"
              aria-label={t('layout.userMenu.labelNamed', { name: user.full_name })}
              className={cn(
                'touch-tap group flex w-full min-w-0 items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 ease-out-quart hover:bg-muted data-[state=open]:bg-muted',
                className,
              )}
            >
              <UserAvatar user={user} size="sm" className="h-8 w-8" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-table font-medium text-foreground">{user.full_name}</span>
                <span className="mt-0.5 block truncate text-micro text-muted-foreground">{roleLabel}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-caption transition-colors group-hover:text-foreground" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              aria-label={t('layout.userMenu.labelNamed', { name: user.full_name })}
              className={cn(
                'touch-tap-square flex min-h-tap min-w-tap items-center justify-center rounded-full transition-colors duration-150 ease-out-quart hover:bg-muted data-[state=open]:bg-muted md:h-10 md:min-h-0 md:w-10 md:min-w-0',
                className,
              )}
            >
              <UserAvatar user={user} size="sm" className="h-8 w-8 ring-2 ring-card" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isCard ? 'start' : 'end'}
          side={isCard ? 'top' : 'bottom'}
          sideOffset={8}
          className={cn('rounded-xl p-1.5', isCard ? 'w-[var(--radix-dropdown-menu-trigger-width)] min-w-[232px]' : 'w-72')}
        >
          <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2.5 font-normal">
            <UserAvatar user={user} size="md" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-table font-semibold text-ink">{user.full_name}</span>
              <span className="mt-0.5 block truncate text-micro text-muted-foreground">{subtitle}</span>
              <span className="mt-0.5 block truncate text-micro text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="-mx-1.5" />

          {side === 'internal' ? (
            <>
              <DropdownMenuItem className={itemClass} onSelect={() => navigate('/app/digest')}>
                <Newspaper aria-hidden />
                {t('layout.userMenu.digest')}
              </DropdownMenuItem>
              {viewer.role === 'director' ? (
                <DropdownMenuItem className={itemClass} onSelect={() => navigate('/dev/selftest')}>
                  <FlaskConical aria-hidden />
                  {t('layout.userMenu.selfTest')}
                </DropdownMenuItem>
              ) : null}
              {canReset ? (
                <DropdownMenuItem className={itemClass} onSelect={() => setResetOpen(true)}>
                  <RotateCcw aria-hidden />
                  {t('layout.userMenu.resetDemo')}
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <DropdownMenuItem className={itemClass} onSelect={() => navigate('/portal/settings')}>
              <BellRing aria-hidden />
              {t('layout.userMenu.notificationSettings')}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="-mx-1.5" />
          {viewer.impersonating ? (
            <DropdownMenuItem className={itemClass} onSelect={() => void exitViewAs()}>
              <LogOut aria-hidden />
              {t('layout.userMenu.exitViewAs')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className={itemClass} onSelect={() => void logout()}>
              <LogOut aria-hidden />
              {t('layout.userMenu.logout')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={resetOpen} onOpenChange={(open) => !resetting && setResetOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('layout.userMenu.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('layout.userMenu.resetDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t('common.cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" loading={resetting} onClick={() => void resetDemo()}>
              {t('layout.userMenu.resetConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
