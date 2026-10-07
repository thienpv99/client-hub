// Multi-select for dependencies (tasks or milestones of the account). Opens an inline searchable list inside the
// form (no popover: it scrolls with the dialog and works the same on phones); selections show as removable chips.
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SMALL } from '@/components/common/cx';

export interface PickerOption {
  id: string;
  label: string;
  /** second line: project · milestone · due… */
  meta?: string;
  group: string;
  icon?: ReactNode;
  /** done tasks are listed last and look quieter */
  muted?: boolean;
}

export interface DependencyPickerProps {
  label: string;
  hint?: string;
  options: PickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  addLabel: string;
  searchPlaceholder: string;
  /** ids drawn with a warning outline (members of a detected cycle) */
  flagged?: ReadonlySet<string>;
}

export function DependencyPicker({ label, hint, options, value, onChange, addLabel, searchPlaceholder, flagged }: DependencyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelId = useId();
  const labelId = useId();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = new Set(value);

  const groups = useMemo(() => {
    const q = normalizeText(query);
    const out = new Map<string, PickerOption[]>();
    for (const o of options) {
      if (q && !normalizeText(`${o.label} ${o.meta ?? ''}`).includes(q)) continue;
      const list = out.get(o.group) ?? [];
      list.push(o);
      out.set(o.group, list);
    }
    return [...out.entries()];
  }, [options, query]);

  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="text-table font-medium text-foreground">
            {label}
          </p>
          {hint ? <p className="text-caption">{hint}</p> : null}
        </div>
        <Button
          type="button"
          variant={open ? 'soft' : 'secondary'}
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((o) => !o);
            setQuery('');
          }}
        >
          {open ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {open ? t('tasks.form.deps.done') : addLabel}
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-labelledby={labelId}>
          {value.map((id) => {
            const o = byId.get(id);
            const name = o?.label ?? t('tasks.form.deps.unknown');
            return (
              <li
                key={id}
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-lg py-1 pl-2.5 pr-1 text-table text-foreground ring-1 ring-inset',
                  flagged?.has(id) ? 'bg-danger-soft ring-danger/40' : 'bg-subtle ring-border/70',
                )}
              >
                {o?.icon}
                <span className="min-w-0 truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={t('tasks.form.deps.remove', { name })}
                  className="touch-tap-square inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {open ? (
        <div
          id={panelId}
          // Enter picks an item and must never submit the surrounding form
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        >
          <Command className="rounded-lg border border-border/70 shadow-card" aria-labelledby={labelId}>
            <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} aria-label={searchPlaceholder} autoFocus />
            <CommandList className="max-h-64">
              <CommandEmpty>{t('tasks.form.deps.empty')}</CommandEmpty>
              {groups.map(([group, list]) => (
                <CommandGroup key={group} heading={group}>
                  {list.map((o) => {
                    const on = selected.has(o.id);
                    return (
                      <CommandItem key={o.id} value={o.id} onSelect={() => toggle(o.id)}>
                        <span
                          className={cn(
                            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            on ? 'border-primary bg-primary text-primary-foreground' : 'border-caption bg-card',
                          )}
                          aria-hidden="true"
                        >
                          {on ? <Check className="!h-3 !w-3 !text-primary-foreground" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate', o.muted ? 'text-muted-foreground' : 'text-foreground')}>{o.label}</span>
                          {o.meta ? <span className={cn('block truncate text-muted-foreground', SMALL)}>{o.meta}</span> : null}
                          {on ? <span className="sr-only">{t('tasks.form.deps.selected')}</span> : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}
