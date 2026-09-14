'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SaudiPhoneField } from '@/components/address/SaudiPhoneField';
import { LocationMap } from '@/components/map/LocationMap';
import { DEFAULT_MAP_CENTER, reverseGeocode } from '@/lib/geocode';
import { isValidSaudiMobile, toStoredSaudiMobile } from '@/lib/address/saudi-phone';
import {
  applyGeocodeToStructured,
  buildingUnitDetails,
  composeStoredAddressLine,
  formatAddressSummaryLines,
  isPresentText,
  isSaudiPostalCode,
  structuredFromStoredAddress,
  toAsciiDigits,
  withBuildingUnitDetails,
  type StructuredAddressFields,
  type StructuredFieldKey,
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
    | 'building'
    | 'street'
    | 'area'
    | 'city'
    | 'postalCode'
    | 'country'
    | 'pin'
    | 'confirm',
    string
  >
>;

const GEOCODE_DEBOUNCE_MS = 700;
const POOR_ACCURACY_M = 80;
const VERY_POOR_ACCURACY_M = 250;

function coordKey(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-meta font-medium tracking-[0.14em] uppercase text-layali-pink">
      {children}
    </h3>
  );
}

export function AddressForm({
  initial,
  defaultCountry = '',
  lockCountryToSA = false,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const { t, locale } = useLanguage();
  const a = t.checkout.address;
  const formId = useId();

  const initialStructured = structuredFromStoredAddress({
    address_line: initial?.address_line,
    city: initial?.city || '',
    country: lockCountryToSA ? 'Saudi Arabia' : initial?.country || defaultCountry,
  });

  const [label, setLabel] = useState<AddressLabel>(initial?.label || 'home');
  const [customLabel, setCustomLabel] = useState(initial?.custom_label || '');
  const [receiverName, setReceiverName] = useState(initial?.receiver_name || '');
  const [receiverPhone, setReceiverPhone] = useState(initial?.receiver_phone || '');
  const [fields, setFields] = useState<StructuredAddressFields>(initialStructured);
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [locating, setLocating] = useState(false);
  const [updatingFromPin, setUpdatingFromPin] = useState(false);
  const [accuracyHint, setAccuracyHint] = useState<string | null>(null);
  const [centerKey, setCenterKey] = useState(0);
  const hasPinnedLocation = latitude != null && longitude != null;

  const userTouched = useRef<Set<StructuredFieldKey>>(new Set());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodeKey = useRef('');

  useEffect(() => {
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, []);

  const labelOptions = [
    { value: 'home', label: a.labelHome },
    { value: 'work', label: a.labelWork },
    { value: 'other', label: a.labelOther },
  ];

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateField = <K extends StructuredFieldKey>(key: K, value: StructuredAddressFields[K]) => {
    userTouched.current.add(key);
    setConfirmed(false);
    setFields((prev) => ({ ...prev, [key]: value }));
    if (
      key === 'building' ||
      key === 'street' ||
      key === 'area' ||
      key === 'city' ||
      key === 'postalCode' ||
      key === 'country'
    ) {
      clearFieldError(key);
    }
  };

  const updateBuildingUnit = (value: string) => {
    userTouched.current.add('building');
    userTouched.current.add('apartment');
    setConfirmed(false);
    setFields((prev) => withBuildingUnitDetails(prev, value));
    clearFieldError('building');
  };

  const runReverseGeocode = async (nextLat: number, nextLng: number) => {
    const key = coordKey(nextLat, nextLng);
    if (lastGeocodeKey.current === key) return;
    lastGeocodeKey.current = key;

    setUpdatingFromPin(true);
    setGeocodeHint(null);
    try {
      const geo = await reverseGeocode(nextLat, nextLng, locale === 'ar' ? 'ar' : 'en');
      setFields((prev) =>
        applyGeocodeToStructured(
          prev,
          {
            building: geo.building,
            street: geo.street,
            area: geo.area,
            city: geo.city,
            postalCode: geo.postalCode,
            country: lockCountryToSA ? 'Saudi Arabia' : geo.country,
          },
          { onlyEmpty: false, lockedKeys: userTouched.current }
        )
      );
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'rate_limited') setGeocodeHint(a.geocodeRateLimit);
      else if (code === 'timeout') setGeocodeHint(a.geocodeTimeout);
      else if (code === 'no_result') setGeocodeHint(a.geocodeNoResult);
      else setGeocodeHint(a.geocodeFailed);
    } finally {
      setUpdatingFromPin(false);
    }
  };

  const applyCoordinates = (
    nextLat: number,
    nextLng: number,
    options?: { fillAddress?: boolean; recenter?: boolean }
  ) => {
    const fillAddress = options?.fillAddress ?? true;
    const recenter = options?.recenter ?? false;

    setLatitude(nextLat);
    setLongitude(nextLng);
    setConfirmed(false);
    clearFieldError('pin');
    if (recenter) setCenterKey((k) => k + 1);
    if (!fillAddress) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      void runReverseGeocode(nextLat, nextLng);
    }, GEOCODE_DEBOUNCE_MS);
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
      (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        applyCoordinates(lat, lng, { fillAddress: true, recenter: true });
        if (typeof accuracy === 'number' && accuracy > VERY_POOR_ACCURACY_M) {
          setAccuracyHint(a.accuracyPoor.replace('{meters}', String(Math.round(accuracy))));
        } else if (typeof accuracy === 'number' && accuracy > POOR_ACCURACY_M) {
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
    const buildingUnit = buildingUnitDetails(fields);

    if (!receiverName.trim() || receiverName.trim().length < 2) {
      nextErrors.receiver_name = a.requiredReceiverName;
    }
    if (!isValidSaudiMobile(receiverPhone)) {
      nextErrors.receiver_phone = a.requiredReceiverPhone;
    }
    if (label === 'other' && !customLabel.trim()) {
      nextErrors.custom_label = a.requiredOtherLabel;
    }
    if (!isPresentText(buildingUnit)) {
      nextErrors.building = a.requiredBuilding;
    }
    if (!isPresentText(fields.street)) {
      nextErrors.street = a.requiredStreet;
    }
    if (!isPresentText(fields.area)) {
      nextErrors.area = a.requiredArea;
    }
    if (!isPresentText(fields.city)) {
      nextErrors.city = a.requiredCity;
    }
    if (!isSaudiPostalCode(fields.postalCode)) {
      nextErrors.postalCode = a.requiredPostal;
    }
    if (!lockCountryToSA && !countryValue) {
      nextErrors.country = a.requiredCountrySA;
    }
    if (latitude == null || longitude == null) {
      nextErrors.pin = a.requiredPin;
    }
    if (!confirmed) {
      nextErrors.confirm = a.requiredConfirm;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(Object.values(nextErrors)[0] || '');
      return;
    }

    const finalFields = withBuildingUnitDetails(
      {
        ...fields,
        street: fields.street.trim(),
        area: fields.area.trim(),
        city: fields.city.trim(),
        additional: fields.additional.trim(),
        postalCode: toAsciiDigits(fields.postalCode).trim(),
        directions: fields.directions.trim(),
        country: countryValue,
      },
      buildingUnit
    );

    await onSubmit({
      label,
      custom_label: label === 'other' ? customLabel.trim() : '',
      receiver_name: receiverName.trim(),
      receiver_phone: toStoredSaudiMobile(receiverPhone),
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
  const summaryLines = formatAddressSummaryLines(
    {
      ...fields,
      country: lockCountryToSA ? 'Saudi Arabia' : fields.country,
    },
    { additional: a.additionalNumber }
  );
  const directionsId = `${formId}-directions`;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="space-y-1">
          <SectionTitle>{a.sectionLocation}</SectionTitle>
          <p className="text-sm text-white/55 leading-relaxed">{a.locationIntro}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={useLiveLocation}
          disabled={locating}
          className="w-full min-h-12"
        >
          <Navigation className="w-4 h-4" />
          {locating ? a.detecting : a.useLiveLocation}
        </Button>

        <div className="relative">
          <LocationMap
            latitude={mapLat}
            longitude={mapLng}
            editable
            height="280px"
            centerKey={centerKey}
            showMarker={hasPinnedLocation}
            onLocationChange={(lat, lng) => {
              applyCoordinates(lat, lng, { fillAddress: true, recenter: false });
            }}
          />
          {!hasPinnedLocation ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <p className="pointer-events-none rounded-full bg-black/70 border border-white/10 px-3 py-1.5 text-xs text-white/90">
                {a.chooseLocation}
              </p>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-white/50 flex items-start gap-1.5 leading-relaxed">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {updatingFromPin
              ? a.updatingFromPin
              : hasPinnedLocation
                ? a.pinHintPinned
                : a.pinHintEmpty}
          </span>
        </p>
        {fieldErrors.pin ? <p className="text-sm text-red-400">{fieldErrors.pin}</p> : null}
        {accuracyHint ? <p className="text-xs text-amber-200/90">{accuracyHint}</p> : null}
        {geocodeHint ? <p className="text-xs text-amber-200/90">{geocodeHint}</p> : null}
        <p className="text-xs text-white/40 leading-relaxed">{a.autofillHint}</p>
      </section>

      <section className="space-y-4">
        <SectionTitle>{a.sectionAddress}</SectionTitle>
        <Input
          id={`${formId}-building`}
          label={a.buildingUnit}
          value={buildingUnitDetails(fields)}
          onChange={(e) => updateBuildingUnit(e.target.value)}
          placeholder={a.buildingUnitPlaceholder}
          error={fieldErrors.building}
          required
        />
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
        <Input
          id={`${formId}-postal`}
          label={a.postal}
          value={fields.postalCode}
          onChange={(e) => updateField('postalCode', e.target.value)}
          placeholder={a.postalPlaceholder}
          autoComplete="postal-code"
          inputMode="numeric"
          error={fieldErrors.postalCode}
          required
        />
        <Input
          id={`${formId}-additional`}
          label={a.additionalNumber}
          value={fields.additional}
          onChange={(e) => updateField('additional', e.target.value)}
          placeholder={a.additionalPlaceholder}
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
      </section>

      <section className="space-y-4">
        <SectionTitle>{a.sectionRecipient}</SectionTitle>
        <Input
          id={`${formId}-receiver-name`}
          label={a.receiverName}
          value={receiverName}
          onChange={(e) => {
            setReceiverName(e.target.value);
            clearFieldError('receiver_name');
          }}
          placeholder={a.receiverNamePlaceholder}
          autoComplete="name"
          error={fieldErrors.receiver_name}
          required
        />
        <SaudiPhoneField
          id={`${formId}-receiver-phone`}
          label={a.receiverPhone}
          value={receiverPhone}
          onChange={(stored) => {
            setReceiverPhone(stored);
            clearFieldError('receiver_phone');
          }}
          placeholder={a.receiverPhonePlaceholder}
          error={fieldErrors.receiver_phone}
          required
        />
      </section>

      <section className="space-y-4">
        <SectionTitle>{a.sectionLabel}</SectionTitle>
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
        <label className="flex items-center gap-2 text-sm text-white cursor-pointer min-h-11">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded"
          />
          {a.setDefault}
        </label>
      </section>

      <section className="space-y-3">
        <SectionTitle>{a.sectionInstructions}</SectionTitle>
        <div className="w-full">
          <label htmlFor={directionsId} className="block text-sm font-medium text-white/70 mb-1.5">
            {a.directions}
          </label>
          <textarea
            id={directionsId}
            value={fields.directions}
            onChange={(e) => updateField('directions', e.target.value)}
            rows={3}
            placeholder={a.directionsPlaceholder}
            className={cn(
              'w-full min-h-12 px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2',
              'border border-white/12 bg-white/5 text-white placeholder:text-white/30 focus:ring-layali-pink/50 focus:border-layali-pink/40'
            )}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-layali-pink/25 bg-black/25 p-4 sm:p-5 space-y-4">
        <div>
          <SectionTitle>{a.sectionReview}</SectionTitle>
          <p className="text-xs text-white/50 mt-2">{a.confirmHint}</p>
        </div>
        {summaryLines.length > 0 ? (
          <div className="text-sm text-white/85 whitespace-pre-line leading-relaxed">
            {summaryLines.join('\n')}
          </div>
        ) : (
          <p className="text-sm text-white/40">{a.confirmEmpty}</p>
        )}
        <label className="flex items-start gap-3 text-sm text-white cursor-pointer min-h-11">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              clearFieldError('confirm');
            }}
            className="mt-1 h-4 w-4 rounded"
          />
          <span>{a.confirmCheckbox}</span>
        </label>
        {fieldErrors.confirm ? <p className="text-sm text-red-400">{fieldErrors.confirm}</p> : null}
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1 min-h-12" onClick={onCancel}>
            {a.cancel}
          </Button>
        )}
        <Button type="submit" className="flex-1 min-h-12" loading={loading}>
          {submitLabel || a.confirmAddress}
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
export function addressDisplayLines(
  address: {
    address_line: string;
    city?: string | null;
    country?: string | null;
  },
  additionalLabel?: string
): string[] {
  return formatAddressSummaryLines(
    structuredFromStoredAddress({
      address_line: address.address_line,
      city: address.city,
      country: address.country,
    }),
    { additional: additionalLabel }
  );
}
