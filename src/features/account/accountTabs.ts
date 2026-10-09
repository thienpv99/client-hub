// Tabs of the account page (ARCHITECTURE §12, §13 'sales', §14 care refocus): /app/accounts/:accountId/:tab?
// Order = SPEC-CARE §6.4: Tổng quan · Triển khai · Việc · Lộ trình · Mở rộng · Quan hệ · (Bán hàng, flag) · Thương mại ·
// Tài liệu · Hoạt động. Which tabs a viewer gets is decided by AccountDetailPage (accountAccess + feature flags).
export const ACCOUNT_TABS = [
  'overview',
  'delivery',
  'tasks',
  'roadmap',
  'expansion',
  'relationships',
  'sales',
  'commercial',
  'documents',
  'activity',
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** old tab paths that still work: the contact list moved into "Quan hệ" (search results, bookmarks) */
export const LEGACY_ACCOUNT_TABS: Readonly<Record<string, AccountTab>> = { contacts: 'relationships' };

export function isAccountTab(value: string | undefined): value is AccountTab {
  return value !== undefined && (ACCOUNT_TABS as readonly string[]).includes(value);
}

/**
 * overview lives at the bare account path. `params` become the query string — deep links other screens may use:
 *   delivery      ?cr=<requestId> (opens that request) · ?filter=untriaged|debt|in_progress|done|declined
 *   expansion     ?dept=<department key> (opens that department)
 *   relationships ?contact=<contactId> (opens that person's relationship sheet)
 */
export function accountTabPath(accountId: string, tab: AccountTab = 'overview', params?: Record<string, string>): string {
  const base = `/app/accounts/${encodeURIComponent(accountId)}`;
  const path = tab === 'overview' ? base : `${base}/${tab}`;
  const query = params ? new URLSearchParams(params).toString() : '';
  return query ? `${path}?${query}` : path;
}
