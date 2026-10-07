// Account tab "Lộ trình" (SPEC §4.2, §3): milestones of a project on a timeline with plan and forecast,
// the milestone list, manager actions (forecast override, complete, edit, add) and "Tạo nhanh từ mẫu".
// Focal block: the timeline card, headed by the 5-second answer ("Mốc Go-live dự báo 18/11 · lùi 6 ngày").
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, Clock, LayoutTemplate, Plus, Route } from 'lucide-react';
import type { AccountDetail, MilestoneView, ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { launchMilestone } from '@/domain/graph';
import { useAction } from '@/hooks/useAction';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatDate, formatDateShort } from '@/lib/format';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { TaskFormDialog } from '@/features/tasks/TaskFormDialog';
import { CompleteMilestoneDialog } from './CompleteMilestoneDialog';
import { ForecastOverrideDialog } from './ForecastOverrideDialog';
import { DELAY_PILL, ForecastHelp } from './MilestoneBits';
import { MilestoneFormDialog } from './MilestoneFormDialog';
import { MilestoneList } from './MilestoneList';
import { MilestoneTimeline, TimelineLegend } from './MilestoneTimeline';
import { MilestoneVerticalTimeline } from './MilestoneVerticalTimeline';
import { RoadmapContext, type MilestoneAction, type RoadmapContextValue } from './roadmapContext';
import { currentMilestoneId, delayOf, delayTone, isDone } from './roadmapUtils';
import { TemplateDialog, type TemplateTarget } from './TemplateDialog';

export interface RoadmapTabProps {
  account: AccountDetail;
}

const PROJECT_PARAM = 'project';

type DialogState =
  | { kind: 'add' }
  | { kind: 'edit' | 'override' | 'complete' | 'addTask'; milestone: MilestoneView }
  | { kind: 'template'; target: TemplateTarget };

function sortMilestones(p: ProjectView): MilestoneView[] {
  return [...p.milestones].sort((a, b) => a.order_no - b.order_no);
}

/** dd/mm in the current year, dd/mm/yyyy otherwise ("04/01" alone would read as last January) */
function dayLabel(d: string, today: string): string {
  return d.slice(0, 4) === today.slice(0, 4) ? formatDateShort(d) : formatDate(d);
}

const PILL = 'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-micro font-medium tabular ring-1 ring-inset';

interface Headline {
  title: ReactNode;
  /** "Kế hoạch 12/11" when the launch milestone moved */
  planned: string | null;
}

/** "Mốc Go-live dự báo 18/11 [◷ lùi 6 ngày]" — the 5-second answer heading the timeline. */
function headline(milestones: MilestoneView[], today: string): Headline | null {
  if (milestones.length === 0) return null;
  const open = milestones.filter((m) => !isDone(m));
  if (open.length === 0) {
    return {
      title: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {t('roadmap.headline.allDone')}
          <span className={cn(PILL, 'bg-success-soft text-success ring-success/15')}>
            <CircleCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            {t('enums.milestoneStatus.done')}
          </span>
        </span>
      ),
      planned: null,
    };
  }
  const launch = launchMilestone(open);
  if (!launch) return null;
  const delay = delayOf(launch);
  const date = dayLabel(launch.forecast_date, today);
  const planned = dayLabel(launch.planned_date, today);
  if (delay === 0) {
    return {
      title: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {t('roadmap.headline.expected', { name: launch.name, date })}
          <span className={cn(PILL, 'bg-success-soft text-success ring-success/15')}>
            <CircleCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            {t('roadmap.headline.onPlan')}
          </span>
        </span>
      ),
      planned: null,
    };
  }
  const days = Math.abs(delay);
  const sr = t(delay > 0 ? 'roadmap.headline.laterSr' : 'roadmap.headline.earlierSr', { name: launch.name, date, days, planned });
  return {
    title: (
      <>
        <span className="sr-only">{sr}</span>
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" aria-hidden="true">
          {t('roadmap.headline.forecast', { name: launch.name, date })}
          <span className={cn(PILL, DELAY_PILL[delayTone(launch)])}>
            <Clock className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            {t(delay > 0 ? 'roadmap.headline.later' : 'roadmap.headline.earlier', { days })}
          </span>
        </span>
      </>
    ),
    planned: t('roadmap.headline.planned', { date: planned }),
  };
}

function RoadmapSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-72 max-w-full rounded-lg" />
        <Skeleton className="hidden h-8 w-56 rounded-lg sm:block" />
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
        <Skeleton className="h-[18px] w-2/5 max-w-[18rem]" />
        <Skeleton className="mt-2 h-3 w-1/3 max-w-[14rem]" />
        <div className="mt-6 space-y-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-32 shrink-0 space-y-1.5 lg:w-44">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
              <Skeleton className="h-2 rounded-full" style={{ marginLeft: `${i * 9}%`, width: `${18 + (i % 3) * 6}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Segmented control for a few projects; a labelled select on phones and when there are more. */
const SEGMENTED_MAX = 3;

function ProjectSwitcher({
  projects,
  value,
  onChange,
  phone,
}: {
  projects: ProjectView[];
  value: string;
  onChange(id: string): void;
  phone: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const segmented = !phone && projects.length <= SEGMENTED_MAX;

  // long names can still overflow the segmented control: keep the selected one in view
  useEffect(() => {
    const group = groupRef.current;
    const item = group?.querySelector<HTMLElement>('[data-state="on"]');
    if (!group || !item) return;
    const g = group.getBoundingClientRect();
    const i = item.getBoundingClientRect();
    if (i.left < g.left) group.scrollLeft -= g.left - i.left + 8;
    else if (i.right > g.right) group.scrollLeft += i.right - g.right + 8;
  }, [value, segmented]);

  if (!segmented) {
    // phones: the select alone (its value is the project name), the label is read to screen readers
    return (
      <div className={cn('flex min-w-0', phone ? 'flex-col' : 'items-center gap-3')}>
        <label htmlFor="roadmap-project" className={phone ? 'sr-only' : 'shrink-0 text-table font-medium text-foreground'}>
          {t('roadmap.project.switcher')}
        </label>
        <NativeSelect
          id="roadmap-project"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          wrapperClassName={phone ? undefined : 'w-80 max-w-full'}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }
  return (
    <ToggleGroup
      ref={groupRef}
      type="single"
      variant="segmented"
      value={value}
      onValueChange={(v) => (v ? onChange(v) : undefined)}
      aria-label={t('roadmap.project.switcher')}
      className="no-scrollbar min-w-0 max-w-full overflow-x-auto"
    >
      {projects.map((p) => (
        <ToggleGroupItem key={p.id} value={p.id} className="px-3.5">
          {p.name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function RoadmapTab({ account }: RoadmapTabProps) {
  const viewer = useViewer();
  const breakpoint = useBreakpoint();
  const isPhone = breakpoint === 'mobile';
  const today = todayISO();
  const { run } = useAction();

  // director, or the AM in charge — the api enforces the same rule (assertManagerOf)
  const canManage =
    !!viewer &&
    !viewer.read_only &&
    viewer.org_type === 'internal' &&
    (viewer.role === 'director' || (viewer.role === 'am' && account.am.id === viewer.user.id));

  const query = useQuery(() => api.listProjects(account.id), [account.id]);

  // a project just created / filled from a template, shown until the refetch brings it
  const [fresh, setFresh] = useState<ProjectView | null>(null);
  const base = query.data ?? account.projects;
  const projects = useMemo(() => {
    if (!fresh) return base;
    const known = base.find((p) => p.id === fresh.id);
    if (known && known.milestones.length >= fresh.milestones.length) return base;
    return known ? base.map((p) => (p.id === fresh.id ? fresh : p)) : [...base, fresh];
  }, [base, fresh]);
  useEffect(() => {
    if (fresh && query.data?.some((p) => p.id === fresh.id && p.milestones.length >= fresh.milestones.length)) setFresh(null);
  }, [fresh, query.data]);

  const [params, setParams] = useSearchParams();
  const selectedId = params.get(PROJECT_PARAM);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;
  const selectProject = useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(PROJECT_PARAM, id);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const milestones = useMemo(() => (project ? sortMilestones(project) : []), [project]);
  const currentId = useMemo(() => currentMilestoneId(milestones), [milestones]);

  // optimistic "Khách thấy được": the switch flips at once, the value from the refetch then takes over
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const ids = Object.keys(visible);
    if (ids.length === 0) return;
    const settled = ids.filter((id) => {
      const m = projects.flatMap((p) => p.milestones).find((x) => x.id === id);
      return !m || m.client_visible === visible[id];
    });
    if (settled.length === 0) return;
    setVisible((prev) => {
      const next = { ...prev };
      for (const id of settled) delete next[id];
      return next;
    });
  }, [projects, visible]);

  const setVisibleOptimistic = useCallback((id: string, value: boolean | null) => {
    setVisible((prev) => {
      const next = { ...prev };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });
  }, []);

  const saveVisible = useCallback(
    async (m: MilestoneView, next: boolean, withUndo: boolean) => {
      setVisibleOptimistic(m.id, next);
      const r = await run(() => api.updateMilestone(m.id, { client_visible: next }));
      if (!r) {
        setVisibleOptimistic(m.id, null);
        return;
      }
      if (!withUndo) {
        toastSuccess(t('common.toast.undone'));
        return;
      }
      toastSuccess(t(next ? 'roadmap.visible.shown' : 'roadmap.visible.hidden', { name: m.name }), {
        onUndo: () => saveVisible(m, !next, false),
      });
    },
    [run, setVisibleOptimistic],
  );

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = useCallback((d: DialogState) => {
    setDialog(d);
    setDialogOpen(true);
  }, []);

  const ctx: RoadmapContextValue = useMemo(
    () => ({
      accountId: account.id,
      canManage,
      currentId,
      today,
      // creating a task is a manager action as well (api.createTask → isManagerOf)
      canAddTask: canManage,
      onAction: (action: MilestoneAction, milestone: MilestoneView) => openDialog({ kind: action, milestone }),
      isVisible: (m: MilestoneView) => visible[m.id] ?? m.client_visible,
      toggleVisible: (m: MilestoneView, next: boolean) => void saveVisible(m, next, true),
    }),
    [account.id, canManage, currentId, today, openDialog, visible, saveVisible],
  );

  // the dialog's milestone, refreshed from the latest data while it is open
  const dialogMilestone =
    dialog && 'milestone' in dialog ? milestones.find((m) => m.id === dialog.milestone.id) ?? dialog.milestone : null;
  const emptyProject = projects.find((p) => p.milestones.length === 0) ?? null;
  const applyCandidate = project && project.milestones.length === 0 ? project : emptyProject;

  if (!query.data && query.loading && account.projects.length === 0) return <RoadmapSkeleton />;
  if (query.error && !query.data && account.projects.length === 0) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  const dialogs = (
    <>
      {canManage && project && dialog?.kind === 'add' ? (
        <MilestoneFormDialog open={dialogOpen} onOpenChange={setDialogOpen} project={project} milestone={null} />
      ) : null}
      {canManage && project && dialog?.kind === 'edit' && dialogMilestone ? (
        <MilestoneFormDialog open={dialogOpen} onOpenChange={setDialogOpen} project={project} milestone={dialogMilestone} />
      ) : null}
      {canManage && dialog?.kind === 'override' && dialogMilestone ? (
        <ForecastOverrideDialog open={dialogOpen} onOpenChange={setDialogOpen} milestone={dialogMilestone} />
      ) : null}
      {canManage && project && dialog?.kind === 'addTask' && dialogMilestone ? (
        <TaskFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accountId={account.id}
          defaultProjectId={project.id}
          defaultMilestoneId={dialogMilestone.id}
        />
      ) : null}
      {canManage && dialog?.kind === 'complete' && dialogMilestone ? (
        <CompleteMilestoneDialog open={dialogOpen} onOpenChange={setDialogOpen} milestone={dialogMilestone} accountId={account.id} />
      ) : null}
      {canManage && dialog?.kind === 'template' ? (
        <TemplateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accountId={account.id}
          applyCandidate={applyCandidate}
          defaultTarget={dialog.target}
          onDone={(p) => {
            setFresh(p);
            selectProject(p.id);
          }}
        />
      ) : null}
    </>
  );

  // ── no project yet ──
  if (!project) {
    return (
      <RoadmapContext.Provider value={ctx}>
        <Card>
          <EmptyState
            icon={Route}
            title={t('roadmap.empty.noProjects', { account: account.short_name || account.name })}
            description={canManage ? t('roadmap.empty.noProjectsManager') : t('roadmap.empty.noProjectsViewer')}
            action={
              canManage ? (
                <Button onClick={() => openDialog({ kind: 'template', target: 'new' })}>
                  <LayoutTemplate aria-hidden="true" />
                  {t('roadmap.actions.fromTemplate')}
                </Button>
              ) : null
            }
          />
        </Card>
        {dialogs}
      </RoadmapContext.Provider>
    );
  }

  const doneCount = milestones.filter(isDone).length;
  const multi = projects.length > 1;
  const head = headline(milestones, today);
  const meta = [
    head?.planned ?? null,
    project.code,
    t('roadmap.project.dates', { start: dayLabel(project.start_date, today), end: dayLabel(project.end_date, today) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const actions = canManage ? (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => openDialog({ kind: 'template', target: 'new' })} className="flex-1 sm:flex-none">
        <LayoutTemplate aria-hidden="true" />
        {t('roadmap.actions.fromTemplate')}
      </Button>
      <Button size="sm" onClick={() => openDialog({ kind: 'add' })} className="flex-1 sm:flex-none">
        <Plus aria-hidden="true" />
        {t('roadmap.actions.addMilestone')}
      </Button>
    </div>
  ) : null;

  return (
    <RoadmapContext.Provider value={ctx}>
      <div className="space-y-4 md:space-y-6">
        {/* toolbar: which project (switcher, or its name) · manager actions (phones: below the timeline, so the
            forecast headline is the first thing under the account header) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {multi ? (
            <>
              <h2 className="sr-only">{project.name}</h2>
              <ProjectSwitcher projects={projects} value={project.id} onChange={selectProject} phone={isPhone} />
            </>
          ) : (
            <h2 className="min-w-0 break-words text-heading font-semibold tracking-tightish text-ink">{project.name}</h2>
          )}
          {isPhone ? null : actions}
        </div>

        {milestones.length === 0 ? (
          <Card>
            <EmptyState
              icon={Route}
              title={t('roadmap.empty.noMilestones', { project: project.name })}
              description={canManage ? t('roadmap.empty.noMilestonesManager') : t('roadmap.empty.noMilestonesViewer')}
              action={
                canManage ? (
                  <>
                    <Button onClick={() => openDialog({ kind: 'template', target: 'apply' })}>
                      <LayoutTemplate aria-hidden="true" />
                      {t('roadmap.empty.applyTemplate')}
                    </Button>
                    <Button variant="secondary" onClick={() => openDialog({ kind: 'add' })}>
                      <Plus aria-hidden="true" />
                      {t('roadmap.actions.addMilestone')}
                    </Button>
                  </>
                ) : null
              }
            />
          </Card>
        ) : isPhone ? (
          <SectionCard as="h3" title={head?.title} description={meta} footer={<ForecastHelp withLabel />}>
            <MilestoneVerticalTimeline milestones={milestones} />
          </SectionCard>
        ) : (
          <>
            <SectionCard as="h3" title={head?.title} description={meta} actions={<ForecastHelp />} footer={<TimelineLegend />}>
              <MilestoneTimeline project={project} />
            </SectionCard>
            <SectionCard
              as="h3"
              title={t('roadmap.list.title')}
              description={t('roadmap.list.description', { count: milestones.length, done: doneCount })}
              flush
            >
              <MilestoneList milestones={milestones} />
            </SectionCard>
          </>
        )}
        {/* phones: manager actions after the timeline (the empty state above already offers them) */}
        {isPhone && milestones.length > 0 ? actions : null}
      </div>
      {dialogs}
    </RoadmapContext.Provider>
  );
}
