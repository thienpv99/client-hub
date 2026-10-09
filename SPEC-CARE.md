# Client care refocus — spec (08/10/2026)

## 0. Why

Feedback from New Era's leadership on the CRM/PM tools ("cái này nhìn vô không biết cái gì"):

- **Two features first:** Clients management and Project management.
- **The goal:** manage and take care of every signed account well ("quản lý và chăm sóc từng account chốt tốt").
- **Not now:** prospecting and sales for new clients ("Sale chưa cần thiết bây giờ"). The team cannot serve more clients yet.
- **What the director wants to see:**
  - what each client already has deployed;
  - the remaining room to sell more ("còn room để bán thêm những gì");
  - the relationships, highlighted ("highlight các mối quan hệ"), including inside business groups (a holding and its units).
- **Approach:** build for what the team actually needs first, then generalise.

Ideas borrowed from the "Nexa · Account Intelligence" prototype:

- **Change requests (CR) with delivery health:**
  - a CR left untriaged for more than 7 days is flagged;
  - a CR is **delivery debt** when a date was promised with no plan behind it, or the date is broken.
- **The rule:** delivery debt must reach 0 before expanding into a new department.
- **A per-department expansion map:** used / engaged / untouched.

Everything here is mock data in the browser like the rest of Client Hub. Demo data stays fictional: no real company names.

## 1. Feature flags: hide prospecting and sales (do not delete code)

`src/config/features.ts`:
```ts
export const FEATURES = { sales: false, targets: false } as const;
```

With `sales: false`:
- The "Bán hàng" nav item is hidden, and `/app/crm*` redirects to `/app`.
- The account tab `sales` is hidden; its path redirects to the account overview.
- Command-palette entries for CRM are hidden.
- Any dashboard/teaser link into CRM is hidden.
- The client map hides the "Cơ hội" (pipeline) and "Tổng giá trị" (contracts + weighted pipeline) size metrics, so it sizes by signed contracts only (no metric control), and the table drops its "Tổng giá trị" column (review fix 09/10).

With `targets: false`:
- The "Khách hàng mục tiêu" nav item is hidden, and `/app/targets*` redirects to `/app`.
- The map hides the "Khách mục tiêu" (leads) toggle; leads are never shown.

Unchanged: the CRM/targets services, the self tests (`crm` suite), and the interactions table. Logging a care touch reuses `api.logInteraction`, so the dialog `components/crm/LogInteractionDialog` stays and is reused, with opportunity/lead fields hidden when `sales` is off.

## 2. Data model — `src/domain/careTypes.ts` (new tables in `services/db.ts`, all OPTIONAL_TABLES)

