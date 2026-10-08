// "Tạo cơ hội": account (customers and prospects), name, value, stage, expected close, source, products,
// next step + date, owner (director chooses; an AM owns what they create) → api.createOpportunity.
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LeadSource } from '@/domain/crmTypes';
import type { ID } from '@/domain/types';
import type { OpportunityInput } from '@/services/crmContract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { addDays } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useDelayedFlag } from '@/hooks/useMotion';
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
import { DEFAULT_PROBABILITY, LEAD_SOURCES, OPEN_STAGES, sourceLabel, stageLabel } from './crmLabels';
import type { OpenStage } from './crmLabels';
import { DateField, MoneyInput, ProductPicker, QuickDates, useActivePriceItems, useDealOwners } from './fields';

export interface CreateOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** fixed account (account page); otherwise the user picks one */
  accountId?: ID;
  defaults?: Partial<OpportunityInput>;
  /** called with the new id; without it the dialog opens the opportunity page */
  onCreated?: (id: ID) => void;
}

interface FormState {
  accountId: string;
  name: string;
  value: number;
  stage: OpenStage;
  close: string;
  source: LeadSource | '';
  products: string[];
  nextStep: string;
  nextStepDate: string;
  ownerId: string;
  ownerTouched: boolean;
}

function openStageOf(stage: OpportunityInput['stage'] | undefined): OpenStage {
  return stage && (OPEN_STAGES as readonly string[]).includes(stage) ? (stage as OpenStage) : 'qualified';
}

function initialState(accountId: string, defaults: Partial<OpportunityInput> | undefined, viewerId: string): FormState {
  return {
    accountId: accountId || defaults?.account_id || '',
    name: defaults?.name ?? '',
    value: defaults?.value ?? 0,
    stage: openStageOf(defaults?.stage),
    close: defaults?.expected_close_date ?? addDays(todayISO(), 45),
    source: defaults?.source ?? '',
    products: defaults?.price_item_ids ?? [],
    nextStep: defaults?.next_step ?? '',
    nextStepDate: defaults?.next_step_date ?? '',
    ownerId: defaults?.owner_id ?? viewerId,
    ownerTouched: Boolean(defaults?.owner_id),
  };
}

