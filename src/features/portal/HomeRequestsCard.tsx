// Home card "Yêu cầu đang xử lý" (SPEC-CARE §6.7): how many requests New Era is still handling for the company,
// the next ones by promised date (each opens its detail on Tiến độ), a link to the full list and a quiet
// "Gửi yêu cầu mới". Small on purpose: the home's focal block stays "Việc cần anh xử lý".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { ClientChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { PROJECT_PARAM } from '@/hooks/usePortalProject';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CrStatusChip } from '@/components/care/badges';
import { SectionCard } from '@/components/common/section-card';
import type { Salute } from './portalText';
import { RequestFormDialog } from './RequestFormDialog';
import { RequestLateBadge, RequestWhenLine } from './RequestBits';
import { REQUEST_PARAM, REQUESTS_ANCHOR, byNextPromise, inProjectScope, isOpenRequest } from './requestModel';
import { CARD_LIST, COUNT_PILL, LIST_ROW, QUIET_LINK } from './styles';

const SHOWN = 3;

function progressLink(projectId: string | null, crId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set(PROJECT_PARAM, projectId);
  if (crId) params.set(REQUEST_PARAM, crId);
  const search = params.toString();
  return { pathname: '/portal/progress', search: search ? `?${search}` : '', hash: crId ? '' : `#${REQUESTS_ANCHOR}` };
}

function CardFrameSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('skeleton-reveal rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5', className)}>
      <Skeleton className="h-[18px] w-1/2" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export interface HomeRequestsCardProps {
  projectId: string | null;
  salute: Salute;
  today: ISODate;
  readOnly: boolean;
  className?: string;
}

export function HomeRequestsCard({ projectId, salute, today, readOnly, className }: HomeRequestsCardProps) {
  const viewer = useViewer();
  const [formOpen, setFormOpen] = useState(false);
  const query = useQuery<ClientChangeRequestView[]>(() => api.listMyRequests(), [viewer?.user.id, viewer?.account_id], { enabled: !!viewer });

  if (!query.data) {
    // a failed side card stays quiet: the home's focal blocks matter more than this summary
    return query.error ? null : <CardFrameSkeleton className={className} />;
  }

  const scoped = query.data.filter((r) => inProjectScope(r, projectId));
  const open = scoped.filter(isOpenRequest).sort(byNextPromise);
  const shown = open.slice(0, SHOWN);

  return (
    <>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            {t('carePortal.home.title')}
            {open.length > 0 ? (
              <span className={COUNT_PILL}>
                <span aria-hidden="true">{open.length}</span>
                <span className="sr-only">{t('carePortal.home.count', { count: open.length })}</span>
              </span>
            ) : null}
          </span>
        }
        actions={
          scoped.length > 0 ? (
            <Link to={progressLink(projectId)} className={cn(QUIET_LINK, 'mt-1.5')} aria-label={t('carePortal.home.viewAllLabel', { you: salute.you })}>
              {t('carePortal.home.viewAll')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null
        }
        className={cn('overflow-hidden', className)}
        flush
        footer={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mx-2 -my-1.5 text-foreground"
            onClick={() => setFormOpen(true)}
            disabled={readOnly}
            title={readOnly ? t('carePortal.requests.readOnly') : undefined}
          >
            <Plus aria-hidden="true" />
            {t('carePortal.requests.newButton')}
          </Button>
        }
      >
        {shown.length > 0 ? (
          <ul className={CARD_LIST}>
            {shown.map((r) => (
              <li key={r.id}>
                <Link to={progressLink(projectId, r.id)} className={cn(LIST_ROW, 'py-3')}>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-table font-medium text-foreground">{r.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CrStatusChip status={r.status} audience="client" />
                      <RequestLateBadge request={r} today={today} />
                      {r.promised_date ? <RequestWhenLine request={r} today={today} /> : null}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-caption transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
            {open.length > SHOWN ? (
              <li className="px-4 py-2.5 text-micro text-muted-foreground sm:px-5">{t('carePortal.home.more', { count: open.length - SHOWN })}</li>
            ) : null}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-table text-muted-foreground sm:px-5">
            {scoped.length > 0 ? t('carePortal.home.none') : t('carePortal.home.noneHint', { you: salute.you })}
          </p>
        )}
      </SectionCard>
      <RequestFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
