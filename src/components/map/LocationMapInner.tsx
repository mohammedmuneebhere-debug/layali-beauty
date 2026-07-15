'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() || 15);
  }, [lat, lng, map]);
  return null;
}

function ClickToPin({
  editable,
  onPick,
}: {
  editable: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!editable) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface LocationMapInnerProps {
  latitude: number;
  longitude: number;
  editable?: boolean;
  height?: string;
  onLocationChange?: (lat: number, lng: number) => void;
}

export default function LocationMapInner({
  latitude,
  longitude,
  editable = false,
  height = '260px',
  onLocationChange,
}: LocationMapInnerProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-layali-pink/30 z-0" style={{ height }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        scrollWheelZoom={editable}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={latitude} lng={longitude} />
        <ClickToPin
          editable={editable}
          onPick={(lat, lng) => onLocationChange?.(lat, lng)}
        />
        <Marker
          position={[latitude, longitude]}
          icon={pinIcon}
          draggable={editable}
          eventHandlers={
            editable
              ? {
                  dragend: (e) => {
                    const marker = e.target as L.Marker;
                    const pos = marker.getLatLng();
                    onLocationChange?.(pos.lat, pos.lng);
                  },
                }
              : undefined
          }
        />
      </MapContainer>
    </div>
  );
}
