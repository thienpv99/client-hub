// Tabs of the account page (ARCHITECTURE §12, §13 'sales'): /app/accounts/:accountId/:tab?
export const ACCOUNT_TABS = ['overview', 'tasks', 'roadmap', 'sales', 'commercial', 'documents', 'contacts', 'activity'] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function isAccountTab(value: string | undefined): value is AccountTab {
  return value !== undefined && (ACCOUNT_TABS as readonly string[]).includes(value);
}

/** overview lives at the bare account path */
export function accountTabPath(accountId: string, tab: AccountTab = 'overview'): string {
  const base = `/app/accounts/${encodeURIComponent(accountId)}`;
  return tab === 'overview' ? base : `${base}/${tab}`;
}
