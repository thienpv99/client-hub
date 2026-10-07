// i18n namespace 'activityNotify' — owner: services-notify (E): escalation.*. Nested keys, Vietnamese text, {param} placeholders.
// Merged into `activity.*` by src/i18n/index.ts. Escalations are logged by the system (actor null), so no {actor}.
const activityNotify = {
  escalation: {
    sent: 'Đã báo leo thang việc “{task}” (quá hạn {days} ngày, đang giữ mốc {milestone}) tới {to}',
  },
};

export default activityNotify;
