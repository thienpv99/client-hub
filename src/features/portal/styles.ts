// Shared class strings of the client portal ("Executive Calm", DESIGN.md §4 / §7.5).

/**
 * Quiet text link in a card header ("Xem tất cả việc", "Xem tiến độ"): it keeps the visual height of its line so it
 * aligns with the heading, while an invisible ::after extends the hit area to 44px for fingers.
 */
export const QUIET_LINK =
  "relative inline-flex shrink-0 items-center gap-1 rounded-md text-table font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']";

/** Section title outside a card ("Việc cần anh xử lý"): DESIGN §1.2 section titles. */
export const SECTION_TITLE = 'text-heading font-semibold tracking-tightish text-ink';

/** Neutral count pill (DESIGN §7.5). */
export const COUNT_PILL =
  'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground';

/**
 * Full-bleed row of a list inside a card (DESIGN §4 "lists inside cards"): hairline-separated by the parent
 * (`divide-y divide-border/60`), hover `bg-subtle`, 44px minimum, inset focus ring (the card clips nothing).
 */
export const LIST_ROW =
  'group flex w-full min-h-tap items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5';

/** Hairline list inside a card, under its header (rows use LIST_ROW). */
export const CARD_LIST = 'divide-y divide-border/60 border-t border-border/60';
