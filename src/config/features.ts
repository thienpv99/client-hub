// Feature flags (SPEC-CARE §1). The team cannot take on new clients yet, so prospecting ("Khách hàng mục tiêu") and
// sales ("Bán hàng" / CRM pipeline) are hidden — the code, services, self tests and data stay in place.
//   sales: false   → no "Bán hàng" nav item, /app/crm* → /app, no account tab `sales`, no CRM entries in the command
//                    palette or dashboard teasers, no "Cơ hội" metric on the client map, and LogInteractionDialog hides
//                    its opportunity / follow-up fields (a care touch is still logged with api.logInteraction).
//   targets: false → no "Khách hàng mục tiêu" nav item, /app/targets* → /app, the map never shows leads.
// UI hiding belongs to the screens; this file is the single switch.

export const FEATURES = { sales: false, targets: false } as const;

export type FeatureFlag = keyof typeof FEATURES;

/** `isFeatureOn('sales')` — reads the flag through a function so a flipped flag never folds into dead code checks */
export function isFeatureOn(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
