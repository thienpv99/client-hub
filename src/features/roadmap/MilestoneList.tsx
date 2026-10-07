// Milestone list under the timeline (iPad / desktop): hairline-divided rows inside the card. From 1280px the rows
// line up in table columns under a subtle header band; below, each row stacks (name · actions → dates · tasks).
// "Khách thấy được" is a check item of the "…" menu at every width; a row only says so when it is the exception
// ("Ẩn với khách" tag next to the name) — no column of switches competing with the dates.
import { useId, useState } from 'react';
import type { MilestoneView } from '@/services/contract';
import { ForecastLabel } from '@/components/common/forecast-label';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { MilestoneActions, MilestoneStatusIcon, MilestoneStatusLine, MilestoneTags } from './MilestoneBits';
import { MilestoneTasks, MilestoneTasksToggle } from './MilestoneTasks';
import { useRoadmap } from './roadmapContext';
import { isDone } from './roadmapUtils';

const XL_GRID = 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_12rem_2.75rem] xl:items-center xl:gap-6';

function MilestoneListRow({ milestone: m, wide }: { milestone: MilestoneView; wide: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const done = isDone(m);
  const toggle = <MilestoneTasksToggle milestone={m} expanded={expanded} onToggle={() => setExpanded((e) => !e)} panelId={panelId} />;

  const nameBlock = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <MilestoneStatusIcon milestone={m} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={cn('min-w-0 break-words text-body font-semibold', done ? 'text-muted-foreground' : 'text-ink')}>{m.name}</h3>
          <MilestoneTags milestone={m} />
        </div>
        <MilestoneStatusLine milestone={m} className="mt-0.5 block" />
      </div>
    </div>
  );

  return (
    <li className="px-4 py-4 sm:px-5">
      {wide ? (
        <div className={XL_GRID}>
          {nameBlock}
          <ForecastLabel milestone={m} showReason manualTagShown />
          <div>{toggle}</div>
          <div className="flex justify-end">
            <MilestoneActions milestone={m} quickComplete={false} visibilityInMenu />
          </div>
        </div>
      ) : (
        // the tasks toggle sits beside the dates
        <div>
          <div className="flex items-start gap-3">
            {nameBlock}
            {/* the buttons (32px, 44px on touch) overlap the row instead of pushing the dates down */}
            <div className="-my-1 shrink-0 [@media(pointer:coarse)]:-my-2.5">
              <MilestoneActions milestone={m} visibilityInMenu />
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-1 pl-8">
            <ForecastLabel milestone={m} showReason manualTagShown className="min-w-0 flex-1 basis-64 py-1" />
            {toggle}
          </div>
        </div>
      )}
      {expanded ? <MilestoneTasks milestone={m} id={panelId} className="ml-8 mt-3" /> : null}
    </li>
  );
}

export function MilestoneList({ milestones }: { milestones: MilestoneView[] }) {
  const { canManage } = useRoadmap();
  const wide = useMediaQuery('(min-width: 1280px)');
  return (
    <div className="border-t border-border/60">
      {wide ? (
        <div
          className={cn(XL_GRID, 'h-10 border-b border-border/60 bg-subtle px-5 text-micro font-medium text-muted-foreground')}
          aria-hidden="true"
        >
          <span className="pl-8">{t('roadmap.list.colMilestone')}</span>
          <span>{t('roadmap.list.colForecast')}</span>
          <span>{t('roadmap.list.colTasks')}</span>
          <span className="sr-only">{canManage ? t('roadmap.list.colActions') : ''}</span>
        </div>
      ) : null}
      <ol className="divide-y divide-border/60">
        {milestones.map((m) => (
          <MilestoneListRow key={m.id} milestone={m} wide={wide} />
        ))}
      </ol>
    </div>
  );
}
