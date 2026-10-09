// One client request in a drawer (DESIGN §3: details open in a sheet — right on desktop, full screen on phones):
// New Era's note or the reason first (what the client opened it for), then the steps Đã gửi → New Era tiếp nhận →
// Lên kế hoạch → Đang thực hiện → Hoàn thành, the request itself and the facts. Opened from a row or a notification
// link (/portal/progress?cr=<id>).
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Check, Clock, X } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import type { ClientChangeRequestView } from '@/services/careContract';
import { capitalize, t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CrStatusChip } from '@/components/care/badges';
import { SMALL } from '@/components/common/cx';
import { NewEraMark } from '@/components/common/new-era-logo';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import type { Salute } from './portalText';
import type { RequestStep, StepState } from './requestModel';
import { requestSteps, requestWhen } from './requestModel';

const SUBTITLE = 'text-micro font-medium text-muted-foreground';

function StepMarker({ step, finished }: { step: RequestStep; finished: boolean }) {
  const declined = step.key === 'declined';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        declined && 'bg-muted text-muted-foreground ring-1 ring-inset ring-border-strong',
        !declined && finished && 'bg-success-soft text-success ring-1 ring-inset ring-success/20',
        !declined && !finished && step.state === 'done' && 'bg-primary-soft text-primary ring-1 ring-inset ring-primary-border',
        !declined && step.state === 'current' && 'bg-primary text-primary-foreground shadow-btn ring-4 ring-primary-soft',
        !declined && step.state === 'upcoming' && 'bg-card ring-1 ring-inset ring-border-strong',
      )}
    >
      {declined ? <X className="h-3.5 w-3.5" strokeWidth={2.5} /> : step.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      {!declined && step.state === 'current' ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
    </span>
  );
}

function stepDetail(step: RequestStep, r: ClientChangeRequestView, salute: Salute): string | null {
  if (step.key === 'new') {
    const who = r.mine ? capitalize(salute.address) : r.requested_by_name ? capitalize(r.requested_by_name) : t('carePortal.detail.senderNewEra');
    return `${formatDate(r.received_at)}${t('common.separator')}${who}`;
  }
  if (step.key === 'planned' && r.promised_date && step.state !== 'upcoming') {
    return t('carePortal.requests.promised', { date: formatDate(r.promised_date) });
  }
  if (step.key === 'done' && r.done_at) return formatDate(r.done_at);
  return null;
}

function Steps({ request, salute, labelledBy }: { request: ClientChangeRequestView; salute: Salute; labelledBy: string }) {
  const steps = requestSteps(request.status);
  const finished = request.status === 'done';
  return (
    <ol aria-labelledby={labelledBy} className="mt-3">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const detail = stepDetail(step, request, salute);
        const state: StepState = step.state;
        return (
          <li key={step.key} className={cn('relative flex gap-3', next ? 'pb-4' : '')} aria-current={state === 'current' ? 'step' : undefined}>
            {next ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-0 left-[11px] top-6 w-0.5 rounded-full',
                  finished ? 'bg-success/30' : state === 'done' && next.state !== 'upcoming' ? 'bg-primary/50' : 'bg-border',
                )}
              />
            ) : null}
            <StepMarker step={step} finished={finished} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-table', state === 'upcoming' ? 'text-muted-foreground' : 'font-medium text-foreground')}>
                {t(`carePortal.detail.step.${step.key}`)}
                <span className="sr-only"> ({t(`carePortal.detail.stepState.${state}`)})</span>
              </p>
              {detail ? <p className={cn('mt-0.5 tabular text-muted-foreground', SMALL)}>{detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-table text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-table text-foreground">{children}</dd>
    </div>
  );
}

export interface RequestDetailSheetProps {
  /** keep the last request while the sheet slides out */
  request: ClientChangeRequestView | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  salute: Salute;
  today: ISODate;
}

export function RequestDetailSheet({ request: r, open, onOpenChange, salute, today }: RequestDetailSheetProps) {
  const uid = useId();
  const when = r ? requestWhen(r, today) : null;
  const lateDays = when && when.kind === 'promised' ? when.lateDays : 0;
  const declined = r?.status === 'declined';
  const message = r ? (declined ? r.decline_reason : r.client_note) : null;
  const sender = r ? (r.mine ? capitalize(salute.address) : r.requested_by_name ? capitalize(r.requested_by_name) : t('carePortal.detail.senderNewEra')) : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-lg">
        {r ? (
          <>
            <SheetHeader className="border-b border-border/70">
              <SheetTitle className="text-pretty break-words">{r.title}</SheetTitle>
              <SheetDescription className="tabular">{r.project ? `${r.code}${t('common.separator')}${r.project.name}` : r.code}</SheetDescription>
              <SheetMeta>
                <CrStatusChip status={r.status} audience="client" size="md" />
                {lateDays > 0 ? (
                  <Badge variant="warning">
                    <Clock aria-hidden="true" />
                    {t('carePortal.detail.late', { days: lateDays })}
                  </Badge>
                ) : null}
              </SheetMeta>
            </SheetHeader>
            <SheetBody className="space-y-6 pt-5 md:pt-6">
              {message ? (
                <section aria-labelledby={`${uid}-note`} className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60 sm:p-4">
                  <h3 id={`${uid}-note`} className="flex items-center gap-2 text-table font-semibold text-ink">
                    <NewEraMark className="h-5 w-5 shrink-0" />
                    {declined ? t('carePortal.detail.declineTitle') : t('carePortal.detail.noteTitle')}
                  </h3>
                  <p className="mt-1.5 whitespace-pre-line break-words text-table text-foreground">{message}</p>
                </section>
              ) : null}

              <section aria-labelledby={`${uid}-steps`}>
                <h3 id={`${uid}-steps`} className={SUBTITLE}>
                  {t('carePortal.detail.stepsTitle')}
                </h3>
                <Steps request={r} salute={salute} labelledBy={`${uid}-steps`} />
              </section>

              <section aria-labelledby={`${uid}-content`}>
                <h3 id={`${uid}-content`} className={SUBTITLE}>
                  {t('carePortal.detail.contentTitle')}
                </h3>
                <p className={cn('mt-1.5 whitespace-pre-line break-words text-table', r.description ? 'text-foreground' : 'text-muted-foreground')}>
                  {r.description || t('carePortal.detail.noDescription')}
                </p>
              </section>

              <section aria-labelledby={`${uid}-facts`} className="border-t border-border/60 pt-5">
                <h3 id={`${uid}-facts`} className="sr-only">
                  {t('carePortal.detail.factsTitle')}
                </h3>
                <dl className="space-y-2.5">
                  <Fact label={t('carePortal.detail.sender')}>{sender}</Fact>
                  <Fact label={t('carePortal.detail.sentAt')}>
                    <span className="tabular">{formatDate(dateOf(r.received_at))}</span>
                  </Fact>
                  <Fact label={t('carePortal.detail.project')}>{r.project ? r.project.name : t('carePortal.detail.general')}</Fact>
                  {r.status === 'done' && r.done_at ? (
                    <Fact label={t('carePortal.detail.doneAt')}>
                      <span className="tabular">{formatDate(dateOf(r.done_at))}</span>
                    </Fact>
                  ) : r.promised_date && !declined ? (
                    <Fact label={t('carePortal.detail.promised')}>
                      <span className="tabular">{formatDate(r.promised_date)}</span>
                    </Fact>
                  ) : null}
                </dl>
              </section>
            </SheetBody>
          </>
        ) : (
          <SheetTitle className="sr-only">{t('carePortal.requests.openListLabel')}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
