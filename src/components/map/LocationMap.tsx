'use client';

import dynamic from 'next/dynamic';

const LocationMapInner = dynamic(() => import('./LocationMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-xl border border-layali-pink/30 bg-layali-pink-light/20 flex items-center justify-center text-sm text-layali-black/50">
      Loading map...
    </div>
  ),
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
  editable?: boolean;
  height?: string;
  /** Increment to force the map to re-center (e.g. after live location) */
  centerKey?: number;
  /** When false, the map is a chooser — no pin is treated as a saved location. */
  showMarker?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

export function LocationMap(props: LocationMapProps) {
  return <LocationMapInner {...props} />;
}
