// "Bảng giá": the price list lives in Thương mại; Settings only points there.
import { Link } from 'react-router-dom';
import { ArrowRight, Tags } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';

export const PRICE_LIST_PATH = '/app/commercial/prices';

export function PricingTab() {
  return (
    <Card>
      <EmptyState
        icon={Tags}
        title={t('settings.pricing.title')}
        description={t('settings.pricing.line')}
        action={
          <Button asChild>
            <Link to={PRICE_LIST_PATH}>
              {t('settings.pricing.open')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />
    </Card>
  );
}
