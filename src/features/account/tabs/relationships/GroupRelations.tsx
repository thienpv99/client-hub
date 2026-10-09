// "Quan hệ trong tập đoàn" — the person-to-person links of this account as readable sentences ("Anh Bình (Mây Trắng)
// đã giới thiệu anh Minh (Cỏ Xanh)"), with chips that open the sister company. Links inside the company are marked
// "Trong công ty". The director / AM add and edit them (RelationSheet).
import { Link } from 'react-router-dom';
import { ArrowRight, Link2, Pencil, Plus } from 'lucide-react';
import type { EcosystemRef, RelationView } from '@/services/careContract';
import { matrixHref } from '@/features/clientmap/matrixModel';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { accountTabPath } from '../../accountTabs';

export interface GroupRelationsProps {
  accountId: string;
  ecosystem: EcosystemRef | null;
  relations: RelationView[];
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (r: RelationView) => void;
  className?: string;
}

export function GroupRelations({ accountId, ecosystem, relations, canAdd, onAdd, onEdit, className }: GroupRelationsProps) {
  const add = canAdd ? (
    <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="text-primary hover:text-primary-hover">
      <Plus aria-hidden="true" />
      {t('careAccount.relationships.group.add')}
    </Button>
  ) : null;
  return (
    <SectionCard
      className={className}
      title={ecosystem ? t('careAccount.relationships.group.titleNamed', { group: ecosystem.short_name || ecosystem.name }) : t('careAccount.relationships.group.titlePlain')}
      description={ecosystem ? t('careAccount.relationships.group.description') : undefined}
      actions={relations.length > 0 ? add : null}
      flush
      footer={
        ecosystem ? (
          <Link
            to={matrixHref(ecosystem.id)}
            className="touch-tap inline-flex min-h-8 items-center gap-1 rounded text-table font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('careAccount.relationships.group.openMatrix', { group: ecosystem.short_name || ecosystem.name })}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {relations.length === 0 ? (
        <EmptyState compact icon={Link2} title={t('careAccount.relationships.group.empty')} description={t('careAccount.relationships.group.emptyHint')} action={add} />
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
          {relations.map((r) => {
            const others = [r.from, r.to].filter((end) => end.account.id !== accountId);
            return (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-table font-medium text-ink">{r.sentence}</p>
                  {r.note ? <p className="mt-0.5 text-pretty text-caption">{r.note}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.cross_unit ? (
                      others.map((end) =>
                        end.accessible ? (
                          <Link
                            key={end.contact_id}
                            to={accountTabPath(end.account.id, 'relationships')}
                            className="touch-tap inline-flex h-7 items-center gap-1.5 rounded-full bg-card pl-1 pr-2.5 text-micro font-medium text-foreground ring-1 ring-inset ring-border-strong/80 transition-colors duration-150 hover:bg-subtle"
                            aria-label={t('careAccount.relationships.map.openAccount', { account: end.account.name })}
                          >
                            <AccountLogo account={end.account} size="xs" />
                            {end.account.short_name || end.account.name}
                            <Link2 className="h-3 w-3 text-primary" aria-hidden="true" />
                          </Link>
                        ) : (
                          <span
                            key={end.contact_id}
                            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card pl-1 pr-2.5 text-micro font-medium text-foreground ring-1 ring-inset ring-border/70"
                          >
                            <AccountLogo account={end.account} size="xs" />
                            {end.account.short_name || end.account.name}
                          </span>
                        ),
                      )
                    ) : (
                      <Badge variant="outline" size="sm">
                        {t('careAccount.relationships.group.sameCompany')}
                      </Badge>
                    )}
                    <Badge size="sm">{r.kind_label}</Badge>
                  </div>
                </div>
                {r.can_edit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(r)}
                    aria-label={`${t('careAccount.relationships.group.edit')}: ${r.sentence}`}
                    title={t('careAccount.relationships.group.edit')}
                    className="-mr-1.5 -mt-1"
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