```ts
export type SolutionCategory =
  | 'mobile_app'      // Ứng dụng di động
  | 'web_portal'      // Web & cổng thông tin
  | 'crm_erp'         // CRM / ERP / quản trị
  | 'data_bi'         // Dữ liệu & BI
  | 'ai_automation'   // AI & tự động hóa
  | 'integration'     // Tích hợp hệ thống
  | 'support';        // Vận hành & bảo trì
export const SOLUTION_CATEGORIES: SolutionCategory[];

export type DepartmentKey =
  | 'executive' | 'sales' | 'marketing' | 'operations' | 'supply_chain'
  | 'finance' | 'hr' | 'it' | 'customer_service' | 'production';
// Ban điều hành, Kinh doanh, Marketing, Vận hành, Chuỗi cung ứng, Tài chính – Kế toán, Nhân sự, CNTT,
// Chăm sóc khách hàng, Sản xuất

export type DeploymentStatus = 'live' | 'rolling_out' | 'pilot' | 'paused' | 'retired';
export interface Deployment extends SoftDelete {          // table: deployments — "Giải pháp đã triển khai"
  id: ID; account_id: ID; project_id: ID | null;
  name: string; category: SolutionCategory;
  summary: string;                    // 1–2 lines, client-visible
  status: DeploymentStatus;
  go_live_date: ISODate | null;
  departments: DepartmentKey[];       // who uses it
  active_users: number | null;
  contract_value: number | null;      // VND — INTERNAL
  adoption: 'high' | 'medium' | 'low' | null;   // INTERNAL
  notes: string | null;               // INTERNAL
  owner_id: ID;                       // New Era owner
  created_at: ISODateTime; updated_at: ISODateTime;
}

export type DepartmentStatus = 'engaged' | 'untouched' | 'not_fit';   // stored
export type DepartmentEffective = 'using' | DepartmentStatus;          // 'using' is DERIVED
export interface AccountDepartment {                       // table: account_departments — the expansion map
  id: ID; account_id: ID; department: DepartmentKey;
  status: DepartmentStatus;
  need_note: string | null;           // evidence of a need
  opportunity_note: string | null;    // what we could sell there
  opportunity_category: SolutionCategory | null;  // the group-matrix column of that opportunity (added during build)
  est_value: number | null;           // VND
  contact_id: ID | null;              // client-side person in that department
  ne_owner_id: ID | null;             // New Era owner of the expansion
  next_step: string | null; next_step_due: ISODate | null;
  updated_at: ISODateTime;
}

export type Influence = 'decision_maker' | 'influencer' | 'user' | 'gatekeeper';
export type Stance = 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
export type Strength = 'strong' | 'warm' | 'cold';
export interface Stakeholder {                             // table: stakeholders — one per contact ('stk_<contact_id>')
  id: ID; contact_id: ID; account_id: ID;
  department: DepartmentKey | null;
  influence: Influence; stance: Stance; strength: Strength;
  ne_owner_id: ID | null;             // who at New Era holds this relationship
  reports_to_contact_id: ID | null;   // same account
  notes: string | null;
  updated_at: ISODateTime;
}

export type RelationKind = 'introduced' | 'works_with' | 'reports_to' | 'former_colleague';
export interface RelationLink {                            // table: relation_links — mainly ACROSS units of a group
  id: ID; from_contact_id: ID; to_contact_id: ID; kind: RelationKind; note: string | null;
  created_at: ISODateTime;
}

export type CrStatus = 'new' | 'triaged' | 'planned' | 'in_progress' | 'done' | 'declined';
export type CrSource = 'client_portal' | 'meeting' | 'email' | 'chat' | 'internal';
export interface ChangeRequest extends SoftDelete {        // table: change_requests — "Yêu cầu thay đổi"
  id: ID; code: string;               // 'YC-07', numbered per account; New Era's own proposals (source 'internal') are numbered apart, 'ĐX-02', so the client's list never shows a gap (review fix 09/10)
  account_id: ID; project_id: ID | null; deployment_id: ID | null;
  title: string; description: string;
  source: CrSource;
  requested_by_contact_id: ID | null; requested_by_user_id: ID | null;
  received_at: ISODateTime;
  status: CrStatus; priority: 'high' | 'normal' | 'low';
  triaged_at: ISODateTime | null;
  owner_id: ID | null;                // New Era
  promised_date: ISODate | null;      // date told to the client
  plan_ref: string | null;            // e.g. 'Sprint 14'
  task_id: ID | null;                 // linked internal task = a plan
  client_note: string | null;         // visible to the client
  internal_note: string | null;       // INTERNAL
  decline_reason: string | null;      // visible to the client
  done_at: ISODateTime | null;
  created_at: ISODateTime; updated_at: ISODateTime;
}

export interface CarePlan {                                // table: care_plans — one per account ('care_<account_id>')
  id: ID; account_id: ID;
  cadence_days: number;               // default: strategic 14, key 21, standard 30
  next_action: string | null; next_action_due: ISODate | null; next_action_owner_id: ID | null;
  updated_at: ISODateTime;
}
```

## 3. Rules — `src/domain/care.ts` (pure functions, unit-tested)

