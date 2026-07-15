'use client';

import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LocationMap } from '@/components/map/LocationMap';
import { DEFAULT_MAP_CENTER, reverseGeocode } from '@/lib/geocode';
import type { AddressLabel } from '@/types/database';

export interface AddressFormValues {
  label: AddressLabel;
  custom_label: string;
  receiver_name: string;
  receiver_phone: string;
  address_line: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

interface AddressFormProps {
  initial?: Partial<AddressFormValues>;
  defaultCity?: string;
  defaultCountry?: string;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (values: AddressFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

const LABEL_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
];

export function AddressForm({
  initial,
  defaultCity = '',
  defaultCountry = '',
  submitLabel = 'Save Address',
  loading = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [form, setForm] = useState<AddressFormValues>({
    label: initial?.label || 'home',
    custom_label: initial?.custom_label || '',
    receiver_name: initial?.receiver_name || '',
    receiver_phone: initial?.receiver_phone || '',
    address_line: initial?.address_line || '',
    city: initial?.city || defaultCity,
    country: initial?.country || defaultCountry,
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    is_default: initial?.is_default ?? false,
  });
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(
    initial?.latitude != null && initial?.longitude != null
  );

  const update = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyCoordinates = async (latitude: number, longitude: number, fillAddress = true) => {
    update('latitude', latitude);
    update('longitude', longitude);
    setMapReady(true);

    if (!fillAddress) return;

    try {
      const geo = await reverseGeocode(latitude, longitude);
      if (geo.address_line) update('address_line', geo.address_line);
      if (geo.city) update('city', geo.city);
      if (geo.country) update('country', geo.country);
    } catch {
      // Pin is still saved even if reverse geocode fails
    }
  };

  const useLiveLocation = async () => {
    if (!navigator.geolocation) {
      setError('Location is not supported on this device.');
      return;
    }

    setLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applyCoordinates(position.coords.latitude, position.coords.longitude, true);
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Please allow location access or pin on the map.');
        setMapReady(true);
        if (form.latitude == null || form.longitude == null) {
          update('latitude', DEFAULT_MAP_CENTER.lat);
          update('longitude', DEFAULT_MAP_CENTER.lng);
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const openMapToPin = () => {
    setMapReady(true);
    if (form.latitude == null || form.longitude == null) {
      update('latitude', DEFAULT_MAP_CENTER.lat);
      update('longitude', DEFAULT_MAP_CENTER.lng);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.receiver_name.trim() || form.receiver_name.trim().length < 2) {
      setError('Please enter the receiver name.');
      return;
    }
    if (!form.receiver_phone.trim() || form.receiver_phone.trim().length < 8) {
      setError('Please enter a valid receiver phone number.');
      return;
    }
    if (!form.address_line.trim() || form.address_line.trim().length < 5) {
      setError('Please enter a full delivery address.');
      return;
    }
    if (form.label === 'other' && !form.custom_label.trim()) {
      setError('Please specify a label for “Other”.');
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      setError('Please pin your delivery location on the map.');
      setMapReady(true);
      return;
    }

    await onSubmit({
      ...form,
      receiver_name: form.receiver_name.trim(),
      receiver_phone: form.receiver_phone.trim(),
      address_line: form.address_line.trim(),
      custom_label: form.label === 'other' ? form.custom_label.trim() : '',
      city: form.city.trim(),
      country: form.country.trim(),
    });
  };

  const mapLat = form.latitude ?? DEFAULT_MAP_CENTER.lat;
  const mapLng = form.longitude ?? DEFAULT_MAP_CENTER.lng;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Receiver Name"
          value={form.receiver_name}
          onChange={(e) => update('receiver_name', e.target.value)}
          placeholder="Full name of receiver"
          required
        />
        <Input
          label="Receiver Phone"
          type="tel"
          value={form.receiver_phone}
          onChange={(e) => update('receiver_phone', e.target.value)}
          placeholder="Phone number"
          required
        />
      </div>

      <Select
        label="Address Type"
        options={LABEL_OPTIONS}
        value={form.label}
        onChange={(e) => update('label', e.target.value as AddressLabel)}
      />

      {form.label === 'other' && (
        <Input
          label="Specify Label"
          value={form.custom_label}
          onChange={(e) => update('custom_label', e.target.value)}
          placeholder="e.g. Parents' house, Gym"
          required
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
          <label className="block text-sm font-medium text-layali-black">Delivery Address</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openMapToPin}
              className="text-xs text-layali-black/60 font-medium hover:underline inline-flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5" />
              Pin on map
            </button>
            <button
              type="button"
              onClick={useLiveLocation}
              disabled={locating}
              className="text-xs text-layali-pink-dark font-medium hover:underline inline-flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              {locating ? 'Detecting...' : 'Use live location'}
            </button>
          </div>
        </div>
        <textarea
          value={form.address_line}
          onChange={(e) => update('address_line', e.target.value)}
          rows={3}
          required
          placeholder="Street, building, landmark..."
          className="w-full px-4 py-3 rounded-xl border border-layali-pink/30 bg-white/80 focus:outline-none focus:ring-2 focus:ring-layali-pink"
        />
      </div>

      {mapReady && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-layali-black">Pin your exact location</p>
          <p className="text-xs text-layali-black/50">
            Drag the pin or tap the map to set the delivery point.
          </p>
          <LocationMap
            latitude={mapLat}
            longitude={mapLng}
            editable
            height="280px"
            onLocationChange={(lat, lng) => {
              applyCoordinates(lat, lng, true);
            }}
          />
          {form.latitude != null && form.longitude != null && (
            <p className="text-xs text-layali-black/50 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Pinned: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="City"
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
          placeholder="City"
        />
        <Input
          label="Country"
          value={form.country}
          onChange={(e) => update('country', e.target.value)}
          placeholder="Country"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-layali-black cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => update('is_default', e.target.checked)}
          className="rounded"
        />
        Set as default delivery address
      </label>

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function addressDisplayLabel(address: {
  label: AddressLabel;
  custom_label?: string | null;
}) {
  if (address.label === 'other') return address.custom_label || 'Other';
  return address.label.charAt(0).toUpperCase() + address.label.slice(1);
}
