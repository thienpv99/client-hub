// Triage sheet of a change request (SPEC-CARE §6.4): status, New Era owner, promised date, plan (text or a linked
// task), priority, note to the client, internal note, decline reason. A drawer (details open in a drawer, DESIGN §3).
// Saves only what changed through api.updateChangeRequest; the client is told when the request becomes planned
// (with its date), when that date moves, done or declined (service side) — never for New Era's own proposals.
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Lock } from 'lucide-react';
import type { CrPriority, CrStatus } from '@/domain/careTypes';
import { CR_PRIORITIES, CR_STATUSES } from '@/domain/careTypes';
import type { ChangeRequestPatch, ChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { isValidISODate } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CrFlags, CrStatusChip } from './badges';

export interface CrTriageSheetProps {
  /** the request to triage (keep the last one while the sheet closes) */
  request: ChangeRequestView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (request: ChangeRequestView) => void;
}

interface Draft {
  status: CrStatus;
  priority: CrPriority;
  ownerId: string;
  promisedDate: string;
  planRef: string;
  taskId: string;
  clientNote: string;
  internalNote: string;
  declineReason: string;
}

function draftOf(r: ChangeRequestView | null): Draft {
  return {
    status: r?.status ?? 'new',
    priority: r?.priority ?? 'normal',
    ownerId: r?.owner?.id ?? '',
    promisedDate: r?.promised_date ?? '',
    planRef: r?.plan_ref ?? '',
    taskId: r?.task?.id ?? '',
    clientNote: r?.client_note ?? '',
    internalNote: r?.internal_note ?? '',
    declineReason: r?.decline_reason ?? '',
  };
}

const orNull = (s: string): string | null => (s.trim() ? s.trim() : null);

/** only the fields that differ from the stored request */
function patchOf(r: ChangeRequestView, d: Draft): ChangeRequestPatch {
  const p: ChangeRequestPatch = {};
  if (d.status !== r.status) p.status = d.status;
  if (d.priority !== r.priority) p.priority = d.priority;
  if ((d.ownerId || null) !== (r.owner?.id ?? null)) p.owner_id = d.ownerId || null;
  if ((d.promisedDate || null) !== r.promised_date) p.promised_date = d.promisedDate || null;
  if (orNull(d.planRef) !== r.plan_ref) p.plan_ref = orNull(d.planRef);
  if ((d.taskId || null) !== (r.task?.id ?? null)) p.task_id = d.taskId || null;
  if (orNull(d.clientNote) !== r.client_note) p.client_note = orNull(d.clientNote);
  if (orNull(d.internalNote) !== r.internal_note) p.internal_note = orNull(d.internalNote);
  if (d.status === 'declined' && orNull(d.declineReason) !== r.decline_reason) p.decline_reason = orNull(d.declineReason);
  return p;
}

