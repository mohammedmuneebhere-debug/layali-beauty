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
import { Select } from '@/components/ui/Select';
import { createClient } from '@/lib/supabase/client';
import { COUNTRIES, CITIES } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  country: z.string().min(1, 'Please select your country'),
  city: z.string().min(1, 'Please select your city'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
});

type FormData = z.infer<typeof schema>;
type Step = 'details' | 'otp';

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('details');
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const country = watch('country');

  const upsertProfile = async (
    userId: string,
    data: FormData
  ) => {
    const supabase = createClient();
    await supabase.from('profiles').upsert({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      gender: 'female',
      country: data.country,
      city: data.city,
      phone: data.phone,
      role: 'user',
    });
  };

  const onSubmitDetails = async (data: FormData) => {
    setLoading(true);
    setError('');

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          role: 'user',
          gender: 'female',
          country: data.country,
          city: data.city,
          phone: data.phone,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError('Account could not be created. Please try again.');
      setLoading(false);
      return;
    }

    if (authData.session) {
      await upsertProfile(authData.user.id, data);
      router.push('/survey');
      setLoading(false);
      return;
    }

    setPendingData(data);
    setStep('otp');
    setLoading(false);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingData) return;

    const code = otp.trim();
    if (code.length < 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    setError('');
    const supabase = createClient();

    let verifyError = (
      await supabase.auth.verifyOtp({
        email: pendingData.email,
        token: code,
        type: 'signup',
      })
    ).error;

    if (verifyError) {
      verifyError = (
        await supabase.auth.verifyOtp({
          email: pendingData.email,
          token: code,
          type: 'email',
        })
      ).error;
    }

    if (verifyError) {
      setError(verifyError.message || 'Invalid or expired code. Please try again.');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await upsertProfile(user.id, pendingData);
    }

    router.push('/survey');
    setLoading(false);
  };

  const resendOtp = async () => {
    if (!pendingData) return;
    setLoading(true);
    setError('');
    const supabase = createClient();

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: pendingData.email,
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setError('');
      alert('A new code has been sent to your email.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>
          <Link href="/">
            <h1 className="text-brand-lg text-white">LAYALI</h1>
          </Link>
          <p className="font-script text-heading-sm text-white/70 mt-2">
            {step === 'otp' ? t.signup.verify : t.signup.join}
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-8 shadow-xl border border-layali-pink/20">
          {step === 'details' ? (
            <>
              <h2 className="font-serif text-heading-md text-white mb-6 text-center">
                {t.signup.create}
              </h2>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</div>
              )}

              {Object.keys(errors).length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
                  {t.signup.fillRequired}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmitDetails, () => setError(''))} className="space-y-4">
                <Input label={t.signup.fullName} {...register('full_name')} autoComplete="name" error={errors.full_name?.message} />
                <Input label={t.signup.email} type="email" {...register('email')} autoComplete="email" error={errors.email?.message} />
                <Input label={t.signup.password} type="password" {...register('password')} autoComplete="new-password" error={errors.password?.message} />
                <Input label={t.signup.phone} type="tel" {...register('phone')} autoComplete="tel" error={errors.phone?.message} />

                <Select
                  label={t.signup.country}
                  options={COUNTRIES}
                  placeholder={t.signup.selectCountry}
                  {...register('country', {
                    onChange: (e) => {
                      setSelectedCountry(e.target.value);
                      setValue('city', '');
                    },
                  })}
                  autoComplete="country-name"
                  error={errors.country?.message}
                />

                <Select
                  label={t.signup.city}
                  options={CITIES[country || selectedCountry] || []}
                  placeholder={t.signup.selectCity}
                  {...register('city')}
                  autoComplete="address-level2"
                  error={errors.city?.message}
                  disabled={!country && !selectedCountry}
                />

                <Button type="submit" className="w-full" loading={loading}>
                  {t.signup.continue}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-serif text-heading-md text-white mb-2 text-center">
                {t.signup.otpTitle}
              </h2>
              <p className="text-body text-white/60 text-center mb-6">
                {t.signup.otpBody} <strong>{pendingData?.email}</strong>
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
              )}

              <form onSubmit={verifyOtp} className="space-y-4">
                <Input
                  label={t.signup.code}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-[0.4em] font-semibold"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  {t.signup.verifyContinue}
                </Button>
              </form>

              <div className="mt-4 flex flex-col items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="text-layali-pink font-medium hover:underline"
                >
                  {t.signup.resend}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setOtp('');
                    setError('');
                  }}
                  className="text-white/50 hover:text-white"
                >
                  {t.signup.back}
                </button>
              </div>
            </>
          )}

          {step === 'details' && (
            <p className="text-center text-sm text-white/60 mt-6">
              {t.signup.haveAccount}{' '}
              <Link href="/auth/signin" className="text-layali-pink font-medium hover:underline">
                {t.signup.signIn}
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
