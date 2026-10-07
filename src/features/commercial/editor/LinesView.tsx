// Read-only quote lines (quote not editable for this viewer / status), invoice style: one row per line with the
// numbers in a caption line and the amount on the right, plus the server's version diff (tint + badge, removed lines).
import type { QuoteDetail, QuoteLineView } from '@/services/contract';
import { Money } from '@/components/common/money';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/format';
import { fmtPct } from '../lib';
import { ChangeBadge, RemovedLines } from './LineBits';

function numbersLine(l: QuoteLineView): string {
  const unit = t(`enums.priceUnit.${l.unit}`);
  const parts = [t('commercial.doc.mobileLine', { qty: formatNumber(l.qty), unit, price: formatMoney(l.unit_price) })];
  if (l.discount_pct > 0) parts.push(t('commercial.doc.mobileDiscount', { pct: fmtPct(l.discount_pct) }));
  parts.push(t('commercial.doc.mobileVat', { pct: fmtPct(l.vat_rate) }));
  return parts.join(' · ');
}

/** price context: "giá riêng" / below the applicable price */
function PriceNote({ l }: { l: QuoteLineView }) {
  const below = l.unit_price > 0 && l.applicable_price > 0 && l.unit_price < l.applicable_price;
  const negotiated = l.applicable_price !== l.list_price;
  if (!below && !negotiated) return null;
  const pct = below ? ((l.applicable_price - l.unit_price) / l.applicable_price) * 100 : 0;
  return (
    <p className="text-caption tabular">
      {negotiated ? t('commercial.editor.hintNegotiated', { price: formatMoney(l.applicable_price), list: formatMoney(l.list_price) }) : null}
      {negotiated && below ? <span aria-hidden="true"> · </span> : null}
      {below ? <span className="font-medium text-warning">{t('commercial.editor.hintBelow', { pct: fmtPct(pct) })}</span> : null}
    </p>
  );
}

export function LinesView({ quote, parentVersion }: { quote: QuoteDetail; parentVersion: number | null }) {
  if (quote.lines.length === 0) {
    return <p className="border-t border-border/60 px-4 py-8 text-center text-table text-muted-foreground sm:px-5">{t('commercial.editor.noLinesReadOnly')}</p>;
  }
  return (
    <div>
      <ol className="divide-y divide-border/60 border-y border-border/60">
        {quote.lines.map((l, i) => {
          const highlighted = l.change === 'added' || l.change === 'modified';
          return (
            <li key={l.id} className={cn('flex items-start gap-3 px-4 py-3.5 sm:px-5', highlighted ? 'bg-primary-soft/50' : '')}>
              <span className="w-5 shrink-0 pt-px text-table tabular text-muted-foreground" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-foreground">{l.name}</p>
                {l.description ? <p className="text-table text-muted-foreground">{l.description}</p> : null}
                <p className="mt-0.5 text-caption tabular">
                  {`${l.code} · ${numbersLine(l)}`}
                </p>
                <PriceNote l={l} />
                {l.change === 'added' || l.change === 'modified' ? (
                  <div className="mt-1.5">
                    <ChangeBadge change={l.change} changed={l.changed_fields} />
                  </div>
                ) : null}
                {/* phones: the amount goes under the numbers so the name and the numbers keep the width */}
                <p className="mt-1.5 flex items-baseline justify-between gap-3 sm:hidden">
                  <span className="text-caption">{t('commercial.editor.col.amount')}</span>
                  <Money value={l.subtotal - l.discount_amount} className="font-semibold text-ink" />
                </p>
              </div>
              <Money value={l.subtotal - l.discount_amount} className="hidden shrink-0 pt-px font-semibold text-ink sm:inline" />
            </li>
          );
        })}
      </ol>
      {quote.removed_lines.length > 0 ? (
        <div className="px-4 pt-4 sm:px-5">
          <RemovedLines lines={quote.removed_lines} parentVersion={parentVersion} />
        </div>
      ) : null}
    </div>
  );
}
