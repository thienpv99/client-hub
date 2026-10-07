// "Phân khúc" tab: saved segments as clickable cards → members sheet; create (page header) / edit in the builder;
// delete with confirmation.
import { useEffect, useRef, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import type { SegmentView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { CardSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { SegmentBuilder } from './SegmentBuilder';
import { SegmentCard } from './SegmentCard';
import { SegmentMembersSheet } from './SegmentMembersSheet';

export interface SegmentsTabProps {
  isDirector: boolean;
  meId: string;
  onOpenLead: (id: string) => void;
  /** bumped by the page header's "Tạo phân khúc" (0 = never asked) */
  createRequest?: number;
}

export function SegmentsTab({ isDirector, meId, onOpenLead, createRequest = 0 }: SegmentsTabProps) {
  const query = useQuery(() => api.listSegments(), [meId]);
  const { run } = useAction();
  const [membersId, setMembersId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ open: boolean; segment: SegmentView | null }>({ open: false, segment: null });
  const [toDelete, setToDelete] = useState<SegmentView | null>(null);
  // keeps the name in the dialog title while it fades out
  const lastDeleteName = useRef('');
  if (toDelete) lastDeleteName.current = toDelete.name;

  const segments = query.data ?? [];
  const members = membersId ? (segments.find((s) => s.id === membersId) ?? null) : null;
  const canEdit = (s: SegmentView) => isDirector || s.owner.id === meId;

  function openBuilder(segment: SegmentView | null) {
    setMembersId(null);
    setBuilder({ open: true, segment });
  }

  // the header's "Tạo phân khúc" (a request made before this tab mounted is not replayed)
  const handled = useRef(createRequest);
  useEffect(() => {
    if (createRequest === handled.current) return;
    handled.current = createRequest;
    openBuilder(null);
  }, [createRequest]);

  return (
    <div className="space-y-4">
      {query.data ? (
        segments.length > 0 ? (
          <>
            <p className="text-caption">{t('targets.segments.count', { count: segments.length })}</p>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {segments.map((s) => (
                <SegmentCard
                  key={s.id}
                  segment={s}
                  canEdit={canEdit(s)}
                  onOpen={() => setMembersId(s.id)}
                  onEdit={() => openBuilder(s)}
                  onDelete={() => setToDelete(s)}
                />
              ))}
            </ul>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={Layers}
              title={t('targets.segments.empty')}
              description={t('targets.segments.emptyHint')}
              action={
                <Button type="button" variant="secondary" onClick={() => openBuilder(null)}>
                  <Plus aria-hidden="true" />
                  {t('targets.segments.create')}
                </Button>
              }
            />
          </Card>
        )
      ) : query.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} className="hidden md:block" />
          <CardSkeleton lines={4} className="hidden xl:block" />
        </div>
      ) : (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      )}

      <SegmentMembersSheet
        segment={members}
        onClose={() => setMembersId(null)}
        onOpenLead={onOpenLead}
        onEdit={members && canEdit(members) ? (s) => openBuilder(s) : undefined}
      />
      <SegmentBuilder open={builder.open} onOpenChange={(open) => setBuilder((b) => ({ ...b, open }))} segment={builder.segment} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={t('targets.segments.deleteTitle', { name: lastDeleteName.current })}
        description={t('targets.segments.deleteDescription')}
        confirmLabel={t('targets.segments.delete')}
        destructive
        onConfirm={async () => {
          if (!toDelete) return true;
          const name = toDelete.name;
          const id = toDelete.id;
          const ok = await run(
            async () => {
              await api.deleteSegment(id);
              return true;
            },
            { success: t('targets.segments.deleted', { name }) },
          );
          return ok === true;
        }}
      />
    </div>
  );
}
