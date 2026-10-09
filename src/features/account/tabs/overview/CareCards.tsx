// Care cards of the account overview (SPEC-CARE §6.4): "Đã triển khai" (what the client already uses), "Sức khỏe triển
// khai" (request roll-up + the gate sentence), "Mở rộng" (coverage, room to sell, gate state). Each card answers its
// question with one big figure first, then the few items behind it, and links to the tab with the detail.
import { CircleCheck, Clock, Inbox, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DeploymentStatus } from '@/domain/careTypes';
import type { CrRollup, DeliveryHealth, DeploymentView, ExpansionInfo } from '@/services/careContract';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDateShort, formatMoney, formatMoneyCompact, formatNumber } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DeploymentStatusChip, ExpansionBlockedChip } from '@/components/care/badges';
import { ExpansionGateBanner } from '@/components/care/ExpansionGateBanner';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { todayISO } from '@/domain/clock';
import { CategoryTile } from '../../care/careParts';
import { TabLink } from './TabLink';

const STATUS_ORDER: Record<DeploymentStatus, number> = { live: 0, rolling_out: 1, pilot: 2, paused: 3, retired: 4 };

export function sortDeployments(list: readonly DeploymentView[]): DeploymentView[] {
  return [...list].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'vi'));
}

/** "Dùng từ 01/07" · "Dự kiến 12/11" · "140 người dùng" — the one fact that matters most for a deployment line */
function deploymentFact(d: DeploymentView): string | null {
  const parts: string[] = [];
  if (d.go_live_forecast) {
    // still rolling out and its project's go-live moved: the forecast, with the slip
    parts.push(
      d.go_live_date && d.go_live_forecast > d.go_live_date
        ? t('careAccount.overview.deployed.goLiveLate', { date: formatDateShort(d.go_live_forecast), days: diffDays(d.go_live_forecast, d.go_live_date) })
        : t('careAccount.overview.deployed.goLivePlanned', { date: formatDateShort(d.go_live_forecast) }),
    );
  } else if (d.go_live_date) {
    parts.push(
      d.go_live_date <= todayISO() && d.status !== 'rolling_out'
        ? t('careAccount.overview.deployed.goLive', { date: formatDateShort(d.go_live_date) })
        : t('careAccount.overview.deployed.goLivePlanned', { date: formatDateShort(d.go_live_date) }),
    );
  }
  if (d.active_users) parts.push(t('careAccount.overview.deployed.users', { count: formatNumber(d.active_users) }));
  return parts.length > 0 ? parts.join(t('common.separator')) : null;
}

const MAX_DEPLOYED = 4;

export function DeployedCard({ accountId, deployments, className }: { accountId: string; deployments: DeploymentView[]; className?: string }) {
  const active = sortDeployments(deployments.filter((d) => d.status !== 'retired'));
  const live = active.filter((d) => d.status === 'live').length;
  const other = active.length - live;
  const shown = active.slice(0, MAX_DEPLOYED);
  const more = active.length - shown.length;
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('careAccount.overview.deployed.title')}
      actions={
        <TabLink accountId={accountId} tab="delivery">
          {t('careAccount.overview.deployed.open')}
        </TabLink>
      }
      flush
      footer={
        more > 0 ? (
          <TabLink accountId={accountId} tab="delivery">
            {t('careAccount.overview.deployed.more', { count: more })}
          </TabLink>
        ) : undefined
      }
    >
      {active.length === 0 ? (
        <EmptyState compact title={t('careAccount.overview.deployed.empty')} description={t('careAccount.overview.deployed.emptyHint')} />
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 pb-3 sm:px-5">
            <span className="text-title font-semibold tracking-tightish tabular text-ink">
              {t('careAccount.overview.deployed.count', { count: active.length })}
            </span>
            <span className="text-caption">
              {other === 0
                ? t('careAccount.overview.deployed.splitLive', { live })
                : live === 0
                  ? t('careAccount.overview.deployed.splitProgress', { progress: other })
                  : t('careAccount.overview.deployed.split', { live, progress: other })}
            </span>
          </p>
          {/* two columns from sm: the hairlines draw a grid (odd items carry the column rule) */}
          <ul className="-mb-px grid border-t border-border/60 sm:grid-cols-2">
            {shown.map((d) => {
              const fact = deploymentFact(d);
              const meta = [t(`care.categoryShort.${d.category}`), fact].filter(Boolean).join(t('common.separator'));
              return (
                <li key={d.id} className="flex min-w-0 items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5 sm:odd:border-r">
                  <CategoryTile category={d.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-table font-medium text-ink" title={d.name}>
                      {d.name}
                    </p>
                    {/* the go-live date and users are the point of the line: two lines rather than an ellipsis */}
                    <p className="line-clamp-2 text-pretty text-micro text-muted-foreground" title={meta}>
                      {meta}
                    </p>
                  </div>
                  <DeploymentStatusChip status={d.status} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

const HEALTH_TONES: Record<DeliveryHealth, { icon: LucideIcon; text: string; soft: string; ring: string }> = {
  ok: { icon: CircleCheck, text: 'text-success', soft: 'bg-success-soft', ring: 'ring-success/15' },
  attention: { icon: Clock, text: 'text-warning', soft: 'bg-warning-soft', ring: 'ring-warning/20' },
  debt: { icon: TriangleAlert, text: 'text-danger', soft: 'bg-danger-soft', ring: 'ring-danger/15' },
};
const EMPTY_TONE = { icon: Inbox, text: 'text-muted-foreground', soft: 'bg-muted', ring: 'ring-border/70' };

function Count({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'warning' | 'danger' }) {
  const flagged = value > 0 && tone !== 'neutral';
  // the grid stretches the three cells to one height: the figures line up at the bottom even when a label wraps
  return (
    <div className="flex min-w-0 flex-col justify-between">
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 flex items-center gap-1 text-title font-semibold tracking-tightish tabular',
          flagged ? (tone === 'danger' ? 'text-danger' : 'text-warning') : 'text-ink',
        )}
      >
        {flagged ? (
          tone === 'danger' ? (
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          )
        ) : null}
        {value}
      </dd>
    </div>
  );
}

export function DeliveryHealthCard({
  accountId,
  requests,
  canOverride,
  className,
}: {
  accountId: string;
  requests: CrRollup;
  canOverride: boolean;
  className?: string;
}) {
  const health = requests.delivery_health;
  const empty = requests.open === 0 && requests.done_30d === 0;
  // nothing asked yet is not "Triển khai ổn định": a neutral state, no green check
  const tone = empty ? EMPTY_TONE : HEALTH_TONES[health];
  const Icon = tone.icon;
  return (
    <SectionCard
      className={className}
      title={t('careAccount.overview.delivery.title')}
      actions={
        <TabLink accountId={accountId} tab="delivery">
          {t('careAccount.overview.delivery.open')}
        </TabLink>
      }
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', tone.soft, tone.ring)} aria-hidden="true">
          <Icon className={cn('h-[18px] w-[18px]', tone.text)} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-table font-semibold text-ink">{empty ? t('careAccount.overview.delivery.emptyTitle') : t(`care.deliveryHealth.${health}`)}</p>
          <p className="text-pretty text-caption">
            {empty
              ? t('careAccount.overview.delivery.none')
              : health === 'attention'
                ? [
                    requests.untriaged > 0 ? t('careAccount.overview.delivery.attentionLine', { count: requests.untriaged }) : '',
                    requests.undated > 0 ? t('careAccount.overview.delivery.undatedLine', { count: requests.undated }) : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                : health === 'ok'
                  ? t('careAccount.overview.delivery.okLine')
                  : t('careAccount.overview.delivery.debtLine')}
          </p>
        </div>
      </div>
      {empty ? null : (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
          <Count label={t('careAccount.overview.delivery.openCount')} value={requests.open} tone="neutral" />
          <Count label={t('careAccount.overview.delivery.untriaged')} value={requests.untriaged} tone="warning" />
          <Count label={t('careAccount.overview.delivery.debt')} value={requests.debt} tone="danger" />
        </dl>
      )}
      {requests.debt > 0 ? (
        <ExpansionGateBanner debtCount={requests.debt} canOverride={canOverride} compact className="mt-4 border-t border-border/60 pt-4" />
      ) : !empty && health !== 'debt' ? (
        <p className="mt-3 text-caption">{t('careAccount.overview.delivery.done30', { count: requests.done_30d })}</p>
      ) : null}
    </SectionCard>
  );
}

const MAX_MISSING = 2;

export function ExpansionCard({ accountId, expansion, className }: { accountId: string; expansion: ExpansionInfo; className?: string }) {
  const pct = expansion.total > 0 ? Math.round((expansion.covered / expansion.total) * 100) : 0;
  const missing = expansion.whitespace_categories;
  const missingList = missing
    .slice(0, MAX_MISSING)
    .map((c) => c.label)
    .join(', ');
  return (
    <SectionCard
      className={className}
      title={t('careAccount.overview.expansion.title')}
      actions={
        <TabLink accountId={accountId} tab="expansion">
          {t('careAccount.overview.expansion.open')}
        </TabLink>
      }
    >
      {expansion.total === 0 ? (
        <EmptyState compact title={t('careAccount.overview.expansion.noMap')} description={t('careAccount.overview.expansion.noMapHint')} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <dt className="text-micro text-muted-foreground">{t('careAccount.overview.expansion.coverage')}</dt>
              <dd className="mt-0.5 text-title font-semibold tracking-tightish tabular text-ink">
                {expansion.covered}/{expansion.total}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-micro text-muted-foreground">{t('careAccount.overview.expansion.room')}</dt>
              <dd className="mt-0.5 truncate text-title font-semibold tracking-tightish tabular text-ink" title={formatMoney(expansion.est_value_total)}>
                {expansion.est_value_total > 0 ? formatMoneyCompact(expansion.est_value_total) : '—'}
              </dd>
            </div>
          </dl>
          <div className="mt-3 grid grid-cols-2 items-center gap-4">
            <Progress value={pct} aria-label={t('careAccount.overview.expansion.coverageAria', { covered: expansion.covered, total: expansion.total })} />
            <p className="truncate text-caption">
              {expansion.opportunity_count > 0
                ? t('careAccount.overview.expansion.opportunities', { count: expansion.opportunity_count })
                : t('careAccount.overview.expansion.noOpportunity')}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-4">
            {expansion.blocked ? (
              <ExpansionBlockedChip size="md" />
            ) : (
              <Badge variant="success">
                <CircleCheck aria-hidden="true" />
                {t('careAccount.overview.expansion.canExpand')}
              </Badge>
            )}
            {missing.length > 0 ? (
              <span className="min-w-0 text-pretty text-caption">
                {t('careAccount.overview.expansion.missing', {
                  list:
                    missing.length > MAX_MISSING
                      ? t('careAccount.overview.expansion.missingMore', { list: missingList, count: missing.length - MAX_MISSING })
                      : missingList,
                })}
              </span>
            ) : null}
          </div>
        </>
      )}
    </SectionCard>
  );
}
