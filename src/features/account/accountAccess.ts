// What the current viewer may do on an account page. The service layer enforces every rule; these flags only
// decide which controls to show (director / the account's AM manage, the director reassigns the AM, commercial
// data is shown only when the api returned it).
import type { AccountDetail, Viewer } from '@/services/contract';
import { useViewer } from '@/hooks/useViewer';

export interface AccountAccess {
  /** director, or the AM in charge of this account (not in "Xem như khách hàng") */
  manage: boolean;
  /** director: reassign the AM */
  assignAm: boolean;
  /** New Era staff with write access (upload internal documents) */
  internal: boolean;
  /** the api returned commercial data for this viewer */
  commercial: boolean;
  /** "Bán hàng" tab (CRM, ARCHITECTURE §13): director and AM only — the CRM api refuses everyone else */
  sales: boolean;
}

export function accountAccess(viewer: Viewer | null, account: Pick<AccountDetail, 'am' | 'commercial'>): AccountAccess {
  const commercial = account.commercial !== null;
  if (!viewer || viewer.org_type !== 'internal' || viewer.read_only) {
    return { manage: false, assignAm: false, internal: false, commercial, sales: false };
  }
  const director = viewer.role === 'director';
  const manage = director || (viewer.role === 'am' && account.am.id === viewer.user.id);
  return { manage, assignAm: director, internal: true, commercial, sales: director || viewer.role === 'am' };
}

export function useAccountAccess(account: Pick<AccountDetail, 'am' | 'commercial'>): AccountAccess {
  return accountAccess(useViewer(), account);
}
