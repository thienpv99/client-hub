// /portal/commercial/quotes/:quoteId (client_owner): a status hero (one sentence: what this quote needs from the
// client), the clean quote page (QuoteDocument, audience client) and, while the quote waits for the client, the
// decision bar: fixed above the tab bar on phones, floating at the bottom from md — "Chấp thuận" (short confirmation,
// it is a commitment) · "Đề nghị điều chỉnh" (reason required). "In / Xuất PDF" prints only the quote page.
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarX, Check, CircleCheck, Clock, History, MessageSquareWarning, Printer } from 'lucide-react';
import type { QuoteDetail } from '@/services/contract';
import { QuoteDocument } from '@/components/commercial/QuoteDocument';
import { QuotePrintArea, printQuote } from '@/components/commercial/QuotePrint';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useMediaQuery } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { capitalize, t } from '@/i18n';
import { formatDate, formatMoney, formatRelativeDays } from '@/lib/format';
import { api } from '@/services/api';
import { QuoteStatusBadge } from './components/status';
import { VersionSwitcher } from './components/VersionSwitcher';

function back() {
  return { to: '/portal/commercial', label: t('commercial.portalQuote.back') };
}

function portalQuoteHref(id: string): string {
  return `/portal/commercial/quotes/${id}`;
}

type PanelTone = 'primary' | 'success' | 'warning' | 'neutral';

const PANEL_TONE: Record<PanelTone, { box: string; icon: string }> = {
  primary: { box: 'bg-primary-soft ring-primary-border/70', icon: 'text-primary' },
  success: { box: 'bg-success-soft ring-success/15', icon: 'text-success' },
  warning: { box: 'bg-warning-soft ring-warning/20', icon: 'text-warning' },
  neutral: { box: 'bg-card ring-border/70 shadow-card', icon: 'text-muted-foreground' },
};

/** status hero (DESIGN §5 client home): soft tint, icon in a white circle, a title and one sentence */
function Panel({ tone, icon: Icon, title, children }: { tone: PanelTone; icon: LucideIcon; title: string; children?: ReactNode }) {
  const look = PANEL_TONE[tone];
  return (
    <section className={cn('flex gap-3.5 rounded-xl p-4 ring-1 ring-inset sm:gap-4 sm:p-5', look.box)} aria-label={title}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card shadow-xs">
        <Icon className={cn('h-5 w-5', look.icon)} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className="text-heading font-semibold tracking-tightish text-ink">{title}</p>
        {children}
      </div>
    </section>
  );
}

function ClientNote({ note }: { note: string }) {
  return (
    <div className="pt-1.5">
      <p className="text-micro font-medium text-muted-foreground">{t('commercial.portalQuote.yourNote')}</p>
      <p className="mt-1 whitespace-pre-line rounded-lg bg-card px-3 py-2 text-table text-foreground shadow-xs">{note}</p>
    </div>
  );
}

function StatusPanel({ quote, salutation, readOnly }: { quote: QuoteDetail; salutation: string; readOnly: boolean }) {
  const newer = quote.versions.find((v) => v.version > quote.version) ?? null;
  const who = (name: string | undefined) => name ?? t('common.unknownUser');
  const decidedOn = quote.client_decided_at ? formatDate(quote.client_decided_at) : '';

  if (quote.status === 'accepted') {
    return (
      <Panel tone="success" icon={CircleCheck} title={t('commercial.portalQuote.accepted')}>
        <p className="text-table text-foreground">
          {t('commercial.portalQuote.acceptedLine', { name: who(quote.client_decided_by?.full_name), date: decidedOn })}
        </p>
        {quote.client_note ? <ClientNote note={quote.client_note} /> : null}
      </Panel>
    );
  }
  if (newer) {
    return (
      <Panel tone="neutral" icon={History} title={t('commercial.portalQuote.superseded')}>
        <p className="text-table text-muted-foreground">{t('commercial.portalQuote.supersededLine', { version: newer.version })}</p>
        <Button asChild variant="link" size="sm" className="text-table">
          <Link to={portalQuoteHref(newer.id)}>
            {t('commercial.portalQuote.openNewer', { version: newer.version })}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Panel>
    );
  }
  if (quote.status === 'changes_requested') {
    return (
      <Panel tone="warning" icon={MessageSquareWarning} title={t('commercial.portalQuote.changesRequested')}>
        <p className="text-table text-foreground">
          {t('commercial.portalQuote.changesLine', { name: who(quote.client_decided_by?.full_name), date: decidedOn })}
        </p>
        {quote.client_note ? <ClientNote note={quote.client_note} /> : null}
      </Panel>
    );
  }
  if (quote.status === 'expired') {
    return (
      <Panel tone="neutral" icon={CalendarX} title={t('commercial.portalQuote.expired')}>
        <p className="text-table text-muted-foreground">
          {t('commercial.portalQuote.expiredLine', { date: formatDate(quote.valid_until), salutation })}
        </p>
      </Panel>
    );
  }
  // sent: waiting for this client
  const rel = formatRelativeDays(diffDays(quote.valid_until, todayISO()));
  return (
    <Panel tone="primary" icon={Clock} title={capitalize(t('commercial.portalQuote.pendingTitle', { salutation }))}>
      <p className="text-table text-foreground">
        {t('commercial.portalQuote.pendingHint', { date: formatDate(quote.valid_until), rel, salutation: capitalize(salutation) })}
      </p>
      {readOnly ? <p className="text-table text-muted-foreground">{t('commercial.portalQuote.readOnly')}</p> : null}
    </Panel>
  );
}

