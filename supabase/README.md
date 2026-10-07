# Client Hub — backend Supabase (đích chuyển sang)

Hiện app chạy hoàn toàn trên dữ liệu giả lập trong trình duyệt (`src/services/db.ts` + `src/services/api/*.ts`).
Thư mục này là **backend thật** mà lớp service sẽ được chuyển sang: Postgres (Supabase) + RLS + Storage, giữ nguyên
hợp đồng `Api` trong `src/services/contract.ts`. Giao diện không phải sửa: chỉ thay phần cài đặt bên trong `api`.

| Tệp | Nội dung |
|---|---|
| `schema.sql` | Kiểu dữ liệu, bảng, chỉ mục, trigger, hàm hỗ trợ RLS, chính sách RLS, view an toàn, bộ máy tính "chặn / dự báo / sức khỏe" bằng SQL, các hàm RPC, việc chạy hằng ngày, phân quyền. |
| `storage.sql` | Mỗi account một bucket riêng tư + chính sách trên `storage.objects`. Chạy ngay sau `schema.sql`. |
| `tests/fixture.sql` | Bộ dữ liệu nhỏ (kịch bản Cỏ Xanh bị chặn, báo giá 15 %, đợt thanh toán quá hạn…) để chạy danh sách kiểm thử ở mục 8. |

Thứ tự chạy trên một project Supabase mới: `schema.sql` → `storage.sql` → (tùy chọn) dữ liệu demo.
Toàn bộ đã được chạy thử trên Postgres thật (PGlite, bản WASM) với `tests/fixture.sql`: 414 câu lệnh tạo schema, các
chính sách, view, hàm tính dự báo / sức khỏe và mọi RPC đều chạy đúng (chi tiết ở mục 8). Chỉ dùng tính năng có từ
PostgreSQL 15.

---------------------------------------------------------------------------------------------------

## 1. Bảng ↔ `src/domain/types.ts` ↔ mock

| Mock (`DbData`) | Bảng Postgres | Ghi chú |
|---|---|---|
| `users` | `public.profiles` | `id` = `auth.users.id`. Mật khẩu nằm trong Supabase Auth (trường `password` của mock không lưu). Khách: email bắt buộc đúng `accounts.email_domain` (trigger). |
| `accounts` | `public.accounts` | Thêm `health_auto`, `health_auto_at` (bộ đệm sức khỏe, SPEC §8). `internal_notes`, `health_override_reason`, `health_override_by`: **chỉ nội bộ**. |
| `contacts` | `public.contacts` | `last_interaction_note`: chỉ nội bộ. |
| `projects` | `public.projects` | |
| `milestones` | `public.milestones` | `forecast_override_date` = cột `forecast_date` trong SPEC (AM sửa tay). Ngày dự báo tự tính bằng `public.milestone_forecasts()`. `forecast_override_reason`: chỉ nội bộ. |
| `tasks` | `public.tasks` | `manual_unblock_reason / _by / _at`: chỉ nội bộ. Ràng buộc: `side = 'client'` ⇔ `type <> 'work'`; việc phía khách luôn `client_visible` và bắt buộc có câu "Nếu chưa làm"; trạng thái `done` ⇔ `waiting_on is null` và có `completed_at`. |
| `task_dependencies` | `public.task_dependencies` | Đúng một đích (`blocks_task_id` **hoặc** `blocks_milestone_id`), không tự phụ thuộc, cùng account, không vòng tròn (trigger + khóa theo account). |
| `comments` | `public.comments` | `visibility = 'internal'` = Ghi chú nội bộ, không bao giờ trả cho khách. |
| `files` | `public.files` | `storage_path` = `'<bucket>/<đường dẫn object>'`; `doc_key` và `version` tự điền nếu bỏ trống. |
| `price_items` | `public.price_items` | `cost_price`: **không ai thuộc role `authenticated` SELECT được cột này** (mục 3.3). |
| `account_prices` | `public.account_prices` | Chỉ nội bộ. |
| `quotes` | `public.quotes` | `internal_note`, `approval_note`: chỉ nội bộ. Trạng thái chỉ đổi qua RPC. |
| `quote_lines` | `public.quote_lines` | `vat_rate` ∈ {0, 5, 8, 10}. Tiền tính bằng view (giống `src/domain/quoteMath.ts`). |
| `contracts` | `public.contracts` | |
| `payment_schedules` | `public.payment_schedules` | `overdue` được lưu bởi việc chạy hằng ngày nhưng luôn suy ra được (`invoiced/overdue` và hôm nay > hạn). |
| `activities` | `public.activities` | Nhật ký chỉ ghi thêm. Thêm `task_id` (tự điền, để RLS và "Lịch sử phê duyệt") và `dispatched_at` (bộ phát thông báo, mục 6). |
| `notifications` | `public.notifications` | Người dùng chỉ được đánh dấu đã đọc. |
| `emails` | `public.email_outbox` | |
| `templates` | `public.project_templates` | `milestones` là mảng JSON `TemplateMilestone[]`. |
| `settings` + `meta.last_sweep_date` | `public.settings` | Một dòng duy nhất (`id = true`). |
| (bộ nhớ hoàn tác 10 giây của `api/tasks.ts`) | `private.action_undo` | Ảnh chụp các dòng trước thao tác của khách. |

