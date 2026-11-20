const AUTOMATED_VALIDATION_NOTE = /^(?:AI\s+Auto-(?:Approved|Rejected)|AI\s+Validation|Geofence\s+Rejected|Automatically\s+(?:approved|rejected))/i;

export function isAutomatedValidationNote(note: string | null | undefined): boolean {
  return Boolean(note?.trim() && AUTOMATED_VALIDATION_NOTE.test(note.trim()));
}

export function getLegacyStaffUpdate(note: string | null | undefined): string {
  const value = note?.trim() ?? '';
  return value && !isAutomatedValidationNote(value) ? value : '';
}

export function getResidentReportUpdate(report: {
  admin_review_notes?: string | null;
  admin_notes?: string | null;
}): string {
  return report.admin_review_notes?.trim() || getLegacyStaffUpdate(report.admin_notes);
}
