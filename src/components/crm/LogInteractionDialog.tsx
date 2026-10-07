// "Ghi nhận tương tác": kind, when, subject, summary, outcome, what it is about (account / lead / opportunity /
// contact — prefilled from `defaults`) and the next follow-up date → api.logInteraction.
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Crosshair, Handshake } from 'lucide-react';
import type { InteractionKind, InteractionOutcome } from '@/domain/crmTypes';
import type { InteractionInput, InteractionView } from '@/services/crmContract';
import { api } from '@/services/api';
import { atTime, nowISO, todayISO } from '@/domain/clock';
import { isOpenLead, isOpenStage } from '@/domain/crm';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SMALL } from '@/components/common/cx';
import { INTERACTION_ICONS, INTERACTION_KINDS, INTERACTION_OUTCOMES, interactionKindLabel, outcomeLabel } from './crmLabels';
import { DateField, QuickDates } from './fields';

export interface LogInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** prefilled values (account_id, lead_id, opportunity_id, contact_id, kind, subject…) */
  defaults?: Partial<InteractionInput>;
  onLogged?: (interaction: InteractionView) => void;
}

interface FormState {
  kind: InteractionKind;
  date: string;
  time: string;
  subject: string;
  summary: string;
  outcome: InteractionOutcome | '';
  accountId: string;
  opportunityId: string;
  contactId: string;
  followUp: string;
}

function initialState(defaults: Partial<InteractionInput> | undefined): FormState {
  const now = nowISO();
  const occurred = defaults?.occurred_at ?? null;
  return {
    kind: defaults?.kind ?? 'call',
    date: occurred ? occurred.slice(0, 10) : now.slice(0, 10),
    time: occurred && occurred.length > 10 ? occurred.slice(11, 16) : now.slice(11, 16),
    subject: defaults?.subject ?? '',
    summary: defaults?.summary ?? '',
    outcome: defaults?.outcome ?? '',
    accountId: defaults?.account_id ?? '',
    opportunityId: defaults?.opportunity_id ?? '',
    contactId: defaults?.contact_id ?? '',
    followUp: defaults?.next_follow_up_date ?? '',
  };
}

/** read-only "about" line for a prefilled link */
function LinkedChip({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg bg-subtle px-3 py-2 ring-1 ring-inset ring-border/60">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className={cn('shrink-0 text-muted-foreground', SMALL)}>{label}</span>
      <span className="min-w-0 truncate text-table font-medium text-ink">{value}</span>
    </div>
  );
}

