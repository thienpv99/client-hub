// "Ngưỡng & quy tắc": discount approval threshold, reminders, escalation, email cadence, weekly digest and the
// automatic payment task. Director edits (sticky save bar); everyone else sees the same values read-only.
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Info, Save } from 'lucide-react';
import type { Settings } from '@/domain/types';
import { isFullSettings } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { CardSkeleton } from '@/components/common/skeletons';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { AffixInput, FieldError } from './fieldParts';

interface RulesForm {
  threshold: string;
  escalation: string;
  reminders: number[];
  maxEmails: string;
  digestWeekday: number;
  digestHour: number;
  paymentAuto: boolean;
}

type FieldKey = 'threshold' | 'escalation' | 'maxEmails';

const REMINDER_CHOICES = [7, 5, 3, 2, 1];
/** Monday first, Sunday last (Vietnamese week) */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function fromSettings(s: Settings): RulesForm {
  return {
    threshold: String(s.discount_approval_threshold_pct).replace('.', ','),
    escalation: String(s.escalation_overdue_days),
    reminders: [...s.reminder_days_before].sort((a, b) => b - a),
    maxEmails: String(s.max_emails_per_day),
    digestWeekday: s.weekly_digest_weekday,
    digestHour: s.weekly_digest_hour,
    paymentAuto: s.payment_task_auto,
  };
}

function parseDecimal(v: string): number | null {
  const s = v.trim().replace(',', '.');
  return /^\d{1,3}(\.\d{1,2})?$/.test(s) ? Number(s) : null;
}

function parseInteger(v: string): number | null {
  const s = v.trim();
  return /^\d{1,3}$/.test(s) ? Number(s) : null;
}

function validate(f: RulesForm): { patch: Partial<Settings> | null; errors: Partial<Record<FieldKey, string>> } {
  const errors: Partial<Record<FieldKey, string>> = {};
  const threshold = parseDecimal(f.threshold);
  if (threshold === null || threshold > 100) errors.threshold = t('settings.rules.threshold.error');
  const escalation = parseInteger(f.escalation);
  if (escalation === null || escalation < 1 || escalation > 60) errors.escalation = t('settings.rules.escalation.error');
  const maxEmails = parseInteger(f.maxEmails);
  if (maxEmails === null || maxEmails < 1 || maxEmails > 20) errors.maxEmails = t('settings.rules.maxEmails.error');
  if (threshold === null || escalation === null || maxEmails === null || Object.keys(errors).length > 0) {
    return { patch: null, errors };
  }
  return {
    patch: {
      discount_approval_threshold_pct: threshold,
      escalation_overdue_days: escalation,
      reminder_days_before: [...f.reminders].sort((a, b) => b - a),
      max_emails_per_day: maxEmails,
      weekly_digest_weekday: f.digestWeekday,
      weekly_digest_hour: f.digestHour,
      payment_task_auto: f.paymentAuto,
    },
    errors,
  };
}

