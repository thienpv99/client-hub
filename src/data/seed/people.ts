// New Era staff. Ids used by the demo login buttons must stay stable (ARCHITECTURE §9).

import type { User } from '@/domain/types';
import { makeUser, type SeedCtx } from './helpers';

export const DEMO_PASSWORD = 'newera2026';

export function buildInternalUsers(c: SeedCtx): User[] {
  const staff = (u: Parameters<typeof makeUser>[0]): User =>
    makeUser({ password: DEMO_PASSWORD, notification_pref: 'all', status: 'active', ...u });
  return [
    staff({
      id: 'u_director',
      full_name: 'Lê Hoàng Nam',
      email: 'nam.le@newera.inc',
      phone: '0903 118 226',
      role: 'director',
      can_view_cost: true,
      title: 'Giám đốc',
      salutation: 'anh',
      last_login_at: c.at(-1, '08:12'),
    }),
    staff({
      id: 'u_am_ha',
      full_name: 'Nguyễn Thu Hà',
      email: 'ha.nguyen@newera.inc',
      phone: '0912 345 678',
      role: 'am',
      can_view_cost: false,
      title: 'Account Manager',
      salutation: 'chị',
      invited_at: c.at(-420, '10:00'),
      invited_by: 'u_director',
      last_login_at: c.at(-1, '08:40'),
    }),
    staff({
      id: 'u_am_ducanh',
      full_name: 'Trần Đức Anh',
      email: 'ducanh.tran@newera.inc',
      phone: '0918 765 432',
      role: 'am',
      can_view_cost: true,
      title: 'Account Manager',
      salutation: 'anh',
      invited_at: c.at(-380, '10:00'),
      invited_by: 'u_director',
      last_login_at: c.at(-1, '09:05'),
    }),
    staff({
      id: 'u_member_tuan',
      full_name: 'Phạm Minh Tuấn',
      email: 'tuan.pham@newera.inc',
      phone: '0938 221 509',
      role: 'member',
      title: 'Trưởng nhóm kỹ thuật',
      salutation: 'anh',
      invited_at: c.at(-400, '10:00'),
      invited_by: 'u_director',
      last_login_at: c.at(-1, '08:55'),
    }),
    staff({
      id: 'u_member_linh',
      full_name: 'Võ Khánh Linh',
      email: 'linh.vo@newera.inc',
      phone: '0909 454 712',
      role: 'member',
      title: 'Thiết kế UX/UI',
      salutation: 'chị',
      invited_at: c.at(-300, '10:00'),
      invited_by: 'u_director',
      last_login_at: c.at(-1, '09:20'),
    }),
    staff({
      id: 'u_member_quang',
      full_name: 'Đỗ Nhật Quang',
      email: 'quang.do@newera.inc',
      phone: '0977 830 146',
      role: 'member',
      title: 'Phân tích nghiệp vụ (BA)',
      salutation: 'anh',
      invited_at: c.at(-260, '10:00'),
      invited_by: 'u_director',
      last_login_at: c.at(-1, '08:47'),
    }),
  ];
}
