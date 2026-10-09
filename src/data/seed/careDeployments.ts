// Care seed (SPEC-CARE §7) — what each account already uses ("Giải pháp đã triển khai") and its expansion map
// ("Bản đồ mở rộng": one row per department, stored status engaged / untouched / not_fit; 'using' is derived from the
// live / rolling-out / pilot deployments). Matches the projects and stages of every account:
//   · Cỏ Xanh — App + supplier portal rolling out, the store-replenishment link to Mây Trắng's TMS live; marketing,
//     finance and executive are clear room, but delivery debt blocks expanding (see careRequests.ts)
//   · Mây Trắng — healthy: TMS, driver app and support live, the marketplace link rolling out; four departments with
//     concrete, priced opportunities (portal for shippers, cost dashboard, freight reconciliation, driver timesheets)
//   · prospects (Sao Bắc, Hoàng Vũ, Vạn Xuân) — nothing deployed yet, a map of where the first deal would land

import type { Contract, ID } from '@/domain/types';
import type { AccountDepartment, Adoption, DepartmentKey, DepartmentStatus, Deployment, DeploymentStatus, SolutionCategory } from '@/domain/careTypes';
import type { SeedCtx } from './helpers';

const HA = 'u_am_ha';
const DUCANH = 'u_am_ducanh';
const TUAN = 'u_member_tuan';
const DIRECTOR = 'u_director';

interface DeploymentSpec {
  id: ID;
  account: ID;
  project: ID | null;
  name: string;
  category: SolutionCategory;
  summary: string;
  status: DeploymentStatus;
  /** go-live day offset (null = not set) */
  goLive: number | null;
  departments: DepartmentKey[];
  users: number | null;
  /** contract id whose value is this deployment's, or a VND amount */
  value: ID | number | null;
  adoption: Adoption | null;
  notes: string | null;
  owner: ID;
  created: number;
  updated: number;
}

