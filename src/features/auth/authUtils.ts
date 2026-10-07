const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** keep digits only, max 6 */
export function cleanOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}
