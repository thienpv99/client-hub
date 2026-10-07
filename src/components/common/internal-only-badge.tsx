import { Lock } from 'lucide-react';
import { t } from '@/i18n';
import { cx } from './cx';

/** Lock + "Chỉ nội bộ" on note colours (cost, margin, internal files and notes). */
export function InternalOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-note pl-1.5 pr-2 text-micro font-medium text-muted-foreground ring-1 ring-inset ring-note-border',
        className,
      )}
    >
      <Lock className="h-3 w-3 shrink-0 text-warning" strokeWidth={2.25} aria-hidden="true" />
      {t('components.internal.only')}
    </span>
  );
}
