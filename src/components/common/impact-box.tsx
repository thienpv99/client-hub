import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Clock, Flag } from 'lucide-react';
import type { MilestoneRef } from '@/services/contract';
import { t } from '@/i18n';
import type { TParams } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';

/** Milestone tag: "⚑ UAT 28/10 → ◷ 03/11" (slip in danger) or "⚑ Chạy thử 30/10". */
export function MilestoneTag({ milestone: m, className }: { milestone: MilestoneRef; className?: string }) {
  const shifted = m.forecast_date !== m.planned_date;
  const later = m.forecast_date > m.planned_date;
  return (
    <span
      className={cx(
        'inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-card px-2 py-1 text-muted-foreground shadow-xs ring-1 ring-inset ring-border/80',
        SMALL,
        className,
      )}
    >
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{m.name}</span>
      <span className="inline-flex shrink-0 items-center gap-1 tabular">
        {shifted ? <span className="sr-only">{t('components.forecast.plannedSr')} </span> : null}
        {formatDateShort(shifted ? m.planned_date : m.forecast_date)}
        {shifted ? (
          <>
            <ArrowRight className="h-3 w-3 text-caption" aria-hidden="true" />
            <span className={cx('inline-flex items-center gap-0.5', later ? 'font-semibold text-danger' : 'font-medium text-foreground')}>
              <span className="sr-only">{t('components.forecast.forecastSr')} </span>
              {later ? <Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
              {formatDateShort(m.forecast_date)}
            </span>
          </>
        ) : null}
      </span>
    </span>
  );
}

/** slipped milestones the overdue sentence names before "… và N mốc khác" (the rest stay as tags) */
const SLIPS_IN_SENTENCE = 2;

/** t() whose `{placeholders}` listed in `nodes` become React nodes (t keeps unknown placeholders as-is). */
function tNodes(key: string, params: TParams, nodes: Record<string, ReactNode>): ReactNode {
  return t(key, params)
    .split(/(\{\w+\})/)
    .map((part, i) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return <Fragment key={i}>{name !== undefined && name in nodes ? nodes[name] : part}</Fragment>;
    });
}

/** "A, B và C" */
function joinNodes(items: ReactNode[]): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i === 0 ? null : i === items.length - 1 ? ` ${t('common.and')} ` : ', '}
      {item}
    </Fragment>
  ));
}

/** "UAT lùi 29/10 → ◷ 04/11": the forecast date in danger with its icon, the same marks as the milestone tag. */
function SlipText({ milestone: m }: { milestone: MilestoneRef }) {
  // one unbreakable group (the icon is an atomic inline: a no-break space before it would not hold the line);
  // inline, not inline-flex, so the dates keep the sentence's baseline
  const dates = (
    <span className="whitespace-nowrap tabular">
      {formatDateShort(m.planned_date)}{' '}
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
      <span className="sr-only">{t('components.impact.slipToSr')}</span>{' '}
      <span className="font-semibold text-danger">
        <Clock className="mr-0.5 inline-block h-3.5 w-3.5 align-[-0.15em]" strokeWidth={2.25} aria-hidden="true" />
        {formatDateShort(m.forecast_date)}
      </span>
    </span>
  );
  return <>{tNodes('components.impact.slip', { name: m.name }, { dates })}</>;
}

/** The overdue lead sentence + the milestones it did not name (they stay as tags). */
function overdueLead(days: number, milestones: MilestoneRef[]): { sentence: ReactNode; rest: MilestoneRef[] } {
  const slips = milestones.filter((m) => m.forecast_date > m.planned_date);
  if (slips.length === 0) {
    return {
      sentence: t(milestones.length > 0 ? 'components.impact.overdueOnPlan' : 'components.impact.overdue', { days }),
      rest: milestones,
    };
  }
  const named = slips.slice(0, SLIPS_IN_SENTENCE);
  const more = slips.length - named.length;
  const items: ReactNode[] = named.map((m) => <SlipText key={m.id} milestone={m} />);
  if (more > 0) items.push(t('components.impact.moreMilestones', { count: more }));
  return {
    sentence: tNodes('components.impact.overdueSlip', { days }, { slips: joinNodes(items) }),
    rest: milestones.filter((m) => !named.includes(m)),
  };
}

export interface ImpactBoxProps {
  /** the task's impact_text ("Nếu chưa duyệt trước 15/10, …") */
  text: string;
  /** milestones this task holds back (task.blocks_milestones) */
  milestones: MilestoneRef[];
  /**
   * days the task is overdue (task.due.overdue_days; 0 = not overdue). Above 0 the box turns into "Đang ảnh hưởng":
   * a sentence about what is already happening ("Đã trễ 6 ngày: mốc UAT lùi 29/10 → 04/11."), the milestones it names
   * leave the tag row, and the original conditional sentence becomes a muted caption ("Lưu ý ban đầu: …").
   */
  overdueDays?: number;
  /** false = no milestone tags (the drawer's impact chain already names them); the overdue sentence still uses them */
  showTags?: boolean;
  className?: string;
}

/** true when ImpactBox renders something for these props (callers that frame it, e.g. with a divider, check first) */
export function impactBoxHasContent({ text, milestones, overdueDays = 0, showTags = true }: Omit<ImpactBoxProps, 'className'>): boolean {
  if (text.trim() !== '') return true;
  return milestones.length > 0 && (showTags || overdueDays > 0);
}

/**
 * "Nếu chưa làm" inset panel: 1–2 consequence sentences + tags of the affected milestones (SPEC §5.1). Once the task
 * is overdue the consequence is no longer conditional: "Đang ảnh hưởng" + what has slipped, the original text muted.
 */
export function ImpactBox({ text, milestones, overdueDays = 0, showTags = true, className }: ImpactBoxProps) {
  if (!impactBoxHasContent({ text, milestones, overdueDays, showTags })) return null;
  const body = text.trim();
  const overdue = overdueDays > 0;
  const lead = overdue ? overdueLead(overdueDays, milestones) : null;
  const tags = showTags ? (lead ? lead.rest : milestones) : [];
  return (
    <div className={cx('rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4', className)}>
      <p className="text-micro font-semibold text-muted-foreground">
        {t(overdue ? 'components.impact.overdueTitle' : 'components.impact.title')}
      </p>
      {lead ? <p className="mt-1 text-table text-foreground sm:text-body">{lead.sentence}</p> : null}
      {body && !overdue ? <p className="mt-1 text-table text-foreground sm:text-body">{body}</p> : null}
      {tags.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t('components.impact.milestones')}>
          {tags.map((m) => (
            <li key={m.id} className="max-w-full">
              <MilestoneTag milestone={m} />
            </li>
          ))}
        </ul>
      ) : null}
      {body && overdue ? (
        <p className="mt-2 break-words text-caption">
          <span className="font-medium">{t('components.impact.original')}</span> {body}
        </p>
      ) : null}
    </div>
  );
}
