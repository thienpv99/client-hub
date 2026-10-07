// Account overview (SPEC §4.2 "Tab Tổng quan"). Focal block first: "Tình hình" (health, why, who is waiting); then
// the exec summary and the tasks waiting on each side. Side column: the client's decision makers, the commercial
// summary and internal notes.
// Desktop (xl): main 2/3 + side 1/3. Phones / iPad (the full sidebar already takes 248px at 1024): one column.
// The DOM order is the visual order at every size (keyboard focus follows it).
import type { AccountDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { useAccountAccess } from '../accountAccess';
import { CommercialCard, DecisionMakersCard } from './overview/InfoCards';
import { StatusCard } from './overview/StatusCard';
import { ExecSummaryCard, InternalNotesCard } from './overview/TextCards';
import { WaitingTasksCard } from './overview/WaitingTasksCard';

export interface OverviewTabProps {
  account: AccountDetail;
}

export function OverviewTab({ account }: OverviewTabProps) {
  const access = useAccountAccess(account);
  const tasks = useQuery(() => api.listTasks({ accountId: account.id, openOnly: true }), [account.id]);
  const showProject = account.projects.length > 1;

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
        <StatusCard account={account} />
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
        <DecisionMakersCard account={account} />
        {account.commercial ? <CommercialCard account={account} summary={account.commercial} /> : null}
        <InternalNotesCard account={account} canEdit={access.manage} />
      </div>
    </div>
  );
}
