// "Hộp thư mô phỏng" tab of /app/notifications: every email the system "sent", with its delivery status explained
// (SPEC §6: 1 email/person/day, urgent & escalation & "Nhắc khách" right away, client preference) and the deep link.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BellOff, ChevronDown, Layers, Link2, MailCheck, MailX, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EmailView, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { ChipFilter } from '@/components/common/chip-filter';
import type { ChipOption } from '@/components/common/chip-filter';
import { DateText } from '@/components/common/date-text';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { useDirectory } from './useDirectory';
import type { Directory } from './useDirectory';

type StatusFilter = 'all' | EmailView['status'];
const PAGE = 25;

function statusLook(e: EmailView): { icon: LucideIcon; label: string; variant: 'success' | 'default' } {
  switch (e.status) {
    case 'sent':
      return { icon: MailCheck, label: t('notify.outbox.status.sent'), variant: 'success' };
    case 'batched':
      return { icon: Layers, label: t('notify.outbox.status.batched'), variant: 'default' };
    case 'suppressed':
      return {
        icon: BellOff,
        label: t(e.to_user.org_type === 'client' ? 'notify.outbox.status.suppressedClient' : 'notify.outbox.status.suppressedInternal'),
        variant: 'default',
      };
  }
}

/** one short sentence: why this email went out now, waits, or was not sent */
function explanation(e: EmailView): string {
  const k = 'notify.outbox.explain';
  if (e.status === 'suppressed') return t(e.to_user.org_type === 'client' ? `${k}.prefClient` : `${k}.prefInternal`);
  if (e.status === 'batched') {
    if (e.reason === 'held') return t(`${k}.held`);
    if (e.reason === 'daily_limit') return t(`${k}.dailyLimit`);
    if (e.reason === 'summarized') return t(`${k}.summarized`);
    return t(`${k}.batched`);
  }
  if (e.kind === 'escalation') return t(`${k}.escalation`);
  if (e.urgent) return t(`${k}.urgent`);
  if (e.kind === 'reminder') return t(`${k}.reminder`);
  if (e.kind === 'delegated') return t(`${k}.delegated`);
  if (e.kind === 'digest') return t(`${k}.digest`);
  if (e.batch_key?.startsWith('summary:')) return t(`${k}.summary`);
  // account / login invitations are the only other 'system' mails, and they go out right away
  if (e.kind === 'system') return t(`${k}.system`);
  return t(`${k}.policy`);
}

/** an urgent mail's subject carries a "[Gấp] " prefix; the row shows the "Gấp" badge instead */
function displaySubject(e: EmailView): string {
  if (!e.urgent) return e.subject;
  const prefix = t('notifyTemplates.email.subjectUrgent', { title: '' });
  return prefix && e.subject.startsWith(prefix) ? e.subject.slice(prefix.length) : e.subject;
}

/** collapsed preview: the message itself, without the "Chào …," greeting, link lines and the sign-off */
function previewText(body: string): string {
  const signoff = t('notifyTemplates.email.signoff');
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && l !== signoff && !/https?:\/\//.test(l));
  if (lines.length > 1 && lines[0]?.endsWith(',')) lines.shift();
  return lines.join(' ');
}

