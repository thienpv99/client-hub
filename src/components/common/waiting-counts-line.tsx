import { Building2, CircleAlert } from 'lucide-react';
import type { WaitingCounts } from '@/services/contract';
import { t } from '@/i18n';
import { cx } from './cx';
import { NewEraMark } from './new-era-logo';

function StatChip({
  side,
  label,
  fullLabel,
  count,
  overdue,
  compact,
}: {
  side: 'client' | 'internal';
  label: string;
  /** the long wording for screen readers when the visible label is the short one */
  fullLabel: string;
  count: number;
  overdue: number | null;
  compact: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full flex-wrap items-center gap-y-0.5 rounded-md bg-muted text-muted-foreground',
        compact ? 'min-h-6 gap-x-1 py-1 pl-1.5 pr-1.5 text-micro' : 'min-h-7 gap-x-1.5 py-[5px] pl-1.5 pr-2 text-[13px] leading-[18px]',
      )}
    >
      {side === 'client' ? (
        <Building2 className={cx('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
      ) : (
        <NewEraMark className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      )}
      <span className="whitespace-nowrap">
        {label === fullLabel ? (
          label
        ) : (
          <>
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{fullLabel}</span>
          </>
        )}{' '}
        <span className="font-semibold tabular text-foreground">{count}</span>
      </span>
      {overdue !== null && overdue > 0 ? (
        <span
          className={cx(
            'inline-flex items-center gap-1 whitespace-nowrap border-l border-border-strong font-medium text-danger',
            compact ? 'pl-1' : 'pl-1.5',
          )}
        >
          <CircleAlert className={cx('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
          <span className="tabular">{t('components.waiting.overdue', { count: overdue })}</span>
        </span>
      ) : null}
    </span>
  );
}

export interface WaitingCountsLineProps {
  counts: WaitingCounts;
  /** add "1 quá hạn" in danger text inside each chip when > 0 */
  showOverdue?: boolean;
  /**
   * narrow cards (≤ ~320px: portfolio / list cards on phones and 2-up iPad): 12px chips with the short labels
   * "Chờ khách 3" / "Chờ New Era 2", so both usually share one line
   */
  compact?: boolean;
  className?: string;
}

/** Two compact stat chips: [Đang chờ khách 3] [Đang chờ New Era 2] (SPEC §1.4) */
export function WaitingCountsLine({ counts, showOverdue = false, compact = false, className }: WaitingCountsLineProps) {
  const client = t('components.waiting.client');
  const internal = t('components.waiting.internal');
  return (
    <p className={cx('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-1.5', className)}>
      <StatChip
        side="client"
        label={compact ? t('components.waiting.clientShort') : client}
        fullLabel={client}
        count={counts.waiting_client}
        overdue={showOverdue ? counts.overdue_client : null}
        compact={compact}
      />
      <span className="sr-only">, </span>
      <StatChip
        side="internal"
        label={compact ? t('components.waiting.internalShort') : internal}
        fullLabel={internal}
        count={counts.waiting_internal}
        overdue={showOverdue ? counts.overdue_internal : null}
        compact={compact}
      />
    </p>
  );
}
