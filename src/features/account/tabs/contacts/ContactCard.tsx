// One client contact: who, how to address them, decision role, login status, how to reach them, last interaction.
import type { ReactNode } from 'react';
import { Lock, Mail, MessageSquareText, Pencil, Phone, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ContactView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateText } from '@/components/common/date-text';
import { enumLabel } from '@/components/common/labels';
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

export interface ContactCardProps {
  contact: ContactView;
  canManage: boolean;
  onEdit: (c: ContactView) => void;
  onInvite: (c: ContactView) => void;
}

export function ContactCard({ contact: c, canManage, onEdit, onInvite }: ContactCardProps) {
  const user = c.user;
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card shadow-card">
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ContactAvatar contact={c} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-body font-semibold text-ink">{c.full_name}</h3>
            <p className="break-words text-caption">
              {[c.title || t('account.contacts.noTitle'), t('account.contacts.addressAs', { name: contactAddress(c) })].join(
                t('common.separator'),
              )}
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
          <Badge>{enumLabel('decisionRole', c.decision_role)}</Badge>
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
      </div>

      {!user && canManage ? (
        <div className="border-t border-border/60 px-4 py-3 sm:px-5">
          <Button type="button" variant="secondary" size="sm" onClick={() => onInvite(c)} className="w-full sm:w-auto">
            <Send aria-hidden="true" />
            {t('account.contacts.invite')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
