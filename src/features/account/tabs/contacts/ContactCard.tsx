// One client contact: who, how to address them, decision role, login status, how to reach them, last interaction.
// With a stakeholder (director / AM, SPEC-CARE §6.4 "Quan hệ"): department, role in the decision, attitude, how close
// New Era is, who at New Era holds the relationship, whom they report to and the relationship notes — plus
// "Sửa quan hệ" and "Ghi lần chăm sóc".
import type { CSSProperties, ReactNode } from 'react';
import { Handshake, Lock, Mail, MessageSquareText, Pencil, Phone, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ContactView } from '@/services/contract';
import type { StakeholderView } from '@/services/careContract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfluenceBadge, StanceBadge, StrengthBadge } from '@/components/care/badges';
import { CareTouchButton } from '@/components/care/CareTouchButton';
import { DateText } from '@/components/common/date-text';
import { enumLabel } from '@/components/common/labels';
import { UserAvatar } from '@/components/common/user-avatar';
import { ContactAvatar, LoginStatus, contactAddress, telHref } from '../../contactParts';

const linkClass =
  'touch-tap inline-flex min-h-8 max-w-full items-center rounded text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline';

function Line({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 text-table">
      <Icon className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </li>
  );
}

/** the decision role shown next to the influence would repeat "Người quyết định" */
const SAME_ROLE: Record<ContactView['decision_role'], StakeholderView['influence'] | null> = {
  decision_maker: 'decision_maker',
  approver: null,
  ops_contact: null,
};

