// Sticky band shown while New Era staff use "Xem như khách hàng" (read-only client view).
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, LogOut } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { setViewAsExitTarget } from '@/features/shell/routing';
import { toastApiError } from '@/hooks/useAction';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';

/** Leave view-as mode and go back to the account page it was opened from. */
export function useExitViewAs(): { exit: () => Promise<void>; pending: boolean } {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const exit = useCallback(async () => {
    const accountId = api.getViewer()?.impersonating?.account_id ?? null;
    const target = accountId ? `/app/accounts/${accountId}` : '/app';
    setPending(true);
    setViewAsExitTarget(target);
    try {
      await api.stopViewAsClient();
      navigate(target, { replace: true });
      // keep the target a moment for a guard render that may still be queued
      setTimeout(() => setViewAsExitTarget(null), 1500);
    } catch (err) {
      setViewAsExitTarget(null);
      toastApiError(err);
    } finally {
      setPending(false);
    }
  }, [navigate]);
  return { exit, pending };
}

export function ViewAsClientBanner({ accountName }: { accountName?: string | null }) {
  const viewer = useViewer();
  const { exit, pending } = useExitViewAs();
  if (!viewer?.impersonating) return null;
  const name = accountName ?? viewer.user.full_name;

  return (
    <div role="status" className="border-b border-warning/20 bg-warning-soft text-warning">
      <div className="mx-auto flex min-h-10 max-w-[1120px] items-center gap-2.5 px-4 py-1 md:px-6">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80" aria-hidden>
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-table">
          <span className="truncate">
            <span className="font-medium">{t('layout.viewAs.banner')}</span>
            <span className="hidden sm:inline">
              {t('common.separator')}
              <span className="font-semibold">{name}</span>
            </span>
          </span>
          <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-warning/30 bg-card/70 px-2 text-micro font-medium">
            {t('layout.viewAs.readOnly')}
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 text-warning hover:bg-card/70 hover:text-warning"
          onClick={() => void exit()}
          loading={pending}
          aria-label={t('layout.viewAs.exitLabel')}
        >
          {!pending && <LogOut aria-hidden />}
          {t('layout.viewAs.exit')}
        </Button>
      </div>
    </div>
  );
}
