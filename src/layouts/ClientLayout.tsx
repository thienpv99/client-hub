// Client portal frame (mobile-first, DESIGN §3). Tablet / desktop: 64px blurred header — client logo + "cùng New Era",
// centred nav pills, compact project selector, bell, avatar. Phone (<768): compact header + bottom tab bar.
// Portal canvas: max-w-[1120px].
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AccountLogo } from '@/components/common/account-logo';
import { NewEraMark } from '@/components/common/new-era-logo';
import { TaskDrawerHost } from '@/components/task/TaskDrawerHost';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingIntro } from '@/features/portal/OnboardingIntro';
import { NotificationBell } from '@/features/shell/NotificationBell';
import { UserMenu } from '@/features/shell/UserMenu';
import { PROJECT_PARAM, usePortalProject, usePortalShell } from '@/hooks/usePortalProject';
import { useViewer } from '@/hooks/useViewer';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { toastError } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { CLIENT_NAV, navFor, navItemForPath, type NavItem } from './navItems';
import { SkipLink } from './SkipLink';
import { ViewAsClientBanner } from './ViewAsClientBanner';

const CANVAS = 'mx-auto w-full max-w-[1120px]';

/** visual count only — the link carries the same number in an sr-only sentence */
function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-none text-primary-foreground tabular',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function ProjectSelect({ className, size = 'default' }: { className?: string; size?: 'default' | 'sm' }) {
  const { projectId, setProjectId, projects } = usePortalProject();
  if (projects.length <= 1) return null;
  return (
    <NativeSelect
      size={size}
      aria-label={t('layout.project.label')}
      value={projectId ?? ''}
      onChange={(e) => setProjectId(e.target.value || null)}
      wrapperClassName={className}
      className={size === 'sm' ? 'border-border-strong bg-card font-medium shadow-xs md:h-9' : 'border-border-strong shadow-xs'}
    >
      <option value="">{t('layout.project.all')}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function TopNavLink({ item, search, badge }: { item: NavItem; search: string; badge: number }) {
  const label = t(item.labelKey);
  return (
    <NavLink
      to={{ pathname: item.to, search }}
      end={item.end}
      className={({ isActive }) =>
        cn(
          // touch-tap: 44px on a touch screen (iPad shows this top menu), index.css
          'touch-tap inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-table font-medium transition-colors duration-150 ease-out-quart',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {label}
      {badge > 0 ? (
        <>
          <CountBadge count={badge} />
          <span className="sr-only">{t('layout.nav.tasksBadge', { count: badge })}</span>
        </>
      ) : null}
    </NavLink>
  );
}

function BottomTab({ item, search, badge }: { item: NavItem; search: string; badge: number }) {
  const Icon = item.icon;
  const label = t(item.shortLabelKey ?? item.labelKey);
  return (
    <NavLink
      to={{ pathname: item.to, search }}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-0.5 pt-1 text-[11px] font-medium leading-[14px] transition-colors duration-150 active:scale-[0.97]',
          // not `text-caption`: that class also sets a 13px font size (tailwind.config fontSize.caption)
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary transition-opacity duration-200',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className="relative">
            <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2 : 1.75} aria-hidden />
            <CountBadge count={badge} className="absolute -right-2.5 -top-1.5 ring-2 ring-card" />
          </span>
          <span className="max-w-full truncate whitespace-nowrap">{label}</span>
          {badge > 0 ? <span className="sr-only">{t('layout.nav.tasksBadge', { count: badge })}</span> : null}
        </>
      )}
    </NavLink>
  );
}

/** Pages whose content follows the selected project (home, tasks, progress, documents). Commercial and settings are
 * company-wide, so they show no project selector. */
function isProjectScoped(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '');
  return (
    path === '/portal' ||
    ['/portal/tasks', '/portal/progress', '/portal/documents'].some((p) => path === p || path.startsWith(`${p}/`))
  );
}

