// Motion helper of the CRM / targets / projects pages (DESIGN.md §8.3–8.4): the first-appearance stagger belongs to
// the view a page was opened on. Once the person switches to another tab (or view) the kit's 150 ms tab fade is the
// only tab motion, so lists mounted by a tab switch appear without a stagger — also when they come back to the first tab.
import { useRef } from 'react';

/** true while `view` is still the view the page was opened on (false for good once another one was shown) */
export function useEntryView<T>(view: T): boolean {
  const entry = useRef(view);
  const left = useRef(false);
  if (view !== entry.current) left.current = true;
  return !left.current;
}
