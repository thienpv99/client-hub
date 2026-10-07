# Client Hub — Design language "Executive Calm" (v2)

The client found v1 "xấu" (generic admin template). v2 keeps SPEC §7 (blue–white palette, Be Vietnam Pro, 12px cards,
8px buttons, status colours only for status) but raises the craft to the level of Linear / Stripe Dashboard / Attio:
**quiet surfaces, crisp hierarchy, big confident numbers, precise spacing, soft depth, purposeful motion.**
This file is the contract for every screen. Tokens live in `tailwind.config.js` + `src/index.css`.

## 1. Principles
1. **One focal point per screen.** Each page answers one question first (client home: "what must I do?";
   director: "what needs me today?"). That block is visually dominant; everything else is calmer.
2. **Hierarchy by size & weight, not by colour or boxes.** Titles `text-display`/`text-title` semibold `text-ink`,
   section titles `text-heading` semibold, meta in `text-caption text-muted-foreground`. Avoid nested bordered boxes.
3. **Fewer borders, more space.** Cards use `border border-border/70 shadow-card`; inside a card separate rows with
   `divide-y divide-border/60` and generous padding — never boxes inside boxes.
4. **Numbers are the hero.** KPIs `text-kpi`/`text-kpi-lg font-semibold tracking-display tabular text-ink`, with a
   short label above and a context line below (trend / split / progress).
5. **Status = icon + word + soft tint**, never a coloured block. One status accent per card.
6. **Blue is for action and selection only** (primary button, active nav, links, focus, selected rows, charts).
7. **Motion is quiet**: 150–200 ms `ease-out-quart`; hover lift on clickable cards (`hover:-translate-y-px
   hover:shadow-card-hover`), press `active:scale-[0.98]`; respect reduced motion (global rule exists).
8. **Mobile is a first-class layout**, not a squeezed desktop: full-width cards, bottom sheets, thumb-reachable actions.

## 2. Tokens (use these classes only)
| Token | Class | Value |
|---|---|---|
| Page | `bg-background` | #F6F8FC |
| Card / sidebar | `bg-card`, `bg-sidebar` | #FFFFFF |
| Inset / table header | `bg-subtle` | #F8FAFC |
| Hover fill / chips | `bg-muted` | #F1F4F9 |
| Border | `border-border` (70% alpha on cards: `border-border/70`) | #E5E9F0 |
| Input / strong divider | `border-border-strong` | #D5DCE6 |
| Title ink | `text-ink` | #0B1220 |
| Body | `text-foreground` | #0F172A |
| Secondary | `text-muted-foreground` | #475569 |
| Caption | `text-caption` (13px + colour) / `text-micro` (12px) | #5E6E84 |
| Primary | `bg-primary hover:bg-primary-hover`, soft `bg-primary-soft`, border `border-primary-border` | #1D4ED8 |
| Status | `text-success bg-success-soft` · `text-warning bg-warning-soft` · `text-danger bg-danger-soft` | spec |
| Charts | `chart-1..4` (blue ramp) | #1D4ED8 → #D6E1FD |

Type scale: `text-micro` 12 · `text-caption` 13 · `text-table` 14 · `text-body` 15 (default) · `text-heading` 17 ·
`text-title` 20 · `text-display` 28 · `text-kpi` 30 · `text-kpi-lg` 36. Titles: `font-semibold tracking-tightish`
(display/kpi: `tracking-display`). Weights: 400 body, 500 labels/buttons, 600 titles/numbers. Never 700+ except logos.
Radius: buttons/inputs `rounded-lg` (8), cards/sheets `rounded-xl` (12), pills `rounded-full`, small chips `rounded-md`.
Shadows: `shadow-xs` controls, `shadow-card` cards, `shadow-card-hover` hover, `shadow-pop` menus/popovers,
`shadow-drawer` sheets, `shadow-btn` primary button, `shadow-segment` active segment of a segmented control. Focus: global ring + `focus-visible:shadow-focus` on inputs.
Spacing: 8px grid. Page padding `px-4 md:px-6 xl:px-8`, `py-6 md:py-8`; section gap `space-y-6 md:space-y-8`;
card padding `p-4 md:p-5` (dense lists `px-4 py-3`). Content max width `max-w-page mx-auto`; reading width
`max-w-reading` (forms, quote document, digest).

