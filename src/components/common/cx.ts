// Class merging for the common components = the UI kit's token-aware `cn` (components/ui/cn.ts). One merge config
// for the whole design system: it knows every "Executive Calm" token (text-micro / heading / title / display /
// kpi-lg sizes, the shadows, tracking, max-w, ease), which the old `cn` of '@/lib/utils' would drop next to a colour.
export { cn as cx } from '@/components/ui/cn';

/**
 * 13px / 18px with no colour. `text-caption` sets BOTH the caption size and the caption colour (same class name),
 * and its colour may win over another text colour, so use SMALL whenever a 13px text needs a different colour.
 */
export const SMALL = 'text-[13px] leading-[18px]';

/** 12px / 16px in the caption-like secondary colour (`text-micro` is a size only). */
export const MICRO_MUTED = 'text-micro text-muted-foreground';
