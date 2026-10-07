import { t } from '@/i18n';

/** First focusable element of each layout: jumps over the navigation. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-table focus:font-medium focus:text-primary focus:shadow-pop"
    >
      {t('common.a11y.skipToContent')}
    </a>
  );
}