## 3. App chrome
### Internal (≥1024 full sidebar, 768–1023 slim rail, <768 top bar + sheet)
- **Sidebar** `w-[248px] bg-sidebar border-r border-border/70`, sticky full height:
  - Top: workspace block — New Era mark (28px rounded-lg primary square, white "N") + "New Era" (semibold) +
    "Client Hub" caption; then a search button styled as an input (`h-9 rounded-lg border bg-subtle text-caption`,
    "Tìm nhanh…" + `Kbd` Ctrl K).
  - Nav grouped with micro section labels (`text-micro font-medium uppercase-free text-caption px-3 mt-5 mb-1`):
    **Điều hành**: Tổng quan · **Khách hàng**: Bán hàng, Khách hàng mục tiêu, Khách hàng, Dự án ·
    **Vận hành**: Việc, Thương mại · **Hệ thống**: Thông báo, Cài đặt.
  - Item: `h-9 px-3 rounded-lg gap-3 text-table font-medium text-muted-foreground hover:bg-muted hover:text-foreground`;
    active `bg-primary-soft text-primary` + icon `text-primary`; icons 18px stroke 1.75; optional right count badge
    (`ml-auto text-micro tabular rounded-full bg-muted px-1.5`, danger variant for overdue counts).
  - Bottom: user card (avatar 32, name, role caption) opening the user menu.
- **Rail (768–1023)** `w-[72px]`: icon buttons 44×44 with SHORT labels underneath (`text-[11px] leading-3`, one line,
  truncate) using `layout.nav.short.*` keys (Tổng quan, Bán hàng, Mục tiêu, Khách hàng, Dự án, Việc, Thương mại,
  Thông báo, Cài đặt) — never wrap to 2–3 lines; tooltip with the full name.
- **Top bar** `h-14 bg-background/80 backdrop-blur border-b sticky top-0 z-30`, quiet at rest: the hairline
  (`border-border/70`) appears only once the page scrolls. Left = breadcrumbs (`text-table text-muted-foreground`,
  current page `text-foreground font-medium`); phones: "‹ section" on child pages, else the page title. A section
  page's crumb/title fades in only after the page `<h1>` scrolled under the bar (never two titles on screen).
  Right = search (rail / phone), bell (ghost icon button with unread dot), avatar (below 1024 — the sidebar has it).
- **Page header** (component `PageHeader`): `flex items-end justify-between gap-4 mb-6`; title `text-display
  font-semibold tracking-display text-ink` (mobile `text-title`), description `text-body text-muted-foreground mt-1`,
  actions right (primary button last). Tabs directly under the header use the underline style, full-bleed border.

### Client portal (mobile-first)
- **Desktop/iPad header** `h-16 bg-card/90 backdrop-blur border-b`: client logo (32) + thin divider + New Era mark
  + "cùng New Era" caption; centered nav pills (`h-9 px-3 rounded-lg`, active `bg-primary-soft text-primary`);
  right: project selector (compact select), bell, avatar.
- **Mobile**: compact header (logos, bell, avatar) + **bottom tab bar** `fixed bottom-0 inset-x-0 bg-card/95
  backdrop-blur border-t pb-safe` with 4–5 items (icon 22 + label 11px), active = primary icon + label + 2px top
  indicator; content `pb-24`.
- Portal pages use a narrower canvas: `max-w-[1120px] mx-auto`.

## 4. Components (recipes)
- **Button** primary: `h-10 px-4 rounded-lg bg-primary text-white font-medium shadow-btn hover:bg-primary-hover
  active:scale-[0.98] transition` (mobile h-11). Secondary: `bg-card border border-border-strong text-foreground
  shadow-btn-secondary hover:bg-subtle`. Ghost: `hover:bg-muted text-muted-foreground hover:text-foreground`.
  Soft: `bg-primary-soft text-primary hover:bg-primary-soft/70`. Icon buttons square, ghost by default.
  Destructive only in confirm dialogs. Max one primary per view region.
- **Card**: `rounded-xl bg-card border border-border/70 shadow-card`; header `px-5 pt-5 pb-3` with `text-heading
  font-semibold` title + caption description + right actions (ghost/link); body `px-5 pb-5`. Clickable cards add
  hover lift. Lists inside cards: `divide-y divide-border/60`, rows `px-5 py-3.5`, hover `bg-subtle`.
