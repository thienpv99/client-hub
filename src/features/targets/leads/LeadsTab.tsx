// "Mục tiêu" tab (DESIGN §5 list page): KPI tiles → toolbar (search, owner switch, "Bộ lọc", sort) → status chips
// with counts + result line → table ≥1280 or cards below, multi-select with a floating bulk bar. Filters live in
// the URL (useLeadParams). The page header owns "Thêm mục tiêu".
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Search, Target, UserSearch } from 'lucide-react';
import type { LeadFilter, LeadView, SegmentView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { api } from '@/services/api';
import { useMediaQuery } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/i18n';
import { TargetStats } from '../TargetStats';
import { LeadBulkBar } from './LeadBulkBar';
import { LeadFilterButton, LeadFilterSummary, OwnerSwitch, StatusChips } from './LeadFilters';
import { LeadCards, LeadTable } from './LeadList';
import { filterByStatus, filterExceptStatus, isSelectable, sortLeads, statusCounts } from './leadModel';
import { LEAD_SORTS, useLeadParams } from './useLeadParams';
import type { LeadSort } from './useLeadParams';

const SEARCH_DEBOUNCE_MS = 250;
const EMPTY_SEGMENTS: SegmentView[] = [];

function serverFilter(owner: string, segmentId: string | null): LeadFilter {
  const f: LeadFilter = {};
  if (owner === 'me' || owner === 'none') f.owner = owner;
  else if (owner !== 'all') f.ownerId = owner;
  if (segmentId) f.segmentId = segmentId;
  return f;
}

export interface LeadsTabProps {
  people: UserRef[];
  isDirector: boolean;
  meId: string;
  onOpenLead: (id: string) => void;
  /** opens the page's "Thêm mục tiêu" form (empty state action) */
  onAddLead: () => void;
}

export function LeadsTab({ people, isDirector, meId, onOpenLead, onAddLead }: LeadsTabProps) {
  const params = useLeadParams(isDirector ? 'all' : 'me');
  const wide = useMediaQuery('(min-width: 1280px)');
  const tablet = useMediaQuery('(min-width: 768px)');
  const today = todayISO();
  const filter = useMemo(() => serverFilter(params.owner, params.segmentId), [params.owner, params.segmentId]);
  const leadsQ = useQuery(() => api.listLeads(filter), [JSON.stringify(filter), meId], { keepPreviousData: true });
  const segmentsQ = useQuery(() => api.listSegments(), [meId]);
  const segments = segmentsQ.data ?? EMPTY_SEGMENTS;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // the box filters instantly; the URL (?q=) follows after a short pause
  const [query, setQuery] = useState(params.q);
  const pushed = useRef(params.q);
  const updateRef = useRef(params.update);
  updateRef.current = params.update;
  useEffect(() => {
    if (params.q !== pushed.current) {
      pushed.current = params.q;
      setQuery(params.q);
    }
  }, [params.q]);
  useEffect(() => {
    if (query === pushed.current) return;
    const timer = window.setTimeout(() => {
      pushed.current = query.trim() ? query : '';
      updateRef.current({ q: query });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const leads: LeadView[] = leadsQ.data ?? [];
  const base = filterExceptStatus(leads, { grade: params.grade, due: params.due, q: query }, today);
  const counts = statusCounts(base);
  const shown = sortLeads(filterByStatus(base, params.status), params.sort);
  const selectedIds = shown.filter((l) => selected.has(l.id) && isSelectable(l.status)).map((l) => l.id);
  const filtered = params.filtered || query.trim() !== '';

  function clearAll() {
    pushed.current = '';
    setQuery('');
    params.clear();
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(shown.filter((l) => isSelectable(l.status)).map((l) => l.id)) : new Set());
  }

  let body: ReactNode;
  if (leadsQ.data === undefined) {
    body = leadsQ.loading ? (
      <>
        <div className="flex gap-2" aria-hidden="true">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <TableSkeleton rows={6} cols={7} />
      </>
    ) : (
      <Card>
        <ErrorState error={leadsQ.error} onRetry={leadsQ.refetch} />
      </Card>
    );
  } else {
    body = (
      <>
        <div className="space-y-3">
          <StatusChips params={params} counts={counts} />
          <LeadFilterSummary
            shown={shown.length}
            total={leads.length}
            params={params}
            people={people}
            segments={segments}
            onClear={clearAll}
          />
        </div>
        {shown.length > 0 ? (
          wide ? (
            <LeadTable leads={shown} today={today} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onOpen={onOpenLead} />
          ) : (
            <LeadCards leads={shown} today={today} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onOpen={onOpenLead} />
          )
        ) : leads.length === 0 && !filtered && params.owner === 'me' ? (
          <Card>
            <EmptyState
              icon={UserSearch}
              title={t('targets.leads.empty.mine')}
              description={t('targets.leads.empty.mineHint')}
              action={
                <Button type="button" variant="secondary" onClick={() => params.update({ owner: 'none' })}>
                  {t('targets.leads.empty.showUnassigned')}
                </Button>
              }
            />
          </Card>
        ) : leads.length === 0 && !filtered ? (
          <Card>
            <EmptyState
              icon={Target}
              title={t('targets.leads.empty.none')}
              description={t('targets.leads.empty.noneHint')}
              action={
                <Button type="button" variant="secondary" onClick={onAddLead}>
                  <Plus aria-hidden="true" />
                  {t('targets.leads.add')}
                </Button>
              }
            />
          </Card>
        ) : (
          <Card>
            <SearchEmptyState entity="lead" query={query} icon={Target} onClear={clearAll} />
          </Card>
        )}
        {/* room under the last row for the floating bulk bar */}
        {selectedIds.length > 0 ? <div aria-hidden="true" className="h-12" /> : null}
        {selectedIds.length > 0 ? (
          <LeadBulkBar
            ids={selectedIds}
            people={people}
            isDirector={isDirector}
            meId={meId}
            onDone={() => setSelected(new Set())}
            onClear={() => setSelected(new Set())}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <TargetStats isDirector={isDirector} meId={meId} params={params} />

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <Input
          type="search"
          icon={<Search />}
          inputSize="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              setQuery('');
            }
          }}
          placeholder={t('targets.leads.searchPlaceholder')}
          aria-label={t('targets.leads.searchLabel')}
          wrapperClassName="w-full md:w-[280px]"
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="flex min-w-0 items-center gap-2">
          <OwnerSwitch params={params} className="min-w-0 flex-1 md:flex-none" />
          <LeadFilterButton params={params} people={people} segments={segments} isDirector={isDirector} />
        </div>
        {tablet ? (
          <label className="flex items-center gap-2 md:ml-auto">
            <span className="shrink-0 text-caption">{t('targets.leads.sortLabel')}</span>
            <NativeSelect
              size="sm"
              value={params.sort}
              onChange={(e) => {
                const v = e.target.value;
                if ((LEAD_SORTS as string[]).includes(v)) params.update({ sort: v as LeadSort });
              }}
              wrapperClassName="w-40"
            >
              {LEAD_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`targets.leads.sort.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
      </div>

      {body}
    </div>
  );
}
