// Internal navigation pieces (DESIGN §3): full sidebar (≥1024), icon rail (768–1023), phone sheet menu (<768).
import { Fragment, useRef } from 'react';
import { Link, NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import { Search } from 'lucide-react';
import { NewEraMark } from '@/components/common/new-era-logo';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSlidingIndicator } from '@/components/ui/use-sliding-indicator';
import { UserMenu } from '@/features/shell/UserMenu';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { groupNav, type NavItem } from './navItems';
import { navBadgeFor, type NavBadge, type NavCounts } from './useNavCounts';

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** New Era mark + "New Era / Client Hub" — the workspace identity at the top of the sidebar and the phone menu. */
export function WorkspaceBlock({ home, className }: { home: string; className?: string }) {
  return (
    <Link
      to={home}
      className={cn(
        'touch-tap -mx-1.5 flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 hover:bg-muted',
        className,
      )}
    >
      <NewEraMark className="h-7 w-7 rounded-lg" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-table font-semibold tracking-tightish text-ink">{t('common.companyName')}</span>
        <span className="block truncate text-micro text-muted-foreground">{t('layout.brand')}</span>
      </span>
    </Link>
  );
}

/** Search trigger that looks like an input ("Tìm nhanh…" + Ctrl K). */
export function SearchField({ onOpen, className, showKbd = true }: { onOpen(): void; className?: string; showKbd?: boolean }) {
  const shortcut = isMacPlatform() ? '⌘' : 'Ctrl';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        'touch-tap flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-subtle px-2.5 text-caption shadow-xs transition-colors duration-150 ease-out-quart hover:border-border-strong hover:bg-card',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{t('layout.search.trigger')}</span>
      {showKbd ? (
        <Kbd className="bg-card">
          {shortcut}
          <span className="sr-only"> </span>K
        </Kbd>
      ) : null}
    </button>
  );
}

function CountPill({ badge, active }: { badge: NavBadge; active: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-micro font-medium tabular',
          badge.tone === 'danger'
            ? 'bg-danger-soft text-danger'
            : active
              ? 'bg-card text-primary'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {badgeText(badge.count)}
      </span>
      <span className="sr-only">{`, ${t(badge.labelKey, { count: badge.count })}`}</span>
    </>
  );
}

function SidebarLink({ item, badge, size }: { item: NavItem; badge: NavBadge | null; size: 'sidebar' | 'sheet' }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 font-medium transition-colors duration-150 ease-out-quart',
          size === 'sidebar' ? 'touch-tap h-9 text-table' : 'min-h-tap text-body',
          // the active fill is the nav's sliding pill once it is placed (GroupedNav); until then the link draws it
          isActive
            ? 'bg-primary-soft text-primary group-data-[indicator=ready]/nav:bg-transparent'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
              isActive ? 'text-primary' : 'text-caption group-hover:text-foreground',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          {badge ? <CountPill badge={badge} active={isActive} /> : null}
        </>
      )}
    </NavLink>
  );
}

