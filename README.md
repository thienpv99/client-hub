# Client Hub · New Era

Web app quản lý và chăm sóc khách hàng của New Era. Một nơi gom đủ khách hàng, giải pháp đã triển khai, yêu cầu của khách, dự án, việc, báo giá và quan hệ với từng khách. App có hai phía:

- **Nội bộ New Era** (Giám đốc, AM, thành viên):
  - Tổng quan theo ngoại lệ: khách cần chú ý, nợ triển khai, yêu cầu chưa xử lý quá 7 ngày, khách quá hạn chăm sóc.
  - Chi tiết khách hàng: đã triển khai gì, yêu cầu của khách, còn có thể bán thêm gì ở phòng ban nào, sơ đồ quan hệ.
  - Bản đồ & tập đoàn: bản đồ khách hàng, bảng xếp hạng và ma trận giải pháp của từng tập đoàn.
  - Dự án: danh mục, bảng yêu cầu của khách, dòng thời gian, tải việc.
  - Việc dạng Kanban / Danh sách / Dòng thời gian, lộ trình và ngày dự báo.
  - Thương mại: báo giá có phiên bản và duyệt chiết khấu, hợp đồng, lịch thanh toán, phải thu.
  - Thông báo, nhắc khách, leo thang, bản tin tuần.
- **Khách hàng** (Người quyết định, Thành viên):
  - Trang chủ "việc cần anh/chị xử lý". Mỗi việc có hạn, ô "Nếu chưa làm" và 1 nút chính. Việc đã quá hạn thì ô này đổi thành "Đang ảnh hưởng" và nói rõ mốc nào đã lùi.
  - Tiến độ (kèm giải pháp đang dùng và yêu cầu đã gửi New Era), gửi yêu cầu mới, thương mại, tài liệu, giao việc cho đồng nghiệp.

Bán hàng (CRM) và Khách hàng mục tiêu tạm ẩn theo góp ý của ban lãnh đạo; mã nguồn và dữ liệu vẫn giữ nguyên (xem mục "Điểm mới").

**Bản chạy online:** https://clienthub.nea.io.vn (Cloudflare Pages, project `clienthub`). Cách deploy lại xem mục "Deploy" bên dưới.

Tài liệu gốc:
- [SPEC.md](SPEC.md): đặc tả sản phẩm.
- [SPEC-CARE.md](SPEC-CARE.md): đặc tả đợt "chăm sóc khách hàng" (09/10/2026).
- [DESIGN.md](DESIGN.md): ngôn ngữ thiết kế.
- [ARCHITECTURE.md](ARCHITECTURE.md): kiến trúc và quy ước code (đợt chăm sóc khách hàng ở mục 14).

---

## Điểm mới: tập trung chăm sóc khách hàng đã ký (09/10/2026)

Ban lãnh đạo muốn app giúp **quản lý và chăm sóc tốt từng khách hàng đã ký**, chưa cần săn khách mới. Giám đốc mở app là thấy ngay khách nào đã dùng gì, còn bán thêm được gì, và quan hệ với ai đang tốt hay đang lỏng.

**Tổng quan (`/app`)** trả lời 4 câu hỏi trong 10 giây:
- 4 ô số liệu: **Khách cần chú ý**, **Nợ triển khai** (yêu cầu đã hẹn ngày với khách nhưng chưa có người làm, chưa có kế hoạch, hoặc đã quá ngày hẹn), **Chưa xử lý quá 7 ngày** (yêu cầu khách gửi mà New Era chưa tiếp nhận), **Khách quá hạn chăm sóc**. Bấm một ô để lọc danh sách khách bên dưới.
- **Cần chú ý hôm nay** có thêm các yêu cầu đang nợ, yêu cầu chờ lâu, yêu cầu đã tiếp nhận quá 14 ngày mà chưa hẹn ngày với khách, khách quá hạn chăm sóc và các bước bán thêm ở tab Mở rộng đến hạn trong tuần. Mỗi dòng có nút làm ngay: mở yêu cầu để xử lý hoặc hẹn ngày, **Ghi lần chăm sóc**, hoặc mở đúng phòng ban ở tab Mở rộng.
- Thẻ **Còn có thể bán thêm**: khách đã ký xếp theo giá trị còn bán được, kèm số phòng ban đã phủ; bấm để mở tab Mở rộng hoặc ma trận tập đoàn.
- Danh mục khách hàng có 2 cách xem: **Chăm sóc** (đã triển khai gì, phòng ban đã phủ, yêu cầu, việc chăm sóc tiếp theo, quan hệ với người quyết định) và **Tiến độ** (như trước).

