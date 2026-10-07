// Status timeline of one quote version: created → approval requested / rejected / approved → sent → client decision,
// then the next expected step (grey). Rejections only live in the activity log, so it is merged in.
import type { LucideIcon } from 'lucide-react';
import { CalendarX, CircleCheck, CircleDashed, Clock, FilePlus2, MessageSquareWarning, Send, ShieldCheck, ShieldX } from 'lucide-react';
import type { ActivityView, QuoteDetail, UserRef } from '@/services/contract';
import { DateText } from '@/components/common/date-text';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/components/ui/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'pending';

interface TimelineEvent {
  key: string;
  kind: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  who?: UserRef | null;
  at?: string | null;
  note?: string | null;
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  pending: 'border border-dashed border-border-strong bg-card text-muted-foreground',
};

const ACTIVITY_KINDS: Record<string, { kind: string; icon: LucideIcon; tone: Tone; titleKey: string; noteParam?: string }> = {
  'quote.approval_requested': { kind: 'requested', icon: Clock, tone: 'warning', titleKey: 'commercial.timeline.requested', noteParam: 'note' },
  'quote.approval_rejected': { kind: 'rejected', icon: ShieldX, tone: 'danger', titleKey: 'commercial.timeline.rejected', noteParam: 'reason' },
  'quote.approved': { kind: 'approved', icon: ShieldCheck, tone: 'success', titleKey: 'commercial.timeline.approved', noteParam: 'note' },
};

function near(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 120_000;
}

export function buildTimeline(q: QuoteDetail, activities: ActivityView[]): { done: TimelineEvent[]; next: TimelineEvent[] } {
  const done: TimelineEvent[] = [
    { key: 'created', kind: 'created', icon: FilePlus2, tone: 'neutral', title: t('commercial.timeline.created', { version: q.version }), who: q.created_by, at: q.created_at },
  ];
  for (const a of activities) {
    if (a.target_type !== 'quote' || a.target_id !== q.id) continue;
    const look = ACTIVITY_KINDS[a.action];
    if (!look) continue;
    const raw = look.noteParam ? a.params[look.noteParam] : undefined;
    done.push({ key: a.id, kind: look.kind, icon: look.icon, tone: look.tone, title: t(look.titleKey), who: a.actor, at: a.created_at, note: raw === undefined ? null : String(raw) });
  }
  const has = (kind: string, at: string) => done.some((e) => e.kind === kind && e.at && near(e.at, at));
  if (q.approval_requested_at && !has('requested', q.approval_requested_at)) {
    done.push({ key: 'requested', kind: 'requested', icon: Clock, tone: 'warning', title: t('commercial.timeline.requested'), who: q.approval_requested_by, at: q.approval_requested_at });
  }
  if (q.director_approved_at && !has('approved', q.director_approved_at)) {
    done.push({ key: 'approved', kind: 'approved', icon: ShieldCheck, tone: 'success', title: t('commercial.timeline.approved'), who: q.director_approved_by, at: q.director_approved_at, note: q.approval_note });
  }
  if (q.sent_at) {
    done.push({ key: 'sent', kind: 'sent', icon: Send, tone: 'primary', title: t('commercial.timeline.sent'), who: q.sent_by, at: q.sent_at });
  }
  if (q.client_decision && q.client_decided_at) {
    const accepted = q.client_decision === 'accepted';
    done.push({
      key: 'decision',
      kind: 'decision',
      icon: accepted ? CircleCheck : MessageSquareWarning,
      tone: accepted ? 'success' : 'warning',
      title: t(accepted ? 'commercial.timeline.accepted' : 'commercial.timeline.changesRequested'),
      who: q.client_decided_by,
      at: q.client_decided_at,
      note: q.client_note,
    });
  }
  done.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  const next: TimelineEvent[] = [];
  if (q.status === 'expired') {
    next.push({ key: 'expired', kind: 'expired', icon: CalendarX, tone: 'neutral', title: t('commercial.timeline.expired', { date: formatDate(q.valid_until) }) });
  } else if (q.status === 'pending_approval') {
    next.push({ key: 'wait-approval', kind: 'pending', icon: CircleDashed, tone: 'pending', title: t('commercial.timeline.waitApproval') });
    next.push({ key: 'wait-send', kind: 'pending', icon: CircleDashed, tone: 'pending', title: t('commercial.timeline.waitSend') });
  } else if (q.status === 'draft') {
    if (q.needs_approval && !q.approved) {
      next.push({ key: 'wait-approval', kind: 'pending', icon: CircleDashed, tone: 'pending', title: t('commercial.timeline.needApproval') });
    }
    next.push({ key: 'wait-send', kind: 'pending', icon: CircleDashed, tone: 'pending', title: t('commercial.timeline.waitSend') });
  } else if (q.status === 'sent') {
    next.push({
      key: 'wait-client',
      kind: 'pending',
      icon: CircleDashed,
      tone: 'pending',
      title: t('commercial.timeline.waitClient', { date: formatDate(q.valid_until) }),
    });
  }
  return { done, next };
}

export function QuoteTimeline({ quote, activities }: { quote: QuoteDetail; activities: ActivityView[] }) {
  const { done, next } = buildTimeline(quote, activities);
  const all = [...done, ...next];
  return (
    <ol className="relative">
      {all.map((e, i) => {
        const Icon = e.icon;
        const last = i === all.length - 1;
        return (
          <li key={e.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? <span className="absolute left-[13px] top-8 h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden="true" /> : null}
            <span className={cn('relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full', TONE[e.tone])}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-table font-medium', e.tone === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>{e.title}</p>
              {e.who || e.at ? (
                <p className="text-caption">
                  {e.who ? e.who.full_name : null}
                  {e.who && e.at ? ' · ' : null}
                  {e.at ? <DateText value={e.at} time /> : null}
                </p>
              ) : null}
              {e.note ? (
                <p className="mt-1.5 whitespace-pre-line rounded-lg bg-subtle px-3 py-2 text-table text-foreground ring-1 ring-inset ring-border/60">{e.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
