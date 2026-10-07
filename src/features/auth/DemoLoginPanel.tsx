// "Vào nhanh (demo)": a 2×2 grid of role cards (avatar, role, person, company) + a link for the internal member role.
import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { DemoLogin, Role } from '@/services/contract';
import { api } from '@/services/api';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/hooks/useAction';
import { hasKey, t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { FormError } from './FormError';

const MAIN_ROLES: Role[] = ['director', 'am', 'client_owner', 'client_member'];
const INTERNAL_ROLES: ReadonlySet<Role> = new Set<Role>(['director', 'am', 'member']);

/** the card already says Nội bộ / Khách hàng above the role, so it uses the role without the side prefix */
function labelOf(login: DemoLogin): string {
  const short = `auth.demo.cardRole.${login.role}`;
  if (hasKey(short)) return t(short);
  if (login.label_key && hasKey(login.label_key)) return t(login.label_key);
  return t(`auth.demo.${login.role}`);
}

/** subtitle is "<job title> · <company>": the card shows the company next to the person */
function companyOf(login: DemoLogin): string {
  const parts = login.subtitle.split(' · ');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : login.subtitle;
}

function readDemoLogins(): DemoLogin[] {
  try {
    const list: unknown = api.listDemoLogins();
    return Array.isArray(list) ? (list as DemoLogin[]) : [];
  } catch (err) {
    console.warn('[login] demo logins unavailable', err);
    return [];
  }
}

export function DemoLoginPanel({ className }: { className?: string }) {
  const logins = useMemo(readDemoLogins, []);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byRole = useMemo(() => {
    const map = new Map<Role, DemoLogin>();
    for (const login of logins) if (!map.has(login.role)) map.set(login.role, login);
    return map;
  }, [logins]);
  const main = MAIN_ROLES.map((role) => byRole.get(role)).filter((l): l is DemoLogin => !!l);
  const member = byRole.get('member') ?? null;

  async function enter(role: Role) {
    if (pendingRole) return;
    setError(null);
    setPendingRole(role);
    try {
      // success changes the viewer; LoginPage then redirects
      await api.loginDemo(role);
    } catch (err) {
      setError(errorMessage(err));
      setPendingRole(null);
    }
  }

  if (logins.length === 0) return null;

  return (
    <section aria-labelledby="demo-login-title" className={cn('space-y-4', className)}>
      <div>
        <div className="flex items-center gap-3">
          <h2 id="demo-login-title" className="shrink-0 text-table font-semibold text-foreground">
            {t('auth.demo.title')}
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <p className="mt-1 text-caption">{t('auth.demo.description')}</p>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {main.map((login) => {
          const busy = pendingRole === login.role;
          const internal = INTERNAL_ROLES.has(login.role);
          const role = labelOf(login);
          return (
            <li key={login.user_id} className="min-w-0">
              <button
                type="button"
                onClick={() => void enter(login.role)}
                disabled={pendingRole !== null}
                aria-busy={busy || undefined}
                className={cn(
                  'group relative flex h-full w-full min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-left shadow-card sm:p-3.5',
                  'transition duration-150 ease-out-quart hover:-translate-y-px hover:border-primary-border hover:shadow-card-hover active:scale-[0.98]',
                  'disabled:cursor-not-allowed disabled:hover:translate-y-0',
                  pendingRole !== null && !busy && 'opacity-60',
                )}
              >
                <UserAvatar
                  user={{ full_name: login.full_name, avatar_url: null, org_type: internal ? 'internal' : 'client' }}
                  size="md"
                  className="hidden sm:inline-flex lg:hidden xl:inline-flex"
                />
                <span className="block min-w-0 flex-1">
                  <span className="block text-micro font-medium text-muted-foreground">
                    {internal ? t('auth.demo.sideInternal') : t('auth.demo.sideClient')}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-table font-semibold leading-5 text-ink">{role}</span>
                  <span className="mt-0.5 block truncate text-micro text-muted-foreground">
                    {login.full_name}
                    {companyOf(login) ? (
                      <span className="hidden sm:inline lg:hidden 2xl:inline">
                        {t('common.separator')}
                        {companyOf(login)}
                      </span>
                    ) : null}
                  </span>
                </span>
                {busy ? (
                  <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                ) : (
                  <ArrowUpRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-caption transition-colors duration-150 group-hover:text-primary"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {member ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={pendingRole !== null}
            loading={pendingRole === 'member'}
            onClick={() => void enter('member')}
          >
            {t('auth.demo.memberLink')}
            {pendingRole !== 'member' ? <ArrowRight aria-hidden /> : null}
          </Button>
        </div>
      ) : null}

      <FormError message={error} />
    </section>
  );
}
