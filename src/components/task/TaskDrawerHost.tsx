// Mounted once by each layout: opens the task drawer for the `?task=` search param (useTaskDrawer).
// Right-side sheet on desktop / iPad, full screen on phones. Skeleton while loading, ErrorState when it fails.
import { useEffect, useState } from 'react';
import { SearchX } from 'lucide-react';
import type { TaskDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TaskDrawer } from './TaskDrawer';

function DrawerSkeleton() {
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal flex min-h-0 flex-1 flex-col">
      <span className="sr-only">{t('task.drawer.loading')}</span>
      {/* same frame and metrics as the loaded header (TaskDrawer): the context row level with the close button
          (logo 20 + crumbs), the title, the badges row — so nothing shifts when the task arrives */}
      <div className="border-b border-border/70 px-4 pb-4 pt-2 md:px-6 md:pb-5 md:pt-4">
        <div className="flex min-h-11 items-center gap-2 pr-11 md:min-h-9 md:pr-10">
          <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
        <Skeleton className="mt-1.5 h-6 w-4/5 sm:h-7" />
        <div className="mt-2.5 flex gap-2">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
      </div>
      <div className="space-y-7 px-4 pt-5 md:space-y-8 md:px-6 md:pt-6">
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function isNotFound(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'not_found';
}

function DrawerContent({ taskId, active, onClose }: { taskId: string; active: boolean; onClose: () => void }) {
  // while the sheet slides out, keep what it shows (a task deleted from the drawer must not flash "not found")
  const query = useQuery<TaskDetail>(() => api.getTask(taskId), [taskId], { enabled: active });

  if (query.data) return <TaskDrawer task={query.data} onClose={onClose} />;
  if (query.error) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{t('task.drawer.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('task.drawer.title')}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {isNotFound(query.error) ? (
            <EmptyState
              icon={SearchX}
              title={t('task.drawer.notFound')}
              description={t('task.drawer.notFoundHint')}
              action={
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t('common.close')}
                </Button>
              }
            />
          ) : (
            <ErrorState error={query.error} onRetry={query.refetch} />
          )}
        </SheetBody>
      </>
    );
  }
  return (
    <>
      <SheetTitle className="sr-only">{t('task.drawer.title')}</SheetTitle>
      <SheetDescription className="sr-only">{t('task.drawer.loading')}</SheetDescription>
      <DrawerSkeleton />
    </>
  );
}

export function TaskDrawerHost() {
  const { taskId, close } = useTaskDrawer();
  // keep the last task while the closing animation runs
  const [shownId, setShownId] = useState<string | null>(taskId);
  useEffect(() => {
    if (taskId) setShownId(taskId);
  }, [taskId]);
  const id = taskId ?? shownId;

  return (
    <Sheet
      open={!!taskId}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent side="right" mobileFullScreen className="overflow-hidden" closeLabel={t('common.close')}>
        {id ? (
          <DrawerContent key={id} taskId={id} active={!!taskId} onClose={close} />
        ) : (
          <SheetTitle className="sr-only">{t('task.drawer.title')}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
