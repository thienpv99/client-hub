// "Mẫu lộ trình": read-only template cards with their milestone chain and offsets.
import { Info, Route } from 'lucide-react';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { CardSkeleton } from '@/components/common/skeletons';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { TemplateChain, templateSpanDays } from './TemplateChain';

export function TemplatesTab() {
  const { data, loading, error, refetch } = useQuery(() => api.listTemplates(), []);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }
  const templates = data ?? [];

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <Card>
          <EmptyState icon={Route} title={t('settings.templates.empty')} />
        </Card>
      ) : (
        <ul className="space-y-4">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <SectionCard
                as="h3"
                title={tpl.name}
                description={tpl.description}
                actions={
                  <Badge className="tabular">
                    {t('settings.templates.meta', { count: tpl.milestones.length, days: templateSpanDays(tpl.milestones) })}
                  </Badge>
                }
              >
                <TemplateChain
                  className="pt-1"
                  milestones={tpl.milestones}
                  label={t('settings.templates.chainLabel', { name: tpl.name })}
                />
              </SectionCard>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 px-1 text-caption">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('settings.templates.footnote')}</span>
      </p>
    </div>
  );
}
