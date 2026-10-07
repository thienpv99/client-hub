// "Bảng" view — the accessible alternative of the map: companies ranked by the chosen metric, or grouped by
// ecosystem with subtotal rows. A table from xl (1280), cards below.
import { Fragment } from 'react';
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import type { ClientMapMetric } from '@/services/crmContract';
import { AccountLogo } from '@/components/common/account-logo';
import { SMALL } from '@/components/common/cx';
import { HealthBadge } from '@/components/common/health-badge';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { groupedRows, ownerName, type RankedRow, type RowGroup } from './mapModel';

export type TableMode = 'rank' | 'group';

export interface ClientTableProps {
  rows: RankedRow[];
  metric: ClientMapMetric;
  mode: TableMode;
  onMode(m: TableMode): void;
}

/** which money column carries the current metric */
const METRIC_COLUMN: Record<ClientMapMetric, 'contract' | 'pipeline' | 'total'> = {
  contract_value: 'contract',
  pipeline: 'pipeline',
  total: 'total',
};

function EcoTag({ name }: { name: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 font-medium text-primary', SMALL)}>
      <Network className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function KindTag({ row }: { row: RankedRow }) {
  const lead = row.node.kind === 'lead';
  return (
    <Badge variant={lead ? 'outline' : 'default'} className={cn(lead ? 'border-dashed' : 'text-foreground')}>
      {t(`clientmap.kind.${row.node.kind}`)}
    </Badge>
  );
}

function HealthCell({ row }: { row: RankedRow }) {
  const n = row.node;
  if (n.kind === 'lead') {
    return n.fit_grade ? <span className="text-table text-muted-foreground">{t('clientmap.table.fit', { grade: n.fit_grade })}</span> : <span aria-hidden="true">—</span>;
  }
  return n.health ? <HealthBadge health={n.health} size="sm" /> : <span className="text-table text-muted-foreground">{t('clientmap.table.noHealth')}</span>;
}

/**
 * stretched link: the whole card (phones / iPad) is the tap target, not just the ~20px name (DESIGN §6 touch 44px).
 * The card needs `relative`; the table rows navigate on click instead (a <tr> is no reliable containing block).
 */
const STRETCH = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary";

/** a click on the row that is not on the link itself (or a text selection) */
function rowClickTarget(e: MouseEvent<HTMLElement>): boolean {
  if ((e.target as HTMLElement | null)?.closest('a,button')) return false;
  const selection = window.getSelection();
  return !(selection && selection.toString().length > 0);
}

function Company({ row, stretch = false }: { row: RankedRow; stretch?: boolean }) {
  const n = row.node;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AccountLogo
        account={{ name: n.label, logo_url: n.logo.logo_url, brand_color: n.logo.brand_color }}
        initials={n.logo.initials}
        size="sm"
      />
      <div className="min-w-0">
        {n.href ? (
          <Link
            to={n.href}
            className={cn('break-words font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline', stretch && STRETCH)}
          >
            {n.label}
          </Link>
        ) : (
          <span className="break-words font-semibold text-foreground">{n.label}</span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-caption">{n.sublabel}</span>
          {row.eco ? <EcoTag name={row.eco.short_name || row.eco.name} /> : null}
        </div>
      </div>
    </div>
  );
}

function GroupHeading({ g }: { g: RowGroup }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {g.eco ? <Network className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
      <span className="truncate font-semibold text-foreground">{g.eco ? g.eco.name : t('clientmap.table.noEcosystem')}</span>
      <span className="shrink-0 text-caption">{t('clientmap.table.subtotal', { count: g.rows.length })}</span>
    </span>
  );
}

function DesktopTable({ rows, metric, mode }: Omit<ClientTableProps, 'onMode'>) {
  const navigate = useNavigate();
  const strong = METRIC_COLUMN[metric];
  const num = (key: 'contract' | 'pipeline' | 'total') => cn('text-right tabular', key === strong ? 'font-semibold text-ink' : 'text-muted-foreground');
  const head = (key: 'contract' | 'pipeline' | 'total') => cn('text-right', key === strong && 'text-foreground');
  const body = (r: RankedRow) => (
    <TableRow
      key={r.node.id}
      className={r.node.href ? 'cursor-pointer' : undefined}
      onClick={(e) => {
        if (r.node.href && rowClickTarget(e)) navigate(r.node.href);
      }}
    >
      <TableCell className="w-14 pl-5 tabular text-muted-foreground">{r.rank}</TableCell>
      <TableCell className="min-w-[16rem]">
        <Company row={r} />
      </TableCell>
      <TableCell>
        <KindTag row={r} />
      </TableCell>
      <TableCell>
        <HealthCell row={r} />
      </TableCell>
      <TableCell className={num('contract')}>{formatMoneyCompact(r.contract)}</TableCell>
      <TableCell className={num('pipeline')}>{formatMoneyCompact(r.pipeline)}</TableCell>
      <TableCell className={num('total')}>{formatMoneyCompact(r.total)}</TableCell>
      <TableCell className="pr-5 text-muted-foreground">{ownerName(r.node)}</TableCell>
    </TableRow>
  );
  return (
    <Table>
      <TableCaption className="sr-only">{t('clientmap.table.caption', { metric: t(`clientmap.metric.lower.${metric}`) })}</TableCaption>
      <TableHeader className="bg-subtle">
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">{t('clientmap.table.columns.rank')}</TableHead>
          <TableHead>{t('clientmap.table.columns.company')}</TableHead>
          <TableHead>{t('clientmap.table.columns.kind')}</TableHead>
          <TableHead>{t('clientmap.table.columns.health')}</TableHead>
          <TableHead className={head('contract')}>{t('clientmap.table.columns.contract')}</TableHead>
          <TableHead className={head('pipeline')}>{t('clientmap.table.columns.pipeline')}</TableHead>
          <TableHead className={head('total')}>{t('clientmap.table.columns.total')}</TableHead>
          <TableHead className="pr-5">{t('clientmap.table.columns.owner')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mode === 'rank'
          ? rows.map(body)
          : groupedRows(rows).map((g) => (
              <Fragment key={g.key || 'none'}>
                <TableRow className="bg-subtle hover:bg-subtle">
                  <TableCell colSpan={4} className="pl-5">
                    <GroupHeading g={g} />
                  </TableCell>
                  <TableCell className={num('contract')}>{formatMoneyCompact(g.contract)}</TableCell>
                  <TableCell className={num('pipeline')}>{formatMoneyCompact(g.pipeline)}</TableCell>
                  <TableCell className={num('total')}>{formatMoneyCompact(g.total)}</TableCell>
                  <TableCell className="pr-5" />
                </TableRow>
                {g.rows.map(body)}
              </Fragment>
            ))}
      </TableBody>
    </Table>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption">{label}</dt>
      <dd className={cn('text-table tabular', strong ? 'font-semibold text-ink' : 'text-foreground')}>{formatMoneyCompact(value)}</dd>
    </div>
  );
}

function RowCard({ row, metric }: { row: RankedRow; metric: ClientMapMetric }) {
  const strong = METRIC_COLUMN[metric];
  return (
    <li className={cn('flex flex-col gap-3 px-4 py-4 sm:px-5', row.node.href && 'relative transition-colors duration-150 hover:bg-subtle')}>
      <div className="flex items-start gap-3">
        <span className="mt-1 w-7 shrink-0 text-table font-semibold tabular text-muted-foreground">
          <span className="sr-only">{t('clientmap.table.rank', { rank: row.rank })}</span>
          <span aria-hidden="true">{row.rank}</span>
        </span>
        <div className="min-w-0 flex-1">
          <Company row={row} stretch />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-10">
        <KindTag row={row} />
        <HealthCell row={row} />
      </div>
      <dl className="grid grid-cols-3 gap-3 pl-10">
        <Money label={t('clientmap.table.columns.contract')} value={row.contract} strong={strong === 'contract'} />
        <Money label={t('clientmap.table.columns.pipeline')} value={row.pipeline} strong={strong === 'pipeline'} />
        <Money label={t('clientmap.table.columns.total')} value={row.total} strong={strong === 'total'} />
      </dl>
      <p className="pl-10 text-caption">
        {t('clientmap.table.columns.owner')}: <span className="text-muted-foreground">{ownerName(row.node)}</span>
      </p>
    </li>
  );
}

function Cards({ rows, metric, mode }: Omit<ClientTableProps, 'onMode'>) {
  if (mode === 'rank') {
    return (
      <ul className="divide-y divide-border/60">
        {rows.map((r) => (
          <RowCard key={r.node.id} row={r} metric={metric} />
        ))}
      </ul>
    );
  }
  return (
    <div>
      {groupedRows(rows).map((g) => (
        <section key={g.key || 'none'} aria-label={g.eco?.name ?? t('clientmap.table.noEcosystem')} className="border-t border-border/60 first:border-t-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-subtle px-4 py-3 sm:px-5">
            <GroupHeading g={g} />
            <span className="text-table font-semibold tabular text-ink">{formatMoneyCompact(g.value)}</span>
          </div>
          <ul className="divide-y divide-border/60">
            {g.rows.map((r) => (
              <RowCard key={r.node.id} row={r} metric={metric} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ClientTable({ rows, metric, mode, onMode }: ClientTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card" aria-labelledby="clientmap-table-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id="clientmap-table-title" className="text-heading font-semibold tracking-tightish text-ink">
            {t('clientmap.table.title', { metric: t(`clientmap.metric.lower.${metric}`) })}
          </h2>
          <p className="text-caption">{t('clientmap.table.count', { count: rows.length })}</p>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          value={mode}
          onValueChange={(v) => {
            if (v === 'rank' || v === 'group') onMode(v);
          }}
          aria-label={t('clientmap.table.modeLabel')}
        >
          <ToggleGroupItem value="rank" className="px-3">
            {t('clientmap.table.mode.rank')}
          </ToggleGroupItem>
          <ToggleGroupItem value="group" className="px-3">
            {t('clientmap.table.mode.group')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="hidden border-t border-border/60 xl:block">
        <DesktopTable rows={rows} metric={metric} mode={mode} />
      </div>
      <div className="border-t border-border/60 xl:hidden">
        <Cards rows={rows} metric={metric} mode={mode} />
      </div>
    </section>
  );
}
