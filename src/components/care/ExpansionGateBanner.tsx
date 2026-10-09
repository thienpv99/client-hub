// The expansion gate (SPEC-CARE §3): "Còn N yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới."
// An inset danger panel (icon + words, DESIGN §7.5 inset recipe), shown only while delivery debt > 0. Optional link
// to the debt list; the director sees that an exception (with a logged reason) is possible.
import { OctagonX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';

export interface ExpansionGateBannerProps {
  /** delivery-debt requests of the account (AccountCareView.expansion.debt_count / requests.debt) */
  debtCount: number;
  /** "Xem yêu cầu đang nợ" (e.g. switch the Triển khai filter to Nợ triển khai) */
  onViewDebt?: () => void;
  /** show the director's override hint */
  canOverride?: boolean;
  /** compact single line (cards, summary bars) */
  compact?: boolean;
  className?: string;
}

export function ExpansionGateBanner({ debtCount, onViewDebt, canOverride = false, compact = false, className }: ExpansionGateBannerProps) {
  if (debtCount <= 0) return null;
  const sentence = t('care.gate.blocked', { count: debtCount });
  if (compact) {
    return (
      <p role="status" className={cn('flex items-start gap-2 text-[13px] leading-[18px] text-danger', className)}>
        <OctagonX className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 text-pretty">{sentence}</span>
      </p>
    );
  }
  return (
    <div role="status" className={cn('flex flex-col gap-3 rounded-lg bg-danger-soft p-3 ring-1 ring-inset ring-danger/15 sm:flex-row sm:items-center', className)}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-danger" aria-hidden="true">
          <OctagonX className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-table font-semibold text-danger">{t('care.kit.gateTitle')}</p>
          <p className="mt-0.5 text-pretty text-table text-foreground">{sentence}</p>
          {canOverride ? <p className="mt-1 text-pretty text-[13px] leading-[18px] text-muted-foreground">{t('care.kit.gateOverrideHint')}</p> : null}
        </div>
      </div>
      {onViewDebt ? (
        <Button type="button" variant="secondary" size="sm" className="shrink-0 self-start sm:self-center" onClick={onViewDebt}>
          {t('care.kit.viewDebt')}
        </Button>
      ) : null}
    </div>
  );
}
