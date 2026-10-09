// "Mở rộng" (SPEC-CARE §6.4) — director / AM only (members get no departments; the tab is hidden for them). Answers
// "còn bán được gì" first: the picture (coverage · room to sell · gate), the gate banner while delivery debt blocks
// expanding, the ranked opportunities beside the solution groups the client has none of, then the full map by
// department with its edit sheet. `?dept=<key>` opens a department (links from the group matrix).
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import type { DepartmentKey } from '@/domain/careTypes';
import type { AccountDetail } from '@/services/contract';
import type { AccountCareView, DepartmentView } from '@/services/careContract';
import type { QueryResult } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import type { AccountAccess } from '../accountAccess';
import { accountTabPath } from '../accountTabs';
import { CareErrorCard } from '../care/careParts';
import { DepartmentList } from './expansion/DepartmentList';
import { DepartmentSheet } from './expansion/DepartmentSheet';
import { ExpansionPicture, OpportunityList, WhitespaceCard } from './expansion/ExpansionSummary';

export interface ExpansionTabProps {
  account: AccountDetail;
  access: AccountAccess;
  care: QueryResult<AccountCareView>;
}

type Panel = { dept: DepartmentView | null; department: DepartmentKey | null };

export function ExpansionTab({ account, access, care }: ExpansionTabProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState<Panel | null>(null);
  // keep the last panel's content while the drawer slides out
  const [last, setLast] = useState<Panel>({ dept: null, department: null });
  const data = care.data;

  const setDeptParam = useCallback(
    (value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null) next.delete('dept');
          else next.set('dept', value);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  if (!data && care.error) return <CareErrorCard error={care.error} onRetry={care.refetch} />;
  if (!data) {
    return (
      <div className="space-y-6 md:space-y-8">
        <CardSkeleton lines={3} />
        <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
          <CardSkeleton lines={4} className="xl:col-span-2" />
          <CardSkeleton lines={4} />
        </div>
      </div>
    );
  }
  const departments = data.departments;
  const expansion = data.expansion;
  if (!departments || !expansion) {
    // members: the api returns no map (the tab is normally hidden for them)
    return (
      <SectionCard>
        <EmptyState icon={MapIcon} title={t('careAccount.expansion.map.empty')} />
      </SectionCard>
    );
  }

  const deptParam = params.get('dept');
  const linked = deptParam ? (departments.find((d) => d.department === deptParam) ?? null) : null;
  const panel: Panel | null = linked ? { dept: linked, department: linked.department } : adding;
  const shown = panel ?? last;

  function openDept(d: DepartmentView) {
    setLast({ dept: d, department: d.department });
    setDeptParam(d.department);
  }

  function openNew(department: DepartmentKey) {
    const next = { dept: null, department };
    setLast(next);
    setAdding(next);
  }

  function close() {
    setAdding(null);
    if (deptParam) setDeptParam(null);
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* one gate message: the picture's gate cell carries it (requests owed, the way to them, the exception) */}
      <ExpansionPicture
        expansion={expansion}
        departments={departments}
        canOverride={access.director}
        onViewDebt={expansion.blocked ? () => navigate(accountTabPath(account.id, 'delivery', { filter: 'debt' })) : undefined}
      />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <OpportunityList departments={departments} onOpen={openDept} className="xl:col-span-2" />
        <WhitespaceCard expansion={expansion} departments={departments} />
      </div>
      <DepartmentList departments={departments} expansion={expansion} canEdit={data.can_manage} onEdit={openDept} onAdd={openNew} />
      {data.can_manage ? (
        <DepartmentSheet
          account={account}
          expansion={expansion}
          dept={shown.dept}
          department={shown.department}
          open={!!panel}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          canOverride={access.director}
        />
      ) : null}
    </div>
  );
}
