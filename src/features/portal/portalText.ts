// Small wording helpers of the client portal: salutation-aware pronouns, people names, project search string.
import type { UserRef, Viewer } from '@/services/contract';
import { addressName } from '@/domain/naming';
import { capitalize, t } from '@/i18n';
import { PROJECT_PARAM } from '@/hooks/usePortalProject';

export interface Salute {
  /** 'anh' / 'chị' (fallback 'anh/chị') — mid-sentence */
  you: string;
  /** the same, capitalized for the start of a sentence */
  You: string;
  /** 'anh Minh' (full name without a salutation) */
  address: string;
}

/** How the portal addresses the signed-in client (SPEC §7: stored salutation). */
export function saluteOf(viewer: Pick<Viewer, 'user'> | null): Salute {
  const salutation = viewer?.user.salutation ?? null;
  const you = salutation ?? t('portal.youFallback');
  const address = viewer ? addressName(salutation, viewer.user.full_name) : you;
  return { you, You: capitalize(you), address };
}

/**
 * 'Chị Lan' for a client colleague (at the start of a line; `midSentence` → 'chị Lan'), the full name for New Era
 * staff or when no salutation is stored.
 */
export function personName(user: Pick<UserRef, 'salutation' | 'full_name' | 'org_type'> | null, midSentence = false): string {
  if (!user) return t('common.unknownUser');
  if (user.org_type !== 'client' || !user.salutation) return user.full_name;
  const address = addressName(user.salutation, user.full_name);
  return midSentence ? address : capitalize(address);
}

/** '?project=…' to keep the selected project when linking between portal pages ('' = all projects). */
export function projectSearch(projectId: string | null): string {
  return projectId ? `?${PROJECT_PARAM}=${encodeURIComponent(projectId)}` : '';
}

/** search param holding the tab of /portal/tasks (absent = "Cần xử lý") */
export const TASKS_TAB_PARAM = 'tab';

/** Link to one tab of /portal/tasks, keeping the selected project ('?project=…&tab=company'). */
export function tasksTabLink(projectId: string | null, tab: string): { pathname: string; search: string } {
  const params = new URLSearchParams();
  if (projectId) params.set(PROJECT_PARAM, projectId);
  params.set(TASKS_TAB_PARAM, tab);
  return { pathname: '/portal/tasks', search: `?${params.toString()}` };
}

/** 'tel:' href from a display phone number ('0912 345 678' → 'tel:0912345678'). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
