import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Crosshair, Loader2, MapPin } from 'lucide-react';

// Fix Leaflet default icon paths in bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
  height?: string;
  readOnly?: boolean;
}

// Default center: Cortes, Surigao del Sur
const DEFAULT_CENTER: [number, number] = [9.0167, 125.95];

const ClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const Recenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export const LocationPicker = ({ value, onChange, height = '280px', readOnly = false }: LocationPickerProps) => {
  const [locating, setLocating] = useState(false);
  const center: [number, number] = value ? [value.lat, value.lng] : DEFAULT_CENTER;
  const mapKeyRef = useRef(`map-${Math.random()}`);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {readOnly ? 'Reported Location' : 'Tap on the map to pin location'}
        </label>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3 mr-1" />}
            Use my location
          </Button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          key={mapKeyRef.current}
          center={center}
          zoom={value ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value && <Marker position={[value.lat, value.lng]} />}
          {value && <Recenter center={[value.lat, value.lng]} />}
          {!readOnly && <ClickHandler onClick={(lat, lng) => onChange({ lat, lng })} />}
        </MapContainer>
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
};
