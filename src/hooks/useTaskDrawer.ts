// Task drawer state lives in the URL search param `task` (owner G1), so links and the back button work.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TaskDrawerState {
  taskId: string | null;
  open(id: string): void;
  close(): void;
}

export const TASK_PARAM = 'task';

export function useTaskDrawer(): TaskDrawerState {
  const [params, setParams] = useSearchParams();
  const taskId = params.get(TASK_PARAM);

  const open = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(TASK_PARAM, id);
        return next;
      });
    },
    [setParams],
  );

  const close = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(TASK_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { taskId, open, close };
}
