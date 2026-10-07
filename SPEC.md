# Client Hub (tên tạm): hệ thống quản lý khách hàng, việc và báo giá của New Era

Xây một web app quản lý khách hàng theo kiểu quản lý dự án (project management). App phục vụ hai phía:

- Nội bộ New Era: Giám đốc và Account Manager (AM) quản lý toàn bộ khách hàng, lộ trình, việc, báo giá và công nợ.
- Khách hàng: phần lớn là C-level (CEO, CFO, COO, giám đốc khối). Họ đăng nhập để biết mình cần làm gì, hạn khi nào, và nếu không làm thì cái gì bị chặn.

Người dùng chính ở cả hai phía đều là C-level. Họ bận, hay xem trên điện thoại hoặc iPad, và không có thời gian học phần mềm. Bản này đặt UI/UX lên trên hết. Mở bất kỳ màn nào, người dùng phải trả lời được trong 5 giây: tình hình đang thế nào, mình cần làm gì, chỗ nào đang kẹt.

## 1. Nguyên tắc UX
1. Việc cần làm đứng đầu. Khách vừa đăng nhập là thấy việc của mình, không phải một dashboard đầy số.
2. Việc nào của khách cũng có đủ 4 thứ: làm gì (1 câu, lời thường), hạn, nếu chưa làm thì cái gì bị chặn, và 1 nút hành động chính.
3. Hệ quả phải có tên việc và có ngày. Viết "Nếu chưa duyệt trước 15/10, team New Era chưa thể lập trình phần Đặt hàng. Mốc UAT 28/10 sẽ lùi theo số ngày trễ." Không viết chung chung kiểu "có thể ảnh hưởng tiến độ".
4. Khách cũng thấy New Era đang làm gì, kể cả việc New Era đang trễ. Account nào cũng hiện "Đang chờ khách: 3 · Đang chờ New Era: 2".
5. Giám đốc chỉ cần nhìn ngoại lệ. Màn đầu tiên đưa ra những gì cần Giám đốc chú ý, không bắt Giám đốc tự đi tìm.
6. Ít chữ, ít màu, ít click. Duyệt, tải file, xác nhận: tối đa 2 click.
7. Với khách, không dùng từ nội bộ như sprint, ticket, backlog. Dùng "việc", "mốc", "giai đoạn". Giọng trung tính, không trách: viết "Đã quá hạn 3 ngày", không viết "Anh/chị đã trễ hạn".

## 2. Vai trò và quyền (RBAC)
- Giám đốc (director): thấy và sửa mọi thứ, kể cả giá vốn, biên lợi nhuận. Duyệt chiết khấu vượt ngưỡng, phân công AM, cấu hình hệ thống.
- AM (am): quản lý account được giao. Tạo mốc, việc, báo giá. Mời người dùng phía khách, nhắc khách. Chỉ thấy giá vốn khi Giám đốc cấp quyền.
- Thành viên nội bộ (member): xem và làm việc được giao. Không thấy giá vốn, biên lợi nhuận.
- Khách – Người quyết định (client_owner): thấy mọi thứ đã chia sẻ của công ty mình: tiến độ, việc, báo giá, hợp đồng, lịch thanh toán, tài liệu. Duyệt, từ chối, giao việc cho đồng nghiệp, mời đồng nghiệp (chỉ email cùng domain công ty).
- Khách – Thành viên (client_member): thấy việc được giao cho mình và tiến độ chung. Không thấy mục Thương mại.

Bảo mật: tài khoản khách chỉ đọc được dữ liệu account của mình. Giá vốn, biên lợi nhuận, ghi chú nội bộ và các việc đã tắt "Khách thấy được" không được trả về cho tài khoản khách ở tầng dữ liệu (RLS/API). Không chỉ ẩn trên giao diện.

## 3. Logic cốt lõi: việc, mốc và "chặn"
Cấu trúc: Account (khách hàng) → Dự án (1 account có thể có nhiều dự án) → Mốc (milestone) → Việc (task).

Mỗi việc có phía phụ trách: Khách hàng hoặc New Era. Việc phía khách có loại, mỗi loại có icon và nút chính riêng:
- Phê duyệt → "Xem & duyệt", kèm "Yêu cầu chỉnh sửa" (bắt buộc ghi lý do)
- Cung cấp tài liệu/dữ liệu → "Tải lên"
- Xác nhận (phạm vi, lịch họp) → "Xác nhận"
- Ký hợp đồng/phụ lục → "Tải bản đã ký"
- Thanh toán → "Báo đã chuyển khoản" (đính kèm chứng từ)
- Tham dự (workshop, UAT) → "Xác nhận tham dự"
- Trả lời câu hỏi → "Trả lời"

