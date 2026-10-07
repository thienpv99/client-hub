-- Minimal fixture for the RLS / RPC checklist (supabase/README.md §8). Run as the table owner (postgres) on an
-- EMPTY database after schema.sql + storage.sql. Ids are public.mock_uuid('<mock id>') like a seed import.
-- Scenario (SPEC §9): Cỏ Xanh is blocked by the client ("Duyệt thiết kế…" overdue 6 days → Thiết kế / UAT +6,
-- Go-live +6 by cascade), a hidden internal task + hidden milestone, a sent quote with its approval task,
-- an overdue invoiced installment with its payment task; Thịnh An has a 15 % draft quote (needs approval);
-- Gió Ngàn is late on New Era's side.

insert into auth.users (id, email) values
 (public.mock_uuid('u_director'), 'nam@newera.inc'), (public.mock_uuid('u_am_ha'), 'ha@newera.inc'),
 (public.mock_uuid('u_am_ducanh'), 'ducanh@newera.inc'), (public.mock_uuid('u_member_tuan'), 'tuan@newera.inc'),
 (public.mock_uuid('u_client_minh'), 'minh@coxanh.vn'), (public.mock_uuid('u_client_lan'), 'lan@coxanh.vn'),
 (public.mock_uuid('u_client_ta'), 'owner@thinhan.vn'), (public.mock_uuid('u_client_bad'), 'bad@gmail.com');

insert into public.profiles (id, full_name, email, org_type, account_id, role, can_view_cost, status) values
 (public.mock_uuid('u_director'), 'Lê Hoàng Nam', 'nam@newera.inc', 'internal', null, 'director', true, 'active'),
 (public.mock_uuid('u_am_ha'), 'Nguyễn Thu Hà', 'ha@newera.inc', 'internal', null, 'am', false, 'active'),
 (public.mock_uuid('u_am_ducanh'), 'Trần Đức Anh', 'ducanh@newera.inc', 'internal', null, 'am', true, 'active'),
 (public.mock_uuid('u_member_tuan'), 'Phạm Minh Tuấn', 'tuan@newera.inc', 'internal', null, 'member', false, 'active');

insert into public.accounts (id, name, short_name, industry, tier, stage, am_id, email_domain, internal_notes, exec_summary) values
 (public.mock_uuid('acc_coxanh'), 'Cỏ Xanh Retail', 'Cỏ Xanh', 'Bán lẻ', 'strategic', 'implementing', public.mock_uuid('u_am_ha'), 'coxanh.vn', 'Ghi chú nội bộ CX', E'Dòng 1\nDòng 2'),
 (public.mock_uuid('acc_thinhan'), 'Ngân hàng Thịnh An', 'Thịnh An', 'Ngân hàng', 'strategic', 'negotiating', public.mock_uuid('u_am_ha'), 'thinhan.vn', null, ''),
 (public.mock_uuid('acc_giongan'), 'Năng lượng Gió Ngàn', 'Gió Ngàn', 'Năng lượng', 'key', 'implementing', public.mock_uuid('u_am_ducanh'), 'giongan.vn', 'Bí mật GN', '');

insert into public.profiles (id, full_name, email, org_type, account_id, role, status, salutation) values
 (public.mock_uuid('u_client_minh'), 'Trần Quang Minh', 'minh@coxanh.vn', 'client', public.mock_uuid('acc_coxanh'), 'client_owner', 'active', 'anh'),
 (public.mock_uuid('u_client_lan'), 'Phạm Thu Lan', 'lan@coxanh.vn', 'client', public.mock_uuid('acc_coxanh'), 'client_member', 'active', 'chị'),
 (public.mock_uuid('u_client_ta'), 'Owner Thịnh An', 'owner@thinhan.vn', 'client', public.mock_uuid('acc_thinhan'), 'client_owner', 'active', 'anh');

