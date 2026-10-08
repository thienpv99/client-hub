// Step 3 — Chọn mẫu lộ trình: project name, start date, template choices (chain with real dates) or "Không dùng
// mẫu", then the review of the whole account before "Tạo khách hàng".
import type { ReactNode } from 'react';
import { CircleAlert, FilePlus2 } from 'lucide-react';
import type { ProjectTemplate } from '@/domain/types';
import { addDays, isValidISODate } from '@/domain/dates';
import { cn } from '@/components/ui/cn';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { CHOICE_CARD_OFF, CHOICE_CARD_ON, GroupField } from '@/features/settings/fieldParts';
import { TemplateChain, templateSpanDays } from '@/features/settings/TemplateChain';
import { NO_TEMPLATE, type ProjectDraft, type ProjectErrors } from './wizardModel';

function lastMilestone(tpl: ProjectTemplate): { name: string; offset_days: number } | null {
  return tpl.milestones.reduce<{ name: string; offset_days: number } | null>(
    (best, m) => (!best || m.offset_days >= best.offset_days ? m : best),
    null,
  );
}

function ChoiceCard({
  id,
  value,
  selected,
  title,
  description,
  meta,
  children,
}: {
  id: string;
  value: string;
  selected: boolean;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg ring-1 ring-inset transition-colors duration-150 ease-out-quart',
        selected ? CHOICE_CARD_ON : CHOICE_CARD_OFF,
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 p-3.5 sm:p-4">
        <RadioGroupItem id={id} value={value} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-table font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-caption">{description}</span>
          {meta ? <span className="mt-1 block text-micro tabular text-muted-foreground">{meta}</span> : null}
        </span>
      </label>
      {/* the chain of the chosen template fades in under it (it mounts on selection) */}
      {children ? <div className="animate-fade-in px-3.5 pb-4 pl-[2.75rem] sm:px-4 sm:pl-12">{children}</div> : null}
    </div>
  );
}

export function ProjectStep({
  project,
  errors,
  onChange,
  templates,
  summary,
}: {
  project: ProjectDraft;
  errors: ProjectErrors;
  onChange: (patch: Partial<ProjectDraft>) => void;
  /** undefined while loading */
  templates: ProjectTemplate[] | undefined;
  /** review of the whole account, under the choices */
  summary: ReactNode;
}) {
  const validStart = isValidISODate(project.start_date);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={t('wizard.project.name')} htmlFor="wz-project-name" required error={errors.name}>
          <Input
            id="wz-project-name"
            autoComplete="off"
            value={project.name}
            placeholder={t('wizard.project.namePlaceholder')}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </FormField>
        <FormField
          label={t('wizard.project.startDate')}
          htmlFor="wz-project-start"
          required
          error={errors.start_date}
          hint={validStart ? t('wizard.project.startHint', { weekday: formatWeekday(project.start_date), date: formatDate(project.start_date) }) : undefined}
        >
          <Input
            id="wz-project-start"
            type="date"
            className="tabular"
            value={project.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
          />
        </FormField>
      </div>

      <GroupField id="wz-template" label={t('wizard.project.template')} required error={errors.template_id}>
        {(a11y) =>
          templates === undefined ? (
            <div className="space-y-2.5" aria-busy="true">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : (
            <RadioGroup
              value={project.template_id}
              onValueChange={(v: string) => onChange({ template_id: v })}
              aria-labelledby={a11y.labelId}
              aria-describedby={a11y.describedBy}
              className="gap-2.5"
            >
              {templates.map((tpl) => {
                const selected = project.template_id === tpl.id;
                const last = lastMilestone(tpl);
                const meta =
                  last && validStart
                    ? t('wizard.project.templateMeta', {
                        count: tpl.milestones.length,
                        milestone: last.name,
                        date: formatDate(addDays(project.start_date, last.offset_days)),
                      })
                    : t('settings.templates.meta', { count: tpl.milestones.length, days: templateSpanDays(tpl.milestones) });
                return (
                  <ChoiceCard
                    key={tpl.id}
                    id={`wz-tpl-${tpl.id}`}
                    value={tpl.id}
                    selected={selected}
                    title={tpl.name}
                    description={tpl.description}
                    meta={meta}
                  >
                    {selected ? (
                      <TemplateChain
                        milestones={tpl.milestones}
                        startDate={validStart ? project.start_date : null}
                        label={t('settings.templates.chainLabel', { name: tpl.name })}
                      />
                    ) : null}
                  </ChoiceCard>
                );
              })}
              <ChoiceCard
                id="wz-tpl-none"
                value={NO_TEMPLATE}
                selected={project.template_id === NO_TEMPLATE}
                title={
                  <span className="inline-flex items-center gap-2">
                    <FilePlus2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {t('wizard.project.noTemplate')}
                  </span>
                }
                description={t('wizard.project.noTemplateHint')}
              />
            </RadioGroup>
          )
        }
      </GroupField>

      {templates !== undefined && templates.length === 0 ? (
        <p className="flex items-start gap-1.5 text-caption">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('wizard.project.noTemplates')}
        </p>
      ) : null}

      {summary}
    </div>
  );
}
