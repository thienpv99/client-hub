# Client Hub · New Era

Web app quản lý khách hàng của New Era. Một nơi gom đủ dự án, việc, báo giá, bán hàng (CRM), khách hàng mục tiêu và bản đồ khách hàng. App có hai phía:

- **Nội bộ New Era** (Giám đốc, AM, thành viên):
  - Tổng quan theo ngoại lệ, danh mục và chi tiết khách hàng.
  - Việc dạng Kanban / Danh sách / Dòng thời gian, lộ trình và ngày dự báo.
  - Thương mại: báo giá có phiên bản và duyệt chiết khấu, hợp đồng, lịch thanh toán, phải thu.
  - Bán hàng (phễu cơ hội, dự báo), khách hàng mục tiêu (điểm phù hợp, phân khúc, bán thêm), bản đồ khách hàng theo hệ sinh thái.
  - Danh mục dự án và tải việc; thông báo, nhắc khách, leo thang, bản tin tuần.
- **Khách hàng** (Người quyết định, Thành viên):
  - Trang chủ "việc cần anh/chị xử lý". Mỗi việc có hạn, ô "Nếu chưa làm" và 1 nút chính. Việc đã quá hạn thì ô này đổi thành "Đang ảnh hưởng" và nói rõ mốc nào đã lùi.
  - Tiến độ, thương mại, tài liệu, giao việc cho đồng nghiệp.

**Bản chạy online:** https://clienthub.nea.io.vn (Cloudflare Pages, project `clienthub`). Cách deploy lại xem mục "Deploy" bên dưới.

Tài liệu gốc:
- [SPEC.md](SPEC.md): đặc tả sản phẩm.
- [DESIGN.md](DESIGN.md): ngôn ngữ thiết kế.
- [ARCHITECTURE.md](ARCHITECTURE.md): kiến trúc và quy ước code.

---

## 1. Giao diện "Executive Calm"

Khách hàng đã duyệt bộ thiết kế mới (DESIGN.md). Tinh thần chung là **yên, rõ, cao cấp**, theo kiểu Linear hay Stripe Dashboard.

- **Một khối trọng tâm cho mỗi màn.** Khách thấy ngay "việc cần làm". Giám đốc thấy ngay "cần chú ý hôm nay". Thành viên nội bộ thấy ngay "việc của tôi". Khối này luôn nằm trong màn hình đầu, cả ở 375×812 và 1024×768.
- **Màu và chữ:**
  - Hai màu chủ đạo là xanh và trắng, font Be Vietnam Pro.
  - Số liệu lớn, chữ số đều cột.
  - Trạng thái luôn có đủ icon, chữ và nền nhạt. Mỗi thẻ chỉ có một màu trạng thái.
  - Màu xanh chỉ dùng cho hành động và lựa chọn.
- **Khung app theo thiết bị:**
  - Nội bộ, màn rộng (từ 1024px): thanh bên có 4 nhóm. **Điều hành**: Tổng quan. **Khách hàng**: Bán hàng, Khách hàng mục tiêu, Khách hàng, Bản đồ khách hàng, Dự án. **Vận hành**: Việc, Thương mại. **Hệ thống**: Thông báo, Cài đặt.
  - Nội bộ, iPad: thanh icon có nhãn ngắn.
  - Nội bộ, điện thoại: thanh trên cùng và menu trượt.
  - Phía khách: menu trên cùng trên desktop và iPad. Trên điện thoại là thanh điều hướng dưới (Trang chủ · Việc · Tiến độ · Thương mại · Tài liệu).
- **Thao tác:**
  - Chi tiết mở trong khung trượt (drawer), trên điện thoại là toàn màn hình hoặc tấm trượt từ dưới lên.
  - Đang tải thì hiện khung xương (skeleton). Màn rỗng có câu tự nhiên.
  - Vùng bấm trên màn cảm ứng tối thiểu 44px.
  - Tìm nhanh bằng Ctrl/Cmd + K.
- **Token màu, cỡ chữ, bóng đổ** nằm ở `tailwind.config.js` và `src/index.css`.
- **Bộ sưu tập thành phần** (dành cho dev): `src/components/ui/__gallery.tsx` và `src/components/common/__gallery.tsx`. Cách hiển thị ghi ở dòng 2 của mỗi file.

