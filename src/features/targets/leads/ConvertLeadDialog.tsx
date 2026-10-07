// "Chuyển thành cơ hội": short form → api.convertLead → toast → the new opportunity page.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tier } from '@/domain/types';
import type { LeadView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { addDays } from '@/domain/dates';
import { todayISO } from '@/domain/clock';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/format';
import { parseAmount, TIERS, tierLabel } from '../targetLabels';

export interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadView;
  people: UserRef[];
  isDirector: boolean;
  meId: string;
}

const DEFAULT_CLOSE_DAYS = 60;

export function ConvertLeadDialog({ open, onOpenChange, lead, people, isDirector, meId }: ConvertLeadDialogProps) {
  const uid = useId();
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [close, setClose] = useState('');
  const [owner, setOwner] = useState('');
  const [tier, setTier] = useState<Tier>('standard');
  const [errors, setErrors] = useState<{ name?: string; value?: string; close?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(t('targets.convert.defaultName', { company: lead.company_name }));
    setValue(lead.budget_estimate ? formatNumber(lead.budget_estimate, 0) : '');
    setClose(addDays(todayISO(), DEFAULT_CLOSE_DAYS));
    setOwner(lead.owner?.id ?? meId);
    setTier('standard');
    setErrors({});
  }, [open, lead, meId]);

  const amount = parseAmount(value);
  // an AM converts for themselves; the director may pick any sales person
  const ownerChoices = isDirector ? people : people.filter((p) => p.id === meId || p.id === lead.owner?.id);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('targets.form.required');
    if (amount === null || Number.isNaN(amount) || amount <= 0) next.value = t('targets.convert.invalidValue');
    if (!close) next.close = t('targets.convert.invalidDate');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const result = await run(
      () =>
        api.convertLead(lead.id, {
          opportunity_name: name.trim(),
          value: amount ?? 0,
          expected_close_date: close,
          owner_id: owner || meId,
          tier,
        }),
      { success: t('targets.convert.done', { company: lead.company_name }) },
    );
    if (result) {
      onOpenChange(false);
      navigate(`/app/crm/opportunities/${result.opportunity_id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('targets.convert.title', { company: lead.company_name })}</DialogTitle>
          <DialogDescription>{t('targets.convert.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <FormField label={t('targets.convert.name')} htmlFor={`${uid}-name`} required error={errors.name}>
            <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('targets.convert.value')}
              htmlFor={`${uid}-value`}
              required
              error={errors.value}
              hint={amount && !Number.isNaN(amount) ? t('targets.convert.valueHint', { amount: formatMoney(amount) }) : undefined}
            >
              <Input
                id={`${uid}-value`}
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="tabular"
                autoComplete="off"
              />
            </FormField>
            <FormField label={t('targets.convert.close')} htmlFor={`${uid}-close`} required error={errors.close}>
              <Input id={`${uid}-close`} type="date" value={close} min={todayISO()} onChange={(e) => setClose(e.target.value)} />
            </FormField>
            <FormField label={t('targets.convert.owner')} htmlFor={`${uid}-owner`}>
              <NativeSelect id={`${uid}-owner`} value={owner} onChange={(e) => setOwner(e.target.value)}>
                {ownerChoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('targets.convert.tier')} htmlFor={`${uid}-tier`}>
              <NativeSelect id={`${uid}-tier`} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                {TIERS.map((x) => (
                  <option key={x} value={x}>
                    {tierLabel(x)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('targets.convert.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
