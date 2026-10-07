// Lead drawer (/app/targets/leads/:leadId): right sheet on desktop/iPad, full screen on phones (api.getLead).
// DESIGN §4 drawer: sticky header (company, industry · province, status / fit / website) → hairline-separated
// sections → sticky footer (Sửa · Ghi nhận tương tác · Chuyển thành cơ hội, primary last).
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CircleCheck, Globe, Handshake, MessageSquarePlus, Pencil, RotateCcw } from 'lucide-react';
import type { LeadStatus } from '@/domain/crmTypes';
import type { LeadDetail } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { FitScoreBadge } from '@/components/crm/FitScoreBadge';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { LogInteractionDialog } from '@/components/crm/LogInteractionDialog';
import { SMALL } from '@/components/common/cx';
import { ErrorState } from '@/components/common/error-state';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatRelativeTime } from '@/lib/format';
import { isOpenLead, leadSourceLabel, leadStatusLabel, revenueLabel, sizeLabel } from '../targetLabels';
import { Block, LeadStatusBadge, leadStatusIcon } from '../TargetBits';
import { ConvertLeadDialog } from './ConvertLeadDialog';
import { LeadFormDialog } from './LeadFormDialog';
import { ContactBlock, FitExplanation, FollowUpEditor, OwnerControl } from './LeadDrawerParts';

export interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  people: UserRef[];
  isDirector: boolean;
  meId: string;
  /** company name of the open lead (null while loading / closed) — the page puts it in the browser tab title */
  onLeadName?: (name: string | null) => void;
}

/** hairline-separated drawer sections */
const SECTIONS = 'divide-y divide-border/60 pt-0 md:pt-0 [&>*]:py-6 [&>*:first-child]:pt-5 md:[&>*:first-child]:pt-6';

export function LeadDrawer({ leadId, onClose, people, isDirector, meId, onLeadName }: LeadDrawerProps) {
  const query = useQuery(() => api.getLead(leadId ?? ''), [leadId], { enabled: leadId !== null });
  const current = query.data && query.data.id === leadId ? query.data : undefined;
  const currentName = current?.company_name ?? null;
  useEffect(() => {
    onLeadName?.(currentName);
  }, [currentName, onLeadName]);
  // keep the last lead on screen while the sheet slides out
  const last = useRef<LeadDetail | undefined>(undefined);
  if (current) last.current = current;
  const lead = current ?? (leadId === null ? last.current : undefined);
  return (
    <Sheet
      open={leadId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" mobileFullScreen {...(lead ? {} : { 'aria-describedby': undefined })}>
        {lead ? (
          <LeadDetailView lead={lead} people={people} isDirector={isDirector} meId={meId} />
        ) : query.error ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">{t('targets.title')}</SheetTitle>
            </SheetHeader>
            <ErrorState error={query.error} onRetry={query.refetch} />
          </>
        ) : (
          <DrawerSkeleton />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <>
      <SheetHeader className="border-b border-border/70">
        <SheetTitle className="sr-only">{t('targets.title')}</SheetTitle>
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="mt-1.5 h-4 w-40" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
      </SheetHeader>
      <SheetBody className={SECTIONS} aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ))}
      </SheetBody>
    </>
  );
}

const QUICK_STATUSES: Exclude<LeadStatus, 'new' | 'converted'>[] = ['contacted', 'interested', 'nurturing', 'disqualified'];

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-tap gap-1 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-3 md:min-h-10">
      <dt className="text-caption">{label}</dt>
      <dd className="min-w-0 text-table text-foreground">{children}</dd>
    </div>
  );
}

