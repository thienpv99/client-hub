// Copy text to the clipboard: the async Clipboard API first, then a hidden-textarea fallback
// (older Safari, non-secure contexts, or a document that lost focus).

/**
 * `container`: where the fallback textarea is attached — pass the open popover/dialog element so focus never leaves
 * it (a focus move outside a Radix popover would close it). Returns true when the text reached the clipboard.
 */
export async function copyText(text: string, container?: HTMLElement | null): Promise<boolean> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // permission denied / document not focused → fallback below
    }
  }
  return legacyCopy(text, container ?? null);
}

function legacyCopy(text: string, container: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false;
  const host = container ?? document.body;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.tabIndex = -1;
  // off-screen but selectable; 16px avoids the iOS zoom on focus
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  area.style.fontSize = '16px';
  host.appendChild(area);
  let ok = false;
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    host.removeChild(area);
    previous?.focus({ preventScroll: true });
  }
  return ok;
}
