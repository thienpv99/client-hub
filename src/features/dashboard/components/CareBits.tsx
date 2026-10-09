// Small display pieces of the "Chăm sóc" portfolio view (SPEC-CARE §6.2–6.3), shared by the table (≥1280) and the
// cards (<1280): what the client has deployed, departments covered and the room to grow, the request flags, the next
// care action (due date + owner) and the decision maker's relationship strength.
import { CalendarClock, CircleAlert, Clock, TriangleAlert } from 'lucide-react';
import type { CarePortfolioRow } from '@/services/careContract';
import { CareStatusBadge, ExpansionBlockedChip, StrengthBadge } from '@/components/care/badges';
import { DateText } from '@/components/common/date-text';
import { SMALL } from '@/components/common/cx';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoneyCompact } from '@/lib/format';
import { shortPersonName } from '../portfolioModel';

/** "3 giải pháp" (+ "1 đang dùng"), the names in the tooltip */
export function DeployedCount({ row, className }: { row: CarePortfolioRow; className?: string }) {
  const d = row.deployments;
  if (d.total === 0) return <span className={cn('text-muted-foreground', className)}>{t('carePortfolio.portfolio.deployedNone')}</span>;
  return (
    <span className={cn('flex min-w-0 flex-col', className)} title={d.names.join('\n')}>
      <span className="whitespace-nowrap font-medium tabular text-foreground">{t('carePortfolio.portfolio.deployedCount', { count: d.total })}</span>
      {d.live > 0 ? (
        <span className={cn('whitespace-nowrap tabular text-muted-foreground', SMALL)}>{t('carePortfolio.portfolio.deployedLive', { count: d.live })}</span>
      ) : null}
    </span>
  );
}

/** "Phòng ban 6/8", then the room to grow ("4 cơ hội · 1,87 tỷ ₫") or the expansion gate ("Tạm dừng mở rộng") */
export function CoverageLine({ row, showLabel = true }: { row: CarePortfolioRow; showLabel?: boolean }) {
  const e = row.expansion;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="whitespace-nowrap tabular text-foreground">
        {showLabel
          ? t('carePortfolio.portfolio.departments', { covered: row.departments.covered, total: row.departments.total })
          : t('carePortfolio.portfolio.departmentsShort', { covered: row.departments.covered, total: row.departments.total })}
      </span>
      {e.blocked ? (
        // the same chip on every screen (danger: delivery debt closes the gate)
        // in the ≥1280 table it may wrap ("Tạm dừng / mở rộng") so the column never pushes the table wider than its card
        <ExpansionBlockedChip
          title={t('carePortfolio.room.blockedTitle')}
          className={cn('self-start', showLabel ? undefined : 'h-auto min-h-5 max-w-full whitespace-normal rounded-md py-0.5')}
        />
      ) : e.opportunity_count > 0 ? (
        <span className={cn('tabular text-muted-foreground', SMALL)}>
          {t('carePortfolio.portfolio.opportunities', { count: e.opportunity_count, value: formatMoneyCompact(e.est_value_total) })}
        </span>
      ) : null}
    </span>
  );
}

/** delivery debt (danger) / waiting more than 7 days / taken in without a date (warning) pills, then the open count */
export function RequestSummary({ row, className }: { row: CarePortfolioRow; className?: string }) {
  const r = row.requests;
  const undated = r.undated ?? 0;
  const flagged = r.debt > 0 || r.untriaged > 0 || undated > 0;
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} title={t(`care.deliveryHealth.${r.delivery_health}`)}>
      {/* the pills may wrap inside the narrow table column (never spill into the next one) */}
      {r.debt > 0 ? (
        <Badge variant="danger" size="sm" className="h-auto min-h-5 max-w-full whitespace-normal rounded-md py-0.5">
          <TriangleAlert aria-hidden="true" />
          <span className="tabular">{t('carePortfolio.portfolio.requestsDebt', { count: r.debt })}</span>
        </Badge>
      ) : null}
      {r.untriaged > 0 ? (
        <Badge variant="warning" size="sm" className="h-auto min-h-5 max-w-full whitespace-normal rounded-md py-0.5">
          <Clock aria-hidden="true" />
          <span className="tabular">{t('carePortfolio.portfolio.requestsUntriaged', { count: r.untriaged })}</span>
        </Badge>
      ) : null}
      {undated > 0 ? (
        <Badge
          variant="warning"
          size="sm"
          className="h-auto min-h-5 max-w-full whitespace-normal rounded-md py-0.5"
          title={t('carePortfolio.portfolio.requestsUndatedTitle', { count: undated })}
        >
          <CalendarClock aria-hidden="true" />
          <span className="tabular">{t('carePortfolio.portfolio.requestsUndated', { count: undated })}</span>
        </Badge>
      ) : null}
      {r.open > 0 ? (
        <span className={cn('whitespace-nowrap tabular', flagged ? 'text-[13px] leading-[18px] text-muted-foreground' : 'text-foreground')}>
          {t('carePortfolio.portfolio.requestsOpen', { count: r.open })}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('carePortfolio.portfolio.requestsNone')}</span>
      )}
    </span>
  );
}

