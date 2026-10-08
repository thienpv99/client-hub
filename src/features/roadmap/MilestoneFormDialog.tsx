// "Thêm mốc" / "Sửa mốc": name, planned date, short description (+ "Khách thấy được" when adding).
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { MilestoneView, ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { addDays, isValidISODate } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateField } from './DateField';

export interface MilestoneFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  project: ProjectView;
  /** null = add a new milestone at the end of the project */
  milestone: MilestoneView | null;
}

function defaultPlanned(project: ProjectView): string {
  const last = [...project.milestones].sort((a, b) => b.order_no - a.order_no)[0];
  const base = last ? addDays(last.planned_date, 14) : addDays(todayISO(), 14);
  return base;
}

export function MilestoneFormDialog({ open, onOpenChange, project, milestone }: MilestoneFormDialogProps) {
  const ids = useId();
  const editing = milestone !== null;
  const { run, pending, pendingVisible } = useAction();
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(milestone?.name ?? '');
    setPlanned(milestone?.planned_date ?? defaultPlanned(project));
    setDescription(milestone?.description ?? '');
    setVisible(true);
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  // neighbours in the project order → gentle warning when the date breaks the sequence
  const warning = useMemo(() => {
    if (!isValidISODate(planned)) return null;
    const ordered = [...project.milestones].sort((a, b) => a.order_no - b.order_no);
    if (!milestone) {
      const last = ordered[ordered.length - 1];
      return last && planned < last.planned_date
        ? t('roadmap.form.warnBeforeLast', { name: last.name, date: formatDateShort(last.planned_date) })
        : null;
    }
    const i = ordered.findIndex((m) => m.id === milestone.id);
    const prev = i > 0 ? ordered[i - 1] : undefined;
    const next = i >= 0 ? ordered[i + 1] : undefined;
    if (prev && planned < prev.planned_date) return t('roadmap.form.warnBefore', { name: prev.name, date: formatDateShort(prev.planned_date) });
    if (next && planned > next.planned_date) return t('roadmap.form.warnAfter', { name: next.name, date: formatDateShort(next.planned_date) });
    return null;
  }, [planned, project.milestones, milestone]);

  const trimmed = name.trim();
  const nameError = touched && !trimmed ? t('roadmap.form.nameRequired') : null;
  const dateError = touched && !isValidISODate(planned) ? t('roadmap.form.dateRequired') : null;
  const valid = trimmed.length > 0 && isValidISODate(planned);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!valid || pending) return;
    const desc = description.trim() || null;
    if (!milestone) {
      const created = await run(
        () => api.createMilestone(project.id, { name: trimmed, planned_date: planned, client_visible: visible, description: desc }),
        { success: 'roadmap.form.added', successParams: { name: trimmed } },
      );
      if (created) onOpenChange(false);
      return;
    }
    const patch: { name?: string; planned_date?: string; description?: string | null } = {};
    if (trimmed !== milestone.name) patch.name = trimmed;
    if (planned !== milestone.planned_date) patch.planned_date = planned;
    if (desc !== (milestone.description ?? null)) patch.description = desc;
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    const saved = await run(() => api.updateMilestone(milestone.id, patch), {
      success: 'roadmap.form.saved',
      successParams: { name: trimmed },
    });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('roadmap.form.editTitle', { name: milestone?.name ?? '' }) : t('roadmap.form.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {editing ? t('roadmap.form.editDescription') : t('roadmap.form.addDescription', { project: project.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <FormField label={t('roadmap.form.name')} htmlFor={`${ids}-name`} required error={nameError}>
            <Input
              id={`${ids}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('roadmap.form.namePlaceholder')}
              maxLength={80}
              autoFocus
              autoComplete="off"
            />
          </FormField>
          <DateField
            id={`${ids}-planned`}
            label={t('roadmap.form.planned')}
            value={planned}
            onChange={setPlanned}
            required
            warning={warning}
            hint={editing && planned !== milestone?.planned_date ? t('roadmap.form.plannedHint') : undefined}
            error={dateError}
          />
          <FormField label={t('roadmap.form.description')} htmlFor={`${ids}-desc`} hint={t('common.optional')}>
            <Textarea
              id={`${ids}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('roadmap.form.descriptionPlaceholder')}
              rows={2}
              maxLength={240}
            />
          </FormField>
          {!editing ? (
            <label
              htmlFor={`${ids}-visible`}
              className="flex min-h-tap cursor-pointer items-start justify-between gap-4 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60"
            >
              <span className="min-w-0">
                <span className="block text-table font-medium text-foreground">{t('roadmap.visible.label')}</span>
                <span className="mt-0.5 block text-caption">{t('roadmap.form.visibleHint')}</span>
              </span>
              <Switch id={`${ids}-visible`} checked={visible} onCheckedChange={setVisible} className="mt-0.5" />
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={touched && !valid}>
              {editing ? t('roadmap.form.submitEdit') : t('roadmap.form.submitAdd')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
