// "Còn có thể bán thêm" (SPEC-CARE §6.2): the room to grow inside signed clients — the estimated value of the
// opportunities noted per department, largest first, with the departments covered and the expansion gate ("Tạm dừng
// mở rộng" while requests are owed). Each row opens the account's Mở rộng tab; the header and the group chips open the
// group matrix (/app/map?view=matrix), where every unit of a business group shows what it uses and what is still open.
import { Link } from 'react-router-dom';
import { ArrowRight, Network, Sprout } from 'lucide-react';
import type { CarePortfolioRow } from '@/services/careContract';
import { ExpansionBlockedChip } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { useArrivalMotion } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { accountHref, matrixHref, type RoomToGrow } from '../careModel';

const TOP = 6;

/**
 * ranks read left to right (1 2 3 / 4 5 6 on the full-width xl band): one column on phones and iPad portrait, two from
 * lg, three from xl. Every row reserves the badge line, so the row rhythm holds whether a client is blocked or not.
 */
const GRID = 'grid gap-x-8 gap-y-0.5 px-2 pb-3 sm:px-3 lg:grid-cols-2 xl:grid-cols-3';

function Row({ row, rank, max }: { row: CarePortfolioRow; rank: number; max: number }) {
  const arrival = useArrivalMotion();
  const e = row.expansion;
  const value = formatMoneyCompact(e.est_value_total);
  const pct = max > 0 ? Math.max(3, Math.round((e.est_value_total / max) * 100)) : 0;
  const label =
    t('carePortfolio.room.rowLabel', {
      rank,
      name: row.account.name,
      value,
      count: e.opportunity_count,
      covered: row.departments.covered,
      total: row.departments.total,
    }) + (e.blocked ? t('carePortfolio.room.rowBlocked') : '');
  return (
    <li className="min-w-0">
      <Link
        to={accountHref(row.account.id, 'expansion')}
        aria-label={label}
        className="flex min-h-tap items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out-quart hover:bg-subtle"
      >
        <span className="w-4 shrink-0 text-right text-micro font-medium tabular text-muted-foreground" aria-hidden="true">
          {rank}
        </span>
        <AccountLogo account={row.account} size="sm" />
        <span className="min-w-0 flex-1" aria-hidden="true">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-table font-medium text-foreground" title={row.account.name}>
              {row.account.name}
            </span>
            <span className="shrink-0 text-table font-semibold tabular text-ink">{value}</span>
          </span>
          <span className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {/* grows in from the left on page arrival only (transform, DESIGN §8.5) */}
            <span
              className={`h-full w-full rounded-full bg-chart-1 transition-transform duration-500 ease-out-quart ${arrival ? 'animate-progress-grow' : ''}`}
              style={{ transform: `translateX(-${100 - pct}%)` }}
            />
          </span>
          <span className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-micro tabular text-muted-foreground">
              {t('carePortfolio.room.meta', { count: e.opportunity_count, covered: row.departments.covered, total: row.departments.total })}
            </span>
            {e.blocked ? <ExpansionBlockedChip title={t('carePortfolio.room.blockedTitle')} /> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function RoomToGrowCard({ room, className }: { room: RoomToGrow; className?: string }) {
  const top = room.rows.slice(0, TOP);
  const max = top[0]?.expansion.est_value_total ?? 0;
  return (
    <SectionCard
      className={className}
      flush
      title={t('carePortfolio.room.title')}
      description={
        top.length > 0
          ? t('carePortfolio.room.description', { value: formatMoneyCompact(room.total), count: room.rows.length })
          : t('carePortfolio.room.descriptionEmpty')
      }
      actions={
        <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary">
          <Link to={matrixHref()} aria-label={t('carePortfolio.room.openLabel')}>
            {t('carePortfolio.room.open')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {top.length === 0 ? (
        <EmptyState compact icon={Sprout} title={t('carePortfolio.room.empty')} description={t('carePortfolio.room.emptyDescription')} />
      ) : (
        <>
          <ol className={GRID} aria-label={t('carePortfolio.room.listLabel')}>
            {top.map((r, i) => (
              <Row key={r.account.id} row={r} rank={i + 1} max={max} />
            ))}
          </ol>
          {room.groups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 px-4 py-3 sm:px-5">
              <span className="text-micro font-medium text-muted-foreground">{t('carePortfolio.room.groups')}</span>
              <ul className="flex flex-wrap gap-2">
                {room.groups.map((g) => {
                  const value = formatMoneyCompact(g.value);
                  return (
                    <li key={g.ecosystem.id}>
                      <Link
                        to={matrixHref(g.ecosystem.id)}
                        aria-label={t('carePortfolio.room.groupLabel', { name: g.ecosystem.name, count: g.units, value })}
                        className="touch-tap inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-3 text-micro font-medium text-foreground shadow-xs ring-1 ring-inset ring-border-strong/80 transition-colors duration-150 ease-out-quart hover:bg-subtle"
                      >
                        <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span>{g.ecosystem.short_name || g.ecosystem.name}</span>
                        <span className="tabular text-muted-foreground">{value}</span>
                        <span aria-hidden="true" className="text-muted-foreground">
                          ·
                        </span>
                        <span className="text-muted-foreground">{t('carePortfolio.room.groupUnits', { count: g.units })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
