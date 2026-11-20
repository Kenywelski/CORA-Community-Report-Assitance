import {
  PURISIMA_COORDINATES,
  VERIFIED_PURISIMA_BOUNDARY,
  verifyPointWithinBarangayBoundary,
} from './purisimaGeo.ts';

export type ApprovedConcernCategoryKey =
  | 'garbage'
  | 'street_light'
  | 'drainage'
  | 'road_damage';

export interface ApprovedConcernCategory {
  key: ApprovedConcernCategoryKey;
  label: string;
  reportCategoryValue: string;
  shortDescription: string;
  conservativeTemplate: string;
  aliases: string[];
}

export const APPROVED_CONCERN_CATEGORIES: ApprovedConcernCategory[] = [
  {
    key: 'garbage',
    label: 'Improper Waste Disposal',
    reportCategoryValue: 'Report: Improper Waste Disposal',
    shortDescription: 'Uncollected waste, illegal dumping, or roadside litter accumulation.',
    conservativeTemplate:
      'Improperly disposed waste is visible in the submitted photo. The concern has been logged for waste management action in Barangay Purisima.',
    aliases: [
      'waste',
      'improper_waste_disposal',
      'improper waste disposal',
      'garbage',
      'waste_disposal',
      'waste problem',
      'garbage problem',
      'litter',
      'solid waste',
    ],
  },
  {
    key: 'street_light',
    label: 'Streetlight Problem',
    reportCategoryValue: 'Report: Streetlight Problem',
    shortDescription: 'Non-functioning, flickering, or damaged street lighting fixtures.',
    conservativeTemplate:
      'A streetlight fixture concern is visible in the submitted photo. The lighting post has been logged for maintenance or repair in Barangay Purisima.',
    aliases: [
      'streetlights',
      'street_lights',
      'street lights',
      'streetlight_problem',
      'streetlight problem',
      'street_light',
      'street light',
      'streetlight',
      'lighting',
    ],
  },
  {
    key: 'drainage',
    label: 'Drainage/Flooding Concern',
    reportCategoryValue: 'Report: Drainage/Flooding Concern',
    shortDescription: 'Clogged canals, blocked drainage waterways, or localized water accumulation.',
    conservativeTemplate:
      'A drainage or flooding concern is visible in the submitted photo. The affected waterway in Barangay Purisima has been logged for clearing and response.',
    aliases: [
      'drainage',
      'drainage_flooding_concern',
      'drainage/flooding concern',
      'drainage problem',
      'flooding',
      'canal',
      'clogged_drainage',
    ],
  },
  {
    key: 'road_damage',
    label: 'Road Damage',
    reportCategoryValue: 'Report: Road Damage',
    shortDescription: 'Potholes, cracked concrete pavement, or damaged public pathways.',
    conservativeTemplate:
      'A road surface damage concern is visible in the submitted photo. The affected road section in Barangay Purisima has been logged for maintenance action.',
    aliases: [
      'road',
      'roads',
      'road_damage',
      'road damage',
      'road problem',
      'pothole',
      'pavement_damage',
      'cracked_road',
    ],
  },
];

export const MAX_GPS_ACCURACY_METERS = 100;
export const MAX_GPS_AGE_MS = 60_000;
export const MAX_PURISIMA_SCOPE_METERS = 3500;

export interface CapturedGpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
  locationTimestamp: number;
  capturedAtTimestamp: number;
}

export interface GpsValidationResult {
  isValid: boolean;
  isFresh: boolean;
  isAccurate: boolean;
  isWithinBarangayScope: boolean;
  hasAuthoritativeBoundary: boolean;
  ageSeconds: number;
  accuracyMeters: number;
  distanceFromPurisimaMeters: number;
  issues: string[];
  statusLabel: string;
  statusMessage: string;
}

export function resolveApprovedCategory(
  rawLabel: string | null | undefined,
): ApprovedConcernCategory | null {
  if (!rawLabel) return null;
  const normalized = rawLabel
    .trim()
    .toLowerCase()
    .replace(/^report:\s*/i, '')
    .replace(/^\[report\]\s*/i, '')
    .trim();

  return (
    APPROVED_CONCERN_CATEGORIES.find(
      (category) =>
        category.key === normalized ||
        category.label.toLowerCase() === normalized ||
        category.reportCategoryValue.toLowerCase() === normalized ||
        category.aliases.includes(normalized) ||
        category.aliases.some((alias) => normalized.includes(alias)),
    ) ?? null
  );
}

export function getApprovedCategoryLabel(rawLabel: string | null | undefined): string {
  return (
    resolveApprovedCategory(rawLabel)?.label ??
    rawLabel?.trim().replace(/^report:\s*/i, '') ??
    'Uncategorized'
  );
}

export function calculateDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const halfChord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
}

export function validateCapturedGpsLocation(
  reading: CapturedGpsReading | null,
  referenceNowMs = Date.now(),
): GpsValidationResult {
  if (!reading || !Number.isFinite(reading.lat) || !Number.isFinite(reading.lng)) {
    return {
      isValid: false,
      isFresh: false,
      isAccurate: false,
      isWithinBarangayScope: false,
      hasAuthoritativeBoundary: false,
      ageSeconds: 0,
      accuracyMeters: Infinity,
      distanceFromPurisimaMeters: Infinity,
      issues: ['Device GPS coordinates have not been captured yet.'],
      statusLabel: 'Location Required',
      statusMessage:
        'Please allow device GPS access so your report location in Barangay Purisima can be verified.',
    };
  }

  const issues: string[] = [];
  const ageSeconds = Math.round(Math.max(0, referenceNowMs - reading.locationTimestamp) / 1000);
  const isFresh = ageSeconds * 1000 <= MAX_GPS_AGE_MS;
  if (!isFresh) issues.push(`Location reading is ${ageSeconds}s old (maximum is 60 seconds).`);

  const accuracyMeters = Math.round(reading.accuracyMeters);
  const isAccurate =
    Number.isFinite(reading.accuracyMeters) &&
    reading.accuracyMeters > 0 &&
    reading.accuracyMeters <= MAX_GPS_ACCURACY_METERS;
  if (!isAccurate) issues.push(`GPS accuracy is ±${accuracyMeters}m (100m or better is required).`);

  const distanceFromPurisimaMeters = Math.round(
    calculateDistanceMeters({ lat: reading.lat, lng: reading.lng }, PURISIMA_COORDINATES),
  );
  const boundaryCheck = verifyPointWithinBarangayBoundary(
    { lat: reading.lat, lng: reading.lng },
    VERIFIED_PURISIMA_BOUNDARY,
  );
  const isWithinBarangayScope =
    boundaryCheck.hasVerifiedBoundary && boundaryCheck.isInside !== null
      ? boundaryCheck.isInside
      : distanceFromPurisimaMeters <= MAX_PURISIMA_SCOPE_METERS;

  if (!isWithinBarangayScope) {
    issues.push(
      boundaryCheck.hasVerifiedBoundary
        ? 'Captured GPS coordinates are outside the verified Barangay Purisima boundary.'
        : `Captured GPS coordinates are ${(distanceFromPurisimaMeters / 1000).toFixed(1)} km away from Barangay Purisima.`,
    );
  }

  const isValid = isFresh && isAccurate && isWithinBarangayScope;
  const statusLabel = isValid
    ? 'Location Verified'
    : !isWithinBarangayScope
      ? 'Outside Barangay Scope'
      : !isAccurate
        ? 'Low GPS Accuracy'
        : 'Stale GPS Reading';

  return {
    isValid,
    isFresh,
    isAccurate,
    isWithinBarangayScope,
    hasAuthoritativeBoundary: boundaryCheck.hasVerifiedBoundary,
    ageSeconds,
    accuracyMeters,
    distanceFromPurisimaMeters,
    issues,
    statusLabel,
    statusMessage: isValid
      ? 'GPS coordinates are fresh, accurate, and within Barangay Purisima.'
      : issues.join(' '),
  };
}
