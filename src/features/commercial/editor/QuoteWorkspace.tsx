// Editable quote (new or draft): general info, lines with live totals, notes and the timeline in the main column;
// the summary card (grand total, discount vs threshold, workflow actions) on the side. Unsaved edits show a sticky
// bar with the new total and "Lưu nháp".
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Save, Undo2 } from 'lucide-react';
import type { AccountRef, ActivityView, QuoteDetail, QuoteLineView } from '@/services/contract';
import { InternalNoteBox } from '@/components/common/internal-note-box';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { needsDirectorApproval } from '@/domain/quoteMath';
import { todayISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { api } from '@/services/api';
import type { Catalog } from './draft';
import { diffDraft, draftFromDetail, draftToInput, emptyDraft, priceDraft, validateDraft } from './draft';
import { EditorLayout, LinesCard } from './EditorLayout';
import { LineEditor } from './LineEditor';
import { ActionNote, QuoteActions } from './QuoteActions';
import { QuoteHeader } from './QuoteHeader';
import { QuoteSummaryCard } from './QuoteSummary';
import { QuoteTimeline } from './QuoteTimeline';
import { TotalsBreakdown } from './TotalsPanel';
import { useDraftState } from './useDraftState';

export interface QuoteWorkspaceProps {
  /** null = new quote */
  quote: QuoteDetail | null;
  account: AccountRef;
  catalog: Catalog;
  thresholdPct: number;
  projects: { id: string; name: string }[];
  parentLines: QuoteLineView[] | null;
  parentVersion: number | null;
  activities: ActivityView[];
  /** new quote opened from a sales opportunity ("Tạo báo giá"): linked to it right after the first save */
  opportunityId?: string | null;
}

export function QuoteWorkspace({
  quote,
  account,
  catalog,
  thresholdPct,
  projects,
  parentLines,
  parentVersion,
  activities,
  opportunityId = null,
}: QuoteWorkspaceProps) {
  const uid = useId();
  const navigate = useNavigate();
  const { run, pending: saving } = useAction();
  const source = useMemo(() => (quote ? draftFromDetail(quote) : emptyDraft(todayISO())), [quote]);
  const { draft, setDraft, dirty, reset } = useDraftState(source);
  const [showErrors, setShowErrors] = useState(false);

  const errors = validateDraft(draft);
  const pricing = useMemo(() => priceDraft(draft, catalog), [draft, catalog]);
  const diff = useMemo(() => (parentLines ? diffDraft(draft, catalog, parentLines) : null), [draft, catalog, parentLines]);
  const eff = pricing.totals.effective_discount_pct;
  const liveNeeds = needsDirectorApproval(eff, thresholdPct);
  const priceChanged = !!quote && (pricing.totals.grand_total !== quote.totals.grand_total || eff !== quote.totals.effective_discount_pct);
  const liveApproved = !!quote?.approved && !(priceChanged && liveNeeds);

  const diffCounts = useMemo(() => {
    if (!diff) return null;
    let added = 0;
    let modified = 0;
    for (const d of diff.byKey.values()) {
      if (d.change === 'added') added += 1;
      else if (d.change === 'modified') modified += 1;
    }
    return { added, modified, removed: diff.removed.length };
  }, [diff]);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save(): Promise<QuoteDetail | undefined> {
    setShowErrors(true);
    if (errors.any) return undefined;
    const input = draftToInput(draft);
    if (!quote) {
      const created = await run(() => api.createQuote(account.id, input), { success: 'commercial.editor.toast.created' });
      if (created) {
        // the deal now points at its quote (the api checks the quote belongs to the deal's account)
        if (opportunityId) {
          await run(() => api.updateOpportunity(opportunityId, { quote_id: created.id }), { success: 'commercial.editor.toast.linkedOpportunity' });
        }
        reset(draftFromDetail(created));
        navigate(`/app/commercial/quotes/${created.id}`, { replace: true });
      }
      return created;
    }
    const saved = await run(() => api.saveQuoteDraft(quote.id, input), { success: 'commercial.editor.toast.saved' });
    if (saved) {
      reset(draftFromDetail(saved));
      setShowErrors(false);
    }
    return saved;
  }

  const titleError = showErrors && errors.title ? t('commercial.editor.titleRequired') : null;
  const dateError = showErrors && errors.valid_until ? t('commercial.editor.dateInvalid') : null;

  const actions = quote ? (
    <QuoteActions
      quote={quote}
      dirty={dirty}
      invalid={errors.any}
      saving={saving}
      save={save}
      live={{ effective: eff, needsApproval: liveNeeds, approved: liveApproved, grandTotal: pricing.totals.grand_total }}
    />
  ) : (
    <div className="space-y-3">
      <Button onClick={() => void save()} loading={saving} className="w-full">
        {saving ? null : <Save aria-hidden="true" />}
        {t('commercial.actions.createDraft')}
      </Button>
      <ActionNote icon={Info} tone={liveNeeds ? 'warning' : 'neutral'}>
        {liveNeeds ? t('commercial.actions.newNeedsApproval', { threshold: thresholdPct }) : t('commercial.actions.newHint')}
      </ActionNote>
    </div>
  );

  return (
    <EditorLayout
      summaryFirst={!!quote}
      header={<QuoteHeader quote={quote} account={account} dirty={dirty} titleOverride={draft.title} />}
      summary={
        <QuoteSummaryCard totals={pricing.totals} thresholdPct={thresholdPct} accountName={account.name} approved={liveApproved} actions={actions} />
      }
      footer={
        dirty ? (
          <div
            role="region"
            aria-label={t('commercial.editor.unsavedLabel')}
            className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/95 p-3 shadow-pop backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:flex-row sm:items-center sm:justify-between sm:pl-5"
          >
            <p className="min-w-0 text-table text-foreground" role="status">
              <span className="font-medium">
                {errors.any && showErrors ? t('commercial.editor.unsavedInvalid') : t('commercial.editor.unsaved')}
              </span>{' '}
              <span className="text-muted-foreground tabular">
                {t('commercial.editor.unsavedTotal', { total: formatMoney(pricing.totals.grand_total) })}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="ghost" onClick={() => reset(source)} disabled={saving}>
                <Undo2 aria-hidden="true" />
                {t('commercial.editor.discard')}
              </Button>
              <Button onClick={() => void save()} loading={saving}>
                {saving ? null : <Save aria-hidden="true" />}
                {quote ? t('commercial.actions.saveDraft') : t('commercial.actions.createDraft')}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <SectionCard title={t('commercial.editor.infoTitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('commercial.editor.titleLabel')} htmlFor={`${uid}-title`} required error={titleError} className="sm:col-span-2">
            <Input
              id={`${uid}-title`}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={t('commercial.editor.titlePlaceholder')}
              autoComplete="off"
            />
          </FormField>
          <FormField label={t('commercial.editor.projectLabel')} htmlFor={`${uid}-project`}>
            <NativeSelect id={`${uid}-project`} value={draft.project_id ?? ''} onChange={(e) => set('project_id', e.target.value || null)}>
              <option value="">{t('commercial.editor.noProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('commercial.editor.validUntilLabel')} htmlFor={`${uid}-valid`} required error={dateError}>
            <Input id={`${uid}-valid`} type="date" value={draft.valid_until} min={todayISO()} onChange={(e) => set('valid_until', e.target.value)} />
          </FormField>
        </div>
      </SectionCard>

      <LinesCard
        description={
          parentVersion ? t('commercial.diff.legend', { version: parentVersion }) : t('commercial.editor.linesHint', { account: account.name })
        }
        diff={diffCounts}
        totals={
          draft.lines.length > 0 || errors.discount_total ? (
            <TotalsBreakdown
              className="w-full sm:max-w-sm"
              totals={pricing.totals}
              headerPct={0}
              headerInput={{ value: draft.discount_pct_total, onChange: (v) => set('discount_pct_total', v), invalid: errors.discount_total }}
            />
          ) : null
        }
      >
        <LineEditor
          lines={draft.lines}
          onChange={(lines) => set('lines', lines)}
          catalog={catalog}
          pricing={pricing}
          diff={diff}
          parentVersion={parentVersion}
          errors={errors}
          showErrors={showErrors}
        />
      </LinesCard>

      <SectionCard title={t('commercial.editor.notesTitle')}>
        <div className="space-y-4">
          <FormField label={t('commercial.editor.notesLabel')} htmlFor={`${uid}-notes`} hint={t('commercial.editor.notesHint')}>
            <Textarea id={`${uid}-notes`} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormField>
          <InternalNoteBox>
            <label htmlFor={`${uid}-internal`} className="sr-only">
              {t('commercial.editor.internalLabel')}
            </label>
            <Textarea
              id={`${uid}-internal`}
              rows={2}
              value={draft.internal_note}
              onChange={(e) => set('internal_note', e.target.value)}
              placeholder={t('commercial.editor.internalPlaceholder')}
              className="mt-1 bg-card"
            />
          </InternalNoteBox>
        </div>
      </SectionCard>

      {quote ? (
        <SectionCard title={t('commercial.timeline.title')}>
          <QuoteTimeline quote={quote} activities={activities} />
        </SectionCard>
      ) : null}
    </EditorLayout>
  );
}
