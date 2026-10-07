// Email helpers for invite forms: the user types only the part before "@domain" (the company domain is shown and
// enforced next to the field), so an invite can never leave the client's email domain (SPEC §2).

const LOCAL_RE = /^[a-z0-9._%+-]+$/;

/** lowercase, no spaces; a pasted full address of the same domain keeps only the part before "@" */
export function normalizeEmailLocal(raw: string, domain: string): string {
  let value = raw.replace(/\s+/g, '').toLowerCase();
  const suffix = `@${domain.trim().toLowerCase()}`;
  if (domain && value.endsWith(suffix)) value = value.slice(0, -suffix.length);
  return value;
}

/** i18n key describing what is wrong with the part before "@", or null when it is fine */
export function emailLocalProblem(local: string, required: boolean): string | null {
  if (!local) return required ? 'settings.email.required' : null;
  if (local.includes('@')) return 'settings.email.noAt';
  if (!LOCAL_RE.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return 'settings.email.invalid';
  }
  return null;
}

export function fullEmail(local: string, domain: string): string {
  return `${local.trim().toLowerCase()}@${domain.trim().toLowerCase()}`;
}

/** domain part of an address ('nam.le@newera.inc' → 'newera.inc') */
export function emailDomainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}
