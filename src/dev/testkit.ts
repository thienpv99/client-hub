// Minimal test helpers for in-browser self tests (no Node / no test runner on this machine).
// Run from the browser console:  (await import('/src/dev/domainTests')).runDomainTests()
// (always extensionless: '/src/x.ts' would load a second module instance, see ARCHITECTURE §0)

export interface TestResult {
  suite: string;
  name: string;
  ok: boolean;
  detail?: string;
}

export class AssertionError extends Error {}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new AssertionError(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new AssertionError(`${message} — expected ${e}, got ${a}`);
}

/** Collects results; never throws. */
export function createSuite(suite: string) {
  const results: TestResult[] = [];
  return {
    test(name: string, fn: () => void) {
      try {
        fn();
        results.push({ suite, name, ok: true });
      } catch (err) {
        results.push({ suite, name, ok: false, detail: err instanceof Error ? err.message : String(err) });
      }
    },
    async testAsync(name: string, fn: () => Promise<void>) {
      try {
        await fn();
        results.push({ suite, name, ok: true });
      } catch (err) {
        results.push({ suite, name, ok: false, detail: err instanceof Error ? err.message : String(err) });
      }
    },
    results,
  };
}

export function summarize(results: TestResult[]): { passed: number; failed: number; failures: TestResult[] } {
  const failures = results.filter((r) => !r.ok);
  return { passed: results.length - failures.length, failed: failures.length, failures };
}