export function buildDeployments(c: SeedCtx, contracts: Contract[]): Deployment[] {
  const valueOf = (v: ID | number | null): number | null => {
    if (v === null || typeof v === 'number') return v;
    return contracts.find((k) => k.id === v)?.value ?? null;
  };
  const specs: DeploymentSpec[] = [
    // ── Cỏ Xanh Retail
    { id: 'dpl_coxanh_app', account: 'acc_coxanh', project: 'prj_coxanh_app', name: 'App bán hàng đa kênh', category: 'mobile_app', summary: 'Ứng dụng bán hàng cho 24 cửa hàng: đặt hàng, chọn kho giao, theo dõi đơn và khuyến mãi.', status: 'rolling_out', goLive: 36, departments: ['sales', 'operations', 'customer_service'], users: null, value: 'c_coxanh_app', adoption: null, notes: 'Ngày đưa vào dùng phụ thuộc việc anh Minh duyệt thiết kế màn hình Đặt hàng; đội bán hàng miền Nam chờ thêm 20 tài khoản.', owner: HA, created: -70, updated: -6 },
    { id: 'dpl_coxanh_portal', account: 'acc_coxanh', project: 'prj_coxanh_portal', name: 'Cổng nhà cung cấp', category: 'web_portal', summary: 'Cổng cho 20 nhà cung cấp chính xem đơn nhập, lịch giao hàng và đối chiếu công nợ.', status: 'rolling_out', goLive: 90, departments: ['supply_chain'], users: null, value: 960_000_000, adoption: null, notes: 'Mới khởi động; anh Khoa là đầu mối kỹ thuật.', owner: HA, created: -20, updated: -18 },
    { id: 'dpl_coxanh_replenish', account: 'acc_coxanh', project: null, name: 'Kết nối đơn bổ sung hàng với vận tải Mây Trắng', category: 'integration', summary: 'Đơn bổ sung hàng của cửa hàng tự chuyển sang hệ thống vận tải Mây Trắng để ghép chuyến giao.', status: 'live', goLive: -40, departments: ['supply_chain', 'operations'], users: 18, value: 180_000_000, adoption: 'high', notes: 'Làm cùng đội vận hành Mây Trắng; cầu nối dữ liệu đầu tiên trong tập đoàn.', owner: TUAN, created: -52, updated: -40 },
    // ── Ngân hàng Thịnh An
    { id: 'dpl_thinhan_cb', account: 'acc_thinhan', project: 'prj_thinhan_corp', name: 'Cổng ngân hàng số doanh nghiệp', category: 'web_portal', summary: 'Doanh nghiệp tự lập lệnh chuyển tiền, phê duyệt nhiều cấp theo hạn mức và đối soát cuối ngày.', status: 'rolling_out', goLive: 100, departments: ['sales', 'operations'], users: null, value: 'c_thinhan_cb', adoption: null, notes: 'Đang thiết kế giải pháp; giai đoạn 2 (tín dụng doanh nghiệp) đang đàm phán.', owner: HA, created: -50, updated: -2 },
    { id: 'dpl_thinhan_assistant', account: 'acc_thinhan', project: null, name: 'Trợ lý tra cứu quy trình nội bộ', category: 'ai_automation', summary: 'Nhân viên tổng đài và khối CNTT hỏi đáp quy trình, biểu phí bằng câu hỏi tự nhiên.', status: 'pilot', goLive: -20, departments: ['customer_service', 'it'], users: 25, value: 180_000_000, adoption: 'medium', notes: 'Chạy thử 2 tháng với 25 người; chị Mai muốn số liệu tỷ lệ trả lời đúng trước khi mở rộng.', owner: TUAN, created: -35, updated: -9 },
    // ── Cơ điện Thiên Trường
    { id: 'dpl_thientruong_mes', account: 'acc_thientruong', project: 'prj_thientruong_mes', name: 'Hệ thống quản lý sản xuất (MES)', category: 'crm_erp', summary: 'Kế hoạch sản xuất, điều phối lệnh, xuất kho nguyên vật liệu và kết nối máy CNC cho 3 xưởng.', status: 'rolling_out', goLive: 60, departments: ['production', 'supply_chain'], users: null, value: 'c_thientruong_mes', adoption: null, notes: 'Phân hệ kế hoạch đang lập trình; anh Hùng ưu tiên kết nối máy CNC.', owner: DUCANH, created: -175, updated: -5 },
    { id: 'dpl_thientruong_board', account: 'acc_thientruong', project: null, name: 'Bảng theo dõi sản lượng 3 xưởng', category: 'data_bi', summary: 'Sản lượng theo ca và tỷ lệ hàng lỗi của xưởng cơ khí, sơn, lắp ráp, cập nhật mỗi giờ.', status: 'live', goLive: -90, departments: ['production', 'executive'], users: 14, value: 150_000_000, adoption: 'high', notes: 'Làm nhanh trong giai đoạn khảo sát; anh Hùng xem mỗi sáng.', owner: TUAN, created: -110, updated: -90 },
    // ── Năng lượng Gió Ngàn
    { id: 'dpl_giongan_ops', account: 'acc_giongan', project: 'prj_giongan_ops', name: 'Nền tảng giám sát vận hành trang trại gió', category: 'data_bi', summary: 'Công suất, tốc độ gió, rung và nhiệt độ của 42 tua-bin trên một màn hình, kèm cảnh báo tự động.', status: 'rolling_out', goLive: 30, departments: ['operations', 'executive', 'it'], users: null, value: 'c_giongan_ops', adoption: null, notes: 'Tích hợp SCADA chậm 4 ngày do trang trại đổi giao thức; New Era bổ sung kỹ sư.', owner: DUCANH, created: -135, updated: -1 },
    // ── Địa ốc Hải Đăng
    { id: 'dpl_haidang_crm', account: 'acc_haidang', project: 'prj_haidang_crm', name: 'CRM bán hàng dự án', category: 'crm_erp', summary: 'Giỏ hàng căn hộ, phân bổ khách hàng tiềm năng và theo dõi đặt cọc cho 2 sàn giao dịch.', status: 'rolling_out', goLive: 62, departments: ['sales', 'marketing'], users: null, value: 'c_haidang_crm', adoption: null, notes: 'Chị Vy duyệt quy trình phân bổ khách là điều kiện giữ mốc Thiết kế.', owner: HA, created: -60, updated: -2 },
    // ── Mây Trắng Logistics
    { id: 'dpl_maytrang_tms', account: 'acc_maytrang', project: 'prj_maytrang_tms', name: 'Hệ thống quản lý vận tải (TMS)', category: 'crm_erp', summary: 'Nhận đơn, ghép chuyến, điều phối xe và theo dõi giao hàng cho các chi nhánh.', status: 'live', goLive: -105, departments: ['operations', 'supply_chain'], users: 140, value: 'c_maytrang_tms', adoption: 'high', notes: '98% đơn giao đúng hẹn tháng qua; tuyến nội thành ngắn hơn 11% sau tối ưu.', owner: DUCANH, created: -265, updated: -41 },
    { id: 'dpl_maytrang_driver', account: 'acc_maytrang', project: 'prj_maytrang_tms', name: 'Ứng dụng tài xế', category: 'mobile_app', summary: 'Tài xế nhận chuyến, chụp ảnh giao hàng và báo sự cố trên điện thoại.', status: 'live', goLive: -105, departments: ['operations'], users: 260, value: null, adoption: 'medium', notes: 'Nằm trong hợp đồng TMS. Tài xế lớn tuổi thấy chữ nhỏ; phiên bản 2 có chế độ chữ to.', owner: DUCANH, created: -200, updated: -6 },
    { id: 'dpl_maytrang_support', account: 'acc_maytrang', project: 'prj_maytrang_ops', name: 'Hỗ trợ vận hành TMS', category: 'support', summary: 'Theo dõi hệ thống, xử lý sự cố và cải tiến hằng tháng trong 12 tháng.', status: 'live', goLive: -100, departments: ['it', 'operations'], users: null, value: 'c_maytrang_ops', adoption: 'high', notes: 'Rà soát vận hành lần 1 đạt; cần nâng hạ tầng trước mùa cao điểm.', owner: TUAN, created: -104, updated: -10 },
    { id: 'dpl_maytrang_marketplace', account: 'acc_maytrang', project: 'prj_maytrang_ops', name: 'Kết nối sàn thương mại điện tử', category: 'integration', summary: 'Đơn từ 3 sàn thương mại điện tử tự vào TMS và tự ghép chuyến.', status: 'rolling_out', goLive: 25, departments: ['sales', 'operations'], users: null, value: 240_000_000, adoption: null, notes: 'Đã đồng bộ 2/3 sàn, sàn thứ 3 đang kiểm thử.', owner: TUAN, created: -40, updated: -2 },
  ];
  return specs.map((s) => ({
    id: s.id,
    account_id: s.account,
    project_id: s.project,
    name: s.name,
    category: s.category,
    summary: s.summary,
    status: s.status,
    go_live_date: s.goLive === null ? null : c.d(s.goLive),
    departments: s.departments,
    active_users: s.users,
    contract_value: valueOf(s.value),
    adoption: s.adoption,
    notes: s.notes,
    owner_id: s.owner,
    created_at: c.at(s.created, '10:00'),
    updated_at: c.at(s.updated, '16:00'),
    deleted_at: null,
  }));
}

