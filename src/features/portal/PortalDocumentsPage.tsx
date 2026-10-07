// /portal/documents: shared files only (the api filters), one card per project (+ "Tài liệu chung"), newest first;
// latest version per document with older versions expandable, preview + download. Toolbar: name search + kind chips
// (DESIGN §6: search + the most useful filters, result count). Respects the project selector (account-wide files
// always shown).
import { useMemo, useState } from 'react';
import { FolderOpen, Search, SearchX } from 'lucide-react';
import type { FileView } from '@/services/contract';
import type { FileKind } from '@/domain/types';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilePreviewDialog } from '@/components/common/file-preview-dialog';
import { enumLabel } from '@/components/common/labels';
import { PageHeader } from '@/components/common/page-header';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { usePortalProject, usePortalShell } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { DocumentRow } from './DocumentRow';

const KIND_ORDER: FileKind[] = ['design', 'document', 'report', 'contract', 'data', 'proof', 'other'];
type KindFilter = FileKind | 'all';
const GENERAL = '__general__';

interface Group {
  key: string;
  name: string;
  files: FileView[];
}

function groupFiles(files: FileView[], projects: { id: string; name: string }[]): Group[] {
  const byProject = new Map<string, FileView[]>();
  for (const f of files) {
    const key = f.project_id ?? GENERAL;
    const list = byProject.get(key);
    if (list) list.push(f);
    else byProject.set(key, [f]);
  }
  const order = [...projects.map((p) => p.id), GENERAL];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  return Array.from(byProject.keys())
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => ({
      key,
      name: key === GENERAL ? t('portal.documents.general') : (projects.find((p) => p.id === key)?.name ?? t('portal.documents.general')),
      // newest first: what changed lately is what a reader comes for
      files: [...(byProject.get(key) ?? [])].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)),
    }));
}

/** name, note and uploader; accent-insensitive, every word anywhere ("thiet ke dat" finds "Thiết kế màn hình Đặt hàng") */
function matches(f: FileView, needle: string): boolean {
  if (!needle) return true;
  const haystack = normalizeText(`${f.name} ${f.note ?? ''} ${f.uploaded_by.full_name}`);
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export function PortalDocumentsPage() {
  const viewer = useViewer();
  const accountId = viewer?.account_id ?? null;
  const { projectId, projects } = usePortalProject();
  const { account } = usePortalShell();
  const company = account?.short_name || account?.name || '';
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<FileView | null>(null);

  const query = useQuery<FileView[]>(() => api.listFiles({ accountId: accountId ?? undefined }), [accountId], { enabled: !!accountId });

  const scoped = useMemo(
    () => (query.data ?? []).filter((f) => !projectId || f.project_id === projectId || f.project_id === null),
    [query.data, projectId],
  );
  const kindOptions = useMemo(() => {
    const counts = new Map<FileKind, number>();
    for (const f of scoped) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
    return [
      { value: 'all' as KindFilter, label: t('portal.documents.all'), count: scoped.length },
      ...KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({ value: k as KindFilter, label: enumLabel('fileKind', k), count: counts.get(k) ?? 0 })),
    ];
  }, [scoped]);
  const activeKind: KindFilter = kind !== 'all' && kindOptions.some((o) => o.value === kind) ? kind : 'all';
  const needle = normalizeText(search);
  const filtered = useMemo(
    () => scoped.filter((f) => (activeKind === 'all' || f.kind === activeKind) && matches(f, needle)),
    [scoped, activeKind, needle],
  );
  const groups = useMemo(() => groupFiles(filtered, projects), [filtered, projects]);
  const selectedName = projectId ? (projects.find((p) => p.id === projectId)?.name ?? null) : null;
  const filtering = activeKind !== 'all' || needle !== '';
  const clearFilters = () => {
    setKind('all');
    setSearch('');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={t('portal.documents.title')}
        description={company ? t('portal.documents.description', { company }) : t('portal.documents.descriptionNoCompany')}
      />

      {!query.data ? (
        query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (
          <div className="space-y-4">
            {/* toolbar placeholder (search + chips), then the rows card */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4" aria-hidden="true">
              <Skeleton className="h-11 w-full rounded-lg md:h-8 md:w-[280px]" />
              <div className="flex gap-2">
                <Skeleton className="h-11 w-20 rounded-full sm:h-8" />
                <Skeleton className="h-11 w-24 rounded-full sm:h-8" />
                <Skeleton className="h-11 w-24 rounded-full sm:h-8" />
              </div>
            </div>
            <ListSkeleton rows={5} />
          </div>
        )
      ) : scoped.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title={selectedName ? t('portal.documents.emptyProject', { name: selectedName }) : t('portal.documents.empty')}
            description={t('portal.documents.emptyHint')}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Input
              type="search"
              icon={<Search />}
              inputSize="sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('portal.documents.searchPlaceholder')}
              aria-label={t('portal.documents.searchLabel')}
              wrapperClassName="w-full md:w-[280px] md:shrink-0"
            />
            {kindOptions.length > 2 ? (
              <ChipFilter<KindFilter>
                options={kindOptions}
                value={activeKind}
                onChange={(v) => setKind(v ?? 'all')}
                allowDeselect={false}
                ariaLabel={t('portal.documents.filterLabel')}
                className="min-w-0 md:flex-1"
              />
            ) : null}
          </div>
          {filtering ? (
            <p className="text-caption tabular" role="status">
              {t('portal.documents.resultCount', { count: filtered.length })}
            </p>
          ) : null}
          {groups.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title={t('portal.documents.emptyFiltered')}
                description={t('portal.documents.emptyFilteredHint')}
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('portal.documents.clearFilters')}
                  </Button>
                }
              />
            </Card>
          ) : (
            groups.map((g) => (
              <SectionCard
                key={g.key}
                title={g.name}
                description={t('portal.documents.fileCount', { count: g.files.length })}
                flush
                className="overflow-hidden"
              >
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {g.files.map((f) => (
                    <DocumentRow key={f.id} file={f} onPreview={setPreview} />
                  ))}
                </ul>
              </SectionCard>
            ))
          )}
        </div>
      )}

      <FilePreviewDialog
        file={preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </div>
  );
}
