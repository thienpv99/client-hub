// Class merging for the UI kit. Same as `cn` from '@/lib/utils', but it also knows every token of the
// "Executive Calm" refresh (DESIGN.md §2). Without them tailwind-merge reads `text-micro` / `text-heading` /
// `text-title` / `text-display` / `text-kpi-lg` as text COLOURS and drops them next to a real colour
// (`cn('text-micro text-muted-foreground')` would lose the 12px size), and it cannot let `shadow-none` replace
// `shadow-btn`. Kit components merge their own classes AND the caller's `className` with this one, so callers may
// pass any token class.
//
// Gotcha that stays: `text-caption` is a size AND a colour. Next to another size (`text-micro`) one of them is
// dropped — for 12px caption-coloured text set `text-caption` on a parent and `text-micro` on the child, or use
// `text-micro text-muted-foreground`.
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merge = extendTailwindMerge({
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
  return merge(clsx(inputs));
}
