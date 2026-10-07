/** Shared sizes for AccountLogo / UserAvatar / NewEraLogo: xs 20px · sm 28px · md 36px · lg 48px. */
export type IdentitySize = 'xs' | 'sm' | 'md' | 'lg';

export const IDENTITY_BOX: Record<IdentitySize, string> = {
  // initials stay readable for C-level readers on phones: ≥ 11px at xs, 12px from sm
  xs: 'h-5 w-5 text-[11px] tracking-tight',
  sm: 'h-7 w-7 text-[12px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-12 w-12 text-[16px]',
};

export const IDENTITY_TEXT: Record<IdentitySize, string> = {
  xs: 'text-caption',
  sm: 'text-table',
  md: 'text-body',
  lg: 'text-[18px] leading-7',
};
