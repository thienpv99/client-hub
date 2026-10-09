// Ctrl/Cmd + K quick search for New Era staff: page shortcuts + api.search (debounced 150 ms), grouped by type.
// SPEC-CARE §6.8: shortcuts to the change requests and the group matrix; while sales / prospecting are switched off
// (config/features.ts) their pages and their results (deals, target companies) are left out.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Boxes,
  Building2,
  CornerDownLeft,
  Handshake,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Receipt,
  SearchX,
  Target,
  UserRound,
} from 'lucide-react';
import { isFeatureOn, type FeatureFlag } from '@/config/features';
import type { Role, SearchResult } from '@/services/contract';
import { api } from '@/services/api';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { PENDING_VISUAL_DELAY_MS, useDelayedFlag } from '@/hooks/useMotion';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { cn, normalizeText } from '@/lib/utils';

type ResultType = SearchResult['type'];

const GROUP_ORDER: ResultType[] = ['page', 'account', 'request', 'task', 'deployment', 'opportunity', 'lead', 'quote', 'contact'];
const MAX_PER_GROUP = 6;
const SEARCH_DEBOUNCE_MS = 150;
/** when the query matches a single kind of result */
const MAX_SINGLE_GROUP = 12;

const TYPE_ICON: Record<ResultType, LucideIcon> = {
  page: ArrowRight,
  account: Building2,
  task: ListChecks,
  quote: Receipt,
  contact: UserRound,
  opportunity: Handshake,
  lead: Target,
  request: MessageSquareText,
  deployment: Boxes,
};

interface PageShortcut {
  key: string;
  href: string;
  roles?: Role[];
  /** listed only while this feature flag is on */
  feature?: FeatureFlag;
}

const MANAGERS: Role[] = ['director', 'am'];

const PAGES: PageShortcut[] = [
  { key: 'dashboard', href: '/app', roles: MANAGERS },
  { key: 'accounts', href: '/app/accounts' },
  { key: 'map', href: '/app/map', roles: MANAGERS },
  { key: 'groupMatrix', href: '/app/map?view=matrix', roles: MANAGERS },
  { key: 'newAccount', href: '/app/accounts/new', roles: MANAGERS },
  { key: 'myTasks', href: '/app/tasks?mine=1' },
  { key: 'tasks', href: '/app/tasks' },
  { key: 'projects', href: '/app/projects' },
  { key: 'requests', href: '/app/projects/requests' },
  { key: 'crm', href: '/app/crm', roles: MANAGERS, feature: 'sales' },
  { key: 'targets', href: '/app/targets', roles: MANAGERS, feature: 'targets' },
  { key: 'commercial', href: '/app/commercial', roles: MANAGERS },
  { key: 'newQuote', href: '/app/commercial/quotes/new', roles: MANAGERS },
  { key: 'notifications', href: '/app/notifications' },
  { key: 'digest', href: '/app/digest' },
  { key: 'settings', href: '/app/settings', roles: MANAGERS },
];

/** a link into a switched-off section (/app/crm…, /app/targets…) — it would only bounce to the overview */
function hiddenHref(href: string): boolean {
  if (!isFeatureOn('sales') && /^\/app\/crm(\/|\?|$)/.test(href)) return true;
  if (!isFeatureOn('targets') && /^\/app\/targets(\/|\?|$)/.test(href)) return true;
  return false;
}