function taskIdOf(link: string): string | null {
  const m = /\/portal\/tasks\/([^/?#]+)/.exec(link) ?? /[?&]task=([^&#]+)/.exec(link);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

function orgName(e: EmailView, directory: Directory | undefined): string {
  if (e.to_user.org_type === 'internal') return t('notify.outbox.newEra');
  return directory?.accountByUser.get(e.to_user.id)?.name ?? e.to_user.email.split('@')[1] ?? '';
}

function OutboxSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2" aria-hidden="true">
        {[24, 20, 32, 24].map((w, i) => (
          <Skeleton key={i} className="h-11 shrink-0 rounded-full sm:h-8" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

export function OutboxTab({ viewer }: { viewer: Viewer }) {
  const navigate = useNavigate();
  const drawer = useTaskDrawer();
  const viewAs = useAction();
  const isManager = viewer.org_type === 'internal' && !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');
  const query = useQuery(() => api.listOutbox(), [viewer.user.id]);
  const directory = useDirectory(isManager);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [recipient, setRecipient] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const mails = useMemo(() => query.data ?? [], [query.data]);

  const recipients = useMemo(() => {
    const seen = new Map<string, EmailView['to_user']>();
    for (const e of mails) if (!seen.has(e.to_user.id)) seen.set(e.to_user.id, e.to_user);
    return [...seen.values()].sort(
      (a, b) =>
        Number(a.org_type === 'client') - Number(b.org_type === 'client') || a.full_name.localeCompare(b.full_name, 'vi'),
    );
  }, [mails]);

  const byRecipient = useMemo(() => (recipient ? mails.filter((e) => e.to_user.id === recipient) : mails), [mails, recipient]);
  const visible = useMemo(() => (status === 'all' ? byRecipient : byRecipient.filter((e) => e.status === status)), [byRecipient, status]);

  const options = useMemo<ChipOption<StatusFilter>[]>(() => {
    const count = (s: EmailView['status']) => byRecipient.filter((e) => e.status === s).length;
    return [
      { value: 'all', label: t('notify.outbox.statusChip.all'), count: byRecipient.length },
      { value: 'sent', label: t('notify.outbox.statusChip.sent'), count: count('sent') },
      { value: 'batched', label: t('notify.outbox.statusChip.batched'), count: count('batched') },
      { value: 'suppressed', label: t('notify.outbox.statusChip.suppressed'), count: count('suppressed') },
    ];
  }, [byRecipient]);

  async function openLink(e: EmailView) {
    const link = e.link;
    // one "Mở link" at a time (the buttons only look disabled once the switch takes 150 ms)
    if (!link || viewAs.pending) return;
    if (!link.startsWith('/portal')) {
      navigate(link);
      return;
    }
    // a client's link: open it exactly as the client would, in "Xem như khách hàng" (read-only)
    const account = directory.data?.accountByUser.get(e.to_user.id);
    if (isManager && account) {
      const done = await viewAs.run(() => api.startViewAsClient(account.id));
      if (done) navigate(link);
      return;
    }
    const taskId = taskIdOf(link);
    if (taskId) drawer.open(taskId);
  }

  if (query.loading) return <OutboxSkeleton />;
  if (query.error && !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  if (mails.length === 0) {
    return (
      <Card>
        <EmptyState icon={MailX} title={t('notify.outbox.empty')} description={t('notify.outbox.emptyHint')} />
      </Card>
    );
  }

  const filtered = status !== 'all' || recipient !== '';
  const shown = visible.slice(0, limit);

  return (
    <div className="space-y-4">
      {/* side by side from xl only: at 1024 the sidebar is open and the four chips would wrap beside the select */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ChipFilter
          options={options}
          value={status}
          onChange={(v) => {
            setStatus(v ?? 'all');
            setLimit(PAGE);
          }}
          allowDeselect={false}
          ariaLabel={t('notify.outbox.filterLabel')}
          className="min-w-0"
        />
        {recipients.length > 1 ? (
          <NativeSelect
            size="sm"
            aria-label={t('notify.outbox.recipientLabel')}
            value={recipient}
            onChange={(ev) => {
              setRecipient(ev.target.value);
              setLimit(PAGE);
            }}
            wrapperClassName="w-full sm:w-72 sm:shrink-0"
          >
            <option value="">{t('notify.outbox.allRecipients')}</option>
            {recipients.map((u) => (
              <option key={u.id} value={u.id}>
                {t('notify.outbox.recipientOption', {
                  name: u.full_name,
                  org: u.org_type === 'internal' ? t('notify.outbox.newEra') : directory.data?.accountByUser.get(u.id)?.short_name ?? u.email,
                })}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Card>
          {filtered ? (
            <SearchEmptyState
              compact
              entity="email"
              icon={MailX}
              onClear={() => {
                setStatus('all');
                setRecipient('');
              }}
            />
          ) : (
            <EmptyState compact icon={MailX} title={t('notify.outbox.emptyFiltered')} />
          )}
        </Card>
      ) : (
        <SectionCard
          title={t('notify.outbox.listTitle')}
          description={t('notify.outbox.intro')}
          divided
          footer={
            <>
              <p className="text-caption tabular">{t('notify.outbox.count', { shown: shown.length, total: visible.length })}</p>
              {visible.length > limit ? (
                <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={() => setLimit((n) => n + PAGE)}>
                  {t('notify.outbox.more', { count: Math.min(PAGE, visible.length - limit) })}
                </Button>
              ) : null}
            </>
          }
        >
          {shown.map((e) => (
            <EmailRow key={e.id} mail={e} org={orgName(e, directory.data)} opening={viewAs.pendingVisible} onOpenLink={() => void openLink(e)} />
          ))}
        </SectionCard>
      )}
    </div>
  );
}

function EmailRow({ mail, org, opening, onOpenLink }: { mail: EmailView; org: string; opening: boolean; onOpenLink(): void }) {
  const [expanded, setExpanded] = useState(false);
  const look = statusLook(mail);
  const StatusIcon = look.icon;
  const bodyId = `mail-body-${mail.id}`;
  const clientLink = !!mail.link && mail.link.startsWith('/portal');

  return (
    <article className="flex gap-3 sm:gap-3.5" aria-labelledby={`mail-subject-${mail.id}`}>
      <UserAvatar user={mail.to_user} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-table text-muted-foreground">
            <span className="sr-only">{t('notify.outbox.to')} </span>
            <span className="font-semibold text-foreground">{mail.to_user.full_name}</span>
            <span aria-hidden="true">{t('common.separator')}</span>
            <span>{org}</span>
          </p>
          <DateText value={mail.created_at} relative className="shrink-0 text-micro text-muted-foreground" />
        </div>

        {/* inline flow: a long subject wraps next to the "Gấp" pill instead of dropping below it */}
        <h3 id={`mail-subject-${mail.id}`} className="mt-1 break-words text-body font-medium text-ink [overflow-wrap:anywhere]">
          {mail.urgent ? (
            <Badge variant="danger" size="sm" className="mr-2 align-middle">
              <TriangleAlert aria-hidden="true" />
              {t('notify.outbox.urgent')}
            </Badge>
          ) : null}
          <span className="align-middle">{displaySubject(mail)}</span>
        </h3>

        {expanded ? (
          <div id={bodyId} className="mt-2 animate-fade-in space-y-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4">
            <p className="break-all text-micro text-muted-foreground">
              {t('notify.outbox.to')}: {mail.to_email}
            </p>
            <p className="whitespace-pre-wrap break-words text-table text-foreground [overflow-wrap:anywhere]">{mail.body_text}</p>
            {mail.link ? (
              <p className="flex items-start gap-1.5 border-t border-border/60 pt-3 text-micro text-muted-foreground">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <code className="break-all font-mono text-micro">{mail.link}</code>
                  {clientLink ? <span className="mt-0.5 block">{t('notify.outbox.linkClient')}</span> : null}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <p id={bodyId} className="mt-0.5 line-clamp-2 break-words text-table text-muted-foreground [overflow-wrap:anywhere]">
            {previewText(mail.body_text)}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <Badge variant={look.variant} size="sm">
              <StatusIcon aria-hidden="true" />
              {look.label}
            </Badge>
            <span className="text-caption">{explanation(mail)}</span>
          </p>
          <div className="-ml-2.5 flex flex-wrap items-center gap-1 sm:-mr-2.5 sm:ml-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={bodyId}
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronDown className={cn('transition-transform duration-200 ease-out-quart', expanded && 'rotate-180')} aria-hidden="true" />
              {expanded ? t('notify.outbox.hideBody') : t('notify.outbox.showBody')}
            </Button>
            {mail.link ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary-hover"
                disabled={opening}
                aria-label={t('notify.outbox.openLinkLabel', { link: mail.link })}
                title={clientLink ? t('notify.outbox.openLinkClientTitle') : undefined}
                onClick={onOpenLink}
              >
                <ArrowUpRight aria-hidden="true" />
                {t('notify.outbox.openLink')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
