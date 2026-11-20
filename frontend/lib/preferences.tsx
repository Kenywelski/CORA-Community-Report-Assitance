import { useCallback, useEffect, useState } from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { translateResidentText } from '@/lib/residentTranslations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AppLanguage = 'en' | 'tl' | 'ceb';
export type ThemeMode = 'light' | 'dark';
export type AppFontSize = 'small' | 'normal' | 'large' | 'xlarge';

const LANG_STORAGE_KEY = 'cora:language_v1';
const THEME_STORAGE_KEY = 'cora:theme_v1';
const FONT_SIZE_STORAGE_KEY = 'cora:font_size_v1';
const NOTIFICATIONS_STORAGE_KEY = 'cora:notifications_enabled_v1';
const PREF_EVENT = 'cora:preferences-changed';
let themeOverride: ThemeMode | null = 'light';

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string; short: string; native: string }[] = [
  { code: 'ceb', label: 'Bisaya', short: 'BIS', native: 'Binisaya (Cebuano)' },
  { code: 'tl', label: 'Filipino', short: 'FIL', native: 'Filipino' },
  { code: 'en', label: 'English', short: 'ENG', native: 'English' },
];

export const FONT_SIZE_OPTIONS: {
  id: AppFontSize;
  label: string;
  scalePercent: string;
  px: string;
  description: string;
}[] = [
  {
    id: 'small',
    label: 'Small',
    scalePercent: '88%',
    px: '14px',
    description: 'Compact text for fitting more information',
  },
  {
    id: 'normal',
    label: 'Default',
    scalePercent: '100%',
    px: '16px',
    description: 'Standard balanced size for most displays',
  },
  {
    id: 'large',
    label: 'Large',
    scalePercent: '112%',
    px: '18px',
    description: 'Enlarged comfortable reading size',
  },
  {
    id: 'xlarge',
    label: 'Extra Large',
    scalePercent: '125%',
    px: '20px',
    description: 'Maximum legibility for enhanced accessibility',
  },
];

const BASE_TRANSLATIONS: Record<
  AppLanguage,
  {
    systemTitle: string;
    barangaySubtitle: string;
    welcome: string;
    heroTitle: string;
    heroSubtitle: string;
    reportIssueBtn: string;
    quickActionsTitle: string;
    myReportsTitle: string;
    viewAll: string;
    recentReports: string;
    noReportsYet: string;
    noReportsDesc: string;
    signInToTrack: string;
    signIn: string;
    submitted: string;
    underReview: string;
    inProgress: string;
    resolve: string;
    announcementsTitle: string;
    latestAnnouncements: string;
    home: string;
    myReports: string;
    announcements: string;
    emergencyContacts: string;
    barangayDirectory: string;
    barangayPrograms: string;
    myProfile: string;
    logout: string;
    communitySystem: string;
    settingsTitle: string;
    settingsSubtitle: string;
    languageTitle: string;
    languageDesc: string;
    themeTitle: string;
    themeDesc: string;
    lightMode: string;
    darkMode: string;
    fontSizeTitle: string;
    fontSizeDesc: string;
    previewLabel: string;
    previewText: string;
  }
