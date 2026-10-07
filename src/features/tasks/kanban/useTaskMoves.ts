// Optimistic Kanban moves: the card jumps to its new column at once; a refused move (blocked task, rule)
// snaps back and useAction toasts the reason ("Việc này đang chờ: …"). The override is dropped once the refreshed
// list reflects the move, so the card never flickers back while useQuery refetches.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskStatus, TaskView } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { toastApiError, useAction } from '@/hooks/useAction';
import { toastSuccess } from '@/lib/toast';
import { canDropOn, statusLabel } from '../shared/taskStatus';

interface Override {
  status: TaskStatus;
  /** the service accepted the move; drop the override on the next data refresh */
  confirmed: boolean;
}

export interface TaskMoves {
  statusOf(task: TaskView): TaskStatus;
  /** true while a move of this task waits for the service */
  isMoving(taskId: string): boolean;
  move(task: TaskView, to: TaskStatus): Promise<void>;
}

export function useTaskMoves(tasks: TaskView[] | undefined): TaskMoves {
  const { run } = useAction();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  // a refreshed list settles confirmed moves (and any override the server state already matches)
  useEffect(() => {
    if (!tasks) return;
    setOverrides((prev) => {
      let changed = false;
      const next: Record<string, Override> = {};
      for (const [id, o] of Object.entries(prev)) {
        const task = tasks.find((x) => x.id === id);
        if (!task || task.status === o.status || o.confirmed) {
          changed = true;
          continue;
        }
        next[id] = o;
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const setOverride = useCallback((id: string, o: Override | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (o) next[id] = o;
      else delete next[id];
      return next;
    });
  }, []);

  const statusOf = useCallback((task: TaskView): TaskStatus => overrides[task.id]?.status ?? task.status, [overrides]);
  const isMoving = useCallback((taskId: string) => overrides[taskId]?.confirmed === false, [overrides]);

  const move = useCallback(
    async (task: TaskView, to: TaskStatus) => {
      const from = overridesRef.current[task.id]?.status ?? task.status;
      if (from === to) return;
      setOverride(task.id, { status: to, confirmed: false });
      const result = await run(() => api.setTaskStatus(task.id, to));
      if (!result) {
        setOverride(task.id, null); // snap back; the reason was toasted by useAction
        return;
      }
      setOverride(task.id, { status: to, confirmed: true });
      const message = t('tasks.kanban.moved', { task: task.title, status: statusLabel(to) });
      // a blocked task moved back to Cần làm cannot go forward again: no "Hoàn tác" the service would refuse
      if (!canDropOn(result, to, from)) {
        toastSuccess(message);
        return;
      }
      toastSuccess(message, {
        onUndo: async () => {
          setOverride(task.id, { status: from, confirmed: false });
          try {
            await api.setTaskStatus(task.id, from);
            setOverride(task.id, { status: from, confirmed: true });
            toastSuccess(t('common.toast.undone'));
          } catch (err) {
            setOverride(task.id, null);
            toastApiError(err);
          }
        },
      });
    },
    [run, setOverride],
  );

  return useMemo(() => ({ statusOf, isMoving, move }), [statusOf, isMoving, move]);
}
