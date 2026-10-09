// /dev/selftest — run domain, CRM, RBAC, Google sign-in, seed and API smoke checks in the browser (no Node here).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck, CircleX, FlaskConical, Play, TriangleAlert } from 'lucide-react';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { homePathFor } from '@/features/shell/routing';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { runSuite, type CheckRow, type SuiteId, type SuiteOutcome } from './selfTestRunners';

const SUITES: SuiteId[] = ['domain', 'crm', 'care', 'rbac', 'sso', 'seed', 'api'];

type SuiteState = { status: 'idle' } | { status: 'running' } | { status: 'done'; outcome: SuiteOutcome };

function RowLine({ row }: { row: CheckRow }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      {row.ok ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
      ) : (
        <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
      )}
      <span className="min-w-0 flex-1 text-table">
        {row.suite ? <span className="text-muted-foreground">{row.suite} · </span> : null}
        <span className="text-foreground">{row.name}</span>
        {row.detail ? (
          <span className="mt-0.5 block break-words font-mono text-[13px] leading-[18px] text-muted-foreground">{row.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

function SuiteCard({ id, state, onRun, disabled }: { id: SuiteId; state: SuiteState; onRun(): void; disabled: boolean }) {
  const [showPassed, setShowPassed] = useState(false);
  const outcome = state.status === 'done' ? state.outcome : null;
  const failed = outcome ? outcome.rows.filter((r) => !r.ok) : [];
  const passed = outcome ? outcome.rows.filter((r) => r.ok) : [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <CardTitle asChild>
            <h2>{t(`dev.suites.${id}.title`)}</h2>
          </CardTitle>
          <CardDescription>{t(`dev.suites.${id}.description`)}</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {state.status === 'idle' ? <Badge variant="outline">{t('dev.notRun')}</Badge> : null}
            {state.status === 'running' ? <Badge variant="primary">{t('dev.running')}</Badge> : null}
            {outcome && outcome.error ? (
              <p className="flex w-full items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-table text-warning">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{t('dev.unavailable', { message: outcome.error })}</span>
              </p>
            ) : null}
            {outcome && !outcome.error ? (
              failed.length === 0 && passed.length > 0 ? (
                <Badge variant="success">
                  <CircleCheck aria-hidden />
                  {t('dev.allPassed', { count: passed.length })}
                </Badge>
              ) : outcome.rows.length > 0 ? (
                <Badge variant={failed.length > 0 ? 'danger' : 'success'}>
                  {failed.length > 0 ? <CircleX aria-hidden /> : <CircleCheck aria-hidden />}
                  {t('dev.summary', { passed: passed.length, failed: failed.length })}
                </Badge>
              ) : (
                <Badge variant="outline">{t('dev.noResults')}</Badge>
              )
            ) : null}
            {outcome ? <span className="text-caption tabular text-caption">{t('dev.duration', { ms: outcome.ms })}</span> : null}
            {outcome && outcome.sessionRestored === false ? (
              <Badge variant="warning">
                <TriangleAlert aria-hidden />
                {t('dev.sessionRestoreFailed')}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRun}
          disabled={disabled}
          loading={state.status === 'running'}
        >
          {state.status !== 'running' ? <Play aria-hidden /> : null}
          {t('dev.run')}
        </Button>
      </CardHeader>

      {outcome && outcome.rows.length > 0 ? (
        <CardContent className="space-y-3">
          {failed.length > 0 ? (
            <div>
              <h3 className="text-[13px] font-semibold leading-[18px] text-danger">{t('dev.failures')}</h3>
              <ul className="mt-1 divide-y divide-border/60">
                {failed.map((row, i) => (
                  <RowLine key={`f${i}`} row={row} />
                ))}
              </ul>
            </div>
          ) : null}
          {passed.length > 0 ? (
            <div>
              <Button type="button" variant="link" size="sm" onClick={() => setShowPassed((v) => !v)}>
                {showPassed ? t('dev.hidePassed') : t('dev.showPassed', { count: passed.length })}
              </Button>
              {showPassed ? (
                <ul className="mt-1 divide-y divide-border/60">
                  {passed.map((row, i) => (
                    <RowLine key={`p${i}`} row={row} />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function SelfTestPage() {
  const viewer = useViewer();
  // outside both app frames, so the page names the browser tab itself
  useEffect(() => {
    document.title = t('layout.documentTitle', { page: t('dev.title') });
  }, []);
  const [states, setStates] = useState<Record<SuiteId, SuiteState>>({
    domain: { status: 'idle' },
    crm: { status: 'idle' },
    rbac: { status: 'idle' },
    sso: { status: 'idle' },
    seed: { status: 'idle' },
    api: { status: 'idle' },
    care: { status: 'idle' },
  });
  const anyRunning = SUITES.some((id) => states[id].status === 'running');

  function update(id: SuiteId, state: SuiteState) {
    setStates((s) => ({ ...s, [id]: state }));
  }

  async function run(id: SuiteId) {
    update(id, { status: 'running' });
    const outcome = await runSuite(id);
    update(id, { status: 'done', outcome });
  }

  async function runAll() {
    // sequential: the RBAC suite switches sessions and must not overlap with the others
    for (const id of SUITES) await run(id);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 md:px-6">
          <NewEraLogo size="sm" withText />
          <span className="h-4 w-px bg-border-strong" aria-hidden />
          <span className="inline-flex min-w-0 items-center gap-2 text-table font-medium text-muted-foreground">
            <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t('dev.title')}</span>
          </span>
          <Button asChild variant="ghost" size="sm" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
            <Link to={homePathFor(viewer)}>
              <ArrowLeft aria-hidden />
              {t('dev.backHome')}
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-title font-semibold tracking-tightish text-ink md:text-display md:tracking-display">{t('dev.title')}</h1>
            <p className="mt-1 text-body text-muted-foreground">{t('dev.description')}</p>
          </div>
          <Button type="button" onClick={() => void runAll()} loading={anyRunning}>
            {!anyRunning ? <Play aria-hidden /> : null}
            {t('dev.runAll')}
          </Button>
        </div>
        {SUITES.map((id) => (
          <SuiteCard key={id} id={id} state={states[id]} disabled={anyRunning} onRun={() => void run(id)} />
        ))}
      </main>
    </div>
  );
}
