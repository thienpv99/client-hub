// "Chuyển sang…" — the keyboard / touch way to move a Kanban card (drag & drop is mouse-only).
import { useRef } from 'react';
import type { Ref } from 'react';
import { ArrowRightLeft, Lock } from 'lucide-react';
import type { TaskStatus, TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { moveTargets, STATUS_ICONS, statusLabel } from '../shared/taskStatus';

export interface MoveMenuProps {
  task: TaskView;
  current: TaskStatus;
  onMove: (to: TaskStatus) => void;
  className?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}

export function MoveMenu({ task, current, onMove, className, triggerRef }: MoveMenuProps) {
  const targets = moveTargets(task, current);
  // after a move the card re-mounts in its new column and takes the focus itself (KanbanCard focusRequest);
  // Escape / click outside returns the focus to this button as usual
  const moved = useRef(false);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn('relative z-10 h-8 w-8 text-muted-foreground hover:text-foreground', className)}
          aria-label={t('tasks.kanban.moveMenu', { task: task.title })}
          title={t('tasks.kanban.moveTo')}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        onCloseAutoFocus={(e) => {
          if (!moved.current) return;
          moved.current = false;
          e.preventDefault();
        }}
      >
        <DropdownMenuLabel>{t('tasks.kanban.moveTo')}</DropdownMenuLabel>
        {targets.map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <DropdownMenuItem
              key={s}
              onSelect={() => {
                moved.current = true;
                onMove(s);
              }}
            >
              <Icon aria-hidden="true" />
              {statusLabel(s)}
            </DropdownMenuItem>
          );
        })}
        {task.side === 'client' || task.blocked ? <DropdownMenuSeparator /> : null}
        {task.blocked ? (
          <p className="flex items-start gap-2 px-2 py-1.5 text-caption">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('tasks.kanban.blockedHint')}
          </p>
        ) : null}
        {task.side === 'client' ? <p className="px-2 py-1.5 text-caption">{t('tasks.kanban.clientOnlyHint')}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
