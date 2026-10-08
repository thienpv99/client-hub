// "Tạo nhanh từ mẫu": pick a roadmap template (chain preview), a start date and a project name →
// api.createProject; or add the template's milestones to an existing project that has none (api.applyTemplate).
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ProjectTemplate } from '@/domain/types';
import type { ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { isValidISODate } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ErrorState } from '@/components/common/error-state';
import { DateField } from './DateField';
import { templateSchedule, templateWeeks } from './roadmapUtils';

const SMALL = 'text-[13px] leading-[18px]';

export type TemplateTarget = 'new' | 'apply';

export interface TemplateDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  accountId: string;
  /** a project of the account without milestones the template can be applied to */
  applyCandidate: ProjectView | null;
  defaultTarget: TemplateTarget;
  /** the created / updated project (to select it right away) */
  onDone(project: ProjectView): void;
}

function Chain({ template }: { template: ProjectTemplate }) {
  return (
    <span className={cn('flex flex-wrap items-center gap-x-1 gap-y-0.5 text-foreground', SMALL)}>
      {template.milestones.map((m, i) => (
        <span key={`${m.name}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-caption" aria-hidden="true" /> : null}
          <span>{m.name}</span>
        </span>
      ))}
    </span>
  );
}

export function TemplateDialog({ open, onOpenChange, accountId, applyCandidate, defaultTarget, onDone }: TemplateDialogProps) {
  const ids = useId();
  const { run, pending, pendingVisible } = useAction();
  const templates = useQuery(() => api.listTemplates(), [], { enabled: open });
  const [templateId, setTemplateId] = useState('');
  const [target, setTarget] = useState<TemplateTarget>('new');
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(applyCandidate ? defaultTarget : 'new');
    setName('');
    setStart(todayISO());
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = templates.data ?? [];
  const template = list.find((x) => x.id === templateId) ?? list[0] ?? null;
  useEffect(() => {
    if (open && !templateId && list[0]) setTemplateId(list[0].id);
  }, [open, templateId, list]);

  const schedule = useMemo(() => (template && isValidISODate(start) ? templateSchedule(template, start) : []), [template, start]);
  const applying = target === 'apply' && applyCandidate !== null;
  const trimmed = name.trim();
  const valid = template !== null && isValidISODate(start) && (applying || trimmed.length > 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!valid || !template || pending) return;
    const tpl: ProjectTemplate = template;
    const count = tpl.milestones.length;
    let result: ProjectView | undefined;
    if (target === 'apply' && applyCandidate) {
      const project: ProjectView = applyCandidate;
      result = await run(() => api.applyTemplate(project.id, tpl.id, start), {
        success: 'roadmap.template.applied',
        successParams: { name: project.name, count },
      });
    } else {
      result = await run(() => api.createProject(accountId, { name: trimmed, start_date: start, template_id: tpl.id }), {
        success: 'roadmap.template.created',
        successParams: { name: trimmed, count },
      });
    }
    if (result) {
      onDone(result);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('roadmap.template.title')}</DialogTitle>
          <DialogDescription>
            {applying
              ? t('roadmap.template.descriptionApply', { project: applyCandidate?.name ?? '' })
              : t('roadmap.template.descriptionNew')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
          {applyCandidate ? (
            <div className="space-y-1.5">
              <p className="text-table font-medium text-foreground" id={`${ids}-target`}>
                {t('roadmap.template.target')}
              </p>
              <ToggleGroup
                type="single"
                variant="segmented"
                value={target}
                onValueChange={(v) => (v ? setTarget(v as TemplateTarget) : undefined)}
                aria-labelledby={`${ids}-target`}
                className="flex w-full"
              >
                <ToggleGroupItem value="apply" className="min-w-0 flex-1">
                  <span className="truncate">{t('roadmap.template.targetExisting', { project: applyCandidate.name })}</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="new" className="min-w-0 flex-1">
                  <span className="truncate">{t('roadmap.template.targetNew')}</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-table font-medium text-foreground">{t('roadmap.template.pick')}</legend>
            {templates.loading ? (
              <div className="space-y-2" role="status" aria-busy="true">
                <span className="sr-only">{t('common.loading')}</span>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : templates.error && !templates.data ? (
              <ErrorState error={templates.error} onRetry={templates.refetch} compact />
            ) : list.length === 0 ? (
              <p className="rounded-lg bg-subtle px-4 py-6 text-center text-table text-muted-foreground ring-1 ring-inset ring-border/60">
                {t('roadmap.template.empty')}
              </p>
            ) : (
              <RadioGroup value={template?.id ?? ''} onValueChange={setTemplateId} className="gap-2">
                {list.map((tpl) => {
                  const selected = tpl.id === template?.id;
                  return (
                    <label
                      key={tpl.id}
                      htmlFor={`${ids}-tpl-${tpl.id}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150 ease-out-quart',
                        selected ? 'border-primary-border bg-primary-soft/60' : 'border-border-strong/70 bg-card hover:bg-subtle',
                      )}
                    >
                      <RadioGroupItem id={`${ids}-tpl-${tpl.id}`} value={tpl.id} className="mt-0.5" />
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="text-table font-semibold text-foreground">{tpl.name}</span>
                          <span className={cn('tabular text-muted-foreground', SMALL)}>
                            {t('roadmap.template.meta', { count: tpl.milestones.length, weeks: templateWeeks(tpl) })}
                          </span>
                        </span>
                        {tpl.description ? <span className="block text-caption">{tpl.description}</span> : null}
                        <Chain template={tpl} />
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            )}
          </fieldset>

          <div className={cn('grid gap-4', !applying && 'sm:grid-cols-2')}>
            {!applying ? (
              <FormField
                label={t('roadmap.template.projectName')}
                htmlFor={`${ids}-name`}
                required
                error={touched && !trimmed ? t('roadmap.template.nameRequired') : null}
              >
                <Input
                  id={`${ids}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('roadmap.template.projectNamePlaceholder')}
                  maxLength={80}
                  autoComplete="off"
                />
              </FormField>
            ) : null}
            <DateField
              id={`${ids}-start`}
              label={t('roadmap.template.startDate')}
              value={start}
              onChange={setStart}
              required
              error={touched && !isValidISODate(start) ? t('roadmap.form.dateRequired') : null}
            />
          </div>

          {schedule.length > 0 ? (
            <section aria-labelledby={`${ids}-schedule`} className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:px-4">
              <h3 id={`${ids}-schedule`} className="text-micro font-medium text-muted-foreground">
                {t('roadmap.template.schedule')}
              </h3>
              {/* reads down the first column, then the second */}
              <ol
                className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-flow-col sm:grid-cols-2"
                style={{ gridTemplateRows: `repeat(${Math.ceil(schedule.length / 2)}, auto)` }}
              >
                {schedule.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex items-baseline justify-between gap-3 text-table">
                    <span className="min-w-0 truncate text-foreground">{s.name}</span>
                    <span className="shrink-0 tabular text-muted-foreground">{formatDate(s.date)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={!template || (touched && !valid)}>
              {applying ? t('roadmap.template.submitApply') : t('roadmap.template.submitNew')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
