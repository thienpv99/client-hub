import { ChevronRight, CircleAlert, CircleCheck, Clock, Flag } from 'lucide-react';
import type { ChainNode } from '@/services/contract';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';

function nodeLabel(node: ChainNode): string {
  if (node.label !== null && node.label.trim() !== '') return node.label;
  return node.kind === 'milestone' ? t('components.chain.milestone') : t('components.chain.hiddenTask');
}

function NodeChip({ node }: { node: ChainNode }) {
  const stuck = node.state === 'stuck';
  const done = node.state === 'done';
  const isMilestone = node.kind === 'milestone';
  const date = isMilestone ? (node.forecast_date ?? node.planned_date ?? null) : null;
  const shifted = isMilestone && node.forecast_date && node.planned_date && node.forecast_date !== node.planned_date;
  const Icon = stuck ? CircleAlert : done ? CircleCheck : isMilestone ? Flag : null;
  return (
    <span
      className={cx(
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ring-inset',
        SMALL,
        stuck && 'bg-danger-soft font-medium text-danger ring-danger/25',
        done && 'bg-subtle text-muted-foreground ring-border/70',
        !stuck && !done && 'bg-card text-foreground shadow-xs ring-border',
        isMilestone && !stuck && !done && 'font-medium',
      )}
      title={
        shifted && node.planned_date && node.forecast_date
          ? t('components.stepper.forecastTitle', { planned: formatDateShort(node.planned_date), forecast: formatDateShort(node.forecast_date) })
          : undefined
      }
    >
      {Icon ? (
        <Icon
          className={cx('h-3.5 w-3.5 shrink-0', stuck ? 'text-danger' : done ? 'text-success' : 'text-muted-foreground')}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      ) : (
        <span className="mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
      )}
      <span className="min-w-0 break-words">
        {isMilestone ? <span className="sr-only">{t('components.chain.milestone')} </span> : null}
        {nodeLabel(node)}
      </span>
      {date ? (
        <span
          className={cx(
            'inline-flex shrink-0 items-center gap-1 text-micro tabular',
            stuck ? 'text-danger' : shifted ? 'font-semibold text-danger' : 'text-muted-foreground',
          )}
        >
          {/* a slipped date is status colour: always with an icon (the stuck chip has its own) */}
          {shifted && !stuck ? <Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> : <span aria-hidden="true">·</span>}
          {formatDateShort(date)}
          {shifted && node.planned_date && node.forecast_date ? (
            <span className="sr-only">
              {' '}
              ({t('components.stepper.forecastTitle', { planned: formatDateShort(node.planned_date), forecast: formatDateShort(node.forecast_date) })})
            </span>
          ) : null}
        </span>
      ) : null}
      {stuck ? <span className="sr-only"> ({t('components.chain.stuck')})</span> : null}
      {done ? <span className="sr-only"> ({t('components.chain.done')})</span> : null}
    </span>
  );
}

export interface ImpactChainProps {
  nodes: ChainNode[];
  className?: string;
}

/**
 * "Duyệt thiết kế › Lập trình Đặt hàng › Mốc UAT › Go-live": a pill chain with chevrons that wraps when long (phones
 * included — short links share a line, a long one takes its own). The stuck link is red with an icon.
 */
export function ImpactChain({ nodes, className }: ImpactChainProps) {
  if (nodes.length === 0) return null;
  return (
    <ol aria-label={t('components.chain.label')} className={cx('flex flex-wrap items-center gap-x-1 gap-y-2', className)}>
      {nodes.map((node, i) => (
        <li key={`${node.kind}:${node.id}:${i}`} className="flex min-w-0 max-w-full items-center gap-1">
          {i > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" /> : null}
          <NodeChip node={node} />
        </li>
      ))}
    </ol>
  );
}
