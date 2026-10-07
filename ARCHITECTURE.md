# Client Hub — architecture & team contract

Read this whole file before writing code. It is the contract every contributor (human or agent) codes against.
The product spec is `SPEC.md` (Vietnamese, sections 1–12). When this file and SPEC.md disagree on behaviour, SPEC.md wins;
on code structure, this file wins.

---------------------------------------------------------------------------------------------------

## 0. Hard rules of this machine

1. **NEVER run `node`, `npm`, `npx`, `pnpm`, `yarn`, `tsc`, `vite` or anything in `C:\Program Files\nodejs`.**
   The `node.exe` there is a suspicious unsigned wrapper (possible malware). Do not touch, rename or delete it either.
2. The Bash tool returns no output here — use the **PowerShell** tool (Windows PowerShell 5.1: no `&&`, use `;`).
3. There is no build step. The app runs as native ES modules in the browser:
   - `.claude/serve-hub.ps1` serves `client-hub/` on **http://localhost:8780** (launch config name `client-hub`,
     start it with the Browser `preview_start` tool — never with a shell). It resolves extensionless imports to
     `.ts/.tsx`, and unknown routes fall back to `nobuild.html`.
   - `sw.js` (service worker) transpiles every `/src/**/*.ts(x)` with sucrase (TypeScript + JSX, automatic runtime).
     **There is no type checker.** Write code that would pass `tsc --strict`; review your own types carefully.
   - `nobuild.html` holds the **import map** (React 18.3.1, react-router-dom 6.28, radix-ui 1.4.3, lucide-react 0.468,
     recharts 2.15, sonner 1.7, clsx, tailwind-merge, class-variance-authority) and loads Tailwind Play CDN with
     `tailwind.config.js`. You may only import packages listed in that import map, plus `@/…` paths.
   - The same sources also build with Vite on a normal machine (`index.html`, `vite.config.ts`, `package.json`).
