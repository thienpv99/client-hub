// Account overview (SPEC §4.2 "Tab Tổng quan", SPEC-CARE §6.4). Focal block first: "Tình hình" (health, why, who is
// waiting); then the care picture — what the client already uses ("Đã triển khai", full width), how delivery is going
// ("Sức khỏe triển khai") and the room to sell more ("Mở rộng"); then the exec summary and the tasks waiting on each
// side. Side column: care (last touch, cadence, next action, "Ghi lần chăm sóc"), the key relationships, the
// commercial summary and internal notes.
// Members get deployments and the request roll-up only (no expansion, people or care — SPEC-CARE §5): their side
// column keeps the decision makers from the contact list.
// Desktop (xl): main 2/3 + side 1/3. Phones / iPad (the full sidebar already takes 248px at 1024): one column.
// The DOM order is the visual order at every size (keyboard focus follows it).
import type { AccountDetail } from '@/services/contract';
import type { AccountCareView } from '@/services/careContract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import type { QueryResult } from '@/hooks/useQuery';
import { useBreakpoint } from '@/hooks/useMedia';
import { useArrivalMotion, useStagger } from '@/hooks/useMotion';
import { cn } from '@/components/ui/cn';
import { CardSkeleton } from '@/components/common/skeletons';
import { useAccountAccess } from '../accountAccess';
import { CareErrorCard } from '../care/careParts';
import { CareCard } from './overview/CareCard';
import { DeliveryHealthCard, DeployedCard, ExpansionCard } from './overview/CareCards';
import { CommercialCard, DecisionMakersCard } from './overview/InfoCards';
import { KeyPeopleCard } from './overview/KeyPeopleCard';
import { StatusCard } from './overview/StatusCard';
import { ExecSummaryCard, InternalNotesCard } from './overview/TextCards';
import { WaitingTasksCard } from './overview/WaitingTasksCard';

export interface OverviewTabProps {
  account: AccountDetail;
  care: QueryResult<AccountCareView>;
}

/** the care cards of the main column (loading → the same grid of skeletons, no jump) */
function CarePicture({ account, care }: OverviewTabProps) {
  const access = useAccountAccess(account);
  const data = care.data;
  // stagger on page arrival only — a tab switch back to Tổng quan just fades the tab (DESIGN §8.3)
  const arrival = useArrivalMotion();
  const rise = useStagger(!!data && arrival);
  if (!data && care.error) return <CareErrorCard error={care.error} onRetry={care.refetch} />;
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <CardSkeleton lines={3} className="md:col-span-2" />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    );
  }
  const expansion = data.expansion;
  // each card sits in a stretching cell, so the two half-width cards of a row end on one line
  const cell = (i: number, wide: boolean) => {
    const p = rise(i);
    return { className: cn('flex min-w-0 flex-col [&>*]:flex-1', wide && 'md:col-span-2', p.className), style: p.style };
  };
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      <div {...cell(0, true)}>
        <DeployedCard accountId={account.id} deployments={data.deployments} />
      </div>
      <div {...cell(1, !expansion)}>
        <DeliveryHealthCard accountId={account.id} requests={data.requests} canOverride={access.director} />
      </div>
      {expansion ? (
        <div {...cell(2, false)}>
          <ExpansionCard accountId={account.id} expansion={expansion} />
        </div>
      ) : null}
    </div>
  );
}

export function OverviewTab({ account, care }: OverviewTabProps) {
  const access = useAccountAccess(account);
  const tasks = useQuery(() => api.listTasks({ accountId: account.id, openOnly: true }), [account.id]);
  const showProject = account.projects.length > 1;
  const data = care.data;
  // director / AM: care card + key people (from the care view); members (or while it loads): the decision makers
  const careInfo = data?.care ?? null;
  const keyPeople = data?.key_people ?? null;
  const wide = useBreakpoint() === 'desktop';

  // care + key people: the side column from xl; below xl (one column) they come right after the care picture, side
  // by side from md, instead of after the task lists — rendered in one place only (no duplicate dialogs)
  const people = (
    <>
      {access.care && !data && !care.error ? <CardSkeleton lines={3} /> : null}
      {careInfo ? <CareCard account={account} care={careInfo} canEdit={access.manage} /> : null}
      {keyPeople ? (
        <KeyPeopleCard
          accountId={account.id}
          keyPeople={keyPeople}
          people={data?.stakeholders ?? []}
          peopleCount={data?.stakeholders?.length ?? account.contacts.length}
        />
      ) : !access.care || care.error ? (
        <DecisionMakersCard account={account} />
      ) : null}
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
        <StatusCard account={account} />
        <CarePicture account={account} care={care} />
        {wide ? null : <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">{people}</div>}
        <ExecSummaryCard account={account} canEdit={access.manage} />
        <WaitingTasksCard
          side="client"
          accountId={account.id}
          tasks={tasks.data}
          error={tasks.error}
          onRetry={tasks.refetch}
          showProject={showProject}
        />
        <WaitingTasksCard
          side="internal"
          accountId={account.id}
          tasks={tasks.data}
          error={tasks.error}
          onRetry={tasks.refetch}
          showProject={showProject}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        {wide ? people : null}
        {account.commercial ? <CommercialCard account={account} summary={account.commercial} /> : null}
        <InternalNotesCard account={account} canEdit={access.manage} />
      </div>
    </div>
  );
}
