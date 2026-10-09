// What the current viewer may do on an account page. The service layer enforces every rule; these flags only
// decide which controls to show (director / the account's AM manage, the director reassigns the AM, commercial
// data is shown only when the api returned it).
import type { AccountDetail, Viewer } from '@/services/contract';
import { isFeatureOn } from '@/config/features';
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
  /** "Bán hàng" tab (CRM, ARCHITECTURE §13): director and AM only, and only while the sales feature is on (SPEC-CARE §1) */
  sales: boolean;
  /**
   * care data beyond deployments + requests (expansion map, people & relationships, care plan — SPEC-CARE §4/§5):
   * director and AMs. Members get deployments and the request roll-up only.
   */
  care: boolean;
  /** director: may expand past the delivery-debt gate with a logged reason */
  director: boolean;
}

export function accountAccess(viewer: Viewer | null, account: Pick<AccountDetail, 'am' | 'commercial'>): AccountAccess {
  const commercial = account.commercial !== null;
  if (!viewer || viewer.org_type !== 'internal' || viewer.read_only) {
    return { manage: false, assignAm: false, internal: false, commercial, sales: false, care: false, director: false };
  }
  const director = viewer.role === 'director';
  const am = viewer.role === 'am';
  const manage = director || (am && account.am.id === viewer.user.id);
  return {
    manage,
    assignAm: director,
    internal: true,
    commercial,
    sales: isFeatureOn('sales') && (director || am),
    care: director || am,
    director,
  };
}

export function useAccountAccess(account: Pick<AccountDetail, 'am' | 'commercial'>): AccountAccess {
  return accountAccess(useViewer(), account);
}
