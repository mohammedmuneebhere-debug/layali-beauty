'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, role')
        .eq('id', authData.user.id)
        .single();

      if (profile?.role === 'admin') {
        router.push('/admin');
      } else if (!profile?.onboarding_completed) {
        router.push('/survey');
      } else if (redirectTo.startsWith('/')) {
        router.push(redirectTo);
      } else {
        router.push('/shop');
      }
    }

    setLoading(false);
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
            <h1 className="font-serif text-heading-lg font-semibold tracking-[0.16em] text-white">LAYALI</h1>
          </Link>
          <p className="font-serif text-heading-sm text-layali-pink mt-2">welcome back</p>
        </div>

        <div className="glass-panel rounded-3xl p-8">
          <h2 className="font-serif text-heading-md font-medium text-white mb-6 text-center">Sign In</h2>

          {redirectTo === '/checkout' && (
            <div className="mb-4 p-3 rounded-xl bg-layali-pink/10 border border-layali-pink/25 text-layali-pink-light text-sm text-center">
              Sign in to complete your order
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />

            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-white/45 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-layali-pink font-medium hover:text-layali-pink-light">
              Sign Up
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <Link href="/auth/admin/signin" className="text-xs text-white/30 hover:text-white/50">
              Admin Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <SignInForm />
    </Suspense>
  );
}
