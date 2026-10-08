import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cx } from './cx';

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** right side of the header row (links, small ghost buttons) */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** extra classes for the header row */
  headerClassName?: string;
  id?: string;
  /**
   * List mode: the body has no side padding and every direct child becomes a full-width row
   * (`px-4 sm:px-5 py-3.5`) separated by a hairline — DESIGN §4 "lists inside cards".
   */
  divided?: boolean;
  /** body without any padding (tables, media, custom lists that pad themselves) */
  flush?: boolean;
  /** footer bar under a hairline ("Xem tất cả" link, summary) */
  footer?: ReactNode;
  /** heading level of the title (default h2) */
  as?: 'h2' | 'h3';
}

/** Card with an optional header row (title, description, actions), body, and optional footer. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
  id,
  divided = false,
  flush = false,
  footer,
  as: Heading = 'h2',
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);
  const bodyClass = divided
    ? cx(
        'divide-y divide-border/60 [&>*]:px-4 [&>*]:py-3.5 sm:[&>*]:px-5',
        hasHeader ? 'mt-3 border-t border-border/60' : '',
        footer ? '' : 'pb-1',
      )
    : flush
      ? hasHeader
        ? 'pt-3'
        : ''
      : cx('px-4 pb-4 sm:px-5 sm:pb-5', hasHeader ? 'pt-3' : 'pt-4 sm:pt-5');
  return (
    // min-w-0: safe as a grid/flex child (truncated rows inside must not widen the page)
    <Card id={id} className={cx('min-w-0 rounded-xl border border-border/70 bg-card shadow-card', className)}>
      {hasHeader ? (
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          {/* title row: the title keeps its one-line width (basis-auto) — actions that do not fit beside it wrap
              under it instead of squeezing it; the description runs full width under the row, never squeezed.
              items-center: a small action (44px touch target, 32px mouse) sits level with the 24px title line */}
          <div className={cx('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', headerClassName)}>
            {title ? (
              <Heading className="min-w-0 flex-1 basis-auto text-heading font-semibold tracking-tightish text-ink">{title}</Heading>
            ) : (
              <span className="flex-1" aria-hidden="true" />
            )}
            {actions ? <div className="-my-1 flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
          </div>
          {description ? <p className="mt-0.5 text-caption">{description}</p> : null}
        </div>
      ) : null}
      <div className={cx(bodyClass, contentClassName)}>{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3 text-table sm:px-5">{footer}</div>
      ) : null}
    </Card>
  );
}
