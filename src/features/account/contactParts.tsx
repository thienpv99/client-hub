// Small pieces shared by the overview's decision makers and the contacts tab.
import { CircleCheck, Mail, UserX } from 'lucide-react';
import type { ContactView } from '@/services/contract';
import { addressName } from '@/domain/naming';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { enumLabel } from '@/components/common/labels';
import { UserAvatar } from '@/components/common/user-avatar';

/** "anh Minh" */
export function contactAddress(c: Pick<ContactView, 'salutation' | 'full_name'>): string {
  return addressName(c.salutation, c.full_name);
}

export function ContactAvatar({ contact, size = 'md' }: { contact: ContactView; size?: 'sm' | 'md' | 'lg' }) {
  return <UserAvatar user={{ full_name: contact.full_name, avatar_url: contact.user?.avatar_url ?? null, org_type: 'client' }} size={size} />;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** "Đang hoạt động" / "Đã mời" / "Chưa có tài khoản" — login status of the contact (icon + word) */
export function LoginStatus({ contact, className }: { contact: ContactView; className?: string }) {
  const user = contact.user;
  if (!user) {
    return (
      <Badge variant="outline" className={className}>
        <UserX aria-hidden="true" />
        {t('account.contacts.noLogin')}
      </Badge>
    );
  }
  if (user.status === 'active') {
    return (
      <Badge variant="success" className={className}>
        <CircleCheck aria-hidden="true" />
        {enumLabel('userStatus', 'active')}
      </Badge>
    );
  }
  return (
    <Badge className={className}>
      {user.status === 'invited' ? <Mail aria-hidden="true" /> : <UserX aria-hidden="true" />}
      {enumLabel('userStatus', user.status)}
    </Badge>
  );
}
