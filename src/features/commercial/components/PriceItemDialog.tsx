// Director: add / edit a price-list item (api.upsertPriceItem). Cost price is internal (lock + "Chỉ nội bộ").
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { PriceUnit } from '@/domain/types';
import type { PriceItemView } from '@/services/contract';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { api } from '@/services/api';
import { fmtPct } from '../lib';
import { MoneyInput } from './inputs';

const UNITS: PriceUnit[] = ['month', 'user', 'package', 'manday'];

interface Form {
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  cost_price: number;
  category: string;
  active: boolean;
  description: string;
}

function initial(item: PriceItemView | null): Form {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    unit: item?.unit ?? 'manday',
    list_price: item?.list_price ?? 0,
    cost_price: item?.cost_price ?? 0,
    category: item?.category ?? '',
    active: item?.active ?? true,
    description: item?.description ?? '',
  };
}

export interface PriceItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new item */
  item: PriceItemView | null;
  /** every item, to prevent duplicate codes and suggest categories */
  items: PriceItemView[];
  costVisible: boolean;
}

export function PriceItemDialog({ open, onOpenChange, item, items, costVisible }: PriceItemDialogProps) {
  const uid = useId();
  const [form, setForm] = useState<Form>(() => initial(item));
  const [submitted, setSubmitted] = useState(false);
  const { run, pending } = useAction();

  useEffect(() => {
    if (open) {
      setForm(initial(item));
      setSubmitted(false);
    }
  }, [open, item]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const code = form.code.trim();
  const duplicate = !!code && items.some((i) => i.id !== item?.id && i.code.toLowerCase() === code.toLowerCase());
  const errors = {
    code: !code ? t('commercial.prices.form.codeRequired') : duplicate ? t('commercial.prices.form.codeDuplicate') : null,
    name: !form.name.trim() ? t('commercial.prices.form.nameRequired') : null,
    list_price: form.list_price <= 0 ? t('commercial.prices.form.priceRequired') : null,
  };
  const valid = !errors.code && !errors.name && !errors.list_price;
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const margin = form.list_price > 0 ? ((form.list_price - form.cost_price) / form.list_price) * 100 : 0;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const r = await run(
      () =>
        api.upsertPriceItem({
          id: item?.id,
          code,
          name: form.name.trim(),
          unit: form.unit,
          list_price: form.list_price,
          cost_price: costVisible ? form.cost_price : undefined,
          category: form.category.trim(),
          active: form.active,
          description: form.description.trim() || null,
        }),
      { success: item ? 'commercial.prices.toast.updated' : 'commercial.prices.toast.created', successParams: { name: form.name.trim() } },
    );
    if (r) onOpenChange(false);
  }

  const show = (msg: string | null) => (submitted ? msg : null);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? t('commercial.prices.form.editTitle') : t('commercial.prices.form.newTitle')}</DialogTitle>
          <DialogDescription>{t('commercial.prices.form.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label={t('commercial.prices.form.code')} htmlFor={`${uid}-code`} required error={show(errors.code)}>
            <Input id={`${uid}-code`} value={form.code} onChange={(e) => set('code', e.target.value)} autoComplete="off" placeholder={t('commercial.prices.form.codePlaceholder')} />
          </FormField>
          <FormField label={t('commercial.prices.form.unit')} htmlFor={`${uid}-unit`} required>
            <NativeSelect id={`${uid}-unit`} value={form.unit} onChange={(e) => set('unit', e.target.value as PriceUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`enums.priceUnit.${u}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('commercial.prices.form.name')} htmlFor={`${uid}-name`} required error={show(errors.name)} className="sm:col-span-2">
            <Input id={`${uid}-name`} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
          </FormField>
          <FormField label={t('commercial.prices.form.listPrice')} htmlFor={`${uid}-list`} required error={show(errors.list_price)}>
            <MoneyInput id={`${uid}-list`} value={form.list_price} onValueChange={(v) => set('list_price', v)} />
          </FormField>
          {costVisible ? (
            <FormField
              label={
                <span className="inline-flex items-center gap-2">
                  {t('commercial.prices.form.costPrice')}
                  <InternalOnlyBadge />
                </span>
              }
              htmlFor={`${uid}-cost`}
              hint={form.list_price > 0 ? t('commercial.prices.form.marginHint', { pct: fmtPct(margin) }) : undefined}
            >
              <MoneyInput id={`${uid}-cost`} value={form.cost_price} onValueChange={(v) => set('cost_price', v)} />
            </FormField>
          ) : (
            <div />
          )}
          <FormField label={t('commercial.prices.form.category')} htmlFor={`${uid}-cat`} className="sm:col-span-2">
            <Input id={`${uid}-cat`} list={`${uid}-cats`} value={form.category} onChange={(e) => set('category', e.target.value)} autoComplete="off" />
          </FormField>
          <datalist id={`${uid}-cats`}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FormField label={t('commercial.prices.form.descriptionLabel')} htmlFor={`${uid}-desc`} className="sm:col-span-2">
            <Textarea id={`${uid}-desc`} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </FormField>
          <label
            htmlFor={`${uid}-active`}
            className="flex min-h-tap cursor-pointer items-center gap-3 rounded-lg bg-subtle px-3 py-2 ring-1 ring-inset ring-border/60 sm:col-span-2"
          >
            <Switch id={`${uid}-active`} checked={form.active} onCheckedChange={(v) => set('active', v)} />
            <span className="text-table font-medium text-foreground">{t('commercial.prices.form.active')}</span>
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {item ? t('common.save') : t('commercial.prices.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
