// Stage stepper Đủ điều kiện → Khảo sát nhu cầu → Đề xuất & báo giá → Đàm phán. On an open deal every other
// step is a button that moves the deal there; won / lost deals show the outcome instead of a current step.
import { Check, CircleCheck, CircleX } from 'lucide-react';
import type { OpportunityStage } from '@/domain/crmTypes';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { isOpenStage, OPEN_STAGES, stageLabel } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';

export interface StageProgressProps {
  stage: OpportunityStage;
  /** for a lost deal: the last open stage it reached (from the history), if known */
  lostAt?: OpenStage | null;
  onMove?: (to: OpenStage) => void;
  disabled?: boolean;
}

export function StageProgress({ stage, lostAt = null, onMove, disabled = false }: StageProgressProps) {
  const open = isOpenStage(stage);
  const reached = stage === 'won' ? OPEN_STAGES.length - 1 : open ? OPEN_STAGES.indexOf(stage) : lostAt ? OPEN_STAGES.indexOf(lostAt) : -1;
  return (
    <div className="space-y-3">
      <ol className="grid grid-cols-4 gap-1 sm:gap-2" aria-label={t('crm.opportunity.stepperLabel')}>
        {OPEN_STAGES.map((s, i) => {
          const current = open && s === stage;
          const done = stage === 'won' ? true : i < reached || (!open && i === reached);
          const state = current ? 'current' : done ? 'done' : 'upcoming';
          const body = (
            <>
              <span
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors duration-150',
                  state === 'current'
                    ? 'bg-primary'
                    : state === 'done'
                      ? stage === 'lost'
                        ? 'bg-border-strong'
                        : 'bg-chart-3'
                      : 'bg-muted group-hover/step:bg-border-strong',
                )}
                aria-hidden="true"
              />
              {/* phones: bars only (the current stage is spelled out below) */}
              <span className="hidden min-w-0 items-start gap-1 sm:flex">
                {state === 'done' ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                <span
                  className={cn('min-w-0 break-words text-left', SMALL, state === 'current' ? 'font-semibold text-ink' : 'text-muted-foreground')}
                >
                  {stageLabel(s)}
                </span>
              </span>
              <span className="sr-only sm:hidden">{stageLabel(s)}</span>
              <span className="sr-only">{t(`crm.opportunity.stepState.${state}`)}</span>
            </>
          );
          const canClick = open && !current && !disabled && onMove !== undefined;
          return (
            <li key={s} aria-current={current ? 'step' : undefined} className="min-w-0">
              {canClick ? (
                <button
                  type="button"
                  onClick={() => onMove?.(s)}
                  title={t('crm.opportunity.moveTo', { stage: stageLabel(s) })}
                  aria-label={t('crm.opportunity.moveToStep', { stage: stageLabel(s), state: t(`crm.opportunity.stepState.${state}`) })}
                  className="group/step touch-tap flex w-full flex-col gap-2 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-subtle"
                >
                  {body}
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      {open ? (
        <p className="text-table text-foreground sm:hidden">
          {t('crm.opportunity.currentStep', { stage: stageLabel(stage), n: OPEN_STAGES.indexOf(stage) + 1, total: OPEN_STAGES.length })}
        </p>
      ) : null}
      {stage === 'won' ? (
        <p className="inline-flex items-center gap-1.5 text-table font-medium text-success">
          <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('crm.opportunity.wonLine')}
        </p>
      ) : stage === 'lost' ? (
        <p className="inline-flex items-center gap-1.5 text-table font-medium text-muted-foreground">
          <CircleX className="h-4 w-4 shrink-0" aria-hidden="true" />
          {lostAt ? t('crm.opportunity.lostAtLine', { stage: stageLabel(lostAt) }) : t('crm.opportunity.lostLine')}
        </p>
      ) : null}
    </div>
  );
}
