export const ROUTES = {
  home: '/', landing: '/landing', dashboard: '/dashboard', auth: '/auth', guest: '/guest',
  services: '/services', updates: '/updates', profile: '/profile', settings: '/settings',
  reportIssue: '/report-issue', myRequests: '/my-requests', feedback: '/feedback',
  community: '/community', programs: '/programs', directory: '/directory',
  emergency: '/emergency', staff: '/staff', admin: '/admin', adminRequests: '/admin/requests',
  adminUsers: '/admin/users', adminAnnouncements: '/admin/announcements',
  adminOffices: '/admin/offices', adminPrograms: '/admin/programs',
  adminFeedback: '/admin/feedback',
  adminEmergencyContacts: '/admin/emergency-contacts', adminChat: '/admin/chat',
  adminKnowledge: '/admin/knowledge',
} as const;

const knownPaths = new Set<string>(Object.values(ROUTES));

export function normalizeInternalRoute(path: string | null | undefined): string {
  if (!path) return ROUTES.home;
  if (path === '/community-wall') return ROUTES.community;
  return knownPaths.has(path) ? path : ROUTES.home;
}
