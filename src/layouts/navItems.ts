// Navigation entries of both layouts (owner G1 / shell).
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Building2,
  Crosshair,
  FileText,
  Flag,
  FolderKanban,
  FolderOpen,
  Handshake,
  House,
  LayoutDashboard,
  ListChecks,
  Orbit,
  Receipt,
  Settings,
} from 'lucide-react';
import type { Role } from '@/services/contract';
import { isFeatureOn, type FeatureFlag } from '@/config/features';

/**
 * Sidebar sections of the internal app (DESIGN §3, SPEC-CARE §6.1): Điều hành: Tổng quan · Khách hàng: Khách hàng,
 * Bản đồ & tập đoàn, Dự án · Vận hành: Việc, Thương mại · Hệ thống. Bán hàng and Khách hàng mục tiêu come back when
 * their feature flags are switched on.
 */
export type NavGroupId = 'overview' | 'customers' | 'operations' | 'system';

export const NAV_GROUPS: NavGroupId[] = ['overview', 'customers', 'operations', 'system'];

export interface NavItem {
  id: string;
  to: string;
  labelKey: string;
  /** one-line label for tight places (icon rail, bottom tab bar); falls back to labelKey */
  shortLabelKey?: string;
  icon: LucideIcon;
  /** exact match (index routes) */
  end?: boolean;
  /** visible only to these roles (default: everyone on that side) */
  roles?: Role[];
  /** internal sidebar section */
  group?: NavGroupId;
  /** shown only while this feature flag is on (config/features.ts — SPEC-CARE §1) */
  feature?: FeatureFlag;
}

export const INTERNAL_NAV: NavItem[] = [
  { id: 'dashboard', to: '/app', labelKey: 'layout.nav.internal.dashboard', shortLabelKey: 'layout.nav.short.dashboard', icon: LayoutDashboard, end: true, roles: ['director', 'am'], group: 'overview' },
  { id: 'crm', to: '/app/crm', labelKey: 'layout.nav.internal.crm', shortLabelKey: 'layout.nav.short.crm', icon: Handshake, roles: ['director', 'am'], group: 'customers', feature: 'sales' },
  { id: 'targets', to: '/app/targets', labelKey: 'layout.nav.internal.targets', shortLabelKey: 'layout.nav.short.targets', icon: Crosshair, roles: ['director', 'am'], group: 'customers', feature: 'targets' },
  { id: 'accounts', to: '/app/accounts', labelKey: 'layout.nav.internal.accounts', shortLabelKey: 'layout.nav.short.accounts', icon: Building2, group: 'customers' },
  { id: 'map', to: '/app/map', labelKey: 'layout.nav.internal.map', shortLabelKey: 'layout.nav.short.map', icon: Orbit, roles: ['director', 'am'], group: 'customers' },
  { id: 'projects', to: '/app/projects', labelKey: 'layout.nav.internal.projects', shortLabelKey: 'layout.nav.short.projects', icon: FolderKanban, group: 'customers' },
  { id: 'tasks', to: '/app/tasks', labelKey: 'layout.nav.internal.tasks', shortLabelKey: 'layout.nav.short.tasks', icon: ListChecks, group: 'operations' },
  { id: 'commercial', to: '/app/commercial', labelKey: 'layout.nav.internal.commercial', shortLabelKey: 'layout.nav.short.commercial', icon: Receipt, roles: ['director', 'am'], group: 'operations' },
  { id: 'notifications', to: '/app/notifications', labelKey: 'layout.nav.internal.notifications', shortLabelKey: 'layout.nav.short.notifications', icon: Bell, group: 'system' },
  { id: 'settings', to: '/app/settings', labelKey: 'layout.nav.internal.settings', shortLabelKey: 'layout.nav.short.settings', icon: Settings, roles: ['director', 'am'], group: 'system' },
];

export const CLIENT_NAV: NavItem[] = [
  { id: 'home', to: '/portal', labelKey: 'layout.nav.client.home', icon: House, end: true },
  { id: 'tasks', to: '/portal/tasks', labelKey: 'layout.nav.client.tasks', icon: ListChecks },
  { id: 'progress', to: '/portal/progress', labelKey: 'layout.nav.client.progress', icon: Flag },
  { id: 'commercial', to: '/portal/commercial', labelKey: 'layout.nav.client.commercial', icon: FileText, roles: ['client_owner'] },
  { id: 'documents', to: '/portal/documents', labelKey: 'layout.nav.client.documents', icon: FolderOpen },
];

/** Items this role may see, without the ones whose feature flag is off. */
export function navFor(items: NavItem[], role: Role | null | undefined): NavItem[] {
  return items.filter(
    (item) => (!item.feature || isFeatureOn(item.feature)) && (!item.roles || (role ? item.roles.includes(role) : false)),
  );
}

export interface NavSection {
  id: NavGroupId;
  labelKey: string;
  items: NavItem[];
}

/** Items split into the sidebar sections, in NAV_GROUPS order; empty sections are dropped. */
export function groupNav(items: NavItem[]): NavSection[] {
  return NAV_GROUPS.map((id) => ({
    id,
    labelKey: `layout.nav.groups.${id}`,
    items: items.filter((item) => (item.group ?? 'system') === id),
  })).filter((section) => section.items.length > 0);
}

/** The nav entry a path belongs to (longest matching prefix; `end` items match exactly). */
export function navItemForPath(items: NavItem[], pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of items) {
    const hit = item.end
      ? pathname === item.to || pathname === `${item.to}/`
      : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (hit && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}
