// The focal block of a quote (side column from xl, first card below): the grand total as the hero number, the
// effective discount against the approval threshold (meter + one status word), cost and margin on note tint when the
// api returned them, then the workflow actions with the gating explanation.
import type { ReactNode } from 'react';
import { CircleCheck, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { QuoteTotals } from '@/services/contract';
import { CountUp } from '@/components/common/count-up';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { fmtPct } from '../lib';

export interface QuoteSummaryCardProps {
  totals: QuoteTotals;
  thresholdPct: number;
  accountName: string;
  /** the director approved this discount (for the current prices) */
  approved: boolean;
  /** workflow actions (QuoteActions or the "Lưu nháp" of a new quote) */
  actions: ReactNode;
  className?: string;
}

function DiscountMeter({ eff, thresholdPct, over }: { eff: number; thresholdPct: number; over: boolean }) {
  const scale = Math.max(thresholdPct * 2, eff, 1);
  const fill = Math.min(100, (Math.max(0, eff) / scale) * 100);
  const mark = Math.min(100, (thresholdPct / scale) * 100);
  return (
    <div
      className="relative mt-3 h-1.5"
      role="img"
      aria-label={t('commercial.totals.meterLabel', { pct: fmtPct(eff), threshold: fmtPct(thresholdPct) })}
    >
      {/* DESIGN §8.5 custom bar: a full-width fill moved with transform (never `width`) — grows in on first paint and
          eases to each new discount while lines are edited */}
      <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full w-full animate-progress-grow rounded-full transition-[transform,background-color] duration-500 ease-out-quart',
            over ? 'bg-warning' : 'bg-primary',
          )}
          style={{ transform: `translateX(-${100 - fill}%)` }}
        />
      </div>
      <div className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-ink/50" style={{ left: `${mark}%` }} />
    </div>
  );
}

export function QuoteSummaryCard({ totals, thresholdPct, accountName, approved, actions, className }: QuoteSummaryCardProps) {
  const eff = totals.effective_discount_pct;
  const over = eff > thresholdPct;
  return (
    <Card className={cn('[container-type:inline-size]', className)}>
      {/* wide card (iPad, 1024 with the sidebar open): numbers | actions side by side instead of 670px-wide button bars */}
      <div className="grid [@container_(min-width:560px)]:grid-cols-2">
        <div className="p-4 sm:p-5">
          <p className="text-caption font-medium">{t('commercial.totals.grand')}</p>
          <p className="mt-1.5 break-words text-[clamp(1.5rem,11cqi,1.875rem)] font-semibold leading-[1.2] tabular tracking-display text-ink">
            {/* the quote's hero number counts up when the page opens (DESIGN §8.5); edits then show it at once */}
            <CountUp value={formatMoney(totals.grand_total)} />
          </p>
          <p className="mt-1 text-caption tabular">
            {t('commercial.totals.netAndVat', { net: formatMoney(totals.net_before_vat), vat: formatMoney(totals.vat) })}
          </p>

          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="text-table font-medium text-foreground">
                {t('commercial.totals.effective')}{' '}
                <span className={cn('tabular', over ? 'text-warning' : 'text-foreground')}>{fmtPct(eff)}</span>
              </p>
              {over ? (
                approved ? (
                  <Badge variant="success" size="sm">
                    <ShieldCheck aria-hidden="true" />
                    {t('commercial.approval.approved')}
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    <TriangleAlert aria-hidden="true" />
                    {t('commercial.totals.overBadge')}
                  </Badge>
                )
              ) : (
                <Badge size="sm">
                  <CircleCheck aria-hidden="true" />
                  {t('commercial.totals.withinBadge')}
                </Badge>
              )}
            </div>
            <DiscountMeter eff={eff} thresholdPct={thresholdPct} over={over} />
            <p className="mt-2 text-caption">{t('commercial.totals.thresholdLine', { threshold: fmtPct(thresholdPct), account: accountName })}</p>
          </div>

          {totals.cost_total !== undefined && totals.subtotal > 0 ? (
            <div className="mt-4 rounded-lg bg-note p-3 ring-1 ring-inset ring-note-border">
              <div className="flex items-center justify-between gap-2">
                <p className="text-table font-medium text-foreground">
                  {t('commercial.totals.margin')} <span className="tabular">{fmtPct(totals.margin_pct ?? 0)}</span>
                </p>
                <InternalOnlyBadge className="bg-card" />
              </div>
              <p className="mt-1 text-caption tabular">
                {t('commercial.totals.costLine', { cost: formatMoney(totals.cost_total), margin: formatMoney(totals.margin ?? 0) })}
              </p>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border/60 p-4 sm:p-5 [@container_(min-width:560px)]:border-l [@container_(min-width:560px)]:border-t-0">
          {actions}
        </div>
      </div>
    </Card>
  );
}
