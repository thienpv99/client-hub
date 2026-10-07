import { SSO_ALLOWED_DOMAIN } from '@/config/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** New Era staff (@SSO_ALLOWED_DOMAIN) sign in with a password; every other address gets a one-time code */
export function isStaffEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  return at > 0 && e.slice(at + 1) === SSO_ALLOWED_DOMAIN.toLowerCase();
}

/** keep digits only, max 6 */
export function cleanOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}
