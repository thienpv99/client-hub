// DESIGN §5 list pages: floating action bar of the selected tasks (ink pill at the bottom, centred over the content
// column — the 248px sidebar / 72px rail are left of it). "Nhắc khách (N)" is the one primary action.
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { RemindClientButton } from '@/components/remind/RemindButtons';

/** quiet ghost buttons on the ink bar */
const ON_INK = 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-offset-ink';

export interface BulkRemindBarProps {
  taskIds: string[];
  onClear: () => void;
}

export function BulkRemindBar({ taskIds, onClear }: BulkRemindBarProps) {
  const count = taskIds.length;
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6 md:left-[72px] lg:left-[248px]">
      <div
        role="region"
        aria-label={t('tasks.company.bulkLabel')}
        className="pointer-events-auto flex h-12 w-fit max-w-full animate-pop-in items-center gap-1.5 rounded-xl bg-ink pl-4 pr-1.5 text-primary-foreground shadow-pop"
      >
        <p className="whitespace-nowrap text-table font-medium tabular" aria-live="polite">
          {t('tasks.company.selected', { count })}
        </p>
        <span className="mx-1 h-5 w-px shrink-0 bg-primary-foreground/20" aria-hidden="true" />
        <Button type="button" variant="ghost" size="sm" className={`hidden sm:inline-flex ${ON_INK}`} onClick={onClear}>
          {t('tasks.company.clearSelection')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={`sm:hidden ${ON_INK}`}
          aria-label={t('tasks.company.clearSelection')}
          title={t('tasks.company.clearSelection')}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </Button>
        <RemindClientButton
          taskIds={taskIds}
          size="sm"
          variant="default"
          label={t('tasks.company.remindSelected', { count })}
          onDone={onClear}
          className="focus-visible:ring-offset-ink"
        />
      </div>
    </div>
  );
}
