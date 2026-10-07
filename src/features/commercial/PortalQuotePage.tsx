// /portal/commercial/quotes/:quoteId (client_owner): a status hero (one sentence: what this quote needs from the
// client), the clean quote page (QuoteDocument, audience client) and, while the quote waits for the client, the
// decision bar: fixed above the tab bar on phones, floating at the bottom from md — "Chấp thuận" · "Đề nghị điều
// chỉnh" (reason required). Both decide through the quote's approval task when there is one, exactly as from the task
// drawer: immediate, with the 5-second "Hoàn tác" (SPEC §7: confirm dialogs only for what cannot be undone). The
// optional note for New Era is written inline in the status hero. "In / Xuất PDF" prints only the quote page.
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarX, Check, CircleCheck, Clock, History, MessageSquarePlus, MessageSquareWarning, Printer } from 'lucide-react';
import type { QuoteDetail, TaskView } from '@/services/contract';
import { QuoteDocument } from '@/components/commercial/QuoteDocument';
import { QuotePrintArea, printQuote } from '@/components/commercial/QuotePrint';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { DUE_SOON_DAYS } from '@/domain/taskRules';
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

// blue is for action and selection only (DESIGN §1.6): a quote waiting for the client is a calm white card, amber
// once its validity runs out within DUE_SOON_DAYS (the same rule as the validity chip on /portal/commercial)
type PanelTone = 'success' | 'warning' | 'neutral';

const PANEL_TONE: Record<PanelTone, { box: string; circle: string; icon: string }> = {
  success: { box: 'bg-success-soft ring-success/15', circle: 'bg-card shadow-xs', icon: 'text-success' },
  warning: { box: 'bg-warning-soft ring-warning/20', circle: 'bg-card shadow-xs', icon: 'text-warning' },
  neutral: { box: 'bg-card ring-border/70 shadow-card', circle: 'bg-muted', icon: 'text-muted-foreground' },
};

/** status hero (DESIGN §5 client home): soft tint, icon in a white circle, a title and one sentence */
function Panel({ tone, icon: Icon, title, children }: { tone: PanelTone; icon: LucideIcon; title: string; children?: ReactNode }) {
  const look = PANEL_TONE[tone];
  return (
    <section className={cn('flex gap-3.5 rounded-xl p-4 ring-1 ring-inset sm:gap-4 sm:p-5', look.box)} aria-label={title}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', look.circle)}>
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

function StatusPanel({
  quote,
  salutation,
  readOnly,
  noteField,
}: {
  quote: QuoteDetail;
  salutation: string;
  readOnly: boolean;
  /** pending + decidable: the optional note sent with "Chấp thuận" */
  noteField?: ReactNode;
}) {
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
  const days = diffDays(quote.valid_until, todayISO());
  return (
    <Panel
      tone={days <= DUE_SOON_DAYS ? 'warning' : 'neutral'}
      icon={Clock}
      title={capitalize(t('commercial.portalQuote.pendingTitle', { salutation }))}
    >
      <p className="text-table text-foreground">
        {t('commercial.portalQuote.pendingHint', {
          date: formatDate(quote.valid_until),
          rel: formatRelativeDays(days),
          salutation: capitalize(salutation),
        })}
      </p>
      {readOnly ? <p className="text-table text-muted-foreground">{t('commercial.portalQuote.readOnly')}</p> : noteField}
    </Panel>
  );
}

/** "Thêm lời nhắn cho New Era" → an inline text area; the note goes with "Chấp thuận" (no dialog in between) */
function AcceptNote({ value, onChange, salutation }: { value: string; onChange: (value: string) => void; salutation: string }) {
  const id = useId();
  // reopened with the text after a "Hoàn tác"; focus only when the client opens it
  const [open, setOpen] = useState(value !== '');
  const [focus, setFocus] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="text-table"
        onClick={() => {
          setFocus(true);
          setOpen(true);
        }}
      >
        <MessageSquarePlus aria-hidden="true" />
        {t('commercial.portalQuote.addNote')}
      </Button>
    );
  }
  return (
    <FormField
      className="pt-2"
      label={t('commercial.portalQuote.acceptNoteLabel')}
      htmlFor={id}
      hint={t('commercial.portalQuote.acceptNoteHint', { salutation })}
    >
      <Textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={focus}
        placeholder={t('commercial.portalQuote.acceptNotePlaceholder')}
        className="bg-card"
      />
    </FormField>
  );
}