Mỗi việc có trường "đang chờ ai" (khách / New Era), tự đổi theo thao tác. Khách duyệt, xác nhận, trả lời thì việc xong. Khách tải file, báo đã chuyển khoản hoặc yêu cầu chỉnh sửa thì chuyển sang chờ New Era kiểm tra. New Era gửi lại bản mới thì quay về chờ khách. Bộ đếm "Đang chờ khách / Đang chờ New Era" và số việc quá hạn của mỗi phía đều lấy từ trường này.

Phụ thuộc (dependency):
- Khi tạo việc, AM chọn việc này chặn việc nào và/hoặc mốc nào, rồi viết 1–2 câu "Nếu trễ thì sao" bằng lời thường. Không cho tạo phụ thuộc vòng tròn.
- Việc bị chặn hiện icon khóa và dòng "Đang chờ: [tên việc] – [người phụ trách]". Không chuyển sang "Đang làm" được cho đến khi việc chặn xong. AM có thể "Mở chặn thủ công" nhưng phải ghi lý do, có lưu log.
- Ngày dự báo của mốc = ngày kế hoạch + N. N là số ngày trễ của việc chặn: tính đến hôm nay nếu chưa xong, hoặc đến ngày hoàn thành nếu đã xong muộn. Nhiều việc chặn thì lấy N lớn nhất. Chặn gián tiếp cũng tính (A chặn B, B chặn mốc M thì A cũng làm lùi M). Các mốc sau trong cùng dự án lùi cùng số ngày. AM sửa tay được ngày dự báo, kèm lý do.
- Luôn hiện cả hai ngày: "Kế hoạch 28/10 → Dự báo 03/11 · do chờ duyệt thiết kế 6 ngày".
- Trong chi tiết việc, vẽ chuỗi ảnh hưởng ngắn: "Duyệt thiết kế → Lập trình Đặt hàng → Mốc UAT → Go-live". Mắt xích đang kẹt tô đỏ.

Sức khỏe account (tự tính, AM được ghi đè kèm lý do):
- Đang bị chặn (đỏ): có việc quá hạn đang chặn một mốc, trực tiếp hoặc gián tiếp.
- Cần chú ý (vàng): có việc quá hạn khác, hoặc việc đang chặn mốc chỉ còn ≤ 3 ngày, hoặc có đợt thanh toán quá hạn.
- Đúng kế hoạch (xanh lá): các trường hợp còn lại.

Thứ tự hiện việc cho khách: (1) quá hạn và đang chặn mốc, (2) sắp đến hạn và đang chặn mốc, (3) quá hạn khác, (4) theo hạn gần nhất.

## 4. Phía nội bộ
### 4.1 Tổng quan Giám đốc
- 4 thẻ KPI: account đang bị chặn hoặc cần chú ý (trên tổng số đang triển khai) · việc quá hạn, tách phía khách và phía New Era · giá trị hợp đồng năm nay · phải thu, tách phần quá hạn.
- Khối "Cần chú ý hôm nay": tối đa 7 dòng, xếp theo mức độ. Mỗi dòng 1 câu và 1–2 nút. Ví dụ: "[Khách A]: Go-live đang chờ khách duyệt thiết kế, đã quá hạn 6 ngày" → [Nhắc khách] [Mở account]. "Báo giá v2 cho [Khách B] chiết khấu 15%, chờ duyệt" → [Duyệt] [Xem].
- Bảng danh mục account: khách hàng (logo + tên), AM, giai đoạn, sức khỏe, mốc tiếp theo (kế hoạch → dự báo), đang chờ ai, giá trị HĐ, phải thu, cập nhật gần nhất. Lọc nhanh bằng chip: Đang bị chặn · Chờ khách · Quá hạn thu · Theo AM. Trên iPad và mobile, bảng chuyển thành dạng thẻ.
- Chỉ 1 biểu đồ: thực thu theo tháng so với kế hoạch thu.

