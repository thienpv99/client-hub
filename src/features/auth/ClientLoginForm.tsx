// Client login: email → one-time code (no password, SPEC §8). The demo shows the code on screen.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { KeyRound, MailCheck } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastInfo } from '@/lib/toast';
import { cleanOtp, isValidEmail } from './authUtils';
import { FormError } from './FormError';

type Step = 'email' | 'code';

export function ClientLoginForm() {
  const ids = useId();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const lastAutoSubmit = useRef<string | null>(null);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function sendCode(isResend: boolean) {
    const trimmed = email.trim();
    if (!trimmed) return setError(t('auth.errors.emailRequired'));
    if (!isValidEmail(trimmed)) return setError(t('auth.errors.emailInvalid'));
    setError(null);
    setPending(true);
    try {
      const res = await api.requestOtp(trimmed);
      setDemoCode(res.demo_code);
      setCode('');
      lastAutoSubmit.current = null;
      setStep('code');
      if (isResend) toastInfo(t('auth.otp.resent'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6) return setError(t('auth.otp.invalidLength'));
    setError(null);
    setPending(true);
    try {
      // success changes the viewer; LoginPage then redirects
      await api.verifyOtp(email.trim(), value, remember);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  function onCodeChange(raw: string) {
    const next = cleanOtp(raw);
    setCode(next);
    if (error) setError(null);
    if (next.length === 6 && !pending && lastAutoSubmit.current !== next) {
      lastAutoSubmit.current = next;
      void verify(next);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (step === 'email') void sendCode(false);
    else void verify(code);
  }

  const errorId = `${ids}-error`;
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

  if (step === 'email') {
    return (
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <p className="text-table text-muted-foreground">{t('auth.otp.intro')}</p>
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-email`}>{t('auth.email')}</Label>
          <Input
            id={`${ids}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {rememberRow}
        <FormError id={errorId} message={error} />
        <Button type="submit" className="w-full shadow-btn" loading={pending}>
          {pending ? t('auth.otp.requesting') : t('auth.otp.request')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
          <MailCheck className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-table text-foreground">{t('auth.otp.sentTo', { email: email.trim() })}</p>
          <button
            type="button"
            className="mt-0.5 text-table font-medium text-primary hover:underline"
            onClick={() => {
              setStep('email');
              setError(null);
              setCode('');
            }}
          >
            {t('auth.otp.changeEmail')}
          </button>
        </div>
      </div>

      {demoCode ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary-border/70 bg-primary-soft px-3 py-2.5 text-table text-primary">
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 tabular">{t('auth.otp.demoHint', { code: demoCode })}</span>
          <Button type="button" variant="link" size="sm" onClick={() => onCodeChange(demoCode)}>
            {t('auth.otp.fillCode')}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-code`}>{t('auth.otp.code')}</Label>
        <Input
          ref={codeRef}
          id={`${ids}-code`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder={t('auth.otp.codePlaceholder')}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular md:h-14"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {rememberRow}
      <FormError id={errorId} message={error} />
      <Button type="submit" className="w-full shadow-btn" loading={pending} disabled={code.length !== 6}>
        {pending ? t('auth.otp.verifying') : t('auth.otp.verify')}
      </Button>
      <div className="text-center">
        <Button type="button" variant="link" size="sm" disabled={pending} onClick={() => void sendCode(true)}>
          {t('auth.otp.resend')}
        </Button>
      </div>
    </form>
  );
}
