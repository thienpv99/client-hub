// Members of a saved segment (api.getSegmentMembers): new targets (open the lead drawer) and existing customers
// (open the account), with the segment's totals in the header.
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Layers, Pencil } from 'lucide-react';
import type { SegmentMembers, SegmentView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { FitScoreBadge } from '@/components/crm/FitScoreBadge';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { HealthBadge } from '@/components/common/health-badge';
import { ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { t } from '@/i18n';
import { formatMoneyCompact, formatNumber } from '@/lib/format';
import { LeadStatusBadge } from '../TargetBits';

export interface SegmentMembersSheetProps {
  segment: SegmentView | null;
  onClose: () => void;
  onOpenLead: (id: string) => void;
  /** shown when the viewer may edit the segment */
  onEdit?: (segment: SegmentView) => void;
}

export function SegmentMembersSheet({ segment, onClose, onOpenLead, onEdit }: SegmentMembersSheetProps) {
  const last = useRef<SegmentView | null>(null);
  if (segment) last.current = segment;
  const shown = segment ?? last.current;
  const query = useQuery(() => api.getSegmentMembers(segment?.id ?? ''), [segment?.id], { enabled: segment !== null });

  return (
    <Sheet
      open={segment !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" mobileFullScreen>
        {shown ? (
          <>
            <SheetHeader className="border-b border-border/70">
              <SheetTitle className="break-words">{shown.name}</SheetTitle>
              <SheetDescription>{shown.description || t('targets.segments.members.description', { name: shown.name })}</SheetDescription>
              {query.data ? <Totals members={query.data} /> : null}
            </SheetHeader>
            <SheetBody className="space-y-8 pt-5 md:pt-6">
              {query.data ? (
                <MemberLists members={query.data} scope={shown.criteria.scope} onOpenLead={onOpenLead} />
              ) : query.error ? (
                <ErrorState error={query.error} onRetry={query.refetch} compact />
              ) : (
                <ListSkeleton rows={5} />
              )}
            </SheetBody>
            {onEdit && segment ? (
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => onEdit(segment)}>
                  <Pencil aria-hidden="true" />
                  {t('targets.segments.edit')}
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : (
          <SheetTitle className="sr-only">{t('targets.tabs.segments')}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Totals({ members: m }: { members: SegmentMembers }) {
  return (
    <SheetMeta className="mt-2 tabular">
      <span>{t('targets.builder.previewCount', { leads: m.lead_count, accounts: m.account_count })}</span>
      <span aria-hidden="true">·</span>
      <span>{t('targets.builder.previewPotential', { value: formatMoneyCompact(m.potential_value) })}</span>
      <span aria-hidden="true">·</span>
      <span>{t('targets.builder.previewAvgFit', { value: formatNumber(Math.round(m.avg_fit)) })}</span>
    </SheetMeta>
  );
}

function ListTitle({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h3 className="flex items-center gap-2 text-table font-semibold text-ink">
      {children}
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
        {count}
      </span>
    </h3>
  );
}

const ROW =
  'flex w-full min-h-tap items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';
const LIST = 'divide-y divide-border/60 overflow-hidden rounded-xl bg-card ring-1 ring-inset ring-border/70';

function MemberLists({
  members: m,
  scope,
  onOpenLead,
}: {
  members: SegmentMembers;
  scope: SegmentView['criteria']['scope'];
  onOpenLead: (id: string) => void;
}) {
  if (m.leads.length === 0 && m.accounts.length === 0) {
    return <EmptyState compact icon={Layers} title={t('targets.segments.members.empty')} description={t('targets.segments.members.emptyHint')} />;
  }
  return (
    <>
      {scope !== 'accounts' ? (
        <section className="space-y-3">
          <ListTitle count={m.leads.length}>{t('targets.segments.members.leadsTitle')}</ListTitle>
          {m.leads.length === 0 ? (
            <p className="text-table text-muted-foreground">{t('targets.segments.members.noLeads')}</p>
          ) : (
            <ul className={LIST}>
              {m.leads.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onOpenLead(l.id)} className={ROW}>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-table font-semibold text-ink">{l.company_name}</span>
                      <span className="block truncate text-caption">
                        {l.industry}
                        {t('common.separator')}
                        {l.province}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-2 sm:hidden">
                        <LeadStatusBadge status={l.status} size="sm" />
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <LeadStatusBadge status={l.status} size="sm" />
                    </span>
                    <FitScoreBadge fit={l.fit} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {scope !== 'leads' ? (
        <section className="space-y-3">
          <ListTitle count={m.accounts.length}>{t('targets.segments.members.accountsTitle')}</ListTitle>
          {m.accounts.length === 0 ? (
            <p className="text-table text-muted-foreground">{t('targets.segments.members.noAccounts')}</p>
          ) : (
            <ul className={LIST}>
              {m.accounts.map((a) => (
                <li key={a.id}>
                  <Link to={`/app/accounts/${a.id}`} className={ROW}>
                    <AccountLogo account={a} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-table font-semibold text-ink">{a.name}</span>
                      <span className="block truncate text-caption">
                        {a.industry}
                        {t('common.separator')}
                        {a.province}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-2 sm:hidden">
                        <HealthBadge health={a.health} size="sm" variant="dot" />
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <HealthBadge health={a.health} size="sm" variant="dot" />
                    </span>
                    <FitScoreBadge fit={a.fit} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
