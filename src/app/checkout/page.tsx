'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AddressForm, addressDisplayLabel, type AddressFormValues } from '@/components/address/AddressForm';
import { LocationMap } from '@/components/map/LocationMap';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { reverseGeocode } from '@/lib/geocode';
import type { Address } from '@/types/database';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [profileCity, setProfileCity] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [notes, setNotes] = useState('');

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
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin?redirect=/checkout');
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
      await loadAddresses(user.id);
    }

    if (items.length === 0 && !orderPlaced) {
      router.push('/cart');
      return;
    }

    init();
  }, [items, orderPlaced, router]);

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
      addressLine = geo.address_line || undefined;
      city = geo.city || undefined;
      country = geo.country || undefined;

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

    const { data, error } = await supabase
      .from('addresses')
      .insert({
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
      })
      .select()
      .single();

    setSavingAddress(false);

    if (error || !data) {
      alert(error?.message || 'Could not save address');
      return;
    }

    await loadAddresses(userId);
    setSelectedAddressId(data.id);
    setShowNewAddress(false);
  };

  const placeOrder = async () => {
    if (!userId || !selectedAddress) return;

    setLoading(true);
    const supabase = createClient();

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_amount: total(),
        payment_method: 'cod',
        shipping_address: selectedAddress.address_line,
        shipping_city: selectedAddress.city || profileCity,
        shipping_country: selectedAddress.country || profileCountry,
        phone: selectedAddress.receiver_phone,
        address_id: selectedAddress.id,
        receiver_name: selectedAddress.receiver_name,
        receiver_phone: selectedAddress.receiver_phone,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !order) {
      alert(error?.message || 'Could not place order. Make sure addresses SQL has been applied.');
      setLoading(false);
      return;
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.type === 'product' ? item.id : null,
      combo_id: item.type === 'combo' ? item.id : null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    await supabase.from('order_items').insert(orderItems);
    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      message: 'Order placed successfully',
    });

    setOrderId(order.id.slice(0, 8).toUpperCase());
    clearCart();
    setOrderPlaced(true);
    setLoading(false);
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen gradient-pink flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-6" />
          <h1 className="font-serif text-3xl font-bold text-layali-black mb-2">Order Placed!</h1>
          <p className="font-script text-2xl text-layali-black/70 mb-4">thank you</p>
          <p className="text-layali-black/60 mb-2">Order ID: <strong>#{orderId}</strong></p>
          <p className="text-layali-black/60 mb-8">
            Your order will be delivered with Cash on Delivery payment.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push('/account/orders')}>View Orders</Button>
            <Button variant="outline" onClick={() => router.push('/shop')}>Continue Shopping</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-serif text-4xl font-bold text-layali-black mb-8">Checkout</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-6 border border-layali-pink/20 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-layali-black">Delivery Address</h2>
              {!showNewAddress && (
                <button
                  type="button"
                  onClick={() => setShowNewAddress(true)}
                  className="text-sm text-layali-pink-dark font-medium hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add new
                </button>
              )}
            </div>

            {addresses.length > 0 && !showNewAddress && (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setSelectedAddressId(address.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      selectedAddressId === address.id
                        ? 'border-layali-black bg-layali-pink-light/30'
                        : 'border-layali-pink/20 hover:border-layali-pink'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-layali-pink-dark">
                        {addressDisplayLabel(address)}
                        {address.is_default && ' · Default'}
                      </span>
                      <MapPin className="w-4 h-4 text-layali-black/40" />
                    </div>
                    <p className="font-medium text-layali-black">{address.receiver_name}</p>
                    <p className="text-sm text-layali-black/60">{address.receiver_phone}</p>
                    <p className="text-sm text-layali-black/70 mt-1">{address.address_line}</p>
                    {(address.city || address.country) && (
                      <p className="text-xs text-layali-black/50 mt-1">
                        {[address.city, address.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showNewAddress && (
              <div className="border border-layali-pink/20 rounded-xl p-4">
                <h3 className="font-medium text-layali-black mb-4">
                  {addresses.length === 0 ? 'Add your delivery address' : 'New address'}
                </h3>
                <AddressForm
                  defaultCity={profileCity}
                  defaultCountry={profileCountry}
                  loading={savingAddress}
                  submitLabel="Save & Use This Address"
                  onCancel={addresses.length > 0 ? () => setShowNewAddress(false) : undefined}
                  onSubmit={saveAddress}
                />
              </div>
            )}

            {!showNewAddress && selectedAddress && (
              <>
                {selectedAddress.latitude != null && selectedAddress.longitude != null && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-layali-black">Adjust delivery pin</p>
                    <p className="text-xs text-layali-black/50">
                      Drag the pin or tap the map to set the exact drop-off point
                    </p>
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
                  label="Order Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any delivery instructions?"
                />
                <Button
                  className="w-full"
                  size="lg"
                  loading={loading}
                  onClick={placeOrder}
                >
                  Place Order (COD)
                </Button>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-layali-pink/20 h-fit">
            <h2 className="font-serif text-xl font-bold text-layali-black mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-layali-black/70">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-layali-pink/20 pt-4 flex justify-between">
              <span className="font-bold text-layali-black">Total</span>
              <span className="font-bold text-xl text-layali-black">{formatPrice(total())}</span>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-layali-cream flex items-center gap-2">
              <Package className="w-5 h-5 text-layali-pink-dark" />
              <span className="text-sm text-layali-black/70">Cash on Delivery</span>
            </div>
            {selectedAddress && (
              <div className="mt-4 text-sm text-layali-black/60">
                <p className="font-medium text-layali-black">Delivering to</p>
                <p>{selectedAddress.receiver_name} · {selectedAddress.receiver_phone}</p>
                <p className="mt-1">{selectedAddress.address_line}</p>
                {selectedAddress.latitude != null && selectedAddress.longitude != null && (
                  <p className="text-xs mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Pin: {Number(selectedAddress.latitude).toFixed(5)}, {Number(selectedAddress.longitude).toFixed(5)}
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