### 4.2 Chi tiết account
- Header cố định: logo, tên, hạng (Chiến lược / Trọng điểm / Tiêu chuẩn), giai đoạn (Tiếp cận / Đàm phán / Triển khai / Vận hành / Tạm dừng), sức khỏe, AM, giá trị HĐ. Nút "Xem như khách hàng" mở đúng giao diện khách thấy, chỉ đọc, có băng báo "Đang xem như khách hàng" và nút thoát.
- Tab Tổng quan: tóm tắt điều hành 3 dòng (AM viết, khách cũng thấy), mốc tiếp theo, việc chờ khách, việc chờ New Era, người quyết định phía khách, tóm tắt thương mại.
- Tab Việc: 3 kiểu xem là Kanban (Cần làm / Đang làm / Chờ phản hồi / Xong), Danh sách, Timeline (Gantt nhẹ theo mốc). Lọc theo phía phụ trách, người phụ trách, mốc, quá hạn, đang chặn. Việc phía New Era có công tắc "Khách thấy được", mặc định bật với việc gắn mốc.
- Tab Lộ trình: các mốc trên timeline, hiện kế hoạch và dự báo. Tạo nhanh từ mẫu, ví dụ "Triển khai phần mềm: Kickoff → Khảo sát → Thiết kế → Phát triển → UAT → Go-live → Hỗ trợ sau go-live".
- Tab Thương mại: báo giá các phiên bản, hợp đồng, lịch thanh toán. Giá vốn và biên lợi nhuận có icon khóa và nhãn "Chỉ nội bộ".
- Tab Tài liệu: file theo phiên bản, người tải lên, chế độ hiển thị (Nội bộ / Chia sẻ với khách).
- Tab Liên hệ: tên, chức danh, danh xưng (Anh/Chị), vai trò (Người quyết định / Người duyệt / Đầu mối vận hành), lần tương tác gần nhất.
- Tab Nhật ký: mọi thay đổi, mọi lần duyệt và từ chối (ai, lúc nào, nội dung gì).
- Bình luận trong việc có 2 tab: "Trả lời khách" và "Ghi chú nội bộ". Ghi chú nội bộ nền vàng nhạt, có icon khóa. Đang trả lời bình luận của khách thì mặc định "Trả lời khách", còn lại mặc định "Ghi chú nội bộ" để tránh gửi nhầm.

### 4.3 Tạo account mới
Wizard 3 bước: thông tin công ty (tên, ngành, logo, domain email) → người liên hệ và mời vào hệ thống → chọn mẫu lộ trình.

### 4.4 Việc toàn công ty
Mọi việc của mọi account, gom theo account hoặc theo người phụ trách. Có "Nhắc khách" hàng loạt cho việc quá hạn đang chờ khách.

### 4.5 Thương mại
- Bảng giá: mã, tên dịch vụ/gói, đơn vị (tháng, user, gói, man-day), đơn giá niêm yết, giá vốn (chỉ nội bộ), nhóm, trạng thái. Account có thể có đơn giá riêng đã thương lượng, ghi đè giá niêm yết.
- Báo giá: chọn dòng từ bảng giá, số lượng, chiết khấu theo dòng hoặc trên tổng, VAT chọn theo dòng, tổng tiền. Có phiên bản v1, v2… và tô sáng dòng thay đổi giữa hai bản. Trạng thái: Nháp → Chờ Giám đốc duyệt → Đã gửi khách → Khách chấp thuận / Khách đề nghị điều chỉnh / Hết hạn. Bước chờ Giám đốc duyệt chỉ xuất hiện khi tổng chiết khấu so với đơn giá áp dụng cho account vượt ngưỡng (mặc định 10%). Chưa được duyệt thì nút "Gửi khách" bị khóa, có dòng giải thích vì sao.
- Hợp đồng và lịch thanh toán: giá trị, các đợt (tỷ lệ %, số tiền, gắn với mốc nào, ngày dự kiến, trạng thái Chưa đến hạn / Đến hạn xuất hóa đơn / Đã xuất hóa đơn / Đã thu / Quá hạn). Mốc hoàn thành thì đợt gắn với mốc đó tự chuyển "Đến hạn xuất hóa đơn".
- Phải thu: tổng, quá hạn, theo từng account.

### 4.6 Cài đặt
Người dùng và vai trò, mời khách, mẫu lộ trình, bảng giá, ngưỡng chiết khấu cần duyệt, số ngày quá hạn trước khi leo thang, quy tắc thông báo.

## 5. Phía khách hàng (Client Portal)
Làm cho mobile trước (mobile-first). Desktop dùng menu trên cùng, mobile dùng thanh điều hướng dưới: Trang chủ · Việc · Tiến độ · Thương mại · Tài liệu (Thành viên không thấy Thương mại). Header có logo công ty khách cạnh logo New Era. Account có nhiều dự án thì có ô chọn dự án; trang chủ gom việc của mọi dự án, mỗi việc gắn tag dự án.