export function CrTriageSheet({ request, open, onOpenChange, onSaved }: CrTriageSheetProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(request));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(request));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.id, request?.updated_at]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const accountId = request?.account.id ?? '';
  const location = useLocation();
  const onAccountPage = accountId !== '' && location.pathname.startsWith(`/app/accounts/${encodeURIComponent(accountId)}`);
  const editable = !!request && request.can.update;
  const usersQ = useQuery(() => api.listUsers({ orgType: 'internal' }), [], { enabled: open && editable });
  const tasksQ = useQuery(() => api.listTasks({ accountId, side: 'internal' }), [accountId], { enabled: open && editable && accountId !== '' });
  const owners = useMemo(() => (usersQ.data ?? []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')), [usersQ.data]);
  // open New Era tasks of the account; a linked task that is not among them is added as its own option below
  const tasks = tasksQ.data ?? [];

  const plannedError = touched && draft.status === 'planned' && !isValidISODate(draft.promisedDate) ? t('care.kit.triage.plannedNeedsDate') : null;
  const declineError = touched && draft.status === 'declined' && !draft.declineReason.trim() ? t('care.kit.triage.declineNeedsReason') : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!request || !editable || pending) return;
    if (draft.status === 'planned' && !isValidISODate(draft.promisedDate)) return;
    if (draft.status === 'declined' && !draft.declineReason.trim()) return;
    const patch = patchOf(request, draft);
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    const saved = await run(() => api.updateChangeRequest(request.id, patch));
    if (!saved) return;
    toastSuccess(t('care.kit.triage.saved', { code: saved.code }));
    onSaved?.(saved);
    onOpenChange(false);
  }

  const ids = {
    status: `${uid}-status`,
    owner: `${uid}-owner`,
    promised: `${uid}-promised`,
    plan: `${uid}-plan`,
    task: `${uid}-task`,
    priority: `${uid}-priority`,
    clientNote: `${uid}-client-note`,
    internalNote: `${uid}-internal-note`,
    decline: `${uid}-decline`,
  };
  const disabled = !editable || pending;

  return (
    <Sheet open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-xl">
        <SheetHeader className="border-b border-border/70">
          {/* phones: two lines of title at most and no standing instruction, so the form keeps most of the screen */}
          <SheetTitle className="line-clamp-2 text-pretty sm:line-clamp-none">{request ? t('care.kit.triage.title', { code: request.code, title: request.title }) : ''}</SheetTitle>
          <SheetDescription className="hidden sm:block">
            {request?.source === 'internal' ? t('care.kit.triage.descriptionInternal') : t('care.kit.triage.description')}
          </SheetDescription>
          {request ? (
            <SheetMeta>
              <CrStatusChip status={request.status} />
              <CrFlags flags={request.flags} />
              <span className="whitespace-nowrap">
                <span className="tabular">{t('care.kit.triage.receivedAt', { date: formatDate(request.received_at) })}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                {request.source_label}
              </span>
            </SheetMeta>
          ) : null}
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5 pt-5 md:pt-6">
            {request ? (
              <div className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 text-table font-medium text-ink">{request.account.name}</p>
                  {/* from the overview / the board: the client's "Triển khai" tab, reopening this request there */}
                  {!onAccountPage ? (
                    <Link
                      to={`/app/accounts/${encodeURIComponent(request.account.id)}/delivery?cr=${encodeURIComponent(request.id)}`}
                      className="touch-tap inline-flex min-h-8 shrink-0 items-center gap-1 rounded text-[13px] font-medium leading-[18px] text-primary underline-offset-4 hover:underline"
                    >
                      {t('care.kit.triage.openAccount')}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                {request.description ? <p className="mt-1 whitespace-pre-line text-pretty text-table text-foreground">{request.description}</p> : null}
                {request.requested_by ? (
                  <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
                    {t('care.kit.triage.requestedBy')}: {request.requested_by.name}
                    {request.requested_by.title ? ` · ${request.requested_by.title}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
            {!editable && request ? <p className="text-[13px] leading-[18px] text-muted-foreground">{t('care.kit.triage.readOnly')}</p> : null}
            {/* a broken promise: agree a new date with the client (they are told when it moves) */}
            {editable && request?.flags.debt_reasons.includes('date_passed') && request.source !== 'internal' ? (
              <p role="note" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-table text-danger">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-pretty">{t('care.kit.triage.reschedulePrompt')}</span>
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('care.kit.triage.status')} htmlFor={ids.status}>
                <NativeSelect id={ids.status} value={draft.status} disabled={disabled} onChange={(e) => set('status', e.target.value as CrStatus)}>
                  {/* a request already taken in never goes back to "Mới" (the service refuses it too) */}
                  {CR_STATUSES.filter((s) => s !== 'new' || request?.status === 'new').map((s) => (
                    <option key={s} value={s}>
                      {t(`care.crStatus.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('care.kit.triage.priority')} htmlFor={ids.priority}>
                <NativeSelect id={ids.priority} value={draft.priority} disabled={disabled} onChange={(e) => set('priority', e.target.value as CrPriority)}>
                  {CR_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`care.crPriority.${p}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('care.kit.triage.owner')} htmlFor={ids.owner}>
                <NativeSelect
                  id={ids.owner}
                  value={draft.ownerId}
                  placeholder={t('care.kit.triage.ownerNone')}
                  disabled={disabled || !request?.can.assign}
                  onChange={(e) => set('ownerId', e.target.value)}
                >
                  {request?.owner && !owners.some((u) => u.id === request.owner?.id) ? <option value={request.owner.id}>{request.owner.full_name}</option> : null}
                  {owners.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title ? `${u.full_name} · ${u.title}` : u.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('care.kit.triage.promisedDate')} htmlFor={ids.promised} error={plannedError}>
                <Input id={ids.promised} type="date" className="tabular" value={draft.promisedDate} disabled={disabled} onChange={(e) => set('promisedDate', e.target.value)} />
              </FormField>
            </div>
            <p className="-mt-2 text-caption">{t('care.kit.triage.promisedHint')}</p>

            <fieldset className="space-y-4 border-t border-border/60 pt-5">
              <legend className="float-left mb-4 w-full text-table font-semibold text-ink">{t('care.kit.triage.plan')}</legend>
              <div className="clear-both grid gap-4 sm:grid-cols-2">
                <FormField label={t('care.kit.triage.planRef')} htmlFor={ids.plan}>
                  <Input id={ids.plan} value={draft.planRef} maxLength={120} placeholder={t('care.kit.triage.planRefPlaceholder')} disabled={disabled} onChange={(e) => set('planRef', e.target.value)} />
                </FormField>
                <FormField label={t('care.kit.triage.task')} htmlFor={ids.task}>
                  <NativeSelect id={ids.task} value={draft.taskId} placeholder={t('care.kit.triage.taskNone')} disabled={disabled} onChange={(e) => set('taskId', e.target.value)}>
                    {request?.task && !tasks.some((x) => x.id === request.task?.id) ? <option value={request.task.id}>{request.task.title}</option> : null}
                    {tasks.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
            </fieldset>

            <FormField label={t('care.kit.triage.clientNote')} htmlFor={ids.clientNote} hint={t('care.kit.triage.clientNoteHint')}>
              <Textarea id={ids.clientNote} rows={2} value={draft.clientNote} maxLength={1000} disabled={disabled} onChange={(e) => set('clientNote', e.target.value)} />
            </FormField>
            {draft.status === 'declined' ? (
              <FormField label={t('care.kit.triage.declineReason')} htmlFor={ids.decline} required hint={t('care.kit.triage.declineHint')} error={declineError}>
                <Textarea id={ids.decline} rows={2} value={draft.declineReason} maxLength={1000} disabled={disabled} onChange={(e) => set('declineReason', e.target.value)} />
              </FormField>
            ) : null}
            <FormField
              label={
                <span className="inline-flex items-center gap-1.5">
                  {t('care.kit.triage.internalNote')}
                  <Lock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                </span>
              }
              htmlFor={ids.internalNote}
              hint={t('care.kit.triage.internalNoteHint')}
            >
              <Textarea
                id={ids.internalNote}
                rows={2}
                value={draft.internalNote}
                maxLength={1000}
                disabled={disabled}
                className="bg-note"
                onChange={(e) => set('internalNote', e.target.value)}
              />
            </FormField>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            {editable ? (
              <Button type="submit" loading={pending} spinnerOverlay>
                {t('care.kit.triage.save')}
              </Button>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
