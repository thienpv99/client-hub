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

/** Icon in two concentric soft circles (DESIGN §4 empty state): 72px tinted halo, 48px white disc. */
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
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-full', compact ? 'h-14 w-14' : 'h-18 w-18', halo.outer, className)}
      aria-hidden="true"
    >
      <span
        className={cx(
          'flex items-center justify-center rounded-full bg-card shadow-xs ring-1 ring-inset',
          compact ? 'h-10 w-10' : 'h-12 w-12',
          halo.inner,
        )}
      >
        {renderIconProp(icon, fallback, compact ? 'h-5 w-5' : 'h-6 w-6')}
      </span>
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
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-12',
        className,
      )}
    >
      <EmptyIcon icon={icon} compact={compact} />
      <div className="max-w-md space-y-1">
        <p className={cx('text-balance text-ink', compact ? 'text-table font-medium' : 'text-heading font-semibold tracking-tightish')}>{title}</p>
        {description ? <p className="text-balance text-table text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
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
