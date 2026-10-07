// i18n namespace 'activityCommercial' — owner: services-commercial (D). Merged into `activity.*` by i18n/index.ts.
// Activity sentences: t('activity.<action>', { actor, ...params }). Rows come from the seed AND from the services,
// so each sentence only uses params every writer provides:
//   quote.*    { quote: title, version }  (+ code; reason on changes_requested / approval_rejected; optional note, discount)
//   contract.* { quote: title, amount }
//   payment.*  { note: installment name, amount: formatted VND } (+ contract, invoice, days, state)
// commercialGen.*: texts the commercial services write into data (generated task titles, descriptions, impact texts).
const activityCommercial = {
  quote: {
    created: '{actor} đã tạo báo giá “{quote}” (v{version})',
    updated: '{actor} đã cập nhật báo giá “{quote}” (v{version})',
    version_created: '{actor} đã tạo phiên bản v{version} của báo giá “{quote}”',
    approval_requested: '{actor} đã gửi Giám đốc duyệt chiết khấu báo giá “{quote}” (v{version})',
    approved: '{actor} đã duyệt chiết khấu báo giá “{quote}” (v{version})',
    approval_rejected: '{actor} đã từ chối duyệt chiết khấu báo giá “{quote}” (v{version}): {reason}',
    sent: '{actor} đã gửi báo giá “{quote}” (v{version}) cho khách',
    accepted: '{actor} đã chấp thuận báo giá “{quote}” (v{version})',
    changes_requested: '{actor} đề nghị điều chỉnh báo giá “{quote}” (v{version}): {reason}',
    expired: 'Báo giá “{quote}” (v{version}) đã hết hiệu lực',
  },
  contract: {
    created: '{actor} đã tạo hợp đồng cho “{quote}” ({amount})',
  },
  // installment names already read "Đợt 2 – Hoàn thành khảo sát", so sentences do not repeat "đợt"
  payment: {
    invoice_due: '“{note}” ({amount}) đã đến hạn xuất hóa đơn',
    invoiced: '{actor} đã xuất hóa đơn “{note}” ({amount})',
    reported: '{actor} đã báo chuyển khoản “{note}” ({amount})',
    paid: '{actor} đã xác nhận nhận thanh toán “{note}” ({amount})',
    overdue: '“{note}” ({amount}) đã quá hạn thanh toán',
    reopened: '{actor} đã chuyển “{note}” ({amount}) về trạng thái chưa thu',
    auto_task_toggled: '{actor} đã {state} việc “Thanh toán” tự động cho “{note}”',
  },
  commercialGen: {
    quote_task_title: 'Xem và chấp thuận báo giá “{quote}” (v{version})',
    quote_task_description:
      'Báo giá {code} phiên bản v{version}, hiệu lực đến {valid_until}. Mở báo giá để xem chi tiết, sau đó chấp thuận hoặc đề nghị điều chỉnh.',
    quote_task_impact:
      'Nếu chưa phản hồi trước {due}, New Era chưa thể chốt phạm vi và lịch triển khai cho “{quote}”. Báo giá hết hiệu lực sau {valid_until}.',
    payment_task_title: 'Thanh toán {payment} (hợp đồng {contract})',
    payment_task_description:
      'Hóa đơn {invoice} · Số tiền {amount} · Hạn thanh toán {due}. Sau khi chuyển khoản, bấm “Báo đã chuyển khoản” và đính kèm chứng từ.',
    payment_task_description_no_invoice:
      'Số tiền {amount} · Hạn thanh toán {due}. Sau khi chuyển khoản, bấm “Báo đã chuyển khoản” và đính kèm chứng từ.',
    payment_task_impact:
      '“{payment}” ({amount}) đến hạn ngày {due}. Nếu chưa thanh toán trước ngày này, khoản thanh toán sẽ chuyển sang quá hạn.',
    auto_on: 'bật',
    auto_off: 'tắt',
    price_list_section: 'bảng giá ({item})',
    account_price_field: 'đơn giá riêng cho {item}',
  },
};

export default activityCommercial;
