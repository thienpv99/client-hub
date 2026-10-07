// Clean printable quote page (A4-like card, reading width). Owner: commercial.
// audience 'client' never reads cost, margin or internal notes; 'internal' adds them in a lock box that is not printed.
// Print: pair with <QuotePrintArea> (./QuotePrint) so "In / Xuất PDF" prints only this page.
import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import type { QuoteDetail, QuoteLineView, UserRef } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

export interface QuoteDocumentProps {
  quote: QuoteDetail;
  audience: 'client' | 'internal';
  /** false when the page right above already shows the quote title as its heading (the print copy keeps it) */
  showTitle?: boolean;
  className?: string;
}

function pct(v: number): string {
  return `${formatNumber(Math.round(v * 10) / 10)}%`;
}

/** amount of the line before the discount on the total and before VAT */
function lineAmount(l: QuoteLineView): number {
  return l.subtotal - l.discount_amount;
}

function unit(l: QuoteLineView): string {
  return t(`enums.priceUnit.${l.unit}`);
}

function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-micro font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-table font-medium text-foreground">{children}</dd>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-table text-muted-foreground">{label}</dt>
      <dd className="whitespace-nowrap text-right text-table tabular text-foreground">{value}</dd>
    </div>
  );
}

function PersonBlock({ person }: { person: UserRef | null }) {
  if (!person) return null;
  return (
    <div className="space-y-0.5 text-table">
      <p className="font-semibold text-foreground">{person.full_name}</p>
      {person.title ? <p className="text-muted-foreground">{person.title}</p> : null}
      <p className="text-muted-foreground">{person.email}</p>
      {person.phone ? <p className="tabular text-muted-foreground">{person.phone}</p> : null}
    </div>
  );
}

