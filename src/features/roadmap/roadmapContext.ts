// Shared state of one roadmap tab (permissions, dialogs, optimistic "Khách thấy được").
import { createContext, useContext } from 'react';
import type { ID } from '@/domain/types';
import type { MilestoneView } from '@/services/contract';

export type MilestoneAction = 'edit' | 'override' | 'complete' | 'addTask';

export interface RoadmapContextValue {
  accountId: ID;
  /** director, or the AM of the account (and not in view-as) */
  canManage: boolean;
  /** first not-done milestone of the selected project */
  currentId: ID | null;
  /** today, 'YYYY-MM-DD' */
  today: string;
  onAction(action: MilestoneAction, milestone: MilestoneView): void;
  /** client_visible with the optimistic value while a toggle is saving */
  isVisible(milestone: MilestoneView): boolean;
  toggleVisible(milestone: MilestoneView, next: boolean): void;
  /** "Thêm việc vào mốc" is offered when the task form is available */
  canAddTask: boolean;
}

export const RoadmapContext = createContext<RoadmapContextValue | null>(null);

export function useRoadmap(): RoadmapContextValue {
  const ctx = useContext(RoadmapContext);
  if (!ctx) throw new Error('useRoadmap outside RoadmapContext');
  return ctx;
}
