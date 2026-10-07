// Dev-only gallery of every common component with realistic fixtures.
// Render: createRoot(el).render(React.createElement((await import('/src/components/common/__gallery')).CommonGallery))
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, useInRouterContext } from 'react-router-dom';
import { Banknote, Building2, ClipboardList, FolderOpen, Plus, TriangleAlert } from 'lucide-react';
import type { FileView, Health, TaskActionKind, TaskType } from '@/services/contract';
import { ApiError } from '@/services/contract';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { AccountLogo } from './account-logo';
import { ActivityFeed } from './activity-feed';
import { BlockedNote } from './blocked-note';
import { ChipFilter } from './chip-filter';
import { ConfirmDialog } from './confirm-dialog';
import { DateText } from './date-text';
import { DueLabel } from './due-label';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { FileList } from './file-list';
import { FilePreviewDialog } from './file-preview-dialog';
import { ForecastLabel } from './forecast-label';
import { HealthBadge } from './health-badge';
import { ImpactBox } from './impact-box';
import { ImpactChain } from './impact-chain';
import { InternalNoteBox } from './internal-note-box';
import { InternalOnlyBadge } from './internal-only-badge';
import { KpiCard } from './kpi-card';
import { Money } from './money';
import { NewEraLogo } from './new-era-logo';
import { PageHeader } from './page-header';
import { ReasonDialog } from './reason-dialog';
import { SectionCard } from './section-card';
import { SideBadge } from './side-badge';
import { CardSkeleton, KpiSkeleton, ListSkeleton, PageSkeleton, TableSkeleton } from './skeletons';
import { StageStepper } from './stage-stepper';
import { StatusBand } from './status-band';
import { TaskTypeIcon } from './task-type-icon';
import { taskActionLabel, taskTypeLabel } from './taskLabels';
import { UserAvatar } from './user-avatar';
import { WaitingCountsLine } from './waiting-counts-line';
import * as fx from './__galleryFixtures';
import { CardVariantsDemo, DetailHeaderDemo, KpiVariantsDemo } from './__gallerySections';

