'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can request a new code.',
  expired: 'That sign-in session expired. Request a new code.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again later.',
};

function SignInFormBody({
  title = 'Sign In',
  subtitle = 'We email you a one-time code. There is no password.',
  nextPath,
}: {
  title?: string;
  subtitle?: string;
  nextPath?: string;
}) {
  const searchParams = useSearchParams();
  const redirectTo = nextPath || searchParams.get('redirect') || '';
  const shopifyError = searchParams.get('shopify_error') || '';
  const [loading, setLoading] = useState(false);
  const error = ERRORS[shopifyError] || '';

  const start = () => {
    setLoading(true);
    const url = new URL('/api/customer-account/start', window.location.origin);
    if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      url.searchParams.set('return', redirectTo);
    }
    window.location.assign(url.toString());
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
            Email me a sign-in code
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

export function SignUpForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignInFormBody
        title="Create your account"
        subtitle="Enter your email on the next screen. Shopify sends a verification code. No password is stored here."
      />
    </Suspense>
  );
}