export function QuoteDocument({ quote, audience, showTitle = true, className }: QuoteDocumentProps) {
  const issued = dateOf(quote.sent_at ?? quote.updated_at);
  const totals = quote.totals;
  const goodsTotal = totals.subtotal - totals.line_discount;
  const representative = quote.sent_by ?? quote.created_by;
  const accepted = quote.status === 'accepted' && quote.client_decided_by && quote.client_decided_at;
  const hasLineDiscount = quote.lines.some((l) => l.discount_pct > 0);

  return (
    <article
      aria-label={t('commercial.doc.ariaLabel', { code: quote.code, version: quote.version })}
      className={cn(
        'mx-auto w-full max-w-reading rounded-xl border border-border/70 bg-card text-foreground shadow-card',
        'print:max-w-none print:rounded-none print:border-0 print:shadow-none',
        className,
      )}
    >
      <div className="p-5 sm:p-8 print:p-0">
        <header className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <NewEraLogo size="md" withText />
            <p className="text-caption">{t('commercial.doc.issuer')}</p>
          </div>
          <div className="text-right">
            <p className="text-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('commercial.doc.kind')}</p>
            <p className="mt-0.5 text-heading font-semibold tabular tracking-tightish text-ink">{quote.code}</p>
            <p className="text-caption">{t('commercial.doc.version', { version: quote.version })}</p>
          </div>
        </header>

        {showTitle ? (
          <h2 className="mt-8 break-words text-title font-semibold tracking-tightish text-ink sm:text-display sm:tracking-display">{quote.title}</h2>
        ) : (
          <h2 className="sr-only">{quote.title}</h2>
        )}

        <dl
          className={cn(
            'grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-subtle p-4 ring-1 ring-inset ring-border/60 sm:grid-cols-4 print:bg-card',
            showTitle ? 'mt-5' : 'mt-6',
          )}
        >
          <Meta label={t('commercial.doc.to')} className="col-span-2 sm:col-span-1">
            {quote.account.name}
          </Meta>
          <Meta label={t('commercial.doc.issued')}>
            <span className="tabular">{formatDate(issued)}</span>
          </Meta>
          <Meta label={t('commercial.doc.validUntil')}>
            <span className="tabular">{formatDate(quote.valid_until)}</span>
          </Meta>
          <Meta label={t('commercial.doc.grandTotal')} className="col-span-2 sm:col-span-1">
            <span className="tabular">{formatMoney(totals.grand_total)}</span>
          </Meta>
        </dl>

        {/* lines: a table from md (and always when printing), stacked rows on phones */}
        <table className="mt-8 hidden w-full border-collapse text-table tabular md:table print:table">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="w-9 pb-2 pr-2 text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.no')}
              </th>
              <th scope="col" className="pb-2 pr-3 text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.item')}
              </th>
              <th scope="col" className="whitespace-nowrap pb-2 pr-3 text-right text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.qty')}
              </th>
              <th scope="col" className="whitespace-nowrap pb-2 pr-3 text-right text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.unitPrice')}
              </th>
              {hasLineDiscount ? (
                <th scope="col" className="whitespace-nowrap pb-2 pr-3 text-right text-micro font-medium text-muted-foreground">
                  {t('commercial.doc.col.discount')}
                </th>
              ) : null}
              <th scope="col" className="whitespace-nowrap pb-2 pr-3 text-right text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.vat')}
              </th>
              <th scope="col" className="whitespace-nowrap pb-2 text-right text-micro font-medium text-muted-foreground">
                {t('commercial.doc.col.amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l, i) => (
              <tr key={l.id} className="break-inside-avoid border-b border-border/60 align-top">
                <td className="py-3 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-3 pr-3">
                  <p className="font-medium text-foreground">{l.name}</p>
                  {l.description ? <p className="text-muted-foreground">{l.description}</p> : null}
                  <p className="text-caption">{l.code}</p>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-right">
                  {formatNumber(l.qty)} <span className="text-muted-foreground">{unit(l)}</span>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-right">{formatMoney(l.unit_price)}</td>
                {hasLineDiscount ? (
                  <td className="whitespace-nowrap py-3 pr-3 text-right">{l.discount_pct > 0 ? pct(l.discount_pct) : '—'}</td>
                ) : null}
                <td className="whitespace-nowrap py-3 pr-3 text-right">{pct(l.vat_rate)}</td>
                <td className="whitespace-nowrap py-3 text-right font-medium text-foreground">{formatMoney(lineAmount(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ol className="mt-6 divide-y divide-border/60 border-y border-border/60 md:hidden print:hidden">
          {quote.lines.map((l, i) => (
            <li key={l.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium text-foreground">
                  <span className="mr-1.5 text-muted-foreground tabular">{i + 1}.</span>
                  {l.name}
                </p>
                <p className="shrink-0 font-semibold tabular text-ink">{formatMoney(lineAmount(l))}</p>
              </div>
              {l.description ? <p className="mt-0.5 text-table text-muted-foreground">{l.description}</p> : null}
              <p className="mt-1 text-caption tabular">
                {t('commercial.doc.mobileLine', { qty: formatNumber(l.qty), unit: unit(l), price: formatMoney(l.unit_price) })}
                {l.discount_pct > 0 ? ` · ${t('commercial.doc.mobileDiscount', { pct: pct(l.discount_pct) })}` : ''}
                {` · ${t('commercial.doc.mobileVat', { pct: pct(l.vat_rate) })}`}
              </p>
            </li>
          ))}
        </ol>
        {quote.lines.length === 0 ? <p className="mt-6 text-table text-muted-foreground">{t('commercial.doc.noLines')}</p> : null}

        <div className="mt-6 flex justify-end">
          <dl className="w-full space-y-2 sm:w-[22rem]">
            {totals.header_discount > 0 ? (
              <>
                <TotalRow label={t('commercial.doc.goodsTotal')} value={formatMoney(goodsTotal)} />
                <TotalRow
                  label={t('commercial.doc.headerDiscount', { pct: pct(quote.discount_pct_total) })}
                  value={`−${formatMoney(totals.header_discount)}`}
                />
              </>
            ) : null}
            <TotalRow label={t('commercial.doc.netBeforeVat')} value={formatMoney(totals.net_before_vat)} />
            <TotalRow label={t('commercial.doc.vat')} value={formatMoney(totals.vat)} />
            <div className="!mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
              <dt className="text-table font-semibold text-foreground">{t('commercial.doc.grandTotalVat')}</dt>
              <dd className="whitespace-nowrap text-right text-title font-semibold tabular tracking-tightish text-ink sm:text-display sm:tracking-display">
                {formatMoney(totals.grand_total)}
              </dd>
            </div>
          </dl>
        </div>

        {quote.notes ? (
          <section className="mt-8 break-inside-avoid">
            <h3 className="text-table font-semibold text-foreground">{t('commercial.doc.notes')}</h3>
            <p className="mt-1 whitespace-pre-line text-table text-muted-foreground">{quote.notes}</p>
          </section>
        ) : null}

        <section className="mt-6 break-inside-avoid">
          <h3 className="text-table font-semibold text-foreground">{t('commercial.doc.terms')}</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-table text-muted-foreground marker:text-caption">
            <li>{t('commercial.doc.termCurrency')}</li>
            <li>{t('commercial.doc.termValidity', { date: formatDate(quote.valid_until) })}</li>
            <li>{t('commercial.doc.termVat')}</li>
          </ul>
        </section>

        <section className="mt-10 grid break-inside-avoid gap-8 border-t border-border/60 pt-6 sm:grid-cols-2">
          <div>
            <h3 className="text-micro font-medium text-muted-foreground">{t('commercial.doc.forNewEra')}</h3>
            <div className="mt-2">
              <PersonBlock person={representative} />
            </div>
          </div>
          <div>
            <h3 className="text-micro font-medium text-muted-foreground">{t('commercial.doc.forClient', { name: quote.account.name })}</h3>
            {accepted ? (
              <div className="mt-2 space-y-1 text-table">
                <p className="inline-flex items-center gap-1.5 font-medium text-success">
                  <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('commercial.doc.acceptedOnline')}
                </p>
                <p className="text-foreground">
                  {t('commercial.doc.acceptedBy', {
                    name: quote.client_decided_by?.full_name ?? '',
                    date: formatDate(quote.client_decided_at ?? ''),
                  })}
                </p>
              </div>
            ) : (
              <div className="mt-12 border-t border-dashed border-border-strong pt-2 text-caption">{t('commercial.doc.signHere')}</div>
            )}
          </div>
        </section>

        {audience === 'internal' && (quote.internal_note || quote.totals.cost_total !== undefined) ? (
          <div className="mt-8 print:hidden">
            <InternalNoteBox>
              {quote.internal_note ? <p className="whitespace-pre-line">{quote.internal_note}</p> : null}
              {quote.totals.cost_total !== undefined ? (
                <p className={cn('tabular', quote.internal_note ? 'mt-1' : '')}>
                  {t('commercial.doc.internalCost', {
                    cost: formatMoney(quote.totals.cost_total),
                    margin: formatMoney(quote.totals.margin ?? 0),
                    pct: pct(quote.totals.margin_pct ?? 0),
                  })}
                </p>
              ) : null}
            </InternalNoteBox>
          </div>
        ) : null}
      </div>
    </article>
  );
}
