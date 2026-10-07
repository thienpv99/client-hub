// "Sửa cơ hội": name, value, probability, expected close, next step + date, products, linked quote (one of the
// account's quotes — the opportunity page shows it in its "Báo giá" card), owner (director only).
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { QuoteSummary } from '@/services/contract';
import type { OpportunityInput, OpportunityView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatPercent } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DEFAULT_PROBABILITY, stageLabel } from '@/components/crm/crmLabels';
import { DateField, MoneyInput, parsePercent, ProductPicker, QuickDates, useActivePriceItems, useDealOwners } from '@/components/crm/fields';
import { todayISO } from '@/domain/clock';

export interface EditOpportunityDialogProps {
  opportunity: OpportunityView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "quote": opened from the opportunity's "Báo giá" card ("Gắn báo giá có sẵn") — focus starts on the quote field */
  focusField?: 'quote';
}

interface FormState {
  name: string;
  value: number;
  probability: string;
  close: string;
  nextStep: string;
  nextStepDate: string;
  products: string[];
  /** '' = no quote linked */
  quoteId: string;
  ownerId: string;
}

function fromOpportunity(o: OpportunityView): FormState {
  return {
    name: o.name,
    value: o.value,
    probability: String(o.probability),
    close: o.expected_close_date,
    nextStep: o.next_step ?? '',
    nextStepDate: o.next_step_date ?? '',
    products: o.products.map((p) => p.price_item_id),
    quoteId: o.quote?.id ?? '',
    ownerId: o.owner.id,
  };
}

/** "BG-TA-2026-02 · v2 — Giai đoạn 2 … · Đã gửi" */
function quoteOption(q: Pick<QuoteSummary, 'code' | 'version' | 'title' | 'status'>): string {
  return t('crm.edit.quoteOption', {
    code: t('crm.opportunity.quoteCode', { code: q.code, version: q.version }),
    title: q.title,
    status: t(`enums.quoteStatus.${q.status}`),
  });
}

