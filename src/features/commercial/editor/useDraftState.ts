// Draft state of the editor, kept in sync with the server copy: when the quote changes on the server and the user
// has no unsaved edits, the draft follows it; unsaved edits are never overwritten.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuoteDraft } from './draft';
import { draftSignature } from './draft';

export function useDraftState(source: QuoteDraft): {
  draft: QuoteDraft;
  setDraft: (next: QuoteDraft | ((d: QuoteDraft) => QuoteDraft)) => void;
  dirty: boolean;
  /** adopt a fresh server copy (after a save) */
  reset: (next: QuoteDraft) => void;
} {
  const baseRef = useRef(source);
  const [draft, setDraft] = useState<QuoteDraft>(source);
  const sourceSig = useMemo(() => draftSignature(source), [source]);

  useEffect(() => {
    const prev = baseRef.current;
    baseRef.current = source;
    setDraft((cur) => (draftSignature(cur) === draftSignature(prev) ? source : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceSig]);

  const reset = useCallback((next: QuoteDraft) => {
    baseRef.current = next;
    setDraft(next);
  }, []);

  const dirty = draftSignature(draft) !== draftSignature(baseRef.current);

  // leaving the page with unsaved edits asks first (browser prompt)
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return { draft, setDraft, dirty, reset };
}
