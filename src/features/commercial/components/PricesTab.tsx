// "Bảng giá" tab. Everyone with commercial access reads; only the director adds / edits.
// Cost price and margin appear only when the api returns them (director, AM with cost permission), on note tint.
import { useMemo, useState } from 'react';
import { PackagePlus, Pencil, Search, SearchX, Tag } from 'lucide-react';
import type { PriceItemView } from '@/services/contract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { Money } from '@/components/common/money';
import { TableSkeleton } from '@/components/common/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import { api } from '@/services/api';
import { fmtPct } from '../lib';
import { PriceItemDialog } from './PriceItemDialog';

function ActiveState({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'default'} size="sm" dot>
      {active ? t('commercial.prices.active') : t('commercial.prices.inactive')}
    </Badge>
  );
}

function unitLabel(i: PriceItemView): string {
  return t(`enums.priceUnit.${i.unit}`);
}

/** Cost and margin of one item on note tint (cards below xl). */
function CostInset({ item }: { item: PriceItemView }) {
  if (item.cost_price === undefined) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-note px-3 py-2 text-table ring-1 ring-inset ring-note-border">
      <InternalOnlyBadge className="bg-card" />
      <span className="text-muted-foreground">
        {t('commercial.prices.col.cost')} <Money value={item.cost_price} className="font-medium text-foreground" />
      </span>
      {item.margin_pct !== undefined ? (
        <span className="text-muted-foreground">
          {t('commercial.prices.col.margin')} <span className="font-medium tabular text-foreground">{fmtPct(item.margin_pct)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function PricesTab() {
  const viewer = useViewer();
  const breakpoint = useBreakpoint();
  const isDirector = viewer?.role === 'director' && !viewer.read_only;
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<PriceItemView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery(() => api.listPriceItems({ includeInactive: true }), []);
  const items = useMemo(() => query.data ?? [], [query.data]);
  const costVisible = items.some((i) => i.cost_price !== undefined);
  const needle = normalizeText(search);
  const visible = items.filter(
    (i) =>
      (showInactive || i.active) &&
      (!needle || normalizeText(`${i.code} ${i.name} ${i.category} ${i.description ?? ''}`).includes(needle)),
  );
  const inactiveCount = items.filter((i) => !i.active).length;

  const openEditor = (item: PriceItemView | null) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* same toolbar as the quotes tab: search + action, then the result count with the switch on the right */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            type="search"
            icon={<Search />}
            inputSize="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('commercial.prices.search')}
            aria-label={t('commercial.prices.search')}
            wrapperClassName="w-full sm:w-[280px]"
          />
          {isDirector ? (
            <Button variant="secondary" onClick={() => openEditor(null)} className="sm:ml-auto">
              <PackagePlus aria-hidden="true" />
              {t('commercial.prices.add')}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-caption" aria-live="polite">
            {t('commercial.prices.result', { count: visible.length })}
            {!isDirector && viewer?.org_type === 'internal' ? ` · ${t('commercial.prices.readOnlyNote')}` : ''}
          </p>
          <label className="touch-tap flex min-h-tap cursor-pointer items-center gap-2.5 text-table text-muted-foreground md:min-h-0">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            {t('commercial.prices.showInactive', { count: inactiveCount })}
          </label>
        </div>
      </div>

      {query.loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : query.error && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          {items.length === 0 ? (
            <EmptyState icon={Tag} title={t('commercial.prices.empty')} />
          ) : (
            <EmptyState
              icon={SearchX}
              title={t('commercial.prices.emptyFiltered')}
              action={
                needle ? (
                  <Button variant="secondary" onClick={() => setSearch('')}>
                    {t('common.clearFilters')}
                  </Button>
                ) : null
              }
            />
          )}
        </Card>
      ) : breakpoint === 'desktop' ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('commercial.prices.col.name')}</TableHead>
                <TableHead>{t('commercial.prices.col.category')}</TableHead>
                <TableHead>{t('commercial.prices.col.unit')}</TableHead>
                <TableHead className="text-right">{t('commercial.prices.col.listPrice')}</TableHead>
                {costVisible ? (
                  <TableHead className="bg-note/60 text-right">
                    <span className="inline-flex items-center gap-2">
                      <InternalOnlyBadge className="h-5 bg-card" />
                      {t('commercial.prices.col.cost')}
                    </span>
                  </TableHead>
                ) : null}
                {costVisible ? <TableHead className="bg-note/60 text-right">{t('commercial.prices.col.margin')}</TableHead> : null}
                <TableHead>{t('commercial.prices.col.status')}</TableHead>
                {isDirector ? (
                  <TableHead className="w-14">
                    <span className="sr-only">{t('common.edit')}</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((i) => (
                <TableRow key={i.id} className="group">
                  <TableCell className="min-w-[260px] max-w-[420px]">
                    <p className={i.active ? 'font-semibold text-ink' : 'font-semibold text-muted-foreground'}>{i.name}</p>
                    <p className="line-clamp-1 text-caption">
                      <span className="tabular">{i.code}</span>
                      {i.description ? ` · ${i.description}` : ''}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{i.category}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{unitLabel(i)}</TableCell>
                  <TableCell className="text-right font-semibold text-ink">
                    <Money value={i.list_price} />
                  </TableCell>
                  {costVisible ? (
                    <TableCell className="bg-note/40 text-right">{i.cost_price !== undefined ? <Money value={i.cost_price} /> : '—'}</TableCell>
                  ) : null}
                  {costVisible ? (
                    <TableCell className="bg-note/40 text-right tabular">{i.margin_pct !== undefined ? fmtPct(i.margin_pct) : '—'}</TableCell>
                  ) : null}
                  <TableCell>
                    <ActiveState active={i.active} />
                  </TableCell>
                  {isDirector ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
                        onClick={() => openEditor(i)}
                        aria-label={t('commercial.prices.editItem', { name: i.name })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((i) => (
            <li key={i.id} className="min-w-0">
              <Card className="h-full p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-caption">
                      <span className="tabular">{i.code}</span> · {i.category}
                    </p>
                    <p className={i.active ? 'mt-0.5 break-words font-semibold text-ink' : 'mt-0.5 break-words font-semibold text-muted-foreground'}>
                      {i.name}
                    </p>
                  </div>
                  {isDirector ? (
                    <Button variant="ghost" size="icon-sm" className="-mr-1.5 -mt-1" onClick={() => openEditor(i)} aria-label={t('commercial.prices.editItem', { name: i.name })}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                  <p className="text-table text-muted-foreground">
                    <Money value={i.list_price} className="text-title font-semibold tracking-tightish text-ink" />
                    {` / ${unitLabel(i)}`}
                  </p>
                  <ActiveState active={i.active} />
                </div>
                <CostInset item={i} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {isDirector ? (
        <PriceItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} items={items} costVisible={costVisible || !!viewer?.can_view_cost} />
      ) : null}
    </div>
  );
}