export function EditOpportunityDialog({ opportunity, open, onOpenChange, focusField }: EditOpportunityDialogProps) {
  const uid = useId();
  const viewer = useViewer();
  const isDirector = viewer?.role === 'director';
  const { run, pending } = useAction();
  const [form, setForm] = useState<FormState>(() => fromOpportunity(opportunity));
  const [touched, setTouched] = useState(false);
  const { items: priceItems, loading: priceLoading } = useActivePriceItems(open);
  const { owners } = useDealOwners(open && isDirector);
  const quoteRef = useRef<HTMLSelectElement>(null);
  // the account's quotes, newest version of each; the linked one stays listed even when a newer version exists
  const accountId = opportunity.account.id;
  const quotesQ = useQuery(() => api.listQuotes({ accountId, latestOnly: true }), [accountId], { enabled: open });
  const linked = opportunity.quote;
  const quotes: Pick<QuoteSummary, 'id' | 'code' | 'version' | 'title' | 'status'>[] = [...(quotesQ.data ?? [])];
  if (linked && !quotes.some((q) => q.id === linked.id)) quotes.unshift(linked);

  useEffect(() => {
    if (open) {
      setForm(fromOpportunity(opportunity));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const pct = parsePercent(form.probability);
  const errors = {
    name: touched && form.name.trim() === '' ? t('crm.create.errors.name') : null,
    value: touched && form.value <= 0 ? t('crm.create.errors.value') : null,
    probability: touched && pct === null ? t('crm.edit.errors.probability') : null,
    close: touched && !form.close ? t('crm.create.errors.close') : null,
  };
  // products that are no longer active stay selectable while they are on the deal
  const pickerItems = [
    ...priceItems,
    ...opportunity.products
      .filter((p) => !priceItems.some((i) => i.id === p.price_item_id))
      .map((p) => ({ id: p.price_item_id, code: p.code, name: p.name, unit: 'package' as const, list_price: 0, category: '', active: false, description: null })),
  ];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (form.name.trim() === '' || form.value <= 0 || pct === null || !form.close) return;
    const patch: Partial<OpportunityInput> = {
      name: form.name.trim(),
      value: Math.round(form.value),
      probability: pct,
      expected_close_date: form.close,
      next_step: form.nextStep.trim() || null,
      next_step_date: form.nextStepDate || null,
      price_item_ids: form.products,
    };
    if (form.quoteId !== (opportunity.quote?.id ?? '')) patch.quote_id = form.quoteId || null;
    if (isDirector && form.ownerId && form.ownerId !== opportunity.owner.id) patch.owner_id = form.ownerId;
    const result = await run(() => api.updateOpportunity(opportunity.id, patch), { success: 'common.toast.saved' });
    if (result) onOpenChange(false);
  }

  const ids = {
    name: `${uid}-name`,
    value: `${uid}-value`,
    pct: `${uid}-pct`,
    close: `${uid}-close`,
    next: `${uid}-next`,
    nextDate: `${uid}-next-date`,
    products: `${uid}-products`,
    quote: `${uid}-quote`,
    owner: `${uid}-owner`,
  };
  // (the first render after opening has neither data nor `loading` yet)
  const quotesLoading = !quotesQ.data && !quotesQ.error;
  const today = todayISO();
  const stageDefault = DEFAULT_PROBABILITY[opportunity.stage];

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent
        className="sm:max-w-xl"
        onOpenAutoFocus={
          focusField === 'quote'
            ? (e) => {
                const select = quoteRef.current;
                if (!select || select.disabled) return;
                e.preventDefault();
                select.focus();
              }
            : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>{t('crm.edit.title')}</DialogTitle>
          <DialogDescription>{t('crm.edit.description', { account: opportunity.account.name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <FormField label={t('crm.create.name')} htmlFor={ids.name} required error={errors.name}>
            <Input id={ids.name} value={form.name} maxLength={160} onChange={(e) => set('name', e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('crm.create.value')} htmlFor={ids.value} required error={errors.value}>
              <MoneyInput id={ids.value} value={form.value} onValueChange={(v) => set('value', v)} />
            </FormField>
            <FormField
              label={t('crm.edit.probability')}
              htmlFor={ids.pct}
              required
              error={errors.probability}
              hint={t('crm.edit.probabilityHint', { stage: stageLabel(opportunity.stage), pct: formatPercent(stageDefault) })}
            >
              <Input
                id={ids.pct}
                inputMode="numeric"
                value={form.probability}
                maxLength={3}
                onChange={(e) => set('probability', e.target.value.replace(/[^\d]/g, ''))}
                className="tabular"
              />
            </FormField>
          </div>
          <DateField id={ids.close} label={t('crm.create.close')} required error={errors.close} value={form.close} onChange={(v) => set('close', v)} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <FormField label={t('crm.create.nextStep')} htmlFor={ids.next}>
              <Input
                id={ids.next}
                value={form.nextStep}
                maxLength={200}
                placeholder={t('crm.create.nextStepPlaceholder')}
                onChange={(e) => set('nextStep', e.target.value)}
              />
            </FormField>
            <DateField id={ids.nextDate} label={t('crm.create.nextStepDate')} value={form.nextStepDate} onChange={(v) => set('nextStepDate', v)} />
          </div>
          <QuickDates today={today} onPick={(d) => set('nextStepDate', d)} className="-mt-3" />
          <div className="space-y-2">
            <Label id={ids.products}>{t('crm.create.products')}</Label>
            <ProductPicker items={pickerItems} loading={priceLoading} value={form.products} onChange={(v) => set('products', v)} labelledBy={ids.products} />
          </div>
          <FormField
            label={t('crm.edit.quote')}
            htmlFor={ids.quote}
            hint={!quotesLoading && quotes.length === 0 ? t('crm.edit.quoteNoneHint', { account: opportunity.account.name }) : t('crm.edit.quoteHint')}
          >
            <NativeSelect
              ref={quoteRef}
              id={ids.quote}
              value={form.quoteId}
              disabled={!quotesLoading && quotes.length === 0}
              onChange={(e) => set('quoteId', e.target.value)}
            >
              {quotesLoading ? (
                <option value={form.quoteId}>{t('crm.edit.quoteLoading')}</option>
              ) : (
                <>
                  <option value="">{t('crm.edit.quoteNone')}</option>
                  {quotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {quoteOption(q)}
                    </option>
                  ))}
                </>
              )}
            </NativeSelect>
          </FormField>
          {isDirector ? (
            <FormField label={t('crm.create.owner')} htmlFor={ids.owner}>
              <NativeSelect id={ids.owner} value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                {owners.some((u) => u.id === opportunity.owner.id) ? null : (
                  <option value={opportunity.owner.id}>{opportunity.owner.full_name}</option>
                )}
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
