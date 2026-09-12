'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Standard Leaflet pin tip sits at bottom-center of the 25×41 icon. */
const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function Recenter({
  lat,
  lng,
  centerKey,
}: {
  lat: number;
  lng: number;
  centerKey: number;
}) {
  const map = useMap();
  const lastKey = useRef<number | null>(null);

  useEffect(() => {
    if (lastKey.current === centerKey) return;
    lastKey.current = centerKey;
    map.setView([lat, lng], Math.max(map.getZoom() || 16, 16));
  }, [lat, lng, centerKey, map]);

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

function DraggablePin({
  latitude,
  longitude,
  editable,
  onLocationChange,
}: {
  latitude: number;
  longitude: number;
  editable: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}) {
  // During drag, use local coords; otherwise use raw prop coords (full GPS precision).
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<[number, number]>([latitude, longitude]);
  const position: [number, number] = dragging ? dragPos : [latitude, longitude];

  return (
    <Marker
      position={position}
      icon={pinIcon}
      draggable={editable}
      eventHandlers={
        editable
          ? {
              dragstart: () => {
                setDragging(true);
                setDragPos([latitude, longitude]);
              },
              drag: (e) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                setDragPos([pos.lat, pos.lng]);
              },
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                setDragPos([pos.lat, pos.lng]);
                setDragging(false);
                onLocationChange?.(pos.lat, pos.lng);
              },
            }
          : undefined
      }
    />
  );
}

interface LocationMapInnerProps {
  latitude: number;
  longitude: number;
  editable?: boolean;
  height?: string;
  centerKey?: number;
  onLocationChange?: (lat: number, lng: number) => void;
}

export default function LocationMapInner({
  latitude,
  longitude,
  editable = false,
  height = '260px',
  centerKey = 0,
  onLocationChange,
}: LocationMapInnerProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden border border-layali-pink/30 relative z-0 ${editable ? 'touch-manipulation' : ''}`}
      style={{ height }}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        scrollWheelZoom={editable}
        dragging
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={latitude} lng={longitude} centerKey={centerKey} />
        <ClickToPin
          editable={editable}
          onPick={(lat, lng) => onLocationChange?.(lat, lng)}
        />
        <DraggablePin
          latitude={latitude}
          longitude={longitude}
          editable={editable}
          onLocationChange={onLocationChange}
        />
      </MapContainer>
    </div>
  );
}