insert into public.projects (id, account_id, name, code, start_date, end_date) values
 (public.mock_uuid('p_cx1'), public.mock_uuid('acc_coxanh'), 'App bán hàng đa kênh', 'CX-APP', public.today_vn() - 60, public.today_vn() + 90),
 (public.mock_uuid('p_ta1'), public.mock_uuid('acc_thinhan'), 'Cổng ngân hàng số', 'TA-1', public.today_vn() - 10, public.today_vn() + 120),
 (public.mock_uuid('p_gn1'), public.mock_uuid('acc_giongan'), 'Giám sát trạm', 'GN-1', public.today_vn() - 30, public.today_vn() + 90);

insert into public.milestones (id, project_id, name, order_no, planned_date, client_visible, status, completed_at) values
 (public.mock_uuid('m_kickoff'), public.mock_uuid('p_cx1'), 'Kickoff', 1, public.today_vn() - 50, true, 'done', now() - interval '50 days'),
 (public.mock_uuid('m_design'), public.mock_uuid('p_cx1'), 'Thiết kế', 2, public.today_vn() + 5, true, 'upcoming', null),
 (public.mock_uuid('m_uat'), public.mock_uuid('p_cx1'), 'UAT', 3, public.today_vn() + 22, true, 'upcoming', null),
 (public.mock_uuid('m_hidden'), public.mock_uuid('p_cx1'), 'Rà soát nội bộ', 4, public.today_vn() + 30, false, 'upcoming', null),
 (public.mock_uuid('m_golive'), public.mock_uuid('p_cx1'), 'Go-live', 5, public.today_vn() + 40, true, 'upcoming', null),
 (public.mock_uuid('m_gn_uat'), public.mock_uuid('p_gn1'), 'UAT', 1, public.today_vn() + 10, true, 'upcoming', null);

insert into public.tasks (id, project_id, milestone_id, title, side, type, assignee_id, requires_owner, waiting_on, due_date, status, impact_text, client_visible, created_by) values
 (public.mock_uuid('t_approve'), public.mock_uuid('p_cx1'), public.mock_uuid('m_design'), 'Duyệt thiết kế màn hình Đặt hàng', 'client', 'approval', public.mock_uuid('u_client_minh'), false, 'client', public.today_vn() - 6, 'todo', 'Nếu chưa duyệt, New Era chưa thể lập trình phần Đặt hàng.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_code'), public.mock_uuid('p_cx1'), public.mock_uuid('m_uat'), 'Lập trình phần Đặt hàng', 'internal', 'work', public.mock_uuid('u_member_tuan'), false, 'internal', public.today_vn() + 10, 'todo', 'Mốc UAT lùi theo.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_hidden'), public.mock_uuid('p_cx1'), null, 'Rà soát chi phí nội bộ', 'internal', 'work', public.mock_uuid('u_am_ha'), false, 'internal', public.today_vn() - 2, 'todo', '', false, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_upload'), public.mock_uuid('p_cx1'), null, 'Cung cấp danh mục sản phẩm và giá bán', 'client', 'upload', null, false, 'client', public.today_vn() + 3, 'todo', 'Chưa nhập được dữ liệu sản phẩm.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_confirm'), public.mock_uuid('p_cx1'), null, 'Xác nhận tham dự workshop UAT', 'client', 'attend', public.mock_uuid('u_client_lan'), false, 'client', public.today_vn() + 2, 'todo', 'Workshop phải dời lịch.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_answer'), public.mock_uuid('p_cx1'), null, 'Trả lời câu hỏi về thuế suất', 'client', 'answer', null, false, 'client', public.today_vn() + 7, 'todo', 'Chưa cấu hình được thuế.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_done_late'), public.mock_uuid('p_cx1'), null, 'Duyệt phạm vi dự án', 'client', 'approval', public.mock_uuid('u_client_minh'), false, null, public.today_vn() - 40, 'done', 'Chưa chốt phạm vi.', true, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_gn_late'), public.mock_uuid('p_gn1'), null, 'Cấu hình máy chủ giám sát', 'internal', 'work', public.mock_uuid('u_am_ducanh'), false, 'internal', public.today_vn() - 4, 'todo', 'Mốc UAT lùi.', true, public.mock_uuid('u_am_ducanh'));

