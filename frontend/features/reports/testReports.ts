import { format } from 'date-fns';

interface ReportRecordIdentity {
  title: string;
  status: string;
  created_at: string;
  location: string | null;
}

export function isConfirmedTestReport(report: ReportRecordIdentity): boolean {
  const createdAt = new Date(report.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;

  const title = report.title.replace(/^\[REPORT\]\s*/i, '').trim().toLowerCase();
  const location = (report.location || '').toLowerCase();

  return (
    title === 'uncollected garbage' &&
    report.status === 'completed' &&
    format(createdAt, "yyyy-MM-dd'T'HH:mm") === '2026-11-05T18:03' &&
    location.includes('purok 5') &&
    location.includes('barangay purisima')
  );
}
