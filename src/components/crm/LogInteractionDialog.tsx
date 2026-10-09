// "Ghi nhận tương tác": kind, when, subject, summary, outcome, what it is about (account / lead / opportunity /
// contact — prefilled from `defaults`) and the next follow-up date → api.logInteraction.
// Care mode (`care`, CareTouchButton): "Ghi lần chăm sóc" wording and the account's next care action, saved to the
// care plan with the touch (api.saveCarePlan) — logging the planned touch clears "Quá hạn chăm sóc".
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Crosshair, Handshake } from 'lucide-react';
import type { InteractionKind, InteractionOutcome } from '@/domain/crmTypes';
import type { InteractionInput, InteractionView } from '@/services/crmContract';
import { api } from '@/services/api';
import { atTime, nowISO, todayISO } from '@/domain/clock';
import { isOpenLead, isOpenStage } from '@/domain/crm';
import { isFeatureOn } from '@/config/features';
import { useAction } from '@/hooks/useAction';
import { useDelayedFlag } from '@/hooks/useMotion';
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
import { CareNextStep, careDraftChanged, careDraftError, carePlanDraft } from '@/components/care/CareNextStep';
import type { CareNextDraft } from '@/components/care/CareNextStep';
import { INTERACTION_ICONS, INTERACTION_KINDS, INTERACTION_OUTCOMES, interactionKindLabel, outcomeLabel } from './crmLabels';
import { DateField, QuickDates } from './fields';

export interface LogInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** prefilled values (account_id, lead_id, opportunity_id, contact_id, kind, subject…) */
  defaults?: Partial<InteractionInput>;
  onLogged?: (interaction: InteractionView) => void;
  /**
   * care touch (CareTouchButton, SPEC-CARE §6): care wording ("Ghi lần chăm sóc") and the account's next care action
   * (components/care/CareNextStep), saved to its care plan with the touch
   */
  care?: boolean;
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

export function LogInteractionDialog({ open, onOpenChange, defaults, onLogged, care = false }: LogInteractionDialogProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [form, setForm] = useState<FormState>(() => initialState(defaults));
  const [touched, setTouched] = useState(false);
  const [next, setNext] = useState<CareNextDraft | null>(null);
  /** the interaction this opening already logged (a failed care-plan save is retried without logging it again) */
  const loggedRef = useRef<InteractionView | null>(null);
  // sales hidden (SPEC-CARE §1): a care touch logs no opportunity, lead or follow-up date
  const salesOn = isFeatureOn('sales');
  const leadId = salesOn ? defaults?.lead_id ?? '' : '';
  const fixedOppId = salesOn ? defaults?.opportunity_id ?? '' : '';
  const fixedAccountId = defaults?.account_id ?? '';

  // reset every time the dialog opens (new defaults, fresh "now")
  const defaultsKey = JSON.stringify(defaults ?? {});
  useEffect(() => {
    if (open) {
      setForm(initialState(defaults));
      setTouched(false);
      setNext(null);
      loggedRef.current = null;
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
    enabled: salesOn && open && accountId !== '' && fixedOppId === '',
  });
  const contactsQ = useQuery(() => api.listContacts(accountId), [accountId], { enabled: open && accountId !== '' });
  // care touch: the account's care plan (director / AM — the only viewers of CareTouchButton)
  const careQ = useQuery(() => api.getAccountCare(accountId), [accountId], { enabled: care && open && accountId !== '' });
  const plan = care ? careQ.data?.care?.plan ?? null : null;
  const today = todayISO();
  // the draft starts from the plan once per opening (a refetch while typing keeps what was typed)
  useEffect(() => {
    if (open && plan && next === null) setNext(carePlanDraft(plan, today));
  }, [open, plan, next, today]);
  // "Đang tải…" placeholders only when a list takes a beat (DESIGN §8.2); logic keeps the immediate `loading`
  const accountsLoadingVisible = useDelayedFlag(accountsQ.loading);
  const contactsLoadingVisible = useDelayedFlag(contactsQ.loading);

  const accountName = useMemo(() => {
    if (!accountId) return null;
    if (oppQ.data && oppQ.data.account.id === accountId) return oppQ.data.account.name;
    return accountsQ.data?.find((a) => a.id === accountId)?.name ?? null;
  }, [accountId, oppQ.data, accountsQ.data]);

  const subjectError = touched && form.subject.trim() === '' ? t('crm.log.subjectRequired') : null;
  const linkError = touched && !accountId && !leadId ? t('crm.log.linkRequired') : null;
  const contextLoading = accountLocked && lockedAccountId === '';
  const occurredAt = atTime(form.date || today, form.time || '09:00');
  // a touchpoint already happened: a time later today is refused by the service too
  const inFuture = new Date(occurredAt).getTime() > new Date(nowISO()).getTime() + 60_000;
  const timeError = inFuture ? t('crm.log.futureTime') : null;
  // the follow-up date is kept on an open lead or an open deal only (the follow-up list reads nothing else)
  const oppId = salesOn ? fixedOppId || form.opportunityId : '';
  const followUpTarget = !salesOn
    ? false
    : fixedOppId
    ? !!oppQ.data && isOpenStage(oppQ.data.stage)
    : oppId !== '' || (!!leadQ.data && isOpenLead(leadQ.data.status));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (contextLoading || inFuture || form.subject.trim() === '' || (!accountId && !leadId)) return;
    if (next && careDraftError(next)) return;
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
    // a care touch also moves the care plan on (the planned action is done / the next one is set); a cleared action
    // takes its owner with it
    const planInput =
      plan && next && careDraftChanged(plan, next)
        ? { next_action: next.action.trim() || null, next_action_due: next.due || null, ...(next.action.trim() ? {} : { next_action_owner_id: null }) }
        : null;
    const result = await run(
      async () => {
        // two calls: when the plan fails to save after the touch was logged, a retry only saves the plan — the same
        // touch is never logged twice
        const logged = loggedRef.current ?? (await api.logInteraction(input));
        loggedRef.current = logged;
        if (planInput && accountId) await api.saveCarePlan(accountId, planInput);
        return logged;
      },
      { success: care ? 'care.kit.touch.toast' : 'crm.log.toast' },
    );
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
          <DialogTitle>{t(care ? 'care.kit.touch.title' : 'crm.log.title')}</DialogTitle>
          <DialogDescription>{t(care ? 'care.kit.touch.description' : 'crm.log.description')}</DialogDescription>
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
                  placeholder={accountsLoadingVisible ? t('common.loading') : t('crm.log.accountPlaceholder')}
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
            ) : salesOn && accountId && (oppsQ.data?.length ?? 0) > 0 ? (
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
                  placeholder={contactsLoadingVisible ? t('common.loading') : t('crm.log.none')}
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
          ) : salesOn && accountId && !leadId && !fixedOppId && (oppsQ.data?.length ?? 0) > 0 ? (
            <p className="text-caption">{t('crm.log.followUpNeedsDeal')}</p>
          ) : null}

          {plan && next ? <CareNextStep plan={plan} draft={next} onChange={setNext} today={today} showError={touched} /> : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay disabled={contextLoading}>
              {t(care ? 'care.kit.touch.submit' : 'crm.log.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
