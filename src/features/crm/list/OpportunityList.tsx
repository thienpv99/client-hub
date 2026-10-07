// Danh sách cơ hội: toolbar (search 280px, stage filter in the URL `?stage=`, sort, result count), then a table
// in a card from 1280px and cards below (DESIGN §4 table → cards below xl).
import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert, Handshake, Search } from 'lucide-react';
import type { OpportunityStage } from '@/domain/crmTypes';
import type { OpportunityView } from '@/services/crmContract';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatDate, formatMoneyCompact, formatPercent, formatRelativeDays } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { UserAvatar } from '@/components/common/user-avatar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { crmPaths, isOpenStage, STAGE_ORDER, stageLabel } from '@/components/crm/crmLabels';
import { OpportunityStageBadge } from '@/components/crm/OpportunityStageBadge';
import { CloseDateLine, NextStepLine } from '../pipeline/OpportunityCard';
import { daysFrom, DEFAULT_DIR, matchesSearch, sortOpportunities, sumValue, sumWeighted } from '../crmModel';
import type { SortKey, SortState } from '../crmModel';

type StageFilter = 'open' | 'all' | OpportunityStage;

function parseStage(raw: string | null): StageFilter {
  if (raw === 'all') return 'all';
  if (raw && (STAGE_ORDER as readonly string[]).includes(raw)) return raw as OpportunityStage;
  return 'open';
}

const SORT_KEYS: readonly SortKey[] = ['close', 'value', 'weighted', 'updated', 'account'];

/** 'Nguyễn Thu Hà' → 'Thu Hà' (table cells) */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length <= 2 ? full.trim() : parts.slice(-2).join(' ');
}

/** clicks on links / buttons inside a row, or a text selection, do not open the deal */
function ignoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a,button,input,select,textarea,label')) return true;
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().length > 0);
}