**Trang một khách hàng** có các tab: Tổng quan · **Triển khai** · Việc · Lộ trình · **Mở rộng** · **Quan hệ** · Thương mại · Tài liệu · Hoạt động.
- **Triển khai:** các giải pháp New Era đã triển khai (trạng thái, ngày bắt đầu dùng, phòng ban, số người dùng, mức sử dụng) và mọi yêu cầu của khách. Mỗi yêu cầu mở ra một khung để tiếp nhận, giao người phụ trách, hẹn ngày với khách, gắn kế hoạch hoặc từ chối kèm lý do.
- **Quy tắc vàng:** còn yêu cầu nợ triển khai thì **tạm dừng mở rộng sang phòng ban mới**, kể cả khi thêm hay sửa một giải pháp đưa vào phòng ban New Era chưa làm việc. AM không mở rộng được; chỉ Giám đốc mở ngoại lệ được, và phải ghi lý do (lưu vào nhật ký).
- **Mở rộng:** phòng ban nào đã có giải pháp, đang trao đổi, chưa tiếp cận; nhu cầu, cơ hội và giá trị ước tính; nhóm giải pháp khách chưa có (giải pháp tạm dừng được tính là còn trống).
- **Quan hệ:** sơ đồ ai ở New Era giữ quan hệ với ai phía khách (màu đường nối = mức thân thiết), ai là người quyết định, ai ủng hộ, ai còn nghi ngại, ai lâu chưa liên hệ, và các mối quan hệ với công ty khác trong cùng tập đoàn. Chip "Tập đoàn …" trên đầu trang mở ma trận của cả tập đoàn.
- **Chăm sóc** (thẻ ở Tổng quan): lần chăm sóc gần nhất, nhịp chăm sóc, việc tiếp theo. "Lần chăm sóc" là việc New Era chủ động liên hệ (cuộc gọi, buổi gặp, email đã ghi; nhật ký liên hệ với từng người; khách duyệt hay trả lời việc New Era gửi). Khách tự gửi yêu cầu, tải tài liệu hay ghi chú nội bộ không được tính. Nút **Ghi lần chăm sóc** lưu cuộc gọi / buổi gặp và hẹn luôn việc tiếp theo; khách quá hạn chăm sóc sẽ hết bị đánh dấu ngay.
- Khách chưa ký hợp đồng (đang tiếp cận, đang đàm phán) vẫn có trong danh sách nhưng xếp cuối, không tính vào số liệu chăm sóc và "Còn có thể bán thêm".

**Bản đồ & tập đoàn → Ma trận:** chọn một tập đoàn, mỗi dòng là một công ty, mỗi cột là một nhóm giải pháp: **Đang dùng · Đang triển khai · Cơ hội · Còn trống**. Ô đã dùng mà phòng ban khác còn nhu cầu ghi thêm "+ giá trị". Câu tóm tắt đếm đúng số cơ hội (khớp với tổng giá trị), chỉ tính công ty đã ký, và nêu tên các công ty khác trong tập đoàn chưa dùng giải pháp nào của New Era. Bấm một ô để mở đúng tab của công ty đó. Bên dưới là các mối quan hệ giữa các công ty trong tập đoàn, viết thành câu dễ đọc.

**Dự án → Yêu cầu:** mọi yêu cầu của mọi khách trên một bảng theo trạng thái (Mới · Đã tiếp nhận · Đã lên kế hoạch · Đang làm · Xong · Từ chối) hoặc theo ngày hẹn với khách, có vạch "Hôm nay". Yêu cầu đã tiếp nhận không quay lại "Mới". Yêu cầu khách thấy đánh số YC-01, YC-02…; đề xuất do New Era tự nêu đánh số riêng ĐX-01… nên dãy số của khách không bị hổng. Tìm nhanh (Ctrl/Cmd + K) tìm được yêu cầu theo mã hoặc nội dung, và giải pháp đã triển khai theo tên.

