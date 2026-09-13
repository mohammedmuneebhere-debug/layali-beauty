'use client';

import { useId, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LocationMap } from '@/components/map/LocationMap';
import { DEFAULT_MAP_CENTER, reverseGeocode } from '@/lib/geocode';
import {
  applyGeocodeToStructured,
  composeStoredAddressLine,
  emptyStructuredAddress,
  formatAddressSummaryLines,
  structuredFromStoredAddress,
  type StructuredAddressFields,
} from '@/lib/address/structured';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { cn } from '@/lib/utils';
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
  /** When true, country is fixed to Saudi Arabia (COD checkout). */
  lockCountryToSA?: boolean;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (values: AddressFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

type FieldErrors = Partial<
  Record<
    | 'receiver_name'
    | 'receiver_phone'
    | 'custom_label'
    | 'street'
    | 'area'
    | 'city'
    | 'country'
    | 'pin',
    string
  >
>;

export function AddressForm({
  initial,
  defaultCity = '',
  defaultCountry = '',
  lockCountryToSA = false,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const { t } = useLanguage();
  const a = t.checkout.address;
  const formId = useId();

  const initialStructured = structuredFromStoredAddress({
    address_line: initial?.address_line,
    city: initial?.city || defaultCity,
    country: lockCountryToSA
      ? 'Saudi Arabia'
      : initial?.country || defaultCountry,
  });

  const [label, setLabel] = useState<AddressLabel>(initial?.label || 'home');
  const [customLabel, setCustomLabel] = useState(initial?.custom_label || '');
  const [receiverName, setReceiverName] = useState(initial?.receiver_name || '');
  const [receiverPhone, setReceiverPhone] = useState(initial?.receiver_phone || '');
  const [fields, setFields] = useState<StructuredAddressFields>(initialStructured);
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [locating, setLocating] = useState(false);
  const [updatingFromPin, setUpdatingFromPin] = useState(false);
  const [accuracyHint, setAccuracyHint] = useState<string | null>(null);
  const [centerKey, setCenterKey] = useState(0);
  const hasPinnedLocation = latitude != null && longitude != null;

  const labelOptions = [
    { value: 'home', label: a.labelHome },
    { value: 'work', label: a.labelWork },
    { value: 'other', label: a.labelOther },
  ];

  const updateField = <K extends keyof StructuredAddressFields>(
    key: K,
    value: StructuredAddressFields[K]
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as keyof FieldErrors];
      return next;
    });
  };

  const applyCoordinates = async (
    nextLat: number,
    nextLng: number,
    options?: { fillAddress?: boolean; recenter?: boolean }
  ) => {
    const fillAddress = options?.fillAddress ?? true;
    const recenter = options?.recenter ?? false;

    setLatitude(nextLat);
    setLongitude(nextLng);
    if (recenter) setCenterKey((k) => k + 1);
    if (!fillAddress) return;

    setUpdatingFromPin(true);
    try {
      const geo = await reverseGeocode(nextLat, nextLng);
      setFields((prev) =>
        applyGeocodeToStructured(
          prev,
          {
            street: geo.street,
            area: geo.area,
            city: geo.city,
            postalCode: geo.postalCode,
            country: lockCountryToSA ? 'Saudi Arabia' : geo.country,
          },
          { onlyEmpty: true }
        )
      );
    } catch {
      // Keep the pin even if reverse lookup fails
    } finally {
      setUpdatingFromPin(false);
    }
  };

  const useLiveLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(a.locationUnsupported);
      return;
    }

    setLocating(true);
    setError('');
    setAccuracyHint(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        await applyCoordinates(lat, lng, {
          fillAddress: true,
          recenter: true,
        });
        if (typeof accuracy === 'number' && accuracy > 80) {
          setAccuracyHint(a.accuracyHint.replace('{meters}', String(Math.round(accuracy))));
        } else {
          setAccuracyHint(null);
        }
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError(a.locationDenied);
            break;
          case geoError.POSITION_UNAVAILABLE:
            setError(a.locationUnavailable);
            break;
          case geoError.TIMEOUT:
            setError(a.locationTimeout);
            break;
          default:
            setError(a.locationFailed);
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

    const nextErrors: FieldErrors = {};
    const countryValue = lockCountryToSA ? 'Saudi Arabia' : fields.country.trim();

    if (!receiverName.trim() || receiverName.trim().length < 2) {
      nextErrors.receiver_name = a.requiredReceiverName;
    }
    if (!receiverPhone.trim() || receiverPhone.trim().length < 8) {
      nextErrors.receiver_phone = a.requiredReceiverPhone;
    }
    if (label === 'other' && !customLabel.trim()) {
      nextErrors.custom_label = a.requiredOtherLabel;
    }
    if (!fields.street.trim()) {
      nextErrors.street = a.requiredStreet;
    }
    if (!fields.area.trim()) {
      nextErrors.area = a.requiredArea;
    }
    if (!fields.city.trim()) {
      nextErrors.city = a.requiredCity;
    }
    if (lockCountryToSA) {
      // Country is fixed; no silent remap of other values.
    } else if (!countryValue) {
      nextErrors.country = a.requiredCountrySA;
    }
    if (latitude == null || longitude == null) {
      nextErrors.pin = a.requiredPin;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(Object.values(nextErrors)[0] || '');
      return;
    }

    const finalFields: StructuredAddressFields = {
      ...fields,
      street: fields.street.trim(),
      area: fields.area.trim(),
      city: fields.city.trim(),
      building: fields.building.trim(),
      apartment: fields.apartment.trim(),
      postalCode: fields.postalCode.trim(),
      directions: fields.directions.trim(),
      country: countryValue,
    };

    await onSubmit({
      label,
      custom_label: label === 'other' ? customLabel.trim() : '',
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      address_line: composeStoredAddressLine(finalFields),
      city: finalFields.city,
      country: finalFields.country,
      latitude,
      longitude,
      is_default: isDefault,
    });
  };

  const mapLat = latitude ?? DEFAULT_MAP_CENTER.lat;
  const mapLng = longitude ?? DEFAULT_MAP_CENTER.lng;
  const summaryLines = formatAddressSummaryLines({
    ...fields,
    country: lockCountryToSA ? 'Saudi Arabia' : fields.country,
  });
  const directionsId = `${formId}-directions`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`${formId}-receiver-name`}
          label={a.receiverName}
          value={receiverName}
          onChange={(e) => {
            setReceiverName(e.target.value);
            setFieldErrors((prev) => {
              const next = { ...prev };
              delete next.receiver_name;
              return next;
            });
          }}
          placeholder={a.receiverNamePlaceholder}
          autoComplete="name"
          error={fieldErrors.receiver_name}
          required
        />
        <Input
          id={`${formId}-receiver-phone`}
          label={a.receiverPhone}
          type="tel"
          value={receiverPhone}
          onChange={(e) => {
            setReceiverPhone(e.target.value);
            setFieldErrors((prev) => {
              const next = { ...prev };
              delete next.receiver_phone;
              return next;
            });
          }}
          placeholder={a.receiverPhonePlaceholder}
          autoComplete="tel"
          error={fieldErrors.receiver_phone}
          required
        />
      </div>

      <Select
        label={a.addressType}
        options={labelOptions}
        value={label}
        onChange={(e) => setLabel(e.target.value as AddressLabel)}
      />

      {label === 'other' && (
        <Input
          id={`${formId}-custom-label`}
          label={a.specifyLabel}
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          placeholder={a.specifyLabelPlaceholder}
          error={fieldErrors.custom_label}
          required
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium text-white">{a.pinTitle}</p>
            <p className="text-xs text-white/50">
              {hasPinnedLocation ? a.pinHintPinned : a.pinHintEmpty}
            </p>
          </div>
          <button
            type="button"
            onClick={useLiveLocation}
            disabled={locating}
            className="text-xs text-layali-pink font-medium hover:underline inline-flex items-center gap-1"
          >
            <Navigation className="w-3.5 h-3.5" />
            {locating ? a.detecting : a.useLiveLocation}
          </button>
        </div>

        <LocationMap
          latitude={mapLat}
          longitude={mapLng}
          editable
          height="300px"
          centerKey={centerKey}
          onLocationChange={(lat, lng) => {
            void applyCoordinates(lat, lng, { fillAddress: true, recenter: false });
          }}
        />

        <p className="text-xs text-white/50 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {updatingFromPin
            ? a.updatingFromPin
            : hasPinnedLocation
              ? `${a.pinnedAt}: ${mapLat.toFixed(6)}, ${mapLng.toFixed(6)}`
              : a.noPinYet}
        </p>
        {fieldErrors.pin ? <p className="text-sm text-red-400">{fieldErrors.pin}</p> : null}
        {accuracyHint ? <p className="text-xs text-amber-200/90">{accuracyHint}</p> : null}
        <p className="text-xs text-white/40">{a.autofillHint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`${formId}-building`}
          label={a.building}
          value={fields.building}
          onChange={(e) => updateField('building', e.target.value)}
          placeholder={a.buildingPlaceholder}
        />
        <Input
          id={`${formId}-apartment`}
          label={a.apartment}
          value={fields.apartment}
          onChange={(e) => updateField('apartment', e.target.value)}
          placeholder={a.apartmentPlaceholder}
        />
      </div>

      <Input
        id={`${formId}-street`}
        label={a.street}
        value={fields.street}
        onChange={(e) => updateField('street', e.target.value)}
        placeholder={a.streetPlaceholder}
        autoComplete="address-line1"
        error={fieldErrors.street}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`${formId}-area`}
          label={a.area}
          value={fields.area}
          onChange={(e) => updateField('area', e.target.value)}
          placeholder={a.areaPlaceholder}
          error={fieldErrors.area}
          required
        />
        <Input
          id={`${formId}-city`}
          label={a.city}
          value={fields.city}
          onChange={(e) => updateField('city', e.target.value)}
          placeholder={a.cityPlaceholder}
          autoComplete="address-level2"
          error={fieldErrors.city}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`${formId}-postal`}
          label={a.postal}
          value={fields.postalCode}
          onChange={(e) => updateField('postalCode', e.target.value)}
          placeholder={a.postalPlaceholder}
          autoComplete="postal-code"
        />
        {lockCountryToSA ? (
          <Input
            id={`${formId}-country`}
            label={a.country}
            value={a.countrySaudiArabia}
            readOnly
            autoComplete="country-name"
          />
        ) : (
          <Input
            id={`${formId}-country`}
            label={a.country}
            value={fields.country}
            onChange={(e) => updateField('country', e.target.value)}
            placeholder={a.countrySaudiArabia}
            autoComplete="country-name"
            error={fieldErrors.country}
          />
        )}
      </div>

      <div className="w-full">
        <label htmlFor={directionsId} className="block text-sm font-medium text-white/70 mb-1.5">
          {a.directions}
        </label>
        <textarea
          id={directionsId}
          value={fields.directions}
          onChange={(e) => updateField('directions', e.target.value)}
          rows={2}
          placeholder={a.directionsPlaceholder}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2',
            'border border-white/12 bg-white/5 text-white placeholder:text-white/30 focus:ring-layali-pink/50 focus:border-layali-pink/40'
          )}
        />
      </div>

      {summaryLines.length > 0 && (
        <div className="rounded-xl border border-layali-pink/20 bg-black/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-layali-pink mb-2">
            {a.summaryTitle}
          </p>
          <div className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
            {summaryLines.join('\n')}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded"
        />
        {a.setDefault}
      </label>

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            {a.cancel}
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={loading}>
          {submitLabel || a.saveAddress}
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

/** Display helper for saved address cards / checkout summary. */
export function addressDisplayLines(address: {
  address_line: string;
  city?: string | null;
  country?: string | null;
}): string[] {
  return formatAddressSummaryLines(
    structuredFromStoredAddress({
      address_line: address.address_line,
      city: address.city,
      country: address.country,
    })
  );
}
