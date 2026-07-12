'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function SignInPage() {
  const router = useRouter();
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
      } else {
        router.push('/shop');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen gradient-pink flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="font-serif text-4xl font-bold tracking-widest text-layali-black">LAYALI</h1>
          </Link>
          <p className="font-script text-2xl text-layali-black/70 mt-2">welcome back</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-layali-pink/20">
          <h2 className="font-serif text-2xl font-bold text-layali-black mb-6 text-center">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />

            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-layali-black/60 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-layali-pink-dark font-medium hover:underline">
              Sign Up
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-layali-pink/20 text-center">
            <Link href="/auth/admin/signin" className="text-xs text-layali-black/40 hover:text-layali-black/60">
              Admin Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
