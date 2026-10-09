// Rows of "Cần chú ý hôm nay" (DESIGN §5 executive dashboard, SPEC-CARE §6.2): one look for every kind — severity icon
// in a soft circle + one sentence (account name semibold) + caption (severity word · what it is about) + a soft
// action and a ghost one. Care rows: requests owed to a client (delivery debt), requests waiting more than 7 days,
// requests taken in more than 14 days ago without a date for the client, clients overdue / nearly due for a care
// touch, and the expansion map's next selling steps due this week (Mở rộng).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock, ClipboardX, HeartHandshake, Inbox, TrendingUp, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChangeRequestView } from '@/services/careContract';
import { diffDays } from '@/domain/dates';
import { CareTouchButton } from '@/components/care/CareTouchButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { RiseProps } from '@/hooks/useMotion';
import { t, type TParams } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { accountHref, type FocusItem, type Severity } from '../careModel';
import { sentenceParts } from '../attentionText';
import { shortPersonName } from '../portfolioModel';

/** severity is a status: danger / warning / neutral "theo dõi" — always with an icon and the word */
const SEVERITY_TONE: Record<Severity, string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-warning-soft text-warning',
  3: 'bg-muted text-muted-foreground',
};

/** the severity word under the sentence, in the same status colour as its icon */
const SEVERITY_WORD: Record<Severity, string> = {
  1: 'text-danger',
  2: 'text-warning',
  3: '',
};

export interface RowShellProps {
  icon: LucideIcon;
  severity: Severity;
  /** sentence split around the account name (odd indexes = account) */
  parts: string[];
  meta: string;
  actions?: ReactNode;
  /** extra block under the caption (the requests of a grouped row) */
  children?: ReactNode;
  rise: RiseProps;
}

export function RowShell({ icon: Icon, severity, parts, meta, actions, children, rise }: RowShellProps) {
  return (
    // side by side from lg only: on iPad portrait the text column would be ~250px and its meta line would clip.
    // A row with a request list keeps its actions level with the sentence (top), not centred on the list.
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:gap-6',
        children ? 'lg:items-start' : 'lg:items-center',
        rise.className,
      )}
      style={rise.style}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SEVERITY_TONE[severity])} aria-hidden="true">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-px">
          <p className="text-body leading-6 text-foreground">
            {parts.map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-semibold text-ink">
                  {p}
                </span>
              ) : (
                <span key={i}>{p}</span>
              ),
            )}
          </p>
          {/* may wrap (a client's quote note can be long): two lines at most, the whole text in the tooltip */}
          <p className="mt-0.5 line-clamp-2 break-words text-caption" title={meta || undefined}>
            <span className={cn('font-medium', SEVERITY_WORD[severity])}>{t(`dashboard.attention.severity.${severity}`)}</span>
            {meta ? <span aria-hidden="true"> · </span> : null}
            {meta ? <span className="sr-only">, </span> : null}
            {meta}
          </p>
          {children}
        </div>
      </div>
      {actions ? (
        <div className={cn('flex flex-wrap items-center gap-2 pl-[50px] lg:shrink-0 lg:justify-end lg:pl-0', children ? 'lg:pt-0.5' : '')}>
          {actions}
        </div>
      ) : null}
    </li>
  );
}

type RequestItem = Extract<FocusItem, { type: 'debt' | 'untriaged' | 'undated' }>;
type CareItem = Extract<FocusItem, { type: 'care' }>;
type NextStepItem = Extract<FocusItem, { type: 'nextStep' }>;