export function LogInteractionDialog({ open, onOpenChange, defaults, onLogged }: LogInteractionDialogProps) {
  const uid = useId();
  const { run, pending } = useAction();
  const [form, setForm] = useState<FormState>(() => initialState(defaults));
  const [touched, setTouched] = useState(false);
  const leadId = defaults?.lead_id ?? '';
  const fixedOppId = defaults?.opportunity_id ?? '';
  const fixedAccountId = defaults?.account_id ?? '';

  // reset every time the dialog opens (new defaults, fresh "now")
  const defaultsKey = JSON.stringify(defaults ?? {});
  useEffect(() => {
    if (open) {
      setForm(initialState(defaults));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultsKey]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // context of the prefilled links: an opportunity fixes its account; a lead stands on its own
  const leadQ = useQuery(() => api.getLead(leadId), [leadId], { enabled: open && leadId !== '' });
  const oppQ = useQuery(() => api.getOpportunity(fixedOppId), [fixedOppId], { enabled: open && fixedOppId !== '' });
  const accountLocked = fixedAccountId !== '' || fixedOppId !== '';
  const lockedAccountId = fixedAccountId || oppQ.data?.account.id || '';
  const accountId = accountLocked ? lockedAccountId : form.accountId;
  const needAccounts = open && fixedOppId === '' && (leadId === '' || fixedAccountId !== '');
  const accountsQ = useQuery(() => api.listAccounts(), [], { enabled: needAccounts });
  const oppsQ = useQuery(() => api.listOpportunities({ accountId, openOnly: true }), [accountId], {
    enabled: open && accountId !== '' && fixedOppId === '',
  });
  const contactsQ = useQuery(() => api.listContacts(accountId), [accountId], { enabled: open && accountId !== '' });

  const accountName = useMemo(() => {
    if (!accountId) return null;
    if (oppQ.data && oppQ.data.account.id === accountId) return oppQ.data.account.name;
    return accountsQ.data?.find((a) => a.id === accountId)?.name ?? null;
  }, [accountId, oppQ.data, accountsQ.data]);

  const subjectError = touched && form.subject.trim() === '' ? t('crm.log.subjectRequired') : null;
  const linkError = touched && !accountId && !leadId ? t('crm.log.linkRequired') : null;
  const contextLoading = accountLocked && lockedAccountId === '';
  const today = todayISO();
  const occurredAt = atTime(form.date || today, form.time || '09:00');
  // a touchpoint already happened: a time later today is refused by the service too
  const inFuture = new Date(occurredAt).getTime() > new Date(nowISO()).getTime() + 60_000;
  const timeError = inFuture ? t('crm.log.futureTime') : null;
  // the follow-up date is kept on an open lead or an open deal only (the follow-up list reads nothing else)
  const oppId = fixedOppId || form.opportunityId;
  const followUpTarget = fixedOppId
    ? !!oppQ.data && isOpenStage(oppQ.data.stage)
    : oppId !== '' || (!!leadQ.data && isOpenLead(leadQ.data.status));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (contextLoading || inFuture || form.subject.trim() === '' || (!accountId && !leadId)) return;
    const input: InteractionInput = {
      kind: form.kind,
      occurred_at: occurredAt,
      subject: form.subject.trim(),
      summary: form.summary.trim(),
      outcome: form.outcome === '' ? null : form.outcome,
      account_id: accountId || null,
      lead_id: leadId || null,
      opportunity_id: oppId || null,
      contact_id: form.contactId || null,
      next_follow_up_date: followUpTarget ? form.followUp || null : null,
    };
    const result = await run(() => api.logInteraction(input), { success: 'crm.log.toast' });
    if (result) {
      onLogged?.(result);
      onOpenChange(false);
    }
  }

  const ids = {
    subject: `${uid}-subject`,
    summary: `${uid}-summary`,
    date: `${uid}-date`,
    time: `${uid}-time`,
    account: `${uid}-account`,
    opp: `${uid}-opp`,
    contact: `${uid}-contact`,
    follow: `${uid}-follow`,
    kind: `${uid}-kind`,
    outcome: `${uid}-outcome`,
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('crm.log.title')}</DialogTitle>
          <DialogDescription>{t('crm.log.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label id={ids.kind}>{t('crm.log.kind')}</Label>
            <ToggleGroup
              type="single"
              variant="segmented"
              value={form.kind}
              onValueChange={(v) => {
                if (v) set('kind', v as InteractionKind);
              }}
              aria-labelledby={ids.kind}
              className="grid w-full grid-cols-3"
            >
              {INTERACTION_KINDS.map((k) => {
                const Icon = INTERACTION_ICONS[k];
                return (
                  <ToggleGroupItem key={k} value={k} className="w-full px-2">
                    <Icon aria-hidden="true" />
                    <span className="truncate">{interactionKindLabel(k)}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField id={ids.date} label={t('crm.log.date')} required value={form.date} max={today} onChange={(v) => set('date', v)} />
            <FormField label={t('crm.log.time')} htmlFor={ids.time} error={timeError}>
              <Input id={ids.time} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </FormField>
          </div>

          <FormField label={t('crm.log.subject')} htmlFor={ids.subject} required error={subjectError}>
            <Input
              id={ids.subject}
              value={form.subject}
              maxLength={160}
              placeholder={t(`crm.log.subjectPlaceholder.${form.kind}`)}
              onChange={(e) => set('subject', e.target.value)}
            />
          </FormField>

          <FormField label={t('crm.log.summary')} htmlFor={ids.summary} hint={t('crm.log.summaryHint')}>
            <Textarea id={ids.summary} rows={3} value={form.summary} maxLength={2000} onChange={(e) => set('summary', e.target.value)} />
          </FormField>

          <div className="space-y-2">
            <Label id={ids.outcome}>{t('crm.log.outcome')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.outcome}
              onValueChange={(v) => set('outcome', (v || '') as InteractionOutcome | '')}
              aria-labelledby={ids.outcome}
              className="flex w-full flex-wrap"
            >
              {INTERACTION_OUTCOMES.map((o) => (
                <ToggleGroupItem key={o} value={o} className="flex-1">
                  {outcomeLabel(o)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <fieldset className="space-y-3 border-t border-border/60 pt-5">
            <legend className="sr-only">{t('crm.log.about')}</legend>
            <p aria-hidden="true" className="text-table font-semibold text-ink">
              {t('crm.log.about')}
            </p>
            {leadId ? (
              <LinkedChip icon={Crosshair} label={t('crm.log.lead')} value={leadQ.data?.company_name ?? t('common.loading')} />
            ) : null}
            {accountLocked ? (
              <LinkedChip icon={Building2} label={t('crm.log.account')} value={accountName ?? t('common.loading')} />
            ) : !leadId ? (
              <FormField label={t('crm.log.account')} htmlFor={ids.account} required error={linkError}>
                <NativeSelect
                  id={ids.account}
                  value={form.accountId}
                  placeholder={accountsQ.loading ? t('common.loading') : t('crm.log.accountPlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value, opportunityId: '', contactId: '' }))}
                >
                  {(accountsQ.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}
            {fixedOppId ? (
              <LinkedChip icon={Handshake} label={t('crm.log.opportunity')} value={oppQ.data?.name ?? t('common.loading')} />
            ) : accountId && (oppsQ.data?.length ?? 0) > 0 ? (
              <FormField label={t('crm.log.opportunity')} htmlFor={ids.opp}>
                <NativeSelect id={ids.opp} value={form.opportunityId} placeholder={t('crm.log.none')} onChange={(e) => set('opportunityId', e.target.value)}>
                  {(oppsQ.data ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}
            {accountId ? (
              <FormField label={t('crm.log.contact')} htmlFor={ids.contact}>
                <NativeSelect
                  id={ids.contact}
                  value={form.contactId}
                  placeholder={contactsQ.loading ? t('common.loading') : t('crm.log.none')}
                  onChange={(e) => set('contactId', e.target.value)}
                >
                  {(contactsQ.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title ? t('crm.timeline.contact', { name: c.full_name, title: c.title }) : c.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}
          </fieldset>

          {followUpTarget ? (
            <>
              <DateField
                id={ids.follow}
                label={t('crm.log.followUp')}
                hint={oppId ? t('crm.log.followUpHint') : t('crm.log.followUpHintLead')}
                value={form.followUp}
                min={today}
                onChange={(v) => set('followUp', v)}
              />
              <QuickDates today={today} onPick={(d) => set('followUp', d)} className="-mt-3" />
            </>
          ) : accountId && !leadId && !fixedOppId && (oppsQ.data?.length ?? 0) > 0 ? (
            <p className="text-caption">{t('crm.log.followUpNeedsDeal')}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={contextLoading}>
              {t('crm.log.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