**Phía khách:** trang Tiến độ có thêm "Giải pháp New Era triển khai" (ngày dự kiến dùng khớp với dòng thời gian của dự án) và "Yêu cầu của anh/chị" (trạng thái, ngày dự kiến xong, lời nhắn của New Era; yêu cầu trễ hẹn lên đầu); nút **Gửi yêu cầu mới**. AM nhận thông báo khi khách gửi yêu cầu; khách nhận thông báo khi yêu cầu được lên kế hoạch (kèm ngày), khi ngày dự kiến thay đổi, khi hoàn thành hoặc chưa thực hiện được. Đề xuất do New Era tự nêu (nguồn "New Era đề xuất") chỉ nội bộ thấy.

**Nhắc hằng ngày:** mỗi sáng AM và Giám đốc nhận một thông báo khi một yêu cầu thành nợ triển khai (mỗi lý do một lần), chờ tiếp nhận quá 7 ngày, hoặc đã tiếp nhận quá 14 ngày mà chưa hẹn ngày với khách (một lần). Trang khách hàng không còn ghi "Triển khai ổn định" khi còn yêu cầu như vậy.

**Bản tin tuần** (thứ Hai) có thêm phần **Yêu cầu & chăm sóc**: phía New Era thấy nhịp chăm sóc, việc chăm sóc tiếp theo và các yêu cầu đang mở kèm cờ (nợ triển khai, chưa xử lý, chưa hẹn ngày); khách thấy các yêu cầu của mình đang xử lý và ngày dự kiến xong.

**Ai thấy gì:** Giám đốc thấy tất cả; AM thấy khách mình phụ trách; thành viên nội bộ chỉ thấy giải pháp và yêu cầu (không thấy mở rộng, quan hệ, chăm sóc); khách không bao giờ nhận được dữ liệu nội bộ (người phụ trách, kế hoạch, ghi chú nội bộ, giá trị, phòng ban, quan hệ).

**Bật lại Bán hàng / Khách hàng mục tiêu:** sửa `src/config/features.ts` (`sales: true`, `targets: true`), đóng gói và deploy lại. Khi tắt, mọi đường dẫn cũ `/app/crm…`, `/app/targets…` tự chuyển về Tổng quan.

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
  - Nội bộ, màn rộng (từ 1024px): thanh bên có 4 nhóm. **Điều hành**: Tổng quan. **Khách hàng**: Khách hàng, Bản đồ & tập đoàn, Dự án. **Vận hành**: Việc, Thương mại. **Hệ thống**: Thông báo, Cài đặt. (Bán hàng và Khách hàng mục tiêu đang ẩn.)
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
- **Không cần mạng:** file đã nhúng sẵn React, các thư viện, Tailwind và font. Riêng nút đăng nhập Google cần mạng và chỉ hiện trên địa chỉ đã đăng ký (xem mục 3).
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

Bản online là file đóng gói tự chứa (`dist/ClientHub-demo.html`, khoảng 7,7 MB). File này đã nhúng sẵn mọi thư viện, CSS Tailwind biên dịch sẵn và font, nên không gọi ra CDN nào. Để deploy lại sau khi sửa code:

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

Màn đăng nhập (`/login`) chỉ có **một khung "Đăng nhập"** dùng chung cho khách hàng và nhân sự New Era, không chia thẻ Khách hàng / Nội bộ:

1. **Đăng nhập bằng Google** ở trên cùng, dành cho nhân sự New Era (tài khoản `@newera.inc`, xem mục dưới). Khi nút ẩn, dòng "hoặc dùng email" ngay dưới nó cũng ẩn.
2. **Email công việc** → **Tiếp tục**. Bước tiếp theo chọn theo đuôi email:
   - `@newera.inc` (nhân sự New Era) → nhập **mật khẩu**, bấm **Đăng nhập**. Có nút hiện/ẩn mật khẩu.
   - đuôi khác (khách hàng) → hệ thống gửi **mã 6 số** qua email, nhập mã rồi bấm **Xác nhận** (đủ 6 số là tự đăng nhập, dán mã cũng được). Bản demo hiện mã ngay trên màn hình, kèm nút "Điền mã". "Gửi lại mã" bấm lại được sau 30 giây.
   - Email khách không có trong hệ thống: báo "Không tìm thấy tài khoản với email này." ngay dưới ô email.
3. Ở bước mật khẩu / mã, email hiện thành một dòng kèm nút **Đổi email**. Bấm nút này hoặc phím **Esc** để quay lại, email đã gõ vẫn còn.
4. **Ghi nhớ thiết bị này** (mặc định bật) hiện ở mọi bước và áp dụng cho mọi cách đăng nhập, kể cả Google.