update public.tasks
   set completed_at = (public.today_vn() - 38)::timestamp at time zone 'Asia/Ho_Chi_Minh' + interval '10 hours'
 where id = public.mock_uuid('t_done_late');

insert into public.task_dependencies (task_id, blocks_task_id, blocks_milestone_id, created_by) values
 (public.mock_uuid('t_approve'), public.mock_uuid('t_code'), null, public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_approve'), null, public.mock_uuid('m_design'), public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_code'), null, public.mock_uuid('m_uat'), public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_hidden'), null, public.mock_uuid('m_hidden'), public.mock_uuid('u_am_ha')),
 (public.mock_uuid('t_gn_late'), null, public.mock_uuid('m_gn_uat'), public.mock_uuid('u_am_ducanh'));

insert into public.comments (task_id, author_id, body, visibility) values
 (public.mock_uuid('t_approve'), public.mock_uuid('u_am_ha'), 'Ghi chú nội bộ: chờ anh Minh đi công tác về.', 'internal'),
 (public.mock_uuid('t_approve'), public.mock_uuid('u_am_ha'), 'Anh Minh xem giúp em bản thiết kế nhé.', 'shared');

insert into public.files (account_id, project_id, task_id, name, mime, size, storage_path, visibility, kind, uploaded_by) values
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('p_cx1'), public.mock_uuid('t_approve'), 'Thiết kế Đặt hàng.svg', 'image/svg+xml', 1200, 'sample:design1', 'shared', 'design', public.mock_uuid('u_am_ha')),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('p_cx1'), null, 'Dự toán chi phí nội bộ.pdf', 'application/pdf', 5000, 'sample:internal1', 'internal', 'document', public.mock_uuid('u_am_ha')),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('p_cx1'), null, 'Hợp đồng.pdf', 'application/pdf', 5000, 'sample:contract1', 'shared', 'contract', public.mock_uuid('u_am_ha'));

insert into public.price_items (id, code, name, unit, list_price, cost_price, category) values
 (public.mock_uuid('pi_lic'), 'LIC-USER', 'Bản quyền người dùng', 'user', 1000000, 400000, 'Bản quyền'),
 (public.mock_uuid('pi_dev'), 'DEV-MD', 'Phát triển (man-day)', 'manday', 4000000, 2500000, 'Dịch vụ'),
 (public.mock_uuid('pi_unused'), 'SUP-M', 'Hỗ trợ theo tháng', 'month', 9000000, 3000000, 'Dịch vụ');

insert into public.account_prices (account_id, price_item_id, negotiated_price) values
 (public.mock_uuid('acc_thinhan'), public.mock_uuid('pi_dev'), 3800000);

insert into public.quotes (id, account_id, project_id, code, title, version, status, valid_until, discount_pct_total, sent_at, sent_by, internal_note, created_by) values
 (public.mock_uuid('q_cx'), public.mock_uuid('acc_coxanh'), public.mock_uuid('p_cx1'), 'BG-CX-01', 'Phụ lục mở rộng 20 người dùng', 1, 'sent', public.today_vn() + 20, 0, now(), public.mock_uuid('u_am_ha'), 'Biên lợi nhuận thấp', public.mock_uuid('u_am_ha')),
 (public.mock_uuid('q_ta'), public.mock_uuid('acc_thinhan'), public.mock_uuid('p_ta1'), 'BG-TA-01', 'Triển khai cổng ngân hàng số', 2, 'draft', public.today_vn() + 30, 15, null, null, 'Chiết khấu cao để giữ khách', public.mock_uuid('u_am_ha')),
 (public.mock_uuid('q_cx_draft'), public.mock_uuid('acc_coxanh'), null, 'BG-CX-02', 'Nháp nội bộ', 1, 'draft', public.today_vn() + 30, 0, null, null, null, public.mock_uuid('u_am_ha'));

