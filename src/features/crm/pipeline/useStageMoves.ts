// Optimistic stage moves: the card shows its new column at once; the override is dropped when fresh data agrees
// (useQuery refetches after the mutation) or when the call fails.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpportunityStage } from '@/domain/crmTypes';
import type { OpportunityView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { stageLabel } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';

export interface StageMoves {
  stageOf(o: OpportunityView): OpportunityStage;
  move(o: OpportunityView, to: OpenStage): Promise<void>;
  isMoving(id: string): boolean;
}

export function useStageMoves(items: OpportunityView[] | undefined): StageMoves {
  const { run } = useAction();
  const [pending, setPending] = useState<Record<string, OpenStage>>({});
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  // fresh data caught up → drop the override
  useEffect(() => {
    if (!items) return;
    setPending((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const o of items) {
        if (next[o.id] !== undefined && next[o.id] === o.stage) {
          delete next[o.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const drop = useCallback((id: string) => {
    setPending((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const stageOf = useCallback((o: OpportunityView): OpportunityStage => pending[o.id] ?? o.stage, [pending]);

  const move = useCallback(
    async (o: OpportunityView, to: OpenStage) => {
      if ((pending[o.id] ?? o.stage) === to) return;
      setPending((prev) => ({ ...prev, [o.id]: to }));
      const result = await run(() => api.moveOpportunityStage(o.id, to), {
        success: 'crm.pipeline.toast.moved',
        successParams: { name: o.name, stage: stageLabel(to) },
      });
      if (!result) {
        drop(o.id);
        return;
      }
      // safety net when the refetch never reports the new stage (e.g. another tab changed it meanwhile)
      timers.current.push(window.setTimeout(() => drop(o.id), 2500));
    },
    [pending, run, drop],
  );

  const isMoving = useCallback((id: string) => pending[id] !== undefined, [pending]);

  return { stageOf, move, isMoving };
}