### 5.1 Trang chủ
- Lời chào theo danh xưng: "Chào anh Minh, tuần này có 2 việc cần anh xử lý."
- Băng trạng thái 1 câu, đổi theo sức khỏe:
  - Xanh: "Dự án đang chạy đúng kế hoạch."
  - Vàng: "Có 1 việc sắp đến hạn có thể làm lùi mốc UAT."
  - Đỏ: "Mốc Go-live đang chờ 1 việc từ phía anh. Mỗi ngày chậm, Go-live lùi thêm 1 ngày."
- Khối "Việc cần anh/chị xử lý": danh sách thẻ, sắp xếp như mục 3. Mỗi thẻ có:
  - Tên việc bắt đầu bằng động từ: "Duyệt thiết kế màn hình Đặt hàng"
  - Hạn: "Còn 2 ngày · 15/10" hoặc "Đã quá hạn 3 ngày"
  - Ô "Nếu chưa làm": 1–2 câu hệ quả và tag mốc bị ảnh hưởng
  - 1 nút chính theo loại việc, cộng 2 lựa chọn phụ: "Giao cho đồng nghiệp", "Hỏi lại New Era"
- Khối "Tiến độ": thanh giai đoạn (stepper) đánh dấu đang ở đâu, mốc tiếp theo kèm ngày kế hoạch và dự báo.
- Khối "New Era đang làm": 3–5 việc tuần này của New Era, việc trễ cũng hiện.
- Khối "Cập nhật mới": ai làm gì, lúc nào.
- Bố cục: desktop và iPad ngang chia 2 cột (trái 2/3 là việc cần làm; phải 1/3 là tiến độ, New Era đang làm, cập nhật). Mobile 1 cột, việc cần làm luôn đứng đầu.
- Hết việc thì hiện: "Hiện không có việc nào cần anh xử lý. Dự án đang chạy theo kế hoạch."

### 5.2 Chi tiết việc
Mở dạng khung trượt bên phải (drawer) trên desktop, toàn màn hình trên mobile. Gồm mô tả ngắn, file đính kèm (xem trước PDF/ảnh ngay trong app), ô "Nếu chưa làm" và chuỗi ảnh hưởng, nút hành động, bình luận, lịch sử. Duyệt xong hiện thông báo nhỏ (toast) "Đã duyệt. New Era đã nhận được thông báo." kèm nút Hoàn tác trong 5 giây.

### 5.3 Giao việc cho đồng nghiệp
Người quyết định chọn người trong công ty hoặc mời qua email cùng domain, thêm lời nhắn. Việc vẫn nằm trong mục "Đã giao cho người khác" của họ, có trạng thái, để theo dõi mà không phải tự làm. Việc cần đích danh Người quyết định (ví dụ chấp thuận báo giá) thì không giao được.

### 5.4 Tiến độ, Thương mại, Tài liệu
- Tiến độ: danh sách mốc, kế hoạch và dự báo, lý do nếu lùi. Có "Lịch sử phê duyệt": công ty đã duyệt gì, ai duyệt, ngày nào.
- Thương mại (chỉ Người quyết định): báo giá hiển thị như 1 trang báo giá sạch, in hoặc xuất PDF được, có nút "Chấp thuận" và "Đề nghị điều chỉnh". Báo giá cần duyệt cũng hiện thành 1 việc ở trang chủ. Có hợp đồng và lịch thanh toán; đợt đến hạn tự tạo việc "Thanh toán" (AM tắt được).
- Tài liệu: chỉ file đã chia sẻ.

### 5.5 Lần đầu đăng nhập
3 màn giới thiệu ngắn, bỏ qua được: đây là nơi anh/chị theo dõi dự án cùng New Era; việc cần anh/chị làm sẽ hiện ở trang chủ, kèm hạn và hệ quả nếu trễ; anh/chị có thể giao việc cho đồng nghiệp.

