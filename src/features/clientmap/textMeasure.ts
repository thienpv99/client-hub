// Width of the bubble labels (SVG text cannot wrap or shrink by itself): measured once per string with a canvas in
// the app font and cached; an estimate stands in where no canvas exists.
const FONT_STACK = '"Be Vietnam Pro", Inter, system-ui, sans-serif';
const REF = 100;

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  return ctx;
}

function fontReady(weight: number): boolean {
  try {
    return typeof document === 'undefined' || !document.fonts || document.fonts.check(`${weight} ${REF}px "Be Vietnam Pro"`);
  } catch {
    return true;
  }
}

/** width in px of `text` set at `size` px (weight 400–700); a 4% margin covers tabular figures and hinting */
export function textWidth(text: string, size: number, weight = 600): number {
  const key = `${weight}|${text}`;
  let w = cache.get(key);
  if (w === undefined) {
    const c = context();
    if (c) {
      c.font = `${weight} ${REF}px ${FONT_STACK}`;
      w = c.measureText(text).width * 1.04;
      // measured in a fallback face while the web font is still loading: use it, but measure again next time
      if (fontReady(weight)) cache.set(key, w);
    } else {
      w = text.length * REF * 0.6;
    }
  }
  return (w * size) / REF;
}

/** the largest size between `min` and `max` at which `text` fits `width`, or null */
export function fitSize(text: string, max: number, min: number, width: number, weight = 600): number | null {
  for (let s = max; s >= min; s -= 0.5) if (textWidth(text, s, weight) <= width) return s;
  return null;
}

/** `text` cut with "…" to fit `width` at `size` ('' when not even 3 characters fit) */
export function truncate(text: string, size: number, width: number, weight = 600): string {
  if (textWidth(text, size, weight) <= width) return text;
  const chars = Array.from(text);
  for (let n = chars.length - 1; n >= 2; n--) {
    const cut = `${chars.slice(0, n).join('').trimEnd()}…`;
    if (textWidth(cut, size, weight) <= width) return cut;
  }
  return '';
}
