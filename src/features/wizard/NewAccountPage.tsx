// /app/accounts/new — Tạo khách hàng mới (SPEC §4.3): 3 steps with a stepper, per-step validation with inline
// messages, Back keeps the data, Enter moves on, a sticky Back/Next bar, and a review in the last step →
// api.createAccount. Reading width (DESIGN §5 forms / wizard). The step heading is text-heading on phones, one step
// below the page title (which is text-title there).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { CompanyStep } from './CompanyStep';
import { ContactsStep, contactFieldId } from './ContactsStep';
import { ProjectStep } from './ProjectStep';
import { WizardStepper } from './WizardStepper';
import { WizardSummary } from './WizardSummary';
import {
  buildInput,
  initialDraft,
  normalizeDomain,
  NO_TEMPLATE,
  shortNameOf,
  STEP_KEYS,
  stepValid,
  validateCompany,
  validateContacts,
  validateProject,
  type CompanyDraft,
  type CompanyField,
  type ContactDraft,
  type ContactField,
  type ProjectDraft,
  type ProjectField,
  type WizardDraft,
} from './wizardModel';

const LAST_STEP = STEP_KEYS.length - 1;

const COMPANY_FIELD_IDS: Record<CompanyField, string> = {
  name: 'wz-name',
  email_domain: 'wz-domain',
  industry: 'wz-industry',
  industry_other: 'wz-industry-other',
  am_id: 'wz-am',
};
const COMPANY_ORDER: CompanyField[] = ['name', 'email_domain', 'industry', 'industry_other', 'am_id'];
const CONTACT_ORDER: ContactField[] = ['full_name', 'salutation', 'email', 'phone'];
const CONTACT_FIELD_SUFFIX: Record<ContactField, string> = { full_name: 'name', salutation: 'salutation', email: 'email', phone: 'phone' };
const PROJECT_ORDER: ProjectField[] = ['name', 'start_date', 'template_id'];

/** focus an element; a group container (toggle buttons / radios) focuses its first enabled button */
function focusById(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.matches('input, select, textarea, button')
    ? el
    : el.querySelector<HTMLElement>('[aria-checked="true"], [data-state="on"], button:not([disabled])') ?? el;
  target.focus();
}

function focusFirstError(step: number, d: WizardDraft) {
  if (step === 0) {
    const e = validateCompany(d.company);
    const first = COMPANY_ORDER.find((k) => e[k]);
    if (first) focusById(COMPANY_FIELD_IDS[first]);
    return;
  }
  if (step === 1) {
    const r = validateContacts(d.contacts, normalizeDomain(d.company.email_domain));
    for (const c of d.contacts) {
      const e = r.rows[c.key];
      const field = e ? CONTACT_ORDER.find((k) => e[k]) : undefined;
      if (field) {
        focusById(contactFieldId(c.key, CONTACT_FIELD_SUFFIX[field]));
        return;
      }
    }
    const first = d.contacts[0];
    if (r.general && first) focusById(contactFieldId(first.key, 'role'));
    return;
  }
  const e = validateProject(d.project);
  const first = PROJECT_ORDER.find((k) => e[k]);
  if (first === 'name') focusById('wz-project-name');
  else if (first === 'start_date') focusById('wz-project-start');
  else if (first === 'template_id') document.querySelector<HTMLElement>('[id^="wz-tpl-"]')?.focus();
}