Các bảng có `updated_at` được trigger cập nhật **chỉ khi dữ liệu thật sự đổi**.

## 2. Quy ước

- **Id**: `uuid`. API vẫn coi id là chuỗi (`ID = string`). Khi nhập dữ liệu demo, `public.mock_uuid('acc_coxanh')`
  đổi id của mock thành uuid cố định nên mọi tham chiếu giữ nguyên.
- **Tiền**: `bigint` (VND chẵn đồng). Phần trăm: `numeric(5,2)`. Số lượng: `numeric(12,2)`.
- **Ngày**: `date` = một ngày theo giờ Việt Nam (`ISODate`); thời điểm: `timestamptz` (`ISODateTime`). Bộ chuyển đổi
  của adapter trả `timestamptz` về dạng `…+07:00` như `nowISO()`.
- **Múi giờ** (SPEC §8): không dùng `current_date` (đi theo múi giờ phiên, trên Supabase là UTC). Luôn dùng
  `public.today_vn()` = `(now() at time zone 'Asia/Ho_Chi_Minh')::date`.
  Quá hạn ⇔ `public.today_vn() > due_date`, tức là sau 23:59 của ngày hạn.
- **Xóa mềm**: `deleted_at` trên các bảng chính. Khách không bao giờ thấy dòng đã xóa; nội bộ vẫn thấy (để tra cứu và
  khôi phục) nên các truy vấn danh sách nội bộ lọc `deleted_at is null`, giống `db.rows()` của mock.
- **Kiểu liệt kê**: mỗi union type trong `types.ts` là một enum Postgres (VatRate là check constraint).

## 3. Mô hình bảo mật (SPEC §2)

### 3.1 Hàm cho biết "ai đang hỏi"
Tất cả là `SECURITY DEFINER`. Chúng chỉ mô tả chính người gọi nên gọi qua RPC cũng vô hại.

| Hàm | Ý nghĩa |
|---|---|
| `auth_viewer()` | Người gọi (`user_id, role, org_type, account_id, can_view_cost, read_only`), giống `Viewer` trong contract. `null` khi chưa đăng nhập, tài khoản bị khóa hoặc đã xóa. |
| `auth_role()`, `auth_account_id()` | Vai trò và account của người gọi. |
| `is_internal()`, `is_client()`, `is_director()` | |
| `can_view_cost()` | Giám đốc, hoặc AM được Giám đốc cấp quyền. Không bao giờ đúng với khách hay thành viên. |
| `is_read_only()` | Đang ở chế độ "Xem như khách hàng". |
| `can_access_commercial()` | Sai với `client_member`. |
| `is_manager_of(account_id)` | Giám đốc, hoặc AM phụ trách account (không bao giờ đúng ở chế độ chỉ xem). |
| `readable_account_ids()`, `readable_project_ids()` | Các account / dự án người gọi được đọc (giống `accessibleAccountIds()`). |
| `can_read_account()`, `can_read_task()`, `can_read_quote()` | Kiểm tra từng dòng (giống `canViewTask()`, `canViewQuote()`). |

### 3.2 Chính sách theo vai trò
| Vai trò | Được đọc | Được ghi trực tiếp |
|---|---|---|
| `director` | Mọi thứ, kể cả giá vốn và biên lợi nhuận (qua các view nội bộ). | Mọi thứ, theo các trigger kiểm tra. |
| `am` | Chỉ account mình phụ trách. Giá vốn chỉ khi `can_view_cost`. | Account mình phụ trách. Không đổi được AM, không xóa account, không cấp duyệt báo giá. |
| `member` | Chỉ account có việc được giao cho mình. Không thấy giá vốn. | Chỉ chuyển cột Kanban cho việc nội bộ của mình. Ghi chú nội bộ; trả lời khách trên việc mình phụ trách. |
| `client_owner` | Dữ liệu đã chia sẻ của công ty mình. Việc nội bộ chỉ khi `client_visible`; mốc chỉ khi `client_visible`; bình luận, tệp, nhật ký chỉ `shared`; báo giá chỉ khi đã gửi / chấp thuận / đề nghị điều chỉnh / hết hạn. | Không ghi trực tiếp bảng nghiệp vụ nào. Mọi thao tác đi qua RPC. Được: tải tệp vào thư mục `incoming/<uid>/` của công ty, sửa hồ sơ của chính mình (tùy chọn thông báo, `onboarded_at`), đánh dấu thông báo đã đọc. |
| `client_member` | Như `client_owner` nhưng **không có bảng thương mại nào**: báo giá, dòng báo giá, bảng giá, hợp đồng, đợt thanh toán, tệp hợp đồng / chứng từ, nhật ký `quote.* / contract.* / payment.*`. | Như trên. |
| `anon` | Không gì cả. | Không gì cả. |

