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
  onLocationChange?: (lat: number, lng: number) => void;
}

export function LocationMap(props: LocationMapProps) {
  return <LocationMapInner {...props} />;
}