/** [department, status, need, opportunity, category, est value (million VND), contact, NE owner, next step, next step due offset, updated offset] */
type DeptTuple = [DepartmentKey, DepartmentStatus, string | null, string | null, SolutionCategory | null, number | null, ID | null, ID | null, string | null, number | null, number];

const M = 1_000_000;

const MAPS: Record<ID, DeptTuple[]> = {
  acc_coxanh: [
    ['executive', 'engaged', 'Anh Minh muốn xem doanh thu và tồn kho của 24 cửa hàng mỗi sáng, hiện tổng hợp tay từ 3 hệ thống.', 'Bảng điều hành doanh thu – tồn kho cho ban giám đốc', 'data_bi', 480, 'ct_coxanh_minh', DIRECTOR, 'Demo bảng điều hành ngay khi app đưa vào dùng', 40, -12],
    ['sales', 'engaged', null, null, null, null, 'ct_coxanh_nhung', HA, null, null, -12],
    ['operations', 'engaged', null, null, null, null, 'ct_coxanh_lan', HA, null, null, -20],
    ['supply_chain', 'engaged', null, null, null, null, 'ct_coxanh_lan', HA, null, null, -20],
    ['customer_service', 'engaged', null, null, null, null, 'ct_coxanh_lan', HA, null, null, -20],
    ['marketing', 'untouched', 'Khách thân thiết đang tích điểm bằng thẻ giấy ở từng cửa hàng.', 'Chương trình khách hàng thân thiết ngay trong app', 'crm_erp', 650, 'ct_coxanh_vinh', HA, 'Mời anh Vinh xem bản demo tích điểm', null, -30],
    ['finance', 'untouched', 'Kế toán đối chiếu công nợ 20 nhà cung cấp bằng bảng tính mỗi cuối tháng.', 'Đối soát công nợ nhà cung cấp tự động', 'integration', 380, 'ct_coxanh_huong', HA, null, null, -36],
    ['it', 'engaged', 'Khi app đưa vào dùng cần người theo dõi hệ thống 24/7 cho 24 cửa hàng.', 'Gói vận hành và bảo trì sau khi đưa app vào dùng', 'support', 360, 'ct_coxanh_khoa', HA, 'Gửi anh Khoa phương án hỗ trợ vận hành', 30, -19],
    ['hr', 'not_fit', 'Dùng chung phần mềm nhân sự của tập đoàn.', null, null, null, null, null, null, null, -60],
  ],
  acc_thinhan: [
    ['executive', 'engaged', 'Ban điều hành cần số liệu giao dịch doanh nghiệp theo ngày, hiện chờ báo cáo cuối tháng.', 'Bảng điều hành giao dịch khối doanh nghiệp', 'data_bi', 900, 'ct_thinhan_long', DIRECTOR, 'Đưa vào đề xuất giai đoạn 2', 20, -3],
    ['sales', 'engaged', null, null, null, null, 'ct_thinhan_phuc', HA, null, null, -6],
    ['operations', 'engaged', null, null, null, null, 'ct_thinhan_kien', HA, null, null, -15],
    ['it', 'engaged', null, null, null, null, 'ct_thinhan_mai', HA, null, null, -2],
    ['customer_service', 'engaged', null, null, null, null, 'ct_thinhan_mai', HA, null, null, -9],
    ['finance', 'engaged', 'Hồ sơ tín dụng doanh nghiệp vẫn chuyển giấy giữa chi nhánh và hội sở.', 'Phân hệ tín dụng doanh nghiệp (giai đoạn 2)', 'crm_erp', 4200, 'ct_thinhan_van', DIRECTOR, 'Gửi báo giá bản 2 sau khi Giám đốc duyệt', 5, -1],
    ['marketing', 'untouched', 'Khối bán lẻ muốn có kênh riêng cho hộ kinh doanh nhỏ.', 'Ứng dụng ngân hàng số cho hộ kinh doanh', 'mobile_app', 2800, null, HA, null, null, -28],
    ['hr', 'untouched', null, null, null, null, null, null, null, null, -48],
  ],
  acc_thientruong: [
    ['executive', 'engaged', null, null, null, null, 'ct_thientruong_hung', DUCANH, null, null, -6],
    ['production', 'engaged', null, null, null, null, 'ct_thientruong_son', DUCANH, null, null, -1],
    ['supply_chain', 'engaged', null, null, null, null, 'ct_thientruong_lam', DUCANH, null, null, -8],
    ['finance', 'engaged', 'Giá thành theo lệnh sản xuất vẫn tính bằng bảng tính, chậm 10 ngày sau khi đóng tháng.', 'Tính giá thành theo lệnh sản xuất', 'crm_erp', 750, 'ct_thientruong_thao', DUCANH, 'Trình bày phương án sau khi thu xong đợt 2', 25, -4],
    ['hr', 'engaged', 'Công nhân chấm công giấy theo ca, lương khoán tính tay.', 'Chấm công theo ca và tính lương khoán theo sản lượng', 'crm_erp', 600, 'ct_thientruong_nga', DUCANH, 'Hẹn chị Nga khảo sát quy trình chấm công', 18, -20],
    ['operations', 'untouched', 'Tổ bảo trì ghi sự cố máy CNC vào sổ, khó biết máy nào hay hỏng.', 'Ứng dụng bảo trì máy cho tổ kỹ thuật', 'mobile_app', 520, 'ct_thientruong_son', DUCANH, null, null, -30],
    ['sales', 'untouched', 'Đại lý đặt hàng qua điện thoại và Zalo.', 'Cổng đặt hàng cho đại lý', 'web_portal', 680, 'ct_thientruong_hieu', DUCANH, null, null, -45],
    ['it', 'not_fit', 'Thiên Trường thuê ngoài toàn bộ CNTT.', null, null, null, null, null, null, null, -90],
  ],
  acc_giongan: [
    ['executive', 'engaged', null, null, null, null, 'ct_giongan_phuong', DUCANH, null, null, -1],
    ['operations', 'engaged', null, null, null, null, 'ct_giongan_tai', DUCANH, null, null, -2],
    ['it', 'engaged', null, null, null, null, 'ct_giongan_tai', DUCANH, null, null, -2],
    ['supply_chain', 'engaged', 'Kho vật tư thay thế cho 42 tua-bin đang theo dõi bằng bảng tính, thường thiếu khi cần.', 'Quản lý kho vật tư thay thế theo tua-bin', 'crm_erp', 450, 'ct_giongan_my', DUCANH, 'Khảo sát kho vật tư sau buổi khách kiểm thử', 35, -20],
    ['finance', 'untouched', 'Doanh thu bán điện theo giá cố định đối chiếu tay với hóa đơn hằng tháng.', 'Báo cáo doanh thu bán điện tự động', 'data_bi', 350, 'ct_giongan_thuan', DUCANH, null, null, -27],
    ['hr', 'not_fit', 'Dưới 80 nhân viên, dùng dịch vụ nhân sự thuê ngoài.', null, null, null, null, null, null, null, -60],
    ['sales', 'not_fit', 'Bán toàn bộ điện cho một đơn vị mua theo hợp đồng dài hạn.', null, null, null, null, null, null, null, -60],
  ],
  acc_haidang: [
    ['sales', 'engaged', null, null, null, null, 'ct_haidang_khang', HA, null, null, -1],
    ['marketing', 'engaged', null, null, null, null, 'ct_haidang_chau', HA, null, null, -25],
    ['executive', 'engaged', 'Chị Vy muốn xem giỏ hàng và doanh số theo dự án mỗi tuần.', 'Bảng điều hành giỏ hàng và doanh thu dự án', 'data_bi', 320, 'ct_haidang_vy', HA, null, null, -4],
    ['customer_service', 'engaged', 'Khách mua căn hộ gọi hỏi tiến độ thanh toán và bàn giao nhiều lần mỗi tháng.', 'App cho khách mua căn hộ theo dõi thanh toán và bàn giao', 'mobile_app', 1100, 'ct_haidang_thu', HA, 'Khảo sát nhu cầu sau mốc Thiết kế', 9, -14],
    ['finance', 'untouched', 'Công nợ theo đợt thanh toán của khách mua theo dõi bằng bảng tính.', 'Theo dõi công nợ theo đợt thanh toán', 'integration', 280, null, HA, null, null, -30],
    ['operations', 'untouched', 'Ban quản lý tòa nhà nhận phản ánh của cư dân qua nhóm Zalo.', 'Cổng cư dân và quản lý vận hành tòa nhà', 'web_portal', 900, null, HA, null, null, -30],
    ['it', 'untouched', null, null, null, null, 'ct_haidang_luc', HA, null, null, -18],
    ['hr', 'not_fit', null, null, null, null, null, null, null, null, -50],
  ],
  acc_maytrang: [
    ['operations', 'engaged', 'Số đơn dự kiến tăng gấp 3 dịp cuối năm, máy chủ đã chạm 85% CPU trong đợt khuyến mãi gần nhất.', 'Nâng hạ tầng và hỗ trợ 24/7 mùa cao điểm', 'support', 300, 'ct_maytrang_hanh', DUCANH, 'Gửi đề xuất nâng hạ tầng', 6, -5],
    ['supply_chain', 'engaged', null, null, null, null, 'ct_maytrang_hanh', DUCANH, null, null, -41],
    ['it', 'engaged', null, null, null, null, 'ct_maytrang_quoc', DUCANH, null, null, -4],
    ['sales', 'engaged', null, null, null, null, 'ct_maytrang_hanh', DUCANH, null, null, -12],
    ['executive', 'engaged', 'Anh Bình muốn biết chi phí mỗi chuyến theo tuyến và theo khách hàng.', 'Bảng điều hành chi phí – sản lượng', 'data_bi', 420, 'ct_maytrang_binh', DUCANH, 'Demo bảng điều hành cho anh Bình', 7, -10],
    ['customer_service', 'engaged', 'Tổng đài nhận khoảng 300 cuộc gọi mỗi ngày hỏi trạng thái đơn.', 'Cổng tra cứu đơn cho chủ hàng', 'web_portal', 650, 'ct_maytrang_dung', DUCANH, 'Khảo sát tổng đài cùng chị Dung', 10, -9],
    ['finance', 'engaged', 'Kế toán đối soát cước với 40 chủ hàng bằng bảng tính mỗi tháng.', 'Đối soát cước tự động với chủ hàng', 'integration', 380, 'ct_maytrang_ngan', DUCANH, 'Gửi chị Ngân ví dụ biên bản đối soát', 14, -3],
    ['hr', 'untouched', 'Phụ cấp chuyến của 260 tài xế tính tay cuối tháng.', 'Chấm công và phụ cấp chuyến cho tài xế', 'mobile_app', 480, 'ct_maytrang_triet', DUCANH, null, null, -20],
    ['marketing', 'not_fit', 'Mây Trắng bán hàng qua quan hệ, không làm marketing số.', null, null, null, null, null, null, null, -60],
  ],
  acc_saobac: [
    ['executive', 'engaged', 'Sao Bắc muốn thay hệ thống bán hàng cũ trước mùa Tết.', 'Nền tảng bán hàng đa kênh cho 40 siêu thị', 'crm_erp', 6500, 'ct_saobac_trang', HA, 'Gửi phương án thanh toán 4 đợt', 2, -8],
    ['it', 'engaged', 'Phần mềm kế toán hiện tại phải giữ lại.', 'Kết nối với phần mềm kế toán đang dùng', 'integration', 450, 'ct_saobac_huy', HA, null, null, -25],
    ['supply_chain', 'untouched', 'Tồn kho 40 siêu thị chỉ cập nhật cuối ngày.', 'Đồng bộ tồn kho theo thời gian thực', 'data_bi', 800, null, HA, null, null, -38],
    ['marketing', 'untouched', 'Khuyến mãi theo vùng đang làm thủ công.', 'Khuyến mãi theo vùng và khách hàng thân thiết', 'mobile_app', 900, null, HA, null, null, -38],
    ['finance', 'untouched', null, null, null, null, null, null, null, null, -38],
    ['customer_service', 'untouched', null, null, null, null, null, null, null, null, -38],
  ],
  acc_hoangvu: [
    ['executive', 'engaged', 'Điều phối 300 xe tải bằng điện thoại và bảng tính.', 'Hệ thống điều phối xe', 'crm_erp', 2400, 'ct_hoangvu_loc', DUCANH, 'Chốt ngày khảo sát bãi xe', 4, -15],
    ['operations', 'engaged', 'Tài xế không quen phần mềm cũ, cần thứ thật đơn giản.', 'Ứng dụng tài xế đơn giản', 'mobile_app', 900, 'ct_hoangvu_han', DUCANH, null, null, -6],
    ['finance', 'untouched', 'Đối soát cước với chủ hàng cuối tháng mất 5 ngày.', 'Đối soát cước tự động', 'integration', 350, null, DUCANH, null, null, -24],
    ['hr', 'untouched', null, null, null, null, null, null, null, null, -24],
    ['customer_service', 'untouched', null, null, null, null, null, null, null, null, -24],
    ['it', 'not_fit', 'Chưa có phòng CNTT riêng.', null, null, null, null, null, null, null, -24],
  ],
  acc_vanxuan: [
    ['executive', 'engaged', 'Tồn kho theo lô và hạn dùng của 65 nhà thuốc chưa nhìn được tập trung.', 'Quản lý tồn kho theo lô, hạn dùng cho chuỗi nhà thuốc', 'crm_erp', 3200, 'ct_vanxuan_ngoc', HA, 'Đề xuất lịch khảo sát 5 nhà thuốc', 2, -3],
    ['supply_chain', 'untouched', '2 kho dược điều chuyển hàng cho nhà thuốc bằng phiếu giấy.', 'Điều chuyển hàng giữa kho và nhà thuốc', 'integration', 600, null, HA, null, null, -4],
    ['sales', 'untouched', null, null, null, null, null, null, null, null, -4],
    ['customer_service', 'untouched', 'Khách hỏi thuốc còn hàng qua điện thoại.', 'Ứng dụng đặt thuốc và giữ hàng', 'mobile_app', 700, null, HA, null, null, -4],
    ['finance', 'untouched', null, null, null, null, null, null, null, null, -4],
    ['it', 'untouched', null, null, null, null, null, null, null, null, -4],
  ],
};

export function buildAccountDepartments(c: SeedCtx): AccountDepartment[] {
  const out: AccountDepartment[] = [];
  for (const [accountId, rows] of Object.entries(MAPS)) {
    for (const [department, status, need, opp, category, value, contact, owner, next, nextDue, updated] of rows) {
      out.push({
        id: `dept_${accountId}_${department}`,
        account_id: accountId,
        department,
        status,
        need_note: need,
        opportunity_note: opp,
        opportunity_category: category,
        est_value: value === null ? null : value * M,
        contact_id: contact,
        ne_owner_id: owner,
        next_step: next,
        next_step_due: nextDue === null ? null : c.d(nextDue),
        updated_at: c.at(updated, '17:00'),
      });
    }
  }
  return out;
}
