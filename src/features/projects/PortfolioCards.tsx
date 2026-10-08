// <1280 (phones and iPad portrait/landscape): the portfolio as cards, same information prioritised:
// project + health → progress → next milestone · end → who we are waiting on, then people + "Việc" in the footer.
// The title link stretches over the card (whole card opens the roadmap); "Việc" sits above it.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import type { RiseProps } from '@/hooks/useMotion';
import { AccountLogo } from '@/components/common/account-logo';
import { HealthBadge } from '@/components/common/health-badge';
import { MICRO_MUTED, SMALL } from '@/components/common/cx';
import { WaitingCountsLine } from '@/components/common/waiting-counts-line';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { AmName, EndDates, NextMilestone, ProgressInfo, SlipLabel, TeamStack } from './ProjectBits';
import { accountTasksHref, roadmapHref } from './projectsModel';

/** DESIGN §8.3 clickable card (custom element): the shared hover lift (= Card interactive) + border, focus ring on the stretched link */
export const CARD_INTERACTIVE = 'hover-lift relative rounded-xl border border-border/70 bg-card shadow-card hover:border-border';

/** stretched link: the whole card is the target, the focus ring follows the card's corners */
export const STRETCHED_LINK =
  "after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary focus-visible:after:ring-offset-2";

function PortfolioCard({ project: p, rise }: { project: ProjectPortfolioRow; rise?: RiseProps }) {
  return (
    <li className={cn(CARD_INTERACTIVE, 'flex min-w-0 flex-col text-table', rise?.className)} style={rise?.style}>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {/* entity line on top (the name gets the whole width), then the status row: health · slip */}
        <div className="flex items-start gap-3">
          <AccountLogo account={p.account} size="md" />
          <div className="min-w-0 flex-1">
            <Link to={roadmapHref(p)} className={cn('line-clamp-2 break-words text-body font-semibold text-ink', STRETCHED_LINK)}>
              {p.name}
            </Link>
            <p className="truncate text-caption">
              {p.account.short_name || p.account.name}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              <span className="whitespace-nowrap">{p.code}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <HealthBadge health={p.health} size="sm" />
              {p.status !== 'done' && p.slip_days > 0 ? <SlipLabel project={p} className={SMALL} /> : null}
            </div>
          </div>
        </div>

        <ProgressInfo project={p} detail />

        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
          <div className="min-w-0">
            <dt className={MICRO_MUTED}>{t('projects.next.label')}</dt>
            <dd className="mt-1">
              <NextMilestone project={p} />
            </dd>
          </div>
          <div className="text-right">
            <dt className={MICRO_MUTED}>{t('projects.portfolio.columns.end')}</dt>
            <dd className="mt-1">
              <EndDates project={p} className="items-end" />
            </dd>
          </div>
        </dl>

        <WaitingCountsLine counts={p.counts} showOverdue compact className="mt-auto" />
      </div>

      <div className="flex items-center justify-between gap-x-4 border-t border-border/60 py-1.5 pl-4 pr-2 sm:pl-5 sm:pr-3">
        <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
          <AmName user={p.am} />
          <TeamStack team={p.team} max={3} />
        </div>
        <Button asChild variant="ghost" size="sm" className="relative z-10 shrink-0">
          <Link to={accountTasksHref(p.account.id)} aria-label={t('projects.portfolio.tasksLinkLabel', { name: p.name })}>
            {t('projects.portfolio.tasksLink')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function PortfolioCards({ rows, rise }: { rows: ProjectPortfolioRow[]; rise?: (index: number) => RiseProps }) {
  return (
    <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {rows.map((p, i) => (
        <PortfolioCard key={p.id} project={p} rise={rise?.(i)} />
      ))}
    </ul>
  );
}