/** result kinds that belong to a switched-off feature (deals → sales, target companies → targets) */
function resultHidden(type: ResultType): boolean {
  if (type === 'opportunity') return !isFeatureOn('sales');
  if (type === 'lead') return !isFeatureOn('targets');
  return false;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  // fresh state every time the palette opens
  useEffect(() => {
    if (open) return;
    requestId.current += 1;
    setQuery('');
    setResults([]);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!debounced) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    api.search(debounced).then(
      (found) => {
        if (id !== requestId.current) return;
        setResults(found.filter((r) => !resultHidden(r.type) && !hiddenHref(r.href)));
        setLoading(false);
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        console.warn('[search] failed', err);
        setResults([]);
        setLoading(false);
      },
    );
  }, [debounced, open]);

  const pages = useMemo<SearchResult[]>(() => {
    const role = viewer?.role;
    const needle = normalizeText(trimmed);
    return PAGES.filter((p) => (!p.feature || isFeatureOn(p.feature)) && (!p.roles || (role ? p.roles.includes(role) : false)))
      .map<SearchResult>((p) => ({
        type: 'page',
        id: `page:${p.key}`,
        title: t(`layout.search.pages.${p.key}`),
        subtitle: '',
        href: p.href,
      }))
      .filter((p) => !needle || normalizeText(p.title).includes(needle));
  }, [viewer?.role, trimmed]);

  const groups = useMemo(() => {
    const showApi = !!trimmed && debounced === trimmed;
    const seen = new Set<string>();
    const byType = new Map<ResultType, SearchResult[]>();
    const add = (r: SearchResult) => {
      // pages dedupe by destination (api pages vs shortcuts); other results by identity (contacts share a link)
      const key = r.type === 'page' ? `page:${r.href}` : `${r.type}:${r.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const list = byType.get(r.type) ?? [];
      list.push(r);
      byType.set(r.type, list);
    };
    // with a query, real results come first and page shortcuts last
    if (showApi) for (const r of results) add(r);
    for (const p of pages) add(p);
    const order = trimmed ? [...GROUP_ORDER.slice(1), 'page' as const] : GROUP_ORDER;
    const filled = order.map((type) => ({ type, all: byType.get(type) ?? [] })).filter((g) => g.all.length > 0);
    // one kind of result only (e.g. tasks): show more of it; a cut group says how many results it leaves out
    const resultGroups = filled.filter((g) => g.type !== 'page').length;
    const cap = resultGroups <= 1 ? MAX_SINGLE_GROUP : MAX_PER_GROUP;
    return filled.map((g) => {
      const items = g.type === 'page' ? g.all : g.all.slice(0, cap);
      return { type: g.type, items, more: g.all.length - items.length };
    });
  }, [results, pages, trimmed, debounced]);

  const searching = !!trimmed && (loading || debounced !== trimmed);
  // "Đang tìm…" / the footer spinner only once a search has really been waited for (DESIGN §8.2: the debounce plus the
  // usual 150 ms) — fast typing over quick answers never flashes them; meanwhile the empty area stays blank
  const searchingVisible = useDelayedFlag(searching, SEARCH_DEBOUNCE_MS + PENDING_VISUAL_DELAY_MS);

  function go(href: string) {
    onOpenChange(false);
    navigate(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('layout.search.title')}
      description={t(isFeatureOn('sales') ? 'layout.search.description' : 'layout.search.descriptionCare')}
      closeLabel={t('common.close')}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('layout.search.placeholder')}
        aria-label={t('layout.search.title')}
        autoFocus
      />
      <CommandList className="max-h-[min(420px,62dvh)] p-1.5">
        {groups.map((group) => (
          <CommandGroup
            key={group.type}
            heading={t(`layout.search.groups.${group.type}`)}
            className="[&>div:first-child]:px-2.5 [&>div:first-child]:pt-2 [&>div:first-child]:text-micro [&>div:first-child]:text-muted-foreground"
          >
            {group.items.map((item) => {
              const Icon = TYPE_ICON[item.type] ?? ArrowRight;
              return (
                <CommandItem
                  key={`${item.type}:${item.id}`}
                  value={item.href}
                  onSelect={go}
                  className="group gap-3 rounded-lg px-2.5 py-2 data-[selected=true]:bg-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-xs group-data-[selected=true]:border-primary-border group-data-[selected=true]:text-primary">
                    <Icon className="text-current" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-table font-medium text-foreground">{item.title}</span>
                    {item.subtitle ? (
                      <span className="block truncate text-micro text-muted-foreground">{item.subtitle}</span>
                    ) : null}
                  </span>
                  <CornerDownLeft
                    className="text-caption opacity-0 transition-opacity duration-150 group-data-[selected=true]:opacity-100"
                    aria-hidden
                  />
                </CommandItem>
              );
            })}
            {group.more > 0 ? (
              <p className="px-2.5 pb-2 pt-1 text-micro text-muted-foreground">{t('layout.search.more', { count: group.more })}</p>
            ) : null}
          </CommandGroup>
        ))}
        <CommandEmpty className="py-10">
          {searching ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 text-table text-muted-foreground transition-opacity duration-150 ease-out-quart',
                !searchingVisible && 'opacity-0',
              )}
            >
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              {t('layout.search.searching')}
            </span>
          ) : (
            <span className="flex animate-fade-in flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <SearchX className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-table font-medium text-foreground">
                {trimmed ? t('layout.search.empty', { query: trimmed }) : t('layout.search.idle')}
              </span>
              {trimmed ? <span className="text-caption">{t('layout.search.emptyHint')}</span> : null}
            </span>
          )}
        </CommandEmpty>
      </CommandList>
      <div className="hidden items-center justify-between gap-3 border-t border-border/70 bg-subtle px-4 py-2.5 text-micro text-muted-foreground md:flex">
        <span className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Kbd className="bg-card">↑</Kbd>
            <Kbd className="bg-card">↓</Kbd>
            {t('layout.search.hints.navigate')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd className="bg-card">↵</Kbd>
            {t('layout.search.hints.open')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd className="bg-card">Esc</Kbd>
            {t('layout.search.hints.close')}
          </span>
        </span>
        <span className="sr-only">{t('layout.search.footer')}</span>
        {searchingVisible && groups.length > 0 ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      </div>
    </CommandDialog>
  );
}
