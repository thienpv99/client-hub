// Small pieces shared by the editable and the read-only line lists: change badge, price hint, removed lines and the
// one-line diff summary ("2 mới · 1 đã sửa · 1 đã bỏ") shown in the lines card header.
import { CircleMinus, PencilLine, Plus } from 'lucide-react';
import type { QuoteLineView } from '@/services/contract';
import { Money } from '@/components/common/money';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/format';
import { fmtPct } from '../lib';

type ChangedField = QuoteLineView['changed_fields'][number];

/** "Mới" · "Đã sửa: SL, Đơn giá" */
export function ChangeBadge({ change, changed }: { change: 'added' | 'modified' | 'removed' | null; changed: ChangedField[] }) {
  if (change !== 'added' && change !== 'modified') return null;
  return (
    <Badge variant="primary" size="sm">
      {change === 'added' ? <Plus aria-hidden="true" /> : <PencilLine aria-hidden="true" />}
      {change === 'added'
        ? t('commercial.diff.added')
        : t('commercial.diff.modified', { fields: changed.map((f) => t(`commercial.diff.field.${f}`)).join(', ') })}
    </Badge>
  );
}

/** "Giá riêng 4.300.000 ₫ · niêm yết 4.500.000 ₫" (+ how far the unit price is from the applicable price) */
export function PriceHint({
  list,
  applicable,
  unitPrice,
  className,
}: {
  list: number;
  applicable: number;
  unitPrice: number;
  className?: string;
}) {
  const negotiated = applicable !== list;
  const base = negotiated
    ? t('commercial.editor.hintNegotiated', { price: formatMoney(applicable), list: formatMoney(list) })
    : t('commercial.editor.hintList', { list: formatMoney(list) });
  let delta: string | null = null;
  if (unitPrice > 0 && applicable > 0 && unitPrice !== applicable) {
    const pct = (Math.abs(applicable - unitPrice) / applicable) * 100;
    delta = unitPrice < applicable ? t('commercial.editor.hintBelow', { pct: fmtPct(pct) }) : t('commercial.editor.hintAbove', { pct: fmtPct(pct) });
  }
  return (
    <p className={cn('text-caption tabular', className)}>
      {base}
      {delta ? (
        <>
          <span aria-hidden="true"> · </span>
          <span className={unitPrice < applicable ? 'font-medium text-warning' : undefined}>{delta}</span>
        </>
      ) : null}
    </p>
  );
}

export function RemovedLines({ lines, parentVersion }: { lines: QuoteLineView[]; parentVersion: number | null }) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:px-4">
      <p className="flex items-center gap-2 text-table font-medium text-muted-foreground">
        <CircleMinus className="h-4 w-4 shrink-0" aria-hidden="true" />
        {parentVersion ? t('commercial.diff.removedTitle', { version: parentVersion }) : t('commercial.diff.removedTitleNoVersion')}
      </p>
      <ul className="mt-2 space-y-1.5 pl-6">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-table text-muted-foreground">
            <span className="min-w-0 line-through">
              {l.name}
              {l.description ? ` – ${l.description}` : ''}
              <span className="tabular">
                {' · '}
                {t('commercial.diff.removedQty', { qty: formatNumber(l.qty), unit: t(`enums.priceUnit.${l.unit}`) })}
              </span>
            </span>
            <s className="tabular">
              <Money value={l.subtotal - l.discount_amount} />
            </s>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "2 mới · 1 đã sửa · 1 đã bỏ" as small neutral counts; nothing when the version has no previous one */
export function DiffSummary({ added, modified, removed }: { added: number; modified: number; removed: number }) {
  if (added + modified + removed === 0) return null;
  const parts: string[] = [];
  if (added > 0) parts.push(t('commercial.diff.countAdded', { count: added }));
  if (modified > 0) parts.push(t('commercial.diff.countModified', { count: modified }));
  if (removed > 0) parts.push(t('commercial.diff.countRemoved', { count: removed }));
  return (
    <Badge variant="primary" size="sm" className="tabular">
      <PencilLine aria-hidden="true" />
      {parts.join(t('common.separator'))}
    </Badge>
  );
}
