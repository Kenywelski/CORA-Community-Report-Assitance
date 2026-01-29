import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Crosshair, Loader2, ExternalLink } from 'lucide-react';

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  locationText?: string;
  onLocationTextChange?: (text: string) => void;
}

// Cortes, Surigao del Sur center coordinates
const DEFAULT_LAT = 8.3572;
const DEFAULT_LNG = 126.1836;

export const LocationPicker = ({
  latitude,
  longitude,
  onLocationChange,
  locationText = '',
  onLocationTextChange,
}: LocationPickerProps) => {
  const [lat, setLat] = useState<string>(latitude?.toString() || '');
  const [lng, setLng] = useState<string>(longitude?.toString() || '');
  const [isLocating, setIsLocating] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));
        onLocationChange(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enter coordinates manually or try again.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLatChange = (value: string) => {
    setLat(value);
    const numLat = parseFloat(value);
    const numLng = parseFloat(lng);
    if (!isNaN(numLat) && !isNaN(numLng)) {
      onLocationChange(numLat, numLng);
    }
  };

  const handleLngChange = (value: string) => {
    setLng(value);
    const numLat = parseFloat(lat);
    const numLng = parseFloat(value);
    if (!isNaN(numLat) && !isNaN(numLng)) {
      onLocationChange(numLat, numLng);
    }
  };

  const hasCoordinates = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const mapUrl = hasCoordinates 
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
    : `https://www.openstreetmap.org/#map=13/${DEFAULT_LAT}/${DEFAULT_LNG}`;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium flex items-center gap-2">
        <MapPin className="h-4 w-4" /> Location
      </label>

      {/* Address/Landmark input */}
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

      {/* Coordinate inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Latitude</label>
          <Input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => handleLatChange(e.target.value)}
            placeholder="e.g., 8.3572"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Longitude</label>
          <Input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => handleLngChange(e.target.value)}
            placeholder="e.g., 126.1836"
          />
        </div>
      </div>

      {/* Map preview link */}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground"
      >
        <MapPin className="h-4 w-4" />
        {hasCoordinates ? 'View location on map' : 'Open map to find coordinates'}
        <ExternalLink className="h-3 w-3" />
      </a>

      <p className="text-xs text-muted-foreground">
        Use the "Current Location" button or enter coordinates manually. You can also open the map link to find your location.
      </p>

      {hasCoordinates && (
        <p className="text-xs text-primary">
          📍 Location set: {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}
        </p>
      )}
    </div>
  );
};
