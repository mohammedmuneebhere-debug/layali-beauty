'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AddressForm, addressDisplayLabel, addressDisplayLines, type AddressFormValues } from '@/components/address/AddressForm';
import { LocationMap } from '@/components/map/LocationMap';
import { FadeIn } from '@/components/ui/FadeIn';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatSaudiPhoneDisplay } from '@/lib/address/saudi-phone';
import type { Address } from '@/types/database';

export default function AddressesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = async () => {
    const response = await fetch('/api/account/addresses', { cache: 'no-store' });
    if (response.status === 401) {
      router.push('/auth/signin?redirect=/account/addresses');
      return [];
    }
    const json = (await response.json()) as { addresses?: Address[] };
    const list = json.addresses || [];
    setAddresses(list);
    return list;
  };

  useEffect(() => {
    async function init() {
      const me = await fetch('/api/account/me', { cache: 'no-store' });
      const json = (await me.json()) as { signedIn?: boolean; customer?: { id: string } };
      if (!json.signedIn || !json.customer) {
        router.push('/auth/signin?redirect=/account/addresses');
        return;
      }
      setUserId(json.customer.id);
      await load();
      setFetching(false);
    }
    init();
  }, [router]);

  const saveAddress = async (values: AddressFormValues) => {
    if (!userId) return;
    setLoading(true);
    const response = await fetch('/api/account/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: values.label,
        custom_label: values.custom_label || null,
        receiver_name: values.receiver_name,
        receiver_phone: values.receiver_phone,
        address_line: values.address_line,
        city: values.city.trim(),
        country: values.country.trim(),
        latitude: values.latitude,
        longitude: values.longitude,
        is_default: values.is_default || addresses.length === 0,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      alert(json.error || 'Could not save address');
      return;
    }
    setShowForm(false);
    await load();
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const setDefault = async (id: string) => {
    await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    });
    await load();
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
                defaultCountry="Saudi Arabia"
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
                      <p className="text-sm text-white/60">
                        {formatSaudiPhoneDisplay(address.receiver_phone) || address.receiver_phone}
                      </p>
                      <div className="text-sm text-white/70 mt-2 whitespace-pre-line leading-relaxed">
                        {addressDisplayLines(address, t.checkout.address.additionalNumber).join('\n')}
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
