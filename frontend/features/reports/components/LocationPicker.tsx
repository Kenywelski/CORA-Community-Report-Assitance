import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Crosshair, Loader2, MapPin } from 'lucide-react';
import {
  PURISIMA_CENTER,
  VERIFIED_PURISIMA_BOUNDARY,
  verifyPointWithinBarangayBoundary,
} from '@/lib/purisimaGeo';
import {
  PurisimaBoundaryLayer,
  PurisimaMapController,
} from '@/features/maps/PurisimaBoundaryLayer';

// Fix Leaflet default icon paths in bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const REPORT_LOCATION_MARKER = L.divIcon({
  className: 'cora-report-location-marker',
  html: `
    <div style="width: 32px; height: 40px; display: flex; justify-content: center;">
      <svg width="32" height="40" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 5px rgba(15, 38, 42, 0.28));">
        <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.25 16.125 42.625 16.8125 43.14C17.5156 43.665 18.4844 43.665 19.1875 43.14C19.875 42.625 36 30.25 36 18C36 8.05887 27.9411 0 18 0Z" fill="#087E70"/>
        <circle cx="18" cy="17" r="7.5" fill="#FFFFFF"/>
        <circle cx="18" cy="17" r="3.5" fill="#F36B3F"/>
      </svg>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 39],
});

interface LocationPickerProps {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
  height?: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  zoomControlVariant?: 'default' | 'report';
  hideCoordinates?: boolean;
  focusOnValue?: boolean;
  markerVariant?: 'default' | 'report';
}

// Default center: Purisima, Tago, Surigao del Sur (OpenStreetMap place node 8928665117)
const DEFAULT_CENTER: [number, number] = PURISIMA_CENTER;

const ClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const LocationPicker = ({
  value,
  onChange,
  height = '280px',
  readOnly = false,
  hideLabel = false,
  zoomControlVariant = 'default',
  hideCoordinates = false,
  focusOnValue = false,
  markerVariant = 'default',
}: LocationPickerProps) => {
  const [locating, setLocating] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const mapKeyRef = useRef(`map-${Math.random()}`);

  const isWithinPurisima = (coords: { lat: number; lng: number }) => {
    const result = verifyPointWithinBarangayBoundary(
      coords,
      VERIFIED_PURISIMA_BOUNDARY
    );
    const isInside = result.hasVerifiedBoundary && result.isInside === true;
    setGeofenceError(
      isInside
        ? null
        : 'That location is outside the verified Barangay Purisima boundary. Please choose a point inside the outlined area.'
    );
    return isInside;
  };

  const selectedPointIsInside = value
    ? verifyPointWithinBarangayBoundary(value, VERIFIED_PURISIMA_BOUNDARY).isInside === true
    : false;

  const selectLocation = (coords: { lat: number; lng: number }) => {
    if (isWithinPurisima(coords)) onChange(coords);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      {(!hideLabel || !readOnly) && (
        <div className="flex items-center justify-between">
          {!hideLabel && (
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {readOnly ? 'Reported Location' : 'Tap on the map to pin location'}
            </label>
          )}
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3 mr-1" />}
              Use my location
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          key={mapKeyRef.current}
          className={zoomControlVariant === 'report' ? 'report-issue-map' : undefined}
          center={DEFAULT_CENTER}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          maxBoundsViscosity={1}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PurisimaBoundaryLayer />
          <PurisimaMapController
            fitPadding={[18, 18]}
            focusPoint={focusOnValue && value ? [value.lat, value.lng] : undefined}
          />
          {value && selectedPointIsInside && (
            <Marker
              position={[value.lat, value.lng]}
              {...(markerVariant === 'report' ? { icon: REPORT_LOCATION_MARKER } : {})}
            />
          )}
          {!readOnly && <ClickHandler onClick={(lat, lng) => selectLocation({ lat, lng })} />}
        </MapContainer>
      </div>

      {(geofenceError || (value && !selectedPointIsInside)) && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {geofenceError || 'The saved complaint location is outside the verified Barangay Purisima boundary.'}
          </span>
        </p>
      )}

      {value && selectedPointIsInside && !hideCoordinates && (
        <p className="text-xs text-muted-foreground">
          📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
};
