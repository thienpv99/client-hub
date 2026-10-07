// Content-box size of an element (whole pixels), measured before the first paint and kept up to date.
import { useLayoutEffect, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

export function useElementSize(el: Element | null): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const apply = (width: number, height: number) => {
      const w = Math.round(width);
      const h = Math.round(height);
      setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
    };
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) apply(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}