**Enter** gửi từng bước. Trình quản lý mật khẩu của trình duyệt tự điền được email và mật khẩu. Đăng nhập xong, app mở trang trong `?next=` (nếu có và đúng phía), nếu không thì về trang chủ theo vai trò: Giám đốc / AM → `/app`, thành viên nội bộ → `/app/tasks?mine=1`, khách → `/portal`.

Bên dưới khung là mục **Vào nhanh (demo)** với các thẻ theo vai trò:

| Nút | Người dùng | Ghi chú |
|---|---|---|
| Giám đốc | Lê Hoàng Nam | thấy mọi thứ, kể cả giá vốn và biên lợi nhuận |
| Quản lý khách hàng (AM) | Nguyễn Thu Hà | phụ trách Cỏ Xanh, Thịnh An, Hải Đăng và 2 khách đang tiếp cận (Sao Bắc, Vạn Xuân). **Không** được xem giá vốn |
| Khách – Người quyết định | anh Trần Quang Minh, CEO Cỏ Xanh Retail | account đang bị chặn |
| Khách – Thành viên | chị Phạm Thu Lan, Cỏ Xanh Retail | có việc được anh Minh giao |
| Thành viên nội bộ (link nhỏ bên dưới) | Phạm Minh Tuấn | mở thẳng "Việc của tôi"; thấy giải pháp và yêu cầu của khách, không thấy thương mại, giá vốn, CRM, mở rộng, quan hệ, chăm sóc |

Đăng nhập thủ công (cùng một khung, theo đuôi email):

- **Khách:** nhập email, bấm Tiếp tục, rồi nhập mã OTP demo **`246810`**.
- **Nội bộ (`@newera.inc`):** nhập email, bấm Tiếp tục, rồi nhập mật khẩu **`newera2026`**.

| Email | Vai trò |
|---|---|
| `nam.le@newera.inc` | Giám đốc |
| `ha.nguyen@newera.inc` | AM |
| `ducanh.tran@newera.inc` | AM, **được** xem giá vốn. Phụ trách Thiên Trường, Gió Ngàn, Mây Trắng, Hoàng Vũ |
| `tuan.pham@newera.inc` · `linh.vo@newera.inc` · `quang.do@newera.inc` | Thành viên nội bộ |
| `minh.tran@coxanh.vn` · `long.vu@thinhanbank.vn` · `hung.ngo@thientruong.com.vn` · `phuong.mai@giongan.vn` · `binh.doan@maytrang.vn` | Người quyết định phía khách |
| `vy.lam@haidangland.vn` | Người quyết định Hải Đăng. Chị chưa đăng nhập lần nào, nên sẽ thấy 3 màn giới thiệu |

"Ghi nhớ thiết bị" giữ phiên đăng nhập sau khi đóng trình duyệt. Mỗi tab giữ phiên riêng, nên có thể mở song song một tab nội bộ và một tab khách. Giám đốc và AM có nút **Xem như khách hàng** trong chi tiết account. Nút này mở đúng giao diện khách thấy, ở chế độ chỉ đọc.

### Đăng nhập bằng Google (nhân sự New Era)

Nút **Đăng nhập bằng Google** nằm trên cùng khung đăng nhập, phía trên ô email, kèm dòng chú thích "Dành cho nhân sự New Era (@newera.inc)".