### 3.3 Cột chỉ nội bộ và chặn giá vốn ở tầng dữ liệu
Supabase dùng chung một role `authenticated` cho mọi người đã đăng nhập, nên các cột nhạy cảm được bảo vệ bằng
**quyền theo cột**: `authenticated` không có quyền SELECT trên `price_items.cost_price`, `accounts.internal_notes`,
`accounts.health_override_reason / _by`, `contacts.last_interaction_note`, `milestones.forecast_override_reason`,
`tasks.manual_unblock_reason / _by / _at`, `quotes.internal_note / approval_note`. Vì vậy ngay cả một truy vấn PostgREST
tự viết cũng nhận lỗi `permission denied`.

- Đọc các cột đó: dùng **view nội bộ**, mỗi view tự áp lại đúng điều kiện truy cập và thêm `is_internal()`:
  `accounts_internal`, `contacts_internal`, `milestones_internal`, `tasks_internal`, `quotes_internal`.
  Khách (kể cả chế độ "Xem như khách hàng") nhận 0 dòng.
- Giá vốn và biên lợi nhuận chỉ có trong các view riêng (`private.quote_line_math`, `private.quote_totals`), không role
  API nào đọc được. Các view công khai chia theo người xem:
  - `price_items_public`: bảng giá không có giá vốn (RLS của `price_items` vẫn áp dụng).
  - `price_items_internal`: thêm `cost_price`, `margin_pct`; chỉ khi `can_view_cost()`.
  - `quote_lines_client`: dòng báo giá đã tính tiền, không có giá vốn; chỉ khi `can_read_quote()`.
  - `quote_lines_internal`: thêm `cost_total` (trả `null` nếu không có quyền xem giá vốn); chỉ nội bộ.
  - `v_quote_totals`: tổng tiền, chiết khấu thực tế, `needs_approval`.
  - `v_quote_totals_internal`: thêm `cost_total`, `margin`, `margin_pct`; chỉ khi `can_view_cost()`.
- **Hệ quả cho adapter**: `select=*` trên các bảng có cột bảo vệ sẽ bị từ chối (đây là chủ ý). Adapter luôn ghi rõ
  danh sách cột, hoặc đọc qua view. Khi `insert/update` thì dùng `Prefer: return=minimal` hoặc `select` cột tường minh.
- `sanitize.ts` vẫn giữ trong adapter như một lớp phòng thủ thứ hai.

### 3.4 Thao tác của khách: chỉ qua RPC `SECURITY DEFINER`
Khách không có quyền INSERT / UPDATE / DELETE trên bảng nghiệp vụ. Mỗi RPC kiểm tra lại đúng luật của mock theo cùng
thứ tự từ chối, ghi bảng `activities` trong **cùng giao dịch**, và trả về dạng `ActionResult`
(`{ task_id, undo_token, message_key }`). API đọc lại `TaskView` sau đó.

| RPC | Mock | Ghi chú |
|---|---|---|
| `approve_task(p_task_id, p_note)` | `approveTask` | Việc duyệt báo giá: chấp thuận luôn báo giá (`quote.accepted`). |
| `request_task_changes(p_task_id, p_reason)` | `requestTaskChanges` | Bắt buộc lý do. Việc báo giá → `quote.changes_requested`. |
| `submit_task_files(p_task_id, p_files jsonb, p_note)` | `submitTaskFiles` | `p_files = [{ storage_path, name, mime, size }]` đã tải lên Storage (mục 7). |
| `report_payment(p_task_id, p_proof jsonb, p_note)` | `reportPayment` | Ghi `client_reported_at`, `proof_file_id` của đợt thanh toán. |
| `confirm_task(p_task_id, p_note)` | `confirmTask` | Xác nhận / xác nhận tham dự. |
| `answer_task(p_task_id, p_answer)` | `answerTask` | Bắt buộc câu trả lời. |
| `delegate_task(p_task_id, p_to_user_id, p_note)` | `delegateTask` | Chỉ `client_owner`; không giao được việc `requires_owner`; người nhận cùng công ty, đang hoạt động và **email đúng tên miền công ty**. Mời người mới bằng email: Edge Function `invite-user` tạo tài khoản rồi gọi RPC này. |
| `undo_task_action(p_token)` | `undoAction` | Khôi phục mọi dòng thao tác đã sửa, xóa các dòng thao tác đã thêm (tệp, nhật ký). Token sống 10 giây; từ chối nếu New Era đã thao tác tiếp trên việc. |
| `ask_new_era(p_task_id, p_question)` | `askNewEra` | |
| `add_comment(p_task_id, p_body, p_visibility, p_reply_to_id)` | `addComment` | Dùng cho cả hai phía. |
| `client_accept_quote(p_quote_id, p_note)`, `client_request_quote_changes(p_quote_id, p_note)` | `clientAcceptQuote`, `clientRequestQuoteChanges` | Đồng bộ luôn việc duyệt báo giá. |