export function CreateOpportunityDialog({ open, onOpenChange, accountId, defaults, onCreated }: CreateOpportunityDialogProps) {
  const uid = useId();
  const navigate = useNavigate();
  const viewer = useViewer();
  const viewerId = viewer?.user.id ?? '';
  const isDirector = viewer?.role === 'director';
  const { run, pending, pendingVisible } = useAction();
  const [form, setForm] = useState<FormState>(() => initialState(accountId ?? '', defaults, viewerId));
  const [touched, setTouched] = useState(false);

  const defaultsKey = JSON.stringify(defaults ?? {});
  useEffect(() => {
    if (open) {
      setForm(initialState(accountId ?? '', defaults, viewerId));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, defaultsKey, viewerId]);

  const accountsQ = useQuery(() => api.listAccounts(), [], { enabled: open });
  // "Đang tải…" only when the accounts take a beat (DESIGN §8.2: no one-frame pending label); logic keeps `loading`
  const accountsLoadingVisible = useDelayedFlag(accountsQ.loading);
  const { items: priceItems, loading: priceLoading } = useActivePriceItems(open);
  const { owners } = useDealOwners(open && isDirector);
  const accounts = useMemo(
    () => [...(accountsQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [accountsQ.data],
  );
  const account = accounts.find((a) => a.id === form.accountId) ?? null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // a director's new deal goes to the account's AM unless they chose someone
  const amOfAccount = account?.am.id ?? null;
  useEffect(() => {
    if (!open || !isDirector || form.ownerTouched || !amOfAccount) return;
    setForm((f) => (f.ownerTouched || f.ownerId === amOfAccount ? f : { ...f, ownerId: amOfAccount }));
  }, [open, isDirector, form.ownerTouched, amOfAccount]);

  function pickAccount(id: string) {
    setForm((f) => ({ ...f, accountId: id }));
  }

  // source default: an existing customer vs a prospect we reached out to
  const source: LeadSource = form.source || (account && account.stage === 'prospecting' ? 'outbound' : 'existing_customer');

  const errors = {
    account: touched && !form.accountId ? t('crm.create.errors.account') : null,
    name: touched && form.name.trim() === '' ? t('crm.create.errors.name') : null,
    value: touched && form.value <= 0 ? t('crm.create.errors.value') : null,
    close: touched && !form.close ? t('crm.create.errors.close') : null,
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!form.accountId || form.name.trim() === '' || form.value <= 0 || !form.close) return;
    const input: OpportunityInput = {
      account_id: form.accountId,
      name: form.name.trim(),
      value: Math.round(form.value),
      stage: form.stage,
      expected_close_date: form.close,
      owner_id: isDirector ? form.ownerId || viewerId : viewerId,
      source,
      price_item_ids: form.products,
      next_step: form.nextStep.trim() || null,
      next_step_date: form.nextStepDate || null,
      quote_id: defaults?.quote_id ?? null,
    };
    const created = await run(() => api.createOpportunity(input), { success: 'crm.create.toast', successParams: { name: input.name } });
    if (!created) return;
    onOpenChange(false);
    if (onCreated) onCreated(created.id);
    else navigate(`/app/crm/opportunities/${encodeURIComponent(created.id)}`);
  }

  const ids = {
    account: `${uid}-account`,
    name: `${uid}-name`,
    value: `${uid}-value`,
    stage: `${uid}-stage`,
    close: `${uid}-close`,
    source: `${uid}-source`,
    products: `${uid}-products`,
    next: `${uid}-next`,
    nextDate: `${uid}-next-date`,
    owner: `${uid}-owner`,
  };
  const today = todayISO();

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('crm.create.title')}</DialogTitle>
          <DialogDescription>{t('crm.create.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <FormField label={t('crm.create.account')} htmlFor={ids.account} required error={errors.account}>
            <NativeSelect
              id={ids.account}
              value={form.accountId}
              disabled={Boolean(accountId)}
              placeholder={accountsLoadingVisible ? t('common.loading') : t('crm.create.accountPlaceholder')}
              onChange={(e) => pickAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.stage === 'prospecting' ? t('crm.create.prospectOption', { name: a.name }) : a.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label={t('crm.create.name')} htmlFor={ids.name} required error={errors.name}>
            <Input
              id={ids.name}
              value={form.name}
              maxLength={160}
              placeholder={t('crm.create.namePlaceholder')}
              onChange={(e) => set('name', e.target.value)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('crm.create.value')} htmlFor={ids.value} required error={errors.value} hint={t('crm.create.valueHint')}>
              <MoneyInput id={ids.value} value={form.value} onValueChange={(v) => set('value', v)} placeholder="0" />
            </FormField>
            <FormField
              label={t('crm.create.stage')}
              htmlFor={ids.stage}
              hint={t('crm.create.stageHint', { pct: formatPercent(DEFAULT_PROBABILITY[form.stage]) })}
            >
              <NativeSelect id={ids.stage} value={form.stage} onChange={(e) => set('stage', openStageOf(e.target.value as OpenStage))}>
                {OPEN_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField id={ids.close} label={t('crm.create.close')} required error={errors.close} value={form.close} min={today} onChange={(v) => set('close', v)} />
            <FormField label={t('crm.create.source')} htmlFor={ids.source}>
              <NativeSelect id={ids.source} value={source} onChange={(e) => set('source', e.target.value as LeadSource)}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceLabel(s)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          <div className="space-y-2">
            <Label id={ids.products}>
              {t('crm.create.products')} <span className="font-normal text-muted-foreground">{t('crm.create.optional')}</span>
            </Label>
            <ProductPicker items={priceItems} loading={priceLoading} value={form.products} onChange={(v) => set('products', v)} labelledBy={ids.products} />
          </div>

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
            <DateField id={ids.nextDate} label={t('crm.create.nextStepDate')} value={form.nextStepDate} min={today} onChange={(v) => set('nextStepDate', v)} />
          </div>
          <QuickDates today={today} onPick={(d) => set('nextStepDate', d)} className="-mt-3" />

          {isDirector ? (
            <FormField label={t('crm.create.owner')} htmlFor={ids.owner}>
              <NativeSelect
                id={ids.owner}
                value={form.ownerId}
                onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value, ownerTouched: true }))}
              >
                {owners.length === 0 && viewer ? <option value={viewer.user.id}>{viewer.user.full_name}</option> : null}
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === viewerId ? t('crm.create.ownerMe', { name: u.full_name }) : u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <p className="text-caption">{t('crm.create.ownerSelf')}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay>
              {t('crm.create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