- **Untriaged:** `TRIAGE_SLA_DAYS = 7`. `isUntriaged(cr, today)` is true when `status === 'new'` and `received_at` is more than 7 days before today.
- **Delivery debt ("nợ triển khai"):** `isDeliveryDebt(cr, today)` is true when the status is `triaged`, `planned` or `in_progress`, `promised_date != null`, and at least one of these holds:
  - no owner;
  - no plan (`plan_ref == null && task_id == null`);
  - the promised date has passed (`promised_date < today`).

  Return the reason too: `'no_owner' | 'no_plan' | 'date_passed'`.
- **Taken in without a date (review fix 09/10):** `UNDATED_SLA_DAYS = 14`. `isUndated(cr, today)` is true when `status === 'triaged'`, there is no `promised_date`, and `triaged_at` (else `received_at`) is more than 14 days before today. Flag "Tiếp nhận N ngày, chưa hẹn ngày" (warning) on every request list and board card; an attention row on the overview; a once-only daily notice (`crundated:<id>`) to the AM and the directors.
- **CR roll-up per account:** `open`, `untriaged`, `undated`, `debt`, `done_30d`, `deliveryHealth`:
  - `'debt'` when debt > 0;
  - `'attention'` when untriaged > 0 or undated > 0;
  - `'ok'` otherwise.
- **Department effective status:** `'using'` when a deployment with status `live`, `rolling_out` or `pilot` lists the department. Otherwise the stored status applies.
  - **Coverage:** covered = using + engaged. Total = departments on the map minus `not_fit`. Shown as "Phòng ban đã phủ x/y".
- **Expansion gate:** `expansionBlocked = debt > 0`.
  - Changing a department from `untouched` to `engaged` while blocked throws `ApiError('conflict', 'errors.care.expansionBlocked')`.
  - The gate also holds through solutions: saving an active deployment (live / rolling out / pilot) that puts a department in use which New Era does not work with yet (not in use by another active solution, not `engaged`) is the same expansion and is refused the same way (review fix 09/10).
  - Exception: a **director** may pass `override_reason`, which is logged to activity (`department.gate_overridden`, one line per new department).
  - UI wording: "Còn N yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới."
- **Care status:**
  - `last_touch_at` is the latest touch **by New Era**: the account's interactions `occurred_at` (an internal `note` is not a touch), contacts' `last_interaction_at` (the contact log New Era keeps), and the client's decisions on what New Era sent (task approved / changes requested / answered / confirmed / signed, quote accepted / changes requested). The client's own requests, uploads, delegations and task comments do **not** reset the care clock (review fix 09/10).
  - `daysSince > cadence_days` → `'overdue'`; `daysSince > cadence_days - 3` → `'due_soon'`; otherwise `'ok'`.
  - A `next_action_due` that has passed also counts as `'overdue'`; the UI says so ("Việc chăm sóc đã hẹn quá hạn N ngày").
  - Care is about signed clients (stage implementing / operating / paused): the overview's care KPI and attention rows leave prospects out; the lists put them last.
- **Room to sell ("whitespace"):**
  - per account: the solution categories with no **active** deployment (a paused or retired solution leaves its category open), plus `engaged`/`untouched` departments that have an `opportunity_note` or `est_value`;
  - per group: a units × categories matrix (§4 `getGroupMatrix`); a paused solution does not hold its cell. The group figures count signed units only and department opportunities (the count that matches the value), including those inside a category already in use.

## 4. API — `src/services/careContract.ts` (`CareApi`), implemented in `src/services/api/care.ts`, merged into `api`

`FullApi = Api & CrmApi & CareApi`. Every method uses the existing wrapper: async, sanitize, JSON clone, net log. Each write runs in `db.batch`, logs activity, and triggers notifications where stated.

