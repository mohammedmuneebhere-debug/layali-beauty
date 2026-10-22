'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { customerAccountStartUrl, isCustomerAccountSignupStartPath } from '@/lib/auth/customer-account-start';
import { normalizeSignupDraft, type SignupFieldErrors } from '@/lib/auth/signup-fields';
import { Input } from '@/components/ui/Input';

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can request a new code.',
  expired: 'That sign-in session expired. Request a new code.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again later.',
};

function SignInFormBody({
  title = 'Sign In',
  subtitle = 'We email you a one-time code. There is no password.',
  nextPath,
  actionLabel = 'Email me a sign-in code',
}: {
  title?: string;
  subtitle?: string;
  nextPath?: string;
  actionLabel?: string;
}) {
  const searchParams = useSearchParams();
  const redirectTo = nextPath || searchParams.get('redirect') || '';
  const shopifyError = searchParams.get('shopify_error') || '';
  const [loading, setLoading] = useState(false);
  const error = ERRORS[shopifyError] || '';

  const start = () => {
    setLoading(true);
    window.location.assign(customerAccountStartUrl(window.location.origin, redirectTo));
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-brand-lg text-white">LAYALI</h1>
          </Link>
          <p className="font-script text-heading-sm text-layali-pink mt-2">welcome back</p>
        </div>

        <div className="glass-panel rounded-3xl p-8">
          <h2 className="font-serif text-heading-md text-white mb-3 text-center">{title}</h2>
          <p className="text-sm text-white/60 text-center mb-6">{subtitle}</p>

          {redirectTo === '/checkout' && (
            <div className="mb-4 p-3 rounded-xl bg-layali-pink/10 border border-layali-pink/25 text-layali-pink-light text-sm text-center">
              Sign in to complete your order
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</div>
          )}

          <Button type="button" className="w-full" loading={loading} onClick={start}>
            {actionLabel}
          </Button>

          <p className="text-center text-sm text-white/45 mt-6">
            New to Layali? Shopify creates your account when you verify the code.{' '}
            <Link href="/auth/signup" className="text-layali-pink font-medium hover:text-layali-pink-light">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignInFormBody />
    </Suspense>
  );
}

export function StaffSignInForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignInFormBody
        title="Staff sign in"
        subtitle="Use the staff email on the Layali allowlist. A customer account does not open admin."
        nextPath="/admin"
      />
    </Suspense>
  );
}

function SignUpFormBody() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const parsed = normalizeSignupDraft({ fullName, phone, email });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const response = await fetch('/api/customer-account/signup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fullName, phone, email, returnTo: redirectTo }),
      });
      const json = (await response.json().catch(() => null)) as {
        nextPath?: string;
        error?: string;
        errors?: SignupFieldErrors;
      } | null;
      if (response.status === 400 && json?.errors) {
        setErrors(json.errors);
        setLoading(false);
        return;
      }
      if (!response.ok || !isCustomerAccountSignupStartPath(json?.nextPath)) {
        setFormError('Sign-up is temporarily unavailable. Please try again.');
        setLoading(false);
        return;
      }
      window.location.assign(json.nextPath);
    } catch {
      setFormError('Sign-up is temporarily unavailable. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-brand-lg text-white">LAYALI</h1>
          </Link>
          <p className="font-script text-heading-sm text-layali-pink mt-2">welcome</p>
        </div>

        <div className="glass-panel rounded-3xl p-8">
          <h2 className="font-serif text-heading-md text-white mb-3 text-center">Create your account</h2>
          <p className="text-sm text-white/60 text-center mb-6">
            Shopify emails a verification code to this address. No password is stored here.
          </p>

          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{formError}</div>
          )}

          <form className="space-y-4" onSubmit={submit} noValidate>
            <Input
              id="signup-name"
              name="fullName"
              label="Full name"
              autoComplete="name"
              value={fullName}
              error={errors.fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setErrors((current) => ({ ...current, fullName: undefined }));
              }}
            />
            <Input
              id="signup-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              label="Phone number"
              autoComplete="tel"
              placeholder="5X XXX XXXX"
              value={phone}
              error={errors.phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setErrors((current) => ({ ...current, phone: undefined }));
              }}
            />
            <Input
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              label="Email address"
              autoComplete="email"
              value={email}
              error={errors.email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Create account with email
            </Button>
          </form>

          <p className="text-center text-sm text-white/45 mt-6">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-layali-pink font-medium hover:text-layali-pink-light">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function SignUpForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignUpFormBody />
    </Suspense>
  );
}