/** Grouped list with section labels — sidebar and phone sheet. */
export function GroupedNav({
  items,
  counts,
  size,
  className,
}: {
  items: NavItem[];
  counts: NavCounts;
  size: 'sidebar' | 'sheet';
  className?: string;
}) {
  const sections = groupNav(items);
  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  // one soft pill glides to the current page (DESIGN.md §8.3)
  useSlidingIndicator(navRef, pillRef, { activeSelector: 'a[aria-current="page"]', itemSelector: 'a' });
  return (
    <nav ref={navRef} aria-label={t('layout.nav.main')} className={cn('group/nav relative', className)}>
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 rounded-lg bg-primary-soft opacity-0 transition-[transform,width,height] duration-250 ease-out-quart"
      />
      {sections.map((section, i) => (
        <div key={section.id} className={i === 0 ? '' : size === 'sidebar' ? 'mt-5' : 'mt-6'}>
          <p className="mb-1.5 px-3 text-micro font-medium text-muted-foreground" id={`nav-${size}-${section.id}`}>
            {t(section.labelKey)}
          </p>
          <ul aria-labelledby={`nav-${size}-${section.id}`} className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.id}>
                <SidebarLink item={item} badge={navBadgeFor(item.id, counts)} size={size} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** ≥1024: full sidebar, 248px. */
export function Sidebar({
  items,
  counts,
  home,
  onSearch,
}: {
  items: NavItem[];
  counts: NavCounts;
  home: string;
  onSearch(): void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-border/70 bg-sidebar">
      <div className="shrink-0 px-4 pb-2 pt-4">
        <WorkspaceBlock home={home} />
        <SearchField onOpen={onSearch} className="mt-4" />
      </div>
      <GroupedNav items={items} counts={counts} size="sidebar" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3" />
      <div className="shrink-0 border-t border-border/70 p-3">
        <UserMenu side="internal" variant="sidebar" />
      </div>
    </aside>
  );
}

function RailLink({ item, badge }: { item: NavItem; badge: NavBadge | null }) {
  const Icon = item.icon;
  const resolved = useResolvedPath(item.to);
  const isActive = useMatch({ path: resolved.pathname, end: item.end ?? false }) !== null;
  const full = t(item.labelKey);
  const short = t(item.shortLabelKey ?? item.labelKey);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          aria-current={isActive ? 'page' : undefined}
          aria-label={badge ? `${full}, ${t(badge.labelKey, { count: badge.count })}` : full}
          className={cn(
            'group flex w-[68px] flex-col items-center gap-1 rounded-lg py-1.5 transition-colors duration-150',
            isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span
            data-rail-pill=""
            className={cn(
              'relative flex h-8 w-12 items-center justify-center rounded-lg transition-colors duration-150 ease-out-quart',
              // the rail's sliding pill draws the active fill once placed (Rail)
              isActive ? 'bg-primary-soft group-data-[indicator=ready]/rail:bg-transparent' : 'group-hover:bg-muted/70',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} aria-hidden />
            {badge ? (
              <span
                aria-hidden
                className={cn(
                  'absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none tabular ring-2 ring-sidebar',
                  badge.tone === 'danger' ? 'bg-danger text-primary-foreground' : 'bg-primary text-primary-foreground',
                )}
              >
                {badge.count > 9 ? '9+' : badge.count}
              </span>
            ) : null}
          </span>
          <span aria-hidden className="w-full truncate text-center text-[11px] font-medium leading-3 tracking-[-0.01em]">
            {short}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{full}</TooltipContent>
    </Tooltip>
  );
}

/** 768–1023: 72px icon rail with one-line short labels + tooltips. */
export function Rail({ items, counts, home }: { items: NavItem[]; counts: NavCounts; home: string }) {
  const sections = groupNav(items);
  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  useSlidingIndicator(navRef, pillRef, { activeSelector: 'a[aria-current="page"] [data-rail-pill]', itemSelector: '[data-rail-pill]' });
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[72px] flex-col items-center border-r border-border/70 bg-sidebar">
      <div className="flex h-14 shrink-0 items-center">
        <Link
          to={home}
          className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-muted"
        >
          <NewEraMark className="h-7 w-7" label={`${t('common.companyName')} ${t('layout.brand')}`} />
        </Link>
      </div>
      <nav
        ref={navRef}
        aria-label={t('layout.nav.main')}
        className="group/rail no-scrollbar relative flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-4 pt-2"
      >
        <span
          ref={pillRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-lg bg-primary-soft opacity-0 transition-[transform,width,height] duration-250 ease-out-quart"
        />
        {sections.map((section, i) => (
          <Fragment key={section.id}>
            {i > 0 ? <span aria-hidden className="my-2 h-px w-8 shrink-0 bg-border" /> : null}
            <ul aria-label={t(section.labelKey)} className="flex flex-col items-center gap-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <RailLink item={item} badge={navBadgeFor(item.id, counts)} />
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
