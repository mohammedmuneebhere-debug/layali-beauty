'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Package, LogOut, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import type { Profile } from '@/types/database';

export default function AccountPage() {
  const router = useRouter();
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
      <div className="min-h-screen bg-layali-cream flex items-center justify-center">
        <div className="animate-pulse text-layali-pink">Loading...</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-2xl mx-auto px-4">
        <FadeIn>
          <h1 className="font-serif text-4xl font-bold text-layali-black mb-8">My Account</h1>

          <div className="bg-white rounded-2xl p-6 border border-layali-pink/20 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-layali-pink-light flex items-center justify-center">
                <User className="w-8 h-8 text-layali-black" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-layali-black">{profile.full_name}</h2>
                <p className="text-layali-black/60 text-sm">{profile.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-layali-black/50">Gender</p>
                <p className="font-medium capitalize">{profile.gender || '—'}</p>
              </div>
              <div>
                <p className="text-layali-black/50">Location</p>
                <p className="font-medium">{profile.city}, {profile.country}</p>
              </div>
              <div>
                <p className="text-layali-black/50">Phone</p>
                <p className="font-medium">{profile.phone || '—'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/account/orders">
              <div className="bg-white rounded-2xl p-4 border border-layali-pink/20 flex items-center gap-4 card-hover">
                <Package className="w-6 h-6 text-layali-pink-dark" />
                <div>
                  <p className="font-medium text-layali-black">My Orders</p>
                  <p className="text-sm text-layali-black/50">Track and view your orders</p>
                </div>
              </div>
            </Link>

            <Link href="/survey">
              <div className="bg-white rounded-2xl p-4 border border-layali-pink/20 flex items-center gap-4 card-hover">
                <Sparkles className="w-6 h-6 text-layali-gold" />
                <div>
                  <p className="font-medium text-layali-black">Beauty Profile</p>
                  <p className="text-sm text-layali-black/50">View your personalized recommendations</p>
                </div>
              </div>
            </Link>
          </div>

          <Button variant="ghost" className="mt-8" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
