// Labels and icons for task types / primary actions (SPEC §3).
import { Banknote, CalendarCheck, CheckCheck, FileCheck2, MessageCircleQuestion, PenLine, Upload, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskActionKind, TaskType } from '@/services/contract';
import { enumLabel } from './labels';

/** "Xem & duyệt", "Tải lên", "Báo đã chuyển khoản"… (enums.taskAction.*) */
export function taskActionLabel(kind: TaskActionKind): string {
  return enumLabel('taskAction', kind);
}

/** "Phê duyệt", "Cung cấp tài liệu"… (enums.taskType.*) */
export function taskTypeLabel(type: TaskType): string {
  return enumLabel('taskType', type);
}

/** lucide-react export name per task type */
export const taskTypeIconName: Record<TaskType, string> = {
  approval: 'FileCheck2',
  upload: 'Upload',
  confirm: 'CheckCheck',
  sign: 'PenLine',
  payment: 'Banknote',
  attend: 'CalendarCheck',
  answer: 'MessageCircleQuestion',
  work: 'Wrench',
};

export const TASK_TYPE_ICONS: Record<TaskType, LucideIcon> = {
  approval: FileCheck2,
  upload: Upload,
  confirm: CheckCheck,
  sign: PenLine,
  payment: Banknote,
  attend: CalendarCheck,
  answer: MessageCircleQuestion,
  work: Wrench,
};

export function taskTypeIcon(type: TaskType): LucideIcon {
  return TASK_TYPE_ICONS[type];
}