- **Ai dùng được:** chỉ tài khoản Google Workspace của tên miền **`newera.inc`**. Khách hàng vẫn đăng nhập bằng email và mã OTP như cũ.
- **Đã có tài khoản:** email Google trùng với một người dùng nội bộ (không phân biệt chữ hoa, chữ thường) thì vào thẳng tài khoản đó, giữ nguyên vai trò.
- **Lần đầu đăng nhập:** chưa có tài khoản thì hệ thống tự tạo một người dùng nội bộ với vai trò **Giám đốc** (thấy toàn bộ, kể cả giá vốn), vì dữ liệu hiện là mô hình mẫu. Tên và ảnh đại diện lấy từ Google. Giám đốc nhận một thông báo, và nhật ký ghi lại. Khi dùng thật, đổi `SSO_DEFAULT_ROLE` thành `member`.
- **Đổi vai trò:** Giám đốc vào **Cài đặt › Người dùng & vai trò**. Người tạo qua Google có nhãn **Google** cạnh tên. Muốn ai đó thành Giám đốc ngay lần đầu thì thêm email vào `SSO_ADMIN_EMAILS`.
- **Tài khoản bị khóa:** không đăng nhập được bằng Google, và hệ thống không tạo tài khoản mới thay thế. Nếu Giám đốc đã mời lại email đó, Google đăng nhập vào tài khoản mới được mời (giống form mật khẩu).
- **Ghi nhớ thiết bị** áp dụng cho cả đăng nhập Google.
- **Khi nào nút ẩn:** chưa cấu hình `GOOGLE_CLIENT_ID`, máy đang offline, mở file HTML trực tiếp (`file://`), hoặc trang chạy ở địa chỉ không có trong `GOOGLE_JS_ORIGINS` (ví dụ link xem trước `….pages.dev` của Cloudflare, `127.0.0.1`), vì Google từ chối nút ở các địa chỉ chưa đăng ký. Khi nút ẩn, khung chỉ còn ô email. Nếu đã cấu hình mà không tải được script của Google, khung hiện dòng "Không tải được đăng nhập Google. Anh/chị vẫn đăng nhập được bằng email bên dưới."
- **Bảo mật:** mã đăng nhập (ID token) của Google được kiểm tra ngay trong trình duyệt trước khi tin bất kỳ thông tin nào:
  - chữ ký RS256, đối chiếu khóa công khai của Google (RSA từ 2048 bit; khóa ghi trong mã bị bỏ qua);
  - nơi phát hành, client ID, hạn dùng;
  - email đã xác minh, chỉ gồm ký tự ASCII;
  - tên miền `hd` **và** đuôi email đều phải là `newera.inc`.

  Lớp dịch vụ (`loginWithGoogle`) tự kiểm tra lại, không tin giao diện. Mã đăng nhập không bao giờ được ghi lại.

#### Cấu hình Google SSO

