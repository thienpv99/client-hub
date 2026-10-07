// Totals of a quote under its lines (invoice layout): subtotal, line discount, discount on the total (an input while
// editing), net, VAT and the grand total. The big number + approval live in QuoteSummaryCard.
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { QuoteTotals } from '@/services/contract';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { fmtPct } from '../lib';
import { DecimalInput } from '../components/inputs';

function Row({ label, value, muted = false, children }: { label: ReactNode; value: string; muted?: boolean; children?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 py-1">
      <dt className="flex min-w-0 items-center gap-2 text-table text-muted-foreground">
        {label}
        {children}
      </dt>
      <dd className={cn('whitespace-nowrap text-right text-table tabular', muted ? 'text-muted-foreground' : 'text-foreground')}>{value}</dd>
    </div>
  );
}

export interface TotalsBreakdownProps {
  totals: QuoteTotals;
  /** stored discount on the total, % (read-only mode) */
  headerPct: number;
  /** edit mode: the "Chiết khấu trên tổng" field */
  headerInput?: { value: string; onChange: (raw: string) => void; invalid: boolean };
  className?: string;
}

export function TotalsBreakdown({ totals, headerPct, headerInput, className }: TotalsBreakdownProps) {
  const uid = useId();
  const minus = (v: number) => (v > 0 ? `−${formatMoney(v)}` : formatMoney(0));
  const showHeader = !!headerInput || totals.header_discount > 0;
  return (
    <div className={className}>
      <dl>
        <Row label={t('commercial.totals.subtotal')} value={formatMoney(totals.subtotal)} />
        {totals.line_discount > 0 ? <Row label={t('commercial.totals.lineDiscount')} value={minus(totals.line_discount)} /> : null}
        {showHeader ? (
          <Row
            label={
              headerInput ? (
                <label htmlFor={`${uid}-hdr`}>{t('commercial.totals.headerDiscountInput')}</label>
              ) : (
                t('commercial.totals.headerDiscount', { pct: fmtPct(headerPct) })
              )
            }
            value={minus(totals.header_discount)}
            muted={totals.header_discount === 0}
          >
            {headerInput ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <DecimalInput
                  id={`${uid}-hdr`}
                  value={headerInput.value}
                  onValueChange={headerInput.onChange}
                  aria-invalid={headerInput.invalid || undefined}
                  inputSize="sm"
                  className="w-16 px-2 md:w-14"
                />
                <span aria-hidden="true">%</span>
              </span>
            ) : null}
          </Row>
        ) : null}
        <Row label={t('commercial.totals.net')} value={formatMoney(totals.net_before_vat)} />
        <Row label={t('commercial.totals.vat')} value={formatMoney(totals.vat)} />
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border/70 pt-3">
          <dt className="text-table font-semibold text-foreground">{t('commercial.totals.grand')}</dt>
          <dd className="whitespace-nowrap text-right text-heading font-semibold tabular tracking-tightish text-ink">{formatMoney(totals.grand_total)}</dd>
        </div>
      </dl>
      {headerInput?.invalid ? <p className="mt-1 text-[13px] leading-[18px] text-danger">{t('commercial.editor.pctInvalid')}</p> : null}
    </div>
  );
}