function AcceptDialog({
  quote,
  salutation,
  open,
  onOpenChange,
}: {
  quote: QuoteDetail;
  salutation: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const id = useId();
  const [note, setNote] = useState('');
  const { run, pending } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = note.trim();
    const r = await run(() => api.clientAcceptQuote(quote.id, text || undefined), { success: 'commercial.portalQuote.toast.accepted' });
    if (r) {
      setNote('');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{t('commercial.portalQuote.acceptTitle', { code: quote.code, version: quote.version })}</DialogTitle>
          <DialogDescription>
            {capitalize(t('commercial.portalQuote.acceptDescription', { salutation, total: formatMoney(quote.grand_total) }))}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField label={t('commercial.portalQuote.acceptNoteLabel')} htmlFor={id} hint={t('commercial.portalQuote.acceptNoteHint')}>
            <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? null : <Check aria-hidden="true" />}
              {t('commercial.portalQuote.acceptConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecisionBar({ quote, salutation }: { quote: QuoteDetail; salutation: string }) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const { run } = useAction();
  return (
    <>
      {/* phones: fixed above the portal's bottom tab bar (58px + safe area); from md it floats at the window bottom */}
      <div
        role="region"
        aria-label={t('commercial.portalQuote.actionsLabel')}
        className={cn(
          'fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 border-t border-border/70 bg-card/95 px-4 pb-3 pt-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-card/85',
          'md:sticky md:bottom-6 md:rounded-xl md:border md:px-5 md:py-3 md:shadow-pop',
          'print:hidden',
        )}
      >
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-6">
          <p className="flex items-baseline justify-between gap-3 md:block">
            <span className="text-caption md:block">{t('commercial.portal.totalVat')}</span>
            <span className="text-heading font-semibold tabular tracking-tightish text-ink md:text-title">{formatMoney(quote.grand_total)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-row-reverse">
            <Button size="touch" onClick={() => setAcceptOpen(true)} className="w-full md:w-auto">
              <Check aria-hidden="true" />
              {t('commercial.portalQuote.accept')}
            </Button>
            <Button size="touch" variant="secondary" onClick={() => setChangesOpen(true)} className="w-full px-3 md:w-auto md:px-5">
              <MessageSquareWarning aria-hidden="true" className="max-sm:hidden" />
              {t('commercial.portalQuote.requestChanges')}
            </Button>
          </div>
        </div>
      </div>
      <AcceptDialog quote={quote} salutation={salutation} open={acceptOpen} onOpenChange={setAcceptOpen} />
      <ReasonDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        title={t('commercial.portalQuote.changesTitle')}
        description={t('commercial.portalQuote.changesDescription')}
        label={t('commercial.portalQuote.changesLabel')}
        placeholder={t('commercial.portalQuote.changesPlaceholder')}
        confirmLabel={t('commercial.portalQuote.changesConfirm')}
        onConfirm={async (reason) => {
          const r = await run(() => api.clientRequestQuoteChanges(quote.id, reason), { success: 'commercial.portalQuote.toast.changes' });
          return r !== undefined;
        }}
      />
    </>
  );
}

function QuotePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-reading space-y-6" role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      <div className="flex gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
      <div className="mx-auto max-w-reading rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-8">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="mt-6 h-16 w-full rounded-lg" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function PortalQuotePage() {
  const { quoteId = '' } = useParams();
  const viewer = useViewer();
  const salutation = viewer?.user.salutation ?? t('commercial.portal.salutationFallback');
  const query = useQuery(() => api.getQuote(quoteId), [quoteId]);
  const phone = !useMediaQuery('(min-width: 640px)');
  const quote = query.data;

  if (query.loading) return <QuotePageSkeleton />;
  if (!quote) {
    return (
      <div className="mx-auto w-full max-w-reading space-y-6">
        <PageHeader back={back()} title={t('commercial.doc.kind')} />
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      </div>
    );
  }

  const decidable = quote.can.client_decide;
  // one centred reading column (header, status, quote page, decision bar) like a document viewer
  return (
    <div className="mx-auto w-full max-w-reading space-y-6">
      <PageHeader
        back={back()}
        title={quote.title}
        actions={
          phone ? null : (
            <Button variant="secondary" onClick={() => printQuote(quote)}>
              <Printer aria-hidden="true" />
              {t('commercial.print')}
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <QuoteStatusBadge status={quote.status} audience="client" />
          <span className="text-caption font-medium tabular text-foreground">{quote.code}</span>
          {quote.versions.length > 1 ? (
            <VersionSwitcher
              currentId={quote.id}
              versions={quote.versions}
              hrefFor={portalQuoteHref}
              label={t('commercial.portalQuote.versions')}
              audience="client"
            />
          ) : null}
        </div>
      </PageHeader>

      <StatusPanel quote={quote} salutation={salutation} readOnly={!!viewer?.read_only} />

      <QuoteDocument quote={quote} audience="client" showTitle={false} />

      {phone ? (
        <div className="flex justify-center">
          <Button variant="link" size="sm" onClick={() => printQuote(quote)}>
            <Printer aria-hidden="true" />
            {t('commercial.print')}
          </Button>
        </div>
      ) : null}

      {decidable ? (
        <>
          <DecisionBar quote={quote} salutation={salutation} />
          {/* room for the fixed bar on phones */}
          <div className="h-24 md:hidden" aria-hidden="true" />
        </>
      ) : null}
      <QuotePrintArea quote={quote} audience="client" />
    </div>
  );
}
