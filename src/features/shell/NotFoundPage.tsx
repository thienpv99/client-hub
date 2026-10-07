import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { homePathFor } from './routing';

export function NotFoundPage() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-soft">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary shadow-xs">
            <Compass className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        <p className="mt-6 text-micro font-medium tabular text-muted-foreground">{t('layout.notFound.code')}</p>
        <h1 className="mt-1 text-title font-semibold tracking-tightish text-ink md:text-display md:tracking-display">
          {t('layout.notFound.title')}
        </h1>
        <p className="mt-2 text-body text-muted-foreground">{t('layout.notFound.description')}</p>
        <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row">
          {canGoBack ? (
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft aria-hidden />
              {t('layout.notFound.back')}
            </Button>
          ) : null}
          <Button asChild>
            <Link to={homePathFor(viewer)}>{t('layout.notFound.home')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
