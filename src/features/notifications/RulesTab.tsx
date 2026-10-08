// "Quy tắc" tab of /app/notifications: the notification policy as plain sentences (from settings) and the
// "Chạy kiểm tra nhắc hạn ngay" demo button (daily sweep, forced) with its result as one sentence.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BellOff,
  CalendarClock,
  Clock,
  Layers,
  MessageCircle,
  Newspaper,
  Play,
  Settings,
  Siren,
} from 'lucide-react';
import type { SweepResult, Viewer } from '@/services/contract';
import { isFullSettings } from '@/services/contract';
import { api } from '@/services/api';
import { CardSkeleton } from '@/components/common/skeletons';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { nowISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { digestTime, reminderDaysText, weekdayName } from './schedule';

interface Rule {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  extra?: ReactNode;
}

const SWEEP_PARTS = ['reminders', 'overdue', 'escalations', 'payment_tasks', 'emails_sent', 'emails_batched'] as const;

function sweepSentence(result: SweepResult, at: string): string {
  const time = formatDateTime(at).split(' ')[1] ?? '';
  const parts = SWEEP_PARTS.filter((k) => result[k] > 0).map((k) => t(`notify.sweep.parts.${k}`, { count: result[k] }));
  if (parts.length === 0) return t('notify.sweep.nothing', { time });
  return t('notify.sweep.result', { time, parts: parts.join(t('notify.sweep.join')) });
}

export interface RulesTabProps {
  viewer: Viewer;
  onShowOutbox(): void;
}

export function RulesTab({ viewer, onShowOutbox }: RulesTabProps) {
  const query = useQuery(() => api.getSettings(), [viewer.user.id]);
  const sweep = useAction();
  const [last, setLast] = useState<{ result: SweepResult; at: string } | null>(null);
  const canRun = viewer.org_type === 'internal' && !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');

  if (query.loading) {
    return (
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <CardSkeleton lines={7} className="xl:col-span-2" />
        {canRun ? <CardSkeleton lines={2} /> : null}
      </div>
    );
  }
  if (!query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  const s = query.data;
  const full = isFullSettings(s) ? s : null;
  const time = digestTime(s.weekly_digest_hour);
  const weekday = weekdayName(s.weekly_digest_weekday);

  const rules: Rule[] = [
    {
      id: 'before',
      icon: CalendarClock,
      title: t('notify.rules.before.title'),
      text: t('notify.rules.before.text', { days: reminderDaysText(s.reminder_days_before) }),
    },
  ];
  if (full) {
    rules.push(
      {
        id: 'overdue',
        icon: Clock,
        title: t('notify.rules.overdue.title'),
        text: t('notify.rules.overdue.text', { count: full.overdue_reminder_per_day }),
      },
      {
        id: 'escalation',
        icon: Siren,
        title: t('notify.rules.escalation.title'),
        text: t('notify.rules.escalation.text', { days: full.escalation_overdue_days }),
      },
      {
        id: 'email',
        icon: Layers,
        title: t('notify.rules.email.title'),
        text: t('notify.rules.email.text', { count: full.max_emails_per_day }),
      },
    );
  }
  rules.push(
    {
      id: 'digest',
      icon: Newspaper,
      title: t('notify.rules.digest.title'),
      text: t('notify.rules.digest.text', { time, weekday }),
      extra: (
        <Button asChild variant="link" size="sm" className="mt-1">
          <Link to="/app/digest">
            {t('notify.rules.previewDigest')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ),
    },
    { id: 'preference', icon: BellOff, title: t('notify.rules.preference.title'), text: t('notify.rules.preference.text') },
    { id: 'zalo', icon: MessageCircle, title: t('notify.rules.zalo.title'), text: t('notify.rules.zalo.text') },
  );

  async function runSweep() {
    // the result sentence below is the feedback (no toast on top of it)
    const result = await sweep.run(() => api.runNotificationSweep(true));
    if (result) setLast({ result, at: nowISO() });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <SectionCard
        title={t('notify.rules.title')}
        description={t('notify.rules.description')}
        className="xl:col-span-2"
        divided
        actions={
          viewer.role === 'director' && !viewer.read_only ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/settings/rules">
                <Settings aria-hidden="true" />
                {t('notify.rules.editSettings')}
              </Link>
            </Button>
          ) : null
        }
      >
        {rules.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.id} className="flex gap-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-table font-semibold text-foreground">{r.title}</h3>
                <p className="mt-0.5 text-table text-muted-foreground">{r.text}</p>
                {r.extra}
              </div>
            </div>
          );
        })}
      </SectionCard>

      {canRun ? (
        <SectionCard title={t('notify.sweep.title')} description={t('notify.sweep.description')}>
          <div className="space-y-4">
            <Button type="button" className="w-full sm:w-auto" loading={sweep.pending} onClick={() => void runSweep()}>
              {/* kept while busy: the Button swaps it for its spinner after 150 ms (DESIGN §8.2) */}
              <Play aria-hidden="true" />
              {t('notify.sweep.run')}
            </Button>
            <div role="status" aria-live="polite">
              {last ? (
                // keyed by the run: each new result fades in, so a repeated run visibly answers
                <div key={last.at} className="animate-fade-in space-y-1 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
                  <p className="text-table text-foreground">{sweepSentence(last.result, last.at)}</p>
                  <Button type="button" variant="link" size="sm" onClick={onShowOutbox}>
                    {t('notify.sweep.viewOutbox')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
