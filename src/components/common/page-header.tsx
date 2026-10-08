import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { t } from '@/i18n';
import { cx } from './cx';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** buttons on the right (primary last); they wrap below the title on mobile (see ctionsInline) */
  actions?: ReactNode;
  /**
   * phones: keep ctions on the title row (right of the h1, the description under both at full width) instead of
   * a row of their own — for a single short action ("Tạo báo giá", "Bản tin tuần"), so the tabs and the focal list
   * start ~60px higher. From sm the layout is the same either way.
   */
  actionsInline?: boolean;
  /**
   * back link above the title: a path, or { to, label } (label defaults to "Quay lại"). Not rendered inside the
   * internal app frame (see PageHeaderBackContext): its top bar already shows the way back.
   */
  back?: string | { to: string; label?: ReactNode };
  /** small line above the title: breadcrumb, date ("Thứ Hai, 06/10/2026"), section name */
  eyebrow?: ReactNode;
  /** extra content under the title row (badges, meta line…) */
  children?: ReactNode;
  /** underline tabs directly under the header (full-bleed bottom border comes from the tabs) */
  tabs?: ReactNode;
  /** detail pages: `text-title` title instead of `text-display` */
  compact?: boolean;
  className?: string;
}

/**
 * className for underline page tabs in the `tabs` slot of an internal page (DESIGN §3 "full-bleed border"): the strip
 * and its hairline run to the edges of the content column (main pads px-4 / md:px-6 / xl:px-8).
 */
export const PAGE_TABS_BLEED = '-mx-4 w-auto max-w-none px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8';

/**
 * false inside an app frame whose top bar already offers the way back (internal app: breadcrumbs from md,
 * "‹ section" on phones), where a `back` link would only repeat it. The client portal has no breadcrumbs and keeps it.
 */
export const PageHeaderBackContext = createContext(true);

export function PageHeader({
  title,
  description,
  actions,
  actionsInline = false,
  back,
  eyebrow,
  children,
  tabs,
  compact = false,
  className,
}: PageHeaderProps) {
  const inline = actionsInline && !!actions;
  const backAllowed = useContext(PageHeaderBackContext);
  const backTo = !backAllowed ? undefined : typeof back === 'string' ? back : back?.to;
  const backLabel = typeof back === 'object' && back.label ? back.label : t('components.pageHeader.back');
  return (
    <header className={cx('flex flex-col gap-3', className)}>
      {backTo ? (
        <Link
          to={backTo}
          className="touch-tap -ml-1.5 inline-flex min-h-tap w-fit items-center gap-1 rounded-lg py-1 pl-1 pr-2 text-table font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-h-0"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div
        className={cx(
          'sm:flex sm:flex-row sm:items-end sm:justify-between sm:gap-6',
          // inline (phones): a 2-column grid — eyebrow and description span both columns, the actions fill the free
          // cell beside the title (dense packing), so the DOM / reading order stays title → description → actions
          inline ? 'grid grid-flow-row-dense grid-cols-[minmax(0,1fr)_auto] gap-x-3' : 'flex flex-col gap-4',
        )}
      >
        <div className={inline ? 'contents sm:block sm:min-w-0' : 'min-w-0'}>
          {eyebrow ? <div className="col-span-2 mb-1.5 text-caption font-medium">{eyebrow}</div> : null}
          <h1
            className={cx(
              'min-w-0 break-words font-semibold text-ink',
              compact ? 'text-title tracking-tightish' : 'text-title tracking-tightish md:text-display md:tracking-display',
              // level with the (44px) action beside it
              inline && 'self-center',
            )}
          >
            {title}
          </h1>
          {description ? <div className="col-span-2 mt-1.5 max-w-3xl text-pretty text-body text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? (
          <div className={cx('flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end', inline && 'justify-end self-center')}>{actions}</div>
        ) : null}
      </div>
      {children}
      {tabs ? <div className="mt-1">{tabs}</div> : null}
    </header>
  );
}
