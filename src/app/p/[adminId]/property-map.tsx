'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useMemo } from 'react';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapProperty {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  currentRentAmount?: number;
  currency?: string;
}

export function PropertyMapComponent({
  properties,
}: {
  properties: MapProperty[];
}) {
  const center = useMemo<[number, number]>(() => {
    if (properties.length === 0) return [-34.6037, -58.3816];
    const lat = properties.reduce((s, p) => s + p.latitude, 0) / properties.length;
    const lng = properties.reduce((s, p) => s + p.longitude, 0) / properties.length;
    return [lat, lng];
  }, [properties]);

  if (properties.length === 0) return null;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '400px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {properties.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={markerIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{p.name}</p>
              <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>{p.address}</p>
              {p.currentRentAmount && (
                <p style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>
                  {p.currency === 'USD' ? 'USD' : '$'}{' '}
                  {p.currentRentAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/mes
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
