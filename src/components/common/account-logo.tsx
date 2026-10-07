import { useEffect, useState } from 'react';
import type { AccountRef } from '@/services/contract';
import { initials } from '@/domain/naming';
import { cx } from './cx';
import { IDENTITY_BOX } from './identity-sizes';
import type { IdentitySize } from './identity-sizes';

export interface AccountLogoProps {
  account: Pick<AccountRef, 'name' | 'logo_url' | 'brand_color'> & Partial<AccountRef>;
  /** xs 20 · sm 28 · md 36 (default) · lg 48 */
  size?: IdentitySize;
  /** 2px card-coloured ring (overlapping stacks, logos on tinted backgrounds) */
  ring?: boolean;
  className?: string;
}

/** Client logo, or initials in white on the account's brand colour. Company logos are rounded squares. */
export function AccountLogo({ account, size = 'md', ring = false, className }: AccountLogoProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [account.logo_url]);
  const radius = size === 'xs' ? 'rounded-md' : size === 'lg' ? 'rounded-xl' : 'rounded-lg';
  const ringCls = ring ? 'ring-2 ring-card' : '';

  if (account.logo_url && !broken) {
    return (
      <img
        src={account.logo_url}
        alt={account.name}
        onError={() => setBroken(true)}
        className={cx(IDENTITY_BOX[size], radius, 'shrink-0 border border-border/70 bg-card object-contain', ringCls, className)}
      />
    );
  }
  const brand = account.brand_color?.trim();
  return (
    <span
      role="img"
      aria-label={account.name}
      title={account.name}
      className={cx(
        IDENTITY_BOX[size],
        radius,
        // the inset hairline keeps light brand colours from melting into the card
        'relative inline-flex shrink-0 select-none items-center justify-center font-semibold leading-none tracking-wide text-primary-foreground shadow-[inset_0_0_0_1px_rgb(var(--ink)/0.08)]',
        !brand && 'bg-primary',
        ringCls,
        className,
      )}
      // brand_color is account data (not a design token), so it is applied inline
      style={brand ? { backgroundColor: brand } : undefined}
    >
      {/* short_name drops industry prefixes: 'Ngân hàng Thịnh An' → 'Thịnh An' → 'TA' */}
      {initials(account.short_name?.trim() || account.name)}
    </span>
  );
}
