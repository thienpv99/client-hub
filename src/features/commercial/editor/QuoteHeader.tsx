// Quote header (detail page, DESIGN §5): account as the eyebrow, the quote title (`compact` → text-title), then one
// meta row: status · code + version switcher (segmented) · validity · unsaved dot. "Xem bản khách nhận" opens the
// client's copy in a drawer (printable).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Printer } from 'lucide-react';
import type { AccountRef, QuoteDetail } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { PageHeader } from '@/components/common/page-header';
import { QuoteDocument } from '@/components/commercial/QuoteDocument';
import { QuotePrintArea, printQuote } from '@/components/commercial/QuotePrint';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { QuoteStatusBadge } from '../components/status';
import { VersionSwitcher } from '../components/VersionSwitcher';

export function QuoteHeader({
  quote,
  account,
  dirty = false,
  titleOverride,
}: {
  quote: QuoteDetail | null;
  account: AccountRef;
  dirty?: boolean;
  titleOverride?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // phones: the client copy moves up into the account row, so the summary card (total + next action) stays above the fold
  const wide = useMediaQuery('(min-width: 640px)');
  const title = quote ? quote.title : titleOverride?.trim() || t('commercial.editor.newTitle');
  const daysLeft = quote ? diffDays(quote.valid_until, todayISO()) : 0;
  const accountLink = (
    <Link
      to={`/app/accounts/${account.id}/commercial`}
      className="touch-tap -ml-1 inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <AccountLogo account={account} size="xs" />
      <span className="truncate">{account.name}</span>
    </Link>
  );

  return (
    <>
      <PageHeader
        compact
        eyebrow={
          quote && !wide ? (
            <div className="flex items-center justify-between gap-2">
              {accountLink}
              <Button variant="ghost" size="sm" className="-mr-2 shrink-0 text-foreground" onClick={() => setPreviewOpen(true)}>
                <Eye aria-hidden="true" />
                {t('commercial.editor.clientCopyShort')}
              </Button>
            </div>
          ) : (
            accountLink
          )
        }
        title={title}
        actions={
          quote && wide ? (
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye aria-hidden="true" />
              {t('commercial.editor.clientCopy')}
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-caption">
          {quote ? <QuoteStatusBadge status={quote.status} /> : null}
          {quote ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-medium tabular text-foreground">{quote.code}</span>
              {quote.versions.length > 1 ? (
                <VersionSwitcher
                  currentId={quote.id}
                  versions={quote.versions}
                  hrefFor={(id) => `/app/commercial/quotes/${id}`}
                  label={t('commercial.editor.versions')}
                />
              ) : (
                <span className="tabular">{t('commercial.quote.versionShort', { version: quote.version })}</span>
              )}
            </span>
          ) : null}
          {quote ? (
            <span className="tabular">
              {t('commercial.quote.validUntil', { date: formatDate(quote.valid_until) })}
              {quote.status === 'draft' || quote.status === 'pending_approval' || quote.status === 'sent' ? ` · ${formatRelativeDays(daysLeft)}` : ''}
            </span>
          ) : null}
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground" role="status">
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              {t('commercial.editor.unsavedShort')}
            </span>
          ) : null}
        </div>
      </PageHeader>

      {quote ? (
        <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
          <SheetContent side="right" mobileFullScreen className="bg-background md:max-w-3xl lg:max-w-4xl">
            <SheetHeader className="border-b border-border/70">
              <SheetTitle>{t('commercial.editor.clientCopyTitle')}</SheetTitle>
              <SheetDescription>{dirty ? t('commercial.editor.clientCopyUnsaved') : t('commercial.editor.clientCopyDescription')}</SheetDescription>
            </SheetHeader>
            <SheetBody className="pt-4 md:pt-6">
              <QuoteDocument quote={quote} audience="client" />
            </SheetBody>
            <SheetFooter>
              <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={() => printQuote(quote)}>
                <Printer aria-hidden="true" />
                {t('commercial.print')}
              </Button>
            </SheetFooter>
            {previewOpen ? <QuotePrintArea quote={quote} audience="client" /> : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
