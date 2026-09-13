'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { AddressForm, addressDisplayLabel, addressDisplayLines, type AddressFormValues } from '@/components/address/AddressForm';
import { LocationMap } from '@/components/map/LocationMap';
import { FadeIn } from '@/components/ui/FadeIn';
import type { Address } from '@/types/database';

export default function AddressesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileCity, setProfileCity] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = async (uid: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAddresses((data as Address[]) || []);
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin?redirect=/account/addresses');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('city, country')
        .eq('id', user.id)
        .single();

      setProfileCity(profile?.city || '');
      setProfileCountry(profile?.country || '');
      await load(user.id);
      setFetching(false);
    }
    init();
  }, [router]);

  const saveAddress = async (values: AddressFormValues) => {
    if (!userId) return;
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from('addresses').insert({
      user_id: userId,
      label: values.label,
      custom_label: values.custom_label || null,
      receiver_name: values.receiver_name,
      receiver_phone: values.receiver_phone,
      address_line: values.address_line,
      city: values.city || profileCity,
      country: values.country || profileCountry,
      latitude: values.latitude,
      longitude: values.longitude,
      is_default: values.is_default || addresses.length === 0,
    });

    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }

    setShowForm(false);
    await load(userId);
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    const supabase = createClient();
    await supabase.from('addresses').delete().eq('id', id);
    if (userId) await load(userId);
  };

  const setDefault = async (id: string) => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    await load(userId);
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="animate-pulse text-layali-pink">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        <FadeIn>
          <Link href="/account" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>

          <div className="flex items-center justify-between mb-8">
            <h1 className="font-serif text-heading-lg text-white">Saved Addresses</h1>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            )}
          </div>

          {showForm && (
            <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20 mb-6">
              <h2 className="font-medium text-white mb-4">New Address</h2>
              <AddressForm
                defaultCity={profileCity}
                defaultCountry={profileCountry}
                loading={loading}
                onCancel={() => setShowForm(false)}
                onSubmit={saveAddress}
              />
            </div>
          )}

          <div className="space-y-4">
            {addresses.length === 0 && !showForm ? (
              <div className="text-center py-16 bg-layali-surface rounded-2xl border border-layali-pink/20">
                <MapPin className="w-10 h-10 mx-auto text-layali-pink mb-3" />
                <p className="text-white/60 mb-4">No saved addresses yet</p>
                <Button onClick={() => setShowForm(true)}>Add your first address</Button>
              </div>
            ) : (
              addresses.map((address) => (
                <div key={address.id} className="bg-layali-surface rounded-2xl p-5 border border-layali-pink/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-layali-pink mb-1">
                        {addressDisplayLabel(address)}
                        {address.is_default && ' · Default'}
                      </p>
                      <p className="font-medium text-white">{address.receiver_name}</p>
                      <p className="text-sm text-white/60">{address.receiver_phone}</p>
                      <div className="text-sm text-white/70 mt-2 whitespace-pre-line leading-relaxed">
                        {addressDisplayLines(address).join('\n')}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAddress(address.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {address.latitude != null && address.longitude != null && (
                    <div className="mt-3">
                      <LocationMap
                        latitude={Number(address.latitude)}
                        longitude={Number(address.longitude)}
                        editable={false}
                        height="160px"
                      />
                    </div>
                  )}
                  {!address.is_default && (
                    <button
                      onClick={() => setDefault(address.id)}
                      className="mt-3 text-xs text-layali-pink font-medium hover:underline"
                    >
                      Set as default
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