> = {
  en: {
    systemTitle: 'CORA Community Report System',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Welcome',
    heroTitle: 'Report a Specific Barangay Concern',
    heroSubtitle:
      'Report scattered garbage, damaged roads, broken streetlights, or clogged drainage and flooding issues in the barangay.',
    reportIssueBtn: 'Report an Issue',
    quickActionsTitle: 'Quick Actions',
    myReportsTitle: 'My Reports',
    viewAll: 'View All',
    recentReports: 'Recent Reports',
    noReportsYet: 'No Reports Yet',
    noReportsDesc: "You haven't submitted any community reports.",
    signInToTrack: 'Sign in to track your reports',
    signIn: 'Sign In',
    submitted: 'Submitted',
    underReview: 'Under Review',
    inProgress: 'In Progress',
    resolve: 'Resolved',
    announcementsTitle: 'Barangay Announcements',
    latestAnnouncements: 'Latest Announcements',
    home: 'Home',
    myReports: 'My Reports',
    announcements: 'Announcements',
    emergencyContacts: 'Emergency Contacts',
    barangayDirectory: 'Barangay Directory',
    barangayPrograms: 'Barangay Programs',
    myProfile: 'My Profile',
    logout: 'Logout',
    communitySystem: 'Community Report System',
    settingsTitle: 'App & System Settings',
    settingsSubtitle: 'Configure your language, theme, and system display size',
    languageTitle: 'System Language',
    languageDesc: 'Select your preferred language across the system',
    themeTitle: 'Theme Mode',
    themeDesc: 'Switch between light and dark display theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    fontSizeTitle: 'System Font & Text Size',
    fontSizeDesc: 'Adjust system-wide font scaling for better readability',
    previewLabel: 'Live System Text Preview',
    previewText:
      'Barangay Purisima: Safe, Clean, and Progressive Community. This text adjusts instantly to your selected size.',
  },
  tl: {
    systemTitle: 'CORA Community Report System',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Kamusta',
    heroTitle: 'Mag-report ng Specific Barangay Concern',
    heroSubtitle:
      'I-report ang nagkalat na basura, sirang kalsada, sirang streetlight, o problema sa baradong drainage at baha sa barangay.',
    reportIssueBtn: 'Mag-report ng Issue',
    quickActionsTitle: 'Quick Actions',
    myReportsTitle: 'Aking Reports',
    viewAll: 'View All',
    recentReports: 'Mga Recent Reports',
    noReportsYet: 'Wala Pang Report',
    noReportsDesc: 'Wala ka pang na-submit na report sa barangay.',
    signInToTrack: 'Mag-sign in para makita ang iyong reports',
    signIn: 'Mag-sign In',
    submitted: 'Na-submit',
    underReview: 'Sinusuri',
    inProgress: 'Kasalukuyang ginagawa',
    resolve: 'Nalutas',
    announcementsTitle: 'Mga Barangay Announcements',
    latestAnnouncements: 'Mga Latest Announcements',
    home: 'Tahanan',
    myReports: 'Aking Reports',
    announcements: 'Mga Anunsyo',
    emergencyContacts: 'Mga Numero sa Emergency',
    barangayDirectory: 'Mga Opisina sa Barangay',
    barangayPrograms: 'Mga Programa sa Barangay',
    myProfile: 'Profile Ko',
    logout: 'Mag-logout',
    communitySystem: 'Sistema ng Ulat sa Komunidad',
    settingsTitle: 'App & System Settings',
    settingsSubtitle: 'I-set ang language, theme, at text size',
    languageTitle: 'Language',
    languageDesc: 'Piliin ang gustong language',
    themeTitle: 'Theme',
    themeDesc: 'Piliin ang Light o Dark theme',
    lightMode: 'Light',
    darkMode: 'Dark',
    fontSizeTitle: 'Font & Text Size',
    fontSizeDesc: 'I-adjust ang laki ng text para mas madaling basahin',
    previewLabel: 'Live Text Preview',
    previewText:
      'Barangay Purisima: Ligtas, Malinis, at Progresibong Komunidad. Mag-a-adjust agad ang text sa napiling size.',
  },
  ceb: {
    systemTitle: 'CORA Community Report System',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Maayong pag-abot',
    heroTitle: 'I-report ang Specific Barangay Concern',
    heroSubtitle:
      'I-report ang basura, guba nga dalan, daot nga streetlight, drainage o baha nga problema sa barangay.',
    reportIssueBtn: 'Mag-report',
    quickActionsTitle: 'Quick Actions',
    myReportsTitle: 'Akong Reports',
    viewAll: 'View All',
    recentReports: 'Mga Recent Reports',
    noReportsYet: 'Wala Pay Report',
    noReportsDesc: 'Wala pa kay napasa nga report sa barangay.',
    signInToTrack: 'Mag-sign in aron makita ang imong reports',
    signIn: 'Pag-sign In',
    submitted: 'Na-submit na',
    underReview: 'Gina-review pa',
    inProgress: 'Gina-aksyonan na',
    resolve: 'Nasulbad na',
    announcementsTitle: 'Mga Barangay Announcements',
    latestAnnouncements: 'Mga Latest Announcements',
    home: 'Panimalay',
    myReports: 'Akong Reports',
    announcements: 'Mga Pahibalo',
    emergencyContacts: 'Mga Numero sa Emergency',
    barangayDirectory: 'Mga Opisina sa Barangay',
    barangayPrograms: 'Mga Programa sa Barangay',
    myProfile: 'Akong Profile',
    logout: 'Mag-logout',
    communitySystem: 'Sistema sa Report sa Komunidad',
    settingsTitle: 'App & System Settings',
    settingsSubtitle: 'I-set ang language, theme, ug text size',
    languageTitle: 'Language',
    languageDesc: 'Pilia ang gusto nimong language',
    themeTitle: 'Theme',
    themeDesc: 'Pilia ang Light o Dark theme',
    lightMode: 'Light',
    darkMode: 'Dark',
    fontSizeTitle: 'Font & Text Size',
    fontSizeDesc: 'I-adjust ang size sa text aron mas sayon basahon',
    previewLabel: 'Live Text Preview',
    previewText:
      'Barangay Purisima: Luwas, Limpyo, ug Progresibo nga Komunidad. Mo-adjust dayon kining teksto sa gipili nga gidak-on.',
  },
};

