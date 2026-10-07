// Neutral placeholder used by feature stubs until each feature replaces its files.
import { Sparkles } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

export function ComingSoon({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-dashed border-border bg-card text-muted-foreground',
        compact ? 'p-4 text-table' : 'p-8 text-body',
        className,
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0 text-caption" aria-hidden />
      <span>{t('common.comingSoon')}</span>
    </div>
  );
}
