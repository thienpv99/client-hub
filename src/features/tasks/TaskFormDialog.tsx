// Create / edit a task (SPEC §3, §4.2): side, type (with the client's button preview), title, description,
// project + milestone, assignee, due date, "Cần chính người quyết định", "Khách thấy được", dependencies with a live
// cycle check ("Vòng lặp: A → B → A" disables saving) and "Nếu trễ thì sao" with a concrete suggestion.
// Full screen on phones, a wide dialog from 640px.
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Lightbulb, RefreshCcw } from 'lucide-react';
import type { MilestoneView, TaskDetail, TaskSide, TaskView, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { formatDateShort } from '@/lib/format';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOptGroup } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SMALL } from '@/components/common/cx';
import { sideLabel } from '@/components/common/labels';
import { NewEraMark } from '@/components/common/new-era-logo';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { DependencyPicker, type PickerOption } from './form/DependencyPicker';
import { SwitchRow, dueHint, userOption } from './form/FormParts';
import { TaskTypePicker } from './form/TaskTypePicker';
import {
  CLIENT_TYPES,
  impactPlaceholder,
  impactRequired,
  impactSuggestion,
  initialFormState,
  toInput,
  validate,
  type FormErrors,
  type TaskFormState,
} from './form/taskFormModel';

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  /** edit this task; omitted / null = create */
  task?: TaskDetail | null;
  defaultProjectId?: string;
  defaultMilestoneId?: string;
}

