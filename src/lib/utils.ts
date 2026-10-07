import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know the custom tokens of tailwind.config.js, otherwise it treats them as colours and drops
// them: cn('text-table text-muted-foreground') would lose the 14px size, cn('shadow-card …') the shadow.
// Keep in sync with src/components/ui/cn.ts (DESIGN.md §2 tokens).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'table', 'body', 'heading', 'title', 'display', 'kpi', 'kpi-lg'] }],
      shadow: [{ shadow: ['xs', 'card', 'card-hover', 'pop', 'drawer', 'btn', 'btn-secondary', 'focus', 'segment'] }],
      tracking: [{ tracking: ['tightish', 'display'] }],
      'max-w': [{ 'max-w': ['page', 'reading'] }],
      ease: [{ ease: ['out-quart'] }],
      'min-h': [{ 'min-h': ['tap'] }],
      'min-w': [{ 'min-w': ['tap'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

let counter = 0;

/** Short unique id with a readable prefix: newId('t') → 't_lx3k9a2b' */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36).slice(-5)}${counter.toString(36).padStart(2, '0')}${rand}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Remove Vietnamese diacritics + lowercase, for search matching. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
