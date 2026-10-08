// Inline edit for a short text block (exec summary, internal notes): Ctrl/Cmd+Enter saves, Esc cancels.
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { useDelayedFlag } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SMALL } from '@/components/common/cx';

export interface InlineTextEditorProps {
  initialValue: string;
  /** accessible name of the text area */
  label: string;
  placeholder?: string;
  rows?: number;
  /** at most this many non-empty lines (shows a counter) */
  maxLines?: number;
  hint?: ReactNode;
  /** resolves true when saved (the editor then closes from the parent) */
  onSave: (value: string) => Promise<boolean>;
  onCancel: () => void;
  className?: string;
}

function countLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

export function InlineTextEditor({
  initialValue,
  label,
  placeholder,
  rows = 3,
  maxLines,
  hint,
  onSave,
  onCancel,
  className,
}: InlineTextEditorProps) {
  const id = useId();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  // Cancel dims only once a save has taken 150 ms (DESIGN §8.2); its click is guarded by `saving` at once
  const savingVisible = useDelayedFlag(saving);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const lines = countLines(value);
  const tooMany = maxLines !== undefined && lines > maxLines;
  const dirty = value.trim() !== initialValue.trim();

  async function save() {
    if (saving || tooMany) return;
    if (!dirty) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return (
    // swaps in for the text with a 150 ms fade (opacity only), not a jump
    <div className={cn('animate-fade-in space-y-2', className)}>
      <Textarea
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        rows={rows}
        autoFocus
        disabled={saving}
        aria-invalid={tooMany || undefined}
        aria-describedby={`${id}-hint`}
        className="md:text-body"
      />
      {tooMany ? (
        <p className={cn('flex items-start gap-1.5 text-danger', SMALL)} aria-live="polite">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('account.editor.tooManyLines', { max: maxLines ?? 0 })}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p id={`${id}-hint`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
          {hint}
          {maxLines !== undefined ? (
            <span className={cn('tabular', tooMany && cn(SMALL, 'font-medium text-danger'))}>
              {t('account.editor.lines', { count: lines, max: maxLines })}
            </span>
          ) : null}
          <span className="hidden md:inline">{t('account.editor.shortcut')}</span>
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => (saving ? undefined : onCancel())} disabled={savingVisible}>
            {t('common.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} loading={saving} disabled={tooMany}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
