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

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  gender: z.enum(['female', 'male'], { message: 'Please select your gender' }),
  country: z.string().min(1, 'Please select your country'),
  city: z.string().min(1, 'Please select your city'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
});

type FormData = z.infer<typeof schema>;
type Step = 'details' | 'otp';

export default function SignUpPage() {
  const router = useRouter();
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
          gender: data.gender,
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

    // Email confirmation disabled — session already active
    if (authData.session) {
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        gender: data.gender,
        country: data.country,
        city: data.city,
        phone: data.phone,
        role: 'user',
      });
      router.push('/survey');
      setLoading(false);
      return;
    }

    // Confirmation required — show OTP step
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

    // Prefer signup type; fall back to email for newer Supabase OTP templates
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
      await supabase.from('profiles').upsert({
        id: user.id,
        email: pendingData.email,
        full_name: pendingData.full_name,
        gender: pendingData.gender,
        country: pendingData.country,
        city: pendingData.city,
        phone: pendingData.phone,
        role: 'user',
      });
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
          <p className="font-script text-2xl text-layali-black/70 mt-2">
            {step === 'otp' ? 'verify email' : 'join us'}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-layali-pink/20">
          {step === 'details' ? (
            <>
              <h2 className="font-serif text-2xl font-bold text-layali-black mb-6 text-center">Create Account</h2>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
              )}

              {Object.keys(errors).length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm">
                  Please fill in all required fields correctly.
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmitDetails, () => setError(''))} className="space-y-4">
                <Input label="Full Name" {...register('full_name')} error={errors.full_name?.message} />
                <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
                <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
                <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />

                <Select
                  label="Gender"
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                  ]}
                  placeholder="Select gender"
                  {...register('gender')}
                  error={errors.gender?.message}
                />

                <Select
                  label="Country"
                  options={COUNTRIES}
                  placeholder="Select country"
                  {...register('country', {
                    onChange: (e) => {
                      setSelectedCountry(e.target.value);
                      setValue('city', '');
                    },
                  })}
                  error={errors.country?.message}
                />

                <Select
                  label="City"
                  options={CITIES[country || selectedCountry] || []}
                  placeholder="Select city"
                  {...register('city')}
                  error={errors.city?.message}
                  disabled={!country && !selectedCountry}
                />

                <Button type="submit" className="w-full" loading={loading}>
                  Continue
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-serif text-2xl font-bold text-layali-black mb-2 text-center">Enter OTP</h2>
              <p className="text-sm text-layali-black/60 text-center mb-6">
                We sent a 6-digit code to <strong>{pendingData?.email}</strong>
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
              )}

              <form onSubmit={verifyOtp} className="space-y-4">
                <Input
                  label="Verification Code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-[0.4em] font-semibold"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  Verify & Continue
                </Button>
              </form>

              <div className="mt-4 flex flex-col items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="text-layali-pink-dark font-medium hover:underline"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setOtp('');
                    setError('');
                  }}
                  className="text-layali-black/50 hover:text-layali-black"
                >
                  Back to details
                </button>
              </div>
            </>
          )}

          {step === 'details' && (
            <p className="text-center text-sm text-layali-black/60 mt-6">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-layali-pink-dark font-medium hover:underline">
                Sign In
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
