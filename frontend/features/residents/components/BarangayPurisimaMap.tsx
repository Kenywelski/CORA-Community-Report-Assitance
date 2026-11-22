import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
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
  PurisimaBoundaryLayer,
  PurisimaMapController,
} from '@/features/maps/PurisimaBoundaryLayer';
import {
  PURISIMA_CENTER,
  PURISIMA_DEFAULT_ZOOM,
  PURISIMA_INFO,
  VERIFIED_PURISIMA_BOUNDARY,
  getBoundaryBounds,
  getOpenStreetMapNodeUrl,
  isValidBoundaryGeoJSON,
  type VerifiedBoundaryMetadata,
} from '@/lib/purisimaGeo';

interface BarangayPurisimaMapProps {
  boundaryData?: VerifiedBoundaryMetadata;
  className?: string;
}

export const BarangayPurisimaMap = ({
  boundaryData = VERIFIED_PURISIMA_BOUNDARY,
  className,
}: BarangayPurisimaMapProps) => {
  const mapInstanceRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tileErrorCount, setTileErrorCount] = useState(0);
  const [tileSuccessCount, setTileSuccessCount] = useState(0);
  const [tileLayerKey, setTileLayerKey] = useState(0);

  const hasVerifiedBoundary = useMemo(
    () => Boolean(boundaryData && isValidBoundaryGeoJSON(boundaryData.geojson)),
    [boundaryData]
  );

  const hasTileFailure = tileErrorCount >= 4 && tileSuccessCount === 0;

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
    const map = mapInstanceRef.current;
    if (isFullscreen) map?.scrollWheelZoom.enable();
    else map?.scrollWheelZoom.disable();

    const timer = window.setTimeout(() => {
      map?.invalidateSize();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  // Keep React state synchronized when the browser enters or exits native fullscreen.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Prevent the page behind the map from scrolling when native fullscreen is unavailable.
  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement === containerRef.current) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Hide admin layout elements and use proper fullscreen when map is fullscreen
  useEffect(() => {
    const adminLayout = document.querySelector<HTMLElement>('.admin-layout');
    const adminSidebar = document.getElementById('admin-sidebar');
    const adminHeader = document.querySelector<HTMLElement>('main > header');
    const adminContent = document.querySelector<HTMLElement>('main > div');
    const html = document.documentElement;
    const body = document.body;
    
    if (isFullscreen) {
      // Hide all admin elements
      if (adminLayout) adminLayout.style.display = 'none';
      if (adminSidebar) adminSidebar.style.display = 'none';
      if (adminHeader) adminHeader.style.display = 'none';
      if (adminContent) adminContent.style.display = 'none';
      
      // Hide scrollbars and ensure fullscreen
      html.style.overflow = 'hidden';
      html.style.height = '100%';
      html.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.height = '100vh';
      body.style.width = '100vw';
      body.style.margin = '0';
      body.style.padding = '0';
    } else {
      // Restore all admin elements
      if (adminLayout) adminLayout.style.display = '';
      if (adminSidebar) adminSidebar.style.display = '';
      if (adminHeader) adminHeader.style.display = '';
      if (adminContent) adminContent.style.display = '';
      
      html.style.overflow = '';
      html.style.height = '';
      html.style.width = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.width = '';
      body.style.margin = '';
      body.style.padding = '';
    }
    
    return () => {
      html.style.overflow = '';
      html.style.height = '';
      html.style.width = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.width = '';
      body.style.margin = '';
      body.style.padding = '';
    };
  }, [isFullscreen]);

  // Sync scroll wheel zoom and map size with fullscreen state
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    if (isFullscreen) {
      map.scrollWheelZoom.enable();
      // Delay to ensure proper resize when entering fullscreen
      const timer = window.setTimeout(() => {
        map.invalidateSize();
      }, 150);
      return () => window.clearTimeout(timer);
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [isFullscreen]);

  // Keep React state in sync with browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle Escape key
  useEffect(() => {
    if (!isFullscreen) return;

    const handleEscape = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await document.exitFullscreen().catch(() => {
          // Browser may prevent exit
        });
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    window.setTimeout(() => {
      map.invalidateSize();
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
        return;
      }
    }
    map.setView(PURISIMA_CENTER, PURISIMA_DEFAULT_ZOOM, { animate: true });
  };

  const handleToggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }

    try {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      // Some embedded browsers block the Fullscreen API; retain a true viewport fallback.
      setIsFullscreen(true);
    }
  };

  const handleRetryTiles = () => {
    setTilesLoading(true);
    setTileErrorCount(0);
    setTileSuccessCount(0);
    setTileLayerKey((prev) => prev + 1);
  };

  const osmNodeUrl = getOpenStreetMapNodeUrl();

  return (
    <section
      id="explore-purisima"
      aria-labelledby="explore-purisima-heading"
      className={cn('mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-8', className)}
    >
      {/* Section Header */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
          Location Map
        </p>
        <h2
          id="explore-purisima-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
        >
          Find Barangay Purisima
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] sm:text-base">
          The pin shows the community's location in Tago, Surigao del Sur. Drag the map to look around, or use the buttons to zoom.
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
              'fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] m-0 h-[100dvh] w-[100vw] max-w-none max-h-[100dvh] rounded-none border-0 bg-white shadow-none'
          )}
          data-testid="purisima-map-card"
        >
          {/* Map Top Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#EAF6F4]/50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5 text-[#142B38]">
              <MapPin className="h-4 w-4 shrink-0 text-[#177A73]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold sm:text-sm">Barangay Purisima</p>
                <p className="truncate text-[11px] text-[#64748B]">Tago, Surigao del Sur</p>
              </div>
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
                <span className="hidden sm:inline">Center Map</span>
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
                    <span>Exit</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Full Screen</span>
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
                ? 'h-full flex-1'
                : 'h-[340px] min-h-[340px] sm:h-[390px] sm:min-h-[390px] lg:h-auto lg:min-h-[250px] lg:flex-1'
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
                  Loading map…
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
                    The map is unavailable right now
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    You can try loading it again or open the location in a larger map.
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
                    <span>Open Larger Map</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <MapContainer
                center={PURISIMA_CENTER}
                zoom={PURISIMA_DEFAULT_ZOOM}
                scrollWheelZoom={isFullscreen}
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

                {/* Verified boundary plus inverse mask: roads/buildings remain visible only inside Purisima. */}
                {hasVerifiedBoundary && boundaryData && (
                  <PurisimaBoundaryLayer boundary={boundaryData} />
                )}

                {boundaryData && (
                  <PurisimaMapController
                    boundary={boundaryData}
                    onMapReady={handleMapReady}
                    fitPadding={[28, 28]}
                  />
                )}
              </MapContainer>
            )}

          </div>

          {/* Simple map instructions and larger-map link */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs">
            <p className="text-[11px] leading-relaxed text-[#64748B] sm:text-xs">
              Drag to move the map. Use <strong className="font-semibold text-[#142B38]">+</strong> and <strong className="font-semibold text-[#142B38]">−</strong> to zoom.
            </p>

            <a
              href={osmNodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#177A73] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] whitespace-nowrap shrink-0"
            >
              <span>Open Larger Map</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Right Column: Barangay Purisima Information Card */}
        <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <div>
            {/* Card Header with Location Icon */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="pt-2 text-xl font-bold tracking-tight text-[#142B38]">Location Details</h3>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-[#64748B]">
              This is the barangay served by CORA. Residents can use the system to report local concerns and view community updates.
            </p>

            {/* Simple location details */}
            <dl className="mt-6 divide-y divide-slate-100 border-y border-slate-200 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#64748B]">Town</dt>
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
                <dt className="text-[#64748B]">Postal Code</dt>
                <dd className="font-semibold tabular-nums text-[#142B38]">{PURISIMA_INFO.postalCode}</dd>
              </div>
            </dl>

          </div>
        </div>
      </div>
    </section>
  );
};

export default BarangayPurisimaMap;
