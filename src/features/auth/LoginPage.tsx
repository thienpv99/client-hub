// /login — split layout: calm brand panel with a product preview (≥1024) + sign-in column.
// Sign-in column: heading → sign-in card (segmented Khách hàng / Nội bộ New Era) → demo quick-login grid.
// Phones: one column, the demo grid comes first (the fastest way in), then the sign-in card.
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { homePathFor, safeNextPath } from '@/features/shell/routing';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { ClientLoginForm } from './ClientLoginForm';
import { DemoLoginPanel } from './DemoLoginPanel';
import { InternalLoginForm } from './InternalLoginForm';
import { BrandPanel } from './LoginShowcase';

type Mode = 'client' | 'internal';

export function LoginPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('client');
  // outside both app frames: name the browser tab here (after a logout it still showed the last page)
  useEffect(() => {
    document.title = t('layout.documentTitle', { page: t('auth.pageTitle') });
  }, []);

  if (viewer) {
    const target = safeNextPath(params.get('next'), viewer) ?? homePathFor(viewer);
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="flex min-h-screen flex-col px-4 pb-6 pt-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3 lg:hidden">
          <NewEraLogo size="sm" withText />
          <span className="h-4 w-px bg-border-strong" aria-hidden />
          <span className="text-caption font-medium">{t('auth.brand.eyebrow')}</span>
        </div>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-8 lg:py-12">
          <h1 className="text-title font-semibold tracking-tightish text-ink sm:text-display sm:tracking-display">
            {t('auth.heading')}
          </h1>
          <p className="mt-1.5 text-body text-muted-foreground">{t('auth.subheading')}</p>

          <div className="mt-6 flex flex-col gap-8 lg:mt-8">
            <section
              aria-label={t('auth.mode.label')}
              className="order-2 rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6 lg:order-1"
            >
              <p className="-mt-1 mb-4 text-caption lg:hidden">{t('auth.orSignIn')}</p>
              <Tabs value={mode} onValueChange={(v) => setMode(v === 'internal' ? 'internal' : 'client')}>
                <TabsList aria-label={t('auth.mode.label')} className="grid w-full grid-cols-2">
                  <TabsTrigger value="client">{t('auth.mode.client')}</TabsTrigger>
                  <TabsTrigger value="internal">{t('auth.mode.internal')}</TabsTrigger>
                </TabsList>
                {/* the panels start with a field: no extra tab stop on the panel itself */}
                <TabsContent value="client" className="mt-5" tabIndex={-1}>
                  <ClientLoginForm />
                </TabsContent>
                <TabsContent value="internal" className="mt-5" tabIndex={-1}>
                  <InternalLoginForm />
                </TabsContent>
              </Tabs>
            </section>

            <DemoLoginPanel className="order-1 lg:order-2" />
          </div>
        </div>
        <p className="text-center text-caption lg:hidden">{t('auth.brand.footer')}</p>
      </main>
    </div>
  );
}
