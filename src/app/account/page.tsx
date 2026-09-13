'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Package, LogOut, Sparkles, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { Profile } from '@/types/database';

export default function AccountPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    load();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-20">
        <div className="animate-pulse text-layali-pink">{t.account.loading}</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        <FadeIn>
          <h1 className="font-serif text-heading-lg text-white mb-8">{t.account.title}</h1>

          <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/25 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-layali-pink-glow/25 border border-layali-pink/40 flex items-center justify-center">
                <User className="w-8 h-8 text-layali-pink-light" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">{profile.full_name}</h2>
                <p className="text-white/60 text-sm">{profile.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/50">{t.account.location}</p>
                <p className="font-medium text-white">
                  {profile.city}, {profile.country}
                </p>
              </div>
              <div>
                <p className="text-white/50">{t.account.phone}</p>
                <p className="font-medium text-white">{profile.phone || '—'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/account/orders">
              <div className="bg-layali-surface rounded-2xl p-4 border border-layali-pink/25 flex items-center gap-4 card-hover">
                <Package className="w-6 h-6 text-layali-pink" />
                <div>
                  <p className="font-medium text-white">{t.account.myOrders}</p>
                  <p className="text-sm text-white/50">{t.account.myOrdersHint}</p>
                </div>
              </div>
            </Link>

            <Link href="/account/addresses">
              <div className="bg-layali-surface rounded-2xl p-4 border border-layali-pink/25 flex items-center gap-4 card-hover">
                <MapPin className="w-6 h-6 text-layali-pink" />
                <div>
                  <p className="font-medium text-white">{t.account.addresses}</p>
                  <p className="text-sm text-white/50">{t.account.addressesHint}</p>
                </div>
              </div>
            </Link>

            <Link href="/survey">
              <div className="bg-layali-surface rounded-2xl p-4 border border-layali-pink/25 flex items-center gap-4 card-hover">
                <Sparkles className="w-6 h-6 text-layali-pink-light" />
                <div>
                  <p className="font-medium text-white">{t.account.beautyProfile}</p>
                  <p className="text-sm text-white/50">{t.account.beautyProfileHint}</p>
                </div>
              </div>
            </Link>
          </div>

          <Button variant="ghost" className="mt-8" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" /> {t.account.signOut}
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
