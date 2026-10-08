// Create / edit a target company (api.upsertLead). Full screen on phones, centred dialog from 640px.
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { CompanySize, LeadSource, RevenueBand } from '@/domain/crmTypes';
import type { Salutation } from '@/domain/types';
import type { LeadInput, LeadView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import {
  COMPANY_SIZES,
  LEAD_SOURCES,
  leadSourceLabel,
  parseAmount,
  REVENUE_BANDS,
  revenueLabel,
  sizeLabel,
  toLeadInput,
} from '../targetLabels';

export interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** edit this lead; null = create */
  lead: LeadView | null;
  people: UserRef[];
  isDirector: boolean;
  meId: string;
  onSaved?: (lead: LeadView) => void;
}

export function LeadFormDialog(props: LeadFormDialogProps) {
  // a fresh form on every opening, kept on screen while the dialog fades out
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((n) => n + 1);
  }
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className={cn(
          'h-[100dvh] max-h-[100dvh] gap-0 overflow-hidden rounded-none border-0 p-0',
          'sm:h-fit sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-xl sm:border sm:p-0',
        )}
      >
        {session > 0 ? (
          <LeadForm key={session} {...props} />
        ) : (
          <DialogTitle className="sr-only">{t('targets.form.createTitle')}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormState {
  company_name: string;
  industry: string;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  website: string;
  contact_salutation: Salutation;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  source: LeadSource;
  owner_id: string;
  tags: string;
  need_summary: string;
  budget: string;
  notes: string;
  next_follow_up_date: string;
}

type ErrorKey = 'company_name' | 'industry' | 'province' | 'contact_name' | 'contact_email' | 'budget';

function initialState(lead: LeadView | null, isDirector: boolean, meId: string): FormState {
  if (lead) {
    return {
      company_name: lead.company_name,
      industry: lead.industry,
      province: lead.province,
      size: lead.size,
      revenue_band: lead.revenue_band,
      website: lead.website ?? '',
      contact_salutation: lead.contact_salutation,
      contact_name: lead.contact_name,
      contact_title: lead.contact_title,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone ?? '',
      source: lead.source,
      owner_id: lead.owner?.id ?? '',
      tags: lead.tags.join(', '),
      need_summary: lead.need_summary ?? '',
      budget: lead.budget_estimate === null ? '' : formatNumber(lead.budget_estimate, 0),
      notes: lead.notes ?? '',
      next_follow_up_date: lead.next_follow_up_date ?? '',
    };
  }
  return {
    company_name: '',
    industry: '',
    province: '',
    size: '50_200',
    revenue_band: '50_200b',
    website: '',
    contact_salutation: 'anh',
    contact_name: '',
    contact_title: '',
    contact_email: '',
    contact_phone: '',
    source: 'outbound',
    owner_id: isDirector ? '' : meId,
    tags: '',
    need_summary: '',
    budget: '',
    notes: '',
    next_follow_up_date: '',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const orNull = (s: string): string | null => (s.trim() ? s.trim() : null);

function validate(s: FormState): Partial<Record<ErrorKey, string>> {
  const errors: Partial<Record<ErrorKey, string>> = {};
  const required = t('targets.form.required');
  if (!s.company_name.trim()) errors.company_name = required;
  if (!s.industry.trim()) errors.industry = required;
  if (!s.province.trim()) errors.province = required;
  if (!s.contact_name.trim()) errors.contact_name = required;
  if (!s.contact_email.trim()) errors.contact_email = required;
  else if (!EMAIL_RE.test(s.contact_email.trim())) errors.contact_email = t('targets.form.emailInvalid');
  if (Number.isNaN(parseAmount(s.budget))) errors.budget = t('targets.form.budgetInvalid');
  return errors;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-3 text-heading font-semibold tracking-tightish text-ink">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function LeadForm({ onOpenChange, lead, people, isDirector, meId, onSaved }: LeadFormDialogProps) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { run, pending, pendingVisible } = useAction();
  const [state, setState] = useState<FormState>(() => initialState(lead, isDirector, meId));
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const options = useQuery(() => api.getTargetingOptions(), []);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const budget = parseAmount(state.budget);
  const me = people.find((p) => p.id === meId);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate(state);
    setErrors(found);
    const first = (Object.keys(found) as ErrorKey[])[0];
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    const fields: LeadInput = {
      company_name: state.company_name.trim(),
      industry: state.industry.trim(),
      province: state.province.trim(),
      size: state.size,
      revenue_band: state.revenue_band,
      website: orNull(state.website),
      contact_name: state.contact_name.trim(),
      contact_title: state.contact_title.trim(),
      contact_salutation: state.contact_salutation,
      contact_email: state.contact_email.trim(),
      contact_phone: orNull(state.contact_phone),
      source: state.source,
      owner_id: state.owner_id || null,
      tags: state.tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      need_summary: orNull(state.need_summary),
      budget_estimate: budget === null || Number.isNaN(budget) ? null : budget,
      notes: orNull(state.notes),
      next_follow_up_date: state.next_follow_up_date || null,
    };
    const input: LeadInput = lead ? toLeadInput(lead, fields) : fields;
    const company = input.company_name;
    const saved = await run(() => api.upsertLead(input), {
      success: lead ? t('targets.form.saved', { company }) : t('targets.form.created', { company }),
    });
    if (saved) {
      onOpenChange(false);
      onSaved?.(saved);
    }
  }

  const ownerChoices: { value: string; label: string }[] = isDirector
    ? [{ value: '', label: t('targets.form.ownerNone') }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]
    : [
        { value: meId, label: me ? me.full_name : t('targets.form.ownerMe') },
        { value: '', label: t('targets.form.ownerNone') },
      ];
  // an AM editing a lead owned by someone else keeps that owner as an option
  if (lead?.owner && !ownerChoices.some((o) => o.value === lead.owner?.id)) {
    ownerChoices.unshift({ value: lead.owner.id, label: lead.owner.full_name });
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 border-b border-border/70 px-4 pb-4 pr-14 pt-5 sm:px-6 sm:pr-14">
        <DialogTitle>{lead ? t('targets.form.editTitle') : t('targets.form.createTitle')}</DialogTitle>
        <DialogDescription>{t('targets.form.description')}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-4 py-5 sm:px-6">
        <Section title={t('targets.form.sections.company')}>
          <FormField label={t('targets.form.companyName')} htmlFor={id('company_name')} required error={errors.company_name} className="sm:col-span-2">
            <Input
              id={id('company_name')}
              value={state.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              placeholder={t('targets.form.companyPlaceholder')}
              autoComplete="organization"
            />
          </FormField>
          <FormField label={t('targets.form.industry')} htmlFor={id('industry')} required error={errors.industry}>
            <Input
              id={id('industry')}
              list={id('industries')}
              value={state.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder={t('targets.form.industryPlaceholder')}
              autoComplete="off"
            />
          </FormField>
          <FormField label={t('targets.form.province')} htmlFor={id('province')} required error={errors.province}>
            <Input
              id={id('province')}
              list={id('provinces')}
              value={state.province}
              onChange={(e) => set('province', e.target.value)}
              placeholder={t('targets.form.provincePlaceholder')}
              autoComplete="off"
            />
          </FormField>
          <FormField label={t('targets.form.size')} htmlFor={id('size')}>
            <NativeSelect id={id('size')} value={state.size} onChange={(e) => set('size', e.target.value as CompanySize)}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {sizeLabel(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('targets.form.revenue')} htmlFor={id('revenue')}>
            <NativeSelect id={id('revenue')} value={state.revenue_band} onChange={(e) => set('revenue_band', e.target.value as RevenueBand)}>
              {REVENUE_BANDS.map((s) => (
                <option key={s} value={s}>
                  {revenueLabel(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('targets.form.website')} htmlFor={id('website')} className="sm:col-span-2">
            <Input
              id={id('website')}
              type="url"
              inputMode="url"
              value={state.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder={t('targets.form.websitePlaceholder')}
            />
          </FormField>
        </Section>

        <Section title={t('targets.form.sections.contact')}>
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 sm:col-span-2">
            <FormField label={t('targets.form.salutation')} htmlFor={id('salutation')}>
              <NativeSelect
                id={id('salutation')}
                value={state.contact_salutation}
                onChange={(e) => set('contact_salutation', e.target.value === 'chị' ? 'chị' : 'anh')}
              >
                <option value="anh">{t('enums.salutationTitle.anh')}</option>
                <option value="chị">{t('enums.salutationTitle.chị')}</option>
              </NativeSelect>
            </FormField>
            <FormField label={t('targets.form.contactName')} htmlFor={id('contact_name')} required error={errors.contact_name}>
              <Input id={id('contact_name')} value={state.contact_name} onChange={(e) => set('contact_name', e.target.value)} autoComplete="name" />
            </FormField>
          </div>
          <FormField label={t('targets.form.contactTitle')} htmlFor={id('contact_title')} className="sm:col-span-2">
            <Input
              id={id('contact_title')}
              value={state.contact_title}
              onChange={(e) => set('contact_title', e.target.value)}
              placeholder={t('targets.form.contactTitlePlaceholder')}
              autoComplete="organization-title"
            />
          </FormField>
          <FormField label={t('targets.form.contactEmail')} htmlFor={id('contact_email')} required error={errors.contact_email}>
            <Input
              id={id('contact_email')}
              type="email"
              inputMode="email"
              value={state.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              autoComplete="email"
            />
          </FormField>
          <FormField label={t('targets.form.contactPhone')} htmlFor={id('contact_phone')}>
            <Input
              id={id('contact_phone')}
              type="tel"
              inputMode="tel"
              value={state.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              autoComplete="tel"
            />
          </FormField>
        </Section>

        <Section title={t('targets.form.sections.need')}>
          <FormField label={t('targets.form.needSummary')} htmlFor={id('need')} className="sm:col-span-2">
            <Textarea
              id={id('need')}
              rows={3}
              value={state.need_summary}
              onChange={(e) => set('need_summary', e.target.value)}
              placeholder={t('targets.form.needPlaceholder')}
            />
          </FormField>
          <FormField
            label={t('targets.form.budget')}
            htmlFor={id('budget')}
            error={errors.budget}
            hint={budget !== null && !Number.isNaN(budget) && budget > 0 ? t('targets.form.budgetHint', { amount: formatMoney(budget) }) : undefined}
          >
            <Input
              id={id('budget')}
              inputMode="numeric"
              value={state.budget}
              onChange={(e) => set('budget', e.target.value)}
              className="tabular"
              autoComplete="off"
            />
          </FormField>
          <FormField label={t('targets.form.source')} htmlFor={id('source')}>
            <NativeSelect id={id('source')} value={state.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {leadSourceLabel(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('targets.form.owner')} htmlFor={id('owner')}>
            <NativeSelect id={id('owner')} value={state.owner_id} onChange={(e) => set('owner_id', e.target.value)}>
              {ownerChoices.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('targets.form.nextFollowUp')} htmlFor={id('next')}>
            <Input
              id={id('next')}
              type="date"
              value={state.next_follow_up_date}
              onChange={(e) => set('next_follow_up_date', e.target.value)}
            />
          </FormField>
          <FormField label={t('targets.form.tags')} htmlFor={id('tags')} hint={t('targets.form.tagsHint')} className="sm:col-span-2">
            <Input id={id('tags')} value={state.tags} onChange={(e) => set('tags', e.target.value)} autoComplete="off" />
          </FormField>
          <FormField label={t('targets.form.notes')} htmlFor={id('notes')} className="sm:col-span-2">
            <Textarea id={id('notes')} rows={3} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormField>
        </Section>

        <datalist id={id('industries')}>
          {(options.data?.industries ?? []).map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <datalist id={id('provinces')}>
          {(options.data?.provinces ?? []).map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
        <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={pending}>
          {lead ? t('targets.form.save') : t('targets.form.create')}
        </Button>
      </div>
    </form>
  );
}