export function NewAccountPage() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const isDirector = viewer?.role === 'director';
  const [draft, setDraft] = useState<WizardDraft>(() =>
    initialDraft(todayISO(), viewer && viewer.role !== 'director' ? viewer.user.id : ''),
  );
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [attempted, setAttempted] = useState<boolean[]>(() => STEP_KEYS.map(() => false));
  // contact rows that existed when step 2 was last checked: a row added afterwards shows no errors until the next try
  const [checkedContacts, setCheckedContacts] = useState<ReadonlySet<string>>(() => new Set());
  const { run, pending } = useAction();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mounted = useRef(false);

  const templatesQ = useQuery(() => api.listTemplates(), []);
  const managersQ = useQuery(
    async () =>
      (await api.listUsers({ orgType: 'internal' }))
        .filter((u) => u.role === 'am' || u.role === 'director')
        .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'am' ? -1 : 1)),
    [],
    { enabled: isDirector },
  );
  const accountsQ = useQuery(() => api.listAccounts(), []);

  // preselect the first template once the list is known
  const firstTemplateId = templatesQ.data ? templatesQ.data[0]?.id ?? NO_TEMPLATE : null;
  useEffect(() => {
    if (!firstTemplateId) return;
    setDraft((d) => (d.project.template_id ? d : { ...d, project: { ...d.project, template_id: firstTemplateId } }));
  }, [firstTemplateId]);

  // an AM always creates the account for themself (the api refuses anyone else)
  const selfAmId = viewer && viewer.role !== 'director' ? viewer.user.id : null;
  useEffect(() => {
    if (!selfAmId) return;
    setDraft((d) => (d.company.am_id === selfAmId ? d : { ...d, company: { ...d.company, am_id: selfAmId } }));
  }, [selfAmId]);

  // new step: move focus to its heading (screen readers announce it) and back to the top
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  if (!viewer) return null;

  const domain = normalizeDomain(draft.company.email_domain);
  const companyErrors = attempted[0] ? validateCompany(draft.company) : {};
  const contactsCheck = validateContacts(draft.contacts, domain);
  const projectErrors = attempted[2] ? validateProject(draft.project) : {};
  const manager: UserRef | null = isDirector
    ? managersQ.data?.find((m) => m.id === draft.company.am_id) ?? null
    : viewer.user;

  const setCompany = (patch: Partial<CompanyDraft>) => setDraft((d) => ({ ...d, company: { ...d.company, ...patch } }));
  const setContacts = (update: (prev: ContactDraft[]) => ContactDraft[]) =>
    setDraft((d) => ({ ...d, contacts: update(d.contacts) }));
  const setProject = (patch: Partial<ProjectDraft>) => setDraft((d) => ({ ...d, project: { ...d.project, ...patch } }));

  function markAttempted(index: number) {
    setAttempted((a) => a.map((v, i) => (i === index ? true : v)));
    if (index === 1) setCheckedContacts(new Set(draft.contacts.map((c) => c.key)));
  }

  const contactErrors = attempted[1]
    ? Object.fromEntries(Object.entries(contactsCheck.rows).filter(([k]) => checkedContacts.has(k)))
    : {};

  /** validate `index`; on failure show its messages and focus the first wrong field */
  function check(index: number): boolean {
    if (stepValid(index, draft)) return true;
    markAttempted(index);
    if (index !== step) setStep(index);
    setTimeout(() => focusFirstError(index, draft), 0);
    return false;
  }

  function enter(index: number) {
    if (index === 2 && !draft.project.name.trim()) {
      const name = shortNameOf(draft.company);
      if (name) setProject({ name: t('wizard.project.defaultName', { name }) });
    }
    if (index > 0 && domain !== draft.company.email_domain) setCompany({ email_domain: domain });
    setStep(index);
    setMaxReached((m) => Math.max(m, index));
  }

  function goTo(index: number) {
    if (index === step || pending) return;
    if (index < step) {
      setStep(index);
      return;
    }
    for (let i = step; i < index; i += 1) if (!check(i)) return;
    enter(index);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (step < LAST_STEP) {
      if (check(step)) enter(step + 1);
      return;
    }
    for (let i = 0; i <= LAST_STEP; i += 1) if (!check(i)) return;
    const input = buildInput(draft);
    const invites = input.contacts.filter((c) => c.invite).length;
    const created = await run(() => api.createAccount(input), {
      success: invites > 0 ? 'wizard.toast.createdWithInvites' : 'wizard.toast.created',
      successParams: { name: input.company.name, count: invites },
    });
    if (created) navigate(`/app/accounts/${created.id}`);
  }

  const key = STEP_KEYS[step] ?? 'company';
  const summary = (
    <WizardSummary
      draft={draft}
      current={step}
      maxReached={maxReached}
      templates={templatesQ.data}
      manager={manager}
      onEdit={goTo}
    />
  );

  return (
    <div className="mx-auto w-full max-w-reading space-y-6">
      <PageHeader title={t('wizard.title')} description={t('wizard.description')} />
      <WizardStepper current={step} maxReachable={pending ? -1 : maxReached} onStep={goTo} />

      <form noValidate onSubmit={(e) => void onSubmit(e)} aria-labelledby="wz-step-title" className="min-w-0">
        <Card>
          <div className="border-b border-border/60 px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
            <h2
              id="wz-step-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-heading font-semibold tracking-tightish text-ink outline-none focus-visible:outline-none sm:text-title"
            >
              {t(`wizard.stepTitles.${key}`)}
            </h2>
            <p className="mt-1 text-table text-muted-foreground">{t(`wizard.stepDescriptions.${key}`)}</p>
          </div>

          <div className="px-4 py-5 sm:px-6 sm:py-6">
            {step === 0 ? (
              <CompanyStep
                company={draft.company}
                errors={companyErrors}
                onChange={setCompany}
                viewer={viewer}
                managers={managersQ.data}
                accounts={accountsQ.data ?? []}
              />
            ) : null}
            {step === 1 ? (
              <ContactsStep
                contacts={draft.contacts}
                domain={domain}
                errors={contactErrors}
                general={attempted[1] ? contactsCheck.general : null}
                onChange={setContacts}
              />
            ) : null}
            {step === 2 ? (
              <ProjectStep
                project={draft.project}
                errors={projectErrors}
                onChange={setProject}
                templates={templatesQ.data}
                summary={summary}
              />
            ) : null}
          </div>
        </Card>

        {/* phones: full-bleed bar on the bottom edge; from md a floating card bar (DESIGN §5 forms: sticky footer) */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 md:bottom-4 md:mx-0">
          <div className="flex items-center gap-3 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md md:rounded-xl md:border md:pb-3 md:shadow-pop">
            {step === 0 ? (
              <Button asChild variant="ghost">
                <Link to="/app/accounts">{t('common.cancel')}</Link>
              </Button>
            ) : (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setStep(step - 1)}>
                <ArrowLeft aria-hidden="true" />
                {t('wizard.actions.back')}
              </Button>
            )}
            <p className="hidden flex-1 text-center text-caption tabular sm:block" aria-hidden="true">
              {t('wizard.stepOf', { n: step + 1, total: STEP_KEYS.length })}
            </p>
            <Button type="submit" loading={pending} className="ml-auto flex-1 sm:flex-none">
              {step < LAST_STEP ? (
                <>
                  {t('wizard.actions.next')}
                  <ArrowRight aria-hidden="true" />
                </>
              ) : (
                <>
                  {!pending ? <Check aria-hidden="true" /> : null}
                  {t('wizard.actions.create')}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
