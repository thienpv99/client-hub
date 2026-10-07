// New-account wizard: draft shape, defaults, per-step validation and the NewAccountInput builder.
import type { DecisionRole, ISODate, Salutation, Stage, Tier } from '@/domain/types';
import type { NewAccountInput } from '@/services/contract';
import { isValidISODate } from '@/domain/dates';
import { t } from '@/i18n';
import { newId } from '@/lib/utils';
import { emailLocalProblem, fullEmail } from '@/features/settings/emailRules';

export const INDUSTRY_KEYS = ['retail', 'banking', 'manufacturing', 'energy', 'real_estate', 'logistics', 'other'] as const;
export type IndustryKey = (typeof INDUSTRY_KEYS)[number];

export const TIERS: Tier[] = ['strategic', 'key', 'standard'];
export const STAGES: Stage[] = ['prospecting', 'negotiating', 'implementing', 'operating', 'paused'];
export const DECISION_ROLES: DecisionRole[] = ['decision_maker', 'approver', 'ops_contact'];

/**
 * Curated brand colours for accounts without a logo. These are account DATA (Account.brand_color, rendered behind
 * white initials by AccountLogo), not UI design tokens; each keeps ≥ 4.5:1 contrast with white text.
 */
export const BRAND_COLORS: { key: string; value: string }[] = [
  { key: 'blue', value: '#1D4ED8' },
  { key: 'navy', value: '#1E3A8A' },
  { key: 'teal', value: '#0E7490' },
  { key: 'green', value: '#2F7D4F' },
  { key: 'violet', value: '#6D28D9' },
  { key: 'rose', value: '#BE123C' },
  { key: 'rust', value: '#9A3412' },
  { key: 'slate', value: '#334155' },
];

export const STEP_KEYS = ['company', 'contacts', 'project'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export interface CompanyDraft {
  name: string;
  short_name: string;
  industry: IndustryKey | '';
  industry_other: string;
  tier: Tier;
  stage: Stage;
  email_domain: string;
  logo_url: string | null;
  brand_color: string;
  am_id: string;
}

export interface ContactDraft {
  key: string;
  full_name: string;
  salutation: Salutation | '';
  title: string;
  decision_role: DecisionRole;
  /** the part before "@domain" */
  email: string;
  phone: string;
  invite: boolean;
}

export interface ProjectDraft {
  name: string;
  start_date: ISODate;
  /** template id, NO_TEMPLATE, or '' while not chosen */
  template_id: string;
}

export const NO_TEMPLATE = 'none';

export interface WizardDraft {
  company: CompanyDraft;
  contacts: ContactDraft[];
  project: ProjectDraft;
}

export function newContact(decisionRole: DecisionRole = 'decision_maker'): ContactDraft {
  return { key: newId('wc'), full_name: '', salutation: '', title: '', decision_role: decisionRole, email: '', phone: '', invite: true };
}

export function initialDraft(today: ISODate, amId: string): WizardDraft {
  return {
    company: {
      name: '',
      short_name: '',
      industry: '',
      industry_other: '',
      tier: 'standard',
      stage: 'implementing',
      email_domain: '',
      logo_url: null,
      brand_color: BRAND_COLORS[0]?.value ?? '#1D4ED8',
      am_id: amId,
    },
    contacts: [newContact('decision_maker')],
    project: { name: '', start_date: today, template_id: '' },
  };
}

// ───────────────────────────── normalisation ─────────────────────────────

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** 'https://www.CoXanh.vn/' → 'coxanh.vn'; '@coxanh.vn' → 'coxanh.vn' */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^@+/, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '');
}

export function industryLabel(c: CompanyDraft): string {
  if (c.industry === 'other') return c.industry_other.trim();
  return c.industry ? t(`wizard.industries.${c.industry}`) : '';
}

// legal-form prefixes dropped from the suggested short name ("Công ty CP Dược phẩm Ánh Dương" → "Dược phẩm Ánh Dương")
const LEGAL_PREFIX_RE =
  /^(công ty|cty)\.?\s+((cổ phần|cp|tnhh|trách nhiệm hữu hạn|hợp danh)(\s+(mtv|một thành viên))?\s+)?/iu;

/** short name suggested from the full name; the full name itself when nothing is left after the legal form */
export function suggestShortName(name: string): string {
  const full = name.trim().replace(/\s+/g, ' ');
  const rest = full.replace(LEGAL_PREFIX_RE, '').trim();
  return rest || full;
}

export function shortNameOf(c: CompanyDraft): string {
  return c.short_name.trim() || suggestShortName(c.name);
}

