// /portal/settings: how the client receives email (SPEC §6 "chỉ nhận bản tin tuần và việc gấp"), the
// "Ghi nhớ thiết bị" state (SPEC §8) and a preview of their own weekly digest.
// Focal block: the email choice (first on phones; left column from lg, next to the live digest preview).
import { useEffect, useId, useState } from 'react';
import { Check, Lock, Mail, Minus, MonitorSmartphone } from 'lucide-react';
import type { NotificationPref } from '@/services/contract';
import { api } from '@/services/api';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { SectionCard } from '@/components/common/section-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { capitalize, t } from '@/i18n';
import { DigestSkeleton, DigestView } from './DigestView';
import { digestTime, reminderDaysText, weekdayName } from './schedule';

const PREFS: NotificationPref[] = ['all', 'digest_and_urgent'];

export function PortalSettingsPage() {
  const viewer = useViewer();
  const save = useAction();
  const groupLabelId = useId();
  const settings = useQuery(() => api.getSettings(), [viewer?.user.id], { enabled: !!viewer });
  const digest = useQuery(() => api.getWeeklyDigest(), [viewer?.user.id], { enabled: !!viewer });

  const stored = viewer?.user.notification_pref ?? 'all';
  // optimistic choice while the save is in flight; falls back to the stored value
  const [choice, setChoice] = useState<NotificationPref>(stored);
  useEffect(() => setChoice(stored), [stored]);

  if (!viewer) return null;

  const readOnly = viewer.read_only;
  const salutation = viewer.user.salutation ?? t('notify.digest.genericSalutation');
  const s = settings.data;
  const time = digestTime(s ? s.weekly_digest_hour : 8);
  const weekday = weekdayName(s ? s.weekly_digest_weekday : 1);
  const remembered = viewer.remember_device;

  async function choose(value: string) {
    const pref = PREFS.find((p) => p === value);
    if (!pref || pref === choice || readOnly) return;
    setChoice(pref);
    const result = await save.run(() => api.updateMyPreferences({ notification_pref: pref }), { success: 'notify.settings.saved' });
    if (!result) setChoice(stored);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('notify.settings.title')} description={t('notify.settings.description', { salutation })} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-6">
          <SectionCard
            title={t('notify.settings.emailTitle')}
            description={t('notify.settings.emailDescription')}
            flush
            className="overflow-hidden"
            footer={
              <div className="space-y-1.5">
                {readOnly ? (
                  <p className="flex items-start gap-2 text-caption">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t('notify.settings.readOnly')}
                  </p>
                ) : null}
                {s ? (
                  <p className="flex items-start gap-2 text-caption">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t('notify.settings.reminders', { days: reminderDaysText(s.reminder_days_before) })}
                  </p>
                ) : null}
              </div>
            }
          >
            <p id={groupLabelId} className="sr-only">
              {t('notify.settings.groupLabel')}
            </p>
            <RadioGroup
              value={choice}
              onValueChange={(v) => void choose(v)}
              disabled={readOnly}
              aria-labelledby={groupLabelId}
              className="gap-0 divide-y divide-border/60 border-t border-border/60"
            >
              {PREFS.map((pref) => {
                const id = `${groupLabelId}-${pref}`;
                const active = choice === pref;
                return (
                  <label
                    key={pref}
                    htmlFor={id}
                    className={cn(
                      'flex min-h-tap cursor-pointer items-start gap-3 px-4 py-4 transition-colors duration-150 ease-out-quart sm:px-5',
                      active ? 'bg-primary-soft/50' : 'hover:bg-subtle',
                      readOnly && 'cursor-not-allowed',
                    )}
                  >
                    <RadioGroupItem id={id} value={pref} className="mt-0.5" aria-describedby={`${id}-desc`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-foreground">{t(`notify.settings.options.${pref}.title`)}</span>
                      <span id={`${id}-desc`} className="mt-0.5 block text-table text-muted-foreground">
                        {t(`notify.settings.options.${pref}.description`, { time, weekday })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </SectionCard>

          <SectionCard
            title={t('notify.settings.deviceTitle')}
            actions={
              <Badge variant={remembered ? 'success' : 'default'}>
                {remembered ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
                {remembered ? t('notify.settings.deviceOn') : t('notify.settings.deviceOff')}
              </Badge>
            }
          >
            <p className="flex items-start gap-3 text-table text-muted-foreground">
              <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {remembered
                  ? t('notify.settings.deviceRemembered', { Salutation: capitalize(salutation) })
                  : t('notify.settings.deviceNotRemembered')}
              </span>
            </p>
          </SectionCard>
        </div>

        <section aria-labelledby="digest-preview-title" className="min-w-0 space-y-3">
          <div className="px-1">
            <h2 id="digest-preview-title" className="text-heading font-semibold tracking-tightish text-ink">
              {t('notify.settings.previewTitle', { salutation })}
            </h2>
            <p className="mt-0.5 text-caption">{t('notify.settings.previewDescription', { time, weekday })}</p>
          </div>
          {digest.loading ? (
            <DigestSkeleton />
          ) : digest.data ? (
            <DigestView digest={digest.data} />
          ) : (
            <Card>
              <ErrorState error={digest.error} onRetry={digest.refetch} />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
