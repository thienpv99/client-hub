// "Tổng quan · Client Hub" in the browser tab while the page is shown (restored on leave).
import { useEffect } from 'react';
import { t } from '@/i18n';

export function useDocumentTitle(page: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = t('dashboard.documentTitle', { page, app: t('common.appName') });
    return () => {
      document.title = previous;
    };
  }, [page]);
}