insert into public.quote_lines (quote_id, price_item_id, qty, unit_price, discount_pct, vat_rate, sort_order) values
 (public.mock_uuid('q_cx'), public.mock_uuid('pi_lic'), 20, 1000000, 0, 10, 1),
 (public.mock_uuid('q_ta'), public.mock_uuid('pi_dev'), 50, 3800000, 0, 8, 1),
 (public.mock_uuid('q_cx_draft'), public.mock_uuid('pi_unused'), 1, 9000000, 0, 10, 1);

insert into public.tasks (id, project_id, title, side, type, assignee_id, requires_owner, due_date, impact_text, quote_id, created_by) values
 (public.mock_uuid('t_quote'), public.mock_uuid('p_cx1'), 'Xem và chấp thuận báo giá “Phụ lục mở rộng 20 người dùng” (v1)', 'client', 'approval', public.mock_uuid('u_client_minh'), true, public.today_vn() + 5, 'Nếu chưa phản hồi, New Era chưa thể chốt phạm vi.', public.mock_uuid('q_cx'), public.mock_uuid('u_am_ha'));

insert into public.contracts (id, account_id, code, title, value, signed_date, start_date, end_date, status) values
 (public.mock_uuid('c_cx'), public.mock_uuid('acc_coxanh'), 'HĐ-CX-01', 'Hợp đồng triển khai App bán hàng', 1200000000, public.today_vn() - 60, public.today_vn() - 60, public.today_vn() + 300, 'active');

insert into public.payment_schedules (id, contract_id, name, percent, amount, milestone_id, due_date, status, invoice_no, invoiced_at) values
 (public.mock_uuid('ps_1'), public.mock_uuid('c_cx'), 'Đợt 1', 30, 360000000, public.mock_uuid('m_kickoff'), public.today_vn() - 12, 'invoiced', 'HD001', now() - interval '20 days'),
 (public.mock_uuid('ps_2'), public.mock_uuid('c_cx'), 'Đợt 2', 40, 480000000, public.mock_uuid('m_design'), public.today_vn() + 10, 'not_due', null, null);

insert into public.tasks (id, project_id, title, side, type, assignee_id, due_date, impact_text, payment_schedule_id, created_by) values
 (public.mock_uuid('t_pay'), public.mock_uuid('p_cx1'), 'Thanh toán Đợt 1 (hợp đồng HĐ-CX-01)', 'client', 'payment', public.mock_uuid('u_client_minh'), public.today_vn() - 12, '“Đợt 1” đã đến hạn.', public.mock_uuid('ps_1'), public.mock_uuid('u_am_ha'));

update public.payment_schedules set task_id = public.mock_uuid('t_pay') where id = public.mock_uuid('ps_1');

insert into public.activities (account_id, actor_id, action, target_type, target_id, params, visibility) values
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('u_am_ha'), 'task.created', 'task', public.mock_uuid('t_hidden')::text, '{"task": "Rà soát chi phí nội bộ"}', 'shared'),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('u_am_ha'), 'quote.sent', 'quote', public.mock_uuid('q_cx')::text, '{"quote": "Phụ lục mở rộng 20 người dùng"}', 'shared'),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('u_client_minh'), 'task.approved', 'task', public.mock_uuid('t_done_late')::text, '{"task": "Duyệt phạm vi dự án"}', 'shared'),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('u_am_ha'), 'task.status_changed', 'task', public.mock_uuid('t_code')::text, '{}', 'internal'),
 (public.mock_uuid('acc_coxanh'), public.mock_uuid('u_am_ha'), 'milestone.updated', 'milestone', public.mock_uuid('m_hidden')::text, '{}', 'shared');
