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
    // Map view may center on Riyadh, but do not treat that as a saved pin.
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    is_default: initial?.is_default ?? false,
  });
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [updatingFromPin, setUpdatingFromPin] = useState(false);
  const [accuracyHint, setAccuracyHint] = useState<string | null>(null);
  const [centerKey, setCenterKey] = useState(0);
  const hasPinnedLocation = form.latitude != null && form.longitude != null;

  const update = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyCoordinates = async (
    latitude: number,
    longitude: number,
    options?: { fillAddress?: boolean; recenter?: boolean }
  ) => {
    const fillAddress = options?.fillAddress ?? true;
    const recenter = options?.recenter ?? false;

    // Always pin the raw coordinates first — never replace them with geocoded approx.
    setForm((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
    if (recenter) setCenterKey((k) => k + 1);

    if (!fillAddress) return;

    setUpdatingFromPin(true);
    try {
      const geo = await reverseGeocode(latitude, longitude);
      setForm((prev) => ({
        ...prev,
        // Preserve device/pin coords; only fill textual address fields.
        latitude,
        longitude,
        address_line: geo.address_line || prev.address_line,
        city: geo.city || prev.city,
        country: geo.country || prev.country,
      }));
    } catch {
      // Keep the pin even if reverse lookup fails
    } finally {
      setUpdatingFromPin(false);
    }
  };

  const useLiveLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported on this browser. Enter the address manually or drag the pin.');
      return;
    }

    setLocating(true);
    setError('');
    setAccuracyHint(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        await applyCoordinates(latitude, longitude, {
          fillAddress: true,
          recenter: true,
        });
        if (typeof accuracy === 'number' && accuracy > 80) {
          setAccuracyHint(
            `GPS accuracy is about ${Math.round(accuracy)}m — drag the pin to refine the exact drop-off.`
          );
        } else {
          setAccuracyHint(null);
        }
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError(
              'Location permission denied. Allow location access, or drag the pin / type the address manually.'
            );
            break;
          case geoError.POSITION_UNAVAILABLE:
            setError(
              'Location unavailable right now. Drag the pin on the map or enter the address manually.'
            );
            break;
          case geoError.TIMEOUT:
            setError(
              'Location request timed out. Try again, or drag the pin / type the address manually.'
            );
            break;
          default:
            setError('Could not get your location. Drag the pin on the map instead.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
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
      setError('Please place the delivery pin on the map (live location, drag, or tap).');
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium text-white">Pin delivery location</p>
            <p className="text-xs text-white/50">
              {hasPinnedLocation
                ? 'Drag the pin or tap anywhere on the map to move it'
                : 'Use live location, or tap/drag the pin to set the exact drop-off'}
            </p>
          </div>
          <button
            type="button"
            onClick={useLiveLocation}
            disabled={locating}
            className="text-xs text-layali-pink font-medium hover:underline inline-flex items-center gap-1"
          >
            <Navigation className="w-3.5 h-3.5" />
            {locating ? 'Detecting...' : 'Use my live location'}
          </button>
        </div>

        <LocationMap
          latitude={mapLat}
          longitude={mapLng}
          editable
          height="300px"
          centerKey={centerKey}
          onLocationChange={(lat, lng) => {
            applyCoordinates(lat, lng, { fillAddress: true, recenter: false });
          }}
        />

        <p className="text-xs text-white/50 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {updatingFromPin
            ? 'Updating address from pin...'
            : hasPinnedLocation
              ? `Pinned: ${mapLat.toFixed(6)}, ${mapLng.toFixed(6)}`
              : 'No pin set yet — map shows Riyadh as a starting view only'}
        </p>
        {accuracyHint ? (
          <p className="text-xs text-amber-200/90">{accuracyHint}</p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Delivery Address</label>
        <textarea
          value={form.address_line}
          onChange={(e) => update('address_line', e.target.value)}
          rows={3}
          required
          placeholder="Street, building, landmark..."
          className="w-full px-4 py-3 rounded-xl border border-layali-pink/30 bg-white/80 focus:outline-none focus:ring-2 focus:ring-layali-pink"
        />
        <p className="text-xs text-white/40 mt-1">
          Auto-filled when you move the pin — you can still edit it manually
        </p>
      </div>

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

      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
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
