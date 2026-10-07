// /login — split layout: calm brand panel with a product preview (≥1024) + sign-in column.
// Sign-in column: ONE sign-in card for clients and New Era staff alike (title → Google for staff → email, which
// routes to a password or a one-time code, see SignInForm) → demo quick-login grid below it. Phones: one column.
import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { homePathFor, safeNextPath } from '@/features/shell/routing';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { DemoLoginPanel } from './DemoLoginPanel';
import { BrandPanel } from './LoginShowcase';
import { SignInForm } from './SignInForm';

export function LoginPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
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

        {/* lg:py-6: the email step + demo cards fit a 1440×900 laptop without a scroll (the content is centred anyway) */}
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center gap-8 py-8 lg:py-6">
          <section
            aria-labelledby="login-title"
            className="rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6"
          >
            <h1
              id="login-title"
              className="text-title font-semibold tracking-tightish text-ink sm:text-display sm:tracking-display"
            >
              {t('auth.heading')}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">{t('auth.subheading')}</p>
            <SignInForm className="mt-6" />
          </section>

          <DemoLoginPanel />
        </div>
        <p className="text-center text-caption lg:hidden">{t('auth.brand.footer')}</p>
      </main>
    </div>
  );
}