const ADMIN_DASHBOARD: Record<AppLanguage, string> = {
  en: 'Admin Dashboard',
  tl: 'Dashboard ng Admin',
  ceb: 'Dashboard sa Admin',
} as Record<AppLanguage, string>;

const withNavKeys = (lang: AppLanguage) => {
  const b = BASE_TRANSLATIONS[lang];
  return {
    ...b,
    navHome: b.home,
    navMyReports: b.myReports,
    reportAnIssue: b.reportIssueBtn,
    navAnnouncements: b.announcements,
    navEmergencyAlerts: b.emergencyContacts,
    navDirectory: b.barangayDirectory,
    navPrograms: b.barangayPrograms,
    navProfile: b.myProfile,
    adminDashboard: ADMIN_DASHBOARD[lang] ?? 'Admin Dashboard',
  };
};

export const UI_TRANSLATIONS = Object.fromEntries(
  (Object.keys(BASE_TRANSLATIONS) as AppLanguage[]).map((l) => [l, withNavKeys(l)]),
) as Record<AppLanguage, ReturnType<typeof withNavKeys>>;

export function getSavedLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (raw === 'ceb' || raw === 'tl' || raw === 'en') return raw;
  } catch {
    // ignore
  }
  return 'en';
}

export function getSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    // ignore
  }
  return 'light';
}

export function getSavedFontSize(): AppFontSize {
  if (typeof window === 'undefined') return 'normal';
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === 'small' || raw === 'normal' || raw === 'large' || raw === 'xlarge') {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'normal';
}

export function getSavedNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function setThemeOverride(theme: ThemeMode | null) {
  themeOverride = theme;
  applyThemeToDom(themeOverride ?? getSavedTheme());
}

export function applyFontSizeToDom(size: AppFontSize) {
  if (typeof document === 'undefined') return;
  const sizeMap: Record<AppFontSize, string> = {
    small: '14px',
    normal: '16px',
    large: '18px',
    xlarge: '20px',
  };
  const targetPx = sizeMap[size] || '16px';
  document.documentElement.style.fontSize = targetPx;
}

// Apply immediately on bundle evaluation to avoid layout shift
if (typeof document !== 'undefined') {
  applyThemeToDom(themeOverride ?? getSavedTheme());
  applyFontSizeToDom(getSavedFontSize());
  document.documentElement.lang = getSavedLanguage();
}

export function setAppLanguage(lang: AppLanguage) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent(PREF_EVENT));
  } catch {
    // ignore
  }
}

export function setAppTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  applyThemeToDom(themeOverride ?? theme);
  window.dispatchEvent(new CustomEvent(PREF_EVENT));
}