## 2. Ba cách chạy

### 2.1 Mở 1 file: `dist/ClientHub-demo.html`

Bấm đúp để mở bằng Chrome hoặc Edge, không cần server.

- Địa chỉ trong app có dạng `ClientHub-demo.html#/login`, `#/app/map`, `#/portal`.
- Cần **kết nối mạng** để tải React, Tailwind, font và các thư viện khác từ CDN (esm.sh, cdn.tailwindcss.com, Google Fonts).
- Dữ liệu demo nằm trong trình duyệt (localStorage). Muốn xóa thao tác của mình, vào menu tài khoản (Giám đốc hoặc AM) và chọn **Đặt lại dữ liệu demo**.

### 2.2 Chạy bằng Vite (máy có Node.js 18+ sạch)

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra, thường là http://localhost:5173.

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | chạy bản phát triển |
| `npm run build` | kiểm tra kiểu rồi build bản production vào `dist/` |
| `npm run preview` | xem thử bản build |
| `npm run typecheck` | kiểm tra kiểu TypeScript (`tsc --noEmit`) |

### 2.3 Chạy không cần Node (Windows, PowerShell)

Dùng cách này khi máy không có Node hoặc không được chạy Node. Mở PowerShell tại thư mục `client-hub` rồi chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Sau đó mở http://localhost:8780. Muốn đổi cổng thì thêm `-Port 8790`.

- Service Worker (`sw.js`) dịch TypeScript/TSX ngay trong trình duyệt bằng sucrase. Lần mở đầu sẽ chậm hơn một chút.
- Kiểm tra kiểu bằng tsc thật chạy trong trình duyệt: http://localhost:8780/tools/typecheck.html?auto=1
- Đóng gói lại file demo: http://localhost:8780/tools/build-standalone.html?auto=1. Kết quả ghi đè `dist/ClientHub-demo.html`.

---

### Deploy lên Cloudflare Pages (không cần Node)

Bản online là file đóng gói tự chứa (`dist/ClientHub-demo.html`, khoảng 6,8 MB). File này đã nhúng sẵn mọi thư viện, Tailwind và font, nên không gọi ra CDN nào. Để deploy lại sau khi sửa code:

