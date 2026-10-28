import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  ExternalLink,
  LocateFixed,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PURISIMA_CENTER,
  PURISIMA_COORDINATES,
  PURISIMA_DEFAULT_ZOOM,
  PURISIMA_INFO,
  VERIFIED_PURISIMA_BOUNDARY,
  getBoundaryBounds,
  getOpenStreetMapLargerUrl,
  getOpenStreetMapNodeUrl,
  isValidBoundaryGeoJSON,
  type VerifiedBoundaryMetadata,
} from '@/lib/purisimaGeo';

// Resilient SVG marker icon in CORA coastal teal so the marker never depends on external CDN images
const purisimaMarkerIcon = L.divIcon({
  className: 'cora-purisima-marker',
  html: `
    <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: flex-start; justify-content: center;">
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(15, 38, 42, 0.32));">
        <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.25 16.125 42.625 16.8125 43.14C17.5156 43.665 18.4844 43.665 19.1875 43.14C19.875 42.625 36 30.25 36 18C36 8.05887 27.9411 0 18 0Z" fill="hsl(174, 62%, 28%)"/>
        <circle cx="18" cy="17" r="7.5" fill="#FFFFFF"/>
        <circle cx="18" cy="17" r="3.5" fill="hsl(16, 85%, 58%)"/>
      </svg>
    </div>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  popupAnchor: [0, -38],
});

interface MapControllerProps {
  boundary: VerifiedBoundaryMetadata | null;
  onMapReady: (map: L.Map) => void;
}

const MapController = ({ boundary, onMapReady }: MapControllerProps) => {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (boundary && isValidBoundaryGeoJSON(boundary.geojson)) {
      const bounds = getBoundaryBounds(boundary.geojson);
      if (bounds) {
        map.fitBounds(bounds, { padding: [28, 28] });
      }
    }
  }, [boundary, map]);

  return null;
};

interface BarangayPurisimaMapProps {
  boundaryData?: VerifiedBoundaryMetadata | null;
  className?: string;
}

export const BarangayPurisimaMap = ({
  boundaryData = VERIFIED_PURISIMA_BOUNDARY,
  className,
}: BarangayPurisimaMapProps) => {
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tileErrorCount, setTileErrorCount] = useState(0);
  const [tileSuccessCount, setTileSuccessCount] = useState(0);
  const [tileLayerKey, setTileLayerKey] = useState(0);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState(false);

  const hasVerifiedBoundary = useMemo(
    () => Boolean(boundaryData && isValidBoundaryGeoJSON(boundaryData.geojson)),
    [boundaryData]
  );

  const hasTileFailure = tileErrorCount >= 4 && tileSuccessCount === 0;

  // Fallback timer so loading indicator clears even if cached tiles don't fire 'load'
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTilesLoading(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [tileLayerKey]);

  // Observe container resize so Leaflet recalculates tile layout across mobile/desktop breakpoints
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Invalidate Leaflet map size when entering or leaving fullscreen
  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    window.setTimeout(() => {
      map.invalidateSize();
      markerRef.current?.openPopup();
    }, 250);
  }, []);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (boundaryData && isValidBoundaryGeoJSON(boundaryData.geojson)) {
      const bounds = getBoundaryBounds(boundaryData.geojson);
      if (bounds) {
        map.fitBounds(bounds, { padding: [28, 28] });
        markerRef.current?.openPopup();
        return;
      }
    }
    map.setView(PURISIMA_CENTER, PURISIMA_DEFAULT_ZOOM, { animate: true });
    markerRef.current?.openPopup();
  };

  const handleToggleScrollZoom = () => {
    const map = mapInstanceRef.current;
    const next = !scrollZoomEnabled;
    setScrollZoomEnabled(next);
    if (map) {
      if (next) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    }
  };

  const handleToggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    const map = mapInstanceRef.current;
    if (map) {
      if (next) map.scrollWheelZoom.enable();
      else if (!scrollZoomEnabled) map.scrollWheelZoom.disable();
    }
  };

  const handleRetryTiles = () => {
    setTilesLoading(true);
    setTileErrorCount(0);
    setTileSuccessCount(0);
    setTileLayerKey((prev) => prev + 1);
  };

  const osmNodeUrl = getOpenStreetMapNodeUrl();
  const osmLargerUrl = getOpenStreetMapLargerUrl(16);

  return (
    <section
      id="explore-purisima"
      aria-labelledby="explore-purisima-heading"
      className={cn('mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-8', className)}
    >
      {/* Section Header */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
          Geographic Service Area
        </p>
        <h2
          id="explore-purisima-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
        >
          Explore Barangay Purisima
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] sm:text-base">
          Discover the location of Barangay Purisima, Tago, Surigao del Sur, and explore the community served by CORA.
        </p>
      </div>

      {/* Desktop: Two-column layout (Map left, Information Card right) | Mobile: Single-column (Map above Information Card) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left Column: Interactive Map */}
        <div
          ref={containerRef}
          className={cn(
            'flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-7',
            isFullscreen &&
              'fixed inset-3 z-50 m-0 rounded-2xl border-2 border-[#177A73]/40 bg-white shadow-2xl sm:inset-6'
          )}
          data-testid="purisima-map-card"
        >
          {/* Map Top Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#EAF6F4]/50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#142B38]">
              <MapPin className="h-4 w-4 shrink-0 text-[#177A73]" />
              <span>Barangay Purisima, Tago, Surigao del Sur</span>
              <span className="hidden text-[#64748B] sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden font-mono text-[11px] font-normal tabular-nums text-[#64748B] sm:inline">
                {PURISIMA_COORDINATES.lat.toFixed(5)}° N, {PURISIMA_COORDINATES.lng.toFixed(5)}° E
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="Zoom in map"
                title="Zoom in"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="Zoom out map"
                title="Zoom out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                aria-label="Center map on Barangay Purisima"
                title="Center on Barangay Purisima"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
              >
                <LocateFixed className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Reset Center</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen map' : 'Fullscreen map'}
                title={isFullscreen ? 'Exit fullscreen map' : 'Fullscreen map'}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-primary" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Map Viewport Container */}
          <div
            className={cn(
              'relative w-full bg-muted/30',
              isFullscreen
                ? 'min-h-[360px] flex-1'
                : 'h-[340px] min-h-[340px] sm:h-[390px] sm:min-h-[390px] lg:h-[420px] lg:min-h-[420px] lg:flex-1'
            )}
          >
            {/* Loading overlay while initial map tiles load */}
            {tilesLoading && !hasTileFailure && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[2px]"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs font-medium text-foreground">
                  Loading Barangay Purisima map…
                </p>
              </div>
            )}

            {/* Graceful fallback when map tiles cannot load */}
            {hasTileFailure ? (
              <div
                role="region"
                aria-label="Map fallback view"
                className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Map tiles could not be loaded right now
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Barangay Purisima is located in the Municipality of Tago, Surigao del Sur at verified coordinates{' '}
                    <span className="font-mono font-medium text-foreground">
                      {PURISIMA_COORDINATES.lat.toFixed(5)}° N, {PURISIMA_COORDINATES.lng.toFixed(5)}° E
                    </span>
                    .
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRetryTiles}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Map
                  </Button>
                  <a
                    href={osmNodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <span>Open in OpenStreetMap</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <MapContainer
                center={PURISIMA_CENTER}
                zoom={PURISIMA_DEFAULT_ZOOM}
                scrollWheelZoom={scrollZoomEnabled || isFullscreen}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  key={`osm-tiles-${tileLayerKey}`}
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  eventHandlers={{
                    loading: () => setTilesLoading(true),
                    load: () => setTilesLoading(false),
                    tileload: () => {
                      setTileSuccessCount((c) => c + 1);
                      setTilesLoading(false);
                    },
                    tileerror: () => {
                      setTileErrorCount((c) => c + 1);
                      setTilesLoading(false);
                    },
                  }}
                />

                {/* Verified Boundary Polygon (rendered ONLY when an authoritative GeoJSON polygon is provided) */}
                {hasVerifiedBoundary && boundaryData && (
                  <GeoJSON
                    data={boundaryData.geojson}
                    style={{
                      color: 'hsl(174, 62%, 28%)',
                      weight: 2.5,
                      opacity: 0.9,
                      fillColor: 'hsl(174, 62%, 28%)',
                      fillOpacity: 0,
                    }}
                  />
                )}

                {/* Verified Barangay Purisima Marker & Popup */}
                <Marker
                  ref={markerRef}
                  position={PURISIMA_CENTER}
                  icon={purisimaMarkerIcon}
                  title={PURISIMA_INFO.markerPopupText}
                  alt={PURISIMA_INFO.markerPopupText}
                  eventHandlers={{
                    add: (e) => {
                      e.target.openPopup();
                    },
                  }}
                >
                  <Popup closeButton={false} autoPan={false}>
                    <div className="p-0.5 text-left">
                      <p className="text-xs font-bold text-foreground">
                        {PURISIMA_INFO.markerPopupText}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {PURISIMA_COORDINATES.lat.toFixed(5)}° N, {PURISIMA_COORDINATES.lng.toFixed(5)}° E
                      </p>
                    </div>
                  </Popup>
                </Marker>

                <MapController boundary={boundaryData ?? null} onMapReady={handleMapReady} />
              </MapContainer>
            )}

            {/* Map Legend Overlay (Displays boundary legend when verified polygon is active) */}
            {hasVerifiedBoundary && boundaryData && (
              <div
                aria-label="Map legend"
                className="pointer-events-auto absolute bottom-3 left-3 z-[400] rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="inline-block h-3 w-4 rounded-sm border-2 border-primary bg-transparent"
                    aria-hidden="true"
                  />
                  <span>Barangay Purisima Boundary</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Source: {boundaryData.source} · Verified {boundaryData.verifiedAt}
                </p>
              </div>
            )}
          </div>

          {/* Map Footer Bar: Scroll Zoom Toggle, Verification Metadata & Open in OpenStreetMap Link */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-[#64748B]">
              <button
                type="button"
                onClick={handleToggleScrollZoom}
                className="text-xs font-medium text-[#142B38] underline-offset-4 hover:text-[#177A73] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
              >
                {scrollZoomEnabled ? 'Disable scroll zoom' : 'Enable scroll zoom'}
              </button>
              <span aria-hidden="true">·</span>
              <span className="text-[11px]">
                {hasVerifiedBoundary && boundaryData
                  ? `Boundary source: ${boundaryData.source} (Verified ${boundaryData.verifiedAt})`
                  : `Verified pin: ${PURISIMA_INFO.coordinateSource}`}
              </span>
            </div>

            <a
              href={osmNodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#177A73] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] whitespace-nowrap shrink-0"
            >
              <span>Open in OpenStreetMap</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Right Column: Barangay Purisima Information Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <div>
            {/* Card Header with Location Icon */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B]">
                  Official Service Area · PSGC {PURISIMA_INFO.psgcCode}
                </p>
                <h3 className="mt-0.5 text-xl font-bold tracking-tight text-[#142B38]">
                  {PURISIMA_INFO.barangay}
                </h3>
              </div>
            </div>

            {/* Structured Jurisdiction Details */}
            <dl className="mt-6 divide-y divide-slate-100 border-y border-slate-200 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Municipality</dt>
                <dd className="font-semibold text-[#142B38]">{PURISIMA_INFO.municipality}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Province</dt>
                <dd className="font-semibold text-[#142B38]">{PURISIMA_INFO.province}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Country</dt>
                <dd className="font-semibold text-[#142B38]">{PURISIMA_INFO.country}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Region &amp; Postal Code</dt>
                <dd className="font-medium tabular-nums text-[#142B38]">
                  {PURISIMA_INFO.region} · {PURISIMA_INFO.postalCode}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Coordinates</dt>
                <dd className="font-mono text-xs font-medium tabular-nums text-[#142B38]">
                  {PURISIMA_COORDINATES.lat.toFixed(5)}° N, {PURISIMA_COORDINATES.lng.toFixed(5)}° E
                </dd>
              </div>
            </dl>

            {/* Community Description */}
            <p className="mt-5 text-sm leading-relaxed text-[#64748B]">
              {PURISIMA_INFO.description}
            </p>

            {/* Geographic Data Integrity Note */}
            <div className="mt-4 rounded-xl bg-[#EAF6F4]/60 p-3.5 text-xs leading-relaxed text-[#64748B]">
              <div className="flex items-center gap-1.5 font-semibold text-[#142B38]">
                <Compass className="h-3.5 w-3.5 text-[#177A73]" />
                <span>Geographic Reference Note</span>
              </div>
              <p className="mt-1">
                {hasVerifiedBoundary && boundaryData
                  ? `Official barangay boundary polygon displayed from ${boundaryData.source} (last verified ${boundaryData.verifiedAt}).`
                  : `Centered on OpenStreetMap Place Node #${PURISIMA_INFO.osmNodeId} (last verified ${PURISIMA_INFO.lastVerifiedDate}). An official administrative boundary polygon is not plotted on this public map; submitted issue reports validate exact incident coordinates separately.`}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <a
              href={osmLargerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#177A73] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#13635d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] whitespace-nowrap"
            >
              <span>View Larger Map</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetView}
              className="h-10 gap-1.5 rounded-xl border-slate-200 text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73] whitespace-nowrap"
            >
              <LocateFixed className="h-4 w-4 text-[#177A73]" />
              <span>Center Pin</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BarangayPurisimaMap;
