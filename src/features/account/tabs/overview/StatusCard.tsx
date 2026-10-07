// "Tình hình" — the focal block of the account overview: health (icon in a soft circle + word), why (one sentence
// per reason, most severe first), the AM's override reason, and who is waiting on whom.
import type { AccountDetail } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Card, CardFooter } from '@/components/ui/card';
import { HEALTH_TONES, healthLabel } from '@/components/common/health-badge';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { WaitingCountsLine } from '@/components/common/waiting-counts-line';
import { HealthReasons } from '../../HealthReasons';
import { TabLink } from './TabLink';

export function StatusCard({ account, className }: { account: AccountDetail; className?: string }) {
  const health = account.health;
  const tone = HEALTH_TONES[health.value];
  const Icon = tone.icon;
  const reason = health.overridden ? (health.override_reason ?? '').trim() : '';

  return (
    <Card className={cn('min-w-0', className)}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', tone.soft, tone.ring)}
            aria-hidden="true"
          >
            <Icon className={cn('h-5 w-5', tone.text)} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-heading font-semibold tracking-tightish text-ink">
              <span className="sr-only">{t('account.overview.status.title')}: </span>
              {healthLabel(health.value)}
            </h2>
            <p className="text-caption">
              {health.overridden
                ? t('account.overview.status.manualLine', { health: healthLabel(health.auto) })
                : t('account.overview.status.autoLine')}
            </p>
          </div>
        </div>
        {/* phones: the reasons use the full card width; from sm they line up under the title (icon 40 + gap 16) */}
        <div className="mt-3 sm:pl-14">
          <HealthReasons reasons={health.reasons} max={3} />
          {reason ? (
            <InternalNoteBox title={t('account.overview.status.manualReason')} className="mt-3">
              {reason}
            </InternalNoteBox>
          ) : null}
        </div>
      </div>
      {/* the chips flow as footer items (`contents`), so on phones the link shares the second chip's line */}
      <CardFooter className="gap-y-2">
        <WaitingCountsLine counts={account.counts} showOverdue className="contents" />
        <TabLink accountId={account.id} tab="roadmap" className="ml-auto">
          {t('account.overview.status.roadmap')}
        </TabLink>
      </CardFooter>
    </Card>
  );
}
