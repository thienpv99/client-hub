import * as React from 'react';

type AutoFocusHandler = (event: Event) => void;
type OpenerRef = React.MutableRefObject<HTMLElement | null>;

/** The element that has focus now, or null when nothing (the page body) has it. */
function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Records the opener while the panel's content RENDERS (it mounts only while the panel is open). Render runs before
 * React's commit applies a field's `autoFocus`, so this still sees the button / row / shortcut target that opened the
 * panel. `onOpenAutoFocus` alone is not enough: when a field autofocuses itself, Radix's FocusScope finds focus already
 * inside and never fires it. Render it as the first child of the panel's Content.
 */
export function CaptureOpener({ into }: { into: OpenerRef }) {
  React.useState(() => {
    into.current = focusedElement();
    return 0;
  });
  return null;
}

/**
 * Focus return for Dialog / AlertDialog / Sheet. Radix gives focus back on close only to a `<…Trigger>`; most panels
 * here are opened with a controlled `open` from plain buttons, rows, cards or a shortcut, so focus fell to <body>.
 * This remembers what had focus when the panel opened and gives it back on close — unless the caller's own
 * `onCloseAutoFocus` prevented the default, or that element has left the page (then Radix's default applies).
 * Trigger-based panels behave as before (the trigger is what had focus).
 * Use: `const { opener, focusProps } = useReturnFocus(…)`; spread `focusProps` on the Content and render
 * `<CaptureOpener into={opener} />` as its first child.
 */
export function useReturnFocus(onOpenAutoFocus?: AutoFocusHandler, onCloseAutoFocus?: AutoFocusHandler) {
  const opener = React.useRef<HTMLElement | null>(null);
  const handleOpen = React.useCallback(
    (event: Event) => {
      // fallback only: fired before focus moves into the panel, so activeElement is still the opener
      if (!opener.current) opener.current = focusedElement();
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus],
  );
  const handleClose = React.useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      opener.current = null;
      if (event.defaultPrevented || !target || !target.isConnected) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
    [onCloseAutoFocus],
  );
  const focusProps = React.useMemo(
    () => ({ onOpenAutoFocus: handleOpen, onCloseAutoFocus: handleClose }),
    [handleOpen, handleClose],
  );
  return { opener, focusProps };
}
