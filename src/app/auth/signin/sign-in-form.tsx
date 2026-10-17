'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { navigateAfterAuth, safeAuthRedirect } from '@/lib/auth/navigate-after-auth';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

function SignInFormBody({
  customerAccountsEnabled,
  shopifyConnected,
}: {
  customerAccountsEnabled: boolean;
  shopifyConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const shopifyError = searchParams.get('shopify_error');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(shopifyConnected);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!customerAccountsEnabled) return;
    let cancelled = false;
    void fetch('/api/customer-account/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { signedIn?: boolean };
      })
      .then((body) => {
        if (!cancelled && body && typeof body.signedIn === 'boolean') setConnected(body.signedIn);
      })
      .catch(() => {
        // The password form stays available when the Shopify session check fails.
      });
    return () => {
      cancelled = true;
    };
  }, [customerAccountsEnabled]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, role')
        .eq('id', authData.user.id)
        .single();

      if (profile?.role === 'admin') {
        navigateAfterAuth('/admin');
        return;
      }
      if (profile?.onboarding_completed === false) {
        navigateAfterAuth('/survey');
        return;
      }
      navigateAfterAuth(safeAuthRedirect(redirectTo, '/shop'));
      return;
    }

    setLoading(false);
  };

  const shopifyNotice =
    shopifyError === 'cancelled'
      ? 'Shopify sign-in was cancelled. Email sign-in is still available.'
      : shopifyError === 'failed'
        ? 'Shopify sign-in could not be completed. Email sign-in is still available.'
        : '';

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
          <h2 className="font-serif text-heading-md text-white mb-6 text-center">Sign In</h2>

          {redirectTo === '/checkout' && (
            <div className="mb-4 p-3 rounded-xl bg-layali-pink/10 border border-layali-pink/25 text-layali-pink-light text-sm text-center">
              Sign in to complete your order
            </div>
          )}

          {shopifyNotice && (
            <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm">{shopifyNotice}</div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" {...register('email')} autoComplete="email" error={errors.email?.message} />
            <Input label="Password" type="password" {...register('password')} autoComplete="current-password" error={errors.password?.message} />

            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>

          {customerAccountsEnabled && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>
              {connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-center text-white/70">
                    Shopify account connected. Checkout, saved addresses, and order history still use your Layali password until that migration is finished.
                  </p>
                  <form method="post" action="/api/customer-account/logout">
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/8 px-6 py-3 text-sm font-medium uppercase tracking-[0.1em] text-white hover:border-layali-pink/40"
                    >
                      Sign out of Shopify
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <a
                    href="/api/customer-account/start"
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/8 px-6 py-3 text-sm font-medium uppercase tracking-[0.1em] text-white hover:border-layali-pink/40"
                  >
                    Continue with Shopify
                  </a>
                  <p className="text-xs text-center text-white/40">
                    Shopify sign-in does not yet open checkout or your orders. Use email and password for those.
                  </p>
                </>
              )}
            </div>
          )}

          <p className="text-center text-sm text-white/45 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-layali-pink font-medium hover:text-layali-pink-light">
              Sign Up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInForm(props: {
  customerAccountsEnabled: boolean;
  shopifyConnected: boolean;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignInFormBody {...props} />
    </Suspense>
  );
}
