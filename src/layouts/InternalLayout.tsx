// New Era staff frame (DESIGN §3): full sidebar ≥1024 · 72px icon rail 768–1023 · top bar + sheet menu <768.
// Sticky blurred top bar: breadcrumbs (phones: "‹ section" on child pages, else the page title), quick search
// (Ctrl/Cmd+K), bell, avatar below 1024. It stays quiet at rest: no hairline until the page scrolls, and a section
// page's title (= its own <h1>) only fades in once that heading has scrolled under the bar (useTopBarState).
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { PageHeaderBackContext } from '@/components/common/page-header';
import { TaskDrawerHost } from '@/components/task/TaskDrawerHost';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CommandPalette } from '@/features/shell/CommandPalette';
import { NotificationBell } from '@/features/shell/NotificationBell';
import { UserMenu } from '@/features/shell/UserMenu';
import { homePathFor } from '@/features/shell/routing';
import { useMediaQuery } from '@/hooks/useMedia';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { Breadcrumbs, MobilePageTitle, useBreadcrumbs } from './Breadcrumbs';
import { GroupedNav, Rail, SearchField, Sidebar, WorkspaceBlock } from './InternalNav';
import { INTERNAL_NAV, navFor } from './navItems';
import { SkipLink } from './SkipLink';
import { useNavCounts } from './useNavCounts';
import { useTopBarState } from './useTopBarState';

type Chrome = 'sidebar' | 'rail' | 'phone';

function useChrome(): Chrome {
  const wide = useMediaQuery('(min-width: 1024px)');
  const tablet = useMediaQuery('(min-width: 768px)');
  if (wide) return 'sidebar';
  return tablet ? 'rail' : 'phone';
}

export function InternalLayout() {
  const viewer = useViewer();
  const location = useLocation();
  const chrome = useChrome();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navFor(INTERNAL_NAV, viewer?.role);
  const home = homePathFor(viewer);
  const counts = useNavCounts();
  const crumbs = useBreadcrumbs();
  const { scrolled, titleInView } = useTopBarState();
  const openSearch = () => setPaletteOpen(true);

  // close the phone menu after navigating or when the screen grows past phone width
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, chrome]);

  // global Ctrl/Cmd + K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />

      {/* each frame is mounted only at its breakpoint, so a hidden rail never leaves a tooltip open */}
      {chrome === 'sidebar' ? <Sidebar items={items} counts={counts} home={home} onSearch={openSearch} /> : null}
      {chrome === 'rail' ? <Rail items={items} counts={counts} home={home} /> : null}

      <div className="md:pl-[72px] lg:pl-[248px]">
        {/* at rest the bar melts into the page; its hairline appears once content scrolls under it */}
        <header
          className={cn(
            'sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md transition-colors duration-200 supports-[backdrop-filter]:bg-background/70',
            scrolled ? 'border-border/70' : 'border-transparent',
          )}
        >
          <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-4 md:gap-4 md:px-6 xl:px-8">
            {chrome === 'phone' ? (
              <>
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="-ml-2 shrink-0 text-muted-foreground" aria-label={t('layout.topbar.openMenu')}>
                      <Menu className="h-5 w-5" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" closeLabel={t('common.close')} aria-describedby={undefined} className="bg-sidebar">
                    <SheetHeader className="pb-3">
                      <SheetTitle className="sr-only">{t('layout.topbar.menuTitle')}</SheetTitle>
                      <WorkspaceBlock home={home} />
                    </SheetHeader>
                    <div className="px-4">
                      <SearchField
                        showKbd={false}
                        className="h-11"
                        onOpen={() => {
                          setMenuOpen(false);
                          openSearch();
                        }}
                      />
                    </div>
                    <GroupedNav items={items} counts={counts} size="sheet" className="px-3 pb-8 pt-5" />
                  </SheetContent>
                </Sheet>
                <div className="flex min-w-0 flex-1 items-center">
                  <MobilePageTitle crumbs={crumbs} visible={!titleInView} />
                </div>
              </>
            ) : (
              <Breadcrumbs crumbs={crumbs} titleInView={titleInView} className="flex-1" />
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {chrome === 'rail' ? <SearchField onOpen={openSearch} className="mr-1 w-56" /> : null}
              {chrome === 'phone' ? (
                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={openSearch} aria-label={t('layout.search.open')}>
                  <Search className="h-5 w-5" aria-hidden />
                </Button>
              ) : null}
              <NotificationBell side="internal" />
              {chrome !== 'sidebar' ? <UserMenu side="internal" /> : null}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-page px-4 py-6 focus:outline-none md:px-6 md:py-8 xl:px-8">
          {/* the top bar carries the way back, so PageHeader drops its own back link here */}
          <PageHeaderBackContext.Provider value={false}>
            <Outlet />
          </PageHeaderBackContext.Provider>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <TaskDrawerHost />
    </div>
  );
}
