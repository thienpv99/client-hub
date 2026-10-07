// The one sign-in flow of /login (no Khách hàng / Nội bộ split): "Đăng nhập bằng Google" for New Era staff on top,
// then identifier-first email. Email @SSO_ALLOWED_DOMAIN → password (api.loginWithPassword); any other address →
// one-time code (api.requestOtp → api.verifyOtp, SPEC §8; the demo shows the code). "Ghi nhớ thiết bị này" is visible
// in every step and applies to every way in, Google included. Success changes the viewer; LoginPage then redirects
// (?next= or the role's home).
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastInfo } from '@/lib/toast';
import { cleanOtp, isStaffEmail, isValidEmail } from './authUtils';
import { FormError } from './FormError';
import { GoogleSignIn } from './GoogleSignIn';

type Step = 'email' | 'password' | 'code';

/** wait between two codes sent to the same address */
const RESEND_COOLDOWN_MS = 30000;

/** the address of the step, with the way back to the email step */
function EmailChip({ email, disabled, onChange }: { email: string; disabled: boolean; onChange: () => void }) {
  return (
    <div className="flex min-h-tap items-center gap-2.5 rounded-lg bg-subtle pl-3 pr-1 ring-1 ring-inset ring-border/60">
      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-table font-medium text-foreground" title={email}>
        {email}
      </span>
      <Button type="button" variant="link" size="sm" className="shrink-0 px-2" disabled={disabled} onClick={onChange}>
        {t('auth.changeEmail')}
      </Button>
    </div>
  );
}