- **KPI tile** (KpiCard): label row (`text-caption font-medium` + 16px icon in `text-caption`, no coloured square),
  value `text-kpi font-semibold tracking-display tabular text-ink mt-2`, context line `text-caption mt-1` (split
  values separated by a 1px dot, status part in status colour + icon), optional footer: mini progress bar
  (`h-1.5 rounded-full bg-muted` + primary fill) or sparkline (Recharts, 32px tall, `chart-1` stroke, no axes).
  Grid: `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`. Clickable KPI = filter (ring-1 ring-primary when active).
- **Badge / status pill**: `inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-micro font-medium`;
  neutral `bg-muted text-muted-foreground`; status variants soft bg + coloured text + 12px icon (or 6px dot for
  dense tables). HealthBadge uses icon + word.
- **Tabs**: page tabs = underline (`h-11`, `text-table font-medium`, active `text-foreground` with 2px primary
  bottom bar, inactive `text-muted-foreground hover:text-foreground`), counts as small neutral pills.
  In-card segmented control = `bg-muted p-1 rounded-lg` with white active segment `shadow-segment` (lift + hairline
  as a shadow, so the keyboard focus ring still shows). Strips that scroll on phones fade their cut edge.
- **Table**: wrapper card; header `bg-subtle text-micro font-medium text-caption h-10 border-b`; rows `h-14
  text-table` hover `bg-subtle/80`, first column = entity (logo/avatar 28 + name semibold + caption subline);
  numbers right-aligned tabular; row actions appear on hover (desktop) / always (touch). Sticky header in scroll
  areas. Below `xl` tables become **cards** (stacked label/value with the entity line on top).
- **Inputs**: `h-10 rounded-lg border border-border-strong bg-card px-3 text-body placeholder:text-caption
  focus-visible:border-primary focus-visible:shadow-focus` (mobile h-11). Labels `text-table font-medium` above,
  helper `text-caption`, error `text-danger text-caption` with icon under the field.
- **Sheet / drawer**: right sheet `sm:max-w-xl lg:max-w-2xl rounded-l-xl` (desktop), header sticky with title
  `text-title` + meta row + close; footer action bar sticky `border-t bg-card/95 backdrop-blur p-4`; mobile = full
  screen or bottom sheet (`rounded-t-2xl`, drag handle 36×4 `bg-border-strong` centered).
- **Dialog**: `max-w-md rounded-xl p-6`; mobile bottom sheet style. Title `text-title`, description caption.
- **Empty state**: 48px icon in two concentric soft circles (`bg-primary-soft` outer 72px, `bg-card` inner ring),
  title `text-heading`, one-sentence description, optional secondary action. Centered, `py-12`.
- **Skeleton**: shimmer blocks with the real layout's sizes (title bar 40%, lines 70/50%, KPI 60px number block).
- **Avatars & logos**: 28 default (rows), 36 headers; initials `text-micro font-semibold`; company logos rounded-lg;
  stacks overlap `-space-x-2 ring-2 ring-card`.
- **Toasts**: white card `shadow-pop rounded-xl`, 14px text, status icon, action link "Hoàn tác" in primary.
- **Charts** (Recharts): no chart borders, horizontal gridlines only `stroke: rgb(var(--border))` dashed 3 3,
  axis ticks `text-micro` caption colour, bars `radius={[6,6,0,0]}` `chart-1` (actual) and `chart-3` (planned),
  tooltip = card style; always a one-line summary sentence above the chart.

## 5. Page patterns
- **Executive dashboard** (director/AM): header (greeting "Chào anh Nam" + date caption + actions) → KPI row →
  two-column on xl: left 2/3 "Cần chú ý hôm nay" (the focal block: each row = severity icon in soft circle +
  one sentence with the account name semibold + caption meta (days, amount) + 1 primary-ish action (soft) + 1 ghost)
  · right 1/3 "Thu tiền theo tháng" chart card + "Mốc sắp tới" mini list → full-width portfolio (filters chips +
  table/cards). On iPad: single column, attention first.