Mã lỗi: RPC và trigger báo `message` = `ApiErrorCode` (`forbidden`, `blocked`…), `detail` = khóa i18n (`errors.blocked`),
`hint` = JSON `ApiError.details` (ví dụ `{"blockers": [...]}`, `{"domain": "coxanh.vn"}`). SQLSTATE dạng `PTxxx` nên
PostgREST trả đúng HTTP xxx. Adapter dựng lại: `new ApiError(error.message, error.details, JSON.parse(error.hint || '{}'))`.

### 3.5 Nội bộ: ghi trực tiếp, có trigger canh giữ; thao tác quan trọng qua RPC
- Trigger chặn ở tầng dữ liệu: việc bị chặn không rời cột "Cần làm" (`blocked`); nhân viên chỉ chuyển việc của khách
  sang "Cần làm" hoặc "Xong"; thành viên chỉ đổi trạng thái việc nội bộ của mình; không đổi AM nếu không phải Giám đốc;
  bộ đệm sức khỏe chỉ do việc chạy hằng ngày ghi; báo giá luôn bắt đầu ở `draft`, trạng thái chỉ đổi qua RPC, chỉ sửa
  điều khoản khi còn nháp; sửa giá sau khi Giám đốc đã duyệt thì hủy duyệt nếu vẫn vượt ngưỡng; **không báo giá nào chuyển
  sang `sent` khi vượt ngưỡng mà chưa có Giám đốc duyệt, dù đi bằng đường nào**; nhật ký chỉ ghi thêm.
- RPC nội bộ (luật và nhật ký trong một giao dịch): `set_task_status`, `manual_unblock` (bắt buộc lý do),
  `accept_submission` (việc thanh toán → đợt `paid`), `return_to_client` (vòng sửa +1), `delete_task`, `remind_client`,
  `check_dependencies` (kiểm tra vòng tròn trước khi lưu, trả về tên các việc), `complete_milestone`,
  `override_milestone_forecast`, `override_account_health`, `request_quote_approval`, `approve_quote`,
  `reject_quote_approval`, `send_quote` (tạo việc "Xem và chấp thuận báo giá" cho khách, đóng việc của phiên bản cũ).
- Luật tự động: mốc hoàn thành → các đợt thanh toán gắn mốc chuyển "Đến hạn xuất hóa đơn" (trigger). Đợt chuyển sang
  `invoiced/overdue` → tự tạo việc "Thanh toán" cho khách nếu bật `payment_task_auto` và `auto_task_enabled` (trigger).

### 3.6 "Xem như khách hàng"
Edge Function `view-as` (service role) kiểm tra người gọi là nhân viên có quyền đọc account, rồi ghi
`app_metadata.view_as_account_id` vào tài khoản của họ. App gọi `refreshSession()`. Từ đó `auth_viewer()` trả về một
`client_owner` **chỉ xem** của account đó, nên mọi truy vấn đi qua đúng bộ lọc của khách và mọi thao tác ghi đều bị từ
chối (`read_only`). Khi thoát, Edge Function xóa claim đó rồi app làm mới phiên. Người dùng không tự sửa được
`app_metadata`.

## 4. Bộ máy "chặn / dự báo / sức khỏe" bằng SQL (ARCHITECTURE §7)
Đây là bản tham chiếu tương đương `src/domain/graph.ts` và `health.ts`, viết bằng recursive CTE trên
`task_dependencies`. Bản này tính trên **toàn bộ** việc của account rồi mới lọc theo người xem: việc nội bộ bị ẩn vẫn
làm lùi mốc, chỉ là khách không thấy tên việc đó.

- `milestone_forecasts(account_id, today?)`: mỗi mốc có `planned_date`, `forecast_date`, `delay_days`,
  `source` (`on_plan | dependency | cascade | manual | done`), `cause_task_id`, `cause_delay_days`,
  `cascade_from_milestone_id`, `override_reason` (null với khách). Khách chỉ nhận mốc `client_visible`.
- `account_health(account_id, today?)`: `health_auto`, `health_value` (ghi đè thắng), `overridden`, `override_reason`
  và `reasons` (mảng `HealthReason` đã sắp xếp; với khách chỉ giữ lý do về việc và mốc họ được thấy, đợt thanh toán chỉ
  cho `client_owner`).
- `task_flags(account_id, today?)`: `blocked`, `overdue`, `overdue_days`, `due_soon`, `days_left`,
  `is_blocking_milestone`, `priority_rank` (1–4, SPEC §3).
