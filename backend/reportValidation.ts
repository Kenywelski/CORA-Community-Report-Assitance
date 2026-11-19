import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { PURISIMA_BOUNDARY_GEOJSON } from '../frontend/data/purisima_boundary.geojson.ts';

export const MAX_GPS_ACCURACY_METERS = 100;
export const MAX_GPS_AGE_MS = 60_000;
export const BLUR_VARIANCE_THRESHOLD = 500;
export const MOTION_BLUR_DIRECTIONAL_RATIO_THRESHOLD = 0.15;
export const MOTION_BLUR_MIN_DIRECTIONAL_ENERGY = 300;

export const REPORT_CATEGORIES = [
  {
    key: 'garbage',
    label: 'Improper Waste Disposal',
    modelLabel: 'waste',
    aliases: ['waste', 'garbage', 'improper waste disposal'],
  },
  {
    key: 'street_light',
    label: 'Streetlight Problem',
    modelLabel: 'Streetlights',
    aliases: ['streetlights', 'streetlight', 'streetlight problem'],
  },
  {
    key: 'drainage',
    label: 'Drainage/Flooding Concern',
    modelLabel: 'drainage',
    aliases: ['drainage', 'drainage/flooding concern'],
  },
  {
    key: 'road_damage',
    label: 'Road Damage',
    modelLabel: 'road',
    aliases: ['road', 'road damage'],
  },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type OpenClipDecision =
  | 'accepted'
  | 'rejected'
  | 'recapture_required'
  | 'unverified';

export function resolveModelCategory(value: unknown): ReportCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return (
    REPORT_CATEGORIES.find(
      (category) =>
        category.modelLabel.toLowerCase() === normalized ||
        category.key === normalized ||
        category.aliases.some((alias) => alias.toLowerCase() === normalized),
    ) ?? null
  );
}

export function parseOpenClipDecision(payload: unknown): OpenClipDecision {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'unverified';
  }
  const response = payload as Record<string, unknown>;
  const decision =
    typeof response.decision === 'string'
      ? response.decision.trim().toLowerCase()
      : '';
  const status =
    typeof response.verification_status === 'string'
      ? response.verification_status.trim().toLowerCase()
      : '';

  if (decision === 'review_only' || status === 'review_only') return 'unverified';
  if (decision === 'recapture_required' || status === 'recapture_required') {
    return 'recapture_required';
  }
  if (
    decision === 'rejected' ||
    status === 'rejected' ||
    status === 'out_of_scope'
  ) {
    return 'rejected';
  }
  return decision === 'accepted' ? 'accepted' : 'unverified';
}

export type LocationValidation =
  | { status: 'valid' }
  | { status: 'retry' }
  | { status: 'outside' };

export function validateReportLocation(
  latitude: number,
  longitude: number,
  accuracyMeters: number,
  locationTimestamp: number,
  now = Date.now(),
): LocationValidation {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0 ||
    accuracyMeters > MAX_GPS_ACCURACY_METERS ||
    !Number.isFinite(locationTimestamp) ||
    locationTimestamp > now + 5_000 ||
    now - locationTimestamp > MAX_GPS_AGE_MS
  ) {
    return { status: 'retry' };
  }

  const candidate = point([longitude, latitude]);
  const isInside = PURISIMA_BOUNDARY_GEOJSON.features.some((feature) =>
    booleanPointInPolygon(candidate, feature),
  );
  return isInside ? { status: 'valid' } : { status: 'outside' };
}

export function canUseReportUpload(isTestAccount: boolean): boolean {
  return isTestAccount;
}

export function calculateLaplacianVariance(
  grayscale: Uint8Array,
  width: number,
  height: number,
): number {
  if (
    width < 3 ||
    height < 3 ||
    grayscale.length !== width * height
  ) {
    throw new Error('Invalid grayscale image data.');
  }

  const laplacianValues: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      laplacianValues.push(
        grayscale[index - width] +
          grayscale[index - 1] +
          grayscale[index + 1] +
          grayscale[index + width] -
          4 * grayscale[index],
      );
    }
  }

  const mean =
    laplacianValues.reduce((sum, value) => sum + value, 0) /
    laplacianValues.length;
  return (
    laplacianValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    laplacianValues.length
  );
}

export function calculateDirectionalGradientEnergy(
  grayscale: Uint8Array,
  width: number,
  height: number,
): { horizontal: number; vertical: number } {
  if (width < 3 || height < 3 || grayscale.length !== width * height) {
    throw new Error('Invalid grayscale image data.');
  }

  let horizontal = 0;
  let vertical = 0;
  let sampleCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const horizontalGradient = grayscale[index + 1] - grayscale[index - 1];
      const verticalGradient =
        grayscale[index + width] - grayscale[index - width];
      horizontal += horizontalGradient ** 2;
      vertical += verticalGradient ** 2;
      sampleCount += 1;
    }
  }

  return {
    horizontal: horizontal / sampleCount,
    vertical: vertical / sampleCount,
  };
}
