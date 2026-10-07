// Small counters shown next to internal nav entries: overdue tasks (danger pill) and unread notifications.
// One cheap query; refreshes after every mutation like any useQuery.
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';

export interface NavCounts {
  /** open, overdue and not blocked (a blocked task is carried by its blocker) — own tasks for members */
  overdueTasks: number;
  unreadNotifications: number;
}

export interface NavBadge {
  count: number;
  tone: 'neutral' | 'danger';
  /** i18n key of the sr-only sentence, param {count} */
  labelKey: string;
}

export function useNavCounts(): NavCounts {
  const viewer = useViewer();
  const enabled = !!viewer && viewer.org_type === 'internal';
  const userId = viewer?.user.id;
  const isMember = viewer?.role === 'member';
  const query = useQuery<NavCounts>(
    async () => {
      const [tasks, notes] = await Promise.all([
        api.listTasks(isMember && userId ? { overdue: true, assigneeId: userId } : { overdue: true }),
        api.listNotifications({ unreadOnly: true, limit: 100 }),
      ]);
      return {
        overdueTasks: tasks.filter((task) => !task.blocked).length,
        unreadNotifications: notes.filter((n) => !n.read_at).length,
      };
    },
    [userId, isMember],
    { enabled },
  );
  return query.data ?? { overdueTasks: 0, unreadNotifications: 0 };
}

/** Badge of one nav entry, or null. */
export function navBadgeFor(itemId: string, counts: NavCounts): NavBadge | null {
  if (itemId === 'tasks' && counts.overdueTasks > 0) {
    return { count: counts.overdueTasks, tone: 'danger', labelKey: 'layout.nav.overdueBadge' };
  }
  if (itemId === 'notifications' && counts.unreadNotifications > 0) {
    return { count: counts.unreadNotifications, tone: 'neutral', labelKey: 'layout.nav.unreadBadge' };
  }
  return null;
}
