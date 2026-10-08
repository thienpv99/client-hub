import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cx } from './cx';

export type IconProp = LucideIcon | ReactNode;

/** Accepts a lucide component (`icon={Inbox}`) or an element (`icon={<Inbox />}`). */
export function renderIconProp(icon: IconProp | undefined, fallback: LucideIcon, className: string): ReactNode {
  if (icon === undefined || icon === null || icon === false) {
    const Fallback = fallback;
    return <Fallback className={className} aria-hidden="true" />;
  }
  if (isValidElement(icon)) return icon;
  // lucide icons are forwardRef objects ({ $$typeof, render }), not plain functions
  if (typeof icon === 'function' || (typeof icon === 'object' && '$$typeof' in icon)) {
    const Icon = icon as unknown as LucideIcon;
    return <Icon className={className} aria-hidden="true" />;
  }
  return icon as ReactNode;
}

export type EmptyIconTone = 'primary' | 'neutral' | 'danger';

const HALO: Record<EmptyIconTone, { outer: string; inner: string }> = {
  primary: { outer: 'bg-primary-soft', inner: 'text-primary ring-primary-border/70' },
  neutral: { outer: 'bg-muted', inner: 'text-muted-foreground ring-border' },
  danger: { outer: 'bg-danger-soft', inner: 'text-danger ring-danger/20' },
};

/** Monochrome tints of the 96px illustration, per tone (token classes only). */
const ART: Record<EmptyIconTone, { halo: string; line: string; dot: string; dotStrong: string; bar: string }> = {
  primary: { halo: 'fill-primary-soft', line: 'stroke-primary-border', dot: 'fill-chart-3', dotStrong: 'fill-chart-2', bar: 'fill-chart-4' },
  neutral: { halo: 'fill-muted', line: 'stroke-border-strong', dot: 'fill-border-strong', dotStrong: 'fill-caption/40', bar: 'fill-muted' },
  danger: { halo: 'fill-danger-soft', line: 'stroke-danger/20', dot: 'fill-danger/20', dotStrong: 'fill-danger/35', bar: 'fill-danger-soft' },
};

/**
 * The 96px empty-state illustration (DESIGN.md §8.7): a soft halo with a dotted orbit, two quiet "cards" peeking out
 * and a few satellites — monochrome in the tone's tints — around the icon in a white disc. Decorative (aria-hidden).
 */
function EmptyArt({ tone, children, className }: { tone: EmptyIconTone; children: ReactNode; className?: string }) {
  const art = ART[tone];
  return (
    <span className={cx('relative flex h-24 w-24 shrink-0 items-center justify-center', className)} aria-hidden="true">
      <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full" focusable="false">
        <circle cx="48" cy="48" r="46" className={art.halo} />
        <circle cx="48" cy="48" r="35" fill="none" strokeWidth="1" strokeDasharray="1.5 4.5" strokeLinecap="round" className={art.line} />
        <g strokeWidth="1">
          <rect x="8.5" y="36.5" width="25" height="15" rx="4" className={cx('fill-card', art.line)} />
          <rect x="13" y="41.5" width="11" height="2" rx="1" className={art.dot} />
          <rect x="13" y="45.5" width="7" height="1.5" rx="0.75" className={art.bar} />
          <rect x="62.5" y="54.5" width="25" height="15" rx="4" className={cx('fill-card', art.line)} />
          <rect x="67" y="59.5" width="12" height="2" rx="1" className={art.dot} />
          <rect x="67" y="63.5" width="8" height="1.5" rx="0.75" className={art.bar} />
        </g>
        <circle cx="71" cy="19" r="2.5" className={art.dotStrong} />
        <circle cx="81" cy="38" r="1.5" className={art.dot} />
        <circle cx="23" cy="75" r="2" className={art.dot} />
        <circle cx="17" cy="25" r="1.25" className={art.dotStrong} />
      </svg>
      {children}
    </span>
  );
}

/**
 * Empty / error icon. Default: the 96px illustration with the icon in a 48px white disc (DESIGN §4 + §8.7).
 * `compact` (inside cards and drawers): 56px tinted halo with a 40px white disc.
 */
export function EmptyIcon({
  icon,
  fallback = Inbox,
  tone = 'primary',
  compact = false,
  className,
}: {
  icon?: IconProp;
  fallback?: LucideIcon;
  tone?: EmptyIconTone;
  compact?: boolean;
  className?: string;
}) {
  const halo = HALO[tone];
  const disc = (
    <span
      className={cx(
        'relative flex items-center justify-center rounded-full bg-card shadow-xs ring-1 ring-inset',
        compact ? 'h-10 w-10' : 'h-12 w-12 shadow-card-hover',
        halo.inner,
      )}
    >
      {renderIconProp(icon, fallback, compact ? 'h-5 w-5' : 'h-[22px] w-[22px]')}
    </span>
  );
  if (!compact) return <EmptyArt tone={tone} className={className}>{disc}</EmptyArt>;
  return (
    <span
      className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-full', halo.outer, className)}
      aria-hidden="true"
    >
      {disc}
    </span>
  );
}

export interface EmptyStateProps {
  icon?: IconProp;
  /** a natural sentence: "Hiện không có việc nào cần anh xử lý." */
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** tighter padding for use inside cards / drawers */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-8' : 'gap-5 px-6 py-12 md:py-14',
        className,
      )}
    >
      <EmptyIcon icon={icon} compact={compact} />
      <div className={cx('max-w-md', compact ? 'space-y-1' : 'space-y-1.5')}>
        <p className={cx('text-balance text-ink', compact ? 'text-table font-medium' : 'text-heading font-semibold tracking-tightish')}>{title}</p>
        {description ? <p className="mx-auto max-w-sm text-balance text-table text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export type SearchEntity =
  | 'account'
  | 'project'
  | 'task'
  | 'lead'
  | 'target'
  | 'opportunity'
  | 'quote'
  | 'contract'
  | 'price'
  | 'user'
  | 'document'
  | 'notification'
  | 'email';

export interface SearchEmptyStateProps {
  /** what the list holds — named in the sentence ("Không tìm thấy khách hàng nào cho “abc”.") */
  entity: SearchEntity;
  /** the search text; empty → the filters alone hid everything ("Không có … nào khớp với bộ lọc đang chọn.") */
  query?: string | null;
  /** "Bỏ lọc": clears the search and the filters */
  onClear?: () => void;
  /** icon when only filters are set (a search always shows SearchX) */
  icon?: IconProp;
  compact?: boolean;
  className?: string;
}

/**
 * The one "nothing matches" state of every list (search and / or filters): same sentence, same hint, same "Bỏ lọc".
 * The "no data at all" state stays the list's own EmptyState.
 */
export function SearchEmptyState({ entity, query, onClear, icon, compact = false, className }: SearchEmptyStateProps) {
  const q = (query ?? '').trim();
  const noun = t(`components.emptySearch.entity.${entity}`);
  return (
    <EmptyState
      icon={q ? SearchX : (icon ?? SearchX)}
      compact={compact}
      className={className}
      title={q ? t('components.emptySearch.title', { entity: noun, query: q }) : t('components.emptySearch.filtered', { entity: noun })}
      description={t('components.emptySearch.hint')}
      action={
        onClear ? (
          <Button type="button" variant="secondary" size={compact ? 'sm' : 'default'} onClick={onClear}>
            {t('components.emptySearch.clear')}
          </Button>
        ) : undefined
      }
    />
  );
}
