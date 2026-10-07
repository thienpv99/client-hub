// System settings (director) and demo data reset.

import type { Settings } from '@/domain/types';
import { ApiError, type Api, type ClientSettings } from '@/services/contract';
import { assertWritable, getSession, requireViewer, setSession } from '@/services/context';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { fieldLabels, invalidateViewCache } from '@/services/views';
import { clearUndoStore } from '@/services/api/tasks';

function copySettings(): Settings {
  const s = db.settings;
  return { ...s, reminder_days_before: [...s.reminder_days_before] };
}

const bad = (field: string): ApiError => new ApiError('validation', 'errors.invalid_settings', { field });

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** keeps only known, valid fields */
function validateSettings(patch: Partial<Settings>): Partial<Settings> {
  const clean: Partial<Settings> = {};
  if (patch.company_name !== undefined) {
    const name = String(patch.company_name).trim();
    if (!name) throw bad('company_name');
    clean.company_name = name;
  }
  if (patch.discount_approval_threshold_pct !== undefined) {
    const v = patch.discount_approval_threshold_pct;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw bad('discount_approval_threshold_pct');
    clean.discount_approval_threshold_pct = v;
  }
  if (patch.escalation_overdue_days !== undefined) {
    if (!isInt(patch.escalation_overdue_days, 1, 60)) throw bad('escalation_overdue_days');
    clean.escalation_overdue_days = patch.escalation_overdue_days;
  }
  if (patch.reminder_days_before !== undefined) {
    const days = patch.reminder_days_before;
    if (!Array.isArray(days) || !days.every((d) => isInt(d, 1, 30))) throw bad('reminder_days_before');
    clean.reminder_days_before = [...new Set(days)].sort((a, b) => b - a);
  }
  if (patch.overdue_reminder_per_day !== undefined) {
    if (!isInt(patch.overdue_reminder_per_day, 0, 3)) throw bad('overdue_reminder_per_day');
    clean.overdue_reminder_per_day = patch.overdue_reminder_per_day;
  }
  if (patch.max_emails_per_day !== undefined) {
    if (!isInt(patch.max_emails_per_day, 1, 20)) throw bad('max_emails_per_day');
    clean.max_emails_per_day = patch.max_emails_per_day;
  }
  if (patch.weekly_digest_weekday !== undefined) {
    if (!isInt(patch.weekly_digest_weekday, 0, 6)) throw bad('weekly_digest_weekday');
    clean.weekly_digest_weekday = patch.weekly_digest_weekday;
  }
  if (patch.weekly_digest_hour !== undefined) {
    if (!isInt(patch.weekly_digest_hour, 0, 23)) throw bad('weekly_digest_hour');
    clean.weekly_digest_hour = patch.weekly_digest_hour;
  }
  if (patch.payment_task_auto !== undefined) {
    if (typeof patch.payment_task_auto !== 'boolean') throw bad('payment_task_auto');
    clean.payment_task_auto = patch.payment_task_auto;
  }
  return clean;
}

export const settingsApi: Pick<Api, 'getSettings' | 'updateSettings' | 'resetDemoData'> = {
  async getSettings() {
    // every signed-in viewer may read it (the portal shows the digest time); a client gets the portal fields only —
    // the discount approval threshold and the escalation / email policy are New Era's internal rules
    const v = requireViewer();
    const all = copySettings();
    if (v.org_type !== 'client') return all;
    const out: ClientSettings = {
      company_name: all.company_name,
      timezone: all.timezone,
      reminder_days_before: all.reminder_days_before,
      weekly_digest_weekday: all.weekly_digest_weekday,
      weekly_digest_hour: all.weekly_digest_hour,
    };
    return out;
  },

  async updateSettings(patch) {
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'internal' || v.role !== 'director') throw new ApiError('forbidden', 'errors.forbidden');
    const clean = validateSettings(patch ?? {});
    const before = db.settings as unknown as Record<string, unknown>;
    const changed = Object.keys(clean).filter(
      (k) => JSON.stringify((clean as unknown as Record<string, unknown>)[k]) !== JSON.stringify(before[k]),
    );
    if (!changed.length) return copySettings();
    db.batch(() => {
      db.updateSettings(clean);
      logActivity({
        account_id: null,
        actor_id: v.user.id,
        action: 'settings.updated',
        target_type: 'settings',
        target_id: 'settings',
        params: { section: fieldLabels(changed) },
        visibility: 'internal',
      });
    });
    return copySettings();
  },

  async resetDemoData() {
    // wipes every account for every open tab: New Era's director or AMs only, never in "Xem như khách hàng"
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'internal' || (v.role !== 'director' && v.role !== 'am')) throw new ApiError('forbidden', 'errors.forbidden');
    clearUndoStore();
    db.reset();
    invalidateViewCache();
    const s = getSession();
    if (!s) return;
    const user = db.find('users', s.user_id);
    if (!user || user.status === 'disabled') {
      setSession(null);
      return;
    }
    const viewAs = s.view_as_account_id && db.find('accounts', s.view_as_account_id) ? s.view_as_account_id : null;
    // re-emit so subscribers rebuild the viewer from the fresh data
    setSession({ ...s, view_as_account_id: viewAs });
  },
};
