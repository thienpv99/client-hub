// "Vào nhanh (demo)": a 2×2 grid of role cards (avatar, role, person, company) + a link for the internal member role.
import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { DemoLogin, Role } from '@/services/contract';
import { api } from '@/services/api';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/hooks/useAction';
import { riseProps, useDelayedFlag } from '@/hooks/useMotion';
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
  // the busy look (spinner, dimmed siblings) waits 150 ms: a quick sign-in goes straight to the app (DESIGN §8.2)
  const busyVisible = useDelayedFlag(pendingRole !== null);
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
        {main.map((login, i) => {
          const busy = pendingRole === login.role;
          const internal = INTERNAL_ROLES.has(login.role);
          const role = labelOf(login);
          // they fade up just after the sign-in card (index + 2 = 70 ms later), one after the other
          const motion = riseProps(i + 2);
          return (
            <li key={login.user_id} className={cn('min-w-0', motion.className)} style={motion.style}>
              <button
                type="button"
                onClick={() => void enter(login.role)}
                // a click while one card signs in is ignored at once (enter() guards); the dimmed look waits
                disabled={busyVisible}
                aria-busy={busy || undefined}
                className={cn(
                  // hover-lift (index.css, = Card interactive): −1px + shadow-card-hover, settles on press
                  'hover-lift group relative flex h-full w-full min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-left shadow-card hover:border-border sm:p-3.5',
                  'disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-card',
                  busyVisible && !busy && 'opacity-60',
                )}
              >
                <UserAvatar
                  user={{ full_name: login.full_name, avatar_url: null, org_type: internal ? 'internal' : 'client' }}
                  size="md"
                  className="hidden sm:inline-flex lg:hidden xl:inline-flex"
                />
                {/* pr-5: the corner arrow sits beside the side label only, so the role (2nd line) gets the full width
                    ("Quản lý khách hàng" stays on one line) */}
                <span className="block min-w-0 flex-1">
                  <span className="block pr-5 text-micro font-medium text-muted-foreground">
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
                <span className="absolute right-3 top-3 sm:right-3.5 sm:top-3.5" aria-hidden>
                  {busy && busyVisible ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-caption transition-[color,transform] duration-150 ease-out-quart group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-primary" />
                  )}
                </span>
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
            disabled={busyVisible && pendingRole !== 'member'}
            loading={pendingRole === 'member'}
            onClick={() => void enter('member')}
          >
            {t('auth.demo.memberLink')}
            {/* kept while busy: the Button swaps its icon for the spinner itself after 150 ms */}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      ) : null}

      <FormError message={error} />
    </section>
  );
}
