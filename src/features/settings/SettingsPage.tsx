// /app/settings/:tab? — Cài đặt (SPEC §4.6). Vertical section nav from xl (1280; at 1024 the app sidebar is open),
// an underline tab strip under the page header below; the tab is the URL segment. Director edits; an AM sees the
// same screens read-only (and may invite client users). Phones hide the header description (the strip lists the sections).
import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eye, Route, SlidersHorizontal, Tags, UserPlus, Users } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Viewer } from '@/services/contract';
import { useMediaQuery } from '@/hooks/useMedia';
import { useViewer } from '@/hooks/useViewer';
import { PageHeader } from '@/components/common/page-header';
import { cn } from '@/components/ui/cn';
import { SCROLL_FADE_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { t } from '@/i18n';
import { InvitesTab } from './InvitesTab';
import { PricingTab } from './PricingTab';
import { RulesTab } from './RulesTab';
import { TemplatesTab } from './TemplatesTab';
import { UsersTab } from './UsersTab';

const TABS = ['users', 'invites', 'templates', 'pricing', 'rules'] as const;
export type SettingsTab = (typeof TABS)[number];

const ICONS: Record<SettingsTab, LucideIcon> = {
  users: Users,
  invites: UserPlus,
  templates: Route,
  pricing: Tags,
  rules: SlidersHorizontal,
};

/** form-like sections read best at reading width; the user list uses the whole column */
const READING: Record<SettingsTab, boolean> = { users: false, invites: true, templates: false, pricing: true, rules: true };

function isTab(value: string): value is SettingsTab {
  return (TABS as readonly string[]).includes(value);
}

export function settingsPath(tab: SettingsTab): string {
  return tab === 'users' ? '/app/settings' : `/app/settings/${tab}`;
}

/** < xl: underline strip under the header (same look as the kit's page tabs; these are links, one per URL) */
function SettingsStrip({ active }: { active: SettingsTab }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollFade(ref);

  // keep the current tab in view when the strip scrolls (phones). Re-checked when the strip resizes: the first layout
  // pass may happen before styles and fonts are in, when nothing overflows yet.
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const reveal = () => {
      const current = strip.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current || strip.scrollWidth <= strip.clientWidth) return;
      const left = current.offsetLeft;
      if (left < strip.scrollLeft || left + current.offsetWidth > strip.scrollLeft + strip.clientWidth) {
        strip.scrollTo({ left: Math.max(0, left - 16) });
      }
    };
    reveal();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
    observer?.observe(strip);
    return () => observer?.disconnect();
  }, [active]);

  return (
    <nav aria-label={t('settings.nav.label')}>
      <div
        ref={ref}
        className={cn(
          'no-scrollbar relative -mx-4 flex items-stretch gap-1 overflow-x-auto px-4 shadow-[inset_0_-1px_0_0_rgb(var(--border))] md:-mx-6 md:gap-2 md:px-6',
          SCROLL_FADE_CLASS,
        )}
      >
        {TABS.map((tab) => {
          const current = tab === active;
          return (
            <Link
              key={tab}
              to={settingsPath(tab)}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'touch-tap relative inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-t-md px-3 text-table font-medium transition-colors duration-150 ease-out-quart',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                'after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors after:duration-150',
                current ? 'text-foreground after:bg-primary' : 'text-muted-foreground hover:text-foreground hover:after:bg-border-strong',
              )}
            >
              {t(`settings.navShort.${tab}`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** ≥ xl: vertical section list beside the content */
function SettingsSideNav({ active }: { active: SettingsTab }) {
  return (
    <nav aria-label={t('settings.nav.label')} className="sticky top-[88px]">
      <ul className="space-y-0.5">
        {TABS.map((tab) => {
          const Icon = ICONS[tab];
          const current = tab === active;
          return (
            <li key={tab}>
              <Link
                to={settingsPath(tab)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'touch-tap flex h-9 items-center gap-3 rounded-lg px-3 text-table font-medium transition-colors duration-150 ease-out-quart',
                  current ? 'bg-card text-ink shadow-segment' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', current ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                <span className="truncate">{t(`settings.nav.${tab}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabBody({ tab, viewer }: { tab: SettingsTab; viewer: Viewer }) {
  const isDirector = viewer.role === 'director' && !viewer.read_only;
  switch (tab) {
    case 'users':
      return <UsersTab viewer={viewer} />;
    case 'invites':
      return <InvitesTab viewer={viewer} />;
    case 'templates':
      return <TemplatesTab />;
    case 'pricing':
      return <PricingTab canViewCost={viewer.can_view_cost} />;
    case 'rules':
      return <RulesTab canEdit={isDirector} />;
    default:
      return null;
  }
}

export function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const viewer = useViewer();
  const wide = useMediaQuery('(min-width: 1280px)');

  if (tab !== undefined && (!isTab(tab) || tab === 'users')) {
    // unknown segment → default tab; '/users' → its canonical short path
    return <Navigate to="/app/settings" replace />;
  }
  if (!viewer) return null;

  const active: SettingsTab = tab ?? 'users';
  const readOnly = viewer.role !== 'director' && (active === 'users' || active === 'rules');
  // a viewer without "Được xem giá vốn" is not told about cost prices they cannot open
  const descriptionKey =
    active === 'pricing' && !viewer.can_view_cost ? 'settings.tabs.pricing.descriptionNoCost' : `settings.tabs.${active}.description`;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={t('settings.page.title')}
        description={<span className="hidden sm:inline">{t('settings.page.description')}</span>}
        tabs={wide ? undefined : <SettingsStrip active={active} />}
      />
      <div className={cn(wide && 'grid grid-cols-[13rem_minmax(0,1fr)] items-start gap-10')}>
        {wide ? <SettingsSideNav active={active} /> : null}
        <section aria-labelledby="settings-section-title" className={cn('min-w-0 space-y-5', READING[active] && 'max-w-reading')}>
          <header>
            {/* below xl the tab strip already names the section */}
            <h2 id="settings-section-title" className={cn('text-title font-semibold tracking-tightish text-ink', !wide && 'sr-only')}>
              {t(`settings.tabs.${active}.title`)}
            </h2>
            <p className={cn('text-table text-muted-foreground', wide && 'mt-1')}>{t(descriptionKey)}</p>
          </header>
          {readOnly ? (
            <p className="flex items-start gap-2.5 rounded-lg bg-subtle p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/60">
              <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t(`settings.readOnly.${active}`)}</span>
            </p>
          ) : null}
          <TabBody key={active} tab={active} viewer={viewer} />
        </section>
      </div>
    </div>
  );
}
