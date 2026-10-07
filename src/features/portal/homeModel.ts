// Pure helpers of the client home: which project leads the progress card, which milestone the status hero names.
import type { MilestoneView, ProjectView, StatusLine } from '@/services/contract';

/**
 * The project to show first: a project still running (it has a next milestone) before a finished one, then the one
 * whose next milestone slips the most (ties → listed order).
 */
export function mainProject(progress: ProjectView[]): ProjectView | null {
  let best: ProjectView | null = null;
  for (const p of progress) {
    if (!best) {
      best = p;
      continue;
    }
    const running = p.next_milestone !== null;
    const bestRunning = best.next_milestone !== null;
    if (running !== bestRunning) {
      if (running) best = p;
      continue;
    }
    const delay = p.next_milestone?.delay_days ?? 0;
    const bestDelay = best.next_milestone?.delay_days ?? 0;
    if (delay > bestDelay) best = p;
  }
  return best;
}

export function doneCount(p: ProjectView): number {
  return p.milestones.filter((m) => m.status === 'done').length;
}

/**
 * The milestone chip of the status hero (DESIGN §5: "milestone + forecast chip"): the milestone the sentence names
 * when it is unambiguous among the open milestones shown, else — for a calm or generic sentence — the next
 * milestone of the main project. null → StatusBand falls back to its own chip (e.g. "Go-live · lùi 6 ngày").
 */
export function bandMilestone(line: StatusLine, progress: ProjectView[]): MilestoneView | null {
  switch (line.kind) {
    case 'waiting_client':
    case 'waiting_internal':
    case 'due_soon_blocking': {
      const matches = progress.flatMap((p) => p.milestones.filter((m) => m.status !== 'done' && m.name === line.milestone_name));
      return matches.length === 1 ? (matches[0] ?? null) : null;
    }
    case 'payment_overdue':
      return null;
    case 'on_track':
    case 'overdue':
    case 'generic':
      return mainProject(progress)?.next_milestone ?? null;
    default:
      return null;
  }
}
