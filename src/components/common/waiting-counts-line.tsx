import { Building2, CircleAlert } from 'lucide-react';
import type { WaitingCounts } from '@/services/contract';
import { t } from '@/i18n';
import { cx } from './cx';
import { NewEraMark } from './new-era-logo';

function StatChip({
  side,
  label,
  count,
  overdue,
}: {
  side: 'client' | 'internal';
  label: string;
  count: number;
  overdue: number | null;
}) {
  return (
    <span className="inline-flex min-h-7 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md bg-muted py-[5px] pl-1.5 pr-2 text-[13px] leading-[18px] text-muted-foreground">
      {side === 'client' ? (
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <NewEraMark className="h-3.5 w-3.5" />
      )}
      <span className="whitespace-nowrap">
        {label} <span className="font-semibold tabular text-foreground">{count}</span>
      </span>
      {overdue !== null && overdue > 0 ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap border-l border-border-strong pl-1.5 font-medium text-danger">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
  className?: string;
}

/** Two compact stat chips: [Đang chờ khách 3] [Đang chờ New Era 2] (SPEC §1.4) */
export function WaitingCountsLine({ counts, showOverdue = false, className }: WaitingCountsLineProps) {
  return (
    <p className={cx('flex flex-wrap items-center gap-1.5', className)}>
      <StatChip
        side="client"
        label={t('components.waiting.client')}
        count={counts.waiting_client}
        overdue={showOverdue ? counts.overdue_client : null}
      />
      <span className="sr-only">, </span>
      <StatChip
        side="internal"
        label={t('components.waiting.internal')}
        count={counts.waiting_internal}
        overdue={showOverdue ? counts.overdue_internal : null}
      />
    </p>
  );
}