function SortHeader({ label, k, sort, onSort, align = 'left' }: { label: string; k: SortKey; sort: SortState; onSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-50 group-hover/sort:opacity-100')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** table cell: the close date, then "còn 10 ngày" or (danger, with icon) "Quá hạn 3 ngày"; closed deals: outcome date */
function CloseCell({ o, today }: { o: OpportunityView; today: string }) {
  if (!isOpenStage(o.stage)) {
    // the stage column already says won / lost: the date alone (the sentence in the tooltip)
    const at = o.won_at ?? o.lost_at;
    return at ? (
      <span className="text-table tabular text-muted-foreground" title={t(o.stage === 'won' ? 'crm.opportunity.wonOn' : 'crm.opportunity.lostOn', { date: formatDate(at) })}>
        {formatDate(at)}
      </span>
    ) : (
      <span className="text-caption">{t('crm.list.closed')}</span>
    );
  }
  const days = daysFrom(today, o.expected_close_date);
  return (
    <div className="tabular">
      <p className="text-table text-foreground">{formatDate(o.expected_close_date)}</p>
      {o.close_overdue && days < 0 ? (
        <p className="flex items-center gap-1 text-micro font-medium text-danger">
          <CircleAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('crm.list.closeOverdue', { days: -days })}
        </p>
      ) : (
        <p className="text-micro text-muted-foreground">{formatRelativeDays(days)}</p>
      )}
    </div>
  );
}

function OpportunityRowCard({ o, today }: { o: OpportunityView; today: string }) {
  const open = isOpenStage(o.stage);
  return (
    <li className="min-w-0">
      <Card interactive className="relative h-full space-y-3 p-4 hover:border-primary-border focus-within:border-primary-border">
        <div className="flex items-start gap-3">
          <AccountLogo account={o.account} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-micro font-medium text-muted-foreground">{o.account.name}</p>
            <Link
              to={crmPaths.opportunity(o.id)}
              className="line-clamp-2 text-table font-semibold leading-5 text-ink after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
            >
              {o.name}
            </Link>
          </div>
          <OpportunityStageBadge stage={o.stage} />
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1.5 tabular">
          <span className="text-body font-semibold text-ink">{formatMoneyCompact(o.value)}</span>
          {open ? (
            <span className="text-micro text-muted-foreground">
              {t('crm.list.weightedLine', { weighted: formatMoneyCompact(o.weighted_value), pct: formatPercent(o.probability) })}
            </span>
          ) : null}
        </p>
        {open ? (
          <NextStepLine opp={o} today={today} />
        ) : o.stage === 'lost' && o.lost_reason ? (
          <p className={cn('line-clamp-2 text-muted-foreground', SMALL)}>{t('crm.list.lostReason', { reason: o.lost_reason })}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-3">
          <UserAvatar user={o.owner} size="xs" />
          <span className="min-w-0 truncate text-micro text-muted-foreground">{o.owner.full_name}</span>
          {open ? <CloseDateLine opp={o} today={today} compact className="ml-auto" /> : null}
        </div>
      </Card>
    </li>
  );
}

export function OpportunityList({ items, today }: { items: OpportunityView[]; today: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const stage = parseStage(params.get('stage'));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'close', dir: 'asc' });
  const wide = useMediaQuery('(min-width: 1280px)');

  const setStage = (next: StageFilter) => {
    const p = new URLSearchParams(params);
    if (next === 'open') p.delete('stage');
    else p.set('stage', next);
    setParams(p, { replace: true });
  };

  const clearFilters = () => {
    setQuery('');
    setSort({ key: 'close', dir: 'asc' });
    setStage('open');
  };

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: DEFAULT_DIR[k] }));

  const rows = useMemo(() => {
    const filtered = items.filter((o) => {
      if (stage === 'open' && !isOpenStage(o.stage)) return false;
      if (stage !== 'open' && stage !== 'all' && o.stage !== stage) return false;
      return matchesSearch(o, query);
    });
    return sortOpportunities(filtered, sort);
  }, [items, stage, query, sort]);

  const summary =
    rows.length > 0
      ? t('crm.list.summary', { count: rows.length, value: formatMoneyCompact(sumValue(rows)), weighted: formatMoneyCompact(sumWeighted(rows)) })
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
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
          placeholder={t('crm.list.searchPlaceholder')}
          aria-label={t('crm.list.searchLabel')}
          wrapperClassName="w-full md:w-[280px]"
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <NativeSelect
            size="sm"
            aria-label={t('crm.list.stageFilter')}
            value={stage}
            onChange={(e) => setStage(parseStage(e.target.value))}
            wrapperClassName="md:w-44"
          >
            <option value="open">{t('crm.list.stageOpen')}</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
            <option value="all">{t('crm.list.stageAll')}</option>
          </NativeSelect>
          <NativeSelect
            size="sm"
            aria-label={t('crm.list.sortLabel')}
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(':');
              if (SORT_KEYS.includes(k as SortKey)) setSort({ key: k as SortKey, dir: d === 'desc' ? 'desc' : 'asc' });
            }}
            wrapperClassName="md:w-52"
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={`${k}:${DEFAULT_DIR[k]}`}>
                {t(`crm.list.sort.${k}`)}
              </option>
            ))}
            {sort.dir !== DEFAULT_DIR[sort.key] ? (
              <option value={`${sort.key}:${sort.dir}`}>{t(`crm.list.sortReversed.${sort.key}`)}</option>
            ) : null}
          </NativeSelect>
        </div>
        {summary ? (
          <p className="text-caption tabular md:ml-auto" aria-live="polite">
            {summary}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          {items.length === 0 ? (
            <EmptyState icon={Handshake} title={t('crm.list.emptyAll')} description={t('crm.list.emptyAllHint')} />
          ) : (
            <SearchEmptyState entity="opportunity" query={query} icon={Handshake} onClear={clearFilters} />
          )}
        </Card>
      ) : wide ? (
        <Card className="overflow-hidden">
          <Table>
            <TableCaption className="sr-only">{t('crm.list.tableCaption')}</TableCaption>
            <TableHeader>
              <TableRow>
                <SortHeader label={t('crm.list.col.deal')} k="account" sort={sort} onSort={onSort} />
                <TableHead>{t('crm.list.col.stage')}</TableHead>
                <SortHeader label={t('crm.list.col.value')} k="value" sort={sort} onSort={onSort} align="right" />
                <SortHeader label={t('crm.list.col.weighted')} k="weighted" sort={sort} onSort={onSort} align="right" />
                <SortHeader label={t('crm.list.col.close')} k="close" sort={sort} onSort={onSort} />
                <TableHead>{t('crm.list.col.owner')}</TableHead>
                <TableHead>{t('crm.list.col.next')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if (!ignoreRowClick(e)) navigate(crmPaths.opportunity(o.id));
                  }}
                >
                  <TableCell className="max-w-[18rem]">
                    <div className="flex items-center gap-3">
                      <AccountLogo account={o.account} size="sm" />
                      <div className="min-w-0">
                        <Link
                          to={crmPaths.opportunity(o.id)}
                          className="line-clamp-1 font-semibold text-ink underline-offset-4 hover:underline"
                          title={o.name}
                        >
                          {o.name}
                        </Link>
                        <p className="truncate text-caption">{o.account.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OpportunityStageBadge stage={o.stage} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold text-ink">{formatMoneyCompact(o.value)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatMoneyCompact(o.weighted_value)}
                    <span className="block text-micro text-muted-foreground">{formatPercent(o.probability)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <CloseCell o={o} today={today} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-2" title={o.owner.full_name}>
                      <UserAvatar user={o.owner} size="xs" />
                      <span className="text-muted-foreground">{shortName(o.owner.full_name)}</span>
                    </span>
                  </TableCell>
                  {/* 8rem keeps the 7 columns inside the card at 1280 (no inner scrollbar) */}
                  <TableCell className="min-w-[8rem] max-w-[16rem]">
                    {isOpenStage(o.stage) ? (
                      <NextStepLine opp={o} today={today} />
                    ) : o.lost_reason ? (
                      <p className={cn('line-clamp-2 text-muted-foreground', SMALL)}>{t('crm.list.lostReason', { reason: o.lost_reason })}</p>
                    ) : (
                      <span className="text-caption">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((o) => (
            <OpportunityRowCard key={o.id} o={o} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}
