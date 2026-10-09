// "Yêu cầu của anh/chị" on /portal/progress (SPEC-CARE §6.7): the company's requests to New Era in client wording —
// open ones first (status, promised date, New Era's note), handled ones behind a disclosure.
// `useClientRequests` holds the state the page keeps across its phone / desktop layouts: the list, the request open
// in the detail sheet (`?cr=<id>`, the notification links), the handled-list disclosure and the one-time scroll on
// arrival (`?cr=` → that row, `#yeu-cau` from the home card → the section). The selected project scopes the list;
// requests tied to no project stay visible.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, MessageSquarePlus, Plus } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { ClientChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { jumpScrollTo } from '@/hooks/useMotion';
import type { QueryResult } from '@/hooks/useQuery';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import type { Salute } from './portalText';
import { RequestRow } from './RequestBits';
import { REQUEST_PARAM, REQUESTS_ANCHOR, byNextPromise, inProjectScope, isOpenRequest } from './requestModel';
import { CARD_LIST, COUNT_PILL } from './styles';

/** Scroll so `el` sits just under the sticky portal header (and the "Xem như khách hàng" banner above it). */
function scrollUnderHeader(el: HTMLElement) {
  const header = document.querySelector('header');
  const offset = (header ? header.getBoundingClientRect().bottom : 0) + 16;
  jumpScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
}

const SETTLE_MS = 1500;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * scrollUnderHeader, then keep `el` there while the page settles on a fresh load (the web font swapping in, the
 * project timelines above it replacing their skeleton) — at most 1.5 s, and never against the person's own scrolling.
 */
function settleUnderHeader(el: HTMLElement) {
  scrollUnderHeader(el);
  if (typeof ResizeObserver === 'undefined') return;
  let done = false;
  let timer = 0;
  const observer = new ResizeObserver(() => {
    if (!done && el.isConnected) scrollUnderHeader(el);
  });
  const stop = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop);
  };
  observer.observe(document.body);
  for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true });
  timer = window.setTimeout(stop, SETTLE_MS);
}

export interface ClientRequestsState {
  query: QueryResult<ClientChangeRequestView[]>;
  /** every request of the company (the sheet can open one outside the selected project) */
  all: ClientChangeRequestView[];
  /** the request named by `?cr=` (null = sheet closed) */
  selected: ClientChangeRequestView | null;
  /** what the sheet shows: the selected request, or the last one while the sheet slides out */
  sheetRequest: ClientChangeRequestView | null;
  openRequest(id: string): void;
  closeRequest(): void;
  showClosed: boolean;
  setShowClosed(next: boolean | ((prev: boolean) => boolean)): void;
}

export function useClientRequests(): ClientRequestsState {
  const viewer = useViewer();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const crId = params.get(REQUEST_PARAM);
  const query = useQuery<ClientChangeRequestView[]>(() => api.listMyRequests(), [viewer?.user.id, viewer?.account_id], { enabled: !!viewer });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const [showClosed, setShowClosed] = useState(false);

  const selected = crId ? (all.find((r) => r.id === crId) ?? null) : null;
  const lastSelected = useRef<ClientChangeRequestView | null>(null);
  if (selected) lastSelected.current = selected;

  const openRequest = useCallback(
    (id: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(REQUEST_PARAM, id);
        return next;
      }),
    [setParams],
  );
  const closeRequest = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(REQUEST_PARAM);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // a link to a handled request unfolds the handled list, so its row is there behind the sheet
  useEffect(() => {
    if (selected && !isOpenRequest(selected)) setShowClosed(true);
  }, [selected]);

  // an unknown id in the URL (removed, another company's) is dropped quietly once the list is known
  useEffect(() => {
    if (query.data && crId && !query.data.some((r) => r.id === crId)) closeRequest();
  }, [query.data, crId, closeRequest]);

  // arrival from a notification (?cr=) or the home card (#yeu-cau): bring the row / the section into view once
  const pendingScroll = useRef<'row' | 'section' | null>(crId ? 'row' : hash === `#${REQUESTS_ANCHOR}` ? 'section' : null);
  useEffect(() => {
    if (!pendingScroll.current || !query.data) return;
    const section = document.getElementById(REQUESTS_ANCHOR);
    if (!section) return;
    if (pendingScroll.current === 'row' && crId) {
      const found = section.querySelector<HTMLElement>(`[data-request-id="${CSS.escape(crId)}"]`);
      // rows of the folded handled list are in the DOM but `hidden` (no box)
      const row = found && found.getClientRects().length > 0 ? found : null;
      // a handled request: wait one render for the handled list to unfold
      if (!row && selected && !isOpenRequest(selected) && !showClosed) return;
      settleUnderHeader(row ?? section);
    } else {
      settleUnderHeader(section);
    }
    pendingScroll.current = null;
  });

  return { query, all, selected, sheetRequest: selected ?? lastSelected.current, openRequest, closeRequest, showClosed, setShowClosed };
}