- View tiện dùng: `v_milestone_forecasts`, `v_account_health`, áp cho mọi account người gọi đọc được.

Trên dữ liệu kiểm thử: "Duyệt thiết kế" quá hạn 6 ngày → Thiết kế +6 (`dependency`), UAT +6 qua chuỗi gián tiếp
(`dependency`), Go-live +6 (`cascade` từ Thiết kế), account `blocked`. Sau khi AM mở chặn thủ công việc lập trình,
UAT chuyển sang `cascade`. AM sửa tay ngày dự báo thì nguồn là `manual` kèm lý do (khách không thấy lý do).

## 5. Lớp service mock → Supabase

Nguyên tắc: `src/services/api.ts` vẫn export `api: Api`. Mỗi module `src/services/api/*.ts` có một bản cài đặt
Supabase cùng kiểu `Pick<Api, …>`. Các hàm dựng DTO (`views.ts`, `commercialViews.ts`) và bộ máy miền (`src/domain/*`)
vẫn dùng được: adapter đọc dòng thô (đã lọc bởi RLS), gọi các hàm SQL ở mục 4 để có dự báo, sức khỏe và cờ của việc,
rồi dựng `TaskView`, `ProjectView`… như hiện nay.

| Module mock | Phương thức | Supabase |
|---|---|---|
| `api/session.ts` | `requestOtp`, `verifyOtp` | `auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`, `auth.verifyOtp({ email, token, type: 'email' })` |
| | `loginWithPassword` | `auth.signInWithPassword` (nội bộ) hoặc `auth.signInWithOAuth({ provider: 'google' })` |
| | `logout`, `getViewer`, `onViewerChange` | `auth.signOut()`, `rpc('auth_viewer')` + `profiles`, `auth.onAuthStateChange` |
| | `startViewAsClient`, `stopViewAsClient` | Edge Function `view-as` + `auth.refreshSession()` (mục 3.6) |
| | `completeOnboarding`, `updateMyPreferences` | `update profiles set onboarded_at / notification_pref where id = auth.uid()` |
| | `loginDemo`, `listDemoLogins` | Chỉ ở môi trường demo (tài khoản mẫu + mật khẩu demo). |
| `api/reads.ts` | `listAccounts`, `getAccount` | `accounts` (cột tường minh) hoặc `accounts_internal`, `v_account_health`, `v_milestone_forecasts`, `contacts`, `projects` |
| | `listProjects` | `projects` + `milestones` + `milestone_forecasts()` |
| | `listTasks`, `getTask` | `tasks` / `tasks_internal` + `task_flags()` + `task_dependencies` + `comments` + `files` + `activities` |
| | `listActivities`, `listFiles`, `listContacts`, `listUsers`, `search` | các bảng tương ứng (RLS lọc); tìm kiếm qua chỉ mục trigram trên `search_norm(...)` |
| | `getDirectorDashboard`, `getPortalHome` | Ghép từ các truy vấn trên (có thể đóng gói thành RPC đọc sau). |
| `api/tasks.ts` | thao tác của khách, `undoAction`, `delegateTask`, `askNewEra` | RPC ở mục 3.4 |
| | `createTask`, `updateTask` | `insert/update tasks` + thay `task_dependencies` (xóa rồi thêm); `check_dependencies()` trước khi lưu |
| | `deleteTask`, `setTaskStatus`, `manualUnblock`, `acceptSubmission`, `returnToClient`, `checkDependencies`, `addComment` | `delete_task`, `set_task_status`, `manual_unblock`, `accept_submission`, `return_to_client`, `check_dependencies`, `add_comment` |
| | `setTaskClientVisible` | `update tasks set client_visible` (+ ghi `activities`) |
| `api/roadmap.ts` | `listTemplates`, `createProject`, `applyTemplate`, `createMilestone`, `updateMilestone` | `project_templates`, `projects`, `milestones` |
| | `overrideForecast`, `completeMilestone` | `override_milestone_forecast`, `complete_milestone` |
| `api/accounts.ts` | `createAccount`, `updateAccount`, `assignAm`, `upsertContact` | `accounts`, `contacts` (trigger kiểm tra quyền); bucket tạo tự động |
| | `overrideHealth` | `override_account_health` |
| | `inviteClientUser`, `inviteInternalUser`, `setUserRole`, `setUserCanViewCost`, `listAllUsers` | Edge Function `invite-user` (`auth.admin.inviteUserByEmail` + `profiles`, kiểm tra tên miền); `update profiles` (Giám đốc) |
| `api/files.ts` | `uploadFile`, `setFileVisibility` | Storage `upload` vào bucket của account + `insert files`; `update files set visibility` |
| `api/settings.ts` | `getSettings`, `updateSettings` | `settings` (đọc: nội bộ; ghi: Giám đốc) |
| | `resetDemoData` | Chỉ môi trường demo: chạy lại script nhập dữ liệu mẫu. |
| `api/commercial.ts` | `listPriceItems`, `upsertPriceItem` | `price_items_public` / `price_items_internal`; ghi: Giám đốc |
| | `listAccountPrices`, `setAccountPrice` | `account_prices` (`null` = xóa dòng) |
| | `listQuotes`, `getQuote` | `quotes` / `quotes_internal` + `quote_lines_client` / `quote_lines_internal` + `v_quote_totals(_internal)`; so sánh phiên bản bằng `diffQuoteLines()` |
| | `createQuote`, `saveQuoteDraft`, `createQuoteVersion` | `insert/update quotes`, `quote_lines` (trigger giữ luật bản nháp và hủy duyệt khi đổi giá) |
| | `requestQuoteApproval`, `approveQuote`, `rejectQuoteApproval`, `sendQuote`, `clientAcceptQuote`, `clientRequestQuoteChanges` | RPC cùng tên dạng snake_case |
| | `listContracts`, `listPayments`, `updatePayment`, `setPaymentAutoTask`, `getReceivables` | `contracts`, `payment_schedules` (+ ghi `activities`) |
| `api/notify.ts` | `listNotifications`, `markNotificationsRead`, `listOutbox` | `notifications`, `email_outbox` |
| | `remindClient` | `remind_client` (bộ phát gửi email ngay) |
| | `runNotificationSweep`, `getWeeklyDigest` | Edge Function `daily-sweep`, `weekly-digest` (mục 6) |
| `onDataChange` | | Supabase Realtime `postgres_changes` (RLS được áp dụng) hoặc tải lại sau mỗi thao tác. |

