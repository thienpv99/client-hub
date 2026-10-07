// "Điều chỉnh dự báo": a manual forecast date with a required reason, or back to the automatic forecast.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { api } from '@/services/api';
import { diffDays, isValidISODate } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { ForecastLabel } from '@/components/common/forecast-label';
import { DateField } from './DateField';

export interface ForecastOverrideDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  milestone: MilestoneView;
}

export function ForecastOverrideDialog({ open, onOpenChange, milestone: m }: ForecastOverrideDialogProps) {
  const ids = useId();
  const { run, pending } = useAction();
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const manual = m.forecast_source === 'manual';

  useEffect(() => {
    if (!open) return;
    setDate(m.forecast_date);
    setReason(manual ? m.override_reason ?? '' : '');
    setTouched(false);
    setBusy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, m.id]);

  const validDate = isValidISODate(date);
  const why = reason.trim();
  const shift = validDate ? diffDays(date, m.planned_date) : 0;
  const plannedShort = formatDateShort(m.planned_date);
  const shiftText = !validDate
    ? undefined
    : shift > 0
      ? t('roadmap.override.shiftLater', { days: shift, date: plannedShort })
      : shift < 0
        ? t('roadmap.override.shiftEarlier', { days: -shift, date: plannedShort })
        : t('roadmap.override.shiftNone', { date: plannedShort });

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!validDate || !why || pending) return;
    setBusy('save');
    const r = await run(() => api.overrideForecast(m.id, date, why), {
      success: 'roadmap.override.saved',
      successParams: { name: m.name, date: formatDateShort(date) },
    });
    setBusy(null);
    if (r) onOpenChange(false);
  }

  async function clear() {
    if (pending) return;
    setBusy('clear');
    const r = await run(() => api.overrideForecast(m.id, null, why), {
      success: 'roadmap.override.cleared',
      successParams: { name: m.name },
    });
    setBusy(null);
    if (r) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('roadmap.override.title', { name: m.name })}</DialogTitle>
          <DialogDescription>{t('roadmap.override.description')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
          <p className="text-micro font-medium text-muted-foreground">{t('roadmap.override.current')}</p>
          <ForecastLabel milestone={m} showReason className="mt-1" />
        </div>

        <form onSubmit={(e) => void save(e)} className="space-y-4" noValidate>
          <DateField
            id={`${ids}-date`}
            label={t('roadmap.override.date')}
            value={date}
            onChange={setDate}
            required
            hint={shiftText}
            warning={validDate && shift > 0 ? t('roadmap.override.cascadeNote') : undefined}
            error={touched && !validDate ? t('roadmap.form.dateRequired') : null}
          />
          <FormField
            label={t('roadmap.override.reason')}
            htmlFor={`${ids}-reason`}
            required
            hint={m.client_visible ? t('roadmap.override.reasonHintClient') : t('roadmap.override.reasonHintInternal')}
            error={touched && !why ? t('roadmap.override.reasonRequired') : null}
          >
            <Textarea
              id={`${ids}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('roadmap.override.reasonPlaceholder')}
              rows={3}
              maxLength={240}
            />
          </FormField>

          {manual ? (
            <div className="flex flex-col gap-2 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption">{t('roadmap.override.clearHint')}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void clear()}
                loading={busy === 'clear'}
                disabled={pending}
                className="self-start sm:self-auto"
              >
                {busy === 'clear' ? null : <RotateCcw aria-hidden="true" />}
                {t('roadmap.override.clear')}
              </Button>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={busy === 'save'} disabled={pending || (touched && (!validDate || !why))}>
              {t('roadmap.override.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
