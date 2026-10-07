import { t } from '@/i18n';
import { cx } from './cx';
import { IDENTITY_BOX, IDENTITY_TEXT } from './identity-sizes';
import type { IdentitySize } from './identity-sizes';

/** The New Era mark alone (rounded blue square with an "N" stroke). Decorative unless `label` is given. */
export function NewEraMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cx('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M10.5 21.5V10.5L21.5 21.5V10.5"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface NewEraLogoProps {
  /** xs 20 · sm 28 (default) · md 36 · lg 48 */
  size?: IdentitySize;
  /** show the "New Era" wordmark next to the mark */
  withText?: boolean;
  className?: string;
}

export function NewEraLogo({ size = 'sm', withText = false, className }: NewEraLogoProps) {
  const name = t('components.brand.newEra');
  if (!withText) return <NewEraMark className={cx(IDENTITY_BOX[size], className)} label={name} />;
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <NewEraMark className={IDENTITY_BOX[size]} />
      <span className={cx('whitespace-nowrap font-semibold tracking-tight text-foreground', IDENTITY_TEXT[size])}>{name}</span>
    </span>
  );
}
