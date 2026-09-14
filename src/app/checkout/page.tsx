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
import { OrderSummaryCard } from '@/components/checkout/OrderSummaryCard';
import { LocationMap } from '@/components/map/LocationMap';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatSaudiPhoneDisplay } from '@/lib/address/saudi-phone';
import {
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

const SUBMISSION_STORAGE_KEY = 'layali-checkout-submission-id';
const UNCONFIRMED_PLACE_ORDER =
  "We couldn't confirm the response from the server. Please check My Orders before trying again.";

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isValidSubmissionId(value: string): boolean {
  return value.length >= 8 && value.length <= 80;
}

function readStoredSubmissionId(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const value = sessionStorage.getItem(SUBMISSION_STORAGE_KEY)?.trim() || '';
    return isValidSubmissionId(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredSubmissionId(id: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SUBMISSION_STORAGE_KEY, id);
  } catch {
    // Private mode / quota — keep the in-memory id only.
  }
}

function clearStoredSubmissionId(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SUBMISSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getOrCreateSubmissionId(): string {
  const stored = readStoredSubmissionId();
  if (stored) return stored;
  const id = newSubmissionId();
  writeStoredSubmissionId(id);
  return id;
}

function rotateSubmissionId(): string {
  const id = newSubmissionId();
  writeStoredSubmissionId(id);
  return id;
}

function isAbortOrNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String((err as { name?: string }).name || '') : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /aborted|timeout|failed to fetch|networkerror|load failed/i.test(message)
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    items,
    lines,
    totalAmount,
    subtotal,
    cartId,
    discounts,
    currencyCode,
    refresh,
    clearLocalCart,
  } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [error, setError] = useState('');
  const [cartReady, setCartReady] = useState(false);
  const [checkOrdersHint, setCheckOrdersHint] = useState(false);
  const placingRef = useRef(false);
  const orderPlacedRef = useRef(false);
  const submissionIdRef = useRef('');
  const lastCheckoutPinKey = useRef('');

  const loadAddresses = async (uid: string, selectId?: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    const list = (data as Address[]) || [];
    setAddresses(list);

    setSelectedAddressId((current) => {
      if (selectId && list.some((a) => a.id === selectId)) return selectId;
      if (current && list.some((a) => a.id === current)) return current;
      return list.find((a) => a.is_default)?.id || list[0]?.id || null;
    });
    if (list.length === 0) setShowNewAddress(true);
    else if (selectId) setShowNewAddress(false);
  };

  useEffect(() => {
    const finish = () => setCartReady(true);
    const unsub = useCartStore.persist.onFinishHydration(finish);
    if (useCartStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  useEffect(() => {
    submissionIdRef.current = getOrCreateSubmissionId();
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    void refresh();
  }, [cartReady, refresh]);

  useEffect(() => {
    if (!cartReady) return;
    if (placingRef.current || orderPlacedRef.current) return;

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
        .select('email')
        .eq('id', user.id)
        .single();

      if (profile?.email) setUserEmail(profile.email);
      await loadAddresses(user.id);
    }

    // Persist restore only cartId — line items stay empty until Shopify refresh.
    if (items.length === 0) {
      if (cartId) {
        void init();
        return;
      }
      router.push('/cart');
      return;
    }

    void init();
  }, [cartReady, items.length, cartId, router]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  useEffect(() => {
    lastCheckoutPinKey.current = '';
  }, [selectedAddressId]);

  const updateSelectedPin = async (lat: number, lng: number) => {
    if (!selectedAddressId) return;
    const pinKey = `${selectedAddressId}:${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastCheckoutPinKey.current === pinKey) return;
    lastCheckoutPinKey.current = pinKey;

    setAddresses((prev) =>
      prev.map((a) =>
        a.id === selectedAddressId ? { ...a, latitude: lat, longitude: lng } : a
      )
    );

    const supabase = createClient();
    await supabase
      .from('addresses')
      .update({
        latitude: lat,
        longitude: lng,
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
        city: values.city.trim(),
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

    await loadAddresses(userId, data.id);
    setShowNewAddress(false);
  };

  const resolveSubmissionId = () => {
    const current = submissionIdRef.current.trim();
    if (isValidSubmissionId(current)) return current;
    const id = getOrCreateSubmissionId();
    submissionIdRef.current = id;
    return id;
  };

  const placeOrder = async () => {
    if (placingRef.current || loading || orderPlacedRef.current) return;
    setError('');
    setCheckOrdersHint(false);

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
          submissionId: resolveSubmissionId(),
        }),
      });

      let json: {
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
      try {
        json = JSON.parse(await res.text()) as typeof json;
      } catch {
        // Keep submissionId. Do not auto-retry — Shopify may already have completed.
        setCheckOrdersHint(true);
        setError(UNCONFIRMED_PLACE_ORDER);
        return;
      }

      if (!json || typeof json !== 'object') {
        setCheckOrdersHint(true);
        setError(UNCONFIRMED_PLACE_ORDER);
        return;
      }

      // Success (including recovered / already-completed submissions).
      if (json.ok && json.order) {
        orderPlacedRef.current = true;
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
        clearStoredSubmissionId();
        submissionIdRef.current = '';
        clearLocalCart();
        return;
      }

      // Keep cart. Only rotate submissionId when the server says a retry cannot
      // duplicate a Shopify order (pre-completion validation failures).
      if (json.retrySafe === true) {
        submissionIdRef.current = rotateSubmissionId();
      }
      const raw = json.error || 'Could not place your order. Please try again.';
      setError(customerCheckoutError(raw) || 'Could not place your order. Please try again.');
    } catch (err) {
      // Keep submissionId so a manual retry can hit server idempotency.
      // Do not auto-submit again — Shopify may already have completed.
      if (isAbortOrNetworkError(err)) {
        setCheckOrdersHint(true);
        setError(UNCONFIRMED_PLACE_ORDER);
      } else {
        setError('Could not place your order. Please try again.');
      }
    } finally {
      if (!orderPlacedRef.current) {
        placingRef.current = false;
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-serif text-heading-lg text-white mb-8">{t.checkout.title}</h1>

        {!cartReady ? (
          <p className="text-white/45">Loading cart…</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-ui-heading text-white">{t.checkout.deliveryAddress}</h2>
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

            <p className="text-sm text-white/50">{t.checkout.chooseWhere}</p>

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
                    <p className="text-sm text-white/60">
                      {formatSaudiPhoneDisplay(address.receiver_phone) || address.receiver_phone}
                    </p>
                    <div className="text-sm text-white/70 mt-1 whitespace-pre-line leading-relaxed">
                      {addressDisplayLines(address, t.checkout.address.additionalNumber).join('\n')}
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
                  defaultCountry="Saudi Arabia"
                  lockCountryToSA
                  loading={savingAddress}
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
                        key={selectedAddress.id}
                        latitude={Number(selectedAddress.latitude)}
                        longitude={Number(selectedAddress.longitude)}
                        editable
                        height="240px"
                        showMarker
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
                      {selectedAddress.receiver_name} ·{' '}
                      {formatSaudiPhoneDisplay(selectedAddress.receiver_phone) ||
                        selectedAddress.receiver_phone}
                    </p>
                    <div className="text-sm text-white/80 mt-1 whitespace-pre-line leading-relaxed">
                      {addressDisplayLines(selectedAddress, t.checkout.address.additionalNumber).join('\n')}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <h3 className="text-ui-heading text-white">{t.checkout.payment}</h3>
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
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm space-y-2">
                    <p>{error}</p>
                    {checkOrdersHint && (
                      <button
                        type="button"
                        onClick={() => router.push('/account/orders')}
                        className="text-sm text-layali-pink font-medium hover:underline"
                      >
                        {t.checkout.viewOrders}
                      </button>
                    )}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  loading={loading}
                  onClick={() => void placeOrder()}
                  disabled={loading || items.length === 0 || !selectedAddressId}
                >
                  {t.checkout.placeOrder}
                </Button>
              </>
            )}
          </div>

          <div className="bg-layali-surface rounded-2xl p-6 border border-layali-pink/20 h-fit">
            <h2 className="text-ui-heading text-white mb-4">{t.checkout.summary}</h2>
            <OrderSummaryCard
              lines={lines}
              subtotal={subtotal}
              totalAmount={totalAmount}
              discounts={discounts}
              currencyCode={currencyCode}
            />
            <div className="mt-4 p-3 rounded-xl bg-black flex items-center gap-2">
              <Package className="w-5 h-5 text-layali-pink shrink-0" />
              <span className="text-sm text-white/70">{t.checkout.confirmedBody}</span>
            </div>
            {selectedAddress && (
              <div className="mt-4 text-sm text-white/60">
                <p className="font-medium text-white">{t.checkout.deliveringTo}</p>
                <p>
                  {selectedAddress.receiver_name} ·{' '}
                  {formatSaudiPhoneDisplay(selectedAddress.receiver_phone) ||
                    selectedAddress.receiver_phone}
                </p>
                <div className="mt-1 whitespace-pre-line leading-relaxed">
                  {addressDisplayLines(selectedAddress, t.checkout.address.additionalNumber).join(
                    '\n'
                  )}
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
        )}
      </div>
    </div>
  );
}
