// Review of the new account, shown in the last step before "Tạo khách hàng": an inset panel (DESIGN §7.5) with
// one block per step and a "Sửa" link back to it.
import type { ReactNode } from 'react';
import { Mail } from 'lucide-react';
import type { ProjectTemplate } from '@/domain/types';
import type { UserRef } from '@/services/contract';
import { addDays, isValidISODate } from '@/domain/dates';
import { AccountLogo } from '@/components/common/account-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { industryLabel, normalizeDomain, NO_TEMPLATE, shortNameOf, type WizardDraft } from './wizardModel';

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-caption">{label}</dt>
      <dd className="min-w-0 text-right text-table text-foreground">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-caption">{t('wizard.summary.missing')}</span>;
}

function Block({
  title,
  step,
  current,
  maxReached,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  current: number;
  maxReached: number;
  onEdit: (step: number) => void;
  children: ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <div className="flex min-h-tap items-center justify-between gap-3 md:min-h-0">
        <h4 className="text-micro font-medium text-muted-foreground">{title}</h4>
        {step !== current && step <= maxReached ? (
          <Button type="button" variant="link" size="sm" onClick={() => onEdit(step)} aria-label={t('wizard.summary.editAria', { section: title })}>
            {t('wizard.summary.edit')}
          </Button>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function WizardSummary({
  draft,
  current,
  maxReached,
  templates,
  manager,
  onEdit,
  className,
}: {
  draft: WizardDraft;
  current: number;
  /** highest step reached so far: only those steps offer "Sửa" */
  maxReached: number;
  templates: ProjectTemplate[] | undefined;
  /** the chosen AM (or the signed-in AM) */
  manager: UserRef | null;
  onEdit: (step: number) => void;
  className?: string;
}) {
  const c = draft.company;
  const domain = normalizeDomain(c.email_domain);
  const name = c.name.trim();
  const invites = draft.contacts.filter((x) => x.invite).length;
  const template =
    draft.project.template_id && draft.project.template_id !== NO_TEMPLATE
      ? templates?.find((x) => x.id === draft.project.template_id) ?? null
      : null;
  const start = isValidISODate(draft.project.start_date) ? draft.project.start_date : null;
  const lastOffset = template ? template.milestones.reduce((m, x) => Math.max(m, x.offset_days), 0) : 0;
  const lastName = template ? [...template.milestones].sort((a, b) => b.offset_days - a.offset_days)[0]?.name ?? '' : '';

  return (
    <section
      aria-labelledby="wz-summary-title"
      className={cn('rounded-xl bg-subtle p-4 ring-1 ring-inset ring-border/60 sm:p-5', className)}
    >
      <h3 id="wz-summary-title" className="text-heading font-semibold tracking-tightish text-ink">
        {t('wizard.summary.title')}
      </h3>
      <div className="mt-4 divide-y divide-border/60">
        <Block title={t('wizard.steps.company')} step={0} current={current} maxReached={maxReached} onEdit={onEdit}>
          <div className="flex items-center gap-3">
            <AccountLogo
              account={{
                name: name || t('wizard.company.logoPlaceholderName'),
                short_name: shortNameOf(c) || t('wizard.company.logoPlaceholderName'),
                logo_url: c.logo_url,
                brand_color: c.brand_color,
              }}
              size="md"
            />
            <div className="min-w-0">
              <p className={cn('truncate text-table font-semibold', name ? 'text-foreground' : 'text-muted-foreground')}>
                {name || t('wizard.summary.noName')}
              </p>
              <p className="truncate text-caption">{domain ? `@${domain}` : t('wizard.summary.noDomain')}</p>
            </div>
          </div>
          <dl className="mt-2">
            <Row label={t('wizard.summary.industry')}>{industryLabel(c) || <Missing />}</Row>
            <Row label={t('wizard.summary.tierStage')}>
              {t('wizard.summary.tierStageValue', { tier: t(`enums.tier.${c.tier}`), stage: t(`enums.stage.${c.stage}`) })}
            </Row>
            <Row label={t('wizard.summary.am')}>{manager ? manager.full_name : <Missing />}</Row>
          </dl>
        </Block>

        <Block title={t('wizard.steps.contacts')} step={1} current={current} maxReached={maxReached} onEdit={onEdit}>
          <p className="text-caption tabular">{t('wizard.summary.contactsCount', { count: draft.contacts.length, invites })}</p>
          <ul className="mt-2 space-y-1.5">
            {draft.contacts.map((x, i) => (
              <li key={x.key} className="flex items-center gap-2 text-table">
                <span className={cn('min-w-0 flex-1 truncate', x.full_name.trim() ? 'text-foreground' : 'text-muted-foreground')}>
                  {x.full_name.trim() || t('wizard.contacts.item', { n: i + 1 })}
                </span>
                <span className="shrink-0 text-caption">{t(`enums.decisionRole.${x.decision_role}`)}</span>
                {x.invite ? (
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('wizard.summary.willInvite')} role="img" />
                ) : null}
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t('wizard.steps.project')} step={2} current={current} maxReached={maxReached} onEdit={onEdit}>
          <dl>
            <Row label={t('wizard.summary.projectName')}>{draft.project.name.trim() || <Missing />}</Row>
            <Row label={t('wizard.summary.start')}>{start ? <span className="tabular">{formatDate(start)}</span> : <Missing />}</Row>
            <Row label={t('wizard.summary.template')}>
              {template ? template.name : draft.project.template_id === NO_TEMPLATE ? t('wizard.project.noTemplate') : <Missing />}
            </Row>
            {template && start ? (
              <Row label={lastName || t('wizard.summary.lastMilestone')}>
                <span className="tabular">{formatDate(addDays(start, lastOffset))}</span>
              </Row>
            ) : null}
          </dl>
        </Block>
      </div>
    </section>
  );
}
