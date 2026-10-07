import { Lock } from 'lucide-react';
import type { BlockerRef } from '@/services/contract';
import { t } from '@/i18n';
import { cx } from './cx';
import { DueLabel } from './due-label';
import { sideLabel } from './labels';

export function blockerText(b: BlockerRef): string {
  if (b.title === null || b.title.trim() === '') return t('components.blocked.waitingHidden');
  const who = b.assignee?.full_name ?? sideLabel(b.side);
  return t('components.blocked.waiting', { task: b.title, who });
}

export interface BlockedNoteProps {
  blockers: BlockerRef[];
  className?: string;
}

/** Lock + "Đang chờ: Duyệt thiết kế màn hình Đặt hàng – Trần Quang Minh" for each unfinished blocker. */
export function BlockedNote({ blockers, className }: BlockedNoteProps) {
  if (blockers.length === 0) return null;
  return (
    <div className={cx('rounded-lg bg-subtle px-3 py-2.5 ring-1 ring-inset ring-border/60', className)}>
      <p className="sr-only">{t('components.blocked.label')}</p>
      <ul className="space-y-2">
        {blockers.map((b) => (
          <li key={b.id} className="flex items-start gap-2.5 text-table text-muted-foreground">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-xs" aria-hidden="true">
              <Lock className="h-3 w-3" strokeWidth={2.25} />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-words">{blockerText(b)}</span>
              {b.status !== 'done' && b.due.overdue ? <DueLabel due={b.due} compact /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
