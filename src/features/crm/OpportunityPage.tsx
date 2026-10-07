// /app/crm/opportunities/:opportunityId — one deal (DESIGN §5 detail page): header (account, name, stage, key facts
// inline, actions), then main 2/3 (stage progress + next step, interactions) and side facts 1/3 on xl (details, quote,
// contacts, stage history). Phones: win / lose sit in a sticky bottom bar.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, CircleAlert, CircleCheck, CircleX, MessageSquarePlus, Pencil, RotateCcw } from 'lucide-react';
import type { OpportunityDetail } from '@/services/crmContract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatMoneyCompact, formatPercent, formatRelativeDays } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { crmPaths, isOpenStage, stageLabel } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { LogInteractionDialog } from '@/components/crm/LogInteractionDialog';
import { OpportunityStageBadge } from '@/components/crm/OpportunityStageBadge';
import { useCloseFlow } from './dialogs/useCloseFlow';
import { EditOpportunityDialog } from './dialogs/EditOpportunityDialog';
import { StageProgress } from './opportunity/StageProgress';
import { ContactsCard, DetailsCard, HistoryCard, QuoteCard } from './opportunity/SideCards';
import { NextStepLine } from './pipeline/OpportunityCard';
import { StageMenu } from './pipeline/StageMenu';

function PageSkeletonView() {
  return (
    <div role="status" aria-busy="true" className="space-y-6 md:space-y-8">
      <span className="sr-only">{t('common.a11y.loading')}</span>
      <div className="flex items-start gap-3 md:gap-4">
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-96 max-w-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:gap-10">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-caption">{label}</dt>
      <dd className="mt-1 min-w-0 text-heading font-semibold tabular tracking-tightish text-ink">{children}</dd>
    </div>
  );
}

/** last open stage before the deal was lost, from the stage history */
function lostAtStage(opp: OpportunityDetail): OpenStage | null {
  for (let i = opp.stage_history.length - 1; i >= 0; i -= 1) {
    const s = opp.stage_history[i]?.stage;
    if (s && isOpenStage(s)) return s;
  }
  return null;
}