// ───────────────────────────── validation ─────────────────────────────

export type CompanyField = 'name' | 'industry' | 'industry_other' | 'email_domain' | 'am_id';
export type CompanyErrors = Partial<Record<CompanyField, string>>;

export function validateCompany(c: CompanyDraft): CompanyErrors {
  const e: CompanyErrors = {};
  if (!c.name.trim()) e.name = t('wizard.company.errors.name');
  if (!c.industry) e.industry = t('wizard.company.errors.industry');
  else if (c.industry === 'other' && !c.industry_other.trim()) e.industry_other = t('wizard.company.errors.industryOther');
  const domain = normalizeDomain(c.email_domain);
  if (!domain) e.email_domain = t('wizard.company.errors.domainRequired');
  else if (!DOMAIN_RE.test(domain)) e.email_domain = t('wizard.company.errors.domainInvalid');
  if (!c.am_id) e.am_id = t('wizard.company.errors.am');
  return e;
}

export type ContactField = 'full_name' | 'salutation' | 'email' | 'phone';
export type ContactErrors = Partial<Record<ContactField, string>>;

const PHONE_RE = /^\+?[0-9 .()-]+$/;

export function validateContacts(list: ContactDraft[], domain: string): { rows: Record<string, ContactErrors>; general: string | null } {
  const rows: Record<string, ContactErrors> = {};
  const seen = new Map<string, string>();
  for (const c of list) {
    const e: ContactErrors = {};
    if (!c.full_name.trim()) e.full_name = t('wizard.contacts.errors.name');
    if (!c.salutation) e.salutation = t('settings.salutation.required');
    const problem = emailLocalProblem(c.email, c.invite);
    if (problem) e.email = problem === 'settings.email.required' ? t('wizard.contacts.errors.emailForInvite') : t(problem, { domain });
    else if (c.email) {
      const other = seen.get(c.email);
      if (other) e.email = t('wizard.contacts.errors.emailDuplicate');
      else seen.set(c.email, c.key);
    }
    const phone = c.phone.trim();
    if (phone) {
      const digits = phone.replace(/\D/g, '').length;
      if (!PHONE_RE.test(phone) || digits < 9 || digits > 12) e.phone = t('wizard.contacts.errors.phone');
    }
    if (Object.keys(e).length > 0) rows[c.key] = e;
  }
  const general = list.some((c) => c.decision_role === 'decision_maker') ? null : t('wizard.contacts.errors.decisionMaker');
  return { rows, general };
}

export type ProjectField = 'name' | 'start_date' | 'template_id';
export type ProjectErrors = Partial<Record<ProjectField, string>>;

export function validateProject(p: ProjectDraft): ProjectErrors {
  const e: ProjectErrors = {};
  if (!p.name.trim()) e.name = t('wizard.project.errors.name');
  if (!isValidISODate(p.start_date)) e.start_date = t('wizard.project.errors.startDate');
  if (!p.template_id) e.template_id = t('wizard.project.errors.template');
  return e;
}

export function stepValid(step: number, d: WizardDraft): boolean {
  if (step === 0) return Object.keys(validateCompany(d.company)).length === 0;
  if (step === 1) {
    const r = validateContacts(d.contacts, normalizeDomain(d.company.email_domain));
    return Object.keys(r.rows).length === 0 && r.general === null;
  }
  return Object.keys(validateProject(d.project)).length === 0;
}

// ───────────────────────────── submit ─────────────────────────────

export function buildInput(d: WizardDraft): NewAccountInput {
  const c = d.company;
  const domain = normalizeDomain(c.email_domain);
  return {
    company: {
      name: c.name.trim(),
      short_name: shortNameOf(c),
      industry: industryLabel(c),
      tier: c.tier,
      stage: c.stage,
      email_domain: domain,
      logo_url: c.logo_url,
      brand_color: c.brand_color,
      am_id: c.am_id,
    },
    contacts: d.contacts.map((x) => ({
      full_name: x.full_name.trim(),
      // validated before submit
      salutation: (x.salutation || 'anh') as Salutation,
      title: x.title.trim(),
      decision_role: x.decision_role,
      email: x.email ? fullEmail(x.email, domain) : '',
      phone: x.phone.trim() || null,
      invite: x.invite,
    })),
    project: {
      name: d.project.name.trim(),
      start_date: d.project.start_date,
      template_id: d.project.template_id && d.project.template_id !== NO_TEMPLATE ? d.project.template_id : null,
    },
  };
}