export interface RequestsSectionProps {
  state: ClientRequestsState;
  projectId: string | null;
  /** name of the selected project (empty-state sentence) */
  projectName: string | null;
  /** several projects and none selected: rows carry the project name */
  showProject: boolean;
  salute: Salute;
  today: ISODate;
  /** "Xem như khách hàng": nothing can be sent */
  readOnly: boolean;
  onNew(): void;
  className?: string;
}

export function RequestsSection({ state, projectId, projectName, showProject, salute, today, readOnly, onNew, className }: RequestsSectionProps) {
  const closedId = useId();
  const { query, all, selected, openRequest, showClosed, setShowClosed } = state;
  const scoped = useMemo(() => all.filter((r) => inProjectScope(r, projectId)), [all, projectId]);
  // the soonest promise first (a late one on top), as on the home card
  const open = scoped.filter(isOpenRequest).sort(byNextPromise);
  const closed = scoped.filter((r) => !isOpenRequest(r));
  // name the project on each row only when the list really mixes projects (not one project + company-wide ones)
  const mixed = showProject && new Set(scoped.map((r) => r.project?.id).filter((id): id is string => !!id)).size > 1;

  const newButton = (label: string, variant: 'ghost' | 'secondary', extra?: string) => (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={extra}
      onClick={onNew}
      disabled={readOnly}
      title={readOnly ? t('carePortal.requests.readOnly') : undefined}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );

  if (!query.data && !query.error) {
    return (
      <div id={REQUESTS_ANCHOR} className={cn('min-w-0', className)}>
        <CardSkeleton lines={5} />
      </div>
    );
  }

  let body: ReactNode = null;
  if (!query.data) {
    body = <ErrorState error={query.error} onRetry={query.refetch} compact />;
  } else if (all.length === 0) {
    body = (
      <EmptyState
        compact
        icon={MessageSquarePlus}
        title={t('carePortal.requests.empty', { You: salute.You })}
        description={t('carePortal.requests.emptyHint', { you: salute.you })}
        action={newButton(t('carePortal.requests.newButton'), 'secondary')}
      />
    );
  } else if (scoped.length === 0) {
    body = (
      <EmptyState
        compact
        icon={MessageSquarePlus}
        title={t('carePortal.requests.emptyProject', { name: projectName ?? '' })}
        description={t('carePortal.requests.emptyHint', { you: salute.you })}
      />
    );
  } else {
    const row = (r: ClientChangeRequestView) => (
      <RequestRow key={r.id} request={r} today={today} showProject={mixed} selected={selected?.id === r.id} onOpen={openRequest} />
    );
    body = (
      <>
        {open.length > 0 ? (
          <ul aria-label={t('carePortal.requests.openListLabel')} className={CARD_LIST}>
            {open.map(row)}
          </ul>
        ) : (
          <p className="border-t border-border/60 px-4 py-4 text-table text-muted-foreground sm:px-5">{t('carePortal.requests.noOpen')}</p>
        )}
        {closed.length > 0 ? (
          <div className="border-t border-border/60">
            <button
              type="button"
              aria-expanded={showClosed}
              aria-controls={closedId}
              onClick={() => setShowClosed((x) => !x)}
              className="flex w-full min-h-tap items-center gap-2 px-4 py-3 text-left text-table font-medium text-muted-foreground transition-colors duration-150 hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
            >
              <span className="min-w-0 flex-1">
                {showClosed ? t('carePortal.requests.hideClosed') : t('carePortal.requests.showClosed', { count: closed.length })}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 transition-transform duration-200 ease-out-quart', showClosed && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            <ul id={closedId} hidden={!showClosed} aria-label={t('carePortal.requests.closedListLabel')} className={cn(CARD_LIST, 'animate-fade-in')}>
              {closed.map(row)}
            </ul>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div id={REQUESTS_ANCHOR} className={cn('min-w-0', className)}>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            {t('carePortal.requests.title', { you: salute.you })}
            {open.length > 0 ? (
              <span className={COUNT_PILL}>
                <span aria-hidden="true">{open.length}</span>
                <span className="sr-only">{t('carePortal.home.count', { count: open.length })}</span>
              </span>
            ) : null}
          </span>
        }
        description={t('carePortal.requests.description')}
        // phones / iPad portrait: the page header's button is far above this card; lg+: it sits right next to it
        actions={all.length > 0 ? newButton(t('carePortal.requests.newButtonShort'), 'ghost', '-mr-2 lg:hidden') : null}
        flush
        className="overflow-hidden"
      >
        {body}
      </SectionCard>
    </div>
  );
}