/** Client logo + name, thin divider, New Era mark + "cùng New Era". */
function BrandLockup({ search, nameOnPhone = true }: { search: string; nameOnPhone?: boolean }) {
  const { account } = usePortalShell();
  return (
    // the accessible name starts with what is visible: client name, then New Era (WCAG 2.5.3)
    <Link
      to={{ pathname: '/portal', search }}
      className="flex min-h-tap min-w-0 shrink-0 items-center gap-2.5 justify-self-start rounded-lg md:gap-3"
      aria-label={[account ? account.name : null, t('layout.client.with'), t('layout.nav.client.home')]
        .filter((x): x is string => !!x)
        .join(t('common.separator'))}
    >
      {account ? (
        <AccountLogo account={account} size="sm" className="h-8 w-8 shadow-xs" />
      ) : (
        <Skeleton className="h-8 w-8 rounded-lg" />
      )}
      {account ? (
        <span
          className={cn(
            'max-w-[140px] truncate text-table font-semibold tracking-tightish text-ink md:hidden xl:inline xl:max-w-[160px]',
            // phones with the project selector in the header: the logo alone names the company
            !nameOnPhone && 'hidden',
          )}
        >
          {account.short_name || account.name}
        </span>
      ) : null}
      <span className="h-6 w-px bg-border-strong/70" aria-hidden />
      <span className="flex items-center gap-1.5">
        <NewEraMark className="h-5 w-5" />
        <span className="hidden whitespace-nowrap text-micro font-medium text-muted-foreground lg:inline">{t('layout.client.with')}</span>
      </span>
    </Link>
  );
}

export function ClientLayout() {
  const viewer = useViewer();
  const { account, myTaskCount } = usePortalShell();
  const { projectId, projects } = usePortalProject();
  const { pathname } = useLocation();
  const items = navFor(CLIENT_NAV, viewer?.role);
  const search = projectId ? `?${PROJECT_PARAM}=${encodeURIComponent(projectId)}` : '';
  // the selector only where the page follows it; phones carry it in the header (no extra 60px row above the
  // focal block), iPad portrait in a row under the header (the centred nav fills its header), lg+ in the header
  const showProjects = projects.length > 1 && isProjectScoped(pathname);

  // browser tab title = the portal section ("Việc · Client Hub")
  const section = navItemForPath(CLIENT_NAV, pathname);
  const sectionTitle = section
    ? t(section.labelKey)
    : pathname.startsWith('/portal/settings')
      ? t('layout.userMenu.notificationSettings')
      : null;
  useEffect(() => {
    if (sectionTitle) document.title = t('layout.documentTitle', { page: sectionTitle });
  }, [sectionTitle]);

  const [onboardingClosed, setOnboardingClosed] = useState(false);
  const showOnboarding = !!viewer && viewer.user.onboarded_at === null && !viewer.read_only && !onboardingClosed;
  const finishOnboarding = useCallback(() => {
    setOnboardingClosed(true);
    api.completeOnboarding().catch((err: unknown) => {
      console.warn('[onboarding] could not be saved', err);
      toastError(t('layout.onboardingFailed'));
    });
  }, []);

  const badgeFor = (item: NavItem) => (item.id === 'tasks' ? myTaskCount : 0);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />

      <div className="sticky top-0 z-30">
        <ViewAsClientBanner accountName={account?.name ?? null} />
        <header className="border-b border-border/70 bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
          <div className={cn(CANVAS, 'flex h-14 items-center gap-3 px-4 md:grid md:h-16 md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6')}>
            <BrandLockup search={search} nameOnPhone={!showProjects} />

            <nav aria-label={t('layout.nav.main')} className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <TopNavLink key={item.id} item={item} search={search} badge={badgeFor(item)} />
              ))}
            </nav>

            <div className="ml-auto flex min-w-0 items-center gap-1 justify-self-end md:gap-1.5">
              {showProjects ? (
                <ProjectSelect size="sm" className="w-40 min-w-0 md:hidden lg:block lg:w-44 xl:w-52" />
              ) : null}
              <NotificationBell side="client" />
              <UserMenu side="client" accountName={account?.name ?? null} />
            </div>
          </div>
        </header>
      </div>
      {/* iPad portrait: the project row scrolls with the page (the sticky chrome stays the header only) */}
      {showProjects ? (
        <div className="hidden border-b border-border/70 bg-card px-6 py-2 md:block lg:hidden">
          <div className={CANVAS}>
            <ProjectSelect size="sm" className="w-72" />
          </div>
        </div>
      ) : null}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(CANVAS, 'px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 focus:outline-none md:px-6 md:pb-12 md:pt-8')}
      >
        <Outlet />
      </main>

      <nav
        aria-label={t('layout.nav.bottom')}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/85 md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch px-1">
          {items.map((item) => (
            <li key={item.id} className="min-w-0 flex-1">
              <BottomTab item={item} search={search} badge={badgeFor(item)} />
            </li>
          ))}
        </ul>
      </nav>

      <TaskDrawerHost />
      {showOnboarding ? <OnboardingIntro onDone={finishOnboarding} /> : null}
    </div>
  );
}