export function TaskFormDialog({ open, onOpenChange, accountId, task, defaultProjectId, defaultMilestoneId }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // phones: full screen (no bottom-sheet handle: it does not drag); from 640px a wide dialog
          'h-[100dvh] max-h-[100dvh] gap-0 overflow-hidden rounded-none border-0 p-0 before:hidden',
          'sm:h-fit sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-xl sm:border sm:p-0',
        )}
      >
        {/* mounted per opening: the form starts fresh every time */}
        <TaskForm
          accountId={accountId}
          task={task ?? null}
          defaultProjectId={defaultProjectId}
          defaultMilestoneId={defaultMilestoneId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

const FIELD_IDS = {
  project_id: 'tf-project',
  title: 'tf-title',
  due_date: 'tf-due',
  impact_text: 'tf-impact',
} as const;

interface TaskFormProps {
  accountId: string;
  task: TaskDetail | null;
  defaultProjectId?: string;
  defaultMilestoneId?: string;
  onDone: () => void;
}

function TaskForm({ accountId, task, defaultProjectId, defaultMilestoneId, onDone }: TaskFormProps) {
  const editing = task !== null;
  const { run, pending } = useAction();
  const [state, setState] = useState<TaskFormState>(() =>
    initialFormState(task, { projectId: defaultProjectId, milestoneId: defaultMilestoneId }),
  );
  const [submitted, setSubmitted] = useState(false);

  const projectsQ = useQuery(() => api.listProjects(accountId), [accountId]);
  const tasksQ = useQuery(() => api.listTasks({ accountId, openOnly: false }), [accountId]);
  const clientUsersQ = useQuery(() => api.listUsers({ accountId }), [accountId]);
  const staffQ = useQuery(() => api.listUsers({ orgType: 'internal' }), []);

  const projects = projectsQ.data ?? [];
  const multiProject = projects.length > 1;

  // once the projects are known: the project of the preset milestone, else the first one
  useEffect(() => {
    if (state.project_id || projects.length === 0) return;
    const pick = projects.find((p) => p.milestones.some((m) => m.id === state.milestone_id)) ?? projects[0];
    if (pick) setState((s) => ({ ...s, project_id: pick.id }));
  }, [projects, state.project_id, state.milestone_id]);

  const set = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => setState((s) => ({ ...s, [key]: value }));

  const milestoneMap = useMemo(() => {
    const map = new Map<string, MilestoneView>();
    for (const p of projects) for (const m of p.milestones) map.set(m.id, m);
    return map;
  }, [projects]);
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const otherTasks = useMemo(() => (tasksQ.data ?? []).filter((x) => x.id !== task?.id), [tasksQ.data, task?.id]);
  const taskMap = useMemo(() => new Map(otherTasks.map((x) => [x.id, x])), [otherTasks]);
  const currentProject = projects.find((p) => p.id === state.project_id) ?? null;

  const assignees: UserRef[] = state.side === 'client' ? clientUsersQ.data ?? [] : staffQ.data ?? [];
  const owners = (clientUsersQ.data ?? []).filter((u) => u.role === 'client_owner');
  const assignee = assignees.find((u) => u.id === state.assignee_id) ?? null;

  // ── side / project / milestone changes keep the dependent fields valid
  const changeSide = (side: TaskSide) =>
    setState((s) => {
      if (s.side === side) return s;
      const pool = side === 'client' ? clientUsersQ.data ?? [] : staffQ.data ?? [];
      return {
        ...s,
        side,
        type: side === 'client' ? (s.type === 'work' ? 'approval' : s.type) : 'work',
        assignee_id: pool.some((u) => u.id === s.assignee_id) ? s.assignee_id : '',
        requires_owner: side === 'client' ? s.requires_owner : false,
        client_visible: side === 'client' ? true : s.visibilityTouched ? s.client_visible : s.milestone_id !== '',
      };
    });

  const changeProject = (projectId: string) =>
    setState((s) => {
      const keep = projects.find((p) => p.id === projectId)?.milestones.some((m) => m.id === s.milestone_id) ?? false;
      const milestone_id = keep ? s.milestone_id : '';
      return { ...s, project_id: projectId, milestone_id, client_visible: s.visibilityTouched || s.side === 'client' ? s.client_visible : milestone_id !== '' };
    });

  const changeMilestone = (milestoneId: string) =>
    setState((s) => ({
      ...s,
      milestone_id: milestoneId,
      client_visible: s.visibilityTouched || s.side === 'client' ? s.client_visible : milestoneId !== '',
    }));

  const changeRequiresOwner = (on: boolean) =>
    setState((s) => {
      const isOwner = owners.some((u) => u.id === s.assignee_id);
      const first = owners[0];
      return { ...s, requires_owner: on, assignee_id: on && !isOwner && first ? first.id : s.assignee_id };
    });

  // ── live cycle check (dry run on the service)
  const taskDeps = [...state.blocks_task_ids, ...state.blocked_by_task_ids];
  const depKey = `${[...state.blocks_task_ids].sort().join(',')}|${[...state.blocked_by_task_ids].sort().join(',')}`;
  const cycleQ = useQuery(
    () => api.checkDependencies({ taskId: task?.id, blocks_task_ids: state.blocks_task_ids, blocked_by_task_ids: state.blocked_by_task_ids }),
    [task?.id, depKey],
    { enabled: taskDeps.length > 0, keepPreviousData: true },
  );
  const cyclePath = taskDeps.length > 0 && cycleQ.data && !cycleQ.data.ok ? cycleQ.data.path ?? [] : null;
  const thisTask = t('errors.this_task');
  const cycleText = cyclePath
    ? cyclePath.map((p) => (p === thisTask && !editing && state.title.trim() ? state.title.trim() : p)).join(' → ')
    : null;
  const flagged = useMemo(() => {
    if (!cyclePath) return new Set<string>();
    const titles = new Set(cyclePath);
    return new Set([...state.blocks_task_ids, ...state.blocked_by_task_ids].filter((id) => titles.has(taskMap.get(id)?.title ?? '')));
  }, [cyclePath, state.blocks_task_ids, state.blocked_by_task_ids, taskMap]);

  // ── options
  const taskOptions: PickerOption[] = useMemo(() => {
    const open = otherTasks.filter((x) => x.status !== 'done');
    const done = otherTasks.filter((x) => x.status === 'done');
    const option = (x: TaskView, group: string): PickerOption => ({
      id: x.id,
      label: x.title,
      meta: [sideLabel(x.side), x.milestone?.name ?? t('tasks.filters.noMilestone'), t('tasks.form.deps.due', { date: formatDateShort(x.due_date) })].join(' · '),
      group,
      muted: x.status === 'done',
      icon: <TaskTypeIcon type={x.type} className="h-3.5 w-3.5 text-muted-foreground" />,
    });
    return [
      ...open.map((x) => option(x, multiProject ? projectName.get(x.project_id) ?? '' : t('tasks.form.deps.openGroup'))),
      ...done.map((x) => option(x, t('tasks.form.deps.doneGroup'))),
    ];
  }, [otherTasks, multiProject, projectName]);

  const milestoneOptions: PickerOption[] = useMemo(
    () =>
      projects.flatMap((p) =>
        p.milestones.map((m) => ({
          id: m.id,
          label: m.name,
          meta:
            m.status === 'done'
              ? t('tasks.form.deps.milestoneDone')
              : t('tasks.form.deps.milestonePlanned', { date: formatDateShort(m.planned_date) }),
          group: p.name,
          muted: m.status === 'done',
        })),
      ),
    [projects],
  );

  const suggestion = impactSuggestion(state, { tasks: taskMap, milestones: milestoneMap });
  const errors: FormErrors = submitted ? validate(state) : {};

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const found = validate(state);
    const first = (Object.keys(FIELD_IDS) as (keyof typeof FIELD_IDS)[]).find((k) => found[k]);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    if (cyclePath) return;
    const input = toInput(state);
    const result = task
      ? await run(() => api.updateTask(task.id, input), { success: 'tasks.form.saved', successParams: { title: input.title } })
      : await run(() => api.createTask(input), { success: 'tasks.form.created', successParams: { title: input.title } });
    if (result) onDone();
  };

  const loadingCore = projectsQ.loading || tasksQ.loading;
  const sideHeadingId = 'tf-side-label';
  const typeHeadingId = 'tf-type-label';

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 border-b border-border/70 px-4 pb-4 pr-14 pt-5 sm:px-6 sm:pr-14">
        <DialogTitle>{editing ? t('tasks.form.editTitle') : t('tasks.form.createTitle')}</DialogTitle>
        {/* phones: the fields come first (the "Khách thấy được" switch repeats the rule where it matters) */}
        <DialogDescription className="sr-only sm:not-sr-only">{t('tasks.form.description')}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-4 py-5 sm:px-6 [&>section:first-child]:pt-0 [&>section:last-child]:pb-1 [&>section]:py-6">
        {/* side + type */}
        <section className="space-y-3">
          <p id={sideHeadingId} className="text-table font-medium text-foreground">
            {t('tasks.form.side')}
          </p>
          <ToggleGroup
            type="single"
            variant="segmented"
            value={state.side}
            onValueChange={(v) => {
              if (v === 'client' || v === 'internal') changeSide(v);
            }}
            aria-labelledby={sideHeadingId}
            className="w-full sm:w-auto"
          >
            <ToggleGroupItem value="client" className="flex-1 sm:flex-none">
              <Building2 aria-hidden="true" />
              {sideLabel('client')}
            </ToggleGroupItem>
            <ToggleGroupItem value="internal" className="flex-1 sm:flex-none">
              <NewEraMark className="h-4 w-4" />
              {sideLabel('internal')}
            </ToggleGroupItem>
          </ToggleGroup>

          {state.side === 'client' ? (
            <div className="space-y-2 pt-1">
              <p id={typeHeadingId} className="text-table font-medium text-foreground">
                {t('tasks.form.type.label')}
              </p>
              <TaskTypePicker
                labelledBy={typeHeadingId}
                value={CLIENT_TYPES.find((x) => x === state.type) ?? 'approval'}
                onChange={(type) => set('type', type)}
              />
            </div>
          ) : (
            <p className={cn('flex items-center gap-2 text-muted-foreground', SMALL)}>
              <TaskTypeIcon type="work" className="h-3.5 w-3.5" />
              {t('tasks.form.type.internal')}
            </p>
          )}
        </section>

        {/* what */}
        <section className="space-y-4">
          <FormField label={t('tasks.form.title')} htmlFor={FIELD_IDS.title} required hint={t('tasks.form.titleHint')} error={errors.title}>
            <Input
              id={FIELD_IDS.title}
              value={state.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={state.side === 'client' ? t('tasks.form.titlePlaceholderClient') : t('tasks.form.titlePlaceholderInternal')}
              autoComplete="off"
              maxLength={160}
            />
          </FormField>
          <FormField label={t('tasks.form.descriptionLabel')} htmlFor="tf-description" hint={t('tasks.form.descriptionHint')}>
            <Textarea
              id="tf-description"
              value={state.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </FormField>
        </section>

        {/* where, who, when */}
        {loadingCore ? (
          <section className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('tasks.form.project')} htmlFor={FIELD_IDS.project_id} required error={errors.project_id}>
              <NativeSelect id={FIELD_IDS.project_id} value={state.project_id} onChange={(e) => changeProject(e.target.value)}>
                {projects.length === 0 ? <option value="">{t('tasks.form.noProject')}</option> : null}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('tasks.form.milestone')} htmlFor="tf-milestone" hint={t('tasks.form.milestoneHint')}>
              <NativeSelect id="tf-milestone" value={state.milestone_id} onChange={(e) => changeMilestone(e.target.value)}>
                <option value="">{t('tasks.filters.noMilestone')}</option>
                {(currentProject?.milestones ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {t('tasks.form.milestoneOption', { name: m.name, date: formatDateShort(m.planned_date) })}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label={t('tasks.form.assignee')}
              htmlFor="tf-assignee"
              hint={
                state.side === 'client' && state.requires_owner && assignee && assignee.role !== 'client_owner'
                  ? t('tasks.form.assigneeNotOwner')
                  : undefined
              }
            >
              <NativeSelect id="tf-assignee" value={state.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
                <option value="">{t('tasks.filters.unassigned')}</option>
                {state.side === 'client' ? (
                  <NativeSelectOptGroup label={t('tasks.form.assigneeClientGroup')}>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {userOption(u)}
                      </option>
                    ))}
                  </NativeSelectOptGroup>
                ) : (
                  assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userOption(u)}
                    </option>
                  ))
                )}
              </NativeSelect>
            </FormField>
            <FormField label={t('tasks.form.due')} htmlFor={FIELD_IDS.due_date} required error={errors.due_date} hint={dueHint(state.due_date)}>
              <Input id={FIELD_IDS.due_date} type="date" value={state.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </FormField>
          </section>
        )}

        {/* switches */}
        <section className="space-y-1">
          {state.side === 'client' ? (
            <SwitchRow
              id="tf-owner"
              label={t('tasks.form.requiresOwner')}
              hint={t('tasks.form.requiresOwnerHint')}
              checked={state.requires_owner}
              onCheckedChange={changeRequiresOwner}
            />
          ) : (
            <SwitchRow
              id="tf-visible"
              label={t('tasks.form.clientVisible')}
              hint={state.milestone_id ? t('tasks.form.clientVisibleHintMilestone') : t('tasks.form.clientVisibleHint')}
              checked={state.client_visible}
              onCheckedChange={(v) => setState((s) => ({ ...s, client_visible: v, visibilityTouched: true }))}
            />
          )}
        </section>

        {/* dependencies */}
        <section className="space-y-4" aria-labelledby="tf-deps-heading">
          <div>
            <h3 id="tf-deps-heading" className="text-heading font-semibold tracking-tightish text-ink">
              {t('tasks.form.deps.title')}
            </h3>
            <p className="mt-0.5 text-caption">{t('tasks.form.deps.description')}</p>
          </div>
          {tasksQ.loading || projectsQ.loading ? (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              <DependencyPicker
                label={t('tasks.form.deps.blocksTasks')}
                hint={t('tasks.form.deps.blocksTasksHint')}
                options={taskOptions}
                value={state.blocks_task_ids}
                onChange={(ids) => set('blocks_task_ids', ids)}
                addLabel={t('tasks.form.deps.addTask')}
                searchPlaceholder={t('tasks.form.deps.searchTask')}
                flagged={flagged}
              />
              <DependencyPicker
                label={t('tasks.form.deps.blocksMilestones')}
                hint={t('tasks.form.deps.blocksMilestonesHint')}
                options={milestoneOptions}
                value={state.blocks_milestone_ids}
                onChange={(ids) => set('blocks_milestone_ids', ids)}
                addLabel={t('tasks.form.deps.addMilestone')}
                searchPlaceholder={t('tasks.form.deps.searchMilestone')}
              />
              <DependencyPicker
                label={t('tasks.form.deps.blockedBy')}
                hint={t('tasks.form.deps.blockedByHint')}
                options={taskOptions}
                value={state.blocked_by_task_ids}
                onChange={(ids) => set('blocked_by_task_ids', ids)}
                addLabel={t('tasks.form.deps.addTask')}
                searchPlaceholder={t('tasks.form.deps.searchTask')}
                flagged={flagged}
              />
            </>
          )}
          {cycleText ? (
            <Alert variant="danger" aria-live="polite">
              <RefreshCcw aria-hidden="true" />
              <AlertTitle>{t('tasks.form.cycle.title')}</AlertTitle>
              <AlertDescription>
                <p className="font-medium text-foreground">{t('tasks.form.cycle.path', { path: cycleText })}</p>
                <p>{t('tasks.form.cycle.hint')}</p>
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        {/* impact */}
        <section className="space-y-2">
          <FormField
            label={t('tasks.form.impact.label')}
            htmlFor={FIELD_IDS.impact_text}
            required={impactRequired(state)}
            hint={impactRequired(state) ? t('tasks.form.impact.hintRequired') : t('tasks.form.impact.hint')}
            error={errors.impact_text}
          >
            <Textarea
              id={FIELD_IDS.impact_text}
              value={state.impact_text}
              onChange={(e) => set('impact_text', e.target.value)}
              placeholder={impactPlaceholder(state, suggestion)}
              rows={3}
              maxLength={600}
            />
          </FormField>
          {suggestion && state.impact_text.trim() !== suggestion ? (
            <Button type="button" variant="ghost" size="sm" className="-ml-2 text-primary" onClick={() => set('impact_text', suggestion)}>
              <Lightbulb aria-hidden="true" />
              {state.impact_text.trim() ? t('tasks.form.impact.replaceSuggestion') : t('tasks.form.impact.useSuggestion')}
            </Button>
          ) : null}
        </section>
      </div>

      {/* sticky action bar: one row on phones too (full-screen form), the primary action last and widest */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-6 sm:py-4">
        {cycleText ? <p className={cn('w-full text-danger sm:mr-auto sm:w-auto', SMALL)}>{t('tasks.form.cycle.blockedSave')}</p> : null}
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={!!cycleText || loadingCore} className="flex-1 sm:flex-none">
          {editing ? t('tasks.form.submitEdit') : t('tasks.form.submitCreate')}
        </Button>
      </div>
    </form>
  );
}
