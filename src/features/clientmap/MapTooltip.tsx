// Hover / focus card of a bubble. Desktop: floats beside the bubble (measured, kept inside the canvas, ignores the
// pointer). Phones: docked to the bottom of the canvas with an "Mở" button (first tap shows it, second tap opens).
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, MousePointerClick, Network } from 'lucide-react';
import { isFeatureOn } from '@/config/features';
import type { ClientMapNode, EcosystemView } from '@/services/crmContract';
import { AccountLogo } from '@/components/common/account-logo';
import { HealthBadge } from '@/components/common/health-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { ownerName, pipelineOf } from './mapModel';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export interface MapTooltipProps {
  id: string;
  node: ClientMapNode;
  eco: EcosystemView | undefined;
  /** bubble centre and radius in canvas pixels */
  anchor: { x: number; y: number; r: number };
  canvas: { width: number; height: number };
  /** phones: docked card */
  docked: boolean;
  /** touch input: show the "Mở" button and the touch hint */
  touch: boolean;
  onOpen(): void;
}

function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-table tabular', strong ? 'font-semibold text-ink' : 'font-medium text-foreground')}>{value}</dd>
    </div>
  );
}

function Facts({ node, eco }: { node: ClientMapNode; eco: EcosystemView | undefined }) {
  const grid = 'grid grid-cols-2 gap-x-4 gap-y-3';
  if (node.kind === 'ecosystem') {
    return (
      <dl className={grid}>
        <Fact label={t('clientmap.tooltip.contract')} value={formatMoneyCompact(eco?.contract_value ?? node.contract_value)} strong />
        {isFeatureOn('sales') ? (
          <Fact label={t('clientmap.tooltip.potential')} value={formatMoneyCompact(eco?.potential_value ?? node.pipeline_value)} strong />
        ) : null}
      </dl>
    );
  }
  if (node.kind === 'lead') {
    return (
      <dl className={grid}>
        <Fact label={t('clientmap.tooltip.budget')} value={formatMoneyCompact(pipelineOf(node))} strong />
        <Fact label={t('clientmap.tooltip.status')} value={node.lead_status ? t(`crm.enums.leadStatus.${node.lead_status}`) : '—'} />
        <Fact label={t('clientmap.tooltip.owner')} value={ownerName(node)} />
      </dl>
    );
  }
  // without the sales module (SPEC-CARE §1) a customer shows its contract and its AM only
  if (!isFeatureOn('sales')) {
    return (
      <dl className={grid}>
        <Fact label={t('clientmap.tooltip.contract')} value={formatMoneyCompact(node.contract_value)} strong />
        <Fact label={t('clientmap.tooltip.owner')} value={ownerName(node)} />
      </dl>
    );
  }
  return (
    <dl className={grid}>
      <Fact label={t('clientmap.tooltip.contract')} value={formatMoneyCompact(node.contract_value)} strong />
      <Fact label={t('clientmap.tooltip.pipeline')} value={formatMoneyCompact(node.pipeline_value)} strong />
      <Fact label={t('clientmap.tooltip.opportunities')} value={String(node.open_opportunities)} />
      <Fact label={t('clientmap.tooltip.owner')} value={ownerName(node)} />
    </dl>
  );
}

export function MapTooltip({ id, node, eco, anchor, canvas, docked, touch, onOpen }: MapTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (docked) return;
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 12;
    const m = 8;
    let left = anchor.x + anchor.r + gap;
    let top = anchor.y - h / 2;
    if (left + w > canvas.width - m) left = anchor.x - anchor.r - gap - w;
    if (left < m) {
      // no room on either side: above (or below) the bubble
      left = anchor.x - w / 2;
      top = anchor.y - anchor.r - gap - h;
      if (top < m) top = anchor.y + anchor.r + gap;
    }
    left = Math.round(clamp(left, m, canvas.width - w - m));
    top = Math.round(clamp(top, m, canvas.height - h - m));
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  });

  const hub = node.kind === 'ecosystem';
  const title = hub ? eco?.name ?? node.label : node.label;
  const hint = hub ? t('clientmap.tooltip.hubHint') : touch ? t('clientmap.tooltip.openTouch') : t('clientmap.tooltip.open');
  const badges =
    node.kind === 'account' && node.health ? (
      <HealthBadge health={node.health} size="sm" />
    ) : node.kind === 'lead' ? (
      <>
        <Badge variant="outline" className="border-dashed">
          {t('clientmap.kind.lead')}
        </Badge>
        {node.fit_grade ? <Badge>{t('clientmap.tooltip.fitValue', { grade: node.fit_grade })}</Badge> : null}
      </>
    ) : hub && eco ? (
      <Badge variant="primary">{t('clientmap.map.companies', { count: eco.account_count + (isFeatureOn('targets') ? eco.lead_count : 0) })}</Badge>
    ) : null;

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={cn(
        'absolute z-20 overflow-hidden rounded-xl border border-border/70 bg-card shadow-pop',
        // fades in when it appears (moving between bubbles keeps the same card: no replay)
        docked ? 'inset-x-2 bottom-2 animate-pop-in' : 'pointer-events-none w-[296px] animate-fade-in',
        !docked && !pos && 'invisible',
      )}
      style={docked ? undefined : { left: pos?.left ?? 0, top: pos?.top ?? 0 }}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        {hub ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
            <Network className="h-[18px] w-[18px]" />
          </span>
        ) : (
          <AccountLogo
            account={{ name: node.label, logo_url: node.logo.logo_url, brand_color: node.logo.brand_color }}
            initials={node.logo.initials}
            size="md"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-table font-semibold text-ink">{title}</p>
          <p className="truncate text-caption">{node.sublabel}</p>
        </div>
        {docked && !hub && node.href ? (
          <Button size="sm" variant="soft" onClick={onOpen} className="shrink-0">
            {t('clientmap.tooltip.openButton')}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {badges ? <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">{badges}</div> : null}
      <div className="px-4 pb-4 pt-3">
        <Facts node={node} eco={eco} />
      </div>
      {!docked || hub ? (
        <p className="flex items-center gap-1.5 border-t border-border/60 bg-subtle px-4 py-2 text-caption">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}
