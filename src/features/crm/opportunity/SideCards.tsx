// Right column of the opportunity page (side facts 1/3 on xl): details, linked quote, contacts, stage history.
// Quiet cards: label/value rows on hairlines, no boxes inside the cards.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CalendarX, CircleCheck, Clock, FilePlus2, FileText, Mail, MessageSquareWarning, Phone, Send } from 'lucide-react';
import type { QuoteStatus } from '@/domain/types';
import type { OpportunityDetail } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { DateText } from '@/components/common/date-text';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { crmPaths, sourceLabel } from '@/components/crm/crmLabels';
import { OpportunityStageBadge } from '@/components/crm/OpportunityStageBadge';

/** label + value; `stacked` puts the label above (long values such as product chips) */
function Row({ label, children, stacked = false }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cn('py-2.5 first:pt-0 last:pb-0', stacked ? 'space-y-1.5' : 'grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-3')}>
      <dt className="text-caption">{label}</dt>
      <dd className="min-w-0 break-words text-table text-foreground">{children}</dd>
    </div>
  );
}

export function DetailsCard({ opp }: { opp: OpportunityDetail }) {
  return (
    <SectionCard title={t('crm.opportunity.details')}>
      <dl className="divide-y divide-border/60">
        <Row label={t('crm.opportunity.source')}>{sourceLabel(opp.source)}</Row>
        <Row label={t('crm.opportunity.products')} stacked={opp.products.length > 0}>
          {opp.products.length === 0 ? (
            <span className="text-muted-foreground">{t('crm.opportunity.noProducts')}</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {opp.products.map((p) => (
                <span key={p.price_item_id} className={cn('rounded-md bg-muted px-2 py-0.5 text-foreground', SMALL)} title={p.code}>
                  {p.name}
                </span>
              ))}
            </span>
          )}
        </Row>
        <Row label={t('crm.opportunity.lastInteraction')}>
          {opp.last_interaction_at ? <DateText value={opp.last_interaction_at} relative time /> : <span className="text-muted-foreground">{t('crm.opportunity.noInteraction')}</span>}
        </Row>
        <Row label={t('crm.opportunity.created')}>
          <DateText value={opp.created_at} />
        </Row>
        <Row label={t('crm.opportunity.updated')}>
          <DateText value={opp.updated_at} relative time />
        </Row>
        {/* a won deal shows "Mở lộ trình" in its Tiến trình card already; here only for a reopened one */}
        {opp.project_id && opp.stage !== 'won' ? (
          <Row label={t('crm.opportunity.project')}>
            <Link
              to={crmPaths.accountRoadmap(opp.account.id, opp.project_id)}
              className="touch-tap inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('crm.opportunity.openRoadmap')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Row>
        ) : null}
      </dl>
    </SectionCard>
  );
}

const QUOTE_LOOK: Record<QuoteStatus, { icon: LucideIcon; variant: 'default' | 'warning' | 'primary' | 'success' }> = {
  draft: { icon: FileText, variant: 'default' },
  pending_approval: { icon: Clock, variant: 'warning' },
  sent: { icon: Send, variant: 'primary' },
  accepted: { icon: CircleCheck, variant: 'success' },
  changes_requested: { icon: MessageSquareWarning, variant: 'warning' },
  expired: { icon: CalendarX, variant: 'default' },
};

export function QuoteCard({ opp }: { opp: OpportunityDetail }) {
  const quote = opp.quote;
  if (!quote) {
    return (
      <SectionCard title={t('crm.opportunity.quote')}>
        <p className="text-table text-muted-foreground">{t('crm.opportunity.noQuote')}</p>
        <Button asChild variant="secondary" size="sm" className="mt-3">
          <Link to={crmPaths.newQuote(opp.account.id)}>
            <FilePlus2 aria-hidden="true" />
            {t('crm.opportunity.createQuote')}
          </Link>
        </Button>
      </SectionCard>
    );
  }
  const look = QUOTE_LOOK[quote.status];
  const Icon = look.icon;
  return (
    <SectionCard
      title={t('crm.opportunity.quote')}
      footer={
        <Link
          to={crmPaths.quote(quote.id)}
          className="touch-tap inline-flex min-h-8 items-center gap-1 rounded font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('crm.opportunity.openQuote')}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={look.variant}>
          <Icon aria-hidden="true" />
          {t(`enums.quoteStatus.${quote.status}`)}
        </Badge>
        <span className="text-micro font-medium tabular text-muted-foreground">{t('crm.opportunity.quoteCode', { code: quote.code, version: quote.version })}</span>
      </div>
      <p className="mt-2 text-table font-medium text-ink">{quote.title}</p>
      <p className={cn('mt-1 tabular text-muted-foreground', SMALL)}>
        {t('crm.opportunity.quoteLine', { total: formatMoney(quote.grand_total), date: formatDate(quote.valid_until) })}
      </p>
    </SectionCard>
  );
}

export function ContactsCard({ opp }: { opp: OpportunityDetail }) {
  return (
    <SectionCard title={t('crm.opportunity.contacts')}>
      {opp.contacts.length === 0 ? (
        <p className="text-table text-muted-foreground">{t('crm.opportunity.noContacts')}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {opp.contacts.map((c) => (
            <li key={c.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <UserAvatar user={{ full_name: c.full_name, avatar_url: null, org_type: 'client' }} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-table font-medium text-ink">{c.full_name}</p>
                {c.title ? <p className="text-caption">{c.title}</p> : null}
                <div className="mt-1 flex flex-wrap gap-x-3">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className={cn('touch-tap inline-flex min-w-0 max-w-full items-center gap-1 text-muted-foreground transition-colors hover:text-foreground', SMALL)}
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{c.email}</span>
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, '')}`}
                      className={cn('touch-tap inline-flex items-center gap-1 tabular text-muted-foreground transition-colors hover:text-foreground', SMALL)}
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {c.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function HistoryCard({ opp }: { opp: OpportunityDetail }) {
  return (
    <SectionCard title={t('crm.opportunity.history')}>
      {opp.stage_history.length === 0 ? (
        <p className="text-table text-muted-foreground">{t('crm.opportunity.noHistory')}</p>
      ) : (
        <ol className="space-y-3">
          {opp.stage_history.map((h, i) => (
            <li key={`${h.stage}-${h.at}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <OpportunityStageBadge stage={h.stage} />
              <span className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
                {h.by ? (
                  <>
                    <UserAvatar user={h.by} size="xs" />
                    {h.by.full_name}
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <DateText value={h.at} relative time />
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
