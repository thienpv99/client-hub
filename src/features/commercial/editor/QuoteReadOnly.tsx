// A quote that is not editable for this viewer / status (waiting for approval, sent, decided, expired): same layout
// as the editor without inputs. Actions still come from QuoteDetail.can (approve, new version…).
import type { ActivityView, QuoteDetail } from '@/services/contract';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { SectionCard } from '@/components/common/section-card';
import { t } from '@/i18n';
import { EditorLayout, LinesCard } from './EditorLayout';
import { LinesView } from './LinesView';
import { QuoteActions } from './QuoteActions';
import { QuoteHeader } from './QuoteHeader';
import { QuoteSummaryCard } from './QuoteSummary';
import { QuoteTimeline } from './QuoteTimeline';
import { TotalsBreakdown } from './TotalsPanel';

export function QuoteReadOnly({ quote, activities, parentVersion }: { quote: QuoteDetail; activities: ActivityView[]; parentVersion: number | null }) {
  const added = quote.lines.filter((l) => l.change === 'added').length;
  const modified = quote.lines.filter((l) => l.change === 'modified').length;
  const removed = quote.removed_lines.length;
  const hasDiff = added + modified + removed > 0;
  return (
    <EditorLayout
      header={<QuoteHeader quote={quote} account={quote.account} />}
      summary={
        <QuoteSummaryCard
          totals={quote.totals}
          thresholdPct={quote.threshold_pct}
          accountName={quote.account.name}
          approved={quote.approved}
          actions={
            <QuoteActions
              quote={quote}
              dirty={false}
              invalid={false}
              saving={false}
              save={async () => quote}
              live={{
                effective: quote.totals.effective_discount_pct,
                needsApproval: quote.needs_approval,
                approved: quote.approved,
                grandTotal: quote.totals.grand_total,
              }}
            />
          }
        />
      }
    >
      <LinesCard
        description={hasDiff && parentVersion ? t('commercial.diff.legend', { version: parentVersion }) : undefined}
        diff={hasDiff ? { added, modified, removed } : null}
        totals={<TotalsBreakdown className="w-full sm:max-w-sm" totals={quote.totals} headerPct={quote.discount_pct_total} />}
      >
        <LinesView quote={quote} parentVersion={parentVersion} />
      </LinesCard>

      <SectionCard title={t('commercial.editor.notesTitle')}>
        <div className="space-y-4">
          <div>
            <p className="text-micro font-medium text-muted-foreground">{t('commercial.editor.notesLabel')}</p>
            <p className="mt-1 whitespace-pre-line text-table text-foreground">{quote.notes || t('commercial.editor.noNotes')}</p>
          </div>
          {quote.internal_note ? (
            <InternalNoteBox>
              <p className="whitespace-pre-line">{quote.internal_note}</p>
            </InternalNoteBox>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={t('commercial.timeline.title')}>
        <QuoteTimeline quote={quote} activities={activities} />
      </SectionCard>
    </EditorLayout>
  );
}
