// Compact lists of finished work on the portal tasks page: "Đã xong" (newest first, "Xem thêm") and the delegated
// tasks colleagues already finished. One card, full-bleed hairline rows (DESIGN §4).
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { UserAvatar } from '@/components/common/user-avatar';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { personName } from './portalText';
import { ClientRowStatus, CompactTaskRow } from './TaskRows';

const PAGE = 15;

export interface DoneTaskListProps {
  /** done tasks, newest first */
  tasks: TaskView[];
  showProject: boolean;
  /** task open in the drawer (row highlighted) */
  highlightId?: string | null;
  /** 'assignee': the avatar of who did it leads the row (delegated work); default: the task type icon */
  leading?: 'type' | 'assignee';
  ariaLabel?: string;
}

export function DoneTaskList({ tasks, showProject, highlightId = null, leading = 'type', ariaLabel }: DoneTaskListProps) {
  const { open } = useTaskDrawer();
  const [limit, setLimit] = useState(PAGE);
  const shown = tasks.slice(0, limit);
  const rest = tasks.length - shown.length;
  return (
    <Card className="overflow-hidden">
      <ul aria-label={ariaLabel ?? t('portal.tasks.doneListLabel')} className="divide-y divide-border/60">
        {shown.map((task) => (
          <CompactTaskRow
            key={task.id}
            task={task}
            onOpen={open}
            showProject={showProject}
            current={task.id === highlightId}
            leading={
              leading === 'assignee' ? (
                <UserAvatar user={task.assignee} size="sm" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center text-muted-foreground">
                  <TaskTypeIcon type={task.type} className="h-4 w-4" />
                </span>
              )
            }
            meta={
              <>
                <ClientRowStatus task={task} />
                {task.assignee ? (
                  leading === 'assignee' ? (
                    <span>{personName(task.assignee)}</span>
                  ) : (
                    <span>{t('portal.tasks.doneBy', { name: personName(task.assignee, true) })}</span>
                  )
                ) : null}
              </>
            }
          />
        ))}
      </ul>
      {rest > 0 ? (
        <div className="border-t border-border/60 px-2 py-1.5 sm:px-3">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            {t('portal.common.showMore', { count: Math.min(rest, PAGE) })}
            <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
