// Print support for QuoteDocument. <QuotePrintArea> renders a second copy of the document into a body-level host
// that is hidden on screen; while printing, every other child of <body> (the app, toasts, dialogs) is hidden, so
// window.print() → "Save as PDF" gives one clean quote page whatever screen it was started from.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QuoteDetail } from '@/services/contract';
import { QuoteDocument } from './QuoteDocument';

const HOST_ATTR = 'data-quote-print';

const PRINT_CSS = `
[${HOST_ATTR}] { display: none; }
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  html, body { background: rgb(var(--card)) !important; }
  body > *:not([${HOST_ATTR}]) { display: none !important; }
  body > [${HOST_ATTR}] { display: block !important; }
  [${HOST_ATTR}] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export interface QuotePrintAreaProps {
  quote: QuoteDetail;
  audience: 'client' | 'internal';
}

/** Mount once on a screen that offers "In / Xuất PDF". */
export function QuotePrintArea({ quote, audience }: QuotePrintAreaProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute(HOST_ATTR, '');
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);
  if (!host) return null;
  return createPortal(
    <>
      <style>{PRINT_CSS}</style>
      <QuoteDocument quote={quote} audience={audience} />
    </>,
    host,
  );
}

/** Opens the browser print dialog; the PDF file name follows the quote code and version. */
export function printQuote(quote: Pick<QuoteDetail, 'code' | 'version'>): void {
  const previous = document.title;
  document.title = `${quote.code}-v${quote.version}`;
  const restore = () => {
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
  // browsers without a blocking print dialog / afterprint
  window.setTimeout(restore, 1000);
}