1. Chạy server không cần Node, rồi mở http://localhost:8780/tools/build-standalone.html?auto=1 để đóng gói.
2. Mở http://localhost:8780/tools/pages-manifest.html để tính mã băm, kết quả ghi vào `dist/pages-manifest.json`.
3. Chạy lệnh deploy từ thư mục `client-hub`:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/deploy-cloudflare.ps1
```

Script đọc API token từ file `.cloudflare-token`. File này đã được git bỏ qua, không bao giờ commit. Token cần 3 quyền:
- Account › Cloudflare Pages › Edit
- Zone › Zone › Read
- Zone › DNS › Edit (cho `nea.io.vn`)

Lần đầu script tạo project và gắn tên miền `clienthub.nea.io.vn` (CNAME, có proxy). Các lần sau chỉ tạo bản deploy mới.

## 3. Đăng nhập demo

Màn đăng nhập có các nút **Vào nhanh** theo vai trò:

| Nút | Người dùng | Ghi chú |
|---|---|---|
| Giám đốc | Lê Hoàng Nam | thấy mọi thứ, kể cả giá vốn và biên lợi nhuận |
| Quản lý khách hàng (AM) | Nguyễn Thu Hà | phụ trách Cỏ Xanh, Thịnh An, Hải Đăng và 2 khách đang tiếp cận (Sao Bắc, Vạn Xuân). **Không** được xem giá vốn |
| Khách – Người quyết định | anh Trần Quang Minh, CEO Cỏ Xanh Retail | account đang bị chặn |
| Khách – Thành viên | chị Phạm Thu Lan, Cỏ Xanh Retail | có việc được anh Minh giao |
| Thành viên nội bộ (link nhỏ bên dưới) | Phạm Minh Tuấn | mở thẳng "Việc của tôi"; không thấy thương mại, giá vốn, CRM |

Đăng nhập thủ công:

- **Khách:** nhập email, rồi nhập mã OTP demo **`246810`**.
- **Nội bộ:** nhập email và mật khẩu **`newera2026`**.

| Email | Vai trò |
|---|---|
| `nam.le@newera.inc` | Giám đốc |
| `ha.nguyen@newera.inc` | AM |
| `ducanh.tran@newera.inc` | AM, **được** xem giá vốn. Phụ trách Thiên Trường, Gió Ngàn, Mây Trắng, Hoàng Vũ |
| `tuan.pham@newera.inc` · `linh.vo@newera.inc` · `quang.do@newera.inc` | Thành viên nội bộ |
| `minh.tran@coxanh.vn` · `long.vu@thinhanbank.vn` · `hung.ngo@thientruong.com.vn` · `phuong.mai@giongan.vn` · `binh.doan@maytrang.vn` | Người quyết định phía khách |
| `vy.lam@haidangland.vn` | Người quyết định Hải Đăng. Chị chưa đăng nhập lần nào, nên sẽ thấy 3 màn giới thiệu |

"Ghi nhớ thiết bị" giữ phiên đăng nhập sau khi đóng trình duyệt. Mỗi tab giữ phiên riêng, nên có thể mở song song một tab nội bộ và một tab khách. Giám đốc và AM có nút **Xem như khách hàng** trong chi tiết account. Nút này mở đúng giao diện khách thấy, ở chế độ chỉ đọc.

## 4. Các màn hình (đường dẫn)

**Nội bộ** (`/app`):

| Đường dẫn | Màn hình | Ai thấy |
|---|---|---|
| `/app` | Tổng quan: KPI, "Cần chú ý hôm nay", thu tiền theo tháng, danh mục account | Giám đốc, AM. Thành viên được chuyển sang `/app/tasks?mine=1` |
| `/app/crm/:tab?` | Bán hàng: Theo giai đoạn · Danh sách · Dự báo · Cần theo dõi | Giám đốc, AM |
| `/app/crm/opportunities/:id` | Chi tiết cơ hội | Giám đốc, AM |
| `/app/targets/:tab?` | Khách hàng mục tiêu: Mục tiêu · Phân khúc · Bán thêm · Chân dung lý tưởng | Giám đốc, AM |
| `/app/targets/leads/:id` | Chi tiết khách hàng mục tiêu | Giám đốc, AM |
| `/app/accounts`, `/app/accounts/new` | Danh sách khách hàng, tạo khách hàng (wizard 3 bước) | mọi người nội bộ (chỉ Giám đốc và AM được tạo) |
| `/app/accounts/:id/:tab?` | Chi tiết khách hàng: Tổng quan · Việc · Lộ trình · Bán hàng · Thương mại · Tài liệu · Liên hệ · Nhật ký | theo quyền |
| `/app/map` | **Bản đồ khách hàng** | Giám đốc, AM |
| `/app/projects/:tab?` | Dự án: Danh mục · Dòng thời gian · Tải việc | mọi người nội bộ |
| `/app/tasks` | Việc toàn công ty (`?mine=1`: việc của tôi) | mọi người nội bộ |
| `/app/commercial/:tab?` | Thương mại: Báo giá · Hợp đồng & thanh toán · Phải thu · Bảng giá | Giám đốc, AM |
| `/app/commercial/quotes/new`, `/app/commercial/quotes/:id` | Soạn và xem báo giá | Giám đốc, AM |
| `/app/notifications`, `/app/digest` | Thông báo (kèm hộp thư mô phỏng, quy tắc), xem trước bản tin tuần | mọi người nội bộ |
| `/app/settings/:tab?` | Cài đặt: người dùng, mời khách, mẫu lộ trình, bảng giá, ngưỡng và quy tắc | Giám đốc, AM |

**Khách hàng** (`/portal`):

| Đường dẫn | Màn hình |
|---|---|
| `/portal` | Trang chủ: lời chào, băng trạng thái, việc cần xử lý, tiến độ, New Era đang làm, cập nhật mới |
| `/portal/tasks`, `/portal/tasks/:taskId` | Việc: Cần xử lý · Đã giao · Chờ New Era · Đã xong · Cả công ty. Có `:taskId` thì mở thẳng việc đó (link trong email) |
| `/portal/progress` | Tiến độ: các mốc, kế hoạch và dự báo, lịch sử phê duyệt |
| `/portal/commercial`, `/portal/commercial/quotes/:id` | Thương mại, chỉ Người quyết định thấy |
| `/portal/documents` | Tài liệu đã chia sẻ |
| `/portal/settings` | Tùy chọn thông báo và xem trước bản tin tuần |

**Khác:** `/login` · `/dev/selftest` (tự kiểm tra).

### Bản đồ khách hàng (`/app/map`)

Mỗi công ty là một bong bóng. Khách hàng và khách hàng mục tiêu dùng chung một thang: bong bóng càng lớn thì giá trị càng cao. Vòng hệ sinh thái thể hiện tổng giá trị cả nhóm, theo thang riêng.

- **Đo kích thước theo 3 cách:**
  - *Tổng giá trị*: giá trị hợp đồng cộng giá trị cơ hội dự kiến.
  - *Hợp đồng*.
  - *Cơ hội*: tổng giá trị đang mở, nhân theo xác suất.
- **Hệ sinh thái** (nhóm doanh nghiệp, ví dụ một tập đoàn và các công ty con) là một nút trung tâm, nối với các thành viên. Cả khách hàng hiện có và khách hàng mục tiêu đều có thể là thành viên. Cụm này cho thấy cơ hội bán chéo trong cùng một nhóm.
- **Bộ lọc:** mặc định bản đồ chỉ hiện khách hàng; bật "Khách mục tiêu" để thêm các công ty đang tiếp cận (ngân sách dự kiến của họ lớn nên sẽ chiếm nhiều diện tích). Lọc theo AM phụ trách. Có thể chuyển giữa chế độ xem **Bản đồ** và **Bảng** (bảng xếp hạng).
- **Quản lý hệ sinh thái:** tạo, đổi tên, thêm hoặc bớt thành viên.
- **Phạm vi của AM:** AM chỉ thấy công ty mình phụ trách và khách mục tiêu chưa có người nhận. Một nhóm chỉ hiện nút trung tâm khi AM thấy ít nhất 2 thành viên của nhóm đó. AM chỉ được sửa mô tả hoặc đổi tên nhóm có công ty của mình.

## 5. Dữ liệu mẫu

Mọi ngày đều tính theo hôm nay, nên tình huống luôn đúng mỗi khi mở. Tên công ty và tên người đều là hư cấu.

| Khách hàng | Tình huống |
|---|---|
| Cỏ Xanh Retail (bán lẻ, 2 dự án) | **Đang bị chặn**: khách chưa duyệt thiết kế, quá hạn 6 ngày, UAT và Go-live dự báo lùi 6 ngày. Người quyết định đã giao việc cho đồng nghiệp. Có báo giá phụ lục chờ chấp thuận |
| Ngân hàng Thịnh An | Báo giá **v2 chiết khấu 15%** đang chờ Giám đốc duyệt. Nút "Gửi khách" bị khóa đến khi được duyệt |
| Cơ điện Thiên Trường (sản xuất) | Một **đợt thanh toán quá hạn 12 ngày** |
| Năng lượng Gió Ngàn | **New Era đang trễ việc** 4 ngày, mốc UAT lùi 4 ngày, khách thấy rõ lý do |
| Địa ốc Hải Đăng (bất động sản) | Có việc sắp đến hạn đang chặn mốc. Người quyết định chưa đăng nhập lần nào |
| Mây Trắng Logistics (2 dự án) | **Đúng kế hoạch**, không có việc chờ khách |
| Siêu thị Sao Bắc · Vận tải Hoàng Vũ · Dược phẩm Vạn Xuân | Khách đang đàm phán hoặc tiếp cận (chưa có dự án), sinh ra từ CRM |

**Số lượng:**

| Nhóm dữ liệu | Số lượng |
|---|---|
| Account | 9 |
| Dự án | 8 |
| Mốc | 49 |
| Việc | 110 |
| Phụ thuộc | 53 |
| Người dùng | 20 |
| Liên hệ | 24 |
| Báo giá | 14 |
| Hợp đồng | 7 |
| Đợt thanh toán | 26 |
| Mục bảng giá | 14 |
| Tài liệu mẫu | 38 (thiết kế dạng ảnh SVG, tài liệu dạng PDF) |
| Bình luận | 35 |
| Nhật ký | 120 |
| Thông báo | 24 |
| Mẫu lộ trình | 2 ("Triển khai phần mềm", "Tư vấn chuyển đổi số") |

**CRM và bản đồ khách hàng:**

- **32 khách hàng mục tiêu:**
  - Theo trạng thái: 6 mới, 9 đã liên hệ, 8 quan tâm, 4 nuôi dưỡng, 3 đã chuyển cơ hội, 2 không phù hợp.
  - Theo người phụ trách: chị Hà 15, anh Đức Anh 12, 5 chưa có người nhận.
- **14 cơ hội:**
  - Theo giai đoạn: 2 đủ điều kiện, 2 khảo sát nhu cầu, 3 đề xuất & báo giá, 2 đàm phán, 3 thắng, 2 thua.
  - Theo người phụ trách: chị Hà 8, anh Đức Anh 6.
- **59 lần tương tác:** 20 cuộc gọi, 19 cuộc họp, 10 email, 7 demo, 1 Zalo, 2 ghi chú.
- **4 phân khúc đã lưu:** "Bán lẻ & phân phối phía Nam quy mô lớn", "Ngân hàng – tài chính", "Khách hiện hữu có thể bán thêm", "Sản xuất miền Bắc doanh thu > 200 tỷ".
- **1 chân dung khách hàng lý tưởng (ICP)** mặc định. Mỗi account có 1 hồ sơ (tỉnh, quy mô, doanh thu, nguồn, nhãn) để chấm điểm phù hợp.
- **4 hệ sinh thái, tổng 17 công ty thành viên.** Mỗi nhóm có 2 khách hàng hiện có, nên bản đồ mặc định (chỉ khách hàng) vẫn thấy đủ các cụm:
  - Tập đoàn Cỏ Xanh: Cỏ Xanh Retail, Mây Trắng Logistics + 3 khách mục tiêu (chia giữa 2 AM, 1 công ty chưa có người nhận).
  - Tập đoàn Tài chính Thịnh An: Ngân hàng Thịnh An, Địa ốc Hải Đăng + 2 khách mục tiêu.
  - Tập đoàn Năng lượng Gió Ngàn: Năng lượng Gió Ngàn, Cơ điện Thiên Trường + 2 khách mục tiêu.
  - Tập đoàn Sao Bắc: Siêu thị Sao Bắc, Vận tải Hoàng Vũ + 2 khách mục tiêu.

  Dược phẩm Vạn Xuân đứng riêng, không thuộc nhóm nào.

## 6. Tự kiểm tra

Mở trang **/dev/selftest**. Giám đốc vào qua menu tài khoản. Bấm "Chạy tất cả" để chạy lần lượt 5 bộ kiểm tra:

| Bộ | Nội dung | Số kiểm tra |
|---|---|---|
| Logic nghiệp vụ | chặn, dự báo mốc, sức khỏe, thứ tự việc, báo giá, thanh toán, cách xưng hô | 74 |
| Bán hàng và bản đồ khách hàng | điểm phù hợp, phân khúc, phễu, dự báo, tải việc, bản đồ (giá trị theo chỉ số, hệ sinh thái, phạm vi AM) | 37 |
| Phân quyền dữ liệu | khách, thành viên, AM chỉ nhận đúng dữ liệu của mình; thao tác bị cấm; chế độ "xem như khách" chỉ đọc | 426 |
| Dữ liệu mẫu | đủ tình huống, ngày tương đối, liên kết hợp lệ, dữ liệu CRM và hệ sinh thái | 0 lỗi |
| Gọi API tổng quát | mọi hàm đọc với từng vai trò, cộng các tình huống mẫu trên dữ liệu mới | 341 |

Bộ phân quyền và bộ API chạy trên một bản sao riêng của dữ liệu, nên dữ liệu demo đang dùng không bị thay đổi. Kiểm tra kiểu toàn bộ chương trình (472 file, chế độ strict) bằng `tools/typecheck.html?auto=1` hoặc `npm run typecheck`: 0 lỗi.

## 7. Cấu trúc

```
src/
  domain/      logic thuần: chặn & dự báo mốc, sức khỏe, quy tắc việc, báo giá, thanh toán, CRM (điểm phù hợp, phễu)
  data/        dữ liệu mẫu sinh theo ngày hôm nay (seed/*), file mẫu, bộ kiểm tra dữ liệu mẫu
  services/    lớp dữ liệu giả lập: api.ts là hợp đồng duy nhất UI được gọi; lọc quyền (RBAC) ngay tại đây
  components/  ui (kit kiểu shadcn) · common (thành phần sản phẩm) · task · crm · commercial · remind
  layouts/     khung nội bộ, khung khách hàng, băng "Đang xem như khách hàng"
  features/    các màn hình: portal, dashboard, account, tasks, roadmap, commercial, notifications, settings,
               wizard, crm, targets, projects, clientmap, auth, shell, dev
  i18n/vi/     toàn bộ chữ hiển thị (thêm tiếng Anh: tạo i18n/en/ cùng khóa)
  dev/         bộ tự kiểm tra (domain, crm, rbac, apiSmoke, scenarioChecks)
supabase/      schema Postgres + RLS + hàm RPC cho backend thật sau này
tools/         serve.ps1 (server không cần Node), typecheck.html, build-standalone.html
vendor/fonts/  font nguồn của PDF mẫu (DejaVu Sans + giấy phép) và build-pdf-font.ps1 sinh lại src/data/samples/pdfFont.ts
dist/          ClientHub-demo.html (bản 1 file)
```

**Bảo mật:** các dữ liệu sau bị lọc ở lớp `services/` trước khi tới giao diện, không chỉ ẩn trên màn hình:

- Tài khoản khách không bao giờ nhận được:
  - giá vốn, biên lợi nhuận;
  - ghi chú nội bộ;
  - việc đã tắt "Khách thấy được";
  - mọi dữ liệu CRM và bản đồ khách hàng.
- Thành viên nội bộ không nhận được dữ liệu thương mại và CRM.
- AM chỉ thấy khách hàng, cơ hội và khách hàng mục tiêu trong phạm vi của mình.

Bảng `window.__CH_NET__` ghi lại mọi phản hồi API để kiểm chứng. Khi chuyển sang Supabase, các luật tương ứng nằm ở `supabase/schema.sql` (RLS và view không có cột giá vốn).

## 8. Phần đang mô phỏng

- **Backend:** chưa có server thật. Dữ liệu nằm trong localStorage của trình duyệt, đi qua lớp `services/` giống như API thật, có độ trễ 80–220 ms. Lớp này thay được bằng Supabase (`supabase/`).
- **Đăng nhập:**
  - Khách dùng OTP cố định `246810`, không gửi email thật.
  - Nội bộ dùng mật khẩu demo `newera2026`.
  - Chưa có đăng nhập Google.
- **Email:** chưa gửi thật. Xem trong "Thông báo → Hộp thư mô phỏng". Bản tin tuần xem trước ở `/app/digest` và `/portal/settings`.
- **"Nhắc qua Zalo":** app copy sẵn tin nhắn rồi mở zalo.me, người dùng tự dán và gửi.
- **Tài liệu:** file mẫu là ảnh SVG và PDF nhỏ được sinh sẵn. PDF nhúng sẵn font (DejaVu Sans) nên giữ đủ dấu tiếng Việt. File tải lên chỉ lưu trong trình duyệt.

## 9. Chưa làm ở bản này

Theo mục 12 của đặc tả, bản này chưa có:

- chat realtime;
- ký điện tử;
- hóa đơn điện tử;
- Zalo OA/ZNS;
- app native;
- AI tóm tắt;
- xuất báo cáo tình hình 1 trang.

Thiết kế đã chừa chỗ để thêm sau.
