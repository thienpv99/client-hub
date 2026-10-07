// New Era staff login: email + password.
import { useId, useState, type FormEvent } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/hooks/useAction';
import { t } from '@/i18n';
import { isValidEmail } from './authUtils';
import { FormError } from './FormError';

export function InternalLoginForm() {
  const ids = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!trimmed) return setError(t('auth.errors.emailRequired'));
    if (!isValidEmail(trimmed)) return setError(t('auth.errors.emailInvalid'));
    if (!password) return setError(t('auth.errors.passwordRequired'));
    setError(null);
    setPending(true);
    try {
      // success changes the viewer; LoginPage then redirects
      await api.loginWithPassword(trimmed, password, remember);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const errorId = `${ids}-error`;
  const describedBy = error ? errorId : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-email`}>{t('auth.email')}</Label>
        <Input
          id={`${ids}-email`}
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder={t('auth.internalEmailPlaceholder')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-password`}>{t('auth.password')}</Label>
        <Input
          id={`${ids}-password`}
          type="password"
          autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id={`${ids}-remember`} checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        {/* the label row is the tap target on phones (≥44px) */}
        <Label htmlFor={`${ids}-remember`} className="flex min-h-tap flex-1 cursor-pointer items-center md:min-h-0">
          {t('auth.remember')}
        </Label>
      </div>
      <FormError id={errorId} message={error} />
      <Button type="submit" className="w-full shadow-btn" loading={pending}>
        {pending ? t('auth.submitting') : t('auth.submit')}
      </Button>
      <p className="text-center text-caption">{t('auth.internalHint')}</p>
    </form>
  );
}