| Method | Who |
|---|---|
| `getCarePortfolio(filter?: { amId?; health?; care?; flag?: 'debt' \| 'untriaged' \| 'care_overdue' })` → `CarePortfolioRow[]` | director, am |
| `getAccountCare(accountId)` → `AccountCareView` | director, am; member gets deployments + CRs only (departments, stakeholders and care are omitted) |
| `saveDeployment(input)` / `deleteDeployment(id)` | director, AM manager of the account |
| `saveDepartment(input & { override_reason? })` | director, am (expansion gate applies) |
| `saveStakeholder(input)` (upsert by contact) | director, am |
| `saveRelationLink(input)` / `deleteRelationLink(id)` | director, am |
| `saveCarePlan(accountId, input)` | director, am |
| `listChangeRequests(filter: { accountId?; projectId?; status?: CrStatus[]; flag?: 'untriaged' \| 'debt' })` → `ChangeRequestView[]` | internal (member: accounts they can access) |
| `createChangeRequest(input)` | internal (source ≠ client_portal) |
| `updateChangeRequest(id, patch)`: triage, plan, status, decline (decline needs `decline_reason`) | director, am, the CR owner |
| `listMyRequests()` → `ClientChangeRequestView[]` | client_owner, client_member — own account only |
| `submitRequest(input: { title; description; project_id?; priority? })` | client_owner, client_member (status 'new', source 'client_portal') |
| `listClientDeployments()` → `ClientDeploymentView[]` | clients — own account, client-safe fields only |
| `getGroupMatrix(ecosystemId)` → `GroupMatrix` | director, am |

**Views:**
- `AccountCareView`:
  - deployments with category label and status;
  - departments with effective status, covering deployments, contact and owners;
  - stakeholders joined with contact, NE owner and last touch;
  - relation links: internal ones, plus cross-unit links to accounts in the same ecosystem (with account name);
  - CR roll-up, care (plan, last touch, status, days since);
  - expansion (covered, total, blocked, debt count, whitespace categories).
- `CarePortfolioRow` (one per accessible account): account ref, AM, health, stage, deployments live / total, departments covered / total, CR open / untriaged / debt, care status, last touch, next action (+ due, owner), decision-maker relationship strength, ecosystem.
- `GroupMatrix`: ecosystem plus `units` (accounts) × `SOLUTION_CATEGORIES`.
  - Each cell: `'live' | 'in_progress' | 'opportunity' | 'none'`, with the deployment names and opportunity notes. `opportunity` means an engaged/untouched department has an opportunity note in that category, or `est_value`.
  - Each unit: coverage x/y, CR debt, care status.
  - Cross-unit relation links.

**Notifications/activity:**
- A new client CR notifies the account's AM (inbox + outbox email).
- CR status changes to `planned` (with date), `done` or `declined` notify the requesting client user; so does a change of the promised date of a planned / in-progress request (`rescheduled`, shared activity line `change_request.rescheduled`).
- The daily sweep tells the account's AM and the directors when a request becomes delivery debt (once per reason and promised date), stays `new` for more than 7 days (once), or stays `triaged` without a date for more than 14 days (once).
- The weekly digest ("Bản tin tuần") carries a "Yêu cầu & chăm sóc" block per account: director / AM get the care status, the next care action and every open request with its flag; members the open requests; clients their company's open requests (client wording, promised date; never internal proposals or flags).
- Activity entries cover CR create/triage/status, deployment add/change, department change (including gate override) and stakeholder change. Visibility is internal, except client-facing CR events, which are `shared`.
- A request New Era proposed itself (source `internal`, "New Era đề xuất") stays internal end to end: no requester, not in `listMyRequests`, internal activity lines, no client notification.
- A request that New Era has taken in never goes back to `new` (`errors.care.cannotReopenAsNew`); one link per pair and kind (saving it again updates it).
- A member logging a request may own it himself but not hand it to someone else (only director / AM assign).

## 5. RBAC (data layer, never only UI)

Clients NEVER receive:
- departments, stakeholders, relation links, care plans;
- deployment `contract_value`, `adoption`, `notes`;
- CR `internal_note`, `owner_id`, `plan_ref`, `task_id`, or the debt/untriaged flags.

