import { useEffect, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  VERIFIED_PURISIMA_BOUNDARY,
  getBoundaryBounds,
  getBoundaryMaskGeoJSON,
  isValidBoundaryGeoJSON,
  type VerifiedBoundaryMetadata,
} from '@/lib/purisimaGeo';

const DEFAULT_FIT_PADDING: [number, number] = [24, 24];

interface PurisimaBoundaryLayerProps {
  boundary?: VerifiedBoundaryMetadata;
  maskOpacity?: number;
}

export const PurisimaBoundaryLayer = ({
  boundary = VERIFIED_PURISIMA_BOUNDARY,
  maskOpacity = 0.78,
}: PurisimaBoundaryLayerProps) => {
  const mask = useMemo(
    () => getBoundaryMaskGeoJSON(boundary.geojson),
    [boundary]
  );

  return (
    <>
      <GeoJSON
        data={mask}
        interactive={false}
        style={{
          stroke: false,
          fill: true,
          fillColor: '#0f172a',
          fillOpacity: maskOpacity,
          fillRule: 'evenodd',
        }}
      />
      <GeoJSON
        data={boundary.geojson}
        interactive={false}
        style={{
          color: '#087e70',
          weight: 3,
          opacity: 1,
          fillColor: '#10b981',
          fillOpacity: 0.06,
        }}
      />
    </>
  );
};

interface PurisimaMapControllerProps {
  boundary?: VerifiedBoundaryMetadata;
  onMapReady?: (map: L.Map) => void;
  fitPadding?: [number, number];
  focusPoint?: [number, number];
}

/** Fits the full barangay, keeps it visible after responsive resizes, and
 * prevents panning the map away from the verified boundary. */
export const PurisimaMapController = ({
  boundary = VERIFIED_PURISIMA_BOUNDARY,
  onMapReady,
  fitPadding = DEFAULT_FIT_PADDING,
  focusPoint,
}: PurisimaMapControllerProps) => {
  const map = useMap();
  const paddingX = fitPadding[0];
  const paddingY = fitPadding[1];
  const focusLatitude = focusPoint?.[0];
  const focusLongitude = focusPoint?.[1];

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (!isValidBoundaryGeoJSON(boundary.geojson)) return;
    const boundsTuple = getBoundaryBounds(boundary.geojson);
    if (!boundsTuple) return;

    const boundaryBounds = L.latLngBounds(boundsTuple);
    const navigationBounds = boundaryBounds.pad(0.08);
    let resizeTimer = 0;

    const fitBoundary = () => {
      map.invalidateSize({ pan: false });
      map.setMinZoom(0);
      map.setMaxBounds(navigationBounds);
      map.options.maxBoundsViscosity = 1;
      if (focusLatitude !== undefined && focusLongitude !== undefined) {
        map.setView([focusLatitude, focusLongitude], 17, { animate: false });
        map.setMinZoom(12);
      } else {
        map.fitBounds(boundaryBounds, {
          padding: [paddingX, paddingY],
          animate: false,
          maxZoom: 17,
        });
        map.setMinZoom(Math.max(12, map.getZoom()));
      }
    };

    const keepInside = () => map.panInsideBounds(navigationBounds, { animate: false });
    fitBoundary();
    map.on('drag', keepInside);

    const container = map.getContainer();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(fitBoundary, 80);
        })
      : null;
    observer?.observe(container);

    return () => {
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
      map.off('drag', keepInside);
    };
  }, [boundary, focusLatitude, focusLongitude, map, paddingX, paddingY]);

  return null;
};