## 6. Thông báo
- Trong app (chuông) và email. Email gửi khách có link mở thẳng vào đúng việc, không đi qua trang chủ.
- Nhắc trước hạn 3 ngày và 1 ngày. Quá hạn thì nhắc tối đa 1 lần/ngày.
- Leo thang (escalation): việc đang chờ khách mà chặn mốc và quá hạn từ 3 ngày (cấu hình được) thì báo Người quyết định phía khách và Giám đốc New Era.
- Bản tin tuần lúc 8h sáng thứ Hai cho C-level hai phía: tình hình, việc đã xong, việc đang chờ mình, mốc sắp tới. Có trang xem trước bản tin trong app.
- Gom thông báo, mỗi người tối đa 1 email/ngày, trừ khi leo thang. Khách tự chọn được "chỉ nhận bản tin tuần và việc gấp".
- AM bấm "Nhắc khách" là gửi ngay và ghi log. Thẻ việc hiện "Đã nhắc 2 lần".
- "Nhắc qua Zalo": copy sẵn tin nhắn có tên người nhận, tên việc, hạn và link, rồi mở zalo.me/[số điện thoại] để AM dán và gửi.

## 7. Thiết kế giao diện
Cảm giác: sạch, yên, cao cấp. Tham khảo tinh thần Linear, Stripe Dashboard, Notion. Nhiều khoảng trắng, ít đường kẻ, chữ rõ, số nổi bật.

Màu xanh – trắng:
- Nền thẻ #FFFFFF, nền trang #F6F8FC
- Xanh chủ đạo #1D4ED8, hover #1E40AF, nền nhạt (dòng đang chọn, badge) #EEF3FF, viền xanh nhạt #C7D7FE
- Chữ chính #0F172A, chữ phụ #475569, chú thích #64748B, viền #E5E9F0
- Trạng thái (chữ/icon trên nền): xanh lá #15803D trên #ECFDF3, vàng #B45309 trên #FFF7E6, đỏ #B91C1C trên #FEF2F2
- Ghi chú nội bộ: nền #FFFBEB, viền #FDE68A
- Tỷ lệ khoảng 80% trắng và nền sáng, 15% xanh, 5% màu trạng thái. Màu trạng thái chỉ dùng cho trạng thái và luôn đi kèm icon và chữ.

Chữ: Be Vietnam Pro (hiển thị dấu tiếng Việt tốt), dự phòng Inter, system-ui. Body 15–16px, bảng 14px, số KPI 28–32px semibold. Số dùng tabular-nums.

Thành phần: card bo 12px, nút bo 8px, shadow rất nhẹ, lưới 8px. Icon lucide. Chi tiết mở bằng drawer. Hộp thoại xác nhận (dialog) chỉ dùng cho thao tác không hoàn tác được. Đang tải dùng skeleton, không dùng spinner toàn trang. Màn nào cũng có trạng thái rỗng viết bằng câu tự nhiên. Phía nội bộ có tìm nhanh Ctrl/Cmd + K.

Định dạng: tiền VND dùng dấu chấm ngăn nghìn (1.250.000.000 ₫), thẻ KPI dùng dạng gọn (1,25 tỷ ₫). Ngày dd/mm/yyyy, kèm thời gian tương đối ("còn 2 ngày").

Responsive: 375px (điện thoại), 768–1024px (iPad, C-level dùng nhiều), từ 1280px (desktop). Không vỡ layout, không cuộn ngang trừ bảng.

Truy cập: tương phản đạt WCAG AA, dùng được bằng bàn phím, viền focus rõ, vùng bấm trên mobile tối thiểu 44px.

Ngôn ngữ: tiếng Việt mặc định. Tách toàn bộ text ra file ngôn ngữ (i18n) để sau thêm tiếng Anh. Với khách, xưng hô theo danh xưng đã lưu.

Tránh: gradient lòe loẹt, shadow đậm, quá nhiều sắc xanh trong một thẻ, bảng dày đặc ở phía khách, pop-up chen ngang.

## 8. Kỹ thuật
- React + TypeScript + Tailwind CSS + shadcn/ui, lucide-react, Recharts.
- Nếu có Supabase: Auth (khách đăng nhập bằng email OTP hoặc magic link, không mật khẩu; nội bộ dùng email/mật khẩu hoặc Google), Postgres + RLS theo account, Storage cho tài liệu. Nếu chưa có backend: chạy bằng mock data qua một lớp service riêng để sau thay bằng API thật.
- Ghi nhớ thiết bị để C-level không phải đăng nhập lại liên tục.
- Múi giờ Asia/Ho_Chi_Minh. Việc tính là quá hạn sau 23:59 của ngày hạn.
- Xóa mềm (deleted_at) cho các bảng chính.
- Chế độ demo: màn đăng nhập có nút vào nhanh theo vai trò (Giám đốc, AM, Khách – Người quyết định, Khách – Thành viên).

Dữ liệu chính:
- users: full_name, email, phone, org_type (internal/client), account_id, role, can_view_cost
- accounts: name, logo_url, industry, tier, stage, am_id, health_auto, health_override, health_override_reason, exec_summary, email_domain
- contacts: account_id, full_name, salutation (anh/chị), title, decision_role, email, phone, user_id
- projects: account_id, name, start_date, end_date
- milestones: project_id, name, order_no, planned_date, forecast_date, forecast_override_reason, status, client_visible
- tasks: project_id, milestone_id, title, description, side (client/internal), type, assignee_id, delegated_by, requires_owner, waiting_on (client/internal), due_date, status, impact_text, client_visible, reminder_count, last_reminded_at, manual_unblock_reason, completed_at
- task_dependencies: task_id (việc chặn), blocks_task_id, blocks_milestone_id
- comments: task_id, author_id, body, visibility (internal/shared)
- files: account_id, task_id, name, version, storage_path, visibility, uploaded_by
- price_items: code, name, unit, list_price, cost_price, category, active
- account_prices: account_id, price_item_id, negotiated_price
- quotes: account_id, version, status, valid_until, discount_pct_total, director_approved_by, sent_at, client_decision, client_decided_by, client_decided_at, client_note
- quote_lines: quote_id, price_item_id, qty, unit_price, discount_pct, vat_rate
- contracts: account_id, quote_id, value, signed_date
- payment_schedules: contract_id, name, percent, amount, milestone_id, due_date, status
- activities (nhật ký), notifications, project_templates, settings

## 9. Dữ liệu mẫu
6 khách hàng hư cấu (không dùng tên công ty thật) thuộc bán lẻ, ngân hàng, sản xuất, năng lượng, bất động sản, logistics. Mỗi account có 1–2 dự án, 5–7 mốc, 15–25 việc, tên người Việt. Phải có đủ các tình huống:
- 1 account đang bị chặn: khách chưa duyệt thiết kế, quá hạn 6 ngày, Go-live dự báo lùi 6 ngày
- 1 account có báo giá v2 chiết khấu 15% đang chờ Giám đốc duyệt
- 1 account có đợt thanh toán quá hạn
- 1 account mà New Era đang trễ việc
- 1 account có Người quyết định đã giao việc cho đồng nghiệp
- 1 account đúng kế hoạch, không có việc chờ khách

## 10. Thứ tự build
1. Design tokens, layout hai phía, chế độ demo, dữ liệu mẫu
2. Trang chủ khách hàng, thẻ việc, drawer chi tiết việc
3. Logic chặn, ngày dự báo, sức khỏe account
4. Tổng quan Giám đốc, chi tiết account, các kiểu xem việc
5. Thương mại: bảng giá, báo giá, duyệt chiết khấu, lịch thanh toán
6. Thông báo, nhắc, leo thang, bản tin tuần
7. Hoàn thiện: trạng thái rỗng, skeleton, responsive, bàn phím

Xong mỗi bước, tự kiểm tra với mục 11 rồi mới làm tiếp.

## 11. Nghiệm thu
- [ ] Khách C-level mở trên điện thoại, trong 5 giây thấy: tình hình dự án, có mấy việc cần làm, việc nào đang chặn mốc nào.
- [ ] Mọi việc phía khách đều có hạn, câu "Nếu chưa làm" và 1 nút chính.
- [ ] Việc chặn mốc bị quá hạn thì mốc hiện ngày dự báo mới kèm lý do, các mốc sau lùi theo.
- [ ] Việc bị chặn không chuyển trạng thái được, trừ khi AM mở chặn có ghi lý do.
- [ ] Tài khoản khách không nhận được giá vốn, biên lợi nhuận, ghi chú nội bộ. Kiểm tra cả dữ liệu trả về, không chỉ UI.
- [ ] Báo giá chiết khấu vượt ngưỡng không gửi được cho khách khi chưa có Giám đốc duyệt.
- [ ] "Xem như khách hàng" hiển thị đúng những gì khách thấy.
- [ ] Giám đốc lọc được ngay: account bị chặn, đang chờ khách, quá hạn thu.
- [ ] Mọi lần duyệt, từ chối đều có log: ai, lúc nào.
- [ ] Hiển thị tốt ở 375px, iPad và desktop. Tiền theo VND, ngày dd/mm/yyyy.

## 12. Chưa làm ở bản này
Chat realtime, ký điện tử, hóa đơn điện tử, Zalo OA/ZNS, app native, AI tóm tắt, xuất báo cáo tình hình 1 trang. Thiết kế chừa chỗ để thêm sau.
