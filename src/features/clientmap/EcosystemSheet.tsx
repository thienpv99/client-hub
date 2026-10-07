// "Quản lý hệ sinh thái": every ecosystem the viewer can see, with its value, members and cross-sell count.
import { MapPin, Network, Pencil, Plus } from 'lucide-react';
import { api } from '@/services/api';
import type { EcosystemView } from '@/services/crmContract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { EcosystemSummary } from './EcosystemSummary';

export interface EcosystemSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreate(): void;
  onEdit(eco: EcosystemView): void;
  /** closes the sheet and selects the ecosystem on the map */
  onShowOnMap(eco: EcosystemView): void;
}

export function EcosystemSheet({ open, onOpenChange, onCreate, onEdit, onShowOnMap }: EcosystemSheetProps) {
  const q = useQuery(() => api.listEcosystems(), [], { enabled: open });
  const list = [...(q.data ?? [])].sort((a, b) => b.contract_value + b.potential_value - (a.contract_value + a.potential_value));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" mobileFullScreen>
        <SheetHeader className="gap-3 border-b border-border/70">
          <div>
            <SheetTitle>{t('clientmap.eco.sheetTitle')}</SheetTitle>
            <SheetDescription>{t('clientmap.eco.sheetDescription')}</SheetDescription>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption">{q.data ? t('clientmap.eco.count', { count: q.data.length }) : null}</p>
            <Button onClick={onCreate}>
              <Plus aria-hidden="true" />
              {t('clientmap.eco.create')}
            </Button>
          </div>
        </SheetHeader>
        <SheetBody className="pt-2">
          {q.loading ? (
            <ListSkeleton rows={3} className="pt-3" />
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={q.refetch} compact />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Network}
              title={t('clientmap.eco.emptyTitle')}
              description={t('clientmap.eco.emptyDescription')}
              action={
                <Button variant="soft" onClick={onCreate}>
                  <Plus aria-hidden="true" />
                  {t('clientmap.eco.create')}
                </Button>
              }
            />
          ) : (
            // one hairline-separated section per ecosystem (no cards inside the sheet)
            <ul className="divide-y divide-border/60">
              {list.map((eco) => (
                <li key={eco.id} className="py-5">
                  <EcosystemSummary
                    eco={eco}
                    titleId={`eco-sheet-${eco.id}`}
                    actions={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(eco)}
                        aria-label={t('clientmap.eco.editLabel', { name: eco.name })}
                        title={t('clientmap.eco.edit')}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => onShowOnMap(eco)}
                    aria-label={t('clientmap.eco.showOnMapLabel', { name: eco.name })}
                    className="mt-4"
                  >
                    <MapPin aria-hidden="true" />
                    {t('clientmap.eco.showOnMap')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