const HEALTHS: Health[] = ['blocked', 'attention', 'on_track'];
const TYPES: TaskType[] = ['approval', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer', 'work'];
const ACTIONS: TaskActionKind[] = ['approve', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer', 'review_submission', 'start', 'complete'];
const SIZES = ['xs', 'sm', 'md', 'lg'] as const;
type ChipValue = 'blocked' | 'waiting_client' | 'overdue_receivable';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 md:flex-row md:items-start md:gap-6">
      <code className="shrink-0 pt-0.5 text-caption md:w-48">{label}</code>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function GalleryBody() {
  const g = (k: string) => t(`components.gallery.${k}`);
  const [chip, setChip] = useState<ChipValue | null>('blocked');
  const [kpiActive, setKpiActive] = useState(true);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<FileView | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
  const project = fx.coXanhMilestones;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        back="/dev/selftest"
        title={g('title')}
        description={g('subtitle')}
        actions={
          <>
            <Button variant="outline" size="sm">
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              {g('actionDocs')}
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {g('actionNew')}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <AccountLogo account={fx.accounts[0] ?? { name: '—', logo_url: null, brand_color: '' }} size="sm" />
          <HealthBadge health="blocked" size="sm" />
          <SideBadge side="client" />
        </div>
      </PageHeader>

      <DetailHeaderDemo />

      <SectionCard title={g('sections.statusBand')}>
        <div className="space-y-3">
          <StatusBand
            line={{ tone: 'blocked', kind: 'waiting_client', count: 1, milestone_name: 'Go-live', delay_days: 6 }}
            salutation="anh"
            milestone={project[5] ?? null}
          />
          <StatusBand line={{ tone: 'on_track', kind: 'on_track' }} salutation="anh" milestone={fx.forecastExamples[7]?.milestone ?? null} />
          {fx.statusLines.map((s, i) => (
            <StatusBand key={i} line={s.line} salutation={s.salutation} showLabel={i % 4 !== 3} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={g('sections.badges')}>
        <Row label="HealthBadge md / sm / icon">
          {HEALTHS.map((h) => (
            <HealthBadge key={h} health={h} />
          ))}
          {HEALTHS.map((h) => (
            <HealthBadge key={`sm-${h}`} health={h} size="sm" />
          ))}
          {HEALTHS.map((h) => (
            <HealthBadge key={`i-${h}`} health={h} size="sm" showLabel={false} />
          ))}
        </Row>
        <Row label="HealthBadge variant=dot">
          {HEALTHS.map((h) => (
            <HealthBadge key={`d-${h}`} health={h} variant="dot" />
          ))}
          {HEALTHS.map((h) => (
            <HealthBadge key={`ds-${h}`} health={h} size="sm" variant="dot" />
          ))}
        </Row>
        <Row label="SideBadge · InternalOnlyBadge">
          <SideBadge side="client" />
          <SideBadge side="internal" />
          <InternalOnlyBadge />
        </Row>
        <Row label="TaskTypeIcon · taskTypeLabel">
          {TYPES.map((ty) => (
            <span key={ty} className="inline-flex items-center gap-2 text-table text-foreground">
              <TaskTypeIcon type={ty} boxed />
              {taskTypeLabel(ty)}
            </span>
          ))}
        </Row>
        <Row label="taskActionLabel">
          {ACTIONS.map((a) => (
            <span key={a} className="rounded-lg border border-border px-2 py-1 text-table">
              {taskActionLabel(a)}
            </span>
          ))}
        </Row>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={g('sections.due')}>
          {[-3, -1, 0, 1, 2, 12].map((n) => (
            <Row key={n} label={`days_left ${n}`}>
              <DueLabel due={fx.due(n)} />
              <DueLabel due={fx.due(n)} compact />
              <DueLabel due={fx.due(n)} compact variant="text" />
            </Row>
          ))}
          <Row label="done">
            <DueLabel due={fx.due(-3)} done completedAt={fx.activities[0]?.created_at ?? null} />
            <DueLabel due={fx.due(-3)} done compact />
          </Row>
        </SectionCard>

        <SectionCard title={g('sections.counts')}>
          {fx.counts.map((c, i) => (
            <Row key={i} label={`counts #${i + 1}`}>
              <div className="space-y-1">
                <WaitingCountsLine counts={c} />
                <WaitingCountsLine counts={c} showOverdue />
              </div>
            </Row>
          ))}
          <Row label="Money · DateText">
            <Money value={1_250_000_000} />
            <Money value={1_250_000_000} compact className="font-semibold" />
            <Money value={12_500_000} compact />
            <DateText value={fx.day(0)} />
            <DateText value={fx.activities[1]?.created_at ?? null} relative time />
            <DateText value={fx.day(-3)} relative />
            <DateText value={null} />
          </Row>
        </SectionCard>
      </div>

      <SectionCard title={g('sections.forecast')}>
        {fx.forecastExamples.map((ex) => (
          <Row key={ex.milestone.id + ex.note} label={`${ex.milestone.name} · ${ex.note}`}>
            <div className="flex min-w-0 flex-col gap-1.5">
              <ForecastLabel milestone={ex.milestone} />
              <ForecastLabel milestone={ex.milestone} compact />
            </div>
          </Row>
        ))}
      </SectionCard>

      <SectionCard title={g('sections.stepper')}>
        <div className="space-y-6">
          <StageStepper milestones={project} />
          <StageStepper milestones={project} compact />
          <StageStepper milestones={[]} />
        </div>
      </SectionCard>

      <SectionCard title={g('sections.impact')}>
        <div className="space-y-5">
          {fx.chains.map((nodes, i) => (
            <ImpactChain key={i} nodes={nodes} />
          ))}
          <ImpactBox text={fx.impactText} milestones={fx.impactMilestones} />
          <ImpactBox text={fx.impactTextOverdue} milestones={fx.impactMilestones} overdueDays={fx.impactOverdueDays} />
          <BlockedNote blockers={fx.blockers} />
        </div>
      </SectionCard>

      <SectionCard title={g('sections.identity')}>
        <Row label="AccountLogo xs/sm/md/lg">
          {fx.accounts.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-2">
              {SIZES.map((s) => (
                <AccountLogo key={s} account={a} size={s} />
              ))}
            </span>
          ))}
        </Row>
        <Row label="UserAvatar">
          {[fx.minh, fx.lan, fx.ha, fx.tuan].map((u) => (
            <span key={u.id} className="inline-flex items-center gap-2">
              <UserAvatar user={u} size="sm" />
              <span className="text-table">{u.full_name}</span>
            </span>
          ))}
          <UserAvatar user={null} size="sm" />
          {SIZES.map((s) => (
            <UserAvatar key={s} user={fx.ha} size={s} />
          ))}
          <span className="flex -space-x-2">
            {[fx.minh, fx.lan, fx.ha, fx.tuan].map((u) => (
              <UserAvatar key={`stack-${u.id}`} user={u} size="md" ring />
            ))}
          </span>
          <span className="flex -space-x-1.5">
            {fx.accounts.map((a) => (
              <AccountLogo key={`stack-${a.id}`} account={a} size="sm" ring />
            ))}
          </span>
        </Row>
        <Row label="NewEraLogo">
          <NewEraLogo />
          <NewEraLogo withText />
          <NewEraLogo size="md" withText />
          <span className="inline-flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <AccountLogo account={fx.accounts[0] ?? { name: '—', logo_url: null, brand_color: '' }} size="sm" />
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <NewEraLogo withText />
          </span>
        </Row>
      </SectionCard>

      <SectionCard title={g('sections.layout')} description={g('kpiHint')} actions={<Button variant="ghost" size="sm">{g('open')}</Button>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={g('kpi.risk')}
            value="2/6"
            icon={TriangleAlert}
            tone="danger"
            onClick={() => setKpiActive((v) => !v)}
            active={kpiActive}
            sub={
              <span className="inline-flex flex-wrap gap-x-2">
                <HealthBadge health="blocked" size="sm" /> <HealthBadge health="attention" size="sm" />
              </span>
            }
          />
          <KpiCard label={g('kpi.overdue')} value="5" icon={ClipboardList} sub={g('kpi.overdueSub')} />
          <KpiCard label={g('kpi.contract')} value={<Money value={8_640_000_000} compact />} icon={Building2} tone="primary" sub={g('kpi.contractSub')} />
          <KpiCard
            label={g('kpi.receivable')}
            value={<Money value={1_250_000_000} compact />}
            icon={Banknote}
            sub={
              <span className="inline-flex items-center gap-1 text-danger">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <Money value={312_000_000} compact /> {g('kpi.receivableOverdue')}
              </span>
            }
          />
        </div>
      </SectionCard>

      <KpiVariantsDemo />
      <CardVariantsDemo />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title={g('sections.activity')} className="lg:col-span-1">
          <ActivityFeed items={fx.activities} compact />
        </SectionCard>
        <SectionCard title={g('sections.files')} className="lg:col-span-2">
          <FileList files={fx.files} onPreview={setPreview} />
          <div className="mt-4 border-t border-border pt-4">
            <ActivityFeed items={fx.activities.slice(0, 3)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title={g('sections.internal')}>
        <InternalNoteBox>{g('internalNote')}</InternalNoteBox>
      </SectionCard>

      <SectionCard title={g('sections.chips')}>
        <ChipFilter
          ariaLabel={g('sections.chips')}
          value={chip}
          onChange={setChip}
          options={[
            { value: 'blocked', label: g('chips.blocked'), count: 1 },
            { value: 'waiting_client', label: g('chips.waitingClient'), count: 3 },
            { value: 'overdue_receivable', label: g('chips.overdueReceivable'), count: 1 },
          ]}
        />
      </SectionCard>

      <SectionCard title={g('sections.dialogs')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setReasonOpen(true)}>
            {g('reason.open')}
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            {g('confirm.open')}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(fx.files[0] ?? null)}>
            {g('previewImage')}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(fx.files[1] ?? null)}>
            {g('previewPdf')}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(fx.files[2] ?? null)}>
            {g('previewOther')}
          </Button>
        </div>
        {lastReason ? <p className="mt-3 text-table text-muted-foreground">“{lastReason}”</p> : null}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={g('sections.states')}>
          <EmptyState
            icon={ClipboardList}
            title={g('empty.title')}
            description={g('empty.description')}
            action={<Button variant="outline">{g('empty.action')}</Button>}
          />
          <EmptyState compact title={g('empty.compact')} />
        </SectionCard>
        <SectionCard title={g('sections.errors')}>
          <ErrorState error={new ApiError('forbidden', 'errors.forbidden')} onRetry={() => undefined} />
          <ErrorState error={new Error('network')} onRetry={() => undefined} compact />
        </SectionCard>
      </div>

      <SectionCard title={g('sections.skeletons')}>
        <div className="space-y-6">
          <KpiSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <CardSkeleton />
            <ListSkeleton rows={3} />
          </div>
          <TableSkeleton rows={4} cols={6} />
          <div className="rounded-xl border border-dashed border-border p-4">
            <PageSkeleton />
          </div>
        </div>
      </SectionCard>

      <ReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title={g('reason.title')}
        description={g('reason.description')}
        label={g('reason.label')}
        placeholder={g('reason.placeholder')}
        confirmLabel={g('reason.confirm')}
        onConfirm={async (reason) => {
          await new Promise((r) => setTimeout(r, 600));
          setLastReason(reason);
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={g('confirm.title')}
        description={g('confirm.description')}
        confirmLabel={g('confirm.label')}
        destructive
        onConfirm={() => new Promise((r) => setTimeout(r, 600))}
      />
      <FilePreviewDialog file={preview} onOpenChange={(open) => (open ? undefined : setPreview(null))} />
    </div>
  );
}

/** Renders inside the app router when there is one, otherwise brings a MemoryRouter (for isolated rendering). */
export function CommonGallery() {
  const inRouter = useInRouterContext();
  if (inRouter) return <GalleryBody />;
  return (
    <MemoryRouter>
      <GalleryBody />
    </MemoryRouter>
  );
}