Clients only see:
- their own account's CRs: code, title, description, status (client wording), received, promised date, `client_note`, `decline_reason`, done;
- deployments with status other than `retired`: name, category, summary, status, go-live, departments, active users.

The rest:
- Extend `sanitize.ts`.
- Add rbac tests for every new method × every role, including view-as-client (read-only) and cross-account access.
- Members get no expansion, relationship or care data.

## 6. UI

Follow DESIGN.md including §8 motion. Every label goes through `t()` in the new `src/i18n/vi/care.ts`, plus layout/nav keys.

1. **Nav:** sales and targets are hidden (flags). Internal sidebar:
   - Điều hành: Tổng quan
   - Khách hàng: Khách hàng · Bản đồ & tập đoàn · Dự án
   - Vận hành: Việc · Thương mại
   - Hệ thống

   Rename the map item to "Bản đồ & tập đoàn".
2. **Tổng quan (/app), refocused on care:**
   - KPI row:
     - Khách cần chú ý (health);
     - Nợ triển khai (CR debt; sub-line: số khách);
     - Yêu cầu chưa xử lý > 7 ngày;
     - Khách quá hạn chăm sóc.
   - "Cần chú ý hôm nay" also lists debt CRs, untriaged CRs, CRs taken in without a date (> 14 days), overdue care and the expansion map's next steps due within 7 days or overdue (one row per client, review fix 09/10), with actions: open the CR, log a care touch, open Mở rộng on that department.
   - The portfolio cards/table add:
     - "Đã triển khai n";
     - "Phòng ban x/y";
     - CR flags;
     - next care action with due date and owner;
     - decision-maker strength.
   - Keep cashflow and milestones.
3. **Khách hàng list:** add the same columns (compact) and filters: Nợ triển khai, Quá hạn chăm sóc.
4. **Account page tabs:** `overview, delivery, tasks, roadmap, expansion, relationships, commercial, documents, activity`.
   - `sales` is hidden by the flag. `contacts` redirects to `relationships`.
   - Labels: Tổng quan · Triển khai · Việc · Lộ trình · Mở rộng · Quan hệ · Thương mại · Tài liệu · Hoạt động.
   - **Tổng quan** adds four cards:
     - "Đã triển khai" (count and top items);
     - "Sức khỏe triển khai" (CR roll-up and the gate sentence when blocked);
     - "Mở rộng" (x/y, est. value of opportunities, blocked badge);
     - "Quan hệ chính" (decision maker and champion with strength, plus the NE owner);
     - and a "Chăm sóc" card: last touch, cadence, next action, button "Ghi lần chăm sóc" which opens LogInteractionDialog for this account.
   - **Triển khai:**
     - solution cards with status chip, category, go-live, departments, users, adoption (internal); add/edit dialog;
     - below them the CR list, with filter chips (Tất cả · Chưa xử lý > 7 ngày · Nợ triển khai · Đang làm · Đã xong · Từ chối), each row showing its flags and reason;
     - a triage sheet: status, owner, promised date, plan (text or link to a task), priority, client note, internal note, decline reason;
     - an "Thêm yêu cầu" dialog;
     - the gate banner when debt > 0.
   - **Mở rộng:**
     - a summary bar: coverage x/y, total est. value, gate state;
     - one row per department: effective status chip, solutions used there, client person, NE owner, need, opportunity + value, next step + due; edit sheet;
     - "Danh mục chưa có", the solution categories not yet deployed for this account;
     - "Thêm phòng ban" for departments not on the map yet.
   - **Quan hệ:** a **relationship map** (SVG, readable, not a hairball):
     - New Era people on one side (AM, director, members on the account);
     - client stakeholders grouped by department on the other;
     - edges show who holds which relationship, coloured by strength, with influence and stance badges;
     - reports-to lines inside the client;
     - cross-unit links to sister companies in the same group, as chips linking to that account.

     Below it, the contact list with stakeholder fields and the existing contact actions (add, edit, invite to portal) moved from the old Liên hệ tab. On phones the list comes first and the map scrolls horizontally.
