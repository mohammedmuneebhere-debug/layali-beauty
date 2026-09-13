'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  AddressForm,
  addressDisplayLabel,
  addressDisplayLines,
  type AddressFormValues,
} from '@/components/address/AddressForm';
import { LocationMap } from '@/components/map/LocationMap';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { reverseGeocode } from '@/lib/geocode';
import {
  applyGeocodeToStructured,
  composeStoredAddressLine,
  isLabeledStructuredAddress,
  structuredFromStoredAddress,
} from '@/lib/address/structured';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { Address } from '@/types/database';

type PaymentMethod = 'cod' | 'online';

/** Shopify order-tag / SEO title-tag noise must never render on customer checkout. */
const NON_CUSTOMER_CHECKOUT_ERROR =
  /title\s*tag|title_tag|meta\s*description|\bseo\b|exceeds the maximum length of 40 characters/i;

function customerCheckoutError(message: string): string {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const part of message.split(/\s*;\s*/)) {
    const text = part.trim();
    if (!text || NON_CUSTOMER_CHECKOUT_ERROR.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(text);
  }
  return kept.join('; ');
}

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    items,
    total,
    totalAmount,
    subtotal,
    cartId,
    refresh,
    clearLocalCart,
  } = useCartStore();
  const discounts = useCartStore((s) => s.discounts) ?? [];
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [, setUserName] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [, setProfileCountry] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [error, setError] = useState('');
  const placingRef = useRef(false);
  const submissionIdRef = useRef(newSubmissionId());

  const summaryTotal = totalAmount || total() || subtotal;

  const loadAddresses = async (uid: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    const list = (data as Address[]) || [];
    setAddresses(list);

    const defaultAddr = list.find((a) => a.is_default) || list[0];
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
      setShowNewAddress(false);
    } else {
      setShowNewAddress(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin?redirect=/checkout');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('city, country, full_name, email')
        .eq('id', user.id)
        .single();

      setProfileCity(profile?.city || '');
      setProfileCountry(profile?.country || '');
      setUserName(profile?.full_name || 'Customer');
      if (profile?.email) setUserEmail(profile.email);
      await loadAddresses(user.id);
    }

    if (items.length === 0) {
      router.push('/cart');
      return;
    }

    void init();
  }, [items.length, router, refresh]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  const updateSelectedPin = async (lat: number, lng: number) => {
    if (!selectedAddressId) return;

    setAddresses((prev) =>
      prev.map((a) =>
        a.id === selectedAddressId ? { ...a, latitude: lat, longitude: lng } : a
      )
    );

    const supabase = createClient();
    let addressLine: string | undefined;
    let city: string | undefined;
    let country: string | undefined;

    try {
      const geo = await reverseGeocode(lat, lng);
      const selected = addresses.find((a) => a.id === selectedAddressId);
      const current = structuredFromStoredAddress({
        address_line: selected?.address_line,
        city: selected?.city,
        country: selected?.country || 'Saudi Arabia',
      });
      const filled = applyGeocodeToStructured(
        current,
        {
          street: geo.street,
          area: geo.area,
          city: geo.city,
          postalCode: geo.postalCode,
          country: 'Saudi Arabia',
        },
        { onlyEmpty: true }
      );
      addressLine = composeStoredAddressLine(filled);
      city = filled.city || undefined;
      country = 'Saudi Arabia';

      setAddresses((prev) =>
        prev.map((a) =>
          a.id === selectedAddressId
            ? {
                ...a,
                latitude: lat,
                longitude: lng,
                address_line: addressLine || a.address_line,
                city: city || a.city,
                country: country || a.country,
              }
            : a
        )
      );
    } catch {
      // keep pin coords even if reverse geocode fails
    }

    await supabase
      .from('addresses')
      .update({
        latitude: lat,
        longitude: lng,
        ...(addressLine ? { address_line: addressLine } : {}),
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      })
      .eq('id', selectedAddressId);
  };

  const saveAddress = async (values: AddressFormValues) => {
    if (!userId) return;
    setSavingAddress(true);
    const supabase = createClient();

    const { data, error: saveError } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        label: values.label,
        custom_label: values.custom_label || null,
        receiver_name: values.receiver_name,
        receiver_phone: values.receiver_phone,
        address_line: values.address_line,
        city: values.city || profileCity,
        country: values.country.trim() || 'Saudi Arabia',
        latitude: values.latitude,
        longitude: values.longitude,
        is_default: values.is_default || addresses.length === 0,
      })
      .select()
      .single();

    setSavingAddress(false);

    if (saveError || !data) {
      alert(saveError?.message || 'Could not save address');
      return;
    }

    await loadAddresses(userId);
    setSelectedAddressId(data.id);
    setShowNewAddress(false);
  };

  const placeOrder = async () => {
    if (placingRef.current || loading) return;
    setError('');

    if (!userId || !userEmail) {
      router.push('/auth/signin?redirect=/checkout');
      return;
    }
    if (!cartId || items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!selectedAddressId || !selectedAddress) {
      setError('Please select a delivery address.');
      return;
    }

    const structured = structuredFromStoredAddress(selectedAddress);
    if (isLabeledStructuredAddress(selectedAddress.address_line)) {
      if (!structured.street.trim()) {
        setError(t.checkout.address.requiredStreet);
        return;
      }
      if (!structured.area.trim()) {
        setError(t.checkout.address.requiredArea);
        return;
      }
      if (!structured.city.trim()) {
        setError(t.checkout.address.requiredCity);
        return;
      }
    } else {
      // Legacy combined address_line — do not force structured area.
      if (selectedAddress.address_line.trim().length < 5) {
        setError(t.checkout.address.requiredStreet);
        return;
      }
      if (!String(selectedAddress.city || '').trim()) {
        setError(t.checkout.address.requiredCity);
        return;
      }
    }

    if (paymentMethod !== 'cod') {
      setError('Only Cash on Delivery is available right now.');
      return;
    }

    placingRef.current = true;
    setLoading(true);

    try {
      await refresh();
      const activeCartId = useCartStore.getState().cartId;
      if (!activeCartId || useCartStore.getState().items.length === 0) {
        setError('Your cart is empty.');
        return;
      }

      const res = await fetch('/api/shopify/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: activeCartId,
          addressId: selectedAddressId,
          notes,
          paymentMethod: 'cod',
          submissionId: submissionIdRef.current,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        retrySafe?: boolean;
        order?: {
          id: string;
          name: string;
          totalAmount: number;
          currencyCode: string;
          paymentLabel: string;
          financialStatus?: string | null;
          shippingAddress: {
            receiverName: string;
            phone: string;
            addressLine: string;
            city: string;
            country: string;
          };
        };
      };

      // Success (including recovered / already-completed submissions).
      if (json.ok && json.order) {
        clearLocalCart();
        submissionIdRef.current = newSubmissionId();
        const q = new URLSearchParams();
        if (json.order.name) q.set('name', json.order.name);
        if (Number.isFinite(json.order.totalAmount)) {
          q.set('total', String(json.order.totalAmount));
        }
        if (json.order.currencyCode) q.set('currency', json.order.currencyCode);
        if (json.order.paymentLabel) q.set('payment', json.order.paymentLabel);
        if (json.order.financialStatus) q.set('status', json.order.financialStatus);
        q.set('date', new Date().toISOString());
        router.push(`/checkout/success?${q.toString()}`);
        return;
      }

      // Keep cart. Only rotate submissionId when the server says a retry cannot
      // duplicate a Shopify order (pre-completion validation failures).
      if (json.retrySafe === true) {
        submissionIdRef.current = newSubmissionId();
      }
      const raw = json.error || 'Could not place your order. Please try again.';
      setError(customerCheckoutError(raw) || 'Could not place your order. Please try again.');
    } catch {
      // Network/unknown — keep submissionId so a retry can hit server idempotency.
      setError('Could not place your order. Please try again.');
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-serif text-4xl font-bold text-white mb-8">{t.checkout.title}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-white">{t.checkout.deliveryAddress}</h2>
              {!showNewAddress && (
                <button
                  type="button"
                  onClick={() => setShowNewAddress(true)}
                  className="text-sm text-layali-pink font-medium hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> {t.checkout.addNew}
                </button>
              )}
            </div>

            <p className="text-sm text-white/50">
              Choose where we should deliver your order. Your pin helps our courier find you.
            </p>

            {addresses.length > 0 && !showNewAddress && (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setSelectedAddressId(address.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      selectedAddressId === address.id
                        ? 'border-layali-pink bg-layali-pink-glow/15'
                        : 'border-layali-pink/20 hover:border-layali-pink'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-layali-pink">
                        {addressDisplayLabel(address)}
                        {address.is_default && ` · ${t.checkout.default}`}
                      </span>
                      <MapPin className="w-4 h-4 text-white/40" />
                    </div>
                    <p className="font-medium text-white">{address.receiver_name}</p>
                    <p className="text-sm text-white/60">{address.receiver_phone}</p>
                    <div className="text-sm text-white/70 mt-1 whitespace-pre-line leading-relaxed">
                      {addressDisplayLines(address).join('\n')}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showNewAddress && (
              <div className="border border-layali-pink/20 rounded-xl p-4">
                <h3 className="font-medium text-white mb-4">
                  {addresses.length === 0 ? t.checkout.addAddress : t.checkout.newAddress}
                </h3>
                <AddressForm
                  defaultCity={profileCity}
                  defaultCountry="Saudi Arabia"
                  lockCountryToSA
                  loading={savingAddress}
                  submitLabel="Save & Use This Address"
                  onCancel={addresses.length > 0 ? () => setShowNewAddress(false) : undefined}
                  onSubmit={saveAddress}
                />
              </div>
            )}

            {!showNewAddress && (
              <>
                {selectedAddress &&
                  selectedAddress.latitude != null &&
                  selectedAddress.longitude != null && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white">{t.checkout.adjustPin}</p>
                      <p className="text-xs text-white/50">{t.checkout.pinHint}</p>
                      <LocationMap
                        latitude={Number(selectedAddress.latitude)}
                        longitude={Number(selectedAddress.longitude)}
                        editable
                        height="240px"
                        onLocationChange={updateSelectedPin}
                      />
                    </div>
                  )}
                <Input
                  label={t.checkout.notes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.checkout.notesPlaceholder}
                />

                {selectedAddress && (
                  <div className="rounded-xl border border-layali-pink/20 bg-black/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-layali-pink mb-2">
                      {t.checkout.address.summaryTitle}
                    </p>
                    <p className="text-sm text-white font-medium">
                      {selectedAddress.receiver_name} · {selectedAddress.receiver_phone}
                    </p>
                    <div className="text-sm text-white/80 mt-1 whitespace-pre-line leading-relaxed">
                      {addressDisplayLines(selectedAddress).join('\n')}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <h3 className="font-serif text-lg font-bold text-white">Payment Method</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setPaymentMethod('cod');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      paymentMethod === 'cod'
                        ? 'border-layali-pink bg-layali-pink-glow/15'
                        : 'border-layali-pink/20'
                    }`}
                  >
                    <p className="font-medium text-white">{t.checkout.cod}</p>
                    <p className="text-sm text-white/60 mt-1">Pay when your order is delivered.</p>
                  </button>
                  <div className="w-full text-left p-4 rounded-xl border border-white/10 opacity-60">
                    <p className="font-medium text-white/80">Online Payment</p>
                    <p className="text-sm text-white/45 mt-1">Coming soon</p>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  loading={loading}
                  onClick={() => void placeOrder()}
                  disabled={loading || items.length === 0 || !selectedAddressId}
                >
                  Place Order
                </Button>
              </>
            )}
          </div>

          <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20 h-fit">
            <h2 className="font-serif text-xl font-bold text-white mb-4">{t.checkout.summary}</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-white/70">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-layali-pink/20 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{t.cart.subtotal}</span>
                <span className="text-white">{formatPrice(subtotal)}</span>
              </div>
              {discounts.map((d) => (
                <div key={d.title} className="flex justify-between text-sm">
                  <span className="text-white/60">{d.title}</span>
                  <span className="text-emerald-300/90">−{formatPrice(d.amount.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{t.checkout.delivery}</span>
                <span className="text-white/50 text-xs">Calculated by Shopify</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Payment</span>
                <span className="text-white">{t.checkout.cod}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-bold text-white">{t.checkout.total}</span>
                <span className="font-bold text-xl text-white">{formatPrice(summaryTotal)}</span>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-black flex items-center gap-2">
              <Package className="w-5 h-5 text-layali-pink" />
              <span className="text-sm text-white/70">
                Place your order on Layali. Pay with Cash on Delivery when it arrives.
              </span>
            </div>
            {selectedAddress && (
              <div className="mt-4 text-sm text-white/60">
                <p className="font-medium text-white">{t.checkout.deliveringTo}</p>
                <p>
                  {selectedAddress.receiver_name} · {selectedAddress.receiver_phone}
                </p>
                <div className="mt-1 whitespace-pre-line leading-relaxed">
                  {addressDisplayLines(selectedAddress).join('\n')}
                </div>
                {selectedAddress.latitude != null && selectedAddress.longitude != null && (
                  <p className="text-xs mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {t.checkout.pin}: {Number(selectedAddress.latitude).toFixed(5)},{' '}
                    {Number(selectedAddress.longitude).toFixed(5)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
