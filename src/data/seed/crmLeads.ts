// CRM seed — leads ("khách hàng mục tiêu"): invented Vietnamese mid/large companies.
// Mix: 6 new · 9 contacted · 8 interested · 4 nurturing · 2 disqualified · 3 converted (→ the prospect accounts).
// 7 of them are sister companies of existing customers (ecosystems.ts: Cỏ Xanh, Thịnh An, Gió Ngàn, Sao Bắc groups).
// last_contacted_at is derived from the interactions in crm.ts; follow-up dates are relative to today.
// ecosystem_id is stamped by crm.ts from ecosystems.ts.

import type { ID, ISODateTime, Salutation } from '@/domain/types';
import type { CompanySize, Lead, LeadSource, LeadStatus, RevenueBand } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { AM_DUCANH, AM_HA, PROSPECTS } from './crmAccounts';
import { ECOSYSTEM_LEAD_IDS as ECO } from './ecosystems';

interface LeadSpec {
  id: ID;
  company: string;
  industry: string;
  province: string;
  size: CompanySize;
  revenue: RevenueBand;
  website: string;
  /** [full name, title, salutation, email, phone] */
  contact: [string, string, Salutation, string, string | null];
  source: LeadSource;
  owner: ID | null;
  status: LeadStatus;
  tags: string[];
  need: string;
  budget: number | null;
  notes?: string;
  reason?: string;
  /** day offset of the next follow-up (open leads only) */
  follow?: number;
  /** [day offset, hh:mm] the lead was created */
  created: [number, string];
  /** [day offset, hh:mm] of the last status change (disqualified / converted) */
  statusAt?: [number, string];
  converted?: { account: ID; opportunity: ID };
}

