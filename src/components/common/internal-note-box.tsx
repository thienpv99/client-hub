import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { t } from '@/i18n';
import { cx } from './cx';

export interface InternalNoteBoxProps {
  children: ReactNode;
  /** heading above the content; default "Ghi chú nội bộ", false hides it */
  title?: ReactNode | false;
  className?: string;
}

/** Pale yellow inset panel with a lock for internal-only content (SPEC §4.2). */
export function InternalNoteBox({ children, title, className }: InternalNoteBoxProps) {
  return (
    <div className={cx('flex gap-3 rounded-lg bg-note p-3 text-table text-foreground ring-1 ring-inset ring-note-border sm:p-4', className)}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-warning shadow-xs" aria-hidden="true">
        <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1 self-center">
        {title === false ? null : (
          <p className="text-micro font-semibold text-warning">{title ?? t('components.internal.noteTitle')}</p>
        )}
        <div className={cx('break-words', title === false ? '' : 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}
