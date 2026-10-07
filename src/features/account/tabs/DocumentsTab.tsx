// Account documents (SPEC §4.2 "Tab Tài liệu"): files by version, uploader, visibility Nội bộ / Chia sẻ với khách.
// Toolbar (visibility chips with counts · kind · upload) → one list card.
import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { FolderOpen, Upload, Users } from 'lucide-react';
import type { FileKind } from '@/domain/types';
import type { AccountDetail, FileView } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilePreviewDialog } from '@/components/common/file-preview-dialog';
import { enumLabel } from '@/components/common/labels';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { useAccountAccess } from '../accountAccess';
import { CHIP_TOUCH } from '../styles';
import { DocumentRow } from './documents/DocumentRow';
import { FILE_KINDS, UploadDialog } from './documents/UploadDialog';

type VisibilityFilter = 'all' | 'shared' | 'internal';

export interface DocumentsTabProps {
  account: AccountDetail;
}

export function DocumentsTab({ account }: DocumentsTabProps) {
  const access = useAccountAccess(account);
  const query = useQuery(() => api.listFiles({ accountId: account.id }), [account.id]);
  const files = query.data;
  const [filter, setFilter] = useState<VisibilityFilter>('all');
  const [kind, setKind] = useState<FileKind | ''>('');
  const [preview, setPreview] = useState<FileView | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const counts = useMemo(() => {
    const list = files ?? [];
    return {
      all: list.length,
      shared: list.filter((f) => f.visibility === 'shared').length,
      internal: list.filter((f) => f.visibility === 'internal').length,
    };
  }, [files]);
  const kinds = useMemo(() => FILE_KINDS.filter((k) => (files ?? []).some((f) => f.kind === k)), [files]);
  const shown = (files ?? []).filter((f) => (filter === 'all' || f.visibility === filter) && (kind === '' || f.kind === kind));

  function pick(docKey: string | null) {
    setTargetKey(docKey);
    inputRef.current?.click();
  }

  function onPicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    // allow picking the same file again later
    e.target.value = '';
    if (!file) return;
    setPicked(file);
    setUploadOpen(true);
  }

  // toolbar: the page's primary action; inside the empty state: secondary (DESIGN §7.4)
  function uploadButton(toolbar: boolean, className?: string) {
    return access.internal ? (
      <Button
        type="button"
        variant={toolbar ? 'default' : 'secondary'}
        size={toolbar ? 'sm' : 'default'}
        onClick={() => pick(null)}
        className={className}
      >
        <Upload aria-hidden="true" />
        {t('account.documents.upload')}
      </Button>
    ) : null;
  }

  const showKinds = kinds.length > 1;

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPicked} />

      {/* no toolbar for an empty account: the empty state carries the upload button */}
      {files === undefined || files.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ChipFilter
            className={cn('min-w-0', CHIP_TOUCH)}
            ariaLabel={t('account.documents.filterLabel')}
            allowDeselect={false}
            value={filter}
            onChange={(v) => setFilter(v ?? 'all')}
            options={[
              { value: 'all', label: t('common.all'), count: files ? counts.all : undefined },
              { value: 'shared', label: enumLabel('visibility', 'shared'), count: files ? counts.shared : undefined },
              { value: 'internal', label: enumLabel('visibility', 'internal'), count: files ? counts.internal : undefined },
            ]}
          />
          <div className={cn('flex shrink-0 items-center gap-2', !showKinds && !access.internal && 'hidden')}>
            {showKinds ? (
              <NativeSelect
                size="sm"
                value={kind}
                onChange={(e) => {
                  const next = FILE_KINDS.find((k) => k === e.target.value);
                  setKind(next ?? '');
                }}
                aria-label={t('account.documents.kindFilter')}
                placeholder={t('account.documents.allKinds')}
                wrapperClassName="min-w-0 flex-1 md:w-48 md:flex-none"
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {enumLabel('fileKind', k)}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {uploadButton(true, showKinds ? undefined : 'w-full md:w-auto')}
          </div>
        </div>
      ) : null}

      {!files && query.error ? (
        <SectionCard>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </SectionCard>
      ) : !files ? (
        <ListSkeleton rows={5} />
      ) : files.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FolderOpen}
            title={t('account.documents.empty', { account: account.short_name || account.name })}
            description={t('account.documents.emptyHint')}
            action={uploadButton(false)}
          />
        </SectionCard>
      ) : (
        <SectionCard
          className="overflow-hidden"
          flush
          footer={
            <p className="flex items-center gap-1.5 text-caption">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('account.documents.listHint')}
            </p>
          }
        >
          {shown.length === 0 ? (
            <EmptyState
              compact
              title={t('account.documents.filteredEmpty')}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setKind('');
                  }}
                >
                  {t('common.clearFilters')}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60" aria-label={t('account.documents.listTitle')}>
              {shown.map((f) => (
                <DocumentRow
                  key={f.id}
                  file={f}
                  canManage={access.manage}
                  canUpload={access.internal}
                  onPreview={setPreview}
                  onNewVersion={(doc) => pick(doc.doc_key)}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <FilePreviewDialog
        file={preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        file={picked}
        accountId={account.id}
        documents={files ?? []}
        defaultDocKey={targetKey}
        canShare={access.manage}
        onPickAnother={() => inputRef.current?.click()}
      />
    </div>
  );
}
