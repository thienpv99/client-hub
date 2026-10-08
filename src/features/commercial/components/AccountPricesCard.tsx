// Negotiated prices of one account ("Đơn giá riêng"): managers set or remove them (api.setAccountPrice).
// Cost per unit and margin at the applicable price show only when the api returns cost (lock + "Chỉ nội bộ").
// Rows sit edge to edge in the card: a table from xl, divided rows below.
import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Tag, X } from 'lucide-react';
import type { AccountPriceView, PriceItemView } from '@/services/contract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { Money } from '@/components/common/money';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAction } from '@/hooks/useAction';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { api } from '@/services/api';
import { fmtPct } from '../lib';
import { MoneyInput } from './inputs';

interface Row extends AccountPriceView {
  cost_price?: number;
}

function PriceDialog({ accountId, row, onOpenChange }: { accountId: string; row: Row | null; onOpenChange: (o: boolean) => void }) {
  const uid = useId();
  const [price, setPrice] = useState(row?.negotiated_price ?? row?.list_price ?? 0);
  const [note, setNote] = useState(row?.note ?? '');
  const { run, pending, pendingVisible } = useAction();
  if (!row) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row || price <= 0 || pending) return;
    const r = await run(() => api.setAccountPrice(accountId, row.price_item_id, price, note.trim() || null), {
      success: 'commercial.accountPrices.toast.saved',
      successParams: { name: row.name },
    });
    if (r) onOpenChange(false);
  }

  const diff = row.list_price > 0 ? ((row.list_price - price) / row.list_price) * 100 : 0;
  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('commercial.accountPrices.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('commercial.accountPrices.dialogDescription', { name: row.name, list: formatMoney(row.list_price) })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField
            label={t('commercial.accountPrices.price')}
            htmlFor={`${uid}-price`}
            required
            hint={price > 0 && diff !== 0 ? t(diff > 0 ? 'commercial.accountPrices.belowList' : 'commercial.accountPrices.aboveList', { pct: fmtPct(Math.abs(diff)) }) : undefined}
            error={price <= 0 ? t('commercial.prices.form.priceRequired') : undefined}
          >
            <MoneyInput id={`${uid}-price`} value={price} onValueChange={setPrice} autoFocus />
          </FormField>
          <FormField label={t('commercial.accountPrices.note')} htmlFor={`${uid}-note`}>
            <Input id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('commercial.accountPrices.notePlaceholder')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={price <= 0}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountPricesCard({ accountId, manage }: { accountId: string; manage: boolean }) {
  const breakpoint = useBreakpoint();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const { run, pending, pendingVisible } = useAction();
  const query = useQuery(
    async () => {
      const [prices, items] = await Promise.all([api.listAccountPrices(accountId), api.listPriceItems({ includeInactive: true })]);
      return { prices, items };
    },
    [accountId],
  );
  const rows = useMemo<Row[]>(() => {
    if (!query.data) return [];
    const cost = new Map<string, PriceItemView>(query.data.items.map((i) => [i.id, i]));
    return query.data.prices.map((p) => ({ ...p, cost_price: cost.get(p.price_item_id)?.cost_price }));
  }, [query.data]);
  const costVisible = rows.some((r) => r.cost_price !== undefined);
  const negotiatedCount = rows.filter((r) => r.negotiated_price !== null).length;
  const visible = showAll ? rows : rows.filter((r) => r.negotiated_price !== null);

  const remove = (r: Row) => {
    if (pending) return;
    void run(() => api.setAccountPrice(accountId, r.price_item_id, null), {
      success: 'commercial.accountPrices.toast.removed',
      successParams: { name: r.name },
    });
  };

  const margin = (r: Row) => {
    const applicable = r.negotiated_price ?? r.list_price;
    return r.cost_price !== undefined && applicable > 0 ? ((applicable - r.cost_price) / applicable) * 100 : null;
  };

  const actions = (r: Row, className?: string) => {
    if (!manage) return null;
    const label = r.negotiated_price === null ? t('commercial.accountPrices.set') : t('common.edit');
    return (
      <div className={className ?? 'flex items-center justify-end gap-1'}>
        <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={t('commercial.accountPrices.editFor', { action: label, name: r.name })}>
          <Pencil aria-hidden="true" />
          {label}
        </Button>
        {r.negotiated_price !== null ? (
          <Button variant="ghost" size="icon-sm" disabled={pendingVisible} onClick={() => remove(r)} aria-label={t('commercial.accountPrices.removeFor', { name: r.name })}>
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    );
  };

  const prices = (r: Row) => (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2">
      {r.negotiated_price !== null ? <Money value={r.negotiated_price} className="font-semibold text-ink" /> : null}
      <Money value={r.list_price} className={r.negotiated_price !== null ? 'text-caption line-through' : 'font-medium text-foreground'} />
    </span>
  );

  return (
    <SectionCard
      title={t('commercial.accountPrices.title')}
      description={
        negotiatedCount > 0 ? t('commercial.accountPrices.description', { count: negotiatedCount }) : t('commercial.accountPrices.descriptionNone')
      }
      actions={
        <label className="touch-tap flex min-h-tap cursor-pointer items-center gap-2.5 text-table text-muted-foreground md:min-h-0">
          <Switch checked={showAll} onCheckedChange={setShowAll} />
          {t('commercial.accountPrices.showAll')}
        </label>
      }
      flush
    >
      {query.loading ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <ListSkeleton rows={3} />
        </div>
      ) : !query.data ? (
        <ErrorState error={query.error} onRetry={query.refetch} compact />
      ) : visible.length === 0 ? (
        <EmptyState compact icon={Tag} title={t('commercial.accountPrices.empty')} description={manage ? t('commercial.accountPrices.emptyHint') : undefined} />
      ) : breakpoint === 'desktop' ? (
        <div className="border-t border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('commercial.prices.col.name')}</TableHead>
                <TableHead>{t('commercial.prices.col.unit')}</TableHead>
                <TableHead className="text-right">{t('commercial.accountPrices.applicable')}</TableHead>
                {costVisible ? (
                  <TableHead className="bg-note/60 text-right">
                    <span className="inline-flex items-center gap-2">
                      <InternalOnlyBadge className="h-5 bg-card" />
                      {t('commercial.prices.col.cost')}
                    </span>
                  </TableHead>
                ) : null}
                {costVisible ? <TableHead className="bg-note/60 text-right">{t('commercial.prices.col.margin')}</TableHead> : null}
                <TableHead>{t('commercial.accountPrices.note')}</TableHead>
                {manage ? (
                  <TableHead>
                    <span className="sr-only">{t('commercial.payment.col.actions')}</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const m = margin(r);
                return (
                  <TableRow key={r.price_item_id}>
                    <TableCell className="min-w-[220px]">
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="text-caption tabular">{r.code}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t(`enums.priceUnit.${r.unit}`)}</TableCell>
                    <TableCell className="text-right">{prices(r)}</TableCell>
                    {costVisible ? <TableCell className="bg-note/40 text-right">{r.cost_price !== undefined ? <Money value={r.cost_price} /> : '—'}</TableCell> : null}
                    {costVisible ? <TableCell className="bg-note/40 text-right tabular">{m !== null ? fmtPct(m) : '—'}</TableCell> : null}
                    <TableCell className="max-w-[220px] text-muted-foreground">
                      <span className="line-clamp-2">{r.note ?? ''}</span>
                    </TableCell>
                    {manage ? <TableCell>{actions(r)}</TableCell> : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
          {visible.map((r) => {
            const m = margin(r);
            return (
              <li key={r.price_item_id} className="space-y-2 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-caption tabular">
                      {r.code} · {t(`enums.priceUnit.${r.unit}`)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">{prices(r)}</div>
                </div>
                {r.note ? <p className="text-table text-muted-foreground">{r.note}</p> : null}
                {r.cost_price !== undefined ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-note px-3 py-2 text-table ring-1 ring-inset ring-note-border">
                    <InternalOnlyBadge className="bg-card" />
                    <span className="text-muted-foreground">
                      {t('commercial.prices.col.cost')} <Money value={r.cost_price} className="font-medium text-foreground" />
                    </span>
                    {m !== null ? (
                      <span className="text-muted-foreground">
                        {t('commercial.prices.col.margin')} <span className="font-medium tabular text-foreground">{fmtPct(m)}</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {actions(r, '-ml-3 flex items-center gap-1')}
              </li>
            );
          })}
        </ul>
      )}
      {editing ? <PriceDialog key={editing.price_item_id} accountId={accountId} row={editing} onOpenChange={(o) => !o && setEditing(null)} /> : null}
    </SectionCard>
  );
}