- **List pages** (accounts, tasks, CRM list, leads, projects): header → toolbar row (search input 280px, filter
  chips/selects, view switcher right) → content card. Bulk selection shows a floating action bar at the bottom
  (`fixed bottom-6 inset-x-0 mx-auto w-fit rounded-xl bg-ink text-white shadow-pop px-4 h-12`).
- **Detail pages** (account, opportunity, quote, project): sticky compact header (logo 40 + name `text-title` +
  badges row + key facts inline: AM, giá trị HĐ, mốc tiếp theo) → underline tabs → two-column content
  (main 2/3 + side facts 1/3 on xl).
- **Kanban**: columns `w-[300px]` on `bg-subtle rounded-xl p-2`, column header (name + count pill + sum), cards
  white `rounded-lg border shadow-xs p-3 space-y-2` with hover lift, drag ghost `shadow-pop rotate-1`.
- **Client home (mobile)**: greeting `text-title` (2 lines max) → **status hero card** (full-width, soft status tint,
  icon 24 in white circle, one sentence, milestone + forecast chip) → "Việc cần anh xử lý" (count pill) task cards:
  white card, left 3px accent ONLY for overdue-blocking (danger) / due-soon-blocking (warning), title `text-heading`,
  due chip, "Nếu chưa làm" as an inset `bg-subtle rounded-lg p-3` with milestone tags, primary action FULL-WIDTH on
  mobile (`w-full h-11`), secondary actions as text links below. → Tiến độ stepper card → New Era đang làm → Cập nhật.
- **Forms / wizard**: `max-w-reading`, sections with `text-heading` titles and dividers, sticky footer bar.

## 6. UX rules added in v2
- First screen of every role shows its focal block above the fold at 375×812 and 1024×768.
- Every list: search + the 2–3 most useful filters visible; the rest in a "Bộ lọc" popover; result count shown.
- Primary actions keep their position (bottom-right on desktop dialogs, bottom full-width on mobile).
- Destructive or irreversible = confirm dialog; everything else = immediate + toast with undo when possible.
- Long Vietnamese labels never wrap mid-control: use short labels (`*.short` keys) in tight places + tooltip.
- Use `line-clamp-2` for titles in cards, full text in the drawer.
- Relative dates in lists ("còn 2 ngày"), absolute dd/mm/yyyy in tooltips/details.
- Touch: 44px min, 8px gaps between tap targets, no hover-only affordances.

## 7. Implementation notes (foundation v2 — read before restyling a screen)
The kit (`components/ui`), the product components (`components/common`) and the chrome (`layouts`, `features/shell`)
are done. Screens compose them; they do not rebuild them. Every API below is optional and additive — old props work.

### 7.1 Class merging and type gotchas
- `cn` from `@/components/ui/cn` (= `cx` from `components/common/cx`) and `cn` from `@/lib/utils` now share the same
  merge config and know every v2 token (sizes, shadows incl. `segment`, tracking, `max-w-page|reading`, `ease-out-quart`,
  `min-h|w-tap`). Either is safe; new code prefers `@/components/ui/cn`. Keep the two configs in step.
- `text-caption` = 13px **and** the caption colour: never next to another size. 12px caption-coloured text =
  `text-micro text-muted-foreground` (`MICRO_MUTED`); 13px in another colour = `SMALL` (`text-[13px] leading-[18px]`).
- Kit components merge the caller's `className` with the token-aware `cn`, so `className="text-micro"` etc. is safe.

### 7.2 Chrome contract (layouts own it — pages never add a top bar, logo, breadcrumbs, back link or page padding)
- **Internal frame**: full sidebar ≥1024 (content ≈ 776px wide at 1024!), 72px rail 768–1023, phone top bar + sheet.
  `main` already has `max-w-page mx-auto px-4 md:px-6 xl:px-8 py-6 md:py-8` — render straight into it.