const SPECS: LeadSpec[] = [
  // ── new (5 in the team pool, 1 assigned) — no interaction yet
  { id: 'lead_phoxanh', company: 'Chuỗi cửa hàng tiện lợi Phố Xanh', industry: 'Bán lẻ', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'phoxanhmart.vn', contact: ['Nguyễn Gia Bảo', 'Giám đốc vận hành', 'anh', 'bao.nguyen@phoxanhmart.vn', '0908 315 742'], source: 'website', owner: null, status: 'new', tags: ['Omnichannel', 'Mobile app'], need: 'Muốn có app tích điểm và đặt hàng giao nhanh cho 120 cửa hàng tiện lợi.', budget: 1_800_000_000, notes: 'Để lại thông tin qua form trên website. Phố Xanh là chuỗi cửa hàng tiện lợi của Tập đoàn Cỏ Xanh.', created: [-3, '08:40'] },
  { id: 'lead_donghai', company: 'Nhựa Đông Hải', industry: 'Sản xuất', province: 'Hải Phòng', size: '200_1000', revenue: '200b_1t', website: 'nhuadonghai.com.vn', contact: ['Phạm Văn Hiếu', 'Phó Tổng giám đốc', 'anh', 'hieu.pham@nhuadonghai.com.vn', '0912 604 159'], source: 'event', owner: null, status: 'new', tags: ['ERP'], need: 'Cần theo dõi đơn hàng và kế hoạch sản xuất cho 2 nhà máy thay cho bảng tính.', budget: 2_200_000_000, notes: 'Gặp tại hội thảo chuyển đổi số ngành sản xuất.', created: [-9, '16:00'] },
  { id: 'lead_tueduc', company: 'Hệ thống trường Tuệ Đức', industry: 'Giáo dục', province: 'Đà Nẵng', size: '200_1000', revenue: '50_200b', website: 'tueduc.edu.vn', contact: ['Hồ Thanh Tâm', 'Phó Hiệu trưởng', 'chị', 'tam.ho@tueduc.edu.vn', '0935 418 260'], source: 'website', owner: null, status: 'new', tags: ['Mobile app'], need: 'Muốn có app liên lạc giữa nhà trường và phụ huynh cho 6 cơ sở.', budget: 450_000_000, created: [-2, '14:20'] },
  { id: 'lead_nhanhoa', company: 'Bảo hiểm Nhân Hòa', industry: 'Bảo hiểm', province: 'Hà Nội', size: 'gt1000', revenue: 'gt1t', website: 'baohiemnhanhoa.vn', contact: ['Kiều Minh Đức', 'Giám đốc khối Vận hành', 'anh', 'duc.kieu@baohiemnhanhoa.vn', '0904 772 316'], source: 'referral', owner: null, status: 'new', tags: ['Chuyển đổi số', 'Data'], need: 'Cần số hóa quy trình bồi thường, rút thời gian xử lý hồ sơ từ 10 ngày xuống 3 ngày.', budget: 3_500_000_000, notes: 'Anh Long (Thịnh An) giới thiệu. Nhân Hòa là công ty bảo hiểm thuộc Tập đoàn Tài chính Thịnh An.', created: [-12, '11:00'] },
  { id: 'lead_moclan', company: 'Cà phê Mộc Lan', industry: 'F&B', province: 'Cần Thơ', size: '50_200', revenue: '50_200b', website: 'caphemoclan.vn', contact: ['Trương Mỹ Duyên', 'Chủ chuỗi', 'chị', 'duyen.truong@caphemoclan.vn', '0939 205 481'], source: 'website', owner: null, status: 'new', tags: ['Mobile app'], need: 'Muốn có app đặt món và tích điểm cho 18 quán.', budget: 300_000_000, created: [-1, '21:15'] },
  { id: 'lead_thuanthanh', company: 'Phân phối Thuận Thành', industry: 'Phân phối', province: 'Đồng Nai', size: '200_1000', revenue: '200b_1t', website: 'thuanthanh.com.vn', contact: ['Lâm Quốc Việt', 'Giám đốc kinh doanh', 'anh', 'viet.lam@thuanthanh.com.vn', '0913 528 470'], source: 'outbound', owner: AM_DUCANH, status: 'new', tags: ['ERP', 'Omnichannel'], need: 'Quản lý đơn hàng của 1.500 đại lý và đội bán hàng thị trường.', budget: 1_500_000_000, notes: 'Danh sách từ hiệp hội phân phối Đồng Nai, chưa gọi lần nào.', follow: 1, created: [-5, '09:30'] },

  // ── contacted
  { id: 'lead_hopphat', company: 'Ngân hàng Hợp Phát', industry: 'Ngân hàng', province: 'TP. Hồ Chí Minh', size: 'gt1000', revenue: 'gt1t', website: 'hopphatbank.vn', contact: ['Tô Hải Yến', 'Giám đốc Ngân hàng số', 'chị', 'yen.to@hopphatbank.vn', '0903 917 254'], source: 'event', owner: AM_HA, status: 'contacted', tags: ['Chuyển đổi số', 'Mobile app'], need: 'Muốn làm mới ứng dụng ngân hàng cho khách hàng doanh nghiệp vừa và nhỏ.', budget: 4_500_000_000, notes: 'Gặp tại hội thảo ngân hàng số; chị Yến biết dự án của Thịnh An.', follow: 2, created: [-4, '17:00'] },
  { id: 'lead_bennghe', company: 'Kho vận Bến Nghé', industry: 'Logistics', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'khovanbennghe.vn', contact: ['Huỳnh Tấn Phát', 'Giám đốc điều hành', 'anh', 'phat.huynh@khovanbennghe.vn', '0907 663 128'], source: 'outbound', owner: AM_DUCANH, status: 'contacted', tags: ['Data', 'ERP'], need: 'Cần hệ thống quản lý kho nhiều chủ hàng, xem tồn kho theo thời gian thực.', budget: 1_200_000_000, follow: -2, created: [-20, '10:00'] },
  { id: 'lead_hongphuc', company: 'Bệnh viện Đa khoa Hồng Phúc', industry: 'Y tế', province: 'Hà Nội', size: '200_1000', revenue: '200b_1t', website: 'benhvienhongphuc.vn', contact: ['Lê Thanh Tùng', 'Giám đốc bệnh viện', 'anh', 'tung.le@benhvienhongphuc.vn', '0912 338 076'], source: 'referral', owner: AM_HA, status: 'contacted', tags: ['Chuyển đổi số', 'Mobile app'], need: 'Muốn có app đặt lịch khám và trả kết quả xét nghiệm cho bệnh nhân.', budget: 900_000_000, notes: 'Chị Hương (kế toán trưởng Cỏ Xanh) giới thiệu.', follow: 0, created: [-24, '09:00'] },
  { id: 'lead_songhau', company: 'Thực phẩm Sông Hậu', industry: 'F&B', province: 'Cần Thơ', size: '200_1000', revenue: '200b_1t', website: 'thucphamsonghau.vn', contact: ['Dương Minh Trí', 'Giám đốc chuỗi cung ứng', 'anh', 'tri.duong@thucphamsonghau.vn', '0939 714 552'], source: 'event', owner: AM_DUCANH, status: 'contacted', tags: ['ERP', 'Data'], need: 'Truy xuất nguồn gốc nguyên liệu và quản lý kho lạnh cho 3 nhà máy chế biến.', budget: 1_600_000_000, follow: 4, created: [-6, '08:30'] },
  { id: 'lead_thanhloi', company: 'Dệt may Thành Lợi', industry: 'Sản xuất', province: 'Hà Nội', size: '200_1000', revenue: '200b_1t', website: 'detmaythanhloi.vn', contact: ['Nghiêm Thị Hoa', 'Giám đốc tài chính', 'chị', 'hoa.nghiem@detmaythanhloi.vn', '0983 402 671'], source: 'outbound', owner: AM_HA, status: 'contacted', tags: ['ERP'], need: 'Muốn thay các phần mềm rời rạc bằng một hệ thống quản lý sản xuất và kho thống nhất.', budget: 2_000_000_000, notes: 'Chị Hoa hẹn trao đổi lại sau khi chốt ngân sách năm sau.', follow: 20, created: [-48, '10:00'] },

  // ── interested
  { id: 'lead_anhduong', company: 'Siêu thị Điện máy Ánh Dương', industry: 'Bán lẻ', province: 'Bình Dương', size: 'gt1000', revenue: 'gt1t', website: 'dienmayanhduong.vn', contact: ['Cao Văn Thịnh', 'Tổng giám đốc', 'anh', 'thinh.cao@dienmayanhduong.vn', '0918 225 903'], source: 'referral', owner: AM_DUCANH, status: 'interested', tags: ['Omnichannel', 'ERP'], need: 'Đồng bộ tồn kho giữa 35 siêu thị và website, giao hàng trong ngày.', budget: 3_000_000_000, notes: 'Anh Bình (Mây Trắng) giới thiệu; Ánh Dương đang dùng dịch vụ giao hàng của Mây Trắng.', follow: 0, created: [-22, '15:00'] },
  { id: 'lead_hunglong', company: 'Bảo hiểm Hưng Long', industry: 'Bảo hiểm', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'baohiemhunglong.vn', contact: ['Phùng Đức Mạnh', 'Giám đốc Công nghệ thông tin', 'anh', 'manh.phung@baohiemhunglong.vn', '0909 581 336'], source: 'partner', owner: AM_HA, status: 'interested', tags: ['CRM', 'Data'], need: 'Cần CRM cho 800 đại lý bảo hiểm và báo cáo doanh thu theo ngày.', budget: 2_500_000_000, follow: -1, created: [-25, '10:00'] },
  { id: 'lead_hanhlam', company: 'Dược phẩm Hạnh Lâm', industry: 'Dược phẩm', province: 'Hà Nội', size: '200_1000', revenue: '200b_1t', website: 'duochanhlam.vn', contact: ['Ninh Thu Uyên', 'Giám đốc kinh doanh', 'chị', 'uyen.ninh@duochanhlam.vn', '0904 390 118'], source: 'website', owner: AM_HA, status: 'interested', tags: ['CRM', 'Mobile app'], need: 'Muốn có app cho 120 trình dược viên ghi nhận viếng thăm và đơn hàng.', budget: 1_100_000_000, follow: 3, created: [-32, '13:00'] },
  { id: 'lead_hoakhanh', company: 'Gạch men Hòa Khánh', industry: 'Sản xuất', province: 'Đà Nẵng', size: 'gt1000', revenue: '200b_1t', website: 'gachhoakhanh.vn', contact: ['Thái Văn Quý', 'Giám đốc nhà máy', 'anh', 'quy.thai@gachhoakhanh.vn', '0935 820 447'], source: 'event', owner: AM_DUCANH, status: 'interested', tags: ['ERP', 'IoT'], need: 'Theo dõi sản lượng từng dây chuyền và lập kế hoạch bảo trì máy.', budget: 2_800_000_000, notes: 'Rất quan tâm hệ thống MES ở Thiên Trường, muốn đi tham quan.', follow: 9, created: [-38, '09:00'] },
  { id: 'lead_mamson', company: 'Chuỗi nhà hàng Mâm Son', industry: 'F&B', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '50_200b', website: 'mamson.vn', contact: ['Bạch Ngọc Diệp', 'Giám đốc vận hành', 'chị', 'diep.bach@mamson.vn', '0908 147 593'], source: 'referral', owner: AM_HA, status: 'interested', tags: ['Omnichannel', 'Mobile app'], need: 'Đặt bàn, gọi món tại bàn và quản lý nguyên liệu cho 24 nhà hàng.', budget: 700_000_000, follow: 12, created: [-14, '11:00'] },

  // ── nurturing
  { id: 'lead_giadinh', company: 'Điện máy Gia Định', industry: 'Bán lẻ', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'dienmaygiadinh.vn', contact: ['Quách Tuấn Kiệt', 'Phó Tổng giám đốc', 'anh', 'kiet.quach@dienmaygiadinh.vn', '0903 486 271'], source: 'website', owner: AM_DUCANH, status: 'nurturing', tags: ['Omnichannel'], need: 'Muốn bán hàng đa kênh nhưng đang triển khai ERP với đơn vị khác.', budget: 1_400_000_000, notes: 'Hẹn liên hệ lại sau khi họ go-live ERP vào quý sau.', follow: 25, created: [-70, '10:00'] },
  { id: 'lead_doson', company: 'Cơ khí Đồ Sơn', industry: 'Sản xuất', province: 'Hải Phòng', size: '50_200', revenue: '50_200b', website: 'cokhidoson.vn', contact: ['Vũ Đình Khải', 'Giám đốc', 'anh', 'khai.vu@cokhidoson.vn', '0915 732 806'], source: 'event', owner: AM_HA, status: 'nurturing', tags: ['ERP'], need: 'Quản lý đơn hàng gia công và tiến độ xưởng.', budget: 500_000_000, notes: 'Ngân sách năm nay đã dùng cho máy móc mới.', created: [-60, '15:00'] },
  { id: 'lead_anhsao', company: 'Hệ thống giáo dục Ánh Sao', industry: 'Giáo dục', province: 'TP. Hồ Chí Minh', size: '50_200', revenue: 'lt50b', website: 'anhsao.edu.vn', contact: ['Đinh Kim Oanh', 'Giám đốc', 'chị', 'oanh.dinh@anhsao.edu.vn', '0907 219 645'], source: 'website', owner: AM_DUCANH, status: 'nurturing', tags: ['Mobile app'], need: 'App học tập và thông báo cho phụ huynh tại 4 trung tâm.', budget: 250_000_000, follow: 40, created: [-40, '09:00'] },
  { id: 'lead_donghung', company: 'Ngân hàng Đông Hưng', industry: 'Ngân hàng', province: 'Hà Nội', size: 'gt1000', revenue: 'gt1t', website: 'donghungbank.vn', contact: ['Trần Hữu Nghĩa', 'Phó Tổng giám đốc', 'anh', 'nghia.tran@donghungbank.vn', '0904 663 590'], source: 'partner', owner: AM_HA, status: 'nurturing', tags: ['Data', 'Chuyển đổi số'], need: 'Xây kho dữ liệu khách hàng và báo cáo quản trị cho 60 chi nhánh.', budget: 5_000_000_000, notes: 'Đang chờ duyệt ngân sách công nghệ năm sau; anh Nam đã gặp trực tiếp.', follow: 18, created: [-85, '10:00'] },

  // ── disqualified
  { id: 'lead_taydo', company: 'Điện mặt trời Tây Đô', industry: 'Năng lượng', province: 'Cần Thơ', size: 'lt50', revenue: 'lt50b', website: 'dienmattroitaydo.vn', contact: ['Lý Văn Tâm', 'Chủ doanh nghiệp', 'anh', 'tam.ly@dienmattroitaydo.vn', '0939 508 214'], source: 'website', owner: AM_DUCANH, status: 'disqualified', tags: ['Data', 'IoT'], need: 'Giám sát sản lượng cho 3 trang trại điện mặt trời áp mái.', budget: 250_000_000, reason: 'Quy mô nhỏ, ngân sách dưới 300 triệu và chỉ cần một phần mềm đóng gói có sẵn.', created: [-30, '10:00'], statusAt: [-21, '16:00'] },
  { id: 'lead_phucloc', company: 'Địa ốc Phúc Lộc', industry: 'Bất động sản', province: 'Đồng Nai', size: '50_200', revenue: '50_200b', website: 'diaocphucloc.vn', contact: ['Mai Xuân Trường', 'Giám đốc kinh doanh', 'anh', 'truong.mai@diaocphucloc.vn', '0913 206 875'], source: 'outbound', owner: AM_HA, status: 'disqualified', tags: ['CRM'], need: 'CRM cho đội môi giới 40 người.', budget: 400_000_000, reason: 'Vừa ký với nhà cung cấp khác trong năm nay; hẹn liên hệ lại sau 2 năm.', created: [-45, '14:00'], statusAt: [-33, '11:00'] },

  // ── sister companies of customers (ecosystems.ts): referred inside the group, all followed up within 2 weeks
  { id: ECO.coxanhFoods, company: 'Hàng tiêu dùng Cỏ Xanh', industry: 'Hàng tiêu dùng', province: 'Bình Dương', size: '200_1000', revenue: '200b_1t', website: 'coxanhfoods.vn', contact: ['Trần Quang Khải', 'Giám đốc điều hành', 'anh', 'khai.tran@coxanhfoods.vn', '0903 418 527'], source: 'referral', owner: AM_HA, status: 'interested', tags: ['ERP', 'Data'], need: 'Quản lý phân phối hàng tiêu dùng tới 1.200 điểm bán và đồng bộ đơn hàng với chuỗi siêu thị Cỏ Xanh.', budget: 2_800_000_000, notes: 'Anh Minh (Cỏ Xanh Retail) giới thiệu; muốn dùng chung dữ liệu khách hàng với chuỗi siêu thị.', follow: 5, created: [-21, '10:00'] },
  { id: ECO.coxanhLogistics, company: 'Cỏ Xanh Logistics', industry: 'Logistics', province: 'Long An', size: '50_200', revenue: '50_200b', website: 'coxanhlogistics.vn', contact: ['Võ Thành Danh', 'Giám đốc kho vận', 'anh', 'danh.vo@coxanhlogistics.vn', '0938 562 147'], source: 'referral', owner: AM_DUCANH, status: 'contacted', tags: ['Mobile app', 'Data'], need: 'Quản lý 2 kho tổng và đội 60 xe giao hàng cho chuỗi siêu thị Cỏ Xanh, cần app tài xế và đối soát đơn.', budget: 900_000_000, notes: 'Chị Hà chuyển cho anh Đức Anh vì giống bài toán điều phối ở Mây Trắng.', follow: 3, created: [-10, '09:00'] },
  { id: ECO.thinhanSecurities, company: 'Chứng khoán Thịnh An', industry: 'Chứng khoán', province: 'Hà Nội', size: '200_1000', revenue: '200b_1t', website: 'thinhansecurities.vn', contact: ['Đỗ Minh Quân', 'Giám đốc Công nghệ', 'anh', 'quan.do@thinhansecurities.vn', '0912 745 380'], source: 'referral', owner: AM_HA, status: 'contacted', tags: ['Mobile app', 'Data'], need: 'Làm mới ứng dụng giao dịch chứng khoán, dùng chung định danh khách hàng với ngân hàng mẹ.', budget: 3_200_000_000, notes: 'Anh Long (Thịnh An) giới thiệu sau buổi trao đổi giai đoạn 2.', follow: 6, created: [-9, '11:00'] },
  { id: ECO.ngannang, company: 'Điện mặt trời Ngàn Nắng', industry: 'Năng lượng', province: 'Ninh Thuận', size: '50_200', revenue: '200b_1t', website: 'ngannang.vn', contact: ['Lương Thị Mai', 'Giám đốc vận hành', 'chị', 'mai.luong@ngannang.vn', '0918 634 205'], source: 'existing_customer', owner: AM_DUCANH, status: 'interested', tags: ['Data', 'IoT'], need: 'Giám sát sản lượng 4 trang trại điện mặt trời trên cùng màn hình với trang trại gió của tập đoàn.', budget: 1_900_000_000, notes: 'Chị Phương (Gió Ngàn) giới thiệu; muốn mở rộng hệ thống giám sát đang làm cho trang trại gió.', follow: 8, created: [-26, '09:30'] },
  { id: ECO.nganphong, company: 'Xây lắp điện Ngàn Phong', industry: 'Năng lượng', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'nganphong.vn', contact: ['Hà Văn Toàn', 'Phó Tổng giám đốc', 'anh', 'toan.ha@nganphong.vn', '0905 287 316'], source: 'existing_customer', owner: AM_DUCANH, status: 'contacted', tags: ['ERP', 'Mobile app'], need: 'Quản lý tiến độ thi công và nghiệm thu các dự án điện gió, điện mặt trời của tập đoàn.', budget: 1_400_000_000, notes: 'Tổng thầu EPC của Gió Ngàn; gặp tại công trường Ninh Thuận.', follow: 4, created: [-15, '08:30'] },
  { id: ECO.saobacFoods, company: 'Thực phẩm Sao Bắc', industry: 'F&B', province: 'Hưng Yên', size: '200_1000', revenue: '200b_1t', website: 'thucphamsaobac.vn', contact: ['Đặng Minh Tuấn', 'Giám đốc nhà máy', 'anh', 'tuan.dang@thucphamsaobac.vn', '0983 172 649'], source: 'referral', owner: AM_HA, status: 'interested', tags: ['ERP', 'Data'], need: 'Truy xuất nguồn gốc và lập kế hoạch sản xuất hàng nhãn riêng cho 40 siêu thị Sao Bắc.', budget: 1_600_000_000, notes: 'Chị Trang (Sao Bắc) giới thiệu; nhà máy cung cấp hàng nhãn riêng cho chuỗi siêu thị.', follow: 10, created: [-30, '15:00'] },
  { id: ECO.saobacLand, company: 'Địa ốc Sao Bắc', industry: 'Bất động sản', province: 'Hà Nội', size: '200_1000', revenue: '200b_1t', website: 'saobacland.vn', contact: ['Phan Gia Khánh', 'Giám đốc phát triển dự án', 'anh', 'khanh.phan@saobacland.vn', '0904 538 261'], source: 'referral', owner: AM_HA, status: 'contacted', tags: ['CRM', 'Mobile app'], need: 'CRM cho đội cho thuê mặt bằng của 3 trung tâm thương mại và cổng thông tin cho khách thuê.', budget: 1_100_000_000, notes: 'Chị Trang nhắc tới khi đàm phán với Sao Bắc.', follow: 12, created: [-6, '17:30'] },

  // ── converted → prospect accounts (crmAccounts.ts) and their opportunities (crmDeals.ts)
  { id: PROSPECTS.saobac.lead, company: 'Siêu thị Sao Bắc', industry: 'Bán lẻ', province: 'Hà Nội', size: 'gt1000', revenue: 'gt1t', website: 'saobac.vn', contact: ['Đặng Thu Trang', 'Tổng giám đốc', 'chị', 'trang.dang@saobac.vn', '0904 216 738'], source: 'event', owner: AM_HA, status: 'converted', tags: ['Omnichannel', 'ERP'], need: 'Một nền tảng bán hàng đa kênh cho 40 siêu thị, đồng bộ tồn kho và khuyến mãi.', budget: 2_500_000_000, created: [-62, '16:00'], statusAt: [PROSPECTS.saobac.converted, PROSPECTS.saobac.time], converted: { account: PROSPECTS.saobac.account, opportunity: PROSPECTS.saobac.opportunity } },
  { id: PROSPECTS.hoangvu.lead, company: 'Vận tải Hoàng Vũ', industry: 'Logistics', province: 'Bình Dương', size: '200_1000', revenue: '200b_1t', website: 'hoangvulogistics.vn', contact: ['Trịnh Văn Lộc', 'Giám đốc điều hành', 'anh', 'loc.trinh@hoangvulogistics.vn', '0918 403 627'], source: 'outbound', owner: AM_DUCANH, status: 'converted', tags: ['Mobile app', 'Data'], need: 'Điều phối 300 xe tải, theo dõi chuyến và ứng dụng cho tài xế.', budget: 1_500_000_000, created: [-48, '09:00'], statusAt: [PROSPECTS.hoangvu.converted, PROSPECTS.hoangvu.time], converted: { account: PROSPECTS.hoangvu.account, opportunity: PROSPECTS.hoangvu.opportunity } },
  { id: PROSPECTS.vanxuan.lead, company: 'Dược phẩm Vạn Xuân', industry: 'Dược phẩm', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue: '200b_1t', website: 'vanxuanpharma.vn', contact: ['Lư Bảo Ngọc', 'Tổng giám đốc', 'chị', 'ngoc.lu@vanxuanpharma.vn', '0909 712 485'], source: 'website', owner: AM_HA, status: 'converted', tags: ['ERP', 'Chuyển đổi số'], need: 'Quản lý tồn kho theo lô, hạn dùng và bán hàng cho 65 nhà thuốc.', budget: 2_000_000_000, created: [-18, '09:30'], statusAt: [PROSPECTS.vanxuan.converted, PROSPECTS.vanxuan.time], converted: { account: PROSPECTS.vanxuan.account, opportunity: PROSPECTS.vanxuan.opportunity } },
];