function LeadDetailView({ lead, people, isDirector, meId }: { lead: LeadDetail; people: UserRef[]; isDirector: boolean; meId: string }) {
  const today = todayISO();
  const { run, pending } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const open = isOpenLead(lead.status);
  const company = lead.company_name;

  async function setStatus(status: Exclude<LeadStatus, 'converted'>, reason?: string): Promise<boolean> {
    const r = await run(() => api.setLeadStatus(lead.id, status, reason), {
      success: t('targets.drawer.statusChanged', { company, status: leadStatusLabel(status) }),
    });
    return Boolean(r);
  }

  return (
    <>
      <SheetHeader className="gap-0 border-b border-border/70">
        <SheetTitle className="break-words">{company}</SheetTitle>
        <SheetDescription>
          {lead.industry}
          {t('common.separator')}
          {lead.province}
        </SheetDescription>
        <SheetMeta className="mt-3">
          <LeadStatusBadge status={lead.status} />
          <FitScoreBadge fit={lead.fit} showBreakdown className="-my-1" />
          {lead.website ? (
            <a
              href={/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                'touch-tap -my-1 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline',
                SMALL,
              )}
              aria-label={`${t('targets.drawer.website', { company })} (${t('common.a11y.externalLink')})`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-[12rem] truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : null}
        </SheetMeta>
      </SheetHeader>

      <SheetBody className={SECTIONS}>
        {lead.status === 'converted' ? (
          <div>
            <div className="rounded-lg bg-success-soft p-4 ring-1 ring-inset ring-success/15">
              <p className="flex items-center gap-2 text-table font-semibold text-success">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('targets.drawer.converted')}
              </p>
              <p className="mt-1 text-table text-foreground">{t('targets.drawer.convertedText', { company })}</p>
              {lead.converted_account ? (
                <Button asChild variant="secondary" size="sm" className="mt-3">
                  <Link to={`/app/accounts/${lead.converted_account.id}`}>{t('targets.drawer.openAccount')}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {lead.status === 'disqualified' ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-subtle p-4 ring-1 ring-inset ring-border/60">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-table text-foreground">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="break-words">{t('targets.drawer.disqualifiedReason', { reason: lead.disqualified_reason ?? '—' })}</span>
              </p>
              <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => void setStatus('new')}>
                <RotateCcw aria-hidden="true" />
                {t('targets.drawer.reopen')}
              </Button>
            </div>
          </div>
        ) : null}

        {open ? (
          <Block title={t('targets.drawer.statusActions')}>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label={t('targets.drawer.statusActions')}>
              {QUICK_STATUSES.map((s) => {
                const Icon = leadStatusIcon(s);
                const current = lead.status === s;
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={current ? 'soft' : 'secondary'}
                    aria-pressed={current}
                    disabled={pending || current}
                    onClick={() => (s === 'disqualified' ? setDisqualifyOpen(true) : void setStatus(s))}
                    className={cn('justify-start sm:justify-center', current && 'disabled:opacity-100')}
                  >
                    <Icon aria-hidden="true" />
                    {t(`targets.drawer.mark.${s}`)}
                  </Button>
                );
              })}
            </div>
          </Block>
        ) : null}

        <Block title={t('targets.drawer.sections.followUp')}>
          <dl className="-my-2 divide-y divide-border/60">
            <FactRow label={t('targets.drawer.owner')}>
              <OwnerControl lead={lead} people={people} isDirector={isDirector} meId={meId} />
            </FactRow>
            <FactRow label={t('targets.drawer.followUp')}>
              <FollowUpEditor lead={lead} today={today} />
            </FactRow>
            <FactRow label={t('targets.drawer.lastContact')}>
              {lead.last_contacted_at ? (
                <span title={formatDate(lead.last_contacted_at)}>{formatRelativeTime(lead.last_contacted_at)}</span>
              ) : (
                <span className="text-muted-foreground">{t('targets.drawer.neverContacted')}</span>
              )}
            </FactRow>
          </dl>
        </Block>

        <Block title={t('targets.drawer.sections.contact')}>
          <ContactBlock lead={lead} />
        </Block>

        <Block title={t('targets.drawer.sections.need')}>
          <div className="space-y-3">
            <p className={cn('whitespace-pre-line break-words text-body', lead.need_summary ? 'text-foreground' : 'text-muted-foreground')}>
              {lead.need_summary ?? t('targets.drawer.noNeed')}
            </p>
            <p className="text-table text-muted-foreground">
              {t('targets.drawer.budget')}:{' '}
              {lead.budget_estimate ? (
                <span className="font-semibold tabular text-ink">{formatMoney(lead.budget_estimate)}</span>
              ) : (
                t('targets.drawer.budgetNone')
              )}
            </p>
            {lead.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('targets.drawer.tags')}>
                {lead.tags.map((tag) => (
                  <li key={tag} className={cn('rounded-md bg-muted px-2 py-0.5 text-muted-foreground', SMALL)}>
                    #{tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Block>

        <Block title={t('targets.drawer.sections.fit')} description={t('targets.fit.explain')}>
          <FitExplanation lead={lead} />
        </Block>

        <Block title={t('targets.drawer.sections.profile')}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-table sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-caption">{t('targets.drawer.size')}</dt>
              <dd className="mt-0.5 text-foreground">{sizeLabel(lead.size)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-caption">{t('targets.drawer.revenue')}</dt>
              <dd className="mt-0.5 text-foreground">{revenueLabel(lead.revenue_band)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-caption">{t('targets.drawer.source')}</dt>
              <dd className="mt-0.5 text-foreground">{leadSourceLabel(lead.source)}</dd>
            </div>
          </dl>
          <p className="text-caption">{t('targets.drawer.created', { date: formatDate(lead.created_at) })}</p>
          {lead.notes ? <InternalNoteBox>{lead.notes}</InternalNoteBox> : null}
        </Block>

        {/* "Ghi nhận tương tác" lives once, in the sticky footer */}
        <Block title={t('targets.drawer.sections.interactions')}>
          <InteractionTimeline items={lead.interactions} hideLinks={['lead']} emptyText={t('targets.drawer.noInteractions', { company })} />
        </Block>
      </SheetBody>

      {/* phones: the main action on its own line on top, the two others side by side under it */}
      <SheetFooter className="grid grid-cols-2 sm:flex">
        <Button type="button" variant="ghost" onClick={() => setEditOpen(true)} className="sm:mr-auto">
          <Pencil aria-hidden="true" />
          {t('targets.drawer.edit')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}>
          <MessageSquarePlus aria-hidden="true" />
          {t('targets.drawer.logInteraction')}
        </Button>
        {open ? (
          <Button type="button" onClick={() => setConvertOpen(true)} className="order-first col-span-2 sm:order-none">
            <Handshake aria-hidden="true" />
            {t('targets.drawer.convert')}
          </Button>
        ) : lead.converted_opportunity_id ? (
          <Button asChild className="order-first col-span-2 sm:order-none">
            <Link to={`/app/crm/opportunities/${lead.converted_opportunity_id}`}>{t('targets.drawer.openOpportunity')}</Link>
          </Button>
        ) : null}
      </SheetFooter>

      <ReasonDialog
        open={disqualifyOpen}
        onOpenChange={setDisqualifyOpen}
        title={t('targets.disqualify.title')}
        description={t('targets.disqualify.description', { company })}
        label={t('targets.disqualify.label')}
        placeholder={t('targets.disqualify.placeholder')}
        confirmLabel={t('targets.disqualify.confirm')}
        destructive
        onConfirm={(reason) => setStatus('disqualified', reason)}
      />
      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} people={people} isDirector={isDirector} meId={meId} />
      {open ? (
        <ConvertLeadDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} people={people} isDirector={isDirector} meId={meId} />
      ) : null}
      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        defaults={{
          lead_id: lead.id,
          account_id: lead.converted_account?.id ?? null,
          opportunity_id: lead.converted_opportunity_id ?? null,
        }}
      />
    </>
  );
}
