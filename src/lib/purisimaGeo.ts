import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface VerifiedBoundaryMetadata {
  name: string;
  municipality: string;
  province: string;
  country: string;
  source: string;
  verifiedAt: string;
  psgcCode: string;
  geojson: Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;
}

/**
 * Verified geographic coordinates of Barangay Purisima (Pob.),
 * Municipality of Tago, Province of Surigao del Sur, Caraga (Region XIII), Philippines.
 *
 * Verified Reference:
 * - OpenStreetMap Place Node ID: 8928665117
 * - Philippine Standard Geographic Code (PSGC): 1606818018
 * - Postal Code: 8302
 * - Coordinates: 9.0178894° N, 126.2335553° E
 */
export const PURISIMA_COORDINATES: LatLngLiteral = {
  lat: 9.0178894,
  lng: 126.2335553,
};

export const PURISIMA_CENTER: [number, number] = [
  PURISIMA_COORDINATES.lat,
  PURISIMA_COORDINATES.lng,
];

export const PURISIMA_DEFAULT_ZOOM = 15;

export const PURISIMA_INFO = {
  barangay: 'Barangay Purisima',
  municipality: 'Tago',
  province: 'Surigao del Sur',
  region: 'Caraga (Region XIII)',
  country: 'Philippines',
  postalCode: '8302',
  psgcCode: '1606818018',
  osmNodeId: '8928665117',
  markerPopupText: 'Barangay Purisima, Tago, Surigao del Sur',
  coordinateSource: 'OpenStreetMap Place Node #8928665117 & PSGC #1606818018',
  lastVerifiedDate: 'October 2026',
  description:
    'Barangay Purisima is a coastal-riverine poblacion community in the Municipality of Tago, Surigao del Sur. CORA serves residents of Barangay Purisima by connecting community reports, local announcements, and municipal response teams in one platform.',
} as const;

/**
 * Authoritative GeoJSON boundary polygon for Barangay Purisima.
 *
 * Per geographic integrity rules:
 * - Only an authoritative, verified polygon boundary may be rendered as the official barangay boundary.
 * - OpenStreetMap currently records Barangay Purisima as a verified Place Node (#8928665117)
 *   without an official administrative boundary relation polygon.
 * - Never substitute an estimated or hand-drawn polygon as an official boundary.
 */
export const VERIFIED_PURISIMA_BOUNDARY: VerifiedBoundaryMetadata | null = null;

/**
 * Builds a direct link to the OpenStreetMap page for Barangay Purisima.
 */
export function getOpenStreetMapNodeUrl(): string {
  const { lat, lng } = PURISIMA_COORDINATES;
  return `https://www.openstreetmap.org/node/${PURISIMA_INFO.osmNodeId}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`;
}

/**
 * Builds a full-view OpenStreetMap URL with a marker pin at Barangay Purisima.
 */
export function getOpenStreetMapLargerUrl(zoom = 16): string {
  const { lat, lng } = PURISIMA_COORDINATES;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/**
 * Validates whether a candidate GeoJSON object contains a valid Polygon or MultiPolygon geometry.
 */
export function isValidBoundaryGeoJSON(
  input: unknown
): input is Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon> {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;

  const isPolygonGeometry = (geom: unknown): geom is Polygon | MultiPolygon => {
    if (!geom || typeof geom !== 'object') return false;
    const g = geom as Geometry;
    if (g.type === 'Polygon') {
      return (
        Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 &&
        Array.isArray(g.coordinates[0]) &&
        g.coordinates[0].length >= 4
      );
    }
    if (g.type === 'MultiPolygon') {
      return (
        Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 &&
        Array.isArray(g.coordinates[0]) &&
        Array.isArray(g.coordinates[0][0]) &&
        g.coordinates[0][0].length >= 4
      );
    }
    return false;
  };

  if (obj.type === 'Feature') {
    return isPolygonGeometry(obj.geometry);
  }

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features) && obj.features.length > 0) {
    return obj.features.every(
      (f) => f && typeof f === 'object' && (f as Record<string, unknown>).type === 'Feature' && isPolygonGeometry((f as Feature).geometry)
    );
  }

  return false;
}

/**
 * Extracts all [lat, lng] pairs from a verified Polygon or MultiPolygon GeoJSON.
 */
export function extractLatLngPoints(
  geojson: Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>
): [number, number][] {
  const points: [number, number][] = [];

  const collectFromGeometry = (geom: Polygon | MultiPolygon) => {
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            points.push([coord[1], coord[0]]);
          }
        }
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          for (const coord of ring) {
            if (Array.isArray(coord) && coord.length >= 2) {
              points.push([coord[1], coord[0]]);
            }
          }
        }
      }
    }
  };

  if (geojson.type === 'Feature') {
    collectFromGeometry(geojson.geometry);
  } else if (geojson.type === 'FeatureCollection') {
    for (const feature of geojson.features) {
      collectFromGeometry(feature.geometry);
    }
  }

  return points;
}

/**
 * Computes Leaflet-compatible [[minLat, minLng], [maxLat, maxLng]] bounds for a verified boundary.
 */
export function getBoundaryBounds(
  geojson: Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>
): [[number, number], [number, number]] | null {
  const pts = extractLatLngPoints(geojson);
  if (pts.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Ray-casting point-in-ring check for [lng, lat] GeoJSON ring.
 */
function isPointInRing(point: LatLngLiteral, ring: number[][]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if a coordinate lies inside a single Polygon (accounting for exterior ring and holes).
 */
function isPointInSinglePolygon(point: LatLngLiteral, rings: number[][][]): boolean {
  if (!rings.length || !isPointInRing(point, rings[0])) {
    return false;
  }
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(point, rings[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Separate geofencing helper for report validation.
 *
 * IMPORTANT: The public landing page marker is for public geographic information only
 * and is NEVER treated as proof that a submitted report is inside the barangay.
 * Geofencing verification requires an authoritative boundary polygon.
 */
export function verifyPointWithinBarangayBoundary(
  point: LatLngLiteral,
  boundary: VerifiedBoundaryMetadata | null = VERIFIED_PURISIMA_BOUNDARY
): {
  hasVerifiedBoundary: boolean;
  isInside: boolean | null;
  source: string | null;
} {
  if (!boundary || !isValidBoundaryGeoJSON(boundary.geojson)) {
    return {
      hasVerifiedBoundary: false,
      isInside: null,
      source: null,
    };
  }

  const checkGeom = (geom: Polygon | MultiPolygon): boolean => {
    if (geom.type === 'Polygon') {
      return isPointInSinglePolygon(point, geom.coordinates);
    }
    return geom.coordinates.some((polyCoords) => isPointInSinglePolygon(point, polyCoords));
  };

  let inside = false;
  if (boundary.geojson.type === 'Feature') {
    inside = checkGeom(boundary.geojson.geometry);
  } else {
    inside = boundary.geojson.features.some((f) => checkGeom(f.geometry));
  }

  return {
    hasVerifiedBoundary: true,
    isInside: inside,
    source: boundary.source,
  };
}