/** Leads with last_contacted_at = null; crm.ts fills it (and bumps updated_at) from the interactions. */
export function buildLeads(c: SeedCtx): Lead[] {
  return SPECS.map((s) => {
    const created_at: ISODateTime = c.at(s.created[0], s.created[1]);
    const statusAt: ISODateTime | null = s.statusAt ? c.at(s.statusAt[0], s.statusAt[1]) : null;
    const [contact_name, contact_title, contact_salutation, contact_email, contact_phone] = s.contact;
    return {
      id: s.id,
      company_name: s.company,
      industry: s.industry,
      province: s.province,
      size: s.size,
      revenue_band: s.revenue,
      website: s.website,
      contact_name,
      contact_title,
      contact_salutation,
      contact_email,
      contact_phone,
      source: s.source,
      owner_id: s.owner,
      status: s.status,
      tags: s.tags,
      need_summary: s.need,
      budget_estimate: s.budget,
      notes: s.notes ?? null,
      disqualified_reason: s.reason ?? null,
      converted_account_id: s.converted ? s.converted.account : null,
      converted_opportunity_id: s.converted ? s.converted.opportunity : null,
      last_contacted_at: null,
      next_follow_up_date: s.follow === undefined ? null : c.d(s.follow),
      created_at,
      updated_at: statusAt && statusAt > created_at ? statusAt : created_at,
      deleted_at: null,
    };
  });
}
