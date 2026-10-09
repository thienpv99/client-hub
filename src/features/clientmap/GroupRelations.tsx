// "Quan hệ trong tập đoàn" (SPEC-CARE §6.6): who knows whom across the companies of one group, as plain sentences
// ("Anh Bình (Mây Trắng) đã giới thiệu anh Minh (Cỏ Xanh)") with the note and links to both companies.
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Handshake, UserPlus, Users } from 'lucide-react';
import type { RelationKind } from '@/domain/careTypes';
import type { RelationEnd, RelationView } from '@/services/careContract';
import { AccountLogo } from '@/components/common/account-logo';
import { SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { accountHref } from './matrixModel';

const KIND_ICONS: Record<RelationKind, LucideIcon> = {
  introduced: UserPlus,
  works_with: Handshake,
  reports_to: ArrowUpRight,
  former_colleague: Users,
};

function CompanyChip({ end }: { end: RelationEnd }) {
  const inner = (
    <>
      <AccountLogo account={end.account} size="xs" />
      <span className="truncate">{end.account.short_name || end.account.name}</span>
    </>
  );
  const base = cn('inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-md px-1.5 font-medium', SMALL);
  return end.accessible ? (
    <Link to={`${accountHref(end.account.id)}/relationships`} className={cn(base, 'touch-tap bg-muted text-foreground transition-colors duration-150 hover:bg-primary-soft hover:text-primary')}>
      {inner}
    </Link>
  ) : (
    <span className={cn(base, 'bg-muted text-muted-foreground')}>{inner}</span>
  );
}

export function GroupRelations({ relations }: { relations: RelationView[] }) {
  return (
    <SectionCard title={t('carePm.relations.title')} description={t('carePm.relations.description')} divided={relations.length > 0}>
      {relations.length === 0 ? (
        <EmptyState compact icon={Handshake} title={t('carePm.relations.emptyTitle')} description={t('carePm.relations.emptyDescription')} />
      ) : (
        relations.map((r) => {
          const Icon = KIND_ICONS[r.kind];
          const sameCompany = r.from.account.id === r.to.account.id;
          return (
            <div key={r.id} className="flex items-start gap-3 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" title={t(`care.relationKind.${r.kind}`)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-pretty text-table font-medium text-ink">{r.sentence}</p>
                {r.note ? <p className="text-pretty text-caption">{r.note}</p> : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  <CompanyChip end={r.from} />
                  {sameCompany ? null : <CompanyChip end={r.to} />}
                </div>
              </div>
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
