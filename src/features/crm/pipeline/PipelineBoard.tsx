// Pipeline Kanban (DESIGN §5): Đủ điều kiện → Khảo sát nhu cầu → Đề xuất & báo giá → Đàm phán on quiet subtle
// columns, plus compact Thắng / Thua summaries that are also drop targets (they open the win / lose dialogs).
// ≥1280: 4 columns · 768–1279: 2×2 grid · <768: stage chips + one column (no sideways page scroll anywhere).
import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { OpportunityView } from '@/services/crmContract';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { ChipFilter } from '@/components/common/chip-filter';
import { SMALL } from '@/components/common/cx';
import { OPEN_STAGES, stageLabel } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';
import type { CloseFlow } from '../dialogs/useCloseFlow';
import { groupByStage, recentlyClosed, sumValue, sumWeighted } from '../crmModel';
import { ClosedZone } from './ClosedZone';
import { OpportunityCard } from './OpportunityCard';
import { useStageMoves } from './useStageMoves';

export interface PipelineBoardProps {
  items: OpportunityView[];
  today: string;
  close: CloseFlow;
  /** list tab filtered on a closed stage ("Xem thêm") */
  listHref?: (stage: 'won' | 'lost') => string;
  /** the cards rise in column by column on first appearance (the page's entry tab only) */
  stagger?: boolean;
}

type DropTarget = OpenStage | 'won' | 'lost';

/** name + count pill, then "1,2 tỷ ₫ · dự kiến 300 tr ₫" */
function ColumnHeader({ stage, items, headingId }: { stage: OpenStage; items: OpportunityView[]; headingId: string }) {
  return (
    <header className="px-2 pb-2.5 pt-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <h3 id={headingId} className="min-w-0 truncate text-table font-semibold text-ink">
          {stageLabel(stage)}
        </h3>
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
          {items.length}
        </span>
      </div>
      <p className="mt-0.5 truncate text-micro tabular text-muted-foreground">
        <span className="font-medium text-foreground">{formatMoneyCompact(sumValue(items))}</span>
        {t('crm.pipeline.columnWeighted', { weighted: formatMoneyCompact(sumWeighted(items)) })}
      </p>
    </header>
  );
}

const COLUMN = 'flex min-w-0 flex-col rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60 transition-[background-color,box-shadow] duration-150';

export function PipelineBoard({ items, today, close, listHref, stagger = false }: PipelineBoardProps) {
  const moves = useStageMoves(items);
  const wide = useMediaQuery('(min-width: 768px)');
  // DESIGN §8.4: the columns fill top-down together on first appearance; moves and refetches appear without motion
  const rise = useStagger(stagger);
  const [dragging, setDragging] = useState<OpportunityView | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<OpenStage>('qualified');

  const { stageOf } = moves;
  const columns = useMemo(() => groupByStage(items, stageOf), [items, stageOf]);
  const won = useMemo(() => recentlyClosed(items, 'won', today), [items, today]);
  const lost = useMemo(() => recentlyClosed(items, 'lost', today), [items, today]);

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  const canDrop = (target: DropTarget): boolean => dragging !== null && moves.stageOf(dragging) !== target;

  const dragHandlers = (target: DropTarget) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!canDrop(target)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== target) setOver(target);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      if (over === target) setOver(null);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      const o = dragging;
      endDrag();
      if (!o || moves.stageOf(o) === target) return;
      if (target === 'won') close.askWin(o);
      else if (target === 'lost') close.askLose(o);
      else void moves.move(o, target);
    },
  });

  const menuMove = (o: OpportunityView, to: OpenStage) => {
    setFocusId(o.id);
    if (!wide) setMobileStage(to);
    void moves.move(o, to).finally(() => {
      window.setTimeout(() => setFocusId((id) => (id === o.id ? null : id)), 150);
    });
  };

  const card = (o: OpportunityView, i: number) => (
    <li key={o.id} {...rise(i)}>
      <OpportunityCard
        opp={o}
        stage={moves.stageOf(o)}
        today={today}
        moving={moves.isMoving(o.id)}
        dragging={dragging?.id === o.id}
        focusRequest={focusId === o.id}
        draggable={wide}
        onMove={(to) => menuMove(o, to)}
        onWin={() => close.askWin(o)}
        onLose={() => close.askLose(o)}
        onDragStart={setDragging}
        onDragEnd={endDrag}
      />
    </li>
  );

  const closedZones = (
    <div className="grid gap-3 md:grid-cols-2 xl:gap-4">
      <ClosedZone
        stage="won"
        items={won}
        dropping={dragging !== null}
        isOver={over === 'won'}
        moreHref={listHref?.('won')}
        {...dragHandlers('won')}
      />
      <ClosedZone
        stage="lost"
        items={lost}
        dropping={dragging !== null}
        isOver={over === 'lost'}
        moreHref={listHref?.('lost')}
        {...dragHandlers('lost')}
      />
    </div>
  );

  if (!wide) {
    const list = columns[mobileStage];
    return (
      <div className="space-y-4">
        <ChipFilter<OpenStage>
          ariaLabel={t('crm.pipeline.stagePicker')}
          allowDeselect={false}
          value={mobileStage}
          onChange={(v) => v && setMobileStage(v)}
          options={OPEN_STAGES.map((s) => ({ value: s, label: stageLabel(s), count: columns[s].length }))}
        />
        <section aria-labelledby="crm-mobile-column" className={COLUMN}>
          <ColumnHeader stage={mobileStage} items={list} headingId="crm-mobile-column" />
          <ul className="flex flex-col gap-2" aria-labelledby="crm-mobile-column">
            {list.map(card)}
            {list.length === 0 ? <li className="px-3 py-8 text-center text-caption">{t('crm.pipeline.emptyColumn')}</li> : null}
          </ul>
        </section>
        {closedZones}
      </div>
    );
  }

  return (
    <div className="space-y-4 xl:space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {OPEN_STAGES.map((stage) => {
          const list = columns[stage];
          const headingId = `crm-col-${stage}`;
          const allowed = canDrop(stage);
          const isOver = over === stage && allowed;
          return (
            <section
              key={stage}
              aria-labelledby={headingId}
              {...dragHandlers(stage)}
              className={cn(COLUMN, dragging && allowed && 'ring-primary-border', isOver && 'bg-primary-soft/60 ring-2 ring-primary/50')}
            >
              <ColumnHeader stage={stage} items={list} headingId={headingId} />
              <ul className="flex min-h-24 flex-1 flex-col gap-2" aria-labelledby={headingId}>
                {list.map(card)}
                {list.length === 0 ? (
                  <li className={cn('flex flex-1 items-center justify-center px-3 py-8 text-center', SMALL, isOver ? 'text-primary' : 'text-muted-foreground')}>
                    {isOver ? t('crm.pipeline.dropHere') : t('crm.pipeline.emptyColumn')}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
      {closedZones}
      <p className="hidden text-micro text-muted-foreground lg:block">{t('crm.pipeline.dragHint')}</p>
    </div>
  );
}
