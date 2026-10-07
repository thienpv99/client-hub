// "Đánh dấu thắng": optionally start the delivery project from a roadmap template, then link to its roadmap.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheck } from 'lucide-react';
import type { ID } from '@/domain/types';
import type { OpportunityView, WinInput } from '@/services/crmContract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { addDays, weekday } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { crmPaths } from '@/components/crm/crmLabels';
import { DateField } from '@/components/crm/fields';

export type WinTarget = Pick<OpportunityView, 'id' | 'name' | 'account' | 'project_id'>;

export interface WinDialogProps {
  opportunity: WinTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWon?: (result: { opportunity_id: ID; project_id: ID | null }) => void;
}

/** next Monday (a project rarely starts the day it is won) */
function nextMonday(today: string): string {
  const d = weekday(today);
  return addDays(today, d === 0 ? 1 : 8 - d);
}

export function WinDialog({ opportunity, open, onOpenChange, onWon }: WinDialogProps) {
  const uid = useId();
  const { run, pending } = useAction();
  const [createProject, setCreateProject] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<{ project_id: ID | null; kept: boolean } | null>(null);

  const templatesQ = useQuery(() => api.listTemplates(), [], { enabled: open });
  const templates = templatesQ.data ?? [];

  // reset when (re)opened for a deal — keyed by id: a refetch after winning must not drop the "done" view
  const oppId = opportunity?.id ?? null;
  useEffect(() => {
    if (!open || !opportunity) return;
    setCreateProject(opportunity.project_id === null);
    setProjectName(opportunity.name);
    setStartDate(nextMonday(todayISO()));
    setNote('');
    setTouched(false);
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, oppId]);

  // first template by default once they load
  useEffect(() => {
    if (open && templateId === '' && templates.length > 0) setTemplateId(templates[0]?.id ?? '');
  }, [open, templateId, templates]);

  if (!opportunity) return null;
  // a deal reopened after a win keeps its delivery project (the service never starts a second one)
  const keepsProject = opportunity.project_id !== null;
  const wantsProject = createProject && !keepsProject;
  const nameError = touched && wantsProject && projectName.trim() === '' ? t('crm.win.errors.projectName') : null;
  const dateError = touched && wantsProject && !startDate ? t('crm.win.errors.startDate') : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!opportunity) return;
    setTouched(true);
    if (wantsProject && (projectName.trim() === '' || !startDate)) return;
    const input: WinInput = {
      create_project: wantsProject,
      project_name: projectName.trim(),
      start_date: startDate || todayISO(),
      template_id: wantsProject && templateId ? templateId : null,
      note: note.trim() || null,
    };
    const result = await run(() => api.winOpportunity(opportunity.id, input), {
      success: input.create_project ? 'crm.win.toastProject' : 'crm.win.toast',
      successParams: { name: opportunity.name, project: input.project_name },
    });
    if (!result) return;
    setDone({ project_id: result.project_id, kept: keepsProject });
    onWon?.({ opportunity_id: opportunity.id, project_id: result.project_id });
  }

  const ids = { name: `${uid}-name`, template: `${uid}-template`, start: `${uid}-start`, note: `${uid}-note`, toggle: `${uid}-toggle` };

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                {t('crm.win.doneTitle')}
              </DialogTitle>
              <DialogDescription>
                {done.project_id && done.kept
                  ? t('crm.win.doneKeptProject', { name: opportunity.name, account: opportunity.account.name })
                  : done.project_id
                    ? t('crm.win.doneProject', { name: opportunity.name, account: opportunity.account.name })
                    : t('crm.win.doneNoProject', { name: opportunity.name, account: opportunity.account.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button asChild>
                <Link to={done.project_id ? crmPaths.accountRoadmap(opportunity.account.id, done.project_id) : crmPaths.account(opportunity.account.id)}>
                  {done.project_id ? t('crm.win.openRoadmap') : t('crm.win.openAccount')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('crm.win.title')}</DialogTitle>
              <DialogDescription>
                {t(keepsProject ? 'crm.win.descriptionKeep' : 'crm.win.description', { name: opportunity.name, account: opportunity.account.name })}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
              {keepsProject ? (
                <p className="rounded-lg bg-subtle p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/60">{t('crm.win.hasProject')}</p>
              ) : (
                <label
                  htmlFor={ids.toggle}
                  className="flex min-h-tap cursor-pointer items-start justify-between gap-4 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60"
                >
                  <span className="min-w-0">
                    <span className="block text-table font-medium text-ink">{t('crm.win.createProject')}</span>
                    <span className="mt-0.5 block text-caption">{t('crm.win.createProjectHint')}</span>
                  </span>
                  <Switch id={ids.toggle} checked={createProject} onCheckedChange={setCreateProject} className="mt-0.5" />
                </label>
              )}

              {wantsProject ? (
                <div className="space-y-4">
                  <FormField label={t('crm.win.projectName')} htmlFor={ids.name} required error={nameError}>
                    <Input id={ids.name} value={projectName} maxLength={160} onChange={(e) => setProjectName(e.target.value)} />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={t('crm.win.template')} htmlFor={ids.template}>
                      <NativeSelect
                        id={ids.template}
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                        disabled={templatesQ.loading}
                      >
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                        <option value="">{t('crm.win.noTemplate')}</option>
                      </NativeSelect>
                    </FormField>
                    <DateField id={ids.start} label={t('crm.win.startDate')} required error={dateError} value={startDate} onChange={setStartDate} />
                  </div>
                </div>
              ) : null}

              <FormField label={t('crm.win.note')} htmlFor={ids.note}>
                <Textarea id={ids.note} rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              </FormField>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={pending}>
                  {t('crm.win.submit')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