## 6. Các bước chuyển sang Supabase

1. **Tạo project** (vùng Singapore cho gần Việt Nam). Chạy `schema.sql`, sau đó `storage.sql`.
2. **Auth**
   - Khách hàng: **email OTP hoặc magic link, không mật khẩu**. Tắt tự đăng ký. Đăng nhập bằng
     `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: '<app>/portal' } })`; mẫu email
     tiếng Việt chứa cả mã `{{ .Token }}` và liên kết `{{ .ConfirmationURL }}`. Tài khoản khách chỉ được tạo qua lời mời.
   - Nội bộ: email + mật khẩu, hoặc Google (`signInWithOAuth`, giới hạn tên miền `newera.inc`). Bật hook
     "Before User Created" để từ chối mọi email chưa được mời / chưa có trong `profiles`.
   - "Ghi nhớ thiết bị" (SPEC §8): `createClient(url, key, { auth: { persistSession: true, storage: remember ? localStorage : sessionStorage } })`.
     Đặt thời hạn phiên (ví dụ 30 ngày không hoạt động) trong Auth → Sessions.
3. **Edge Functions** (dùng service role, không lộ ra trình duyệt):
   - `invite-user`: kiểm tra người gọi (`is_manager_of`, hoặc `client_owner` cùng công ty), kiểm tra tên miền, gọi
     `auth.admin.inviteUserByEmail`, tạo `profiles` (+ `contacts`) rồi ghi `user.invited`.
   - `view-as`: bật / tắt `app_metadata.view_as_account_id` (mục 3.6).
   - `notify-dispatch` (pg_cron mỗi phút, hoặc mỗi 10 giây): đọc `activities` có `dispatched_at is null` và đã quá
     10 giây (để "Hoàn tác" xóa kịp), áp đúng luật "ai nhận gì" của `notifyEvents.ts`, dựng nội dung từ
     `src/i18n/vi/notifyTemplates.ts`, ghi `notifications` + `email_outbox` theo luật của `effects.ts` (tối đa 1 email
     mỗi ngày, trừ leo thang; tôn trọng "chỉ nhận bản tin tuần và việc gấp"; `task.reminded` gửi ngay), gửi email qua nhà
     cung cấp, rồi đặt `dispatched_at`. Liên kết email mở thẳng `/portal/tasks/<id>`.
   - `daily-sweep` (00:05 giờ VN = `5 17 * * *` UTC): gọi `run_daily_maintenance()` (đợt thanh toán quá hạn, báo giá hết
     hạn, bộ đệm sức khỏe), sau đó nhắc trước hạn 3 ngày / 1 ngày, nhắc quá hạn tối đa 1 lần/ngày, leo thang
     (`escalation_overdue_days`) như `notifyEngine.ts`.
   - `weekly-digest` (thứ Hai 08:00 giờ VN = `0 1 * * 1` UTC): dựng bản tin như `digest.ts`.
4. **Adapter**: viết `src/services/api/*.supabase.ts` theo bảng ở mục 5 rồi đổi `src/services/api.ts` sang dùng chúng.
   Hợp đồng `Api` và các DTO giữ nguyên. Đổi `timestamptz` sang ISO `+07:00`, `date` giữ chuỗi `YYYY-MM-DD`, đổi lỗi
   PostgREST sang `ApiError` (mục 3.4).
