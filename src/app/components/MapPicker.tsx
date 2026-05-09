"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Circle } from "react-leaflet";
import L from "leaflet";

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  radius?: number;
}

function MapUpdater({ lat, lng }: { lat: number | null, lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ lat, lng, onChange, radius }: MapPickerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-[300px] w-full bg-kimaya-cream-light rounded-xl animate-pulse flex items-center justify-center text-xs text-kimaya-brown-light/30">Loading map...</div>;

  const defaultCenter: [number, number] = [lat || -6.2000, lng || 106.8166];

  return (
    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-kimaya-cream-dark/30 mt-2 z-0">
      <MapContainer center={defaultCenter} zoom={15} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onClick={onChange} />
        <MapUpdater lat={lat} lng={lng} />
        
        {lat !== null && lng !== null && (
          <>
            <Marker 
              position={[lat, lng]} 
              draggable={true} 
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  onChange(pos.lat, pos.lng);
                }
              }} 
            />
            {radius && (
              <Circle
                center={[lat, lng]}
                radius={radius}
                pathOptions={{ 
                  fillColor: '#5B633D', 
                  color: '#5B633D', 
                  weight: 1, 
                  opacity: 0.5, 
                  fillOpacity: 0.2 
                }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
