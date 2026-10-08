// "Bản đồ giá trị" teaser (director / AM): the 6 biggest customers by total value (signed contracts + weighted
// pipeline) as a ranked bar list, linking to the full client map (/app/map). It loads on its own so the dashboard
// never waits for it.
import { Link } from 'react-router-dom';
import { ArrowRight, Orbit } from 'lucide-react';
import type { ClientMapNode } from '@/services/crmContract';
import { api } from '@/services/api';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';

const TOP = 6;

/**
 * ranks run down the columns: one column on phones and iPad portrait (two columns there leave ~130px per name and cut
 * "Ngân hàng Thịnh An"), 1–3 | 4–6 from lg, 1–2 | 3–4 | 5–6 on the full-width xl band
 */
const GRID =
  'grid gap-x-8 gap-y-0.5 px-2 pb-3 sm:px-3 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-3 xl:grid-cols-3 xl:grid-rows-2';

function pct(part: number, max: number): string {
  if (max <= 0 || part <= 0) return '0%';
  return `${Math.max(1.5, (part / max) * 100)}%`;
}

function Row({ node, rank, max }: { node: ClientMapNode; rank: number; max: number }) {
  const value = formatMoneyCompact(node.value);
  const label = t('dashboard.valueMap.rowLabel', {
    rank,
    name: node.label,
    value,
    contract: formatMoneyCompact(node.contract_value),
    pipeline: formatMoneyCompact(node.pipeline_value),
  });
  const body = (
    <>
      <span className="w-4 shrink-0 text-right text-micro font-medium tabular text-muted-foreground" aria-hidden="true">
        {rank}
      </span>
      <AccountLogo
        // the map node carries the account's initials ("TA" for Ngân hàng Thịnh An) but no short name
        account={{ name: node.label, logo_url: node.logo.logo_url, brand_color: node.logo.brand_color }}
        initials={node.logo.initials}
        size="sm"
      />
      <span className="min-w-0 flex-1" aria-hidden="true">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-table font-medium text-foreground" title={node.label}>
            {node.label}
          </span>
          <span className="shrink-0 text-table font-semibold tabular text-ink">{value}</span>
        </span>
        <span className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {/* the stacked bar grows in from the left on first paint (transform only, DESIGN §8.5) */}
          <span className="flex h-full w-full animate-progress-grow">
            <span className="h-full bg-chart-1" style={{ width: pct(node.contract_value, max) }} />
            <span className="h-full bg-chart-3" style={{ width: pct(node.pipeline_value, max) }} />
          </span>
        </span>
      </span>
    </>
  );
  const rowClass = 'flex min-h-tap items-center gap-3 rounded-lg px-2 py-2';
  return (
    <li className="min-w-0">
      {node.href ? (
        <Link to={node.href} aria-label={label} className={`${rowClass} transition-colors duration-150 ease-out-quart hover:bg-subtle`}>
          {body}
        </Link>
      ) : (
        <div className={rowClass} role="group" aria-label={label}>
          {body}
        </div>
      )}
    </li>
  );
}

function TeaserSkeleton() {
  return (
    <div role="status" aria-busy="true" className={cn('skeleton-reveal', GRID)}>
      <span className="sr-only">{t('common.a11y.loading')}</span>
      {Array.from({ length: TOP }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2" aria-hidden="true">
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValueMapTeaser({ className }: { className?: string }) {
  const viewer = useViewer();
  const allowed = viewer?.role === 'director' || viewer?.role === 'am';
  const query = useQuery(() => api.getClientMap({ metric: 'total', includeLeads: false }), [viewer?.user.id], {
    enabled: allowed,
  });
  if (!allowed) return null;

  const map = query.data;
  const top = (map?.nodes ?? [])
    .filter((n) => n.kind === 'account' && n.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'vi'))
    .slice(0, TOP);
  const max = top[0]?.value ?? 0;

  return (
    <SectionCard
      className={className}
      flush
      title={t('dashboard.valueMap.title')}
      description={
        map && top.length > 0
          ? t('dashboard.valueMap.total', { value: formatMoneyCompact(map.totals.value), count: map.totals.accounts })
          : t('dashboard.valueMap.description')
      }
      actions={
        <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary">
          <Link to="/app/map" aria-label={t('dashboard.valueMap.openLabel')}>
            {t('dashboard.valueMap.open')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {map ? (
        top.length === 0 ? (
          <EmptyState
            compact
            icon={Orbit}
            title={t('dashboard.valueMap.empty')}
            description={t('dashboard.valueMap.emptyDescription')}
          />
        ) : (
          <>
            <ol className={GRID} aria-label={t('dashboard.valueMap.listLabel')}>
              {top.map((n, i) => (
                <Row key={n.id} node={n} rank={i + 1} max={max} />
              ))}
            </ol>
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-4 py-2.5 text-micro text-muted-foreground sm:px-5"
              aria-hidden="true"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-1" />
                {t('dashboard.valueMap.contract')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-3" />
                {t('dashboard.valueMap.pipeline')}
              </span>
            </div>
          </>
        )
      ) : query.loading ? (
        <TeaserSkeleton />
      ) : (
        <ErrorState compact error={query.error} onRetry={query.refetch} />
      )}
    </SectionCard>
  );
}