5. **Dự án:** a new tab "Yêu cầu" (`/app/projects/requests`):
   - a board by status (Mới · Đã tiếp nhận · Đã lên kế hoạch · Đang làm · Xong · Từ chối) with account filter and flags; move cards through a menu (the kanban MoveMenu pattern);
   - a timeline by promised date grouped by account, with a "Hôm nay" line and "chưa hẹn ngày" rows.
6. **Bản đồ & tập đoàn (/app/map):** a third view "Ma trận" beside Bản đồ · Bảng:
   - pick a group;
   - rows are units (accounts), columns are solution categories; cells show Đang dùng / Đang triển khai / Cơ hội / Trống, with the deployment names on hover/tap;
   - columns for coverage x/y, Nợ triển khai and Chăm sóc;
   - below, "Quan hệ trong tập đoàn": the cross-unit relation links as readable sentences;
   - clicking a cell opens that account's Triển khai or Mở rộng tab.

   The ecosystem sheet links to the matrix.
7. **Client portal:**
   - "Tiến độ" gains the section **"Giải pháp New Era triển khai"** (first named "Giải pháp đang dùng"; renamed because solutions still being rolled out are listed too, with the project's forecast go-live) and the section **"Yêu cầu của anh/chị"** (status list in client wording, with promised date and New Era's note), plus the button "Gửi yêu cầu mới" (dialog: tiêu đề, mô tả, dự án, mức độ cần).
   - Portal home shows a small card "Yêu cầu đang xử lý: n" linking to that section.
   - Notification kinds for CR updates render nicely.
8. **Command palette:** add "Yêu cầu thay đổi" and "Ma trận tập đoàn"; drop CRM/targets entries when flagged off.

## 7. Seed — SEED_VERSION 6 (7, then 8 after the review fixes), fictional, consistent with existing accounts/projects/contacts

Accounts: `acc_coxanh` + `acc_maytrang` (eco_coxanh), `acc_thinhan` + `acc_haidang` (eco_thinhan), `acc_giongan` + `acc_thientruong` (eco_giongan), `acc_saobac` + `acc_hoangvu` (eco_saobac), `acc_vanxuan`.

- **Deployments:** 1–4 per account, matching their real projects and stages. Accounts still in approach/negotiation get 0–1.
- **Departments:** 6–9 per account, fitting the industry (a bank has no production), with a mix of statuses and concrete opportunity notes and values.
- **Stakeholders:** for every existing contact. Add 2–4 new contacts per active account (e.g. CFO, IT head, ops head) so the maps are rich. At least one champion and one skeptic somewhere.
- **Relation links:** 1–3 cross-unit links inside each group (e.g. the chairman of Cỏ Xanh introduced the COO of Mây Trắng).
- **CRs:** 3–12 per active account.
  - Cỏ Xanh has delivery debt, so its expansion is blocked.
  - Thịnh An has untriaged requests older than 7 days.
  - Mây Trắng is healthy with clear room to expand.
  - A few CRs come from the client portal.
- **Care plans:** cadence by tier. Two or three accounts are overdue for care.
- **Data checks:** seed checks for referential integrity of every new table.

## 8. Tests (self-test page)

- **New suite `care`:** `src/dev/careTests.ts`. Covers the rules in §3 (untriaged boundary at exactly 7 days, each debt reason, roll-ups, effective department status, coverage, gate, care status), the API flows (submit → triage → plan → done with notifications, gate refusal + director override), and the seed checks.
- **Existing suites:**
  - extend `rbac` (every new method × role, sanitised fields, cross-account, view-as-client read-only);
  - extend `api` smoke;
  - all existing suites stay green.
- **Typecheck** must report 0 errors.
- **Literal class names only:** the standalone build precompiles CSS.
