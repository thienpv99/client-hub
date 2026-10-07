import type { TaskType } from '@/services/contract';
import { cx } from './cx';
import { TASK_TYPE_ICONS, taskTypeLabel } from './taskLabels';

export interface TaskTypeIconProps {
  type: TaskType;
  /** icon inside a soft rounded square (cards, drawer header) */
  boxed?: boolean;
  /** announce the type to screen readers (otherwise decorative) */
  labelled?: boolean;
  className?: string;
}

export function TaskTypeIcon({ type, boxed = false, labelled = false, className }: TaskTypeIconProps) {
  const Icon = TASK_TYPE_ICONS[type];
  const a11y = labelled ? { role: 'img' as const, 'aria-label': taskTypeLabel(type) } : { 'aria-hidden': true as const };
  if (!boxed) return <Icon className={cx('h-4 w-4 shrink-0', className)} {...a11y} />;
  return (
    <span
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary ring-1 ring-inset ring-primary-border/60',
        className,
      )}
      {...a11y}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
