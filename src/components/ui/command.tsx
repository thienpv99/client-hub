import * as React from 'react';
import { Search } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { menuLabelBase, menuSeparatorBase } from '@/components/ui/menu-styles';

// Own lightweight command menu (no cmdk). Filtering is done by the parent: render only matching items.
// Keyboard (anywhere inside <Command>): ArrowUp/ArrowDown, Home/End, Enter → item's onSelect.

interface CommandContextValue {
  listId: string;
  activeId: string | null;
  itemCount: number;
  setActiveId: (id: string | null) => void;
  register: () => () => void;
}

const CommandContext = React.createContext<CommandContextValue>({
  listId: '',
  activeId: null,
  itemCount: 0,
  setActiveId: () => undefined,
  register: () => () => undefined,
});

const ITEM_SELECTOR = '[data-command-item]:not([aria-disabled="true"])';

export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Wrap around from last to first item (default true). */
  loop?: boolean;
}

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, loop = true, onKeyDown, children, ...props }, ref) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
    const listId = React.useId();
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [registry, setRegistry] = React.useState({ count: 0, version: 0 });

    const register = React.useCallback(() => {
      setRegistry((r) => ({ count: r.count + 1, version: r.version + 1 }));
      return () => setRegistry((r) => ({ count: r.count - 1, version: r.version + 1 }));
    }, []);

    const enabledItems = React.useCallback((): HTMLElement[] => {
      const root = rootRef.current;
      return root ? Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) : [];
    }, []);

    // Keep a valid active item: first enabled one when nothing (or a removed item) is active.
    React.useLayoutEffect(() => {
      const items = enabledItems();
      if (items.length === 0) {
        if (activeId !== null) setActiveId(null);
        return;
      }
      if (activeId === null || !items.some((el) => el.id === activeId)) {
        const first = items[0];
        if (first) setActiveId(first.id);
      }
    }, [registry.version, activeId, enabledItems]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      // Vietnamese IMEs compose characters: never act while composing.
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      const items = enabledItems();
      if (items.length === 0) return;
      const index = items.findIndex((el) => el.id === activeId);
      const last = items.length - 1;
      const moveTo = (next: number) => {
        event.preventDefault();
        const el = items[next];
        if (!el) return;
        setActiveId(el.id);
        el.scrollIntoView({ block: 'nearest' });
      };
      switch (event.key) {
        case 'ArrowDown':
          moveTo(index < 0 ? 0 : index < last ? index + 1 : loop ? 0 : last);
          break;
        case 'ArrowUp':
          moveTo(index < 0 ? last : index > 0 ? index - 1 : loop ? last : 0);
          break;
        case 'Home':
          moveTo(0);
          break;
        case 'End':
          moveTo(last);
          break;
        case 'Enter': {
          const el = index >= 0 ? items[index] : undefined;
          if (el) {
            event.preventDefault();
            el.click();
          }
          break;
        }
        default:
          break;
      }
    };

    const ctx = React.useMemo<CommandContextValue>(
      () => ({ listId, activeId, itemCount: registry.count, setActiveId, register }),
      [listId, activeId, registry.count, register],
    );

    return (
      <CommandContext.Provider value={ctx}>
        <div
          ref={rootRef}
          className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-foreground', className)}
          onKeyDown={handleKeyDown}
          {...props}
        >
          {children}
        </div>
      </CommandContext.Provider>
    );
  },
);
Command.displayName = 'Command';

export interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Called with the new text on every change (the parent filters its items). */
  onValueChange?: (value: string) => void;
  wrapperClassName?: string;
}

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, wrapperClassName, onChange, onValueChange, ...props }, ref) => {
    const ctx = React.useContext(CommandContext);
    return (
      <div
        data-command-input-wrapper=""
        className={cn('flex items-center gap-3 border-b border-border/70 px-4', wrapperClassName)}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-expanded={true}
          aria-controls={ctx.listId}
          aria-autocomplete="list"
          aria-activedescendant={ctx.activeId ?? undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'flex h-12 w-full min-w-0 bg-transparent py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-[52px] md:text-body',
            className,
          )}
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.target.value);
            ctx.setActiveId(null); // results change → highlight the first one again
          }}
          {...props}
        />
      </div>
    );
  },
);
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(CommandContext);
    return (
      <div
        ref={ref}
        id={ctx.listId}
        role="listbox"
        className={cn('scrollbar-thin max-h-[min(380px,60dvh)] scroll-py-1.5 overflow-y-auto overflow-x-hidden p-1.5', className)}
        {...props}
      />
    );
  },
);
CommandList.displayName = 'CommandList';

