// ≥1280: the project portfolio as a table (DESIGN §4 table recipe). Seven columns so it fits the 950px content of a
// 1280 screen with the sidebar open: the AM sits in the entity subline ("Cỏ Xanh · AM Thu Hà"; the team avatars live
// on the cards below 1280 and in "Tải việc"). The project name is a real link (keyboard); the whole row is clickable
// for mouse users and opens the account roadmap on that project. Row action ("Việc của dự án") shows on hover /
// focus with the mouse and always on touch screens.
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import type { RiseProps } from '@/hooks/useMotion';
import { AccountLogo } from '@/components/common/account-logo';
import { HealthBadge } from '@/components/common/health-badge';
import { SMALL } from '@/components/common/cx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { t } from '@/i18n';
import { EndDates, NextMilestone, ProgressInfo, SlipLabel, WaitingCompact } from './ProjectBits';
import { accountTasksHref, roadmapHref, shortPersonName } from './projectsModel';

/** clicks on links/buttons inside the row, or a text selection, do not navigate the row */
export function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a,button,[role="button"],input,select,textarea')) return true;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return Boolean(selection && selection.toString().length > 0);
}

/** row actions: hidden until hover / keyboard focus with a mouse, always visible on touch screens */
export const ROW_ACTION_REVEAL =
  'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100';

export function PortfolioTable({ rows, rise }: { rows: ProjectPortfolioRow[]; rise?: (index: number) => RiseProps }) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption className="sr-only">{t('projects.portfolio.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('projects.portfolio.columns.project')}</TableHead>
            <TableHead>{t('projects.portfolio.columns.health')}</TableHead>
            <TableHead>{t('projects.portfolio.columns.progress')}</TableHead>
            <TableHead>{t('projects.portfolio.columns.next')}</TableHead>
            <TableHead>{t('projects.portfolio.columns.waiting')}</TableHead>
            <TableHead numeric>{t('projects.portfolio.columns.end')}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t('projects.portfolio.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p, i) => (
            <TableRow
              key={p.id}
              className={cn('group cursor-pointer', rise?.(i).className)}
              style={rise?.(i).style}
              onClick={(e) => {
                if (!shouldIgnoreRowClick(e)) navigate(roadmapHref(p));
              }}
            >
              <TableCell className="py-3">
                {/* max width: long names wrap (2 lines) instead of taking the slack the status columns need */}
                <div className="flex min-w-[12rem] max-w-[16.5rem] items-center gap-3">
                  <AccountLogo account={p.account} size="sm" />
                  <div className="min-w-0">
                    <Link
                      to={roadmapHref(p)}
                      title={`${p.name} · ${p.code}`}
                      className="line-clamp-2 break-words font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-caption" title={p.am.full_name}>
                      {t('projects.portfolio.subline', {
                        account: p.account.short_name || p.account.name,
                        am: shortPersonName(p.am.full_name),
                      })}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3">
                {/* schedule status: health, then the slip ("+6 ngày") only when milestones actually moved — a
                    yellow health (overdue work) next to "on plan" would read as a contradiction */}
                <div className="flex flex-col items-start gap-1">
                  <HealthBadge health={p.health} size="sm" variant="dot" />
                  {p.status !== 'done' && p.slip_days > 0 ? <SlipLabel project={p} className={cn('pl-0.5', SMALL)} /> : null}
                </div>
              </TableCell>
              <TableCell className="py-3">
                <ProgressInfo project={p} className="w-20" />
              </TableCell>
              <TableCell className="py-3">
                <div className="min-w-[10rem] max-w-[15rem]">
                  <NextMilestone project={p} />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <WaitingCompact counts={p.counts} />
              </TableCell>
              <TableCell className="py-3 text-right">
                <EndDates project={p} compact className="items-end" />
              </TableCell>
              <TableCell className="py-3 pl-0">
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className={ROW_ACTION_REVEAL}
                  title={t('projects.portfolio.tasksLinkLabel', { name: p.name })}
                >
                  <Link to={accountTasksHref(p.account.id)} aria-label={t('projects.portfolio.tasksLinkLabel', { name: p.name })}>
                    <ListChecks aria-hidden="true" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