1. Vào [Google Cloud Console](https://console.cloud.google.com/) và chọn (hoặc tạo) project của New Era.
2. Mở **APIs & Services › OAuth consent screen**. Chọn **User type: Internal**, để chỉ tài khoản `newera.inc` thấy màn đồng ý.
3. Mở **APIs & Services › Credentials › Create credentials › OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** `https://clienthub.nea.io.vn` và `http://localhost:8780`.
   - Không cần Redirect URI (nút chạy ở chế độ popup).
4. Chép **Client ID** (dạng `….apps.googleusercontent.com`) vào `GOOGLE_CLIENT_ID` trong `src/config/auth.ts`. Client ID là thông tin công khai, không phải bí mật, nên commit được. Nếu thêm địa chỉ trang ở bước 3, thêm cả vào `GOOGLE_JS_ORIGINS` (hai danh sách phải giống nhau).
5. Đóng gói và deploy lại (mục "Deploy lên Cloudflare Pages" ở trên).

Cũng trong `src/config/auth.ts`:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `GOOGLE_JS_ORIGINS` | `https://clienthub.nea.io.vn`, `http://localhost:8780` | Địa chỉ trang được hiện nút Google (trùng "Authorized JavaScript origins") |
| `SSO_ALLOWED_DOMAIN` | `newera.inc` | Tên miền Google Workspace được phép |
| `SSO_DEFAULT_ROLE` | `director` | Vai trò của người tạo tự động (đang để Giám đốc vì dữ liệu là mẫu; đổi thành `member` khi dùng thật) |
| `SSO_ADMIN_EMAILS` | rỗng | Email được tạo thẳng với vai trò Giám đốc |

## 4. Các màn hình (đường dẫn)

**Nội bộ** (`/app`):

| Đường dẫn | Màn hình | Ai thấy |
|---|---|---|
| `/app` | Tổng quan: 4 ô số liệu chăm sóc, "Cần chú ý hôm nay", thu tiền theo tháng, mốc sắp tới, "Còn có thể bán thêm", danh mục khách hàng (Chăm sóc · Tiến độ) | Giám đốc, AM. Thành viên được chuyển sang `/app/tasks?mine=1` |
| `/app/accounts`, `/app/accounts/new` | Danh sách khách hàng (Chăm sóc · Tiến độ, lọc "Nợ triển khai", "Quá hạn chăm sóc"), tạo khách hàng (wizard 3 bước) | mọi người nội bộ (chỉ Giám đốc và AM được tạo) |
| `/app/accounts/:id/:tab?` | Chi tiết khách hàng: Tổng quan · Triển khai · Việc · Lộ trình · Mở rộng · Quan hệ · Thương mại · Tài liệu · Hoạt động. Đường dẫn cũ `…/contacts` chuyển sang Quan hệ, `…/sales` về Tổng quan | theo quyền (Mở rộng: Giám đốc, AM; thành viên thấy tab "Liên hệ" thay cho Quan hệ) |
| `/app/map` | **Bản đồ & tập đoàn**: Bản đồ · Bảng · Ma trận (`?view=matrix&eco=…`) | Giám đốc, AM |
| `/app/projects/:tab?` | Dự án: Danh mục · Yêu cầu · Dòng thời gian · Tải việc | mọi người nội bộ |
| `/app/crm…`, `/app/targets…` | Bán hàng, Khách hàng mục tiêu: **đang ẩn**, đường dẫn tự chuyển về `/app` | Giám đốc, AM (khi bật lại) |
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
| `/portal/progress` | Tiến độ: các mốc, kế hoạch và dự báo, giải pháp đang dùng, yêu cầu đã gửi New Era (`?cr=…` mở thẳng một yêu cầu), nút "Gửi yêu cầu mới", lịch sử phê duyệt |
| `/portal/commercial`, `/portal/commercial/quotes/:id` | Thương mại, chỉ Người quyết định thấy |
| `/portal/documents` | Tài liệu đã chia sẻ |
| `/portal/settings` | Tùy chọn thông báo và xem trước bản tin tuần |

**Khác:** `/login` · `/dev/selftest` (tự kiểm tra).

### Bản đồ & tập đoàn (`/app/map`)

Ba cách xem: **Bản đồ** · **Bảng** · **Ma trận**.

- **Bản đồ:** mỗi khách hàng là một bong bóng, càng lớn thì giá trị càng cao. Vòng tập đoàn thể hiện tổng giá trị cả nhóm, theo thang riêng. Đo kích thước theo *Hợp đồng* đã ký. Khi phần Bán hàng tắt, cách đo *Cơ hội* và *Tổng giá trị* (cộng cả cơ hội đang theo đuổi) cùng cột *Tổng giá trị* của bảng đều ẩn, để khách chưa ký không trông như khách lớn.
- **Tập đoàn** (một tập đoàn và các công ty con) là một nút trung tâm nối với các công ty thành viên, cho thấy chỗ bán chéo trong cùng một nhóm.
- **Bảng:** bảng xếp hạng các công ty trên bản đồ.
- **Ma trận:** chọn một tập đoàn; mỗi công ty một dòng, mỗi nhóm giải pháp một cột (Đang dùng · Đang triển khai · Cơ hội · Còn trống), kèm phòng ban đã phủ, nợ triển khai, chăm sóc. Bấm ô để mở tab Triển khai hoặc Mở rộng của công ty. Bên dưới: quan hệ giữa các công ty trong tập đoàn.
- **Quản lý tập đoàn:** tạo, đổi tên, thêm hoặc bớt công ty. Lọc theo AM phụ trách.
- **Phạm vi của AM:** AM chỉ thấy công ty mình phụ trách. Một nhóm chỉ hiện nút trung tâm khi AM thấy ít nhất 2 công ty của nhóm. AM chỉ được sửa mô tả hoặc đổi tên nhóm có công ty của mình; ma trận chỉ hiện các công ty của AM trong tập đoàn.
- Khách hàng mục tiêu không hiện trên bản đồ khi phần Khách hàng mục tiêu đang ẩn.

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
| Liên hệ | 40 (16 người mới chưa có tài khoản: giám đốc tài chính, trưởng CNTT, trưởng vận hành…) |
| Báo giá | 14 |
| Hợp đồng | 7 |
| Đợt thanh toán | 26 |
| Mục bảng giá | 14 |
| Tài liệu mẫu | 38 (thiết kế dạng ảnh SVG, tài liệu dạng PDF) |
| Bình luận | 35 |
| Nhật ký | 151 |
| Thông báo | 27 |
| Mẫu lộ trình | 2 ("Triển khai phần mềm", "Tư vấn chuyển đổi số") |

**Chăm sóc khách hàng** (dữ liệu mẫu phiên bản 6; trình duyệt đang giữ bản cũ sẽ tự tạo lại dữ liệu ở lần mở đầu tiên):

| Nhóm dữ liệu | Số lượng |
|---|---|
| Giải pháp đã triển khai | 13 (5 đang dùng, 7 đang triển khai, 1 chạy thử) |
| Phòng ban trên bản đồ mở rộng | 67, mỗi khách 6–9 (37 đang trao đổi, 23 chưa tiếp cận, 7 không phù hợp; "đang dùng" tự suy ra từ giải pháp) |
| Người phía khách có thông tin quan hệ | 40 (9 ủng hộ mạnh, 18 ủng hộ, 9 trung lập, 4 còn nghi ngại) |
| Quan hệ giữa các công ty cùng tập đoàn | 8 |
| Yêu cầu của khách | 33 (9 mới, 3 đã tiếp nhận, 7 đã lên kế hoạch, 4 đang làm, 8 xong, 2 từ chối; 8 khách gửi qua Client Hub) |
| Kế hoạch chăm sóc | 9 (nhịp mặc định: Chiến lược 14 ngày, Trọng điểm 21, Tiêu chuẩn 30) |

Tình huống:
- **Cỏ Xanh Retail** có 3 yêu cầu nợ triển khai (một cái đã quá ngày hẹn, một cái chưa có kế hoạch, một cái chưa có người phụ trách), nên đang **tạm dừng mở rộng**.
- **Ngân hàng Thịnh An** có 2 yêu cầu khách gửi đã 9 và 11 ngày mà chưa được tiếp nhận.
- **Mây Trắng Logistics** khỏe: không nợ, 5 cơ hội đã có giá trị ước tính, chưa có giải pháp web, dữ liệu hay AI.
- **Cơ điện Thiên Trường** và **Địa ốc Hải Đăng** quá hạn chăm sóc (việc chăm sóc đã hẹn bị quá ngày); **Siêu thị Sao Bắc** sắp đến hạn.

**CRM và bản đồ khách hàng** (giao diện Bán hàng và Khách hàng mục tiêu đang ẩn, dữ liệu vẫn giữ):

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

Mở trang **/dev/selftest**. Giám đốc vào qua menu tài khoản. Bấm "Chạy tất cả" để chạy lần lượt 7 bộ kiểm tra:

| Bộ | Nội dung | Số kiểm tra |
|---|---|---|
| Logic nghiệp vụ | chặn, dự báo mốc, sức khỏe, thứ tự việc, báo giá, thanh toán, cách xưng hô | 74 |
| Bán hàng và bản đồ khách hàng | điểm phù hợp, phân khúc, phễu, dự báo, tải việc, bản đồ (giá trị theo chỉ số, hệ sinh thái, phạm vi AM) | 37 |
| Phân quyền dữ liệu | khách, thành viên, AM chỉ nhận đúng dữ liệu của mình; thao tác bị cấm; chế độ "xem như khách" chỉ đọc (Giám đốc và AM); mọi hàm chăm sóc khách hàng với từng vai trò, kể cả xóa ngoài phạm vi, khách gửi trường giả mạo, ghi chú nội bộ không lọt vào thông báo / email của khách, đề xuất nội bộ không tới khách | 552 |
| Chăm sóc khách hàng | yêu cầu chưa xử lý quá 7 ngày (đúng 7 ngày chưa tính), yêu cầu đã tiếp nhận quá 14 ngày chưa hẹn ngày, từng lý do nợ triển khai, đánh số riêng cho đề xuất nội bộ, phòng ban đã phủ, chặn mở rộng (cả qua giải pháp) và ngoại lệ của Giám đốc, giải pháp tạm dừng, nhịp chăm sóc (yêu cầu của khách và ghi chú nội bộ không tính là chăm sóc), ghi lần chăm sóc; luồng khách gửi → tiếp nhận → lên kế hoạch → dời ngày → xong kèm thông báo; nhắc hằng ngày; dữ liệu mẫu | 38 |
| Đăng nhập Google | mã Google ký bằng khóa thử: đúng thì qua; sai client ID, sai nơi phát hành, hết hạn, email chưa xác minh, sai tên miền, sai chữ ký, `alg none`, khóa ghi trong header, khóa RSA dưới 2048 bit, email có ký tự ngoài ASCII đều bị chặn; bộ nhớ đệm khóa của Google (bản lưu giả bị bỏ qua); khóa thử không có tác dụng ngoài bản sao riêng; tạo thành viên một lần, nhận đúng người dùng có sẵn (kể cả người được mời lại sau khi bị khóa), không nâng vai trò người đã có, từ chối tài khoản khách | 40 |
| Dữ liệu mẫu | đủ tình huống, ngày tương đối, liên kết hợp lệ, dữ liệu CRM, tập đoàn và chăm sóc khách hàng | 0 lỗi |
| Gọi API tổng quát | mọi hàm đọc với từng vai trò, cộng các tình huống mẫu trên dữ liệu mới | 382 |

Bộ phân quyền, bộ đăng nhập Google, bộ chăm sóc khách hàng và bộ API chạy trên một bản sao riêng của dữ liệu, nên dữ liệu demo đang dùng không bị thay đổi. Kiểm tra kiểu toàn bộ chương trình (556 file, chế độ strict) bằng `tools/typecheck.html?auto=1` hoặc `npm run typecheck`: 0 lỗi.

## 7. Cấu trúc

```
src/
  config/      features.ts (bật / tắt Bán hàng, Khách hàng mục tiêu) · auth.ts (đăng nhập Google)
  domain/      logic thuần: chặn & dự báo mốc, sức khỏe, quy tắc việc, báo giá, thanh toán, CRM (điểm phù hợp, phễu),
               chăm sóc khách hàng (care.ts: nợ triển khai, chờ quá 7 ngày, phòng ban đã phủ, chặn mở rộng, nhịp chăm sóc)
  data/        dữ liệu mẫu sinh theo ngày hôm nay (seed/*), file mẫu, bộ kiểm tra dữ liệu mẫu
  services/    lớp dữ liệu giả lập: api.ts là hợp đồng duy nhất UI được gọi; lọc quyền (RBAC) ngay tại đây
  components/  ui (kit kiểu shadcn) · common (thành phần sản phẩm) · care (nhãn, khung yêu cầu, ghi lần chăm sóc) ·
               task · crm · commercial · remind
  layouts/     khung nội bộ, khung khách hàng, băng "Đang xem như khách hàng"
  features/    các màn hình: portal, dashboard, account, tasks, roadmap, commercial, notifications, settings,
               wizard, crm, targets, projects, clientmap, auth, shell, dev
  i18n/vi/     toàn bộ chữ hiển thị (thêm tiếng Anh: tạo i18n/en/ cùng khóa)
  dev/         bộ tự kiểm tra (domain, crm, rbac, care, apiSmoke, scenarioChecks)
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
  - mọi dữ liệu CRM và bản đồ khách hàng;
  - dữ liệu chăm sóc nội bộ: phòng ban và cơ hội, quan hệ, kế hoạch chăm sóc, giá trị và mức sử dụng của giải pháp, người phụ trách, kế hoạch, ghi chú nội bộ và cờ nợ triển khai của yêu cầu.
- Thành viên nội bộ không nhận được dữ liệu thương mại, CRM, mở rộng, quan hệ và chăm sóc (chỉ giải pháp và yêu cầu).
- AM chỉ thấy khách hàng, cơ hội và khách hàng mục tiêu trong phạm vi của mình.

Bảng `window.__CH_NET__` ghi lại mọi phản hồi API để kiểm chứng. Khi chuyển sang Supabase, các luật tương ứng nằm ở `supabase/schema.sql` (RLS và view không có cột giá vốn).

## 8. Phần đang mô phỏng

- **Backend:** chưa có server thật. Dữ liệu nằm trong localStorage của trình duyệt, đi qua lớp `services/` giống như API thật (trả lời ngay, không giả độ trễ; thêm `?latency=600` vào địa chỉ để xem trạng thái đang tải). Lớp này thay được bằng Supabase (`supabase/`).
- **Đăng nhập:**
  - Khách dùng OTP cố định `246810`, không gửi email thật.
  - Nội bộ dùng mật khẩu demo `newera2026`.
  - Đăng nhập Google cho nhân sự `newera.inc` đã có (mục 3). Nút chỉ hiện khi đã điền `GOOGLE_CLIENT_ID`. Vì chưa có server, mã Google được kiểm tra ngay trong trình duyệt. Khi có backend thật, bước kiểm tra này chuyển lên server.
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