function OpportunityBody({ opp }: { opp: OpportunityDetail }) {
  const today = todayISO();
  const { run, pending } = useAction();
  const close = useCloseFlow();
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const open = isOpenStage(opp.stage);
  const closeDays = diffDays(opp.expected_close_date, today);

  const move = (to: OpenStage) =>
    void run(() => api.moveOpportunityStage(opp.id, to), {
      success: 'crm.pipeline.toast.moved',
      successParams: { name: opp.name, stage: stageLabel(to) },
    });
  const reopen = () => void run(() => api.reopenOpportunity(opp.id), { success: 'crm.opportunity.reopenToast', successParams: { name: opp.name } });
  const logDefaults = useMemo(() => ({ account_id: opp.account.id, opportunity_id: opp.id }), [opp.account.id, opp.id]);

  /** win / lose (open deal) or reopen (closed deal); primary last */
  const outcomeActions = (phone: boolean) =>
    open ? (
      <>
        <Button variant="secondary" onClick={() => close.askLose(opp)} disabled={pending} className={phone ? 'w-full' : undefined}>
          <CircleX aria-hidden="true" />
          {phone ? t('crm.opportunity.loseShort') : t('crm.opportunity.lose')}
        </Button>
        <Button onClick={() => close.askWin(opp)} disabled={pending} className={phone ? 'w-full' : undefined}>
          <CircleCheck aria-hidden="true" />
          {phone ? t('crm.opportunity.winShort') : t('crm.opportunity.win')}
        </Button>
      </>
    ) : (
      <Button variant="secondary" onClick={reopen} loading={pending} className={phone ? 'col-span-2 w-full' : undefined}>
        <RotateCcw aria-hidden="true" />
        {t('crm.opportunity.reopen')}
      </Button>
    );

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      {/* the way back ("Bán hàng") is in the app top bar: breadcrumb from md, "‹ Bán hàng" on phones */}
      <header className="space-y-5 md:space-y-6">
        <div className="flex items-start gap-3 md:gap-4">
          <AccountLogo account={opp.account} size="md" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <Link
              to={crmPaths.account(opp.account.id)}
              className="touch-tap -my-1 inline-flex max-w-full items-center gap-0.5 rounded py-1 text-table font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <span className="truncate">{opp.account.name}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Link>
            <h1 className="mt-0.5 break-words text-title font-semibold tracking-tightish text-ink">{opp.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <OpportunityStageBadge stage={opp.stage} size="md" />
              {open && opp.close_overdue && closeDays < 0 ? (
                <Badge variant="danger">
                  <CircleAlert aria-hidden="true" />
                  {t('crm.list.closeOverdue', { days: -closeDays })}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label={t('crm.opportunity.editAria')} title={t('crm.opportunity.edit')} className="md:hidden">
              <Pencil aria-hidden="true" />
            </Button>
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" />
                {t('crm.opportunity.edit')}
              </Button>
              {outcomeActions(false)}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-5 sm:flex sm:flex-wrap sm:gap-x-10 md:pt-6">
          <Fact label={t('crm.opportunity.value')}>
            <span title={formatMoney(opp.value)}>{formatMoneyCompact(opp.value)}</span>
          </Fact>
          <Fact label={t('crm.opportunity.weighted')}>
            <span title={formatMoney(opp.weighted_value)}>{formatMoneyCompact(opp.weighted_value)}</span>
            <span className="ml-1.5 text-table font-normal text-muted-foreground">{formatPercent(opp.probability)}</span>
          </Fact>
          <Fact label={open ? t('crm.opportunity.close') : t('crm.opportunity.closedOn')}>
            {open ? (
              <span className="block">
                {formatDate(opp.expected_close_date)}
                {opp.close_overdue && closeDays < 0 ? null : (
                  <span className="ml-1.5 text-table font-normal text-muted-foreground">{formatRelativeDays(closeDays)}</span>
                )}
              </span>
            ) : opp.won_at ? (
              t('crm.opportunity.wonOn', { date: formatDate(opp.won_at) })
            ) : opp.lost_at ? (
              t('crm.opportunity.lostOn', { date: formatDate(opp.lost_at) })
            ) : (
              '—'
            )}
          </Fact>
          <Fact label={t('crm.opportunity.owner')}>
            <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-table font-medium text-foreground">
              <UserAvatar user={opp.owner} size="xs" />
              <span className="truncate">{opp.owner.full_name}</span>
            </span>
          </Fact>
        </dl>
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <SectionCard
            title={t('crm.opportunity.progress')}
            actions={
              open ? (
                <StageMenu
                  name={opp.name}
                  current={opp.stage}
                  trigger="button"
                  onMove={move}
                  onWin={() => close.askWin(opp)}
                  onLose={() => close.askLose(opp)}
                  disabled={pending}
                  className="h-9 md:h-8"
                />
              ) : null
            }
          >
            <StageProgress stage={opp.stage} lostAt={opp.stage === 'lost' ? lostAtStage(opp) : null} onMove={move} disabled={pending} />
            {open ? (
              <div className="mt-5 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4">
                <p className="text-micro font-medium text-muted-foreground">{t('crm.opportunity.nextStep')}</p>
                <NextStepLine opp={opp} today={today} clamp={false} className="mt-1 text-table" />
              </div>
            ) : opp.stage === 'lost' && opp.lost_reason ? (
              <div className="mt-5 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4">
                <p className="text-micro font-medium text-muted-foreground">{t('crm.opportunity.lostReason')}</p>
                <p className="mt-1 whitespace-pre-line text-table text-foreground">{opp.lost_reason}</p>
              </div>
            ) : opp.stage === 'won' && opp.project_id ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4">
                <p className="text-table text-foreground">{t('crm.opportunity.projectCreated')}</p>
                <Button asChild variant="secondary" size="sm">
                  <Link to={crmPaths.accountRoadmap(opp.account.id, opp.project_id)}>{t('crm.opportunity.openRoadmap')}</Link>
                </Button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('crm.opportunity.interactions')}
            description={
              opp.last_interaction_at ? (
                <span className="inline-flex items-center gap-1">
                  {t('crm.opportunity.lastTouch')} <DateText value={opp.last_interaction_at} relative time />
                </span>
              ) : undefined
            }
            actions={
              <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>
                <MessageSquarePlus aria-hidden="true" />
                {t('crm.opportunity.log')}
              </Button>
            }
          >
            <InteractionTimeline items={opp.interactions} hideLinks={['account', 'opportunity']} emptyText={t('crm.opportunity.noInteractions')} />
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <DetailsCard opp={opp} />
          <QuoteCard opp={opp} />
          <ContactsCard opp={opp} />
          <HistoryCard opp={opp} />
        </div>
      </div>

      {/* phones: the outcome actions stay under the thumb */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-6 grid grid-cols-2 gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden">
        {outcomeActions(true)}
      </div>

      <EditOpportunityDialog opportunity={opp} open={editOpen} onOpenChange={setEditOpen} />
      <LogInteractionDialog open={logOpen} onOpenChange={setLogOpen} defaults={logDefaults} />
      {close.dialogs}
    </div>
  );
}

export function OpportunityPage() {
  const { opportunityId = '' } = useParams<{ opportunityId: string }>();
  const q = useQuery(() => api.getOpportunity(opportunityId), [opportunityId], { enabled: opportunityId !== '' });
  const code: unknown = q.error && typeof q.error === 'object' ? (q.error as { code?: unknown }).code : undefined;
  const final = code === 'forbidden' || code === 'not_found' || code === 'unauthenticated';

  if (q.error && (!q.data || final)) {
    // the way back is the top bar's breadcrumb / "‹ Bán hàng"
    return (
      <Card>
        <ErrorState error={q.error} onRetry={q.refetch} />
      </Card>
    );
  }
  if (!q.data) return <PageSkeletonView />;
  return <OpportunityBody opp={q.data} />;
}