/**
 * The quote's open approval task this viewer can act on ("Báo giá cần duyệt cũng hiện thành 1 việc ở trang chủ").
 * Deciding through it is the same decision as from the task drawer, with the task's undo token.
 */
async function approvalTaskOf(quote: QuoteDetail): Promise<TaskView | null> {
  try {
    const tasks = await api.listTasks({ accountId: quote.account.id, waitingOn: 'client' });
    return tasks.find((task) => task.quote_id === quote.id && task.can.act) ?? null;
  } catch {
    return null;
  }
}

function DecisionBar({ quote, salutation, note }: { quote: QuoteDetail; salutation: string; note: string }) {
  const [busy, setBusy] = useState(false);
  // only when no approval task can carry the decision: accepting is then final, so it is confirmed first
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const { run } = useAction();
  const text = note.trim() || undefined;

  async function accept() {
    if (busy) return;
    setBusy(true);
    const task = await approvalTaskOf(quote);
    if (task) {
      await run(() => api.approveTask(task.id, text), {
        success: 'commercial.portalQuote.toast.accepted',
        undoToken: (r) => r.undo_token,
      });
    } else {
      setConfirmOpen(true);
    }
    setBusy(false);
  }

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
            <Button size="touch" onClick={() => void accept()} loading={busy} className="w-full md:w-auto">
              {busy ? null : <Check aria-hidden="true" />}
              {t('commercial.portalQuote.accept')}
            </Button>
            <Button
              size="touch"
              variant="secondary"
              onClick={() => setChangesOpen(true)}
              disabled={busy}
              className="w-full px-3 md:w-auto md:px-5"
            >
              <MessageSquareWarning aria-hidden="true" className="max-sm:hidden" />
              {t('commercial.portalQuote.requestChanges')}
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('commercial.portalQuote.acceptTitle', { code: quote.code, version: quote.version })}
        description={capitalize(t('commercial.portalQuote.acceptDescription', { salutation, total: formatMoney(quote.grand_total) }))}
        confirmLabel={t('commercial.portalQuote.acceptConfirm')}
        onConfirm={async () =>
          (await run(() => api.clientAcceptQuote(quote.id, text), { success: 'commercial.portalQuote.toast.accepted' })) !== undefined
        }
      />
      <ReasonDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        title={t('commercial.portalQuote.changesTitle')}
        description={t('commercial.portalQuote.changesDescription')}
        label={t('commercial.portalQuote.changesLabel')}
        placeholder={t('commercial.portalQuote.changesPlaceholder')}
        confirmLabel={t('commercial.portalQuote.changesConfirm')}
        onConfirm={async (reason) => {
          const task = await approvalTaskOf(quote);
          const r = task
            ? await run(() => api.requestTaskChanges(task.id, reason), {
                success: 'commercial.portalQuote.toast.changes',
                undoToken: (x) => x.undo_token,
              })
            : await run(() => api.clientRequestQuoteChanges(quote.id, reason), { success: 'commercial.portalQuote.toast.changes' });
          return r !== undefined;
        }}
      />
    </>
  );
}

function QuotePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-8" role="status" aria-busy="true">
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
      <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-8">
        <PageHeader back={back()} title={t('commercial.doc.kind')} />
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      </div>
    );
  }

  // one centred reading column (header, status, quote page, decision bar) like a document viewer
  return (
    <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-8">
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

      {/* keyed: the note belongs to one version; it survives the accept → "Hoàn tác" round trip */}
      <QuoteBody key={quote.id} quote={quote} salutation={salutation} readOnly={!!viewer?.read_only} phone={phone} />
      <QuotePrintArea quote={quote} audience="client" />
    </div>
  );
}

function QuoteBody({ quote, salutation, readOnly, phone }: { quote: QuoteDetail; salutation: string; readOnly: boolean; phone: boolean }) {
  const [note, setNote] = useState('');
  const decidable = quote.can.client_decide;
  return (
    <>
      <StatusPanel
        quote={quote}
        salutation={salutation}
        readOnly={readOnly}
        noteField={decidable ? <AcceptNote value={note} onChange={setNote} salutation={salutation} /> : null}
      />

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
          <DecisionBar quote={quote} salutation={salutation} note={note} />
          {/* room for the fixed bar on phones */}
          <div className="h-24 md:hidden" aria-hidden="true" />
        </>
      ) : null}
    </>
  );
}
