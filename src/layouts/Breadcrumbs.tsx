// Breadcrumbs of the internal top bar, derived from the route: "Khách hàng › Cỏ Xanh Retail".
// Entity names (account, deal, lead, quote) are fetched with a small query only on their detail routes.
import { Fragment } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { INTERNAL_NAV, navFor, navItemForPath } from './navItems';

export interface Crumb {
  label: string;
  /** link target; the last crumb (current page) has none */
  to?: string;
  /** label still loading (entity name) */
  pending?: boolean;
  /** a filtered view of the section itself ("Việc của tôi"), not a child page: phones show no back link for it */
  view?: boolean;
}

/** The section to go back to from a child page (entity detail, "Tạo …", digest); null on a section's own page. */
export function backCrumb(crumbs: Crumb[]): (Crumb & { to: string }) | null {
  const [root, leaf] = crumbs;
  if (!root || !leaf || leaf.view || !root.to) return null;
  return { ...root, to: root.to };
}

type Entity = { kind: 'account' | 'opportunity' | 'lead' | 'quote'; id: string } | null;

function entityOf(segments: string[]): Entity {
  const [first, second, third] = segments;
  if (first === 'accounts' && second && second !== 'new') return { kind: 'account', id: second };
  if (first === 'crm' && second === 'opportunities' && third) return { kind: 'opportunity', id: third };
  if (first === 'targets' && second === 'leads' && third) return { kind: 'lead', id: third };
  if (first === 'commercial' && second === 'quotes' && third && third !== 'new') return { kind: 'quote', id: third };
  return null;
}

async function entityName(entity: NonNullable<Entity>): Promise<string> {
  switch (entity.kind) {
    case 'account':
      return (await api.getAccount(entity.id)).name;
    case 'opportunity':
      return (await api.getOpportunity(entity.id)).name;
    case 'lead':
      return (await api.getLead(entity.id)).company_name;
    case 'quote': {
      const quote = await api.getQuote(entity.id);
      return quote.code;
    }
  }
}

export function useBreadcrumbs(): Crumb[] {
  const viewer = useViewer();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const items = navFor(INTERNAL_NAV, viewer?.role);
  const segments = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  const entity = entityOf(segments);
  const entityKey = entity ? `${entity.kind}:${entity.id}` : null;
  const name = useQuery<string>(() => (entity ? entityName(entity) : Promise.resolve('')), [entityKey], {
    enabled: !!entity && !!viewer,
  });

  // the digest belongs to the notifications section
  const sectionPath = segments[0] === 'digest' ? '/app/notifications' : pathname;
  const section = navItemForPath(items, sectionPath) ?? navItemForPath(INTERNAL_NAV, sectionPath);
  if (!section) return [];
  const root: Crumb = { label: t(section.labelKey), to: section.to };
  const [first, second] = segments;

  if (entity) {
    // keep the way back to the section even when the entity cannot be opened
    if (name.error) return [root, { label: t('layout.crumbs.unavailable') }];
    return [root, { label: name.data ?? '', pending: name.data === undefined }];
  }
  if (first === 'accounts' && second === 'new') return [root, { label: t('layout.crumbs.newAccount') }];
  if (first === 'commercial' && second === 'quotes') return [root, { label: t('layout.crumbs.newQuote') }];
  if (first === 'digest') return [root, { label: t('layout.crumbs.digest') }];
  if (first === 'tasks' && params.get('mine') === '1') return [root, { label: t('layout.crumbs.myTasks'), view: true }];
  return [{ label: root.label }];
}

/**
 * Desktop / tablet trail. A section's own page (one crumb) repeats its <h1>, so the trail fades in only once that
 * heading has scrolled under the bar (`titleInView` false). Child pages always show it: it is their way back.
 */
export function Breadcrumbs({ crumbs, className, titleInView = false }: { crumbs: Crumb[]; className?: string; titleInView?: boolean }) {
  if (crumbs.length === 0) return null;
  const quiet = crumbs.length === 1 && titleInView;
  return (
    <nav
      aria-label={t('layout.crumbs.label')}
      className={cn(
        'min-w-0 transition-[opacity,transform] duration-200 ease-out-quart',
        quiet ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
        className,
      )}
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-table">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}:${crumb.label}`}>
              {i > 0 ? (
                <li aria-hidden className="shrink-0 text-caption">
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </li>
              ) : null}
              <li className={cn('min-w-0', last ? 'truncate' : 'shrink-0')}>
                {crumb.pending ? (
                  <Skeleton className="h-4 w-32" />
                ) : crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="rounded-md px-1 py-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="block truncate px-1 font-medium text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Phone: a child page gets "‹ Khách hàng" (back to its section); a section page gets its title, shown only once the
 * page's own heading has scrolled away (`visible`), so the bar never repeats the big title right under it.
 */
export function MobilePageTitle({ crumbs, visible = true }: { crumbs: Crumb[]; visible?: boolean }) {
  const back = backCrumb(crumbs);
  if (back) {
    return (
      <Link
        to={back.to}
        aria-label={t('layout.crumbs.backTo', { section: back.label })}
        className="touch-tap -ml-1 inline-flex h-10 min-w-0 items-center gap-0.5 rounded-lg pl-0.5 pr-2 text-table font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">{back.label}</span>
      </Link>
    );
  }
  const section = crumbs[crumbs.length - 1];
  if (!section) return null;
  return (
    <span
      className={cn(
        'truncate text-heading font-semibold tracking-tightish text-ink transition-[opacity,transform] duration-200 ease-out-quart',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
    >
      {section.label}
    </span>
  );
}
