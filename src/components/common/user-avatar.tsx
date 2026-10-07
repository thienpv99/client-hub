import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import type { UserRef } from '@/services/contract';
import { initials } from '@/domain/naming';
import { t } from '@/i18n';
import { cx } from './cx';
import { IDENTITY_BOX } from './identity-sizes';
import type { IdentitySize } from './identity-sizes';

export interface UserAvatarProps {
  /** null → neutral person icon (system / unknown) */
  user: Pick<UserRef, 'full_name' | 'avatar_url' | 'org_type'> | null;
  /** xs 20 · sm 28 · md 36 (default) · lg 48 */
  size?: IdentitySize;
  /** 2px card-coloured ring (overlapping stacks `-space-x-2`) */
  ring?: boolean;
  className?: string;
}

/** Round avatar: photo, or initials on one neutral tone (New Era and client alike). */
export function UserAvatar({ user, size = 'md', ring = false, className }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const url = user?.avatar_url ?? null;
  useEffect(() => setBroken(false), [url]);
  const box = cx(IDENTITY_BOX[size], 'shrink-0 rounded-full', ring && 'ring-2 ring-card', className);

  if (!user) {
    return (
      <span
        role="img"
        aria-label={t('components.activity.system')}
        className={cx(
          box,
          'inline-flex items-center justify-center bg-muted text-muted-foreground',
          !ring && 'shadow-[inset_0_0_0_1px_rgb(var(--border))]',
          className,
        )}
      >
        <User className={size === 'xs' ? 'h-3 w-3' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      </span>
    );
  }
  if (url && !broken) {
    return <img src={url} alt={user.full_name} onError={() => setBroken(true)} className={cx(box, 'bg-muted object-cover')} />;
  }
  // one neutral tone for everyone (DESIGN §1.6: blue is for action and selection only — a list of New Era assignees
  // must not fill a card with blue); who is New Era / client is said by captions and the New Era mark, not the fill
  return (
    <span
      role="img"
      aria-label={user.full_name}
      title={user.full_name}
      className={cx(
        box,
        'inline-flex select-none items-center justify-center bg-muted font-semibold leading-none text-muted-foreground',
        // a hairline only when no ring is asked for (the stack ring replaces it)
        !ring && 'shadow-[inset_0_0_0_1px_rgb(var(--border))]',
        className,
      )}
    >
      {initials(user.full_name)}
    </span>
  );
}