export function SignInForm({ className }: { className?: string }) {
  const ids = useId();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  // shared by every way in: the Google sign-in honours it too
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [resendReadyAt, setResendReadyAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  /** one request at a time (a second Enter before the re-render must not send twice) */
  const inFlight = useRef(false);
  /** focus the new step's field — only after a step change, never on the first render (no keyboard pop-up on phones) */
  const focusStep = useRef(false);
  /** after a refused attempt: bring the keyboard back to the field (and select a refused password / code) */
  const focusError = useRef<{ select: boolean } | null>(null);
  const lastAutoSubmit = useRef<string | null>(null);

  const address = email.trim();

  function fieldOf(s: Step): HTMLInputElement | null {
    return s === 'email' ? emailRef.current : s === 'password' ? passwordRef.current : codeRef.current;
  }

  useEffect(() => {
    if (!focusStep.current) return;
    focusStep.current = false;
    fieldOf(step)?.focus();
  }, [step]);

  // A clicked (or Tab + Enter) "Tiếp tục" / "Đăng nhập" / "Xác nhận" is disabled while it works, which drops the focus to
  // the page: put it back in the field once the error shows, so the next keystroke fixes the value. A refused password
  // or code is selected, so typing replaces it.
  useEffect(() => {
    const req = focusError.current;
    if (!error || !req) return;
    focusError.current = null;
    const field = fieldOf(step);
    if (!field) return;
    if (document.activeElement !== field) field.focus();
    if (req.select) field.select();
  }, [error, step]);

  /** shows a refused attempt under the field (FormError is role="alert") */
  function fail(message: string, select = false) {
    focusError.current = { select };
    setError(message);
  }

  // "Gửi lại mã sau N giây" countdown (code step only)
  useEffect(() => {
    if (step !== 'code' || resendReadyAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= resendReadyAt) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [step, resendReadyAt]);
  const resendIn = step === 'code' ? Math.max(0, Math.ceil((resendReadyAt - now) / 1000)) : 0;

  function goTo(next: Step, message: string) {
    focusStep.current = true;
    setError(null);
    setStep(next);
    setAnnouncement(message);
  }

  function startCooldown() {
    const n = Date.now();
    setNow(n);
    setResendReadyAt(n + RESEND_COOLDOWN_MS);
  }

  /** "Đổi email" / Escape: back to the email step, the typed address kept */
  function backToEmail() {
    if (inFlight.current) return;
    setPassword('');
    setShowPassword(false);
    setCode('');
    lastAutoSubmit.current = null;
    goTo('email', t('auth.announce.email'));
  }

  async function submitEmail() {
    if (!address) return fail(t('auth.errors.emailRequired'));
    if (!isValidEmail(address)) return fail(t('auth.errors.emailInvalid'));
    if (isStaffEmail(address)) {
      goTo('password', t('auth.announce.password', { email: address }));
      return;
    }
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      const res = await api.requestOtp(address);
      setDemoCode(res.demo_code);
      setCode('');
      lastAutoSubmit.current = null;
      startCooldown();
      goTo('code', t('auth.announce.code', { email: address }));
    } catch (err) {
      fail(errorMessage(err));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function submitPassword() {
    if (!password) return fail(t('auth.errors.passwordRequired'));
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      await api.loginWithPassword(address, password, remember);
    } catch (err) {
      fail(errorMessage(err), true);
      setPending(false);
      inFlight.current = false;
    }
  }

  async function verify(value: string) {
    if (inFlight.current) return;
    if (!value) return fail(t('auth.errors.codeRequired'));
    if (value.length !== 6) return fail(t('auth.otp.invalidLength'));
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      await api.verifyOtp(address, value, remember);
    } catch (err) {
      fail(errorMessage(err), true);
      setPending(false);
      inFlight.current = false;
    }
  }

  async function resend() {
    if (inFlight.current || resendIn > 0) return;
    inFlight.current = true;
    setError(null);
    setResending(true);
    try {
      const res = await api.requestOtp(address);
      setDemoCode(res.demo_code);
      setCode('');
      lastAutoSubmit.current = null;
      startCooldown();
      toastInfo(t('auth.otp.resent'));
      // the resend button is disabled now: keep the keyboard in the code field
      codeRef.current?.focus();
    } catch (err) {
      fail(errorMessage(err));
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  }

  function onCodeChange(raw: string) {
    const next = cleanOtp(raw);
    setCode(next);
    if (error) setError(null);
    // a full code (typed, pasted, or filled by the phone) signs in at once
    if (next.length === 6 && !inFlight.current && lastAutoSubmit.current !== next) {
      lastAutoSubmit.current = next;
      void verify(next);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    if (step === 'email') void submitEmail();
    else if (step === 'password') void submitPassword();
    else void verify(code);
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape' && step !== 'email' && !inFlight.current) {
      e.preventDefault();
      backToEmail();
    }
  }

  const errorId = `${ids}-error`;
  const fieldError = {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  } as const;

  const rememberRow = (
    <div className="flex items-start gap-3">
      <Checkbox
        id={`${ids}-remember`}
        checked={remember}
        onCheckedChange={(v) => setRemember(v === true)}
        className="mt-0.5"
      />
      {/* the whole text block is the label: a ≥44px tap target on phones (SPEC §7), not only the 20px title line */}
      <Label htmlFor={`${ids}-remember`} className="grid min-h-tap flex-1 cursor-pointer content-start gap-0.5 md:min-h-0">
        <span>{t('auth.remember')}</span>
        <span className="text-caption font-normal">{t('auth.rememberHint')}</span>
      </Label>
    </div>
  );

  return (
    <div className={className}>
      {/* identifier-first: Google belongs to the first step; kept mounted so the drawn button survives "Đổi email" */}
      <div hidden={step !== 'email'}>
        <GoogleSignIn remember={remember} className="mb-5" />
      </div>

      <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="space-y-5">
        {step === 'email' ? (
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-email`}>{t('auth.email')}</Label>
            <Input
              ref={emailRef}
              id={`${ids}-email`}
              name="username"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              {...fieldError}
            />
            <FormError id={errorId} message={error} />
          </div>
        ) : (
          <EmailChip email={address} disabled={pending || resending} onChange={backToEmail} />
        )}

        {step === 'password' ? (
          <div className="grid gap-2">
            {/* for password managers: the account this password belongs to (the visible field left with step 1) */}
            <input type="email" name="username" autoComplete="username" value={address} readOnly hidden tabIndex={-1} aria-hidden />
            <Label htmlFor={`${ids}-password`}>{t('auth.password')}</Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id={`${ids}-password`}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="pr-12 md:pr-11"
                {...fieldError}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-0 top-1/2 -translate-y-1/2 md:right-1"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-controls={`${ids}-password`}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </Button>
            </div>
            <FormError id={errorId} message={error} />
          </div>
        ) : null}

        {step === 'code' ? (
          <>
            {demoCode ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary-border/70 bg-primary-soft py-1 pl-3 pr-2 text-table text-primary">
                <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 py-1.5 tabular">{t('auth.otp.demoHint', { code: demoCode })}</span>
                <Button type="button" variant="link" size="sm" className="shrink-0 px-1" onClick={() => onCodeChange(demoCode)}>
                  {t('auth.otp.fillCode')}
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor={`${ids}-code`}>{t('auth.otp.code')}</Label>
              <p id={`${ids}-code-hint`} className="-mt-1 text-caption">
                {t('auth.otp.sentTo')}
              </p>
              {/* no maxLength: a pasted "246 810" or "Mã: 246810" is cleaned to its 6 digits. The indent balances the
                  letter-spacing after the last digit, so the code sits centred. */}
              <Input
                ref={codeRef}
                id={`${ids}-code`}
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                placeholder={t('auth.otp.codePlaceholder')}
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                className="h-14 text-center indent-[0.5em] text-display font-semibold tracking-[0.5em] tabular md:h-14 md:text-display"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${ids}-code-hint ${errorId}` : `${ids}-code-hint`}
              />
              <FormError id={errorId} message={error} />
            </div>
          </>
        ) : null}

        {rememberRow}

        <Button type="submit" className="w-full" loading={pending}>
          {step === 'email'
            ? pending
              ? t('auth.otp.requesting')
              : t('auth.continue')
            : step === 'password'
              ? pending
                ? t('auth.submitting')
                : t('auth.submit')
              : pending
                ? t('auth.otp.verifying')
                : t('auth.otp.verify')}
        </Button>

        {step === 'password' ? <p className="text-center text-caption">{t('auth.internalHint')}</p> : null}

        {step === 'code' ? (
          <div className="text-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="tabular"
              disabled={pending || resending || resendIn > 0}
              loading={resending}
              onClick={() => void resend()}
            >
              {resendIn > 0 ? t('auth.otp.resendIn', { seconds: resendIn }) : t('auth.otp.resend')}
            </Button>
          </div>
        ) : null}
      </form>

      {/* step changes for screen readers (errors announce themselves: FormError is role="alert") */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