function RelationFacts({ stakeholder: s, reportsTo }: { stakeholder: StakeholderView; reportsTo: string | null }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3">
      <div className="min-w-0">
        <dt className="text-micro text-muted-foreground">{t('careAccount.relationships.people.holder')}</dt>
        <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 text-table">
          {s.ne_owner ? (
            <>
              <UserAvatar user={s.ne_owner} size="xs" />
              <span className="truncate text-foreground">{s.ne_owner.full_name}</span>
            </>
          ) : (
            <span className="font-medium text-warning">{t('careAccount.relationships.people.noHolder')}</span>
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-micro text-muted-foreground">{t('careAccount.relationships.people.department')}</dt>
        <dd className="mt-0.5 truncate text-table text-foreground">{s.department_label ?? t('careAccount.relationships.map.noDepartment')}</dd>
      </div>
      {reportsTo ? (
        <div className="min-w-0">
          <dt className="text-micro text-muted-foreground">{t('careAccount.relationships.people.reportsTo')}</dt>
          <dd className="mt-0.5 truncate text-table text-foreground">{reportsTo}</dd>
        </div>
      ) : null}
      <div className="min-w-0">
        <dt className="text-micro text-muted-foreground">{t('careAccount.relationships.people.lastTouch')}</dt>
        <dd className="mt-0.5 text-table text-foreground">
          {s.last_touch_at ? <DateText value={s.last_touch_at} relative /> : <span className="text-muted-foreground">{t('careAccount.overview.care.never')}</span>}
        </dd>
      </div>
    </dl>
  );
}

export interface ContactCardProps {
  contact: ContactView;
  canManage: boolean;
  onEdit: (c: ContactView) => void;
  onInvite: (c: ContactView) => void;
  /** director / AM: the relationship data of this person */
  stakeholder?: StakeholderView | null;
  /** full name of the person they report to */
  reportsToName?: string | null;
  onEditRelation?: (c: ContactView) => void;
  className?: string;
  style?: CSSProperties;
}

export function ContactCard({ contact: c, canManage, onEdit, onInvite, stakeholder, reportsToName = null, onEditRelation, className, style }: ContactCardProps) {
  const user = c.user;
  const s = stakeholder ?? null;
  const showRole = !s || SAME_ROLE[c.decision_role] !== s.influence;
  return (
    <li id={`contact-${c.id}`} className={cn('flex min-w-0 scroll-mt-40 flex-col rounded-xl border border-border/70 bg-card shadow-card', className)} style={style}>
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ContactAvatar contact={c} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-body font-semibold text-ink">{c.full_name}</h3>
            <p className="break-words text-caption">
              {[c.title || t('account.contacts.noTitle'), t('account.contacts.addressAs', { name: contactAddress(c) })].join(t('common.separator'))}
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(c)}
              aria-label={t('account.contacts.edit', { name: c.full_name })}
              title={t('common.edit')}
              className="-mr-1.5 -mt-1"
            >
              <Pencil aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {s ? (
            <>
              <StrengthBadge strength={s.strength} size="md" />
              <StanceBadge stance={s.stance} size="md" />
              <InfluenceBadge influence={s.influence} size="md" />
            </>
          ) : null}
          {showRole ? <Badge>{enumLabel('decisionRole', c.decision_role)}</Badge> : null}
          <LoginStatus contact={c} />
          {user ? (
            <span className="text-micro text-muted-foreground">
              {user.last_login_at ? (
                <>
                  {t('account.contacts.lastLogin')} <DateText value={user.last_login_at} relative time />
                </>
              ) : (
                t('account.contacts.neverLoggedIn')
              )}
            </span>
          ) : null}
        </div>

        <ul className="mt-3 space-y-0.5">
          <Line icon={Phone} label={t('common.phone')}>
            {c.phone ? (
              <a href={telHref(c.phone)} className={cn(linkClass, 'tabular')}>
                {c.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">{t('account.contacts.noPhone')}</span>
            )}
          </Line>
          <Line icon={Mail} label={t('common.email')}>
            {c.email ? (
              <a href={`mailto:${c.email}`} className={linkClass} title={c.email}>
                <span className="min-w-0 truncate">{c.email}</span>
              </a>
            ) : (
              <span className="text-muted-foreground">{t('account.contacts.noEmail')}</span>
            )}
          </Line>
        </ul>

        {s ? <RelationFacts stakeholder={s} reportsTo={reportsToName} /> : null}
        {s?.notes ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-note p-2.5 text-[13px] leading-[18px] text-foreground ring-1 ring-inset ring-note-border">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
            <span className="sr-only">{t('careAccount.relationships.people.notes')}: </span>
            <span className="min-w-0 break-words">{s.notes}</span>
          </p>
        ) : null}

        {/* the AM's interaction log reaches the director / AMs only (ContactView.last_interaction_* are null for
            members) — without it the block would always read "Chưa ghi nhận lần tương tác nào" */}
        {s || c.last_interaction_at ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="flex flex-wrap items-center gap-x-1.5 text-caption">
              <MessageSquareText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('account.contacts.lastInteraction')}
              {c.last_interaction_at ? (
                <>
                  <span aria-hidden="true">·</span>
                  <DateText value={c.last_interaction_at} relative time />
                </>
              ) : null}
            </p>
            {c.last_interaction_note ? (
              <p className="mt-1 flex items-start gap-1.5 break-words text-table text-foreground">
                <span className="min-w-0 flex-1">{c.last_interaction_note}</span>
                <span title={t('components.internal.only')} className="mt-1 shrink-0">
                  <Lock className="h-3 w-3 text-warning" aria-hidden="true" />
                  <span className="sr-only">{t('components.internal.only')}</span>
                </span>
              </p>
            ) : !c.last_interaction_at ? (
              <p className="mt-1 text-table text-muted-foreground">{t('account.contacts.noInteraction')}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {(s && (onEditRelation || canManage)) || (!user && canManage) ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
          {s && onEditRelation && canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEditRelation(c)}
              aria-label={t('careAccount.relationships.people.editRelationFor', { name: c.full_name })}
              className="flex-1 sm:flex-none"
            >
              <Handshake aria-hidden="true" />
              {t('careAccount.relationships.people.editRelation')}
            </Button>
          ) : null}
          {s ? (
            <CareTouchButton
              accountId={c.account_id}
              contactId={c.id}
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-none"
            />
          ) : null}
          {!user && canManage ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onInvite(c)} className="w-full sm:w-auto">
              <Send aria-hidden="true" />
              {t('account.contacts.invite')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
