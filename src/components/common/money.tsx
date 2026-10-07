import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { cx } from './cx';

export interface MoneyProps {
  /** VND */
  value: number;
  /** "1,25 tỷ ₫" (full amount in the tooltip) instead of "1.250.000.000 ₫" */
  compact?: boolean;
  className?: string;
}

export function Money({ value, compact = false, className }: MoneyProps) {
  const full = formatMoney(value);
  return (
    <span className={cx('tabular whitespace-nowrap', className)} title={compact ? full : undefined}>
      {compact ? formatMoneyCompact(value) : full}
    </span>
  );
}