5. **Nhập dữ liệu demo**: chạy `buildSeed(today)` (Node / Deno), đổi mọi id bằng `mock_uuid()`, tạo người dùng qua Auth
   Admin API với đúng uuid đó, rồi insert theo thứ tự: `profiles` nội bộ → `accounts` → `profiles` khách → `contacts` →
   `projects` → `milestones` → `price_items` → `account_prices` → `quotes` → `quote_lines` → `tasks` →
   `task_dependencies` → `comments` → `files` → `contracts` → `payment_schedules` → `activities` → `notifications` →
   `project_templates`. Dùng service role nên trigger coi là nguồn tin cậy. Tệp mẫu `sample:<key>` được tải lên bucket
   của account, sau đó cập nhật `storage_path`.
6. **pg_cron**: bật extension, rồi
   `select cron.schedule('client-hub-daily', '5 17 * * *', $$ select public.run_daily_maintenance() $$);`
   (hoặc để Edge Function `daily-sweep` gọi).

## 7. Storage

- Mỗi account một **bucket riêng tư**: `acc-<uuid account>` (`public.account_bucket_id(id)`), tạo tự động khi thêm
  account. `storage.sql` cũng tạo bucket cho các account đã có.
- Đường dẫn: `shared/<uuid tệp>-<tên>` cho tệp New Era tải lên; `incoming/<auth uid>/<tên>` cho tệp khách tải lên.
  `files.storage_path = '<bucket>/<đường dẫn>'`.
- **Đọc** một object ⇔ người gọi đọc được dòng `files` trỏ tới nó (RLS của `files` áp dụng ngay trong chính sách). Vì
  vậy tệp nội bộ không tải được kể cả khi biết đường dẫn. Khách được đọc lại tệp mình vừa tải lên khi chưa đăng ký.
  Link xem trước dùng `createSignedUrl` (chạy theo quyền của người gọi).
- **Tải lên**: nhân viên tải vào bucket của account mình đọc được. Khách chỉ tải vào `incoming/<uid của mình>/` trong
  bucket công ty mình, sau đó gọi `submit_task_files` / `report_payment` (RPC kiểm tra lại đường dẫn và sự tồn tại của
  object). Không có quyền sửa / xóa object: phiên bản mới là object mới; object mồ côi (ví dụ sau "Hoàn tác") do
  việc dọn dẹp chạy bằng service role xóa.

## 8. Danh sách kiểm thử RLS (theo SPEC §11)

