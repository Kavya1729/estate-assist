import { useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/features/staff/api';
import { saveStaffSession, staffSessionEndReason, useStaffSession } from '@/features/staff/session';

const FIELD_OF = { 'body.email': 'email', 'body.password': 'password' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const session = useStaffSession();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expired] = useState(() => staffSessionEndReason() === 'expired');

  if (session) {
    const from = location.state?.from;
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/staff/leads'} replace />;
  }

  function validate() {
    const found = {};
    if (!EMAIL.test(email.trim())) found.email = 'Enter your work email address.';
    if (!password) found.password = 'Enter your password.';
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const { token, user } = await login({ email: email.trim(), password });
      saveStaffSession({ token, user });
    } catch (err) {
      const fieldErrors = Object.fromEntries(
        (err.details ?? [])
          .filter((d) => FIELD_OF[d.field])
          .map((d) => [FIELD_OF[d.field], d.message]),
      );
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setFormError(err.message);
      setSubmitting(false);
    }
  }

  const clearError = (field) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="font-serif text-2xl tracking-tight">
            Estate Assist
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Sales console for the sales team</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the work email your sales head set up for you.
          </p>

          {expired && !formError && (
            <p role="status" className="mt-5 rounded-md bg-accent px-3 py-2 text-sm">
              Your session has ended. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Work email</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                }}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'staff-email-error' : undefined}
                className="h-11"
              />
              {errors.email && (
                <p id="staff-email-error" className="text-xs text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-password">Password</Label>
              <div className="relative">
                <Input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError('password');
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'staff-password-error' : undefined}
                  className="h-11 pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {errors.password && (
                <p id="staff-password-error" className="text-xs text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <LogIn /> Sign in
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Looking for a home?{' '}
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            Go to the buyer site
          </Link>
        </p>
      </div>
    </div>
  );
}
