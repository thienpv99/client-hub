// "Kế hoạch chăm sóc": cadence (days), next care action, due date, who does it. Short input → a dialog (DESIGN §3).
// → api.saveCarePlan (director, the account's AM).
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { Tier } from '@/domain/types';
import type { CarePlanInput, CarePlanView } from '@/services/careContract';
import { api } from '@/services/api';
import { DEFAULT_CADENCE_DAYS, MAX_CADENCE_DAYS, MIN_CADENCE_DAYS } from '@/domain/care';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { personOption, useInternalPeople } from '../../care/careParts';

interface Draft {
  cadence: string;
  nextAction: string;
  due: string;
  ownerId: string;
}

function draftOf(plan: CarePlanView): Draft {
  return {
    cadence: String(plan.cadence_days),
    nextAction: plan.next_action ?? '',
    due: plan.next_action_due ?? '',
    ownerId: plan.next_action_owner?.id ?? '',
  };
}

export interface CarePlanDialogProps {
  account: { id: string; name: string; tier: Tier };
  plan: CarePlanView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CarePlanDialog({ account, plan, open, onOpenChange }: CarePlanDialogProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(plan));
  const [touched, setTouched] = useState(false);
  const people = useInternalPeople(open);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(plan));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const cadence = Number(draft.cadence);
  const cadenceOk = Number.isInteger(cadence) && cadence >= MIN_CADENCE_DAYS && cadence <= MAX_CADENCE_DAYS;
  const cadenceError = touched && !cadenceOk ? t('care.errors.cadenceRange') : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (pending || !cadenceOk) return;
    const input: CarePlanInput = {
      cadence_days: cadence,
      next_action: draft.nextAction.trim() || null,
      next_action_due: draft.due || null,
      next_action_owner_id: draft.ownerId || null,
    };
    const saved = await run(() => api.saveCarePlan(account.id, input));
    if (!saved) return;
    toastSuccess(t('careAccount.overview.plan.saved'));
    onOpenChange(false);
  }

  const ids = { cadence: `${uid}-cadence`, action: `${uid}-action`, due: `${uid}-due`, owner: `${uid}-owner` };

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('careAccount.overview.plan.title')}</DialogTitle>
          <DialogDescription>{t('careAccount.overview.plan.description', { account: account.name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <FormField
            label={t('careAccount.overview.plan.cadence')}
            htmlFor={ids.cadence}
            hint={t('careAccount.overview.plan.cadenceHint', { days: DEFAULT_CADENCE_DAYS[account.tier] })}
            error={cadenceError}
            required
          >
            <Input
              id={ids.cadence}
              type="number"
              inputMode="numeric"
              min={MIN_CADENCE_DAYS}
              max={MAX_CADENCE_DAYS}
              className="tabular sm:max-w-[10rem]"
              value={draft.cadence}
              onChange={(e) => set('cadence', e.target.value)}
            />
          </FormField>
          <FormField label={t('careAccount.overview.plan.nextAction')} htmlFor={ids.action}>
            <Input
              id={ids.action}
              value={draft.nextAction}
              maxLength={300}
              placeholder={t('careAccount.overview.plan.nextActionPlaceholder')}
              onChange={(e) => set('nextAction', e.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('careAccount.overview.plan.due')} htmlFor={ids.due}>
              <Input id={ids.due} type="date" className="tabular" value={draft.due} onChange={(e) => set('due', e.target.value)} />
            </FormField>
            <FormField label={t('careAccount.overview.plan.owner')} htmlFor={ids.owner}>
              <NativeSelect id={ids.owner} value={draft.ownerId} placeholder={t('careAccount.common.none')} onChange={(e) => set('ownerId', e.target.value)}>
                {plan.next_action_owner && !people.some((u) => u.id === plan.next_action_owner?.id) ? (
                  <option value={plan.next_action_owner.id}>{plan.next_action_owner.full_name}</option>
                ) : null}
                {people.map((u) => (
                  <option key={u.id} value={u.id}>
                    {personOption(u)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
