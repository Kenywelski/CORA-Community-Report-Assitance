export type ResidentNavSectionId = 'MAIN' | 'COMMUNITY' | 'ACCOUNT';

export type ResidentNavIconKey =
  | 'house'
  | 'clipboard-list'
  | 'bell'
  | 'siren'
  | 'map-pin'
  | 'calendar-days'
  | 'user-round';

export interface ResidentNavItem {
  id: string;
  label: string;
  path: string;
  section: ResidentNavSectionId;
  iconKey: ResidentNavIconKey;
  supportsUnreadBadge?: boolean;
}

export interface ResidentNavSection {
  id: ResidentNavSectionId;
  label: string;
  items: ResidentNavItem[];
}

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'cora:resident-sidebar-collapsed';

export const RESIDENT_NAV_SECTIONS: ResidentNavSection[] = [
  {
    id: 'MAIN',
    label: 'MAIN',
    items: [
      {
        id: 'home',
        label: 'Home',
        path: '/',
        section: 'MAIN',
        iconKey: 'house',
      },
      {
        id: 'my-reports',
        label: 'My Reports',
        path: '/my-requests',
        section: 'MAIN',
        iconKey: 'clipboard-list',
      },
    ],
  },
  {
    id: 'COMMUNITY',
    label: 'COMMUNITY',
    items: [
      {
        id: 'announcements',
        label: 'Announcements',
        path: '/updates',
        section: 'COMMUNITY',
        iconKey: 'bell',
        supportsUnreadBadge: true,
      },
      {
        id: 'emergency-contacts',
        label: 'Emergency Contacts',
        path: '/emergency',
        section: 'COMMUNITY',
        iconKey: 'siren',
      },
      {
        id: 'barangay-directory',
        label: 'Barangay Directory',
        path: '/directory',
        section: 'COMMUNITY',
        iconKey: 'map-pin',
      },
      {
        id: 'barangay-programs',
        label: 'Barangay Programs',
        path: '/programs',
        section: 'COMMUNITY',
        iconKey: 'calendar-days',
      },
    ],
  },
  {
    id: 'ACCOUNT',
    label: 'ACCOUNT',
    items: [
      {
        id: 'my-profile',
        label: 'My Profile',
        path: '/profile',
        section: 'ACCOUNT',
        iconKey: 'user-round',
      },
    ],
  },
];

/**
 * Resolves the effective active path from React Router pathname and optional prop override.
 * Ensures that a generic "/" override on subpages like "/my-requests" does not mask the real route.
 */
export function resolveActiveResidentPath(pathname: string, currentPathProp?: string): string {
  const normalizedPathname = (pathname || '/').trim() || '/';
  if (normalizedPathname !== '/' && normalizedPathname !== '/dashboard') {
    return normalizedPathname;
  }
  if (currentPathProp && currentPathProp.trim()) {
    return currentPathProp.trim();
  }
  return normalizedPathname;
}

/**
 * Determines whether a sidebar navigation item is active for the given route path.
 */
export function isResidentNavItemActive(itemPath: string, activePath: string): boolean {
  const normalizedActive = (activePath || '/').trim() || '/';
  if (itemPath === '/') {
    return normalizedActive === '/' || normalizedActive === '/dashboard';
  }
  return normalizedActive === itemPath || normalizedActive.startsWith(`${itemPath}/`);
}

/**
 * Parses stored collapse state string safely.
 */
export function parseSidebarCollapsed(rawValue: string | null | undefined): boolean {
  return rawValue === 'true';
}

/**
 * Detects whether the user agent belongs to a mobile phone device
 * (so phones always use the bottom navigation bar instead of the desktop sidebar,
 * even if mobile Chrome is in "Desktop site" mode).
 */
export function isPhoneUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