Đóng vai một người dùng ngay trong SQL editor (quyền postgres), luôn trong giao dịch rồi `rollback`:

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', public.mock_uuid('u_client_minh'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- … câu kiểm tra …
rollback;
```

"Xem như khách hàng": thêm `'app_metadata', json_build_object('view_as_account_id', public.mock_uuid('acc_coxanh'))` vào claims
của một AM. Dữ liệu dùng `tests/fixture.sql`. Cột cuối là kết quả khi chạy thử trên PGlite.

| # | Mục SPEC §11 | Cách kiểm tra | Kết quả mong đợi | Đã chạy |
|---|---|---|---|---|
| 1 | Khách C-level thấy ngay tình hình, việc cần làm, việc đang chặn mốc nào | `select * from account_health(<acc>)`, `task_flags(<acc>)`, `v_milestone_forecasts` với vai Minh | `blocked`; lý do "Duyệt thiết kế…" quá hạn 6 ngày chặn mốc Thiết kế; hạng ưu tiên 1 | ✓ |
| 2 | Mọi việc phía khách có hạn, câu "Nếu chưa làm" và 1 nút chính | `insert into tasks (… side 'client', impact_text '')` với vai AM | Lỗi check `tasks_client_impact`; `due_date` not null; `type <> 'work'` | ✓ |
| 3 | Việc chặn mốc quá hạn → mốc có ngày dự báo mới kèm lý do, các mốc sau lùi theo | `select * from milestone_forecasts(<acc>)` | Thiết kế +6 `dependency`, UAT +6, Go-live +6 `cascade` từ Thiết kế, `cause_task_id` = việc duyệt | ✓ |
| 4 | Việc bị chặn không chuyển trạng thái, trừ khi AM mở chặn có lý do | `update tasks set status = 'in_progress'` (vai thành viên / AM) và `set_task_status`; rồi `manual_unblock(id, '')`, `manual_unblock(id, 'lý do')` | `blocked` kèm `{"blockers": [...]}`; thiếu lý do → `errors.reason_required`; sau khi mở chặn chuyển được và có nhật ký `task.unblocked` | ✓ |
| 5 | Khách không nhận giá vốn, biên lợi nhuận, ghi chú nội bộ (kiểm tra cả dữ liệu trả về) | Vai Minh / Lan: `select cost_price from price_items`, `select * from accounts`, `select manual_unblock_reason from tasks`, `select internal_note from quotes`; đếm `price_items_internal`, `quote_lines_internal`, `v_quote_totals_internal`, `accounts_internal`, `tasks_internal`; đọc `comments`, `files`, `activities`, `milestones`, `tasks` | `permission denied` cho các cột; 0 dòng ở view nội bộ; không có bình luận / tệp / nhật ký `internal`, không có việc `client_visible = false`, không có mốc ẩn | ✓ |
| 5b | AM không có quyền giá vốn | Vai Hà: `price_items_internal`, `v_quote_totals_internal`, `quote_lines_internal.cost_total` | 0 dòng / 0 dòng / `null`; Giám đốc và Đức Anh thấy giá vốn | ✓ |
| 6 | Báo giá vượt ngưỡng không gửi được khi chưa có Giám đốc duyệt | Vai Hà trên báo giá 15 %: `send_quote`, `update quotes set status = 'sent'`, tự ghi `director_approved_by`, `approve_quote` | `needs_approval` / `needs_approval` / `forbidden` / `forbidden`; sau khi Giám đốc duyệt thì gửi được; đổi giá sau khi duyệt → duyệt bị hủy | ✓ |
| 7 | "Xem như khách hàng" hiển thị đúng những gì khách thấy | Claims có `view_as_account_id` | `auth_viewer()` = `client_owner`, `read_only`; cùng kết quả đọc như Minh; mọi RPC và lệnh ghi trả `read_only` hoặc 0 dòng | ✓ |
| 8 | Giám đốc lọc được account bị chặn, đang chờ khách, quá hạn thu | `v_account_health` (`health_value`), `task_flags` (`waiting_on`), `payment_schedules` quá hạn | Có đủ dữ liệu; bộ đệm `accounts.health_auto` sau `run_daily_maintenance()` | ✓ |
| 9 | Mọi lần duyệt, từ chối đều có log: ai, lúc nào | Gọi `approve_task`, `request_task_changes`, `approve_quote`, `reject_quote_approval`, rồi đọc `activities`; thử `update activities` | Mỗi thao tác có dòng `activities` (`actor_id`, `created_at`, params); `update` / `delete` bị từ chối; `actor_id` không giả mạo được | ✓ |
| 10 | Hiển thị 375px, iPad, desktop; tiền VND, ngày dd/mm/yyyy | Thuộc giao diện | Ngoài phạm vi SQL; nội dung việc tự sinh dùng `dd/mm` và `120.000.000 ₫` | — |

Kiểm tra bổ sung (đã chạy):
- Khách chỉ đọc account của mình. AM chỉ thấy account mình phụ trách. Thành viên chỉ thấy account có việc được giao.
  `anon` không đọc được gì và không gọi được RPC nào.
- `client_member`: 0 dòng ở báo giá, dòng báo giá, bảng giá, hợp đồng, đợt thanh toán; không thấy tệp hợp đồng hoặc
  chứng từ; không thấy nhật ký thương mại; không duyệt được việc `requires_owner`.
- Giao việc: việc `requires_owner` → `requires_owner`; giao cho chính mình → `delegate_self`; người công ty khác →
  `invalid_delegate`; hồ sơ khách sai tên miền → `domain_mismatch`.
- Hoàn tác: trạng thái việc, báo giá, đợt thanh toán được khôi phục; tệp và nhật ký vừa thêm bị xóa; dùng lại token →
  `conflict`.
- Phụ thuộc: tạo vòng tròn hoặc tự phụ thuộc → `cycle`; khác account → `dependency_scope`; `check_dependencies` trả về
  đường vòng bằng tên việc.
- Storage: khách không tải vào `shared/` hay bucket công ty khác; `submit_task_files` từ chối đường dẫn lạ hoặc object
  không tồn tại.
- Việc chạy hằng ngày: báo giá quá hạn → `expired` và việc duyệt chưa trả lời bị thu hồi; đợt `invoiced` → tự tạo việc
  "Thanh toán"; người dùng thường không gọi được các hàm này.

## 9. Ghi chú và giới hạn

- Nội dung thông báo và email cần các mẫu i18n nên do Edge Function dựng (mục 6), không làm trong SQL. Các việc do hệ
  thống tự sinh (duyệt báo giá, thanh toán) dùng đúng câu chữ của `activity.commercialGen.*`.
- `quote.*` / `payment.*` thay đổi bằng lệnh ghi trực tiếp (ví dụ `updatePayment`) do adapter ghi nhật ký. Các thao tác
  duyệt / từ chối đều đã nằm trong RPC.
- `check_dependencies` duyệt theo đường đi (phù hợp đồ thị nhỏ của một account, khoảng vài chục việc). Trigger chống vòng
  tròn khi ghi thì dùng tập đạt tới (`union`) nên không bị bùng nổ.
- Postgres làm tròn nửa đơn vị ra xa số 0 còn `Math.round` làm tròn lên. Với số tiền dương, kết quả giống nhau.