4. Verify in the browser. Useful moves (Browser tools, `mcp__Claude_Browser__*`):
   - Create **your own tab** (`tabs_create`), navigate it to `http://localhost:8780/...`, pass its `tabId` to every
     call, and close it when done. Never drive another agent's tab.
   - Run any module directly from the page:
     `const m = await import('/src/dev/domainTests'); m.runDomainTests()` (import map + SW apply).
   - **Gotcha — always import extensionless from page scripts**: `'/src/services/api'`, never `'/src/services/api.ts'`.
     The app's modules import each other as `@/services/api` → `/src/services/api`; a URL with the extension is a
     DIFFERENT module instance (its own `db`, session and caches), so what you read or write through it is not what
     the app sees.
   - Every tab of `localhost:8780` shares `localStorage`; `db.ts` replaces a tab's whole in-memory db when another
     tab writes. Agents testing at the same time can overwrite each other's data mid-test — run data checks
     synchronously (or in one `await` chain right after `api.resetDemoData()`), and expect the session to be the one
     of your own tab (sessionStorage).
   - Self tests: `/dev/selftest` (or `runDomainTests()` · `runCrmTests()` from `/src/dev/crmTests` (CRM + client map) ·
     `await runRbacTests()` from `/src/dev/rbacTests` ·
     `checkSeed(buildSeed(todayISO()), todayISO())` from `/src/data/seedChecks` · `await runApiSmoke()` from
     `/src/dev/apiSmoke`, which also runs the demo scenario checks of `/src/dev/scenarioChecks` on a fresh db).
     `runRbacTests` and `runApiSmoke` run on a **private in-memory copy** of the db (`db.isolated(fn)`): nothing they
     write (test rows, the smoke test's fresh-seed reset, sweeps) reaches `localStorage`, other tabs' writes are
     ignored meanwhile, and the tab reloads the shared data when they end — test data can never leak into another
     tab or a client walkthrough. Run one suite at a time per tab (they switch the tab's session).
   - Transpile errors appear as `SyntaxError: Transpile error in /src/...` in `read_console_messages`.
   - Data is persisted in `localStorage['clienthub.db.v1']`. Reset with
     `localStorage.removeItem('clienthub.db.v1'); location.reload()` or
     `const {api} = await import('/src/services/api'); await api.loginDemo('director'); await api.resetDemoData()`
     (the reset is a director / AM action).
   - Log in quickly: `const {api} = await import('/src/services/api'); await api.loginDemo('client_owner')`
     (roles: `director`, `am`, `member`, `client_owner`, `client_member`) then navigate.
   - Every `api` response is recorded in `window.__CH_NET__` (array of `{ method, role, payload }`) — use it to prove
     data-level RBAC.
5. **Type checking (real tsc, in the browser)**: open `http://localhost:8780/tools/typecheck.html?auto=1` in your tab
   (optionally `&only=src/features/portal` to list only errors under a prefix — the whole program is still checked).
   Poll `window.__TC_RESULT__` until `done: true` → `{ total, byFile: { [path]: [{ line, col, code, message }] } }`, or
   call `await window.__TC_RUN__('src/features/portal')`. ~4 s with a warm cache. Strict mode, verbatimModuleSyntax,
   React 18 types. Code `TC99001` = runtime import of a package that is not in the import map. **Your files must end
   with 0 errors.** Do not edit `tools/**`.

## 1. Code conventions (sucrase + Vite compatible)

- TypeScript everywhere, React function components, hooks. Strict typing; no `any` unless unavoidable (then `unknown`).
- **Type-only imports must use `import type { … }`** (or inline `type` modifiers). Never re-export a type with plain
  `export { X }` — use `export type { X }`. (Runtime ES modules have no types; a plain import of a type crashes.)
- Import with the alias: `import { api } from '@/services/api'`. Relative imports are fine inside one feature folder.
  Imports are extensionless. **No directory/index imports** (`'@/components/ui'` ✗ → `'@/components/ui/button'` ✓).
- No JSON imports, no `require`, no Node APIs, no `process.env`. No new npm packages.
- Named exports for components/functions. (i18n namespace files are the only default exports.)
- Circular imports are allowed only if nothing from the cycle is used at module-evaluation time.
- Keep files focused (< ~400 lines). Comments only where intent is not obvious.
- Do not edit files you do not own (see §11). If you need something from another owner, code against the contract
  in this file; if it is truly missing, add it in a file you own and mention it in your final report.

## 2. Folder map

```
client-hub/
  nobuild.html  sw.js  vendor/          no-build runtime (do not edit unless you own infra)
  index.html  vite.config.ts  package.json  tsconfig.json  postcss.config.js  components.json   Vite project files
  tailwind.config.js                    design tokens (single source for both runtimes)
  supabase/schema.sql                   target Postgres schema + RLS (future backend)
  src/
    main.tsx  App.tsx  index.css
    i18n/index.ts  i18n/vi/<namespace>.ts
    domain/      pure logic, no React, no db:  types clock dates graph health taskRules quoteMath payments naming
    data/        seed (mock data) + sample files
    services/    contract.ts (DTOs + Api) db.ts context.ts effects.ts views.ts sanitize.ts api.ts
                 commercialViews.ts commercialEffects.ts notifyEvents.ts notifyEngine.ts digest.ts unblockNotices.ts
                 api/*.ts
    hooks/       useQuery useAction useViewer useMedia useTaskDrawer usePortalProject
    lib/         utils (cn, newId, normalizeText) format toast errors (apiErrorMessage)
    components/ui/       shadcn-style primitives (Radix from 'radix-ui')
    components/common/   product display components (badges, labels, chains, empty states…)
    components/task/     task card, task drawer, actions (shared by portal + internal)
    components/remind/   remind + Zalo buttons
    components/commercial/QuoteDocument.tsx
    layouts/     InternalLayout ClientLayout ViewAsClientBanner
    features/<feature>/  pages and feature components
    dev/         testkit domainTests rbacTests apiSmoke scenarioChecks
```

## 3. Design system (SPEC §7) — non-negotiable

- Tokens live in `tailwind.config.js` + `src/index.css`. Use **only token classes**: `bg-background` (page #F6F8FC),
  `bg-card` (#FFF), `text-foreground` (#0F172A), `text-muted-foreground` (#475569), `text-caption` (#5E6E84 — SPEC's
  #64748B darkened so 13px captions reach 4.5:1 on the tinted backgrounds as well, not only on white),
  `border-border` (#E5E9F0), `bg-primary`/`hover:bg-primary-hover`, `bg-primary-soft` (#EEF3FF), `border-primary-border`,
  status pairs `text-success bg-success-soft`, `text-warning bg-warning-soft`, `text-danger bg-danger-soft`,
  internal notes `bg-note border-note-border`. Never use raw Tailwind palette colors (`bg-blue-600`, `text-gray-500`) or hex.
- ~80% white/light, ~15% blue, ~5% status color. Status color only for status, **always with an icon and text**.
  One blue accent per card at most. No gradients, no heavy shadows (`shadow-card` / `shadow-pop` / `shadow-drawer` only).
- Font: Be Vietnam Pro (already global). Body `text-body` (15px), tables `text-table` (14px), KPI numbers
  `text-kpi font-semibold tabular` (30px). All numbers: `tabular`.
  **Gotcha:** `text-caption` is BOTH a font size (13px) and a colour (#5E6E84) → it is a "caption style" utility.
  Never combine `text-caption` with another text size; for caption-coloured text at another size use
  `text-muted-foreground`. For 13px text in another colour use `text-[13px] leading-[18px]` (`SMALL` in
  components/common/cx.ts). No visible text below 11px (avatar initials 11px at xs, 12px from sm; step numbers 12px).
  `cn()` (lib/utils) is a tailwind-merge configured with the custom tokens (`text-caption|table|body|kpi` are font
  sizes, `shadow-card|pop|drawer`, `min-h-tap`, `min-w-tap`), so `cn('text-table text-muted-foreground')` keeps both.
- Radius: cards `rounded-xl` (12px), buttons/inputs `rounded-lg` (8px). Spacing on an 8px grid (`p-2/4/6/8`, `gap-2/4/6`).
- Icons: `lucide-react`, 16–20px (`h-4 w-4` / `h-5 w-5`), `aria-hidden` when decorative.
- Details open in a **drawer** (Sheet, right on desktop, full-screen on mobile). Dialog only for irreversible actions
  or short required input (reason). Loading = skeletons (`Skeleton`, `.skeleton`), never a full-page spinner.
  Every list/screen has a natural-language empty state. No pop-ups that interrupt.
- Responsive: phone 375px, iPad 768–1024 (primary for C-level), desktop ≥1280. Breakpoints: `md` 768, `lg` 1024, `xl` 1280.
  No horizontal page scroll (tables may scroll inside their card). On mobile every tappable thing ≥44px (`min-h-tap`;
  `Button size="sm"`, `NativeSelect size="sm"` and pill tabs already are 44px below `md`). **Touch screens (phones
  AND iPad):** the kit's compact `md:` sizes apply to mouse users only — `touch-tap` / `touch-tap-square` (index.css,
  `@media (pointer: coarse)` → min 44px) are already on Button (not inline links), Input, NativeSelect, Select,
  tabs, toggle groups, the client top menu and the user menu; put `touch-tap` on any other custom control that is
  smaller than 44px from `md` up. Checkbox / Radio / Switch enlarge their hit area with `::after`; make a long label
  row the `<label>` itself (`min-h-tap`). Form controls use 16px text below `md` (no iOS zoom on focus).
  Internal tables become cards below `xl` (1280): iPad portrait AND landscape (1024) get cards (SPEC §4.1).
  File uploads: never show the native `<input type="file">` (its browser text is English) — hide it behind a Button
  with i18n text (see `FileUploadDemo` in ui/__gallery.tsx).
- Accessibility: WCAG AA contrast (every text token reaches 4.5:1 on `bg-card`, `bg-background`, `bg-muted`,
  `bg-primary-soft` and the status/note softs; placeholders use `text-muted-foreground`, never an alpha-faded colour),
  keyboard reachable, visible focus (global `:focus-visible`),
  `aria-label` on icon-only buttons, dialogs/drawers trap focus (Radix does), meaningful headings.
- Client wording: never "sprint, ticket, backlog". Use "việc", "mốc", "giai đoạn". Neutral tone: "Đã quá hạn 3 ngày",
  never blame. Address the client by stored salutation: "Chào anh Minh", "việc cần chị xử lý".

## 4. i18n

- No Vietnamese literals in `.tsx`/`.ts` UI code — use `t('ns.key', params)` from `@/i18n` (`t`, `hasKey`, `capitalize`;
  `@/i18n` is the file `src/i18n.ts`, a re-export of `src/i18n/index.ts`).
  Data content (task titles, impact texts, names) comes from the data layer and is not translated.
- Each namespace file `src/i18n/vi/<ns>.ts` has exactly one owner (§11). Add your keys there:
  `const portal = { home: { greeting: 'Chào {salutation} {name}, tuần này có {count} việc cần {salutation} xử lý.' } }; export default portal;`
- Placeholders `{name}`. Sentence-initial salutation: `capitalize(salutation)`.
- Enum labels (roles, stages, tiers, health, task status/type/action, quote/payment status, units, decision roles,
  visibility, notification kinds) live in `enums.ts`: keys `enums.<enumName>.<value>`, e.g. `enums.health.blocked`,
  `enums.taskAction.approve` = "Xem & duyệt". Use them instead of redefining.
- Activity sentences: `activity.<action>` where action is the `ActivityAction` with dots, e.g. `activity.task.approved`
  = "{actor} đã duyệt “{task}”". Params available: `actor` (full name, filled by UI) + the activity's `params`.

## 5. Formatting (`src/lib/format.ts`, owner G1)

```ts
formatMoney(v: number): string               // 1.250.000.000 ₫
formatMoneyCompact(v: number): string        // 1,25 tỷ ₫ · 850 tr ₫ · 12,5 tr ₫ · 950.000 ₫
formatNumber(v: number, digits?: number): string   // 1.234,5
formatPercent(v: number, digits = 0): string        // 15%  (v already in %)
formatDate(d: ISODate | ISODateTime): string        // 06/10/2026
formatDateShort(d): string                           // 06/10 (current year) · 08/01/2027 (another year)
formatDateTime(dt: ISODateTime): string              // 06/10/2026 14:05
formatWeekday(d): string                             // Thứ Hai
formatRelativeDays(daysLeft: number): string         // 'hôm nay' | 'ngày mai' | 'còn 5 ngày' | 'quá hạn 3 ngày'
formatRelativeTime(dt: ISODateTime): string          // 'vừa xong' | '5 phút trước' | '2 giờ trước' | 'hôm qua' | '3 ngày trước' | 06/10/2026
formatFileSize(bytes: number): string                // 1,2 MB
```
Vietnamese locale: thousands separator `.`, decimal `,`. Dates always dd/mm/yyyy. Uses `todayISO()` from `@/domain/clock`.

## 6. Data flow

UI → `api` (only import from `@/services/api`; types from `@/services/contract`) → service modules → `db`.

- `api` methods are async and simulate a short network delay (80–220 ms) so skeletons are real.
- `api.onDataChange(cb)` fires after every committed mutation; `useQuery` refetches automatically (keeping old data
  visible while refetching — skeleton only on first load). After a mutation you never refetch by hand.
- **Security**: every result passes `sanitizeOutgoing(result, viewer)` and a JSON round-trip before reaching the UI
  (`window.__CH_NET__` logs it). Client viewers never get keys `cost_price`, `cost_total`, `margin`, `margin_pct`,
  `internal_notes`, `internal_note`, `health_override_reason`, `manual_unblock_reason`, `manual_unblocked_by`, nor
  `override_reason` **inside HealthInfo** (objects that also have `overridden`: the AM's health-override reason is
  internal), nor any element with `visibility: 'internal'` or `client_visible: false`. `MilestoneView.override_reason`
  (reason of a manual forecast) IS sent to clients — SPEC 5.4 "lý do nếu lùi". Internal viewers without cost
  permission never get the cost keys. Filtering happens in views first; sanitize is defence in depth
  (`isClientForbiddenKey(obj, key)` in `sanitize.ts` is the single rule, also used by the RBAC scan).
- Hooks (owner G1):
  ```ts
  useQuery<T>(fn: () => Promise<T>, deps: unknown[], opts?: { enabled?: boolean }):
    { data: T | undefined; loading: boolean /* first load only */; refreshing: boolean; error: unknown; refetch(): void }
  useAction(): { run<T>(fn: () => Promise<T>, opts?: { success?: string; successParams?: TParams;
                 undoToken?: (r: T) => string | null }): Promise<T | undefined>; pending: boolean }
     // ApiError → toast.error(apiErrorMessage(err)) (src/lib/errors.ts): t(err.messageKey), or — when err.details is
     // set and '<messageKey>_detail' exists (errors.blocked_detail {blockers}, errors.cycle_detail {path},
     // errors.domain_mismatch_detail {domain}) — that sentence, arrays joined with ' → ' for `path`, ', ' otherwise.
     // success → toast (with 5 s "Hoàn tác" when undoToken returns a token,
     // which calls api.undoAction(token) and toasts t('common.toast.undone')). Client task actions return
     // ActionResult.message_key = 'task.toast.<action>' (keys in i18n task.ts), toasted automatically.
  useViewer(): Viewer | null
  useMediaQuery(query: string): boolean
  useBreakpoint(): 'mobile' | 'tablet' | 'desktop'       // <768 | 768–1279 | ≥1280
  useTaskDrawer(): { taskId: string | null; open(id: string): void; close(): void }   // URL search param `task`
  usePortalProject(): { projectId: string | null; setProjectId(id: string | null): void; projects: { id: string; name: string }[] }
  ```
  `src/lib/toast.ts` (G1): `toastSuccess(message: string, opts?: { onUndo?: () => void | Promise<void> })`,
  `toastError(message: string)`, `toastInfo(message: string)`.

## 7. Domain engine (owner B) — pure functions, no db

### dates & clock (already written)
`@/domain/clock`: `todayISO()`, `nowISO()`, `now()`, `setNow()`, `dateOf()`, `atTime()`, `TIMEZONE`.
`@/domain/dates`: `addDays`, `diffDays(a,b)=a−b`, `isOverdue(due, today)` (today > due), `weekday`, `startOfWeek`,
`endOfWeek`, `maxDate`, `minDate`, `isValidISODate`, `monthOf`.

### `src/domain/graph.ts`
```ts
export interface AccountGraphInput { tasks: Task[]; deps: TaskDependency[]; milestones: Milestone[]; today: ISODate }
export interface ForecastInfo {
  milestone_id: ID; planned_date: ISODate; forecast_date: ISODate; delay_days: number; source: ForecastSource;
  cause_task_id: ID | null; cause_delay_days: number; cascade_from_milestone_id: ID | null; override_reason: string | null;
}
export interface RawChainNode { kind: 'task' | 'milestone'; id: ID; state: 'done' | 'stuck' | 'pending' }
export interface AccountGraph {
  readonly today: ISODate;
  task(id: ID): Task | undefined;
  milestone(id: ID): Milestone | undefined;
  /** unfinished direct blockers (empty when the task was manually unblocked) */
  blockersOf(taskId: ID): Task[];
  isBlocked(taskId: ID): boolean;
  blocksTasks(taskId: ID): Task[];               // direct downstream tasks
  /** not-done milestones this NOT-done task holds back, directly or through downstream not-done tasks */
  milestonesHeldBy(taskId: ID): Milestone[];
  forecast(milestoneId: ID): ForecastInfo;        // every live milestone has one
  /** visibleMilestone (clients: m.client_visible): the chain never runs through / ends on a hidden milestone —
   *  route to the most-impact VISIBLE milestone; if only hidden ones are reachable, end on the visible launch
   *  milestone they push back (when later in that project) */
  chain(taskId: ID, visibleMilestone?: (m: Milestone) => boolean): RawChainNode[];
}
export function taskDelayDays(task: Task, today: ISODate): number
export function buildAccountGraph(input: AccountGraphInput): AccountGraph
/** returns the task-id path of a cycle if `proposed` edges (task_id blocks blocks_task_id) were added, else null */
export function findCycle(existing: { task_id: ID; blocks_task_id: ID | null }[], proposed: { task_id: ID; blocks_task_id: ID }[]): ID[] | null
```
Rules (SPEC §3):
- `taskDelayDays`: not done → `max(0, today − due_date)`; done → `max(0, dateOf(completed_at) − due_date)`.
- Blocking: edge A→B (A blocks B). B is blocked when any blocker A is not done, unless B has `manual_unblock_reason`.
  A manual unblock waives the blockers B has at that moment only: when B later gains an unfinished blocker (edit of
  B's or the blocker's dependencies, new task blocking B) or one of B's blockers is reopened (done → not done), the
  service clears `manual_unblock_*` and logs `task.updated` (fields: manual_unblock_reason) — B is blocked again.
- Milestone own delay N(M) = max delay over the **upstream set** of M: start from tasks with a dependency
  `blocks_milestone_id = M`; for each such task count its delay; if it is not done, continue to its blockers
  (skip edges into a manually-unblocked task); a done task stops the walk. Indirect blocking counts (A→B→M ⇒ A delays M).
- Forecast per project, milestones in `order_no`:
  - done milestone → `forecast = dateOf(completed_at)`, source `'done'`, does not push later milestones.
  - `forecast_override_date` set → that date, source `'manual'`, delay = override − planned.
  - else shift = max(N(M), shift of every earlier not-done milestone in the project). If shift comes from an earlier
    milestone (strictly greater than N(M)) → source `'cascade'` with `cascade_from` that milestone and the same cause task;
    else if N(M) > 0 → `'dependency'` (cause = the task with the max delay); else `'on_plan'`.
    Manual overrides push later milestones by their delay as well (negative shifts count as 0).
  - forecast = planned + shift.
- `findCycle`: directed task graph; also reject self-dependency. Milestones are sinks (no cycles through them).
- `chain(taskId)`: [first unfinished blocker if the task is blocked] → the task → the downstream route to the milestone
  with the **most impact** (a milestone of the task's own project first, then the HIGHEST `order_no`; ties → shortest
  route, then earliest planned) → the project's **launch milestone** if it is later. State: `done` for done nodes; the
  first not-done node whose delay > 0 (overdue) is `stuck` (at most one); everything else `pending`.
  Example (seed, from the approval itself or from the blocked task):
  "Duyệt thiết kế màn hình Đặt hàng (stuck) → Lập trình phần Đặt hàng → UAT → Go-live" — even though the approval
  also blocks milestone Thiết kế directly.
- Launch milestone (`launchMilestone(openInOrder)` / `isLaunchMilestoneName(name)` in graph.ts): the last not-done
  milestone named like "Go-live" (any case, space or hyphen), else the last not-done milestone. A trailing
  "Hỗ trợ sau go-live" is support, not delivery, so chains and headlines ("Mốc Go-live đang chờ…", `headlineFor` in
  views.ts) end on Go-live. `ProjectView.final_milestone` stays the literal last milestone.

### `src/domain/health.ts`
```ts
export function computeHealth(g: AccountGraph, tasks: Task[], payments: PaymentSchedule[], today: ISODate):
  { auto: Health; reasons: HealthReason[] }          // HealthReason from contract.ts
export interface Headline { name: string; delay_days: number; id?: ID }
export function buildStatusLine(input: {
  health: Health;                     // effective (override wins)
  overridden: boolean;
  reasons: HealthReason[];            // already filtered for the viewer
  headline(milestoneId: ID): Headline;  // project's final milestone (Go-live) when the delay reaches it, else the milestone itself (headlineFor sets id)
}): StatusLine
```
- **blocked** (red): some not-done task is overdue AND holds a not-done milestone (direct or indirect).
- **attention** (yellow): otherwise, any other overdue not-done task; or a not-done task holding a milestone with
  0 ≤ days_left ≤ 3; or a payment whose effective status is overdue.
- **on_track** (green): otherwise. Override (`health_override`) replaces the value; reasons still listed.
- Responsibility: an overdue task that is itself **blocked** (unfinished blocker, no manual unblock) gives no reason
  of its own — its blocker carries it (New Era is not blamed for work the client holds up). The same rule applies to
  the director's attention items and to the `WaitingCounts` (blocked tasks are not counted at all). The client
  payment task of an installment that is itself overdue gives no `overdue_task` reason — the `overdue_payment`
  reason stands for it (status line `payment_overdue`, not `overdue`).
- Reasons sorted: overdue_blocking (overdue_days desc) → due_soon_blocking (days_left asc) → overdue_task → overdue_payment.
- Status line: blocked & a client-waiting overdue_blocking reason → `waiting_client` (milestone = headline of the
  first; count = distinct client tasks whose headline is that SAME milestone — by `id`, so two projects' "Go-live"
  are not merged; delay_days = min(headline delay, the largest overdue_days of those client tasks) — a larger delay
  from another, e.g. hidden, cause is not put on the client); blocked & only internal ones → `waiting_internal` (same
  cap: delay = min(headline delay, largest overdue_days of the visible internal reasons with that headline) — the named
  task is never blamed for a hidden task's delay); attention → first matching of
  `due_soon_blocking` (client side) → `overdue` → `payment_overdue`; overridden or nothing matching → `generic`;
  on_track → `on_track`.

### `src/domain/taskRules.ts`
```ts
export function dueInfo(dueDate: ISODate, done: boolean, today: ISODate): DueInfo
export function priorityRank(x: { due: DueInfo; is_blocking_milestone: boolean }): 1 | 2 | 3 | 4
export function compareClientTasks(a: TaskView, b: TaskView): number   // rank asc, due_date asc, title (vi collation)
export function actionForType(type: ClientTaskType): TaskActionKind    // approval→approve, upload→upload, confirm→confirm, sign→sign, payment→payment, attend→attend, answer→answer
export type ClientAction = 'approve' | 'request_changes' | 'submit_files' | 'report_payment' | 'confirm' | 'answer';
export function clientActionAllowed(task: Task, action: ClientAction): boolean
export function clientActionPatch(task: Task, action: ClientAction, at: ISODateTime): Partial<Task>
export function reviewPatch(task: Task, decision: 'accept' | 'return', at: ISODateTime): Partial<Task>
export function canMoveTo(task: Task, to: TaskStatus, blocked: boolean): { ok: true } | { ok: false; reason: 'blocked' | 'invalid' }
export function statusPatch(task: Task, to: TaskStatus, at: ISODateTime): Partial<Task>
```
- Due: overdue when today > due & not done; due_soon when 0 ≤ days_left ≤ 3 and not overdue.
- Rank: 1 overdue & blocking milestone · 2 due_soon & blocking · 3 other overdue · 4 rest.
- `waiting_on` state machine: approve/confirm/answer(+attend) → `done`, waiting_on null, completed_at.
  request_changes/submit_files(upload, sign)/report_payment → status `waiting`, waiting_on `internal`.
  review accept → `done`; review return (new version / redo) → status `todo`, waiting_on `client`, revision+1.
  Internal tasks: waiting_on `internal` until done; done → null; reopen → `internal`.
- Blocked tasks cannot leave `todo` (`reason: 'blocked'`). Client tasks may only be moved by staff to `done`/`todo`.
- Counters ("Đang chờ khách / Đang chờ New Era") count open, **not blocked** tasks by waiting_on; overdue counts likewise.

### `src/domain/quoteMath.ts`
```ts
export interface PricingLookup { item(id: ID): { code: string; name: string; unit: PriceUnit; list_price: number; cost_price: number } | undefined; applicable(id: ID): number }
export interface ComputedLine { line: QuoteLine; code: string; name: string; unit: PriceUnit; list_price: number; applicable_price: number; subtotal: number; discount_amount: number; header_share: number; net: number; vat_amount: number; total: number; cost_total: number }
export function computeQuote(lines: QuoteLine[], discountPctTotal: number, pricing: PricingLookup): { lines: ComputedLine[]; totals: Required<QuoteTotals> }
export function needsDirectorApproval(effectiveDiscountPct: number, thresholdPct: number): boolean   // strictly greater
export function diffQuoteLines(prev: QuoteLine[], next: QuoteLine[]): { byLineId: Map<ID, { change: LineChange; changed_fields: QuoteLineView['changed_fields'] }>; removed: QuoteLine[] }
```
subtotal = qty×unit_price; discount_amount = subtotal×discount_pct%; header_share = (subtotal−discount_amount)×discount_pct_total%;
net = subtotal − discount_amount − header_share; vat = net×vat_rate%; total = net + vat. Round each money value to whole VND.
effective_discount_pct = (1 − Σnet / Σ(qty×applicable_price))×100, 2 decimals (unit-price cuts below the account's
applicable price count as discount). margin = Σnet − Σ(qty×cost_price); margin_pct = margin/Σnet×100. Lines match across
versions by price_item_id (+description).

### `src/domain/payments.ts`
```ts
export function effectivePaymentStatus(p: PaymentSchedule, today: ISODate): PaymentStatus   // invoiced/overdue && today > due → 'overdue'; paid stays paid
export function paymentOverdueDays(p: PaymentSchedule, today: ISODate): number
export function isReceivable(status: PaymentStatus): boolean                                  // invoiced | overdue
```

### `src/domain/naming.ts`
```ts
export function givenName(fullName: string): string            // 'Trần Quang Minh' → 'Minh'; 3+ words ending in 'Anh'
                                                               // keep two ('Trần Đức Anh' → 'Đức Anh') unless after Văn/Thị
export function addressName(s: Salutation | null, fullName: string): string   // 'anh Minh' (no salutation → full name)
export function initials(name: string): string                 // 'Cỏ Xanh Retail' → 'CX', 'Trần Quang Minh' → 'QM'
```

Domain tests: `src/dev/domainTests.ts` exports `runDomainTests(): TestResult[]` (uses `@/dev/testkit`), covering every
rule above with small hand-built fixtures (blocked chain, indirect delay, cascade, manual override, done-late blocker,
cycle detection, health colours, status lines, priority sort, quote math & threshold, payment overdue).

## 8. Service layer (owners C, D, E)

`src/services/db.ts`, `context.ts`, `effects.ts`, `contract.ts` are written (owner: lead). Read them.
- `db.batch(fn)` → `{ result, changes }`; `db.revert(changes)` undoes. Wrap every mutation in one batch.
- `context.ts`: `requireViewer`, `assertWritable` (call first in every mutation!), `assertAccount`, `assertManagerOf`,
  `isManagerOf`, `assertInternal`, `assertRole`, `accessibleAccountIds`, `canSeeCost`, `toUserRef`, `accountOf*`.
- `effects.ts`: `logActivity`, `notifyUsers`, `deliverEmail`, `accountUsers`, `internalOwners`.

### `src/services/views.ts` (C) — viewer-aware DTO builders
```ts
export function accountRef(a: Account): AccountRef
export function userRefById(id: ID | null | undefined): UserRef | null
export function graphForAccount(accountId: ID): AccountGraph               // memoized per db.version
export function milestoneRef(m: Milestone): MilestoneRef
export function milestoneView(m: Milestone, v: Viewer): MilestoneView
export function projectView(p: Project, v: Viewer): ProjectView           // milestones filtered for clients (client_visible)
export function canViewTask(t: Task, v: Viewer): boolean                   // access + client_visible rules
export function taskView(t: Task, v: Viewer): TaskView                     // caller must check canViewTask
export function taskDetail(t: Task, v: Viewer): TaskDetail
export function healthFor(accountId: ID, v: Viewer): HealthInfo
export function countsFor(accountId: ID, v: Viewer): WaitingCounts
export function accountSummary(a: Account, v: Viewer): AccountSummary
export function accountDetail(a: Account, v: Viewer): AccountDetail
export function fileView(f: FileItem, v: Viewer): FileView | null          // null when hidden from viewer
export function commentView(c: TaskComment, v: Viewer): CommentView | null
export function activityView(a: Activity, v: Viewer): ActivityView | null
```
Client visibility: client tasks always visible to their company; internal tasks only if `client_visible`; client
viewers see only `client_visible` milestones, `shared` comments/files/activities. Hidden blockers/chain task nodes keep
their id but `title/label = null`; hidden MILESTONES never appear in a client chain (`graph.chain(id, visible)`), and
`TaskDetail.dependencies` (raw ids for the internal edit form) is empty for clients. `client_member` (SPEC §2 "việc được
giao cho mình và tiến độ chung") may OPEN (`canViewTask`: getTask, lists, search, comments) only the client tasks
assigned to them or delegated by them, plus the client-visible New Era tasks; a colleague's task is NAMED only
(`canNameTask`: blocker lists, impact chains, milestone causes, health reasons, waiting counts, task files) and opening
it answers `not_found`. Commercial tasks (`quote_id`, `payment_schedule_id` or type `payment`) are hidden from a
client_member AND an internal `member` unless assigned to them (`isCommercialTask`, in both rules and in activities);
`overdue_payment` health reasons (installment, amount, days) reach only `canAccessCommercial` viewers — the others keep
the colour. Clients get the effective health only: `HealthInfo.auto` = `value`, `overridden` false (also forced by
sanitize), `AccountDetail.health_override` null. `ContactView.last_interaction_at/_note` (the AM's CRM log) are null for
everyone but the director and AMs. `statusLineFor(accountId, v, { projectId })` builds the status band (client home and
digest): the AM override still turns it into the generic sentence, and for a client viewer a `waiting_client` line
carries `waiting_for` ({ name: 'anh Minh' | null, company }) when the waited-for task is not the viewer's own (assigned
to them; unassigned = the decision maker's) — "… đang chờ 1 việc từ anh Minh (Cỏ Xanh)" instead of "từ phía chị".
`activityProjectId(a)` (params.project_id, else the target's project) scopes the portal home's "Cập nhật mới" to the
selected project (account-wide entries stay).
Stored bell items / mails about a task are listed to a client only while that task is visible to them
(`taskMentionVisible`, by `task_id` or the task link) — hiding a task later hides what was sent about it.
Errors: a client asking for another company's row gets `not_found` (same as an unknown id, `noAccess(v)` in
context.ts); internal users get `forbidden`.
Permissions in `TaskView.can` follow SPEC §2; `primary_action` is computed for the current viewer
(client: by type when waiting_on client, not blocked, and the viewer may act; internal: `review_submission` when a client
task waits on New Era, `start`/`complete` for internal tasks).

### `src/services/commercialViews.ts` (D)
```ts
export function paymentView(p: PaymentSchedule, v: Viewer): PaymentView
export function contractView(c: Contract, v: Viewer): ContractView
export function quoteSummary(q: Quote, v: Viewer): QuoteSummary
export function quoteDetail(q: Quote, v: Viewer): QuoteDetail
export function accountMoney(accountId: ID): { contract_value: number; invoiced: number; collected: number; receivable: number; receivable_overdue: number }
export function commercialSummary(accountId: ID, v: Viewer): CommercialSummary | null   // null for client_member / member
export function cashflowForYear(year: number, accountIds: Set<ID>): { month: string; planned: number; actual: number }[]
export function quotesPendingApproval(accountIds: Set<ID>): Quote[]
export function overduePayments(accountIds: Set<ID>): PaymentSchedule[]
```
Clients see quotes only with status sent/accepted/changes_requested/expired and only for their account.

### `src/services/commercialEffects.ts` (D) — called inside the caller's db.batch
```ts
export function onMilestoneCompleted(milestoneId: ID, actorId: ID): void        // linked payments not_due → invoice_due
export function ensurePaymentTask(paymentId: ID, actorId: ID | null): Task | null  // client 'payment' task when invoiced (if enabled)
export function onPaymentReported(taskId: ID, proofFileId: ID, actorId: ID): void
export function onPaymentTaskAccepted(taskId: ID, actorId: ID): void            // → paid
export function onQuoteTaskApproved(quoteId: ID, actorId: ID, note?: string): void
export function onQuoteTaskChangesRequested(quoteId: ID, actorId: ID, reason: string): void
export function refreshOverduePayments(today: ISODate): number                   // used by the daily sweep
```
A client decision (accept / ask changes, from the quote page or through its approval task) on an expired quote throws
`ApiError('conflict', 'errors.quote_expired')`. `updatePayment(id, 'reopen')` (paid → invoiced) logs
`payment.reopened` (internal).

### `src/services/notifyEvents.ts` (E) — who gets told what, called inside the caller's batch
```ts
export type TaskEventKind = 'client_approved' | 'client_changes_requested' | 'client_submitted' | 'client_payment_reported'
  | 'client_confirmed' | 'client_answered' | 'client_question' | 'delegated' | 'returned_to_client' | 'submission_accepted'
  | 'task_assigned_client' | 'comment_shared' | 'unblocked';
export function notifyTaskEvent(kind: TaskEventKind, taskId: ID, actorId: ID | null, extra?: { note?: string; toUserId?: ID }): void
export type QuoteEventKind = 'approval_requested' | 'approved' | 'approval_rejected' | 'sent' | 'accepted' | 'changes_requested';
export function notifyQuoteEvent(kind: QuoteEventKind, quoteId: ID, actorId: ID, extra?: { note?: string }): void
export type PaymentEventKind = 'invoice_due' | 'invoiced' | 'reported' | 'paid' | 'overdue';
export function notifyPaymentEvent(kind: PaymentEventKind, paymentId: ID, actorId: ID | null): void
```
Links: clients → `/portal/tasks/<taskId>` (opens the task directly), internal → `/app/accounts/<accountId>/tasks?task=<taskId>`,
quotes → `/app/commercial/quotes/<id>` or `/portal/commercial/quotes/<id>`.

### `src/services/api/*.ts` and `src/services/api.ts`
Each module exports a `Pick<Api, …>` object. `api.ts` (C) merges them, wraps async methods with latency → call →
`sanitizeOutgoing` (`sanitize.ts`, C) → JSON clone → `window.__CH_NET__` log, and exports `export const api: Api`.
- C: `api/session.ts` (session, demo logins, view-as, onboarding, prefs), `api/reads.ts` (dashboard, accounts, projects,
  tasks, activities, files, contacts, users, portal home, search), `api/tasks.ts` (client actions, undo, delegate, ask,
  create/update/delete/status/unblock/visibility/review/comments/checkDependencies), `api/roadmap.ts`, `api/accounts.ts`
  (accounts, contacts, invites, user admin), `api/files.ts`, `api/settings.ts` (getSettings, updateSettings, resetDemoData).
- D: `api/commercial.ts` (price items, account prices, quotes, contracts, payments, receivables).
- E: `api/notify.ts` (listNotifications, markNotificationsRead, listOutbox, runNotificationSweep, getWeeklyDigest,
  remindClient, getZaloReminder) + `notifyEngine.ts` (daily sweep: 3-day & 1-day reminders, ≤1 overdue reminder/day,
  escalation to client_owner + director when a client task holding a milestone is overdue ≥ settings days, payment
  overdue refresh, auto payment tasks) + `digest.ts` (weekly digest model).
Undo: client actions keep `{ token → ChangeSet }` for 10 s; `undoAction` reverts and logs `task.action_undone` (internal).
It refuses with `conflict` / `errors.undo_conflict` when a row the action touched (bell items, mails and the log
excepted) or — for an action that completed the task — a direct downstream task changed since the action.

Round-1 rules (verifier fixes):
- `resetDemoData`: signed-in director / AM only, never in view-as (`read_only`). `startViewAsClient`: director or the
  account's AM (it shows the decision maker's own bell and mail); a stale view-as session of anyone else is ignored.
- `inviteClientUser` by a client_owner: only `client_member` (not `decision_maker`) — new decision makers come from New Era.
- `uploadFile`: an internal non-manager may share (`visibility: 'shared'`) only on a task assigned to them. A CLIENT
  upload joins a `doc_key` group only when every file in it is shared and uploaded by that company; otherwise it gets
  a fresh key (never a version of a New Era document, no hidden-version oracle).
- `checkDependencies`: every id must be a task of ONE account the caller can read (else `validation` dependency_scope).
- `getZaloReminder`: client tasks the client can act on now (`isRemindable`) only; `TaskView.can.remind` is false for
  blocked tasks.
- `createTask` / reassignment: a client task that starts blocked is not announced; the client gets the 'unblocked'
  notice ("Việc … đã sẵn sàng") when its last blocker is done / deleted / edited away (tasks.ts `announceUnblocked`).
- Quote decisions through the approval task log quote.* AND task.*; feeds of decisions (approvals history, client
  updates, client activity lists) keep the quote.* line only (`isQuoteTaskEcho`); the task history keeps both.
- Daily sweep: escalations reach each person at most once per rolling 7 days per task. The shell re-runs the
  (idempotent) sweep on login, on tab focus / visibility, every 15 min and after a demo reset.

Round-2 rules (verifier fixes):
- Daily sweep order: payments & quote expiry FIRST (an approval task withdrawn because its quote expired is never
  reminded), then client reminders / escalations / internal overdue, then the day's mail. Every policy mail of the
  run is HELD (`holdingPolicyMail` in effects.ts → status 'batched', reason 'held'); `sendDailyMail` then gives each
  person ONE non-urgent mail (1-mail/day policy; if the quota is already used everything waits for tomorrow): the
  pending mails (yesterday's batch + today's reminders) are REBUILT from current data — a mail about a task that is
  deleted, done (requests to act) or no longer visible to that client is dropped, reminders are merged per task and
  re-dated ("Đã quá hạn 9 ngày"); a single fresh item is sent as it is (its own deep link), several become
  "Tóm tắt N cập nhật mới" with a deep link under every line. Tasks a run creates are not reminded the same day.
  Reminders (sweep and "Nhắc khách") skip approval tasks whose quote is expired or superseded.
- `EmailMessage.task_ids?` lists every task a mail names (own task, summary lines, weekly bulletin waiting lists and
  status sentence). `listOutbox` shows a client a stored mail only while ALL of them are visible to them
  (`mailTaskIds` in notifyEvents.ts; old rows fall back to the task in `link`).
- "Việc … đã sẵn sàng": `services/unblockNotices.ts` (`blockedClientTasks`, `announceUnblocked`, `withUnblockNotices`)
  is called by every path that completes or removes a task: client actions, internal edits, quote acceptance from the
  quote page, payment acceptance (`markPaymentPaid`), approval tasks closed by a new version or withdrawn on expiry,
  payment tasks withdrawn by the AM. The 'unblocked' notice also reaches the ACTOR when they were never told about that
  task (an assignee completing the blocker of their own blocked task). `notifyTaskEvent(…, actorId: ID | null)` —
  null = system.
- Commercial module (quotes, contracts, payments, receivables, commercial activities, contract / proof files,
  account money): director, AM, client_owner only (`canAccessCommercial`) — an internal `member` gets `forbidden`
  like a client_member (SPEC §2: members see and do assigned work). Price list and account prices: director / AM.
- `getSettings()` returns `Settings | ClientSettings` (contract.ts): a client receives only `CLIENT_SETTINGS_KEYS`
  (company, timezone, reminder days, digest weekday/hour); narrow with `isFullSettings(s)`.
- Client viewers: document `version` counts only the versions they can see (no hidden-version gap), `file.uploaded`
  activities carry no `version`, and `CommentView.reply_to_id` is null when the parent comment is hidden from them.
  Client mutations naming another company's account answer `not_found` (`findAccount` in api/accounts.ts).
- Seed internal notes / files carry no cost or margin figures (they reach every internal viewer); cost lives only in
  the cost-gated fields. The demo OTP / password shortcuts (`demo_code`, distinct unknown-email errors) are demo-only:
  a real backend answers unknown and wrong credentials with one error and never returns the code.

Integration rules (feature-phase integrator):
- `acceptSubmission` refuses an **approval** task (`conflict` / `errors.approval_needs_client`): an approval waits on
  New Era only after the client asked for changes, and accepting would approve in the client's place — New Era sends a
  new version (`returnToClient`). `returnToClient` refuses a quote's approval task (`quote_id`;
  `errors.quote_task_needs_version`) — a new quote version closes it and asks the client again.
- `healthFor(accountId, v, { projectId })` (portal project selector) derives the colour from that project's own
  reasons (+ overdue payments), so the status band of an on-plan project is not red because of another project.
- Client viewers get `effective_discount_pct = 0` in `QuoteSummary` and `QuoteDetail.totals` (approval threshold
  input = internal workflow, like `needs_approval` / `threshold_pct`).
- `account.health_overridden` activities carry `health_label` (enums.health word) for the sentence.
- `db.ts`: `DbMeta.generation` is set on every reseed; `db.reset()` writes storage at once, and a tab ignores (and
  overwrites) a stored copy of an older generation — a stale tab can no longer undo a demo reset of another tab.
- The seed has no escalation bell items: the first sweep after a reset sends the Cỏ Xanh escalation (bell + urgent
  mail to Minh and the director), so the SPEC §6 escalation shows in the outbox on fresh data.
- `prefers-reduced-motion`: animations last 1 ms (one iteration) and transitions 0 s (index.css).

Acceptance round (foundation fixer):
- "Nhắc khách" (`remindClientTasks`, also bulk): a bell item per task, but ONE immediate mail per person — one task →
  that task's own mail, several → "New Era nhắc N việc cần xử lý" listing every task with its deep link
  (`task_ids` = all of them); reminder_count + `task.reminded` per task as before.
- Weekly digest: `buildWeeklyDigest(rv, 'upcoming')` (preview, default) is dated with the NEXT send slot — next week's
  once this week's weekday/hour has passed — so the header never shows a past date over content that runs to today;
  the Monday send (`sendWeeklyBulletins`) uses `'current'`.
- Invoice numbers left blank continue the one sequence: highest numeric `invoice_no` + 1, 7 digits zero-padded
  (`0000576`) — the format of the seeded invoices.
- Client map groups (§13b): an AM reads the description / industry of, and may rename or rewrite, only a group holding
  at least one company of hers (an account she manages or an open lead she owns); other groups are listed by name
  only (to join them) and `saveEcosystem` refuses field changes on them (`forbidden`; joining keeps the stored fields).
- `formatDateShort` / `fmtDay` (mails) add the year when it is not the current one ("08/01/2027").

## 9. Seed data (owner A) — `src/data/seed.ts`

`export const SEED_VERSION = 2; export function buildSeed(today: ISODate): Omit<DbData, 'meta'>` (bump it whenever
stored demo data must be replaced — a stored db of another version is reseeded on load)
(`import type { DbData } from '@/services/db'`). All dates are **relative to `today`** (`addDays(today, n)`) so the
scenarios are always true. Impact texts embed real dates formatted dd/mm. Fictional companies (no real brands),
Vietnamese names, each account 1–2 projects, 5–7 milestones per project, 15–25 tasks, 2–4 contacts, at least one
client_owner and one client_member user. New Era staff use `@newera.inc` emails.

Users that the demo login buttons use (`listDemoLogins`) — keep these ids stable:
- `u_director` Lê Hoàng Nam — Giám đốc (director, can_view_cost)
- `u_am_ha` Nguyễn Thu Hà — Account Manager (am, **can_view_cost false**) — AM of Cỏ Xanh, Thịnh An, Hải Đăng
- `u_am_ducanh` Trần Đức Anh — Account Manager (am, can_view_cost true) — AM of Thiên Trường, Gió Ngàn, Mây Trắng
- `u_member_tuan` Phạm Minh Tuấn — Trưởng nhóm kỹ thuật (member); plus 2 more members (designer, BA)
- `u_client_minh` Trần Quang Minh — CEO Cỏ Xanh Retail (client_owner, salutation anh)
- `u_client_lan` Phạm Thu Lan — Giám đốc vận hành Cỏ Xanh (client_member, salutation chị)

Accounts (ids `acc_coxanh`, `acc_thinhan`, `acc_thientruong`, `acc_giongan`, `acc_haidang`, `acc_maytrang`):
1. **Cỏ Xanh Retail** (bán lẻ, Chiến lược, Triển khai) — **BLOCKED by the client**: "Duyệt thiết kế màn hình Đặt hàng"
   (approval, assignee Minh) due `today−6`, not done, blocks the internal task "Lập trình phần Đặt hàng" which blocks
   milestone **UAT** (planned `today+22`) and directly blocks milestone **Thiết kế**; later milestone **Go-live**
   therefore forecasts `+6` days. Impact text in the spirit of SPEC §1.3. Also: Minh **delegated** "Cung cấp danh mục
   sản phẩm và giá bán" (upload) to Lan with a note; a sent quote "Phụ lục mở rộng 20 người dùng" awaiting Minh's
   acceptance (approval task, `requires_owner`, quote_id); a due-soon confirm/attend task; an answer task; one client
   submission waiting for New Era review; done approvals in history. 2 projects ("App bán hàng đa kênh",
   "Cổng nhà cung cấp").
2. **Ngân hàng Thịnh An** (ngân hàng, Chiến lược, Đàm phán→Triển khai) — quote **v2 with 15 % discount, status
   pending_approval** (v1 was sent and the client asked for changes; v2 lines differ so the diff shows). Health attention or on_track.
3. **Cơ điện Thiên Trường** (sản xuất, Trọng điểm, Triển khai) — a **payment installment invoiced and overdue ~12 days**
   (status invoiced, due `today−12`) with its client payment task → attention.
4. **Năng lượng Gió Ngàn** (năng lượng, Trọng điểm, Triển khai) — **New Era is late**: an internal, client-visible task
   overdue 4 days that holds milestone UAT (forecast +4, cause internal) → blocked by New Era (status line waiting_internal).
5. **Địa ốc Hải Đăng** (bất động sản, Tiêu chuẩn, Triển khai) — a client task due in 2 days holding a milestone → attention
   (status line due_soon_blocking); a sent quote awaiting decision optional.
6. **Mây Trắng Logistics** (logistics, Tiêu chuẩn, Vận hành) — **on track, no task waiting on the client**.

Also: ~12 price items (codes, units month/user/package/manday, list & cost price) and some negotiated account prices;
contracts with 3–4 installments linked to milestones for implementing/operating accounts (paid/invoiced/not_due mix
giving a believable monthly cashflow for the current year — planned vs actual); quotes for most accounts; files
(`storage_path: 'sample:<key>'`, designs as SVG images, documents as small PDFs, some internal, some shared) generated by
`src/data/sampleFiles.ts` → `export function sampleFileUrl(key: string): string | null` (data: URL); comments (shared and
internal) on key tasks; ~6–15 activities per account over the past weeks (approvals with actor & time); a few unread
notifications for each demo user; 2 project templates ("Triển khai phần mềm": Kickoff → Khảo sát → Thiết kế → Phát triển
→ UAT → Go-live → Hỗ trợ sau go-live; one more); default Settings (threshold 10, escalation 3, reminders [3,1], 1 email/day,
digest Monday 8h, payment_task_auto true). Exec summaries: 3 short lines.

## 10. UI building blocks

### `src/components/ui/*` (owner F) — shadcn/ui API, Radix via `import { Dialog as DialogPrimitive } from 'radix-ui'`
`button` (Button, buttonVariants; variants default|secondary|outline|ghost|link|destructive|soft; sizes default|sm|lg|icon;
`asChild`), `card` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter), `badge` (Badge; variants
default|primary|success|warning|danger|outline|note), `dialog`, `alert-dialog`, `sheet` (SheetContent `side`
right|left|bottom|top, prop `mobileFullScreen`), `tabs`, `dropdown-menu`, `popover`, `tooltip` (TooltipProvider…),
`input`, `textarea`, `label`, `select` (Radix) + `native-select` (NativeSelect), `switch`, `checkbox`, `radio-group`,
`separator`, `skeleton` (Skeleton), `avatar`, `scroll-area`, `progress`, `alert`, `table`, `toggle-group`,
`command` (Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem — own implementation, keyboard
arrows/enter), `sonner` (Toaster with tokens), `form-field` (FormField: label, hint, error, required mark), `kbd`.

### `src/components/common/*` (owner G2) — product components (props are contracts)
`HealthBadge({ health, size?: 'sm'|'md', showLabel? })` · `StatusBand({ line: StatusLine, salutation })` ·
`DueLabel({ due: DueInfo, done?, compact? })` ("Còn 2 ngày · 15/10", "Đã quá hạn 3 ngày") ·
`ForecastLabel({ milestone: MilestoneView, showReason?, compact?, manualTagShown? })` ("Kế hoạch 28/10 → Dự báo 03/11 · do chờ duyệt thiết kế 6 ngày";
`manualTagShown`: the caller shows its own "Điều chỉnh tay" tag, so a manual forecast lists the bare reason) ·
`WaitingCountsLine({ counts: WaitingCounts, showOverdue? })` ("Đang chờ khách: 3 · Đang chờ New Era: 2") ·
`Money({ value, compact? })` · `DateText({ value, relative?, time? })` · `AccountLogo({ account: AccountRef, size? })` ·
`NewEraLogo({ size?, withText? })` · `UserAvatar({ user: UserRef | null, size? })` · `SideBadge({ side })` ·
`TaskTypeIcon({ type })` · `taskActionLabel(kind)` / `taskTypeLabel(type)` (in `taskLabels.ts`) ·
`EmptyState({ icon?, title, description?, action? })` · `ErrorState({ error, onRetry? })` ·
`PageHeader({ title, description?, actions?, back? })` · `SectionCard({ title?, description?, actions?, children, className? })` ·
`KpiCard({ label, value, sub?, tone?, icon?, onClick?, active? })` · `StageStepper({ milestones: MilestoneView[], compact? })` ·
`ImpactChain({ nodes: ChainNode[] })` · `ImpactBox({ text, milestones: MilestoneRef[], overdueDays?, showTags? })` ("Nếu chưa làm";
`overdueDays` > 0 → "Đang ảnh hưởng": "Đã trễ N ngày: mốc UAT lùi 29/10 → 04/11." + the original text as a muted
"Lưu ý ban đầu: …"; `impactBoxHasContent(props)`) ·
`BlockedNote({ blockers: BlockerRef[] })` ("Đang chờ: … – …", lock icon) · `InternalOnlyBadge()` (lock + "Chỉ nội bộ") ·
`InternalNoteBox({ children })` · `ActivityFeed({ items: ActivityView[], compact? })` ·
`FilePreviewDialog({ file: FileView | null, onOpenChange })` · `FileList({ files, onPreview? })` ·
`ReasonDialog({ open, onOpenChange, title, description?, label, placeholder?, confirmLabel, onConfirm(reason) })` ·
`ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive?, onConfirm })` ·
`ChipFilter({ options: { value, label, count? }[], value, onChange })` ·
skeletons `CardSkeleton`, `ListSkeleton({ rows? })`, `TableSkeleton({ rows?, cols? })`, `KpiSkeleton`, `PageSkeleton`.

### Shared feature components (owners in §11)
- `components/task/TaskDrawerHost.tsx` → `TaskDrawerHost()` — mounted once by each layout; opens `TaskDrawer` for `?task=`.
- `components/task/ClientTaskCard.tsx` → `ClientTaskCard({ task: TaskView, showProject?: boolean, variant?: 'action' | 'delegated' | 'waiting' })`.
- `components/task/TaskRow.tsx` → `TaskRow({ task: TaskView, showAccount?, selectable?, selected?, onSelectedChange?, hideMilestone? })` (internal compact row; opens drawer; `hideMilestone` in lists already grouped by milestone).
- `components/remind/RemindButtons.tsx` → `RemindClientButton({ taskIds: string[], size?, variant?, label? })`, `ZaloRemindButton({ taskId, size? })`.
- `components/commercial/QuoteDocument.tsx` → `QuoteDocument({ quote: QuoteDetail, audience: 'client' | 'internal' })` (clean printable quote page).

## 11. Ownership

Foundation phase:
- **lead**: infra, `domain/types|clock|dates`, `services/contract|db|context|effects`, `lib/utils`, `i18n/index`, `dev/testkit`, this file.
- **A seed**: `src/data/**`.
- **B domain**: `src/domain/graph|health|taskRules|quoteMath|payments|naming.ts`, `src/dev/domainTests.ts`.
- **C services-core**: `src/services/views.ts|sanitize.ts|api.ts`, `src/services/api/session|reads|tasks|roadmap|accounts|files|settings.ts`,
  `src/dev/rbacTests.ts` (`runRbacTests(): Promise<TestResult[]>`), i18n `errors.ts`, `activity.ts`.
- **D services-commercial**: `src/services/commercialViews.ts|commercialEffects.ts`, `src/services/api/commercial.ts`, i18n `activityCommercial.ts`.
- **E services-notify**: `src/services/notifyEvents.ts|notifyEngine.ts|digest.ts`, `src/services/api/notify.ts`, i18n `activityNotify.ts`, `notifyTemplates.ts`.
- **F ui-kit**: `src/components/ui/**`.
- **G1 shell**: `src/main.tsx`, `src/App.tsx`, `src/hooks/**`, `src/lib/format.ts`, `src/lib/toast.ts`, `src/layouts/**`,
  `src/features/auth/**`, `src/features/dev/**`, `src/features/shell/**` (CommandPalette, NotificationBell, UserMenu, NotFound),
  i18n `common.ts`, `enums.ts`, `auth.ts`, `layout.ts`, `dev.ts`, and **placeholder stubs** for every feature file in §12.
- **G2 common**: `src/components/common/**`, i18n `components.ts`.

Feature phase (later) — each replaces the stubs it owns:
- **portal**: `src/features/portal/**` (+ i18n `portal.ts`)
- **task-detail**: `src/components/task/**` except `TaskRow.tsx` (+ `task.ts`)
- **dashboard**: `src/features/dashboard/**` (+ `dashboard.ts`)
- **account**: `src/features/account/**` (+ `account.ts`)
- **task-views**: `src/features/tasks/**`, `src/components/task/TaskRow.tsx` (+ `tasks.ts`)
- **roadmap**: `src/features/roadmap/**` (+ `roadmap.ts`)
- **commercial**: `src/features/commercial/**`, `src/components/commercial/**` (+ `commercial.ts`)
- **notify**: `src/features/notifications/**`, `src/components/remind/**` (+ `notify.ts`)
- **settings**: `src/features/settings/**`, `src/features/wizard/**` (+ `settings.ts`, `wizard.ts`)

## 12. Routes (App.tsx, owner G1) and page files

| Path | Component (file → export) | Owner |
|---|---|---|
| `/login` | `features/auth/LoginPage` → `LoginPage` | G1 |
| `/` | redirect: internal → `/app`, client → `/portal`, none → `/login` | G1 |
| `/app` (InternalLayout) index | `features/dashboard/DashboardPage` → `DashboardPage` (member → redirect `/app/tasks?mine=1`) | dashboard |
| `/app/accounts` | `features/dashboard/AccountsPage` → `AccountsPage` | dashboard |
| `/app/accounts/new` | `features/wizard/NewAccountPage` → `NewAccountPage` | settings |
| `/app/accounts/:accountId/:tab?` | `features/account/AccountDetailPage` → `AccountDetailPage` | account |
| `/app/tasks` | `features/tasks/CompanyTasksPage` → `CompanyTasksPage` | task-views |
| `/app/commercial/:tab?` | `features/commercial/CommercialPage` → `CommercialPage` | commercial |
| `/app/commercial/quotes/new` and `/app/commercial/quotes/:quoteId` | `features/commercial/QuoteEditorPage` → `QuoteEditorPage` | commercial |
| `/app/notifications` | `features/notifications/NotificationsPage` → `NotificationsPage` | notify |
| `/app/digest` | `features/notifications/DigestPreviewPage` → `DigestPreviewPage` | notify |
| `/app/settings/:tab?` | `features/settings/SettingsPage` → `SettingsPage` | settings |
| `/portal` (ClientLayout) index | `features/portal/PortalHomePage` → `PortalHomePage` | portal |
| `/portal/tasks` and `/portal/tasks/:taskId` | `features/portal/PortalTasksPage` → `PortalTasksPage` (the `:taskId` opens the drawer) | portal |
| `/portal/progress` | `features/portal/PortalProgressPage` → `PortalProgressPage` | portal |
| `/portal/commercial` | `features/commercial/PortalCommercialPage` → `PortalCommercialPage` (client_owner only) | commercial |
| `/portal/commercial/quotes/:quoteId` | `features/commercial/PortalQuotePage` → `PortalQuotePage` | commercial |
| `/portal/documents` | `features/portal/PortalDocumentsPage` → `PortalDocumentsPage` | portal |
| `/portal/settings` | `features/notifications/PortalSettingsPage` → `PortalSettingsPage` | notify |
| `/dev/selftest` | `features/dev/SelfTestPage` → `SelfTestPage` | G1 |
| `*` | `features/shell/NotFoundPage` → `NotFoundPage` | G1 |

Account detail tabs (`:tab` = overview|tasks|roadmap|sales|commercial|documents|contacts|activity; `sales` = CRM "Bán hàng",
director / AM only, §13; `commercial` only when `AccountDetail.commercial !== null`), rendered by AccountDetailPage:
`features/account/tabs/OverviewTab|DocumentsTab|ContactsTab|ActivityTab` (account), `features/tasks/AccountTasksTab`
→ `AccountTasksTab({ account: AccountDetail })` (task-views), `features/roadmap/RoadmapTab` → `RoadmapTab({ account })`
(roadmap), `features/commercial/AccountCommercialTab` → `AccountCommercialTab({ account })` (commercial).
Portal first-login intro: `features/portal/OnboardingIntro` → `OnboardingIntro({ onDone })` (portal), rendered by
ClientLayout when `viewer.user.onboarded_at === null && !viewer.read_only`.

Layouts (G1): InternalLayout (≥1280 left sidebar; 768–1279 icon rail with short visible labels under the icons — a
touch screen shows no tooltip; <768 top bar + Sheet menu; top bar
with Ctrl/Cmd+K search, bell, user menu with "Đặt lại dữ liệu demo"), ClientLayout (desktop top menu: client logo + New Era
logo, nav Trang chủ · Việc · Tiến độ · Thương mại · Tài liệu (Thành viên: no Thương mại), project selector when >1 project,
bell, avatar menu; mobile: compact header + bottom tab bar). `ViewAsClientBanner` sticky "Đang xem như khách hàng" + "Thoát".
Both layouts mount `<TaskDrawerHost />` and `<Toaster />` is mounted once in App.

## 13. Extension: CRM (Bán hàng) · Khách hàng mục tiêu · Dự án

Added after the first spec at the client's request: "CRM – Project management – Customer targeted". Same rules as the
rest of this file. Types: `src/domain/crmTypes.ts`; DTOs + `CrmApi`: `src/services/crmContract.ts`; `api` implements
`Api & CrmApi`. New db tables (`db.ts`): `leads`, `account_profiles`, `opportunities`, `interactions`, `segments`,
`icp_profiles` (tolerated when missing → []). **All CRM data is internal**: every CrmApi method throws `forbidden` for
client viewers (incl. view-as-client); members may only call `listProjectPortfolio` and `getWorkload`.

### Concepts
- **Lead** = target company not yet a customer ("khách hàng mục tiêu"), owned by an AM or unassigned (team pool).
  Statuses: new → contacted → interested / nurturing → converted, or disqualified (reason required).
  `convertLead` creates a prospect **Account** (stage `prospecting`, tier from input, `am_id` = owner, email_domain =
  contact email domain), an `AccountProfile`, a decision-maker `Contact` (no login) and an **Opportunity** (stage
  `qualified`), and links them back on the lead (status `converted`, `owner_id` = the new account's AM, follow-up
  date moved to the deal). A converted lead is visible to its owner / the converted account's AM (never the pool).
- **AccountProfile** (1:1 account, id `prof_<accountId>`): province, size, revenue band, source, tags — used by segments
  and fit scores for existing customers (upsell / cross-sell).
- **Opportunity** = a deal on an account. Stages & default probability: qualified 10 · discovery 25 · proposal 50 ·
  negotiation 75 · won 100 · lost 0 (moving a stage resets probability to the default; it stays editable).
  weighted_value = value × probability / 100. Moving to `negotiation` moves a `prospecting` account to `negotiating`.
  `winOpportunity` → won_at, probability 100, account stage → `implementing` when it was prospecting/negotiating, and
  optionally creates a delivery project from a template (reuse roadmap's project/template helpers). `loseOpportunity`
  needs a reason. `reopenOpportunity` → negotiation (keeps `project_id`); winning a reopened deal again keeps that
  project (`create_project` ignored, WinDialog offers no second project).
- **Interaction** = CRM touchpoint (call, meeting, email, demo, zalo, note) linked to an account / lead / opportunity /
  contact. Logging one updates `lead.last_contacted_at`, `contact.last_interaction_at/_note`, and when
  `next_follow_up_date` is set: `lead.next_follow_up_date` or `opportunity.next_step_date`. `occurred_at` may not be
  later than now (`errors.interaction_in_future`); a follow-up date needs an open lead or an open deal
  (`errors.follow_up_needs_target`) and an older (backfilled) touchpoint never replaces a later planned date. An
  interaction reaching an account through a converted lead needs the same `managesAccount` right as naming it.
  `ContactView.last_interaction_at/_note` are null for client viewers.
- **Follow-ups** = open leads with `next_follow_up_date` + open opportunities with `next_step_date`; overdue = date < today.
- **Segment** = saved criteria (`SegmentCriteria`) over leads and/or accounts; members recomputed live.
  Visible to the owner, plus everyone when `shared`. AND across criteria; a kind-specific criterion keeps the other
  kind out even with scope `all` (`lead_statuses` → leads only; `tiers` / `stages` / `health` → accounts only).
- **Upsell targets** (`listTargetAccounts`): existing customers only (account stage implementing · operating · paused).
- **ICP & fit score** (`src/domain/crm.ts`, pure): components 0–100 — industry (in ICP 100, else 20), size and revenue
  (in ICP 100, adjacent band 60, else 20), province (in ICP 100, else 40), engagement from interactions in the last 60
  days (none 0; latest ≤7 d 100, ≤30 d 70, ≤60 d 40; +5 per extra interaction, max 100). score = Σ wᵢ·cᵢ / Σ wᵢ,
  rounded; grade A ≥ 75, B 50–74, C < 50.
- **Whitespace** (TargetAccountView): active price items never quoted in an accepted quote of the account.
- **Project portfolio**: every project of accessible accounts with project-scoped health (same rules as account health,
  reasons limited to that project's tasks/milestones; payments ignored), progress, slip (max delay of not-done
  milestones), forecast end (final milestone forecast), waiting counts, team (internal assignees of open tasks).
- **Workload**: per internal person with open internal-side tasks on accessible accounts: open / overdue / blocked and
  open tasks due per week for the next N weeks (default 6; overdue counted in the first week).

### Access
director: everything. am: opportunities they own or on accounts they manage; leads they own + unassigned leads (may
assign to themselves, director may assign anyone — the same for deal owners: an AM creates / keeps deals for
themself, hand-over to another owner is the director's); own + shared segments; ICP read (update: director). CRM
activities are logged with visibility `internal` (new ActivityAction values `opportunity.*`, `lead.*`,
`interaction.logged`, `icp.updated` (target 'settings', no account), sentences in `i18n/vi/activityCrm.ts`).

### Routes & pages (internal, director + am unless stated)
| Path | Component | Owner |
|---|---|---|
| `/app/crm/:tab?` (pipeline · list · forecast · followups) | `features/crm/CrmPage` → `CrmPage` | crm-ui |
| `/app/crm/opportunities/:opportunityId` | `features/crm/OpportunityPage` → `OpportunityPage` | crm-ui |
| `/app/targets/:tab?` (leads · segments · accounts · icp) and `/app/targets/leads/:leadId` | `features/targets/TargetsPage` → `TargetsPage` | targets-ui |
| `/app/projects/:tab?` (portfolio · timeline · workload) — members too | `features/projects/ProjectsPage` → `ProjectsPage` | projects-ui |
| account detail tab `sales` | `features/crm/AccountSalesTab` → `AccountSalesTab({ account })` | crm-ui (wired by the integrator) |

Shared CRM components (owner crm-ui, `src/components/crm/*`): `FitScoreBadge({ fit, showBreakdown? })`,
`OpportunityStageBadge({ stage })`, `InteractionTimeline({ items, compact? })`,
`LogInteractionDialog({ open, onOpenChange, defaults })` (defaults: `Partial<InteractionInput>`),
`CreateOpportunityDialog({ open, onOpenChange, accountId?, defaults?, onCreated? })`.
i18n: `crm.ts` (also `crm.enums.*` for stages, lead statuses, sources, sizes, revenue bands, interaction kinds,
outcomes — reused by targets/projects UIs), `targets.ts`, `projects.ts`, `activityCrm.ts`.
### 13b. Client map ("Bản đồ khách hàng", `/app/map`, director + AM)
- Table `ecosystems` (business groups); membership = `AccountProfile.ecosystem_id` / `Lead.ecosystem_id`.
- `CrmApi.getClientMap({ metric: 'total' | 'contract_value' | 'pipeline', includeLeads, ownerId })` → nodes
  (accounts, open leads, ecosystem hubs), links (hub ↔ member), ecosystems, totals. Account value: contract =
  `accountMoney().contract_value`, pipeline = Σ weighted open opportunities, total = both; lead value = budget estimate
  (0 for the contract metric). A hub is drawn only when ≥2 of its members are visible to the viewer.
- `listEcosystems()`, `saveEcosystem()` (director/AM; an AM only edits companies in their scope, and only describes /
  renames a group that holds a company of hers — other groups are listed by name only and can only be joined).
  Clients, view-as and members → forbidden. UI: `src/features/clientmap/**` (SVG + own force simulation in `forceSim.ts`, table view,
  ecosystem panel), i18n `clientmap.ts`.