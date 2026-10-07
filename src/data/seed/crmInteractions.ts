// CRM seed — interactions over the last 60 days (calls, meetings, emails, demos, Zalo, notes).
// Consistency rules (checked by crmChecks.ts):
// · a lead's last_contacted_at = its latest interaction; the latest interaction's follow-up = the lead's follow-up;
// · an open opportunity's next_step_date = the follow-up of its latest interaction;
// · an existing contact's last_interaction_at is never older than an interaction linked to it — the newest ones
//   below repeat exactly the last touchpoint already stored on the contact (same instant, same note).

import type { ID } from '@/domain/types';
import type { Interaction, InteractionKind, InteractionOutcome } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { AM_DUCANH, AM_HA, DIRECTOR, PROSPECTS } from './crmAccounts';
import { ECOSYSTEM_LEAD_IDS as ECO } from './ecosystems';

interface Links {
  account?: ID;
  lead?: ID;
  opp?: ID;
  contact?: ID;
}

/** [id, kind, day offset, hh:mm, owner, links, subject, summary, outcome, follow-up day offset | null] */
type Row = [ID, InteractionKind, number, string, ID, Links, string, string, InteractionOutcome | null, number | null];

const SB = PROSPECTS.saobac;
const HV = PROSPECTS.hoangvu;
const VX = PROSPECTS.vanxuan;

const ROWS: Row[] = [
  // ───────── leads
  ['ix_hopphat_1', 'call', -3, '10:30', AM_HA, { lead: 'lead_hopphat' }, 'Gọi giới thiệu sau hội thảo ngân hàng số', 'Chị Yến quan tâm cách New Era làm cổng ngân hàng số cho Thịnh An. Chị đồng ý nhận hồ sơ năng lực và hẹn gọi lại trong tuần.', 'positive', 2],
  ['ix_bennghe_1', 'email', -12, '09:15', AM_DUCANH, { lead: 'lead_bennghe' }, 'Gửi hồ sơ năng lực và câu chuyện Mây Trắng', 'Đã gửi hồ sơ năng lực và kết quả triển khai TMS tại Mây Trắng. Anh Phát chưa phản hồi, cần gọi lại.', 'neutral', -2],
  ['ix_hongphuc_1', 'call', -20, '14:00', AM_HA, { lead: 'lead_hongphuc' }, 'Gọi làm quen theo giới thiệu của chị Hương', 'Anh Tùng cần app đặt lịch khám trước quý 1 năm sau và muốn xem ví dụ app y tế đã làm.', 'positive', 0],
  ['ix_songhau_1', 'meeting', -5, '10:00', AM_DUCANH, { lead: 'lead_songhau' }, 'Gặp tại triển lãm thực phẩm', 'Anh Trí đang tìm giải pháp truy xuất nguồn gốc cho hàng xuất khẩu. Cần gửi tài liệu và hẹn lịch thăm nhà máy.', 'neutral', 4],
  ['ix_thanhloi_1', 'email', -40, '08:45', AM_HA, { lead: 'lead_thanhloi' }, 'Gửi thư giới thiệu giải pháp quản lý sản xuất', 'Chị Hoa phản hồi đang lập ngân sách năm sau, hẹn trao đổi lại sau khi chốt kế hoạch.', 'neutral', 20],
  ['ix_anhduong_1', 'call', -15, '16:00', AM_DUCANH, { lead: 'lead_anhduong' }, 'Gọi theo giới thiệu của anh Bình (Mây Trắng)', 'Anh Thịnh muốn đồng bộ tồn kho giữa siêu thị và website trước mùa mua sắm Tết. Anh đồng ý xem demo.', 'positive', -2],
  ['ix_anhduong_2', 'demo', -2, '14:00', AM_DUCANH, { lead: 'lead_anhduong' }, 'Demo bán hàng đa kênh cho ban giám đốc Ánh Dương', 'Ban giám đốc thích phần đồng bộ tồn kho và khuyến mãi. Anh Thịnh hẹn trả lời về ngân sách trong hôm nay.', 'positive', 0],
  ['ix_hunglong_1', 'email', -18, '09:00', AM_HA, { lead: 'lead_hunglong' }, 'Gửi đề xuất sơ bộ CRM cho đại lý', 'Đã gửi đề xuất sơ bộ và ví dụ báo cáo doanh thu theo ngày. Anh Mạnh chuyển cho khối kinh doanh xem.', 'neutral', -7],
  ['ix_hunglong_2', 'meeting', -6, '14:30', AM_HA, { lead: 'lead_hunglong' }, 'Họp với khối kinh doanh Hưng Long', 'Khối kinh doanh đồng ý với hướng đi, cần New Era gửi lộ trình triển khai theo từng miền.', 'positive', -1],
  ['ix_hanhlam_1', 'call', -25, '10:00', AM_HA, { lead: 'lead_hanhlam' }, 'Gọi lại sau khi chị Uyên điền form website', 'Chị Uyên kể trình dược viên đang báo cáo bằng Zalo và bảng tính. Hai bên hẹn lịch demo.', 'positive', -9],
  ['ix_hanhlam_2', 'demo', -9, '15:00', AM_HA, { lead: 'lead_hanhlam' }, 'Demo app cho trình dược viên', 'Chị Uyên thấy phù hợp, muốn thêm bước duyệt chiết khấu cho đơn lớn và sẽ gửi danh sách yêu cầu chi tiết.', 'positive', 3],
  ['ix_hoakhanh_1', 'demo', -11, '09:30', AM_DUCANH, { lead: 'lead_hoakhanh' }, 'Demo theo dõi sản lượng dây chuyền', 'Anh Quý đánh giá cao phần cảnh báo dừng máy và muốn tham quan Thiên Trường để xem hệ thống chạy thật.', 'positive', -4],
  ['ix_hoakhanh_2', 'call', -4, '16:30', AM_DUCANH, { lead: 'lead_hoakhanh' }, 'Gọi chốt lịch tham quan Thiên Trường', 'Thiên Trường có thể đón đoàn sau mốc UAT. Anh Quý đồng ý dời lịch tham quan.', 'neutral', 9],
  ['ix_mamson_1', 'meeting', -8, '11:00', AM_HA, { lead: 'lead_mamson' }, 'Gặp chị Diệp tại nhà hàng mẫu', 'Chị Diệp muốn bắt đầu với đặt bàn và gọi món tại bàn ở 3 nhà hàng; ngân sách năm nay có hạn.', 'positive', 12],
  ['ix_giadinh_1', 'email', -50, '10:00', AM_DUCANH, { lead: 'lead_giadinh' }, 'Gửi tài liệu bán hàng đa kênh', 'Anh Kiệt đã nhận tài liệu nhưng đang bận triển khai ERP với đơn vị khác.', 'neutral', -35],
  ['ix_giadinh_2', 'call', -35, '15:00', AM_DUCANH, { lead: 'lead_giadinh' }, 'Gọi hỏi thăm tiến độ ERP', 'ERP của Gia Định dự kiến go-live quý sau. Anh Kiệt hẹn liên hệ lại sau go-live.', 'neutral', 25],
  ['ix_doson_1', 'email', -45, '09:00', AM_HA, { lead: 'lead_doson' }, 'Gửi thư giới thiệu sau hội thảo Hải Phòng', 'Anh Khải cảm ơn nhưng ngân sách năm nay đã dùng cho máy móc mới.', 'neutral', null],
  ['ix_anhsao_1', 'call', -28, '10:30', AM_DUCANH, { lead: 'lead_anhsao' }, 'Gọi tư vấn app học tập', 'Chị Oanh cần giải pháp gọn nhẹ với ngân sách nhỏ. Đã gợi ý chờ gói chuẩn hóa vào năm sau.', 'neutral', 40],
  ['ix_donghung_1', 'meeting', -55, '14:00', DIRECTOR, { lead: 'lead_donghung' }, 'Anh Nam gặp anh Nghĩa tại hội nghị ngân hàng', 'Đông Hưng muốn xây kho dữ liệu khách hàng nhưng ngân sách công nghệ năm sau chưa được duyệt.', 'neutral', 18],
  ['ix_taydo_1', 'call', -22, '09:00', AM_DUCANH, { lead: 'lead_taydo' }, 'Gọi tìm hiểu nhu cầu giám sát trang trại', 'Quy mô nhỏ, anh Tâm chỉ cần phần mềm đóng gói có sẵn với ngân sách dưới 300 triệu.', 'negative', null],
  ['ix_phucloc_1', 'call', -33, '10:00', AM_HA, { lead: 'lead_phucloc' }, 'Gọi giới thiệu CRM cho đội môi giới', 'Phúc Lộc vừa ký với nhà cung cấp khác trong năm nay. Anh Trường hẹn liên hệ lại sau 2 năm.', 'negative', null],
  // sister companies of customers (ecosystems.ts)
  ['ix_cxfoods_1', 'meeting', -18, '14:00', AM_HA, { lead: ECO.coxanhFoods }, 'Gặp anh Khải theo giới thiệu của anh Minh', 'Anh Khải muốn đơn hàng từ 1.200 điểm bán và từ chuỗi siêu thị Cỏ Xanh về chung một hệ thống. Hai bên hẹn demo phần đồng bộ đơn.', 'positive', -6],
  ['ix_cxfoods_2', 'demo', -6, '10:00', AM_HA, { lead: ECO.coxanhFoods }, 'Demo đồng bộ đơn hàng giữa nhà máy và siêu thị', 'Ban điều hành thích việc dùng lại dữ liệu khách hàng của App bán hàng Cỏ Xanh. Anh Khải sẽ gửi danh sách điểm bán để New Era ước tính phạm vi.', 'positive', 5],
  ['ix_cxlogistics_1', 'call', -7, '15:30', AM_DUCANH, { lead: ECO.coxanhLogistics }, 'Gọi làm quen theo gợi ý của chị Hà', 'Anh Danh muốn xem cách Mây Trắng điều phối xe. Đã hẹn gửi tài liệu và gọi lại sau khi anh rà nhu cầu của 2 kho.', 'neutral', 3],
  ['ix_tasec_1', 'meeting', -4, '10:00', AM_HA, { lead: ECO.thinhanSecurities }, 'Gặp anh Quân tại hội sở Thịnh An', 'Anh Quân đã xem cổng ngân hàng số New Era làm cho Thịnh An và muốn ứng dụng giao dịch dùng chung đăng nhập. Hẹn gửi đề xuất sơ bộ.', 'positive', 6],
  ['ix_ngannang_1', 'call', -24, '10:30', AM_DUCANH, { lead: ECO.ngannang }, 'Gọi theo giới thiệu của chị Phương (Gió Ngàn)', 'Chị Mai muốn xem màn hình sản lượng đang làm cho Gió Ngàn và hỏi khả năng gộp dữ liệu 4 trang trại điện mặt trời.', 'positive', -12],
  ['ix_ngannang_2', 'demo', -12, '14:00', AM_DUCANH, { lead: ECO.ngannang }, 'Demo giám sát sản lượng cho ban vận hành Ngàn Nắng', 'Ban vận hành thích cảnh báo sụt công suất theo từng dãy tấm pin. Chị Mai chờ Gió Ngàn qua mốc UAT rồi mới trình phương án mở rộng.', 'positive', 8],
  ['ix_nganphong_1', 'meeting', -13, '09:00', AM_DUCANH, { lead: ECO.nganphong }, 'Gặp anh Toàn tại công trường điện gió Ninh Thuận', 'Đội thi công đang báo cáo tiến độ bằng ảnh qua Zalo. Anh Toàn muốn một ứng dụng nghiệm thu có ảnh hiện trường và ký xác nhận.', 'neutral', 4],
  ['ix_sbfoods_1', 'meeting', -27, '10:00', AM_HA, { lead: ECO.saobacFoods }, 'Thăm nhà máy Thực phẩm Sao Bắc', 'Anh Tuấn cần truy xuất nguồn gốc cho hàng nhãn riêng bán ở 40 siêu thị Sao Bắc và lập kế hoạch sản xuất theo đơn của chuỗi.', 'positive', -10],
  ['ix_sbfoods_2', 'email', -10, '16:30', AM_HA, { lead: ECO.saobacFoods }, 'Gửi đề xuất truy xuất nguồn gốc hàng nhãn riêng', 'Đã gửi đề xuất sơ bộ. Anh Tuấn muốn chờ Sao Bắc chốt nền tảng bán hàng để hai hệ thống dùng chung mã hàng.', 'neutral', 10],
  ['ix_sbland_1', 'call', -2, '11:00', AM_HA, { lead: ECO.saobacLand }, 'Gọi làm quen theo gợi ý của chị Trang', 'Anh Khánh quan tâm CRM cho đội cho thuê mặt bằng nhưng muốn đợi Sao Bắc chốt nền tảng bán hàng trước.', 'neutral', 12],
  // converted leads, before the conversion (convertLead links these touchpoints to the new account too)
  ['ix_saobac_lead_1', 'meeting', -58, '15:00', DIRECTOR, { lead: SB.lead, account: SB.account }, 'Gặp chị Trang tại hội chợ bán lẻ', 'Sao Bắc muốn thay hệ thống bán hàng cũ trước mùa Tết. Chị Trang đồng ý xem demo.', 'positive', -50],
  ['ix_saobac_lead_2', 'demo', -50, '09:30', AM_HA, { lead: SB.lead, account: SB.account }, 'Demo nền tảng bán hàng đa kênh', 'Ban giám đốc Sao Bắc thích phần đồng bộ tồn kho và khuyến mãi theo vùng, đồng ý khảo sát 3 siêu thị mẫu.', 'positive', -45],
  ['ix_hoangvu_lead_1', 'call', -40, '10:00', AM_DUCANH, { lead: HV.lead, account: HV.account }, 'Gọi giới thiệu giải pháp điều phối xe', 'Anh Lộc từng dùng thử một phần mềm nhưng tài xế không quen. Anh đồng ý nghe giới thiệu thêm.', 'neutral', -26],
  ['ix_hoangvu_lead_2', 'meeting', -26, '14:00', AM_DUCANH, { lead: HV.lead, account: HV.account }, 'Gặp anh Lộc tại văn phòng Bình Dương', 'Hoàng Vũ cần điều phối 300 xe và app tài xế thật đơn giản. Anh Lộc đồng ý mở khảo sát chính thức.', 'positive', -24],
  ['ix_vanxuan_lead_1', 'email', -16, '09:00', AM_HA, { lead: VX.lead, account: VX.account }, 'Phản hồi yêu cầu tư vấn từ website', 'Đã gửi tài liệu quản lý chuỗi nhà thuốc. Chị Ngọc hẹn gọi trao đổi chi tiết.', 'positive', -8],
  ['ix_vanxuan_lead_2', 'call', -8, '10:00', AM_HA, { lead: VX.lead, account: VX.account }, 'Gọi tìm hiểu nhu cầu chuỗi nhà thuốc', 'Vạn Xuân cần quản lý tồn kho theo lô và hạn dùng cho 65 nhà thuốc, muốn chạy thử ở 5 nhà thuốc trước.', 'positive', -4],

  // ───────── prospects (after the conversion)
  ['ix_saobac_1', 'meeting', -38, '09:00', AM_HA, { account: SB.account, opp: SB.opportunity, contact: 'ct_saobac_trang' }, 'Khảo sát quy trình bán hàng tại 3 siêu thị mẫu', 'Đã khảo sát quầy thu ngân, kho và khuyến mãi tại 3 siêu thị. Chị Trang muốn ưu tiên đồng bộ tồn kho.', 'positive', -25],
  ['ix_saobac_2', 'email', -25, '16:00', AM_HA, { account: SB.account, opp: SB.opportunity, contact: 'ct_saobac_huy' }, 'Gửi đề xuất giải pháp và báo giá sơ bộ', 'Đã gửi đề xuất cho 40 siêu thị kèm báo giá sơ bộ. Anh Huy hỏi thêm về kết nối với phần mềm kế toán hiện tại.', 'neutral', -8],
  ['ix_saobac_3', 'meeting', -8, '14:00', DIRECTOR, { account: SB.account, opp: SB.opportunity, contact: 'ct_saobac_trang' }, 'Đàm phán điều khoản với ban giám đốc Sao Bắc', 'Hai bên thống nhất phạm vi. Chị Trang muốn chia thanh toán thành 4 đợt và giảm đợt đầu.', 'positive', -1],
  ['ix_hoangvu_1', 'meeting', -15, '09:30', AM_DUCANH, { account: HV.account, opp: HV.opportunity, contact: 'ct_hoangvu_loc' }, 'Khảo sát nhu cầu điều phối xe', 'Đã ghi nhận quy trình nhận đơn, ghép chuyến và đối soát cước. Anh Lộc muốn xem bãi xe thực tế trước khi chốt phạm vi.', 'positive', -6],
  ['ix_hoangvu_2', 'zalo', -6, '11:20', AM_DUCANH, { account: HV.account, opp: HV.opportunity, contact: 'ct_hoangvu_han' }, 'Gửi lịch khảo sát bãi xe', 'Đã gửi chị Hân 2 phương án lịch khảo sát bãi xe Bình Dương, chờ anh Lộc chọn ngày.', 'neutral', 4],
  ['ix_vanxuan_1', 'note', -3, '17:00', AM_HA, { account: VX.account, opp: VX.opportunity }, 'Ghi chú sau khi chuyển thành cơ hội', 'Chị Ngọc muốn chạy thử ở 5 nhà thuốc trước. Cần chuẩn bị tài liệu giới thiệu và đề xuất lịch khảo sát.', null, 1],

  // ───────── existing customers
  ['ix_thinhan_1', 'meeting', -28, '10:00', AM_HA, { account: 'acc_thinhan', opp: 'opp_thinhan_p2', contact: 'ct_thinhan_long' }, 'Trao đổi phạm vi giai đoạn 2 với anh Long', 'Anh Long muốn mở rộng sang phân hệ tín dụng doanh nghiệp ngay sau giai đoạn 1 và cần báo giá trong 2 tuần.', 'positive', -16],
  ['ix_thinhan_2', 'call', -10, '17:00', AM_HA, { account: 'acc_thinhan', opp: 'opp_thinhan_p2', contact: 'ct_thinhan_long' }, 'Anh Long phản hồi báo giá bản 1', 'Anh Long đề nghị giảm ngày công lập trình, tăng ưu đãi bản quyền và bổ sung đào tạo cho chi nhánh.', 'neutral', -2],
  ['ix_thinhan_3', 'call', -3, '15:00', AM_HA, { account: 'acc_thinhan', opp: 'opp_thinhan_p2', contact: 'ct_thinhan_long' }, 'Trao đổi về báo giá giai đoạn 2', 'Trao đổi về báo giá giai đoạn 2; anh muốn bổ sung đào tạo cho chi nhánh. New Era sẽ gửi bản 2 trong tuần.', 'positive', 0],
  ['ix_thinhan_4', 'note', -1, '09:45', AM_HA, { account: 'acc_thinhan', opp: 'opp_thinhan_p2' }, 'Đã trình Giám đốc duyệt báo giá bản 2', 'Chiết khấu hiệu lực vượt ngưỡng nên cần anh Nam duyệt trước khi gửi anh Long.', null, 0],
  ['ix_coxanh_1', 'meeting', -12, '14:00', AM_HA, { account: 'acc_coxanh', opp: 'opp_coxanh_ext', contact: 'ct_coxanh_minh' }, 'Anh Minh chia sẻ kế hoạch mở rộng đội bán hàng', 'Cỏ Xanh sẽ thêm 20 nhân viên bán hàng miền Nam từ tháng tới. Anh Minh muốn giữ đơn giá bản quyền ưu đãi.', 'positive', -3],
  ['ix_coxanh_2', 'call', -2, '09:05', AM_HA, { account: 'acc_coxanh', contact: 'ct_coxanh_minh' }, 'Gọi nhắc duyệt thiết kế màn hình Đặt hàng', 'Gọi nhắc duyệt thiết kế màn hình Đặt hàng; anh hẹn phản hồi sau họp ban điều hành.', 'neutral', null],
  ['ix_coxanh_3', 'email', -2, '15:35', AM_HA, { account: 'acc_coxanh', opp: 'opp_coxanh_ext' }, 'Gửi phụ lục mở rộng 20 người dùng', 'Báo giá phụ lục đã gửi qua Client Hub, giữ đơn giá ưu đãi của hợp đồng khung.', 'neutral', 3],
  ['ix_maytrang_1', 'meeting', -10, '15:00', AM_DUCANH, { account: 'acc_maytrang', contact: 'ct_maytrang_binh' }, 'Họp rà soát vận hành lần 1', 'Họp rà soát vận hành lần 1; anh hài lòng với tỷ lệ giao đúng hẹn. Anh Bình hỏi về nâng cấp hạ tầng cho mùa cao điểm cuối năm.', 'positive', null],
  ['ix_maytrang_2', 'call', -5, '10:00', AM_DUCANH, { account: 'acc_maytrang', opp: 'opp_maytrang_infra', contact: 'ct_maytrang_hanh' }, 'Trao đổi cấu hình hạ tầng mùa cao điểm', 'Chị Hạnh dự kiến số đơn tăng gấp 3 dịp cuối năm. Cần đề xuất nâng cấp máy chủ và hỗ trợ 24/7.', 'positive', 2],
  ['ix_maytrang_3', 'email', -42, '09:00', AM_DUCANH, { account: 'acc_maytrang', opp: 'opp_maytrang_wh', contact: 'ct_maytrang_binh' }, 'Anh Bình báo hoãn phân hệ kho', 'Mây Trắng hoãn đầu tư phân hệ kho sang năm sau để tập trung cho mùa cao điểm.', 'negative', null],
  ['ix_haidang_1', 'meeting', -14, '14:00', AM_HA, { account: 'acc_haidang', opp: 'opp_haidang_app', contact: 'ct_haidang_khang' }, 'Anh Khang muốn app cho khách mua căn hộ', 'Hải Đăng muốn khách mua căn hộ theo dõi tiến độ thanh toán và bàn giao trên điện thoại. Hẹn khảo sát sau mốc Thiết kế.', 'positive', 9],
  ['ix_haidang_2', 'call', -1, '11:30', AM_HA, { account: 'acc_haidang', opp: 'opp_haidang_training', contact: 'ct_haidang_khang' }, 'Anh Khang gửi danh sách dự án và bảng giá', 'Đã gửi danh sách dự án và bảng giá. Anh Khang hỏi lịch đào tạo đội kinh doanh theo ca.', 'neutral', 1],
  ['ix_thientruong_1', 'meeting', -6, '10:00', AM_DUCANH, { account: 'acc_thientruong', opp: 'opp_thientruong_support', contact: 'ct_thientruong_hung' }, 'Báo cáo tiến độ lập trình với anh Hùng', 'Báo cáo tiến độ lập trình; anh đề nghị ưu tiên kết nối máy CNC. Anh Hùng sẽ xem gói hỗ trợ sau go-live khi thanh toán xong đợt 2.', 'neutral', -3],
  ['ix_giongan_1', 'call', -1, '10:00', AM_DUCANH, { account: 'acc_giongan', contact: 'ct_giongan_phuong' }, 'Báo trước việc tích hợp SCADA chậm', 'Báo trước việc tích hợp SCADA chậm và kế hoạch bù; chị đồng ý theo dõi đến cuối tuần.', 'neutral', null],
  ['ix_giongan_2', 'demo', -45, '14:00', AM_DUCANH, { account: 'acc_giongan', opp: 'opp_giongan_mobile', contact: 'ct_giongan_tai' }, 'Demo ứng dụng cho kỹ sư hiện trường', 'Anh Tài thích phần ghi nhận sự cố có ảnh và đề nghị báo giá cho 60 kỹ sư.', 'positive', -30],
  ['ix_giongan_3', 'meeting', -27, '15:00', AM_DUCANH, { account: 'acc_giongan', opp: 'opp_giongan_mobile', contact: 'ct_giongan_phuong' }, 'Chị Phương phản hồi về ứng dụng hiện trường', 'Gió Ngàn chọn ứng dụng có sẵn của hãng tua-bin vì chi phí thấp hơn và đã kèm bảo hành.', 'negative', null],
];

export function buildInteractions(c: SeedCtx): Interaction[] {
  return ROWS.map(([id, kind, day, hhmm, owner, l, subject, summary, outcome, follow]) => {
    const at = c.at(day, hhmm);
    return {
      id,
      kind,
      occurred_at: at,
      subject,
      summary,
      outcome,
      account_id: l.account ?? null,
      lead_id: l.lead ?? null,
      opportunity_id: l.opp ?? null,
      contact_id: l.contact ?? null,
      owner_id: owner,
      next_follow_up_date: follow === null ? null : c.d(follow),
      created_at: at,
      deleted_at: null,
    };
  });
}