/**
 * care status + the next care action with its date and owner ("Quá hạn 06/10 · Đức Anh"). `dense` (the ≥1280 table):
 * the owner sits beside the status badge, so the narrow column never wraps the date line onto a lone "· Đức Anh"
 * (review QV-10)
 */
export function CareNext({ row, dense = false }: { row: CarePortfolioRow; dense?: boolean }) {
  const c = row.care;
  const owner = c.next_action_owner ?? null;
  const ownerBeside = dense && !!c.next_action && !!owner;
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {ownerBeside && owner ? (
        <span className="flex max-w-full min-w-0 items-center gap-2">
          <CareStatusBadge status={c.status} size="sm" />
          <span className={cn('min-w-0 truncate text-muted-foreground', SMALL)} title={t('carePortfolio.portfolio.am', { name: owner.full_name })}>
            <span className="sr-only">{t('carePortfolio.portfolio.careOwnerSr')} </span>
            {shortPersonName(owner.full_name)}
          </span>
        </span>
      ) : (
        <CareStatusBadge status={c.status} size="sm" />
      )}
      {c.next_action ? (
        <>
          <span className={cn(dense ? 'line-clamp-2' : 'line-clamp-3', 'break-words text-foreground')} title={c.next_action}>
            {c.next_action}
          </span>
          {c.next_action_due || (owner && !ownerBeside) ? (
            <span className={cn('flex flex-wrap items-center gap-x-1.5 text-muted-foreground', SMALL)}>
              {c.next_action_due ? (
                c.next_action_overdue ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-danger" title={formatDate(c.next_action_due)}>
                    <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t('carePortfolio.portfolio.careOverdue', { date: formatDateShort(c.next_action_due) })}
                  </span>
                ) : (
                  <span className="whitespace-nowrap tabular" title={formatDate(c.next_action_due)}>
                    {t('carePortfolio.portfolio.careDue', { date: formatDateShort(c.next_action_due) })}
                  </span>
                )
              ) : null}
              {owner && !ownerBeside ? (
                <span className="whitespace-nowrap" title={owner.full_name}>
                  {c.next_action_due ? (
                    <span aria-hidden="true" className="mr-1.5">
                      ·
                    </span>
                  ) : null}
                  {shortPersonName(owner.full_name)}
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      ) : (
        <span className={cn('text-muted-foreground', SMALL)}>{t('carePortfolio.portfolio.careNoAction')}</span>
      )}
    </span>
  );
}

/** when the client was last cared for ("Chăm sóc gần nhất 3 ngày trước") */
export function LastTouch({ row }: { row: CarePortfolioRow }) {
  const at = row.care.last_touch_at;
  if (!at) return <span>{t('carePortfolio.portfolio.neverTouched')}</span>;
  return (
    <span className="whitespace-nowrap">
      {t('carePortfolio.portfolio.lastTouchPrefix')} <DateText value={at} relative />
    </span>
  );
}

/** decision maker: name, relationship strength, who at New Era holds the relationship */
export function DecisionMakerInfo({ row, inline = false }: { row: CarePortfolioRow; inline?: boolean }) {
  const dm = row.decision_maker;
  if (!dm) return <span className="text-muted-foreground">{t('carePortfolio.portfolio.dmNone')}</span>;
  const label = t('carePortfolio.portfolio.dmLabel', { name: dm.full_name, title: dm.title, strength: dm.strength_label });
  return (
    <span className={cn('flex min-w-0', inline ? 'flex-wrap items-center gap-x-2 gap-y-1' : 'flex-col items-start gap-1')} title={label}>
      <span className={cn('min-w-0 font-medium text-foreground', inline ? 'break-words' : 'max-w-full truncate')}>{dm.full_name}</span>
      <StrengthBadge strength={dm.strength} size="sm" />
      {dm.ne_owner ? (
        <span className={cn('max-w-full truncate whitespace-nowrap text-muted-foreground', SMALL, inline ? 'basis-full' : '')}>
          {t('carePortfolio.portfolio.dmOwner', { name: shortPersonName(dm.ne_owner.full_name) })}
        </span>
      ) : null}
    </span>
  );
}
