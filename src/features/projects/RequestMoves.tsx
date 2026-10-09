// Moving a request on the "Yêu cầu" board (the kanban MoveMenu pattern, SPEC-CARE §6.5): most moves save at once
// (optimistic, the card lands in its new column while the save runs); two need a short input first —
// "Đã lên kế hoạch" asks for the date promised to the client (+ owner and plan, so the request does not become delivery
// debt) and "Từ chối" for the reason the client will read. The service notifies the client (planned / done / declined).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { CrStatus } from '@/domain/careTypes';
import { isValidISODate } from '@/domain/dates';
import { todayISO } from '@/domain/clock';
import type { ChangeRequestPatch, ChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';

export interface RequestMoves {
  /** the status a card is drawn in (the target of a move still saving) */
  statusOf(cr: ChangeRequestView): CrStatus;
  isMoving(id: string): boolean;
  /** start a move (may open the plan / decline dialog first) */
  move(cr: ChangeRequestView, to: CrStatus): void;
  /** card that should take the focus after a keyboard move */
  focusId: string | null;
  /** the dialogs, rendered once by the tab */
  dialogs: ReactNode;
}

/** a planned request is safe when it has a date, an owner and a plan; otherwise ask for them */
function planComplete(cr: ChangeRequestView): boolean {
  return !!cr.promised_date && !!cr.owner && (!!cr.plan_ref || !!cr.task);
}

export function useRequestMoves(): RequestMoves {
  const { run } = useAction();
  const [pending, setPending] = useState<Record<string, CrStatus>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<ChangeRequestView | null>(null);
  const [declineFor, setDeclineFor] = useState<ChangeRequestView | null>(null);
  // keep the last request while a dialog closes (its title stays during the exit animation)
  const lastPlan = useRef<ChangeRequestView | null>(null);
  const lastDecline = useRef<ChangeRequestView | null>(null);
  if (planFor) lastPlan.current = planFor;
  if (declineFor) lastDecline.current = declineFor;

  const save = useCallback(
    async (cr: ChangeRequestView, patch: ChangeRequestPatch): Promise<ChangeRequestView | undefined> => {
      const to = patch.status ?? cr.status;
      setFocusId(cr.id);
      setPending((p) => ({ ...p, [cr.id]: to }));
      try {
        const saved = await run(() => api.updateChangeRequest(cr.id, patch));
        if (saved) toastSuccess(t('carePm.move.done', { code: saved.code, status: t(`care.crStatus.${saved.status}`) }));
        return saved;
      } finally {
        setPending((p) => {
          const next = { ...p };
          delete next[cr.id];
          return next;
        });
        window.setTimeout(() => setFocusId((id) => (id === cr.id ? null : id)), 150);
      }
    },
    [run],
  );

  const move = useCallback(
    (cr: ChangeRequestView, to: CrStatus) => {
      if (to === cr.status) return;
      if (to === 'declined') {
        setDeclineFor(cr);
        return;
      }
      if (to === 'planned' && !planComplete(cr)) {
        setPlanFor(cr);
        return;
      }
      void save(cr, { status: to });
    },
    [save],
  );

  const statusOf = useCallback((cr: ChangeRequestView) => pending[cr.id] ?? cr.status, [pending]);
  const isMoving = useCallback((id: string) => id in pending, [pending]);

  const declining = declineFor ?? lastDecline.current;
  const dialogs = (
    <>
      <PlanDialog request={planFor ?? lastPlan.current} open={planFor !== null} onOpenChange={(o) => (o ? undefined : setPlanFor(null))} onSave={save} />
      <ReasonDialog
        open={declineFor !== null}
        onOpenChange={(o) => (o ? undefined : setDeclineFor(null))}
        title={declining ? t('carePm.decline.title', { code: declining.code }) : ''}
        description={t('carePm.decline.description')}
        label={t('care.kit.triage.declineReason')}
        placeholder={t('carePm.decline.placeholder')}
        confirmLabel={t('carePm.decline.confirm')}
        defaultValue={declining?.decline_reason ?? ''}
        onConfirm={async (reason) => {
          if (!declining) return false;
          const saved = await save(declining, { status: 'declined', decline_reason: reason });
          return saved ? true : false;
        }}
      />
    </>
  );

  return { statusOf, isMoving, move, focusId, dialogs };
}

// ───────────────────────────── plan dialog ─────────────────────────────

interface PlanDialogProps {
  request: ChangeRequestView | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSave(cr: ChangeRequestView, patch: ChangeRequestPatch): Promise<ChangeRequestView | undefined>;
}

/** "Lên kế hoạch": date promised to the client (required) · owner · plan · note to the client */
function PlanDialog({ request, open, onOpenChange, onSave }: PlanDialogProps) {
  const uid = useId();
  const [date, setDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [planRef, setPlanRef] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const canAssign = !!request?.can.assign;
  const usersQ = useQuery(() => api.listUsers({ orgType: 'internal' }), [], { enabled: open && canAssign });
  const owners = useMemo(
    () => (usersQ.data ?? []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
    [usersQ.data],
  );

  useEffect(() => {
    if (!open || !request) return;
    setDate(request.promised_date ?? '');
    setOwnerId(request.owner?.id ?? '');
    setPlanRef(request.plan_ref ?? '');
    setClientNote(request.client_note ?? '');
    setTouched(false);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.id]);

  const dateError = touched && !isValidISODate(date) ? t('care.kit.triage.plannedNeedsDate') : null;
  const missing = !ownerId || (!planRef.trim() && !request?.task);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!request || saving || !isValidISODate(date)) return;
    const patch: ChangeRequestPatch = { status: 'planned', promised_date: date };
    if (canAssign && (ownerId || null) !== (request.owner?.id ?? null)) patch.owner_id = ownerId || null;
    const plan = planRef.trim() || null;
    if (plan !== request.plan_ref) patch.plan_ref = plan;
    const note = clientNote.trim() || null;
    if (note !== request.client_note) patch.client_note = note;
    setSaving(true);
    const saved = await onSave(request, patch);
    setSaving(false);
    if (saved) onOpenChange(false);
  }

  const ids = { date: `${uid}-date`, owner: `${uid}-owner`, plan: `${uid}-plan`, note: `${uid}-note` };

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-pretty">{request ? t('carePm.plan.title', { code: request.code }) : ''}</DialogTitle>
          <DialogDescription>{request ? t('carePm.plan.description', { title: request.title }) : ''}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('care.kit.triage.promisedDate')} htmlFor={ids.date} required error={dateError}>
              <Input id={ids.date} type="date" className="tabular" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} autoFocus />
            </FormField>
            <FormField label={t('care.kit.triage.owner')} htmlFor={ids.owner}>
              <NativeSelect
                id={ids.owner}
                value={ownerId}
                placeholder={t('care.kit.triage.ownerNone')}
                disabled={!canAssign || saving}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {request?.owner && !owners.some((u) => u.id === request.owner?.id) ? <option value={request.owner.id}>{request.owner.full_name}</option> : null}
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField
            label={t('care.kit.triage.planRef')}
            htmlFor={ids.plan}
            hint={request?.task ? t('carePm.plan.linkedTask', { task: request.task.title }) : undefined}
          >
            <Input
              id={ids.plan}
              value={planRef}
              maxLength={120}
              placeholder={t('care.kit.triage.planRefPlaceholder')}
              disabled={saving}
              onChange={(e) => setPlanRef(e.target.value)}
            />
          </FormField>
          <FormField label={t('care.kit.triage.clientNote')} htmlFor={ids.note} hint={t('care.kit.triage.clientNoteHint')}>
            <Textarea id={ids.note} rows={2} value={clientNote} maxLength={1000} disabled={saving} onChange={(e) => setClientNote(e.target.value)} />
          </FormField>
          {missing ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] leading-[18px] text-warning" role="note">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('carePm.plan.debtHint')}</span>
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (!saving ? onOpenChange(false) : undefined)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving} spinnerOverlay>
              {t('carePm.plan.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