/** Rendered only while no CommandItem is mounted. */
const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(CommandContext);
    if (ctx.itemCount > 0) return null;
    return (
      <div
        ref={ref}
        role="presentation"
        className={cn('px-4 py-8 text-center text-table text-muted-foreground', className)}
        {...props}
      />
    );
  },
);
CommandEmpty.displayName = 'CommandEmpty';

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => {
    const headingId = React.useId();
    return (
      <div
        ref={ref}
        role="group"
        aria-labelledby={heading ? headingId : undefined}
        className={cn('overflow-hidden py-1 first:pt-0', className)}
        {...props}
      >
        {heading ? (
          <div id={headingId} data-command-group-heading="" className={menuLabelBase}>
            {heading}
          </div>
        ) : null}
        {children}
      </div>
    );
  },
);
CommandGroup.displayName = 'CommandGroup';

export interface CommandItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Passed to onSelect; defaults to the item's text. */
  value?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value, disabled = false, onSelect, onClick, onPointerMove, onMouseDown, id: idProp, ...props }, ref) => {
    const ctx = React.useContext(CommandContext);
    const autoId = React.useId();
    const id = idProp ?? autoId;
    const { register, setActiveId } = ctx;
    React.useLayoutEffect(() => register(), [register]);
    const active = ctx.activeId === id;
    return (
      <div
        ref={ref}
        id={id}
        role="option"
        data-command-item=""
        aria-selected={active}
        aria-disabled={disabled || undefined}
        data-selected={active || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          'touch-tap relative flex min-h-tap cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 text-table text-foreground outline-none transition-colors duration-100 md:min-h-10',
          'data-[selected=true]:bg-muted data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg:not([class*='text-'])]:data-[selected=true]:text-foreground",
          className,
        )}
        onPointerMove={(event) => {
          onPointerMove?.(event);
          if (!disabled && !active) setActiveId(id);
        }}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          event.preventDefault(); // keep focus in the input
        }}
        onClick={(event) => {
          onClick?.(event);
          if (disabled || event.defaultPrevented) return;
          onSelect?.(value ?? (event.currentTarget.textContent ?? '').trim());
        }}
        {...props}
      />
    );
  },
);
CommandItem.displayName = 'CommandItem';

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn(menuSeparatorBase, className)} {...props} />
  ),
);
CommandSeparator.displayName = 'CommandSeparator';

function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ml-auto pl-4 text-micro tracking-wide text-muted-foreground', className)} {...props} />;
}
CommandShortcut.displayName = 'CommandShortcut';

export interface CommandDialogProps extends React.ComponentPropsWithoutRef<typeof Dialog> {
  /** Accessible (visually hidden) title of the dialog. */
  title?: string;
  description?: string;
  closeLabel?: string;
  className?: string;
  commandClassName?: string;
  loop?: boolean;
}

function CommandDialog({
  title,
  description,
  closeLabel,
  className,
  commandClassName,
  loop,
  children,
  ...props
}: CommandDialogProps) {
  // Without a description, an explicit undefined tells Radix there is intentionally none (no console warning).
  const describedBy: { 'aria-describedby'?: undefined } = description ? {} : { 'aria-describedby': undefined };
  return (
    <Dialog {...props}>
      <DialogContent
        closeLabel={closeLabel}
        {...describedBy}
        className={cn(
          'gap-0 overflow-hidden p-0 pb-[env(safe-area-inset-bottom)] before:hidden sm:bottom-auto sm:top-[12vh] sm:my-0 sm:max-w-xl sm:p-0',
          className,
        )}
      >
        <DialogTitle className="sr-only">{title ?? t('common.search')}</DialogTitle>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : null}
        <Command loop={loop} className={cn('rounded-none [&_[data-command-input-wrapper]]:pr-12', commandClassName)}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
CommandDialog.displayName = 'CommandDialog';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
