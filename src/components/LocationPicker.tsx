import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  locationText?: string;
  onLocationTextChange?: (text: string) => void;
}

// Cortes, Surigao del Sur center coordinates
const DEFAULT_CENTER: [number, number] = [8.3572, 126.1836];

export const LocationPicker = ({
  latitude,
  longitude,
  onLocationChange,
  locationText = '',
  onLocationTextChange,
}: LocationPickerProps) => {
  const [position, setPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const mapRef = useState<any>(null);

  // Dynamically import Leaflet to avoid SSR issues
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        const L = await import('leaflet');
        const RL = await import('react-leaflet');
        
        // Import CSS
        await import('leaflet/dist/leaflet.css');
        
        // Fix Leaflet default marker icon
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
        
        setMapComponents({
          MapContainer: RL.MapContainer,
          TileLayer: RL.TileLayer,
          Marker: RL.Marker,
          useMapEvents: RL.useMapEvents,
          useMap: RL.useMap,
        });
        setMapLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };
    
    loadLeaflet();
  }, []);

  const handlePositionChange = useCallback((lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationChange(lat, lng);
  }, [onLocationChange]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        onLocationChange(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Map click handler component
  const LocationMarker = ({ onPositionChange }: { onPositionChange: (lat: number, lng: number) => void }) => {
    if (!MapComponents) return null;
    
    MapComponents.useMapEvents({
      click(e: any) {
        onPositionChange(e.latlng.lat, e.latlng.lng);
      },
    });

    return position ? <MapComponents.Marker position={position} /> : null;
  };

  // Map center controller
  const MapController = ({ center }: { center: [number, number] }) => {
    if (!MapComponents) return null;
    
    const map = MapComponents.useMap();
    
    useEffect(() => {
      if (map && center) {
        map.setView(center, map.getZoom());
      }
    }, [center, map]);
    
    return null;
  };

  const mapCenter = position || DEFAULT_CENTER;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium flex items-center gap-2">
        <MapPin className="h-4 w-4" /> Location
      </label>

      {/* Address input */}
      <Input
        value={locationText}
        onChange={(e) => onLocationTextChange?.(e.target.value)}
        placeholder="Enter address or landmark description"
      />

      {/* Get current location button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={getCurrentLocation}
        disabled={isLocating}
        className="w-full"
      >
        {isLocating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Crosshair className="h-4 w-4 mr-2" />
        )}
        Use My Current Location
      </Button>

      {/* Map */}
      <div className="h-64 rounded-xl overflow-hidden border border-border bg-muted">
        {mapLoaded && MapComponents ? (
          <MapComponents.MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapComponents.TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={mapCenter} />
            <LocationMarker onPositionChange={handlePositionChange} />
          </MapComponents.MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tap on the map to mark the exact location, or use the button above to use your current location.
      </p>

      {position && (
        <p className="text-xs text-primary">
          📍 Location set: {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </p>
      )}
    </div>
  );
};
