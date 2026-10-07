// Phone layout: one vertical timeline that carries everything (status, plan → forecast with reason, tasks, actions
// incl. "Khách thấy được" in the "…" menu) with a "Hôm nay" marker between the milestones.
import { Fragment, useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { ForecastLabel } from '@/components/common/forecast-label';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { MilestoneActions, MilestoneStatusLine, MilestoneTags } from './MilestoneBits';
import { MilestoneTasks, MilestoneTasksToggle } from './MilestoneTasks';
import { useRoadmap } from './roadmapContext';
import { isDone, todayIndex } from './roadmapUtils';

function Node({ milestone, index }: { milestone: MilestoneView; index: number }) {
  const { currentId } = useRoadmap();
  if (isDone(milestone)) {
    return (
      <span
        aria-hidden="true"
        className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success ring-4 ring-card"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  const current = milestone.id === currentId;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold tabular',
        current
          ? 'bg-primary text-primary-foreground shadow-btn ring-4 ring-primary-soft'
          : 'bg-card text-muted-foreground ring-1 ring-inset ring-border-strong',
      )}
    >
      {index + 1}
    </span>
  );
}

function TodayMarker({ last }: { last: boolean }) {
  const { today } = useRoadmap();
  const label = t('roadmap.timeline.todayDate', { date: formatDateShort(today) });
  return (
    <li className={cn('relative flex items-center gap-3', last ? 'pb-0' : 'pb-5')}>
      <span className="relative z-10 flex w-7 shrink-0 justify-center" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
      </span>
      <span className="h-px flex-1 border-t border-dashed border-primary/40" aria-hidden="true" />
      <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-primary-soft px-2 text-micro font-medium tabular text-primary ring-1 ring-inset ring-primary-border">
        {label}
      </span>
    </li>
  );
}

function Item({ milestone: m, index, last }: { milestone: MilestoneView; index: number; last: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const done = isDone(m);
  // one control under the dates (the tasks); "Khách thấy được" lives in the "…" menu, "Ẩn với khách" shows as a tag
  return (
    <li className={cn('relative flex gap-3', last ? 'pb-0' : 'pb-5')}>
      <Node milestone={m} index={index} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className={cn('break-words text-body font-semibold', done ? 'text-muted-foreground' : 'text-ink')}>{m.name}</h3>
            <MilestoneStatusLine milestone={m} className="block" />
          </div>
          {/* the 44px touch target overlaps the row instead of pushing the dates down */}
          <div className="-my-2.5 -mr-2 shrink-0">
            <MilestoneActions milestone={m} quickComplete={false} visibilityInMenu />
          </div>
        </div>
        <ForecastLabel milestone={m} showReason manualTagShown className="mt-1" />
        <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
          <MilestoneTags milestone={m} />
        </div>
        <MilestoneTasksToggle
          milestone={m}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
          panelId={panelId}
          className="mt-0.5"
        />
        {expanded ? <MilestoneTasks milestone={m} id={panelId} className="mt-2" /> : null}
      </div>
    </li>
  );
}

export function MilestoneVerticalTimeline({ milestones }: { milestones: MilestoneView[] }) {
  const { today } = useRoadmap();
  const todayAt = todayIndex(milestones, today);
  return (
    <ol className="relative isolate" aria-label={t('roadmap.timeline.title')}>
      {/* the rail */}
      <span aria-hidden="true" className="absolute bottom-3 left-[13px] top-3 w-0.5 rounded-full bg-border" />
      {milestones.map((m, i) => (
        <Fragment key={m.id}>
          {i === todayAt ? <TodayMarker last={false} /> : null}
          <Item milestone={m} index={i} last={i === milestones.length - 1 && todayAt !== milestones.length} />
        </Fragment>
      ))}
      {todayAt === milestones.length ? <TodayMarker last /> : null}
    </ol>
  );
}
