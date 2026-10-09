// "Bước tiếp theo" of a care touch (LogInteractionDialog in care mode, opened by CareTouchButton): the account's next
// care action. A touch logged on or after the planned date closes that action — the fields start empty, so the
// overview stops counting the client as overdue unless a new action is set; a future action stays prefilled.
// Saved to the care plan (api.saveCarePlan) right after the interaction, only when it changed.
import { useId } from 'react';
import type { CarePlanView } from '@/services/careContract';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { DateField, QuickDates } from '@/components/crm/fields';

export interface CareNextDraft {
  action: string;
  due: string;
}

/** the planned action is due (today or earlier): this touch is the one that was planned */
export function planSettledBy(plan: CarePlanView, today: string): boolean {
  return plan.next_action !== null && plan.next_action_due !== null && plan.next_action_due <= today;
}

export function carePlanDraft(plan: CarePlanView, today: string): CareNextDraft {
  if (planSettledBy(plan, today)) return { action: '', due: '' };
  return { action: plan.next_action ?? '', due: plan.next_action_due ?? '' };
}

/** the draft differs from the stored plan (else nothing is saved) */
export function careDraftChanged(plan: CarePlanView, draft: CareNextDraft): boolean {
  return draft.action.trim() !== (plan.next_action ?? '') || draft.due !== (plan.next_action_due ?? '');
}

/** a date without saying what is planned */
export function careDraftError(draft: CareNextDraft): string | null {
  return draft.due !== '' && draft.action.trim() === '' ? t('care.kit.touch.nextNeedsText') : null;
}

export interface CareNextStepProps {
  plan: CarePlanView;
  draft: CareNextDraft;
  onChange(draft: CareNextDraft): void;
  today: string;
  /** show the validation error (after a submit attempt) */
  showError: boolean;
}

export function CareNextStep({ plan, draft, onChange, today, showError }: CareNextStepProps) {
  const uid = useId();
  const settled = planSettledBy(plan, today);
  const current =
    plan.next_action && plan.next_action_due
      ? t(settled ? 'care.kit.touch.currentSettled' : 'care.kit.touch.current', {
          action: plan.next_action,
          date: formatDateShort(plan.next_action_due),
        })
      : null;
  return (
    <fieldset className="space-y-3 border-t border-border/60 pt-5">
      <legend className="sr-only">{t('care.kit.touch.nextTitle')}</legend>
      <p aria-hidden="true" className="text-table font-semibold text-ink">
        {t('care.kit.touch.nextTitle')}
      </p>
      {current ? <p className="rounded-lg bg-subtle p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/60">{current}</p> : null}
      <FormField label={t('care.kit.touch.next')} htmlFor={`${uid}-next`} hint={t('care.kit.touch.nextHint')} error={showError ? careDraftError(draft) : null}>
        <Input
          id={`${uid}-next`}
          value={draft.action}
          maxLength={300}
          placeholder={t('care.kit.touch.nextPlaceholder')}
          onChange={(e) => onChange({ ...draft, action: e.target.value })}
        />
      </FormField>
      <DateField id={`${uid}-due`} label={t('care.kit.touch.nextDue')} value={draft.due} min={today} onChange={(v) => onChange({ ...draft, due: v })} />
      <QuickDates today={today} offsets={[3, 7]} onPick={(d) => onChange({ ...draft, due: d })} className="-mt-3" />
    </fieldset>
  );
}
