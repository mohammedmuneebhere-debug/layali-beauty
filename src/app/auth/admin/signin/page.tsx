'use client';

import { useState } from 'react';
import Link from 'next/link';
import { navigateAfterAuth } from '@/lib/auth/navigate-after-auth';
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

export default function AdminSignInPage() {
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
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profile?.role !== 'admin') {
        setError('Access denied. Admin credentials required.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      await supabase.auth.getSession();
      navigateAfterAuth('/admin');
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-layali-black flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-brand-lg text-white">LAYALI</h1>
          <p className="text-layali-pink text-sm uppercase tracking-[0.2em] mt-2">ADMIN PORTAL</p>
        </div>

        <div className="bg-layali-black-soft rounded-3xl p-8 shadow-xl border border-layali-pink/20">
          <h2 className="font-serif text-2xl text-white mb-6 text-center">Admin Sign In</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 text-red-300 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              {...register('password')}
              error={errors.password?.message}
            />

            <Button type="submit" variant="gold" className="w-full" loading={loading}>
              Sign In to Admin
            </Button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            <Link href="/auth/signin" className="hover:text-white/60">
              Back to User Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
