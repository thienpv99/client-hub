// Cần theo dõi: open leads and deals with a follow-up date, grouped by the service buckets (overdue / today /
// next 7 days / later) as hairline-divided lists; each row links to its lead / deal and has a quick
// "Ghi nhận tương tác" (prefilled). Empty groups are left out; a calm line says when nothing is late or due today.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronDown, CircleAlert, CircleCheck, Crosshair, Handshake, MessageSquarePlus } from 'lucide-react';
import type { InteractionInput, FollowUpItem } from '@/services/crmContract';
import { api } from '@/services/api';
import { followUpBucket } from '@/domain/crm';
import type { FollowUpBucket } from '@/domain/crm';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/skeletons';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { crmPaths } from '@/components/crm/crmLabels';
import { LogInteractionDialog } from '@/components/crm/LogInteractionDialog';
import { daysFrom, ownerParams } from '../crmModel';

type Group = FollowUpBucket;
const GROUPS: readonly Group[] = ['overdue', 'today', 'week', 'later'];
/** rows shown before "Xem thêm" in the 7-days / later groups */
const FOLD_AT = 5;

/** the service's buckets (getCrmDashboard.follow_ups, listFollowUps range): 'week' = the next 7 days */
function groupOf(item: FollowUpItem, today: string): Group {
  return item.overdue ? 'overdue' : followUpBucket(item.date, today);
}

function hrefOf(item: FollowUpItem): string {
  return item.kind === 'lead' ? crmPaths.lead(item.id) : crmPaths.opportunity(item.id);
}

function FollowUpRow({ item, today, onLog }: { item: FollowUpItem; today: string; onLog: () => void }) {
  const Icon = item.kind === 'lead' ? Crosshair : Handshake;
  const days = daysFrom(today, item.date);
  const overdue = days < 0;
  return (
    // the title link stretches over the row (a ≥ 44px target on touch screens); the log button sits above it
    // (icon only on phones, so a row stays three lines tall)
    <div className="group relative flex items-start gap-3 transition-colors hover:bg-subtle focus-within:bg-subtle sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            overdue ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground',
          )}
          title={t(`crm.followups.kind.${item.kind}`)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t(`crm.followups.kind.${item.kind}`)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={hrefOf(item)}
            className="block text-table font-semibold text-ink underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
          >
            {item.title}
          </Link>
          {item.subtitle ? <p className="line-clamp-2 text-caption">{item.subtitle}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro">
            {overdue ? (
              <span className="inline-flex items-center gap-1 font-medium tabular text-danger">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('crm.followups.overdueOn', { date: formatDate(item.date), days: -days })}
              </span>
            ) : (
              <span className="tabular text-muted-foreground">
                {t('crm.followups.dueOn', { date: formatDate(item.date), relative: formatRelativeDays(days) })}
              </span>
            )}
            {item.owner ? (
              // phones: the avatar alone (the name is in its tooltip and for screen readers)
              <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={item.owner.full_name}>
                <UserAvatar user={item.owner} size="xs" />
                <span className="sr-only sm:not-sr-only">{item.owner.full_name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{t('crm.followups.unassigned')}</span>
            )}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="relative z-10 w-11 shrink-0 px-0 sm:w-auto sm:px-3"
        onClick={onLog}
        aria-label={t('crm.followups.logFor', { name: item.title })}
        title={t('crm.followups.log')}
      >
        <MessageSquarePlus aria-hidden="true" />
        <span className="hidden sm:inline">{t('crm.followups.log')}</span>
      </Button>
    </div>
  );
}

function CountPill({ count, danger }: { count: number; danger: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-medium tabular',
        danger ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground',
      )}
    >
      {count}
    </span>
  );
}

export function FollowUpsTab({ owner, today }: { owner: string; today: string }) {
  const q = useQuery(() => api.listFollowUps({ ...ownerParams(owner), range: 'all' }), [owner], { keepPreviousData: true });
  // defaults are kept while the dialog animates out
  const [log, setLog] = useState<{ open: boolean; defaults: Partial<InteractionInput> }>({ open: false, defaults: {} });
  const [expanded, setExpanded] = useState<Partial<Record<Group, boolean>>>({});
  const groups = useMemo(() => {
    const map: Record<Group, FollowUpItem[]> = { overdue: [], today: [], week: [], later: [] };
    for (const item of q.data ?? []) map[groupOf(item, today)].push(item);
    for (const g of GROUPS) map[g].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'vi'));
    return map;
  }, [q.data, today]);

  if (q.loading) return <ListSkeleton rows={5} />;
  if (q.error && !q.data) {
    return (
      <Card>
        <ErrorState error={q.error} onRetry={q.refetch} />
      </Card>
    );
  }
  const total = (q.data ?? []).length;
  const calm = groups.overdue.length === 0 && groups.today.length === 0;

  return (
    <div className="space-y-6">
      {total === 0 ? (
        <Card>
          <EmptyState icon={CalendarCheck} title={t('crm.followups.empty')} description={t('crm.followups.emptyHint')} />
        </Card>
      ) : (
        <>
          {calm ? (
            <p className="flex items-center gap-2 text-table text-muted-foreground">
              <CircleCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t('crm.followups.allClear')}
            </p>
          ) : null}
          {GROUPS.filter((g) => groups[g].length > 0).map((g) => {
            // overdue and today are always listed in full; the calmer groups start folded
            const all = groups[g];
            const foldable = (g === 'week' || g === 'later') && all.length > FOLD_AT;
            const shown = foldable && !expanded[g] ? all.slice(0, FOLD_AT) : all;
            return (
            <SectionCard
              key={g}
              divided
              title={
                <span className="inline-flex items-center gap-2">
                  {g === 'overdue' ? <CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" /> : null}
                  {t(`crm.followups.group.${g}`)}
                  <CountPill count={all.length} danger={g === 'overdue'} />
                </span>
              }
              footer={
                foldable ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    aria-expanded={Boolean(expanded[g])}
                    onClick={() => setExpanded((e) => ({ ...e, [g]: !e[g] }))}
                  >
                    {expanded[g] ? t('crm.followups.showLess') : t('crm.followups.showMore', { count: all.length - FOLD_AT })}
                    <ChevronDown className={cn('transition-transform duration-150', expanded[g] && 'rotate-180')} aria-hidden="true" />
                  </Button>
                ) : undefined
              }
            >
              {shown.map((item) => (
                <FollowUpRow
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  today={today}
                  onLog={() => setLog({ open: true, defaults: item.kind === 'lead' ? { lead_id: item.id } : { opportunity_id: item.id } })}
                />
              ))}
            </SectionCard>
            );
          })}
        </>
      )}
      <LogInteractionDialog open={log.open} onOpenChange={(open) => setLog((l) => ({ ...l, open }))} defaults={log.defaults} />
    </div>
  );
}
