// Editable quote lines, one row per line at every width (fits the 2/3 column from xl): name + amount on top, then the
// four numbers (SL · Đơn giá · CK % · VAT) with small labels, the price hint and an optional description for the
// client. Lines that changed vs the previous version get a soft blue tint and a "Mới" / "Đã sửa: …" badge.
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ID, VatRate } from '@/domain/types';
import type { QuoteLineView } from '@/services/contract';
import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { t } from '@/i18n';
import { DecimalInput, MoneyInput } from '../components/inputs';
import type { Catalog, DraftErrors, DraftLine, LineDiff, LivePricing } from './draft';
import { VAT_RATES, newDraftLine } from './draft';
import { ChangeBadge, PriceHint, RemovedLines } from './LineBits';
import { PriceItemPicker } from './PriceItemPicker';

/** label + control, labels in 12px caption colour above the field */
function MiniField({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <label htmlFor={id} className="block truncate text-micro font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export const LINE_FIELDS_GRID = 'grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-[96px_minmax(0,1fr)_88px_112px]';

export interface LineEditorProps {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  catalog: Catalog;
  pricing: LivePricing;
  diff: { byKey: Map<string, LineDiff>; removed: QuoteLineView[] } | null;
  parentVersion: number | null;
  errors: DraftErrors;
  showErrors: boolean;
}

function LineRow({
  line,
  index,
  catalog,
  pricing,
  diff,
  errors,
  onPatch,
  onRemove,
}: {
  line: DraftLine;
  index: number;
  catalog: Catalog;
  pricing: LivePricing;
  diff: LineDiff | undefined;
  errors: { qty: boolean; discount: boolean };
  onPatch: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  const descRef = useRef<HTMLInputElement>(null);
  const [descOpen, setDescOpen] = useState(line.description.trim() !== '');
  const item = catalog.items.get(line.price_item_id);
  const name = item?.name ?? line.price_item_id;
  const live = pricing.lines.get(line.key);
  const applicable = catalog.applicable(line.price_item_id);
  const highlighted = diff?.change === 'added' || diff?.change === 'modified';
  const unitLabel = item ? t(`enums.priceUnit.${item.unit}`) : '';
  const label = (key: string) => t(`commercial.editor.col.${key}`);
  const showDesc = descOpen || line.description !== '';

  return (
    <li className={cn('px-4 py-4 sm:px-5', highlighted ? 'bg-primary-soft/50' : '')}>
      <div className="flex items-start gap-3">
        <span className="w-5 shrink-0 pt-px text-table tabular text-muted-foreground" aria-hidden="true">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-foreground">{name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-caption tabular">
              {item?.code} · {unitLabel}
            </span>
            {diff ? <ChangeBadge change={diff.change} changed={diff.changed} /> : null}
          </div>
        </div>
        {/* phones: the amount moves under the numbers so the service name keeps the width */}
        <div className="hidden shrink-0 pt-px text-right sm:block">
          <Money value={live?.amount ?? 0} className="font-semibold text-ink" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t('commercial.editor.removeLine', { name })}
          className="-mr-2 -mt-1 hover:text-danger"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3 sm:pl-8">
        <div className={LINE_FIELDS_GRID}>
          <MiniField id={`${uid}-qty`} label={t('commercial.editor.qtyWithUnit', { unit: unitLabel })}>
            <DecimalInput
              id={`${uid}-qty`}
              inputSize="sm"
              value={line.qty}
              onValueChange={(v) => onPatch({ qty: v })}
              aria-invalid={errors.qty || undefined}
            />
          </MiniField>
          <MiniField id={`${uid}-price`} label={label('unitPrice')}>
            <MoneyInput
              id={`${uid}-price`}
              inputSize="sm"
              value={line.unit_price}
              onValueChange={(v) => onPatch({ unit_price: v })}
              onBlur={() => {
                if (line.unit_price <= 0) onPatch({ unit_price: applicable });
              }}
            />
          </MiniField>
          <MiniField id={`${uid}-disc`} label={label('discount')}>
            <DecimalInput
              id={`${uid}-disc`}
              inputSize="sm"
              value={line.discount_pct}
              onValueChange={(v) => onPatch({ discount_pct: v })}
              aria-invalid={errors.discount || undefined}
            />
          </MiniField>
          <MiniField id={`${uid}-vat`} label={label('vat')}>
            <NativeSelect id={`${uid}-vat`} size="sm" value={String(line.vat_rate)} onChange={(e) => onPatch({ vat_rate: Number(e.target.value) as VatRate })}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {t(`enums.vatRate.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </MiniField>
        </div>
        <PriceHint className="mt-1.5" list={live?.list ?? item?.list_price ?? 0} applicable={applicable} unitPrice={line.unit_price} />
        <p className="mt-2 flex items-baseline justify-between gap-3 sm:hidden">
          <span className="text-caption">{label('amount')}</span>
          <Money value={live?.amount ?? 0} className="font-semibold text-ink" />
        </p>
        {errors.qty || errors.discount ? (
          <p className="mt-1 text-[13px] leading-[18px] text-danger" role="alert">
            {[errors.qty ? t('commercial.editor.qtyInvalid') : null, errors.discount ? t('commercial.editor.pctInvalid') : null]
              .filter(Boolean)
              .join(' ')}
          </p>
        ) : null}
        {showDesc ? (
          <Input
            ref={descRef}
            inputSize="sm"
            value={line.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder={t('commercial.editor.descriptionPlaceholder')}
            aria-label={t('commercial.editor.fieldFor', { field: label('description'), name })}
            className="mt-2.5"
          />
        ) : (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-1.5 text-table"
            onClick={() => {
              setDescOpen(true);
              window.setTimeout(() => descRef.current?.focus(), 0);
            }}
          >
            <Plus aria-hidden="true" />
            {t('commercial.editor.addDescription')}
          </Button>
        )}
      </div>
    </li>
  );
}

export function LineEditor({ lines, onChange, catalog, pricing, diff, parentVersion, errors, showErrors }: LineEditorProps) {
  const patch = (key: string, p: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const add = (id: ID) => onChange([...lines, newDraftLine(id, catalog.applicable(id))]);
  const noErr = { qty: false, discount: false };

  return (
    <div>
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-1 border-t border-border/60 px-4 py-8 text-center">
          <p className="text-table font-medium text-foreground">{t('commercial.editor.noLines')}</p>
          <p className="text-caption">{t('commercial.editor.noLinesHint')}</p>
          <div className="mt-3">
            <PriceItemPicker catalog={catalog} onPick={add} />
          </div>
        </div>
      ) : (
        <>
          <ol className="divide-y divide-border/60 border-y border-border/60">
            {lines.map((l, i) => {
              const e = errors.lines[l.key];
              const shown = e && (showErrors || l.qty.trim() !== '') ? { qty: e.qty, discount: e.discount } : noErr;
              return (
                <LineRow
                  key={l.key}
                  line={l}
                  index={i}
                  catalog={catalog}
                  pricing={pricing}
                  diff={diff?.byKey.get(l.key)}
                  errors={shown}
                  onPatch={(p) => patch(l.key, p)}
                  onRemove={() => onChange(lines.filter((x) => x.key !== l.key))}
                />
              );
            })}
          </ol>
          <div className="px-4 pt-4 sm:px-5">
            <PriceItemPicker catalog={catalog} onPick={add} />
          </div>
        </>
      )}
      {diff && diff.removed.length > 0 ? (
        <div className="px-4 pt-4 sm:px-5">
          <RemovedLines lines={diff.removed} parentVersion={parentVersion} />
        </div>
      ) : null}
    </div>
  );
}
