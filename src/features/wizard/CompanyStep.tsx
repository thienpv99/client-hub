// Step 1 — Thông tin công ty: name, short name, industry, tier, stage, email domain, logo / brand colour, AM.
// Sections: the company · Nhận diện · Người phụ trách, separated by hairlines (DESIGN §5 forms).
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { AccountSummary, UserRef, Viewer } from '@/services/contract';
import type { Stage, Tier } from '@/domain/types';
import { UserAvatar } from '@/components/common/user-avatar';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { AffixInput, GroupField } from '@/features/settings/fieldParts';
import { LogoPicker } from './LogoPicker';
import {
  INDUSTRY_KEYS,
  STAGES,
  TIERS,
  normalizeDomain,
  shortNameOf,
  suggestShortName,
  type CompanyDraft,
  type CompanyErrors,
  type IndustryKey,
} from './wizardModel';

/** a titled block of the step, under a hairline */
export function FormSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-border/60 pt-6">
      <div>
        <h3 id={id} className="text-heading font-semibold tracking-tightish text-ink">
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-caption">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function CompanyStep({
  company,
  errors,
  onChange,
  viewer,
  managers,
  accounts,
}: {
  company: CompanyDraft;
  /** errors to show (empty until the step was submitted once) */
  errors: CompanyErrors;
  onChange: (patch: Partial<CompanyDraft>) => void;
  viewer: Viewer;
  /** director: AMs (and directors) to choose from; undefined while loading */
  managers: UserRef[] | undefined;
  /** accounts this viewer can see, for the "domain already used" notice */
  accounts: AccountSummary[];
}) {
  const isDirector = viewer.role === 'director';
  const domain = normalizeDomain(company.email_domain);
  const sameDomain = domain ? accounts.find((a) => a.email_domain.toLowerCase() === domain) : undefined;
  const accountCount = (userId: string) => accounts.filter((a) => a.am.id === userId).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField className="sm:col-span-2" label={t('wizard.company.name')} htmlFor="wz-name" required error={errors.name}>
          <Input
            id="wz-name"
            autoComplete="organization"
            value={company.name}
            placeholder={t('wizard.company.namePlaceholder')}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </FormField>
        <FormField label={t('wizard.company.shortName')} htmlFor="wz-short" hint={t('wizard.company.shortNameHint')}>
          <Input
            id="wz-short"
            autoComplete="off"
            value={company.short_name}
            placeholder={suggestShortName(company.name) || t('wizard.company.shortNamePlaceholder')}
            onChange={(e) => onChange({ short_name: e.target.value })}
          />
        </FormField>
        <FormField
          label={t('wizard.company.domain')}
          htmlFor="wz-domain"
          required
          error={errors.email_domain}
          hint={
            sameDomain && !errors.email_domain ? (
              <span className="inline-flex items-start gap-1.5 text-warning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('wizard.company.domainUsed', { account: sameDomain.name })}
              </span>
            ) : (
              t('wizard.company.domainHint')
            )
          }
        >
          <AffixInput
            id="wz-domain"
            leading="@"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={company.email_domain}
            placeholder={t('wizard.company.domainPlaceholder')}
            onChange={(e) => onChange({ email_domain: e.target.value.toLowerCase().replace(/\s+/g, '') })}
            onBlur={() => {
              const normalized = normalizeDomain(company.email_domain);
              if (normalized !== company.email_domain) onChange({ email_domain: normalized });
            }}
          />
        </FormField>
        <div className="grid content-start gap-3">
          <FormField label={t('wizard.company.industry')} htmlFor="wz-industry" required error={errors.industry}>
            <NativeSelect
              id="wz-industry"
              value={company.industry}
              placeholder={t('wizard.company.industryPlaceholder')}
              onChange={(e) => onChange({ industry: e.target.value as IndustryKey | '' })}
            >
              {INDUSTRY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`wizard.industries.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {company.industry === 'other' ? (
            <FormField label={t('wizard.company.industryOther')} htmlFor="wz-industry-other" required error={errors.industry_other}>
              <Input
                id="wz-industry-other"
                autoComplete="off"
                value={company.industry_other}
                placeholder={t('wizard.company.industryOtherPlaceholder')}
                onChange={(e) => onChange({ industry_other: e.target.value })}
              />
            </FormField>
          ) : null}
        </div>
        <FormField label={t('wizard.company.stage')} htmlFor="wz-stage" className="content-start">
          <NativeSelect id="wz-stage" value={company.stage} onChange={(e) => onChange({ stage: e.target.value as Stage })}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.stage.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <GroupField id="wz-tier" label={t('wizard.company.tier')} className="sm:col-span-2">
          {(a11y) => (
            <ToggleGroup
              type="single"
              variant="segmented"
              value={company.tier}
              onValueChange={(v: string) => {
                if (TIERS.includes(v as Tier)) onChange({ tier: v as Tier });
              }}
              aria-labelledby={a11y.labelId}
              className="flex w-full sm:w-fit"
            >
              {TIERS.map((tier) => (
                <ToggleGroupItem key={tier} value={tier} className="flex-1 sm:flex-none sm:px-4">
                  {t(`enums.tier.${tier}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </GroupField>
      </div>

      <FormSection id="wz-brand-title" title={t('wizard.company.brandTitle')} description={t('wizard.company.brandDescription')}>
        <LogoPicker
          name={company.name}
          shortName={shortNameOf(company)}
          logoUrl={company.logo_url}
          brandColor={company.brand_color}
          onLogoChange={(logo_url) => onChange({ logo_url })}
          onColorChange={(brand_color) => onChange({ brand_color })}
        />
      </FormSection>

      <FormSection id="wz-am-title" title={t('wizard.company.amTitle')}>
        {isDirector ? (
          managers === undefined ? (
            <Skeleton className="h-11 w-full max-w-sm md:h-10" />
          ) : (
            <FormField
              label={t('wizard.company.am')}
              htmlFor="wz-am"
              required
              error={errors.am_id}
              hint={t('wizard.company.amHint')}
              className="max-w-md"
            >
              <NativeSelect
                id="wz-am"
                value={company.am_id}
                placeholder={t('wizard.company.amPlaceholder')}
                onChange={(e) => onChange({ am_id: e.target.value })}
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t('wizard.company.amOption', {
                      name: m.full_name,
                      role: t(`enums.role.${m.role}`),
                      count: accountCount(m.id),
                    })}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
            <UserAvatar user={viewer.user} size="md" />
            <div className="min-w-0">
              <p className="truncate text-table font-semibold text-foreground">{viewer.user.full_name}</p>
              <p className="text-caption">{t('wizard.company.amSelf')}</p>
            </div>
          </div>
        )}
      </FormSection>
    </div>
  );
}
