import type { LucideIcon } from 'lucide-react';
import { CloudOff, Lock, RefreshCw, SearchX } from 'lucide-react';
import type { ApiErrorCode } from '@/services/contract';
import { t } from '@/i18n';
import { apiErrorMessage } from '@/lib/errors';
import { cx } from './cx';
import { EmptyIcon } from './empty-state';
import type { EmptyIconTone } from './empty-state';
import { Button } from '@/components/ui/button';

/**
 * User-facing message for an unknown error: ApiError.messageKey when translatable (the '_detail' variant filled
 * from ApiError.details when it exists), else a neutral sentence.
 */
export function errorMessage(error: unknown): string {
  return apiErrorMessage(error, 'components.error.description');
}

type ErrorKind = 'denied' | 'not_found' | 'failed';

/** permission and missing-content errors are final: another icon and title, and no "Thử lại" */
function kindOf(error: unknown): ErrorKind {
  // duck-typed like lib/errors: what reaches the UI is ApiError-like
  const raw: unknown = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  const code = typeof raw === 'string' ? (raw as ApiErrorCode) : null;
  if (code === 'forbidden' || code === 'unauthenticated') return 'denied';
  if (code === 'not_found') return 'not_found';
  return 'failed';
}

const LOOK: Record<ErrorKind, { icon: LucideIcon; titleKey: string; tone: EmptyIconTone }> = {
  denied: { icon: Lock, titleKey: 'components.error.deniedTitle', tone: 'neutral' },
  not_found: { icon: SearchX, titleKey: 'components.error.notFoundTitle', tone: 'neutral' },
  failed: { icon: CloudOff, titleKey: 'components.error.title', tone: 'danger' },
};

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({ error, onRetry, compact = false, className }: ErrorStateProps) {
  const kind = kindOf(error);
  const look = LOOK[kind];
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-12',
        className,
      )}
    >
      <EmptyIcon icon={look.icon} tone={look.tone} compact={compact} />
      <div className="max-w-md space-y-1">
        <p className={cx('text-balance text-ink', compact ? 'text-table font-medium' : 'text-heading font-semibold tracking-tightish')}>
          {t(look.titleKey)}
        </p>
        <p className="text-balance text-table text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && kind === 'failed' ? (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t('components.error.retry')}
        </Button>
      ) : null}
    </div>
  );
}
