// Floating bar for the selected leads (DESIGN §5 list pages: dark pill at the bottom, centred over the content):
// "Giao cho…" (director: anyone / back to the pool; AM: only "Nhận về tôi") and "Đổi trạng thái" (Không phù hợp
// asks for a reason).
import { useRef, useState } from 'react';
import { ArrowRightLeft, ChevronDown, UserPlus, X } from 'lucide-react';
import type { LeadStatus } from '@/domain/crmTypes';
import type { UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { t } from '@/i18n';
import { leadStatusIcon } from '../TargetBits';
import { leadStatusLabel, SETTABLE_LEAD_STATUSES, shortPersonName } from '../targetLabels';

export interface LeadBulkBarProps {
  ids: string[];
  people: UserRef[];
  isDirector: boolean;
  meId: string;
  onDone: () => void;
  onClear: () => void;
}

/** ghost buttons readable on the ink bar */
const ON_INK = 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground data-[state=open]:bg-primary-foreground/10 focus-visible:ring-offset-ink';

export function LeadBulkBar({ ids, people, isDirector, meId, onDone, onClear }: LeadBulkBarProps) {
  const { run, pending, pendingVisible } = useAction();
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const disqualified = useRef(false);
  const count = ids.length;

  async function assign(ownerId: string | null) {
    if (pending) return;
    const person = ownerId ? people.find((p) => p.id === ownerId) : null;
    const success =
      ownerId === null
        ? t('targets.bulk.unassigned', { count })
        : ownerId === meId
          ? t('targets.bulk.taken', { count })
          : t('targets.bulk.assigned', { count, name: person?.full_name ?? '' });
    const r = await run(() => api.assignLeads(ids, ownerId), { success });
    if (r) onDone();
  }

  async function setStatus(status: Exclude<LeadStatus, 'converted'>, reason?: string): Promise<boolean> {
    if (pending) return false;
    const r = await run(
      async () => {
        // one request per lead, in order; the first failure stops the run and is toasted
        for (const id of ids) await api.setLeadStatus(id, status, reason);
        return true;
      },
      { success: t('targets.bulk.statusChanged', { count, status: leadStatusLabel(status) }) },
    );
    // with a reason the dialog closes first (onDone unmounts this bar), see onOpenChange below
    if (r && status !== 'disqualified') onDone();
    return Boolean(r);
  }

  return (
    <div
      role="region"
      aria-label={t('targets.bulk.barLabel')}
      // centred over the content column (the sidebar / rail sit left of it)
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex w-auto max-w-[calc(100vw-1.5rem)] animate-pop-in items-center gap-1 rounded-xl bg-ink py-1.5 pl-4 pr-1.5 text-primary-foreground shadow-pop sm:inset-x-0 sm:bottom-6 sm:w-fit md:left-[72px] lg:left-[248px]"
    >
      <span className="mr-auto whitespace-nowrap pr-2 text-table font-medium tabular sm:mr-2">{t('targets.bulk.selected', { count })}</span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={pendingVisible} className={ON_INK}>
            <UserPlus aria-hidden="true" />
            <span className="sm:hidden">{t('targets.bulk.assignShort')}</span>
            <span className="hidden sm:inline">{t('targets.bulk.assign')}</span>
            <ChevronDown className="hidden opacity-70 sm:block" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          {isDirector ? (
            <>
              <DropdownMenuLabel>{t('targets.bulk.assignTo')}</DropdownMenuLabel>
              {people.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => void assign(p.id)}>
                  {p.id === meId ? t('targets.bulk.takeMine') : shortPersonName(p.full_name)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void assign(null)}>{t('targets.bulk.unassign')}</DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => void assign(meId)}>{t('targets.bulk.takeMine')}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={pendingVisible} className={ON_INK}>
            <ArrowRightLeft aria-hidden="true" />
            <span className="sm:hidden">{t('targets.bulk.changeStatusShort')}</span>
            <span className="hidden sm:inline">{t('targets.bulk.changeStatus')}</span>
            <ChevronDown className="hidden opacity-70 sm:block" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60">
          <DropdownMenuLabel>{t('targets.bulk.statusTo')}</DropdownMenuLabel>
          {SETTABLE_LEAD_STATUSES.map((s) => {
            const Icon = leadStatusIcon(s);
            return (
              <DropdownMenuItem
                key={s}
                onSelect={() => {
                  if (s === 'disqualified') setDisqualifyOpen(true);
                  else void setStatus(s);
                }}
              >
                <Icon aria-hidden="true" />
                {leadStatusLabel(s)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-primary-foreground/20" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label={t('targets.bulk.clear')}
        title={t('targets.bulk.clear')}
        className={ON_INK}
      >
        <X aria-hidden="true" />
      </Button>
      <ReasonDialog
        open={disqualifyOpen}
        onOpenChange={(next) => {
          setDisqualifyOpen(next);
          if (!next && disqualified.current) {
            disqualified.current = false;
            onDone();
          }
        }}
        title={t('targets.disqualify.title')}
        description={t('targets.disqualify.descriptionMany', { count })}
        label={t('targets.disqualify.label')}
        placeholder={t('targets.disqualify.placeholder')}
        confirmLabel={t('targets.disqualify.confirm')}
        destructive
        onConfirm={async (reason) => {
          const ok = await setStatus('disqualified', reason);
          disqualified.current = ok;
          return ok;
        }}
      />
    </div>
  );
}
