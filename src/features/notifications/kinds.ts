// Notification kinds: icon, label and display order (bell page filters, outbox rows).
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Forward,
  Info,
  MessageSquare,
  Newspaper,
  Receipt,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { NotificationView } from '@/services/contract';
import { enumLabel } from '@/components/common/labels';

export type NotificationKind = NotificationView['kind'];

export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  due_soon: Clock,
  overdue: CircleAlert,
  escalation: TriangleAlert,
  reminder: BellRing,
  task_update: CircleCheck,
  comment: MessageSquare,
  approval_needed: ClipboardCheck,
  quote: Receipt,
  payment: Wallet,
  delegated: Forward,
  digest: Newspaper,
  system: Info,
};

/** most actionable first (filter chips follow this order) */
export const KIND_ORDER: NotificationKind[] = [
  'escalation',
  'overdue',
  'due_soon',
  'reminder',
  'approval_needed',
  'quote',
  'payment',
  'delegated',
  'task_update',
  'comment',
  'digest',
  'system',
];

export function kindIcon(kind: NotificationKind): LucideIcon {
  return KIND_ICON[kind] ?? Info;
}

/** "Leo thang", "Sắp đến hạn"… (enums.notificationKind.*) */
export function kindLabel(kind: NotificationKind): string {
  return enumLabel('notificationKind', kind);
}
