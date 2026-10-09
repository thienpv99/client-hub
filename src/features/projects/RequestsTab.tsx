// "Yêu cầu" tab (/app/projects/requests, SPEC-CARE §6.5): the change requests of every client the viewer can read.
// KPI row (open · delivery debt · waiting more than 7 days · urgent — the last three filter the list) → toolbar
// (search, client, "Tôi phụ trách", view switch Theo trạng thái / Theo ngày hẹn — URL-synced) → the board or the
// promised-date timeline. A card opens the shared triage sheet (?cr=<id>, also the target of deep links).
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, ClipboardList, Clock, Flame, Inbox, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { todayISO } from '@/domain/clock';
import type { ChangeRequestView } from '@/services/careContract';
import { CrTriageSheet } from '@/components/care/CrTriageSheet';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { KpiSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { toastInfo } from '@/lib/toast';
import { RequestBoard } from './RequestBoard';
import { useRequestMoves } from './RequestMoves';
import { RequestTimeline } from './RequestTimeline';
import { accountOptions, applyRequestCriteria, requestKpis, type RequestFlag, type RequestKpis, type RequestView } from './requestsModel';
import type { RequestParamsApi } from './useRequestParams';

const SEARCH_DEBOUNCE_MS = 250;
const ALL = '__all__';

export interface RequestsTabProps {
  rows: ChangeRequestView[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry(): void;
  params: RequestParamsApi;
  /** the board rises in on first appearance (the page's entry tab only) */
  stagger?: boolean;
  /** "Thêm yêu cầu" (the page header owns the dialog) */
  onCreate(): void;
}

/** "Cỏ Xanh" · "Cỏ Xanh, Thịnh An" · "Cỏ Xanh và 2 khách khác" */
function namesLine(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return t('carePm.kpi.namesMore', { first: names[0], count: names.length - 1 });
}

function RequestKpiRow({ k, active, onFilter }: { k: RequestKpis; active: RequestFlag | null; onFilter(f: RequestFlag): void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        label={t('carePm.kpi.open.label')}
        value={String(k.open)}
        sub={k.open > 0 ? t('carePm.kpi.open.sub', { accounts: k.openAccounts, done: k.done30 }) : t('carePm.kpi.open.subNone', { done: k.done30 })}
        icon={Inbox}
      />
      <KpiCard
        label={t('carePm.kpi.debt.label')}
        value={String(k.debt)}
        sub={k.debt > 0 ? t('carePm.kpi.debt.sub', { names: namesLine(k.debtAccounts) }) : t('carePm.kpi.debt.subNone')}
        tone={k.debt > 0 ? 'danger' : 'success'}
        icon={k.debt > 0 ? TriangleAlert : ShieldCheck}
        onClick={() => onFilter('debt')}
        active={active === 'debt'}
      />
      <KpiCard
        label={t('carePm.kpi.untriaged.label')}
        value={String(k.untriaged)}
        sub={k.untriaged > 0 ? t('carePm.kpi.untriaged.sub', { names: namesLine(k.untriagedAccounts) }) : t('carePm.kpi.untriaged.subNone')}
        tone={k.untriaged > 0 ? 'warning' : 'success'}
        icon={k.untriaged > 0 ? Clock : CircleCheck}
        onClick={() => onFilter('untriaged')}
        active={active === 'untriaged'}
      />
      <KpiCard
        label={t('carePm.kpi.urgent.label')}
        value={String(k.urgent)}
        sub={k.urgent > 0 ? t('carePm.kpi.urgent.sub') : t('carePm.kpi.urgent.subNone')}
        icon={Flame}
        onClick={() => onFilter('urgent')}
        active={active === 'urgent'}
      />
    </div>
  );
}

/** Theo trạng thái / Theo ngày hẹn */
function ViewSwitch({ view, onView, className }: { view: RequestView; onView(v: RequestView): void; className?: string }) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={view}
      onValueChange={(v) => {
        if (v === 'board' || v === 'timeline') onView(v);
      }}
      aria-label={t('carePm.toolbar.viewLabel')}
      className={className}
    >
      {/* phones: the short words, so the switch shares its row with "Tôi phụ trách" */}
      <ToggleGroupItem value="board" className="min-w-0 flex-1 px-3 sm:flex-none" aria-label={t('carePm.toolbar.viewBoard')}>
        <span className="truncate sm:hidden">{t('carePm.toolbar.viewBoardShort')}</span>
        <span className="hidden truncate sm:inline">{t('carePm.toolbar.viewBoard')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="timeline" className="min-w-0 flex-1 px-3 sm:flex-none" aria-label={t('carePm.toolbar.viewTimeline')}>
        <span className="truncate sm:hidden">{t('carePm.toolbar.viewTimelineShort')}</span>
        <span className="hidden truncate sm:inline">{t('carePm.toolbar.viewTimeline')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function RequestsSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* the real tiles carry a two-line context on the 4-up row: hold that height so nothing jumps */}
      <KpiSkeleton count={4} className="grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" itemClassName="lg:min-h-[142px]" />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Skeleton className="h-11 w-full rounded-lg sm:h-8 sm:w-[280px]" />
          <Skeleton className="h-11 w-44 rounded-lg sm:h-8" />
          <Skeleton className="h-11 w-32 rounded-full sm:h-8" />
          <Skeleton className="ml-auto h-10 w-60 rounded-lg md:h-8" />
        </div>
        <div role="status" aria-busy="true" className="skeleton-reveal flex gap-3 overflow-hidden xl:gap-4">
          {Array.from({ length: 4 }, (_, c) => (
            <div key={c} className="w-[82vw] max-w-[300px] shrink-0 space-y-2 rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60 md:w-[280px] xl:w-[248px]">
              <Skeleton className="m-1.5 h-4 w-28" />
              {Array.from({ length: 3 - (c % 2) }, (_, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ))}
          <span className="sr-only">{t('components.loading')}</span>
        </div>
      </div>
    </div>
  );
}

export function RequestsTab({ rows, loading, error, onRetry, params, stagger = false, onCreate }: RequestsTabProps) {
  const viewer = useViewer();
  const today = todayISO();
  const moves = useRequestMoves();
  const rise = useStagger(stagger && rows !== undefined);
  const roomy = useMediaQuery('(min-width: 640px)');

  // the box filters instantly; the URL (?q=) follows after a short pause so typing never fights the router
  const [query, setQuery] = useState(params.query);
  const lastPushed = useRef(params.query);
  const updateRef = useRef(params.update);
  updateRef.current = params.update;
  useEffect(() => {
    if (params.query !== lastPushed.current) {
      lastPushed.current = params.query;
      setQuery(params.query);
    }
  }, [params.query]);
  useEffect(() => {
    if (query === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = query.trim() ? query : '';
      updateRef.current({ query });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // the request of the open sheet (?cr=); the last one stays while the sheet slides out
  const selected = useMemo(() => (params.crId && rows ? rows.find((cr) => cr.id === params.crId) ?? null : null), [params.crId, rows]);
  const lastSelected = useRef<ChangeRequestView | null>(null);
  if (selected) lastSelected.current = selected;

  // a link to a request that is gone (or out of reach): say so once and drop ?cr= so a reload does not repeat it.
  // A short grace period: a request just created lands here before the list has refetched it.
  const reported = useRef<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    const id = params.crId;
    if (!id || !rows || rows.some((cr) => cr.id === id)) return undefined;
    const timer = window.setTimeout(() => {
      const latest = rowsRef.current;
      if (!latest || latest.some((cr) => cr.id === id)) return;
      if (reported.current !== id) toastInfo(t('careAccount.delivery.requests.notFound'));
      reported.current = id;
      updateRef.current({ crId: null });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [params.crId, rows]);

  if (!rows) {
    if (loading) return <RequestsSkeleton />;
    return (
      <Card>
        <ErrorState error={error} onRetry={onRetry} />
      </Card>
    );
  }

  const viewerId = viewer?.user.id ?? null;
  const kpis = requestKpis(rows, today);
  const criteria = { flag: params.flag, accountId: params.accountId, mine: params.mine, viewerId, query };
  const shown = applyRequestCriteria(rows, criteria);
  const accounts = accountOptions(rows);
  const mineCount = applyRequestCriteria(rows, { ...criteria, mine: true }).length;
  const account = accounts.find((o) => o.account.id === params.accountId)?.account ?? null;
  const q = query.trim();
  const filtering = Boolean(params.flag || params.accountId || params.mine || q);

  function clearAll() {
    lastPushed.current = '';
    setQuery('');
    params.clear();
  }

  const resultParts = [filtering ? t('carePm.toolbar.result', { shown: shown.length, total: rows.length }) : t('carePm.toolbar.count', { total: rows.length })];
  if (params.flag) resultParts.push(t(`carePm.toolbar.flags.${params.flag}`));
  if (account) resultParts.push(account.short_name || account.name);
  if (params.mine) resultParts.push(t('carePm.toolbar.mine'));
  if (q) resultParts.push(`“${q}”`);

  const open = (cr: ChangeRequestView) => params.update({ crId: cr.id });

  /** "33 yêu cầu", or "5/33 yêu cầu · Nợ triển khai · Cỏ Xanh" + "Bỏ lọc" while a filter is on */
  const resultLine = (className: string) => (
    <div className={cn('min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <p className="text-caption" aria-live="polite">
        <span className="tabular">{resultParts.join(' · ')}</span>
      </p>
      {filtering ? (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-primary hover:text-primary-hover">
          <X aria-hidden="true" />
          {t('carePm.toolbar.clear')}
        </Button>
      ) : null}
    </div>
  );

  let content;
  if (rows.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title={t('carePm.empty.title')}
          description={t('carePm.empty.description')}
          action={
            <Button variant="soft" onClick={onCreate}>
              {t('care.kit.newRequest')}
            </Button>
          }
        />
      </Card>
    );
  } else if (shown.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={Search}
          title={q ? t('carePm.empty.search', { query: q }) : t('carePm.empty.filtered')}
          description={t('carePm.empty.filteredHint')}
          action={
            <Button variant="secondary" onClick={clearAll}>
              {t('carePm.toolbar.clear')}
            </Button>
          }
        />
      </Card>
    );
  } else if (params.view === 'timeline') {
    content = <RequestTimeline rows={shown} today={today} onOpen={open} />;
  } else {
    content = <RequestBoard rows={shown} moves={moves} today={today} onOpen={open} rise={rise} />;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <RequestKpiRow k={kpis} active={params.flag} onFilter={(f) => params.update({ flag: params.flag === f ? null : f })} />

      <div className="space-y-3">
        {/* below 1280: search + client on the first row, "Tôi phụ trách" + the view switch on the second */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 xl:contents">
            <Input
              type="search"
              inputSize="sm"
              icon={<Search />}
              wrapperClassName="min-w-0 flex-1 sm:w-[280px] sm:flex-none xl:w-[264px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  setQuery('');
                }
              }}
              placeholder={t(roomy ? 'carePm.toolbar.searchPlaceholder' : 'carePm.toolbar.searchPlaceholderShort')}
              aria-label={t('carePm.toolbar.searchLabel')}
              autoComplete="off"
              enterKeyHint="search"
            />
            <NativeSelect
              size="sm"
              aria-label={t('carePm.toolbar.accountLabel')}
              value={params.accountId ?? ALL}
              onChange={(e) => params.update({ accountId: e.target.value === ALL ? null : e.target.value })}
              wrapperClassName="w-[10.5rem] shrink-0 sm:w-52"
            >
              <option value={ALL}>{t('carePm.toolbar.accountAll')}</option>
              {accounts.map((o) => (
                <option key={o.account.id} value={o.account.id}>
                  {o.account.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex min-w-0 items-center gap-2 xl:flex-1">
            {/* only for people who own requests (a director who owns none gets no empty chip) */}
            {mineCount > 0 || params.mine ? (
              <ChipFilter<'mine'>
                options={[{ value: 'mine', label: t('carePm.toolbar.mine'), count: mineCount }]}
                value={params.mine ? 'mine' : null}
                onChange={(v) => params.update({ mine: v === 'mine' })}
                ariaLabel={t('carePm.toolbar.mineLabel')}
                className="shrink-0"
              />
            ) : null}
            {/* from 640px the result line shares this row (one row less above the board) */}
            {resultLine('hidden sm:flex')}
            <ViewSwitch view={params.view} onView={(v) => params.update({ view: v })} className="ml-auto min-w-0 flex-1 sm:flex-none" />
          </div>
        </div>
        {resultLine('flex sm:hidden')}

        <div className={cn(params.view === 'board' && 'pt-1')}>{content}</div>
      </div>

      <CrTriageSheet
        request={selected ?? lastSelected.current}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) params.update({ crId: null });
        }}
      />
      {moves.dialogs}
    </div>
  );
}