function sameForm(a: RulesForm, b: RulesForm): boolean {
  const norm = (f: RulesForm) =>
    JSON.stringify({
      ...f,
      threshold: f.threshold.trim().replace(',', '.'),
      escalation: f.escalation.trim(),
      maxEmails: f.maxEmails.trim(),
      reminders: [...f.reminders].sort((x, y) => y - x),
    });
  return norm(a) === norm(b);
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** "3 ngày và 1 ngày" */
export function reminderListText(days: number[]): string {
  const parts = [...days].sort((a, b) => b - a).map((d) => t('settings.rules.reminders.day', { days: d }));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${t('common.and')} ${parts[parts.length - 1]}`;
}

interface RowA11y {
  labelId: string;
  describedBy: string;
  invalid: boolean;
}

function RuleRow({
  id,
  label,
  hint,
  error,
  group = false,
  children,
}: {
  id: string;
  label: ReactNode;
  hint: ReactNode;
  error?: string;
  /** the control is a group (toggle buttons, two selects): the label is not a <label for> */
  group?: boolean;
  children: (a11y: RowA11y) => ReactNode;
}) {
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${hintId} ${errorId}` : hintId;
  return (
    <div className="grid gap-3 !py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:gap-8">
      <div className="min-w-0">
        {group ? (
          <p id={labelId} className="text-table font-medium text-foreground">
            {label}
          </p>
        ) : (
          <label id={labelId} htmlFor={id} className="text-table font-medium text-foreground">
            {label}
          </label>
        )}
        <p id={hintId} className="mt-1 text-caption">
          {hint}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        {children({ labelId, describedBy, invalid: Boolean(error) })}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    </div>
  );
}

export function RulesTab({ canEdit }: { canEdit: boolean }) {
  const { data, loading, error, refetch } = useQuery(() => api.getSettings(), []);
  const { run, pending } = useAction();
  const [base, setBase] = useState<RulesForm | null>(null);
  const [edit, setEdit] = useState<RulesForm | null>(null);

  useEffect(() => {
    if (data && isFullSettings(data)) setBase(fromSettings(data));
  }, [data]);

  if (loading || (!base && !error)) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    );
  }
  if (!base) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const form = edit ?? base;
  const dirty = edit !== null && !sameForm(edit, base);
  const { patch, errors } = validate(form);
  const disabled = !canEdit || pending;
  const reminderChoices = [...new Set([...REMINDER_CHOICES, ...form.reminders])].sort((a, b) => b - a);

  const set = (p: Partial<RulesForm>) => setEdit((prev) => ({ ...(prev ?? base), ...p }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit || !dirty) return;
    if (!patch) {
      const first = (['threshold', 'escalation', 'maxEmails'] as const).find((k) => errors[k]);
      if (first) document.getElementById(`rule-${first}`)?.focus();
      return;
    }
    const saved = await run(() => api.updateSettings(patch), { success: 'settings.rules.toast.saved' });
    if (saved) {
      setBase(fromSettings(saved));
      setEdit(null);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4" aria-label={t('settings.tabs.rules.title')}>
      <SectionCard as="h3" title={t('settings.rules.sections.quotes')} divided>
        <RuleRow
          id="rule-threshold"
          label={t('settings.rules.threshold.label')}
          hint={t('settings.rules.threshold.hint')}
          error={errors.threshold}
        >
          {(a11y) => (
            <AffixInput
              id="rule-threshold"
              inputMode="decimal"
              autoComplete="off"
              className="tabular"
              wrapperClassName="md:max-w-[10rem]"
              suffix="%"
              value={form.threshold}
              disabled={disabled}
              aria-describedby={a11y.describedBy}
              aria-invalid={a11y.invalid || undefined}
              onChange={(e) => set({ threshold: e.target.value })}
            />
          )}
        </RuleRow>
      </SectionCard>

      <SectionCard as="h3" title={t('settings.rules.sections.reminders')} divided>
        <RuleRow id="rule-reminders" group label={t('settings.rules.reminders.label')} hint={t('settings.rules.reminders.hint')}>
          {(a11y) => (
            <>
              {/* number chips + one unit word: the five choices stay on one row in the control column */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={form.reminders.map(String)}
                  disabled={disabled}
                  onValueChange={(values: string[]) => set({ reminders: values.map(Number).filter((n) => Number.isInteger(n)) })}
                  aria-labelledby={a11y.labelId}
                  aria-describedby={a11y.describedBy}
                  className="flex-wrap"
                >
                  {reminderChoices.map((d) => (
                    <ToggleGroupItem
                      key={d}
                      value={String(d)}
                      aria-label={t('settings.rules.reminders.choiceAria', { days: d })}
                      className="tabular"
                    >
                      {d}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <span className="text-table text-muted-foreground" aria-hidden="true">
                  {t('settings.rules.reminders.unit')}
                </span>
              </div>
              <p className="text-caption">
                {form.reminders.length > 0
                  ? t('settings.rules.reminders.summary', { list: reminderListText(form.reminders) })
                  : t('settings.rules.reminders.none')}
              </p>
            </>
          )}
        </RuleRow>
        <RuleRow
          id="rule-escalation"
          label={t('settings.rules.escalation.label')}
          hint={t('settings.rules.escalation.hint')}
          error={errors.escalation}
        >
          {(a11y) => (
            <AffixInput
              id="rule-escalation"
              inputMode="numeric"
              autoComplete="off"
              className="tabular"
              wrapperClassName="md:max-w-[12rem]"
              suffix={t('settings.rules.escalation.suffix')}
              value={form.escalation}
              disabled={disabled}
              aria-describedby={a11y.describedBy}
              aria-invalid={a11y.invalid || undefined}
              onChange={(e) => set({ escalation: e.target.value })}
            />
          )}
        </RuleRow>
        <p className="flex items-start gap-2 text-caption">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t('settings.rules.overdueOncePerDay')}</span>
        </p>
      </SectionCard>

      <SectionCard as="h3" title={t('settings.rules.sections.email')} divided>
        <RuleRow
          id="rule-maxEmails"
          label={t('settings.rules.maxEmails.label')}
          hint={t('settings.rules.maxEmails.hint')}
          error={errors.maxEmails}
        >
          {(a11y) => (
            <AffixInput
              id="rule-maxEmails"
              inputMode="numeric"
              autoComplete="off"
              className="tabular"
              wrapperClassName="md:max-w-[12rem]"
              suffix={t('settings.rules.maxEmails.suffix')}
              value={form.maxEmails}
              disabled={disabled}
              aria-describedby={a11y.describedBy}
              aria-invalid={a11y.invalid || undefined}
              onChange={(e) => set({ maxEmails: e.target.value })}
            />
          )}
        </RuleRow>
        <RuleRow id="rule-digest" group label={t('settings.rules.digest.label')} hint={t('settings.rules.digest.hint')}>
          {(a11y) => (
            <>
              <div role="group" aria-labelledby={a11y.labelId} aria-describedby={a11y.describedBy} className="grid grid-cols-2 gap-2">
                <NativeSelect
                  aria-label={t('settings.rules.digest.weekday')}
                  value={String(form.digestWeekday)}
                  disabled={disabled}
                  onChange={(e) => set({ digestWeekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {t(`common.weekday.${d}`)}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label={t('settings.rules.digest.hour')}
                  value={String(form.digestHour)}
                  disabled={disabled}
                  className="tabular"
                  onChange={(e) => set({ digestHour: Number(e.target.value) })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-caption">
                {t('settings.rules.digest.summary', {
                  weekday: t(`common.weekday.${form.digestWeekday}`),
                  hour: hourLabel(form.digestHour),
                })}
              </p>
            </>
          )}
        </RuleRow>
      </SectionCard>

      <SectionCard as="h3" title={t('settings.rules.sections.payments')} divided>
        <RuleRow id="rule-paymentAuto" label={t('settings.rules.paymentAuto.label')} hint={t('settings.rules.paymentAuto.hint')}>
          {(a11y) => (
            <div className="flex min-h-tap items-center gap-3 md:min-h-10">
              <Switch
                id="rule-paymentAuto"
                checked={form.paymentAuto}
                disabled={disabled}
                aria-describedby={a11y.describedBy}
                onCheckedChange={(v) => set({ paymentAuto: v })}
              />
              <span className="text-table text-muted-foreground" aria-hidden="true">
                {form.paymentAuto ? t('settings.rules.paymentAuto.on') : t('settings.rules.paymentAuto.off')}
              </span>
            </div>
          )}
        </RuleRow>
      </SectionCard>

      {canEdit && dirty ? (
        // phones: full-bleed bar on the bottom edge; from md a floating card bar (DESIGN §5 forms: sticky footer)
        <div className="sticky bottom-0 z-20 -mx-4 animate-pop-in md:bottom-4 md:mx-0">
          <div className="flex flex-col gap-3 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:rounded-xl md:border md:px-5 md:pb-3 md:shadow-pop">
            <p role="status" className="text-table text-muted-foreground">
              {patch ? t('settings.rules.saveBar.dirty') : t('settings.rules.saveBar.invalid')}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1 sm:flex-none" disabled={pending} onClick={() => setEdit(null)}>
                {t('settings.rules.saveBar.discard')}
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none" loading={pending}>
                {!pending ? <Save aria-hidden="true" /> : null}
                {t('settings.rules.saveBar.save')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