/** the flag of one request: the main debt reason (danger), how long it has waited or gone without a date (warning) */
function RequestFlag({ request: r, type }: { request: ChangeRequestView; type: RequestItem['type'] }) {
  if (r.flags.debt && r.flags.debt_reason) {
    return (
      <Badge variant="danger" size="sm" title={r.flags.debt_reasons.map((x) => t(`care.debtReason.${x}`)).join(' · ')}>
        <TriangleAlert aria-hidden="true" />
        {t(`care.debtReasonShort.${r.flags.debt_reason}`)}
      </Badge>
    );
  }
  if (type === 'undated') {
    return (
      <Badge variant="warning" size="sm">
        <CalendarClock aria-hidden="true" />
        {t('care.flags.undatedDays', { days: r.flags.days_since_triage })}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" size="sm">
      <Clock aria-hidden="true" />
      {t('care.flags.untriagedDays', { days: r.flags.days_waiting })}
    </Badge>
  );
}

/** a grouped row lists its requests; each opens the triage sheet ("open the CR") */
function RequestList({ item, onOpen }: { item: RequestItem; onOpen(r: ChangeRequestView): void }) {
  return (
    <ul
      className="mt-2.5 overflow-hidden rounded-lg bg-subtle ring-1 ring-inset ring-border/60"
      aria-label={t('carePortfolio.attention.requestList', { account: item.account.name })}
    >
      {item.requests.map((r) => (
        <li key={r.id} className="border-t border-border/60 first:border-t-0">
          <button
            type="button"
            onClick={() => onOpen(r)}
            aria-label={t('carePortfolio.attention.requestOpen', { code: r.code, title: r.title })}
            className="touch-tap flex min-h-tap w-full flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-left transition-colors duration-150 ease-out-quart hover:bg-muted md:min-h-9"
          >
            <span className="shrink-0 text-micro font-medium tabular text-muted-foreground" aria-hidden="true">
              {r.code}
            </span>
            <span className="min-w-0 flex-1 basis-[11rem] truncate text-table text-foreground" aria-hidden="true">
              {r.title}
            </span>
            <span aria-hidden="true" className="shrink-0">
              <RequestFlag request={r} type={item.type} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function requestSentence(item: RequestItem): { key: string; params: TParams; meta: string } {
  const list = item.requests;
  const first = list[0];
  if (item.type === 'debt') {
    if (list.length === 1 && first) {
      return {
        key: `carePortfolio.attention.debtOne.${first.flags.debt_reason ?? 'date_passed'}`,
        params: { request: first.title, date: first.promised_date ? formatDateShort(first.promised_date) : '' },
        meta: t('carePortfolio.attention.meta.debt', { code: first.code }),
      };
    }
    return { key: 'carePortfolio.attention.debtMany', params: { count: list.length }, meta: t('carePortfolio.attention.meta.debtMany') };
  }
  if (item.type === 'undated') {
    if (list.length === 1 && first) {
      return {
        key: 'carePortfolio.attention.undatedOne',
        params: { request: first.title, days: first.flags.days_since_triage },
        meta: t('carePortfolio.attention.meta.undated', { code: first.code }),
      };
    }
    return { key: 'carePortfolio.attention.undatedMany', params: { count: list.length }, meta: t('carePortfolio.attention.meta.undatedMany') };
  }
  if (list.length === 1 && first) {
    return {
      key: 'carePortfolio.attention.untriagedOne',
      params: { request: first.title, days: first.flags.days_waiting },
      meta: t('carePortfolio.attention.meta.untriaged', { code: first.code, source: first.source_label }),
    };
  }
  return {
    key: 'carePortfolio.attention.untriagedMany',
    params: { count: list.length, days: first?.flags.days_waiting ?? 0 },
    meta: t('carePortfolio.attention.meta.untriagedMany'),
  };
}

/** requests owed to a client / waiting too long: one request → its own sentence + "Xử lý"; several → the list */
export function RequestRow({ item, onOpen, rise }: { item: RequestItem; onOpen(r: ChangeRequestView): void; rise: RiseProps }) {
  const { key, params, meta } = requestSentence(item);
  const single = item.requests.length === 1 ? item.requests[0] : undefined;
  // the Triển khai tab opens on the same requests (its "Nợ triển khai" / "Chưa xử lý quá 7 ngày" chip); requests
  // without a date have no chip of their own: the tab's list puts them right after those (compareCrs)
  const delivery =
    item.type === 'undated'
      ? accountHref(item.account.id, 'delivery', { filter: 'all' })
      : accountHref(item.account.id, 'delivery', { filter: item.type === 'debt' ? 'debt' : 'untriaged' });
  const actions = single ? (
    <>
      <Button size="sm" variant="soft" onClick={() => onOpen(single)}>
        {t(
          item.type === 'debt'
            ? 'carePortfolio.attention.actions.triage'
            : item.type === 'undated'
              ? 'carePortfolio.attention.actions.schedule'
              : 'carePortfolio.attention.actions.accept',
        )}
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link to={delivery}>{t('carePortfolio.attention.actions.viewDelivery')}</Link>
      </Button>
    </>
  ) : (
    <Button asChild size="sm" variant="soft">
      <Link to={delivery}>{t('carePortfolio.attention.actions.viewDelivery')}</Link>
    </Button>
  );
  return (
    <RowShell
      icon={item.type === 'debt' ? ClipboardX : item.type === 'undated' ? CalendarClock : Inbox}
      severity={item.severity}
      parts={sentenceParts(key, params, item.account.name)}
      meta={meta}
      actions={actions}
      rise={rise}
    >
      {single ? null : <RequestList item={item} onOpen={onOpen} />}
    </RowShell>
  );
}

function careSentence(item: CareItem, today: string): { key: string; params: TParams } {
  const c = item.row.care;
  if (c.days_since === null) return { key: 'carePortfolio.attention.careNever', params: {} };
  if (c.status === 'overdue' && c.next_action_overdue && c.next_action && c.next_action_due) {
    return {
      key: 'carePortfolio.attention.careAction',
      params: { action: c.next_action, days: Math.max(1, diffDays(today, c.next_action_due)) },
    };
  }
  if (c.status === 'overdue') return { key: 'carePortfolio.attention.careCadence', params: { days: c.days_since, cadence: c.cadence_days } };
  return { key: 'carePortfolio.attention.careDueSoon', params: { days: c.days_since, cadence: c.cadence_days } };
}

/** a client overdue or nearly due for a care touch: "Ghi lần chăm sóc" (LogInteractionDialog) + open the account */
export function CareRow({ item, today, rise }: { item: CareItem; today: string; rise: RiseProps }) {
  const { key, params } = careSentence(item, today);
  const row = item.row;
  const owner = row.care.next_action_owner ?? row.am;
  return (
    <RowShell
      icon={HeartHandshake}
      severity={item.severity}
      parts={sentenceParts(key, params, row.account.name)}
      meta={owner ? t('carePortfolio.attention.meta.care', { owner: shortPersonName(owner.full_name) }) : t('carePortfolio.attention.meta.careNoOwner')}
      actions={
        <>
          <CareTouchButton accountId={row.account.id} variant="soft" size="sm" />
          <Button asChild size="sm" variant="ghost">
            <Link to={accountHref(row.account.id)}>{t('carePortfolio.attention.actions.openAccount')}</Link>
          </Button>
        </>
      }
      rise={rise}
    />
  );
}

function nextStepSentence(item: NextStepItem, today: string): { key: string; params: TParams } {
  const steps = item.steps;
  const first = steps[0];
  if (steps.length === 1 && first) {
    return first.overdue
      ? {
          key: 'carePortfolio.attention.nextStepOneOverdue',
          params: { department: first.department_label, step: first.next_step, days: Math.max(1, diffDays(today, first.next_step_due)) },
        }
      : {
          key: 'carePortfolio.attention.nextStepOne',
          params: { department: first.department_label, step: first.next_step, date: formatDateShort(first.next_step_due) },
        };
  }
  return steps.some((s) => s.overdue)
    ? { key: 'carePortfolio.attention.nextStepManyOverdue', params: { count: steps.length } }
    : { key: 'carePortfolio.attention.nextStepMany', params: { count: steps.length, date: first ? formatDateShort(first.next_step_due) : '' } };
}

/** several steps of one client: each opens that department's sheet on Mở rộng */
function StepList({ item }: { item: NextStepItem }) {
  return (
    <ul
      className="mt-2.5 overflow-hidden rounded-lg bg-subtle ring-1 ring-inset ring-border/60"
      aria-label={t('carePortfolio.attention.stepList', { account: item.row.account.name })}
    >
      {item.steps.map((s) => (
        <li key={s.department} className="border-t border-border/60 first:border-t-0">
          <Link
            to={accountHref(item.row.account.id, 'expansion', { dept: s.department })}
            aria-label={t('carePortfolio.attention.stepOpen', { department: s.department_label, step: s.next_step, date: formatDateShort(s.next_step_due) })}
            className="touch-tap flex min-h-tap w-full flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-left transition-colors duration-150 ease-out-quart hover:bg-muted md:min-h-9"
          >
            <span className="shrink-0 text-micro font-medium text-muted-foreground" aria-hidden="true">
              {s.department_label}
            </span>
            <span className="min-w-0 flex-1 basis-[11rem] truncate text-table text-foreground" aria-hidden="true">
              {s.next_step}
            </span>
            <span aria-hidden="true" className="shrink-0">
              <Badge variant={s.overdue ? 'warning' : 'default'} size="sm">
                <CalendarClock aria-hidden="true" />
                {t(s.overdue ? 'carePortfolio.attention.stepOverdue' : 'carePortfolio.attention.stepDue', { date: formatDateShort(s.next_step_due) })}
              </Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** a client's next selling steps on the expansion map due this week or overdue: open Mở rộng on that department */
export function NextStepRow({ item, today, rise }: { item: NextStepItem; today: string; rise: RiseProps }) {
  const { key, params } = nextStepSentence(item, today);
  const row = item.row;
  const single = item.steps.length === 1 ? item.steps[0] : undefined;
  const owner = (single ?? item.steps[0])?.ne_owner ?? row.am;
  return (
    <RowShell
      icon={TrendingUp}
      severity={item.severity}
      parts={sentenceParts(key, params, row.account.name)}
      meta={owner ? t('carePortfolio.attention.meta.nextStep', { owner: shortPersonName(owner.full_name) }) : t('carePortfolio.attention.meta.nextStepNoOwner')}
      actions={
        <>
          <Button asChild size="sm" variant="soft">
            <Link to={accountHref(row.account.id, 'expansion', single ? { dept: single.department } : undefined)}>
              {t('carePortfolio.attention.actions.viewExpansion')}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={accountHref(row.account.id)}>{t('carePortfolio.attention.actions.openAccount')}</Link>
          </Button>
        </>
      }
      rise={rise}
    >
      {single ? null : <StepList item={item} />}
    </RowShell>
  );
}