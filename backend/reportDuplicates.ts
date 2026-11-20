interface LocatedReport {
  category: string;
  latitude: number | null;
  longitude: number | null;
}

interface DuplicateCandidate {
  category: string;
  latitude: number;
  longitude: number;
}

export const DUPLICATE_REVIEW_RADIUS_METERS = 200;
export const DUPLICATE_CONFIRMATION_RADIUS_METERS = 25;

export function shouldCheckForDuplicateReports(
  captureMode: 'camera' | 'upload',
  isTestAccount: boolean,
): boolean {
  return captureMode === 'camera' && !isTestAccount;
}

function normalizeCategory(category: string): string {
  return category.replace(/^report:\s*/i, '').trim().toLowerCase();
}

export function reportDistanceMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number | null; longitude: number | null },
): number {
  if (
    !Number.isFinite(first.latitude) ||
    !Number.isFinite(first.longitude) ||
    typeof second.latitude !== 'number' ||
    !Number.isFinite(second.latitude) ||
    typeof second.longitude !== 'number' ||
    !Number.isFinite(second.longitude)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findNearbyDuplicateReports<T extends LocatedReport>(
  candidate: DuplicateCandidate,
  reports: T[],
): T[] {
  const category = normalizeCategory(candidate.category);
  return reports.filter(
    (report) =>
      normalizeCategory(report.category) === category &&
      reportDistanceMeters(candidate, report) <= DUPLICATE_REVIEW_RADIUS_METERS,
  );
}

export function canConfirmDuplicate(
  candidate: DuplicateCandidate,
  report: LocatedReport,
): boolean {
  return (
    normalizeCategory(report.category) === normalizeCategory(candidate.category) &&
    reportDistanceMeters(candidate, report) <= DUPLICATE_CONFIRMATION_RADIUS_METERS
  );
}

export function resolveDuplicateMatch<T extends LocatedReport & { id: string }>(
  candidate: DuplicateCandidate,
  reports: T[],
  match: 'confirmed' | 'uncertain' | 'none',
  matchingReportId: string | null,
): { status: 'confirmed' | 'uncertain' | 'none'; reportId: string | null } {
  if (match === 'none' || !matchingReportId) {
    return { status: 'none', reportId: null };
  }

  const matchingReport = reports.find((report) => report.id === matchingReportId);
  if (!matchingReport || !canConfirmDuplicate(candidate, matchingReport)) {
    return { status: 'none', reportId: null };
  }

  return match === 'confirmed'
    ? { status: 'confirmed', reportId: matchingReport.id }
    : { status: 'uncertain', reportId: null };
}
