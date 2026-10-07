// Layout of a quote (editable or read-only): header, then from xl a main column (info, lines + totals, notes,
// timeline) and a sticky side column with the summary card (the focal block). Below xl one column, summary first so
// the grand total and the next action are above the fold on iPad and phones (DESIGN §6, §7.2).
import type { ReactNode } from 'react';
import { SectionCard } from '@/components/common/section-card';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { DiffSummary } from './LineBits';

export function EditorLayout({
  header,
  summary,
  children,
  footer,
  summaryFirst = true,
}: {
  header: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** below xl the summary leads; a brand-new quote (nothing to sum yet) starts with the form instead */
  summaryFirst?: boolean;
}) {
  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <aside
          aria-label={t('commercial.editor.summaryLabel')}
          className={cn('min-w-0 xl:sticky xl:top-[72px] xl:col-start-2 xl:row-start-1', summaryFirst ? '' : 'order-last xl:order-none')}
        >
          {summary}
        </aside>
        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">{children}</div>
      </div>
      {footer}
    </div>
  );
}

/** "Hạng mục" card: the lines edge to edge, then the totals breakdown on the right (invoice layout). */
export function LinesCard({
  description,
  diff,
  children,
  totals,
}: {
  description?: ReactNode;
  diff?: { added: number; modified: number; removed: number } | null;
  children: ReactNode;
  /** null while there are no lines (a column of zeros says nothing) */
  totals: ReactNode;
}) {
  return (
    <SectionCard
      title={t('commercial.editor.linesTitle')}
      description={description}
      actions={diff ? <DiffSummary added={diff.added} modified={diff.modified} removed={diff.removed} /> : undefined}
      flush
    >
      {children}
      {totals ? <div className="flex justify-end px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{totals}</div> : <div className="pb-4 sm:pb-5" />}
    </SectionCard>
  );
}
