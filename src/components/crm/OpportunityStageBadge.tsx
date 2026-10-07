// Stage pill of an opportunity (DESIGN §4 badge). Open stages are steps, not statuses, so they stay neutral (never
// blue: the row's one blue accent stays free for its action); a 4-tick meter shows how far along the deal is.
// Won / lost are outcomes: icon + word (won in the success tint, lost neutral outline).
import { CircleCheck, CircleX } from 'lucide-react';
import type { OpportunityStage } from '@/domain/crmTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { OPEN_STAGES, stageLabel } from './crmLabels';

/** 4 small ticks, the reached ones filled (decorative: the word carries the meaning) */
function StageMeter({ stage }: { stage: OpportunityStage }) {
  const reached = (OPEN_STAGES as readonly string[]).indexOf(stage);
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[2px]">
      {OPEN_STAGES.map((s, i) => (
        <span key={s} className={cn('h-2 w-[3px] rounded-full bg-current', i <= reached ? 'opacity-90' : 'opacity-25')} />
      ))}
    </span>
  );
}

export interface OpportunityStageBadgeProps {
  stage: OpportunityStage;
  /** sm 20px (rows, cards) · md 24px (page header) */
  size?: 'sm' | 'md';
  className?: string;
}

export function OpportunityStageBadge({ stage, size = 'sm', className }: OpportunityStageBadgeProps) {
  const variant = stage === 'won' ? 'success' : stage === 'lost' ? 'outline' : 'default';
  const Icon = stage === 'won' ? CircleCheck : stage === 'lost' ? CircleX : null;
  return (
    <Badge variant={variant} size={size === 'sm' ? 'sm' : 'default'} className={className}>
      {Icon ? <Icon aria-hidden="true" /> : <StageMeter stage={stage} />}
      {stageLabel(stage)}
    </Badge>
  );
}