export function setAppFontSize(size: AppFontSize) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    applyFontSizeToDom(size);
    window.dispatchEvent(new CustomEvent(PREF_EVENT));
  } catch {
    // ignore
  }
}

export function setAppNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(PREF_EVENT));
  } catch {
    // ignore
  }
}

export function useAppPreferences() {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    getSavedLanguage()
  );
  const [theme, setThemeState] = useState<ThemeMode>(() => getSavedTheme());
  const [fontSize, setFontSizeState] = useState<AppFontSize>(() =>
    getSavedFontSize()
  );
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() =>
    getSavedNotificationsEnabled()
  );
  const translate = useCallback(
    (text: string, values?: Record<string, string | number>) =>
      translateResidentText(text, language, values),
    [language],
  );

  useEffect(() => {
    applyThemeToDom(themeOverride ?? getSavedTheme());
    applyFontSizeToDom(getSavedFontSize());

    const sync = () => {
      setLanguageState(getSavedLanguage());
      const nextTheme = getSavedTheme();
      setThemeState(nextTheme);
      applyThemeToDom(themeOverride ?? nextTheme);
      const nextFontSize = getSavedFontSize();
      setFontSizeState(nextFontSize);
      applyFontSizeToDom(nextFontSize);
      setNotificationsEnabledState(getSavedNotificationsEnabled());
    };
    window.addEventListener(PREF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PREF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    language,
    theme,
    fontSize,
    notificationsEnabled,
    t: UI_TRANSLATIONS[language],
    translate,
    setLanguage: setAppLanguage,
    setTheme: setAppTheme,
    setFontSize: setAppFontSize,
    setNotificationsEnabled: setAppNotificationsEnabled,
    toggleTheme: () => setAppTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}

interface LanguageThemeControlsProps {
  variant?: 'hero' | 'surface' | 'admin';
  className?: string;
}

export const LanguageThemeControls = ({
  variant = 'surface',
  className,
}: LanguageThemeControlsProps) => {
  const { language, theme, setLanguage, toggleTheme, translate } = useAppPreferences();

  const isHero = variant === 'hero';
  const isAdmin = variant === 'admin';

  return (
    <div
      data-testid="language-theme-controls"
      className={cn('inline-flex items-center', isAdmin ? 'gap-3' : 'gap-1.5', className)}
    >
      <Select
        value={language}
        onValueChange={(value) => setLanguage(value as AppLanguage)}
      >
        <SelectTrigger
          aria-label={isAdmin ? 'Select language' : translate('Select language')}
          data-testid="language-selector"
          className={cn(
            'h-8 w-auto min-w-[122px] gap-2 rounded-xl px-2.5 py-0 text-xs font-semibold shadow-none focus:ring-0',
            isAdmin && 'h-10 min-w-[154px] rounded-2xl px-3 text-sm shadow-sm',
            isHero
              ? 'border-primary/30 bg-primary/10 text-foreground backdrop-blur-sm'
              : isAdmin
                ? 'border-border bg-card text-foreground'
                : 'border-border bg-muted/80 text-foreground'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Globe
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isHero ? 'text-white/90' : 'text-primary'
              )}
            />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent align="start">
          {LANGUAGE_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.code}
              value={opt.code}
              className="focus:bg-primary/10 focus:text-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:focus:bg-primary data-[state=checked]:focus:text-primary-foreground"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Theme Mode Toggle (Light / Dark) */}
      <button
        type="button"
        onClick={toggleTheme}
        data-testid="theme-mode-toggle"
        aria-label={
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        }
        title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors',
          isAdmin && 'h-10 rounded-2xl px-4 text-sm shadow-sm',
          isHero
            ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25'
            : isAdmin
              ? 'border border-border bg-card text-foreground hover:bg-muted'
              : 'border border-border bg-muted/80 text-foreground hover:bg-muted'
        )}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Light</span>
          </>
        ) : (
          <>
            <Moon
              className={cn(
                'h-3.5 w-3.5',
                isHero ? 'text-white' : 'text-primary'
              )}
            />
            <span className="hidden sm:inline">Dark</span>
          </>
        )}
      </button>
    </div>
  );
};