- **Top bar** (h-14 = 56px) is quiet: no hairline until the page scrolls. md+: breadcrumbs ("Khách hàng › Cỏ Xanh
  Retail"); phones: "‹ Khách hàng" on child pages, the section title otherwise. On a section page the crumb/title
  only fades in once the page's `<h1>` has scrolled under the bar → **every page renders exactly one visible `<h1>`**
  (PageHeader renders it; detail headers render their own).
- **No back links on internal pages**: the breadcrumb / "‹ section" is the way back. `PageHeader back` is ignored
  inside InternalLayout (`PageHeaderBackContext`); portal pages (no breadcrumbs) keep it.
- **Sticky page parts**: internal `sticky top-14 z-20 bg-background/80 backdrop-blur border-b border-border/60`
  (stacked rows: add their heights, e.g. account tabs `top-[112px]`); portal `top-14 md:top-16`. Never above z-20
  (top bar z-30, overlays z-50). In "Xem như khách hàng" the portal banner adds 40px (more on phones) on top of the
  portal header, so avoid top-sticky parts in portal pages; bottom-sticky action bars are fine.
- **Portal frame**: canvas `max-w-[1120px]`, header h-16 (phones h-14), bottom tab bar 58px + safe area; `main`
  already pads the tab bar. Fixed bottom bars on portal phones: `bottom-[calc(58px+env(safe-area-inset-bottom))]`.
- **Breakpoints**: two-column layouts (main 2/3 + side 1/3, dashboard attention + chart, kanban 4 columns, editor +
  totals) switch at **`xl`**, not `lg` — at 1024 the sidebar is open. KPI rows: `grid grid-cols-2 gap-3 sm:gap-4
  xl:grid-cols-4`. Internal tables become cards below `xl` (TableSkeleton matches).
- **Browser tab title** belongs to the frames: InternalLayout sets `"{breadcrumb leaf} · Client Hub"` ("Việc",
  "Cỏ Xanh Retail", "Không mở được" when an entity cannot be opened), ClientLayout `"{portal section} · Client Hub"`
  (`layout.documentTitle`). Pages never set `document.title`, except the pages outside any section (NotFoundPage,
  LoginPage, SelfTestPage — same `layout.documentTitle` format) and QuotePrint's temporary print title.
- **Portal project selector**: only on project-scoped pages (home, Việc, Tiến độ, Tài liệu — not Thương mại or
  settings). Phones: in the header (the company name hides, the logo stays), so the focal block starts right under the
  header; iPad portrait (md–lg): a row under the header (the centred nav fills it); lg+: in the header.
- **Detail header on phones**: AccountHeader `compactFacts` (AccountDetailPage passes it on every tab but Tổng quan)
  hides the key-facts block below `sm`, so a work tab (Việc, Lộ trình…) starts ~150px higher; the overview keeps it.

### 7.3 Kit (`components/ui`) — optional API added in v2
| Component | v2 props / exports |
|---|---|
| `Button` | sizes `touch` (44px always: full-width mobile primary), `icon-sm` (32px mouse / 44px touch); `loading`. Ghost = muted text (add `text-foreground` when it must read as primary text) |
| `Card` | `interactive` (hover lift + press), `asChild` (`<Card interactive asChild><Link/></Card>`); `CardAction` (right of the title row inside `CardHeader`); `CardFooter` = bar under a hairline |
| `Badge` | `dot` (6px leading dot), `size="sm"` (20px, dense tables); status variants always with icon or `dot` + word |
| `Tabs` | `TabsList variant="underline"` (page tabs) · `"segmented"` (= pill/default, in-card); `TabsTrigger count` / `countTone="danger"` / `countLabel`; `TabsCount`. Strips that scroll fade their cut edge and keep the active tab clear of the 40px fade (re-checked when a tab changes size, e.g. once the web font is in) |
| `ToggleGroup` | `variant="segmented"` (view switcher, same look as segmented tabs) · `"outline"` chips |
| `Table` | `stickyHeader` + `wrapperClassName="max-h-[60vh]"`; rows 56px, first/last cell 16px edge padding |
| `Input` | `inputSize` sm/default/lg, `icon` (leading, e.g. `<Search />`), `wrapperClassName`; read-only gets `bg-subtle` |
| `SelectTrigger` / `NativeSelect` | `size="sm"` (toolbar) · NativeSelect `lg` |
| `FormField` | `labelAside` (right of the label row); hint + error both shown |
| `Sheet` | `SheetHeader` (sticky) + `SheetMeta` (badges row) + `SheetBody` (scrolls) + `SheetFooter` (sticky blurred bar, primary last); `side="bottom"` has a drag-to-close handle (`showHandle`); `mobileFullScreen` |
| `Dialog` | default `max-w-md`; phones = bottom sheet with full-width actions (primary on top); `mobileFullScreen` = full screen on phones (no handle, zoom/fade in instead of the slide-up) for flows that own the screen (first-login intro) |
| hooks | `useMediaQuery` / `useBreakpoint` also re-check on `resize` (device emulation may not fire the MediaQueryList change event) |
| `Avatar` | `size` xs/sm/md/lg; `AvatarGroup` (overlapping stack) |
| `Progress` | default 6px, `size="md"` 8px |
| `Skeleton` | `SkeletonText lines` |
| `menu-styles` | `menuPanelBase`, `menuItemBase`, `menuLabelBase`, `menuSeparatorBase` for custom menus |
| `use-scroll-fade` | `useScrollFade(ref)` + `SCROLL_FADE_CLASS` for any custom horizontal scroller |
| tokens | `shadow-segment` (active segment), `shadow-xs/card/card-hover/pop/drawer/btn/btn-secondary/focus`, `ease-out-quart` |

### 7.4 Product components (`components/common`) — optional API added in v2
| Component | v2 props / exports |
|---|---|
| `PageHeader` | `eyebrow` (date / context line above the title), `tabs` (underline TabsList slot), `compact` (`text-title` for detail pages), `children` (badges / meta row). Never override the title size. `PAGE_TABS_BLEED` = className for internal page tabs (strip + hairline run edge to edge of the content column) — every underline page strip uses it |
| `KpiCard` | `trend {value, direction, good?, label?}` (arrow chip), `progress {value, max, label?}` (6px bar + %), `spark number[]` (32px area chart), `footer`; `onClick` + `active` = filter (ring + corner filter icon). Pass plain values — no size wrappers inside `value`. `KpiTrendChip`. `labelLines` 2 (default: narrow tiles reserve two label lines so a row's numbers line up) or 1 (a row whose labels all fit one line at 375 — saves ~18px per tile) |
| `KpiSkeleton` | `className` (grid, same as the real row), `itemClassName` (string or `(i) => …`, e.g. the 3-KPI span), `labelLines` |
| `SectionCard` | `divided` (direct children become hairline-separated rows), `flush` (tables / media), `footer`, `headerClassName`, `as`. Header: title row (the title keeps its one-line width; actions that do not fit beside it wrap under it instead of squeezing it), then the description at full width under the row; `headerClassName` styles the title row |
| `ErrorState` | `titleAs="h1"` when the error replaces a whole page (forbidden / not found detail pages keep their one `<h1>`) |
| `StatusBand` | `milestone` (white chip: planned → forecast), `aside`, `showLabel`; auto "Go-live · lùi N ngày" chip for waiting_client |
| `HealthBadge` | `variant="dot"` for dense tables; `size` sm (rows/cards) · md (headers) |
| `DueLabel` | chip by default; `variant="text"` inside sentences / dot-separated meta; `compact` in rows |
| `ForecastLabel` | non-compact = 2 lines (dates + delay chip, reason caption) → give it full width; `compact` in tables |
| `WaitingCountsLine` | two stat chips on their own line — no wrapper text, no separators; `compact` (12px chips, "Chờ khách 3 · Chờ New Era 2") on cards ≤ ~320px so both chips share one line |
| `ImpactChain` | pill chain with chevrons that wraps at every width (phones too: short links share a line) |
| `ImpactBox` / `BlockedNote` | inset `bg-subtle` panels (never bordered boxes); `MilestoneTag` export |
| `EmptyState` / `ErrorState` | `compact` inside cards and drawers; `EmptyIcon` export; actions secondary/ghost |
| `ActivityFeed` | draws its own timeline rail — no dividers around items; `compact` in side columns |
| `FileList` | `FileTypeTile`, `fileExtension`; needs ≥ 8px horizontal padding around it (hover fill bleeds `-mx-2`) |
| `UserAvatar` / `AccountLogo` | `ring` for overlapping stacks (`flex -space-x-2`); rows = `size="sm"` (28), headers md/lg. AccountLogo `initials` = initials computed by the data layer (ClientMapNode.logo.initials) so one company shows one tile everywhere |
| `ChipFilter` | 32px pills (44 on touch), scrolls + fades on phones, wraps from sm |
| skeletons | `TableSkeleton` (cards < xl), `KpiSkeleton`, `PageSkeleton` (with status hero), `CardSkeleton`, `ListSkeleton` |

### 7.5 Recipes to copy (do not invent variants)
- **Clickable card**: `<Card interactive>` — or for custom elements `transition duration-150 ease-out-quart
  hover:-translate-y-px hover:border-primary-border hover:shadow-card-hover active:scale-[0.98]`.
- **Count pill**: danger `h-5 rounded-full bg-danger-soft px-1.5 text-micro font-medium tabular text-danger`,
  neutral `bg-muted text-muted-foreground`; unread dot `h-2 w-2 rounded-full bg-primary`. In tabs use `count`.
- **List row inside a card**: `SectionCard divided`, row = entity (AccountLogo/UserAvatar sm + `font-semibold` name +
  `text-caption` subline) · meta · status badge · actions; hover `bg-subtle`.
- **Table**: `<Card className="overflow-hidden"><Table>…</Table></Card>`; numbers `text-right`; status `Badge
  size="sm"` + icon or `HealthBadge variant="dot"`; row actions `Button variant="ghost" size="icon-sm"` on
  `TableRow className="group"` with `md:opacity-0 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100`.
- **Toolbar** (list pages): `<Input icon={<Search />} inputSize="sm" wrapperClassName="w-full sm:w-[280px]"
  aria-label=…/>` + `ChipFilter` / `SelectTrigger size="sm"` + view switcher (`ToggleGroup variant="segmented"`)
  right; result count in `text-caption`.
- **Drawer**: `SheetHeader className="border-b border-border/70"` → `SheetTitle` + `SheetDescription` + `SheetMeta`;
  `SheetBody`; `SheetFooter` (primary last). Keep the header's `pr-14 md:pr-16` (close button).
- **Mobile client action**: primary `Button size="touch" className="w-full md:w-auto"`, secondary actions as
  `variant="link" size="sm"` below; short pickers = `SheetContent side="bottom"`.
- **Inset panel** (instead of a box in a box): `rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60`.
- **Numbers**: `tabular` everywhere; KPI values through `KpiCard`; inline money `Money compact`.
- **Page rhythm** (same on every page, internal and portal): page root `space-y-6 md:space-y-8` (header → first
  block 24/32px); header tabs → tab content `mt-6 md:mt-8` (or the root's space-y); inside a tab, KPI row → list
  group `space-y-6 md:space-y-8`; a toolbar and the list it filters stay grouped (`space-y-3`/`space-y-4`). A page's
  underline tabs use `PAGE_TABS_BLEED`.
- **3-KPI row**: grid `grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3`, first tile `className="col-span-2 xl:col-span-1"`
  (full width on phones / iPad, the two others side by side), skeleton `KpiSkeleton count={3}` with the same grid and
  `itemClassName={(i) => (i === 0 ? 'col-span-2 xl:col-span-1' : undefined)}`.
- **Tables at 1280**: the content column is ~951px with the sidebar open. A table must fit it without sideways scroll:
  cap the entity column (`max-w-[380px]` + `truncate`), let short text columns wrap (`max-w-[9rem]`), let action
  groups wrap (`flex-wrap justify-end`), drop a column into the entity subline before adding width.

### 7.6 Per-screen checklist
1. One focal block, visible above the fold at 375×812 and 1024×768 (DESIGN §6).
2. `PageHeader` (or the detail header) is the only title; no back link, no own top bar, no extra max-width, no
   `document.title` (the frame sets it). Page root `space-y-6 md:space-y-8`; page tabs `PAGE_TABS_BLEED`.
3. Two-column / 4-up layouts switch at `xl`; nothing overflows at 1024 with the sidebar open.
4. Only kit / common components and token classes (no raw colours, no `text-[Npx]` where a token exists,
   no `border-border` at 100% on cards — `border-border/70`).
5. Status = icon + word + soft tint; blue only for action/selection; one primary button per region.
6. Touch: 44px targets (`touch-tap`), no hover-only affordances; Vietnamese labels never wrap inside controls.
7. Loading = skeletons in the real layout; empty = `EmptyState` with a natural sentence; errors = `ErrorState`.
8. Typecheck 0 errors in your files; no console errors; check 1440×900, 1024×768 and 375×812.