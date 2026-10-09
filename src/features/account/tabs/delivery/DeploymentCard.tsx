// One solution the client uses (SPEC-CARE §6.4 "Triển khai"): category tile + name, status (icon + word), the 1–2 line
// summary the client also reads, then the facts that answer "how is it going": since when, how many users, which
// departments, how much it is used (internal), contract value (director / AM), project and New Era owner.
import type { CSSProperties } from 'react';
import { Lock, Minus, Pencil, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Adoption } from '@/domain/careTypes';
import type { DeploymentView } from '@/services/careContract';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeploymentStatusChip } from '@/components/care/badges';
import { UserAvatar } from '@/components/common/user-avatar';
import { CategoryTile, Fact } from '../../care/careParts';

const ADOPTION_TONES: Record<Adoption, { icon: LucideIcon; variant: 'success' | 'default' | 'warning' }> = {
  high: { icon: TrendingUp, variant: 'success' },
  medium: { icon: Minus, variant: 'default' },
  low: { icon: TrendingDown, variant: 'warning' },
};

export interface DeploymentCardProps {
  deployment: DeploymentView;
  onEdit?: (d: DeploymentView) => void;
  className?: string;
  style?: CSSProperties;
}

export function DeploymentCard({ deployment: d, onEdit, className, style }: DeploymentCardProps) {
  const started = !!d.go_live_date && d.go_live_date <= todayISO() && d.status !== 'rolling_out';
  const adoption = d.adoption ? ADOPTION_TONES[d.adoption] : null;
  const AdoptionIcon = adoption?.icon;
  const retired = d.status === 'retired';
  return (
    <li
      className={cn('flex min-w-0 flex-col rounded-xl border border-border/70 bg-card shadow-card', retired && 'bg-subtle', className)}
      style={style}
    >
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CategoryTile category={d.category} />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-body font-semibold text-ink">{d.name}</h3>
            <p className="mt-0.5 text-caption">{d.category_label}</p>
          </div>
          {onEdit && d.can_edit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(d)}
              aria-label={t('careAccount.delivery.solutions.edit', { name: d.name })}
              title={t('common.edit')}
              className="-mr-1.5 -mt-1"
            >
              <Pencil aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <DeploymentStatusChip status={d.status} size="md" />
          {adoption && AdoptionIcon && d.adoption ? (
            <Badge variant={adoption.variant} title={t('careAccount.delivery.solutions.adoption')}>
              <AdoptionIcon aria-hidden="true" />
              {t(`care.adoption.${d.adoption}`)}
            </Badge>
          ) : null}
        </div>

        {d.summary ? <p className="mt-3 line-clamp-3 text-pretty text-table text-muted-foreground">{d.summary}</p> : null}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4">
          <Fact label={started ? t('careAccount.delivery.solutions.goLive') : t('careAccount.delivery.solutions.goLivePlanned')}>
            {/* still rolling out and the project's go-live moved: the forecast, in danger, with the slip */}
            {d.go_live_forecast ? (
              <span className="font-medium tabular text-danger" title={d.go_live_date ? formatDate(d.go_live_date) : undefined}>
                {d.go_live_date && d.go_live_forecast > d.go_live_date
                  ? t('careAccount.delivery.solutions.goLiveLate', { date: formatDate(d.go_live_forecast), days: diffDays(d.go_live_forecast, d.go_live_date) })
                  : formatDate(d.go_live_forecast)}
              </span>
            ) : d.go_live_date ? (
              <span className="tabular">{formatDate(d.go_live_date)}</span>
            ) : (
              <span className="text-muted-foreground">{t('careAccount.delivery.solutions.noGoLive')}</span>
            )}
          </Fact>
          <Fact label={t('careAccount.delivery.solutions.users')}>
            {d.active_users !== null ? (
              <span className="tabular">{formatNumber(d.active_users)}</span>
            ) : (
              <span className="text-muted-foreground">{t('careAccount.delivery.solutions.noUsers')}</span>
            )}
          </Fact>
          {/* members get no contract_value key at all (sanitize): `!= null` covers absent and null */}
          {d.contract_value != null ? (
            <Fact label={t('careAccount.delivery.solutions.value')}>
              <span className="font-medium tabular text-ink" title={formatMoney(d.contract_value)}>
                {formatMoneyCompact(d.contract_value)}
              </span>
            </Fact>
          ) : null}
          {d.owner ? (
            <Fact label={t('careAccount.delivery.solutions.owner')}>
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                <UserAvatar user={d.owner} size="xs" />
                <span className="truncate">{d.owner.full_name}</span>
              </span>
            </Fact>
          ) : null}
          <Fact label={t('careAccount.delivery.solutions.departments')} className="col-span-2">
            {d.department_labels.length > 0 ? (
              <span className="mt-0.5 flex flex-wrap gap-1">
                {d.department_labels.map((label) => (
                  <Badge key={label} variant="outline" size="sm">
                    {label}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">{t('careAccount.delivery.solutions.noDepartments')}</span>
            )}
          </Fact>
          {d.project ? (
            <Fact label={t('careAccount.delivery.solutions.project')} className="col-span-2">
              {d.project.name}
            </Fact>
          ) : null}
        </dl>
      </div>

      {d.notes ? (
        <div className="border-t border-border/60 px-4 py-3 sm:px-5">
          <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
            <span className="sr-only">{t('careAccount.delivery.solutions.notes')}: </span>
            <span className="min-w-0 break-words">{d.notes}</span>
          </p>
        </div>
      ) : null}
    </li>
  );
}
