import { useEffect, useState } from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppLanguage = 'en' | 'tl' | 'ceb';
export type ThemeMode = 'light' | 'dark';
export type AppFontSize = 'small' | 'normal' | 'large' | 'xlarge';

const LANG_STORAGE_KEY = 'cora:language_v1';
const THEME_STORAGE_KEY = 'cora:theme_v1';
const FONT_SIZE_STORAGE_KEY = 'cora:font_size_v1';
const PREF_EVENT = 'cora:preferences-changed';

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string; short: string; native: string }[] = [
  { code: 'ceb', label: 'Bisaya', short: 'BIS', native: 'Binisaya (Cebuano)' },
  { code: 'tl', label: 'Tagalog', short: 'TAG', native: 'Tagalog (Filipino)' },
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
    home: string;
    myReports: string;
    announcements: string;
    emergencyContacts: string;
    barangayDirectory: string;
    barangayPrograms: string;
    myProfile: string;
    logout: string;
    communityPortal: string;
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
    systemTitle: 'Community Report System',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Welcome',
    heroTitle: 'Report a Community Issue',
    heroSubtitle:
      'Report community concerns and stay informed about Barangay Purisima.',
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
    resolve: 'Resolve',
    announcementsTitle: 'Barangay Announcements',
    home: 'Home',
    myReports: 'My Reports',
    announcements: 'Announcements',
    emergencyContacts: 'Emergency Contacts',
    barangayDirectory: 'Barangay Directory',
    barangayPrograms: 'Barangay Programs',
    myProfile: 'My Profile',
    logout: 'Logout',
    communityPortal: 'Community Portal',
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
    systemTitle: 'Sistema ng Ulat pang-Komunidad',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Maligayang pagdating',
    heroTitle: 'Mag-ulat ng Problema sa Komunidad',
    heroSubtitle:
      'I-report ang mga alalahanin sa komunidad at manatiling updated sa Barangay Purisima.',
    reportIssueBtn: 'Mag-ulat ng Isyu',
    quickActionsTitle: 'Mabilisang Aksyon',
    myReportsTitle: 'Aking mga Ulat',
    viewAll: 'Tingnan Lahat',
    recentReports: 'Mga Kamakailang Ulat',
    noReportsYet: 'Wala Pang Ulat',
    noReportsDesc: 'Wala ka pang naipapasang ulat sa barangay.',
    signInToTrack: 'Mag-sign in upang masubaybayan ang iyong mga ulat',
    signIn: 'Mag-sign In',
    submitted: 'Naipasa',
    underReview: 'Sinusuri',
    inProgress: 'Ginagawa Na',
    resolve: 'Nalutas',
    announcementsTitle: 'Mga Anunsyo sa Barangay',
    home: 'Home',
    myReports: 'Aking mga Ulat',
    announcements: 'Mga Anunsyo',
    emergencyContacts: 'Emergency Contacts',
    barangayDirectory: 'Direktoryo ng Barangay',
    barangayPrograms: 'Programa ng Barangay',
    myProfile: 'Aking Profile',
    logout: 'Mag-logout',
    communityPortal: 'Portal ng Komunidad',
    settingsTitle: 'Mga Setting ng Sistema at App',
    settingsSubtitle: 'I-ayos ang wika, tema, at sukat ng font sa sistema',
    languageTitle: 'Wika ng Sistema',
    languageDesc: 'Piliin ang nais mong wika sa buong sistema',
    themeTitle: 'Tema ng Hitsura',
    themeDesc: 'Pumili sa pagitan ng Maliwanag at Madilim na tema',
    lightMode: 'Maliwanag',
    darkMode: 'Madilim',
    fontSizeTitle: 'Sukat ng Font at Teksto',
    fontSizeDesc: 'Baguhin ang laki ng teksto sa buong sistema para sa madaling pagbasa',
    previewLabel: 'Live Preview ng Teksto',
    previewText:
      'Barangay Purisima: Ligtas, Malinis, at Progresibong Komunidad. Agad na mag-aadjust ang tekstong ito sa napiling laki.',
  },
  ceb: {
    systemTitle: 'Sistema sa Report sa Komunidad',
    barangaySubtitle: 'Barangay Purisima, Tago, Surigao del Sur',
    welcome: 'Maayong pag-abot',
    heroTitle: 'I-report ang Problema sa Komunidad',
    heroSubtitle:
      'I-report ang mga kabalaka sa komunidad ug magpabiling updated sa Barangay Purisima.',
    reportIssueBtn: 'Mag-report og Isyu',
    quickActionsTitle: 'Dali nga Aksyon',
    myReportsTitle: 'Akong mga Report',
    viewAll: 'Tan-awa Tanan',
    recentReports: 'Bag-ong mga Report',
    noReportsYet: 'Wala Pay Report',
    noReportsDesc: 'Wala pa kay napasa nga report sa barangay.',
    signInToTrack: 'Pag-sign in aron makita ang imong mga report',
    signIn: 'Pag-sign In',
    submitted: 'Napasa Na',
    underReview: 'Gisusi Pa',
    inProgress: 'Gina-trabaho',
    resolve: 'Nasulbad Na',
    announcementsTitle: 'Mga Pahibalo sa Barangay',
    home: 'Home',
    myReports: 'Akong mga Report',
    announcements: 'Mga Pahibalo',
    emergencyContacts: 'Emergency Contacts',
    barangayDirectory: 'Direktoryo sa Barangay',
    barangayPrograms: 'Programa sa Barangay',
    myProfile: 'Akong Profile',
    logout: 'Pag-logout',
    communityPortal: 'Portal sa Komunidad',
    settingsTitle: 'Mga Setting sa Sistema ug App',
    settingsSubtitle: 'I-set ang pinulongan, tema, ug gidak-on sa teksto',
    languageTitle: 'Pinulongan sa Sistema',
    languageDesc: 'Pilia ang imong gusto nga pinulongan sa tibuok sistema',
    themeTitle: 'Tema sa Panagway',
    themeDesc: 'Pagbalhin tali sa Hayag ug Ngitngit nga tema',
    lightMode: 'Hayag',
    darkMode: 'Ngitngit',
    fontSizeTitle: 'Gidak-on sa Font ug Teksto',
    fontSizeDesc: 'I-adjust ang gidak-on sa teksto para mas dali basahon',
    previewLabel: 'Live nga Preview sa Teksto',
    previewText:
      'Barangay Purisima: Luwas, Limpyo, ug Progresibo nga Komunidad. Mo-adjust dayon kining teksto sa gipili nga gidak-on.',
  },
};

const ADMIN_PORTAL: Record<AppLanguage, string> = {
  en: 'Admin Portal',
  tl: 'Portal ng Admin',
  ceb: 'Portal sa Admin',
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
    adminPortal: ADMIN_PORTAL[lang] ?? 'Admin Portal',
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

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
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
  applyThemeToDom(getSavedTheme());
  applyFontSizeToDom(getSavedFontSize());
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
    applyThemeToDom(theme);
    window.dispatchEvent(new CustomEvent(PREF_EVENT));
  } catch {
    // ignore
  }
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

export function useAppPreferences() {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    getSavedLanguage()
  );
  const [theme, setThemeState] = useState<ThemeMode>(() => getSavedTheme());
  const [fontSize, setFontSizeState] = useState<AppFontSize>(() =>
    getSavedFontSize()
  );

  useEffect(() => {
    applyThemeToDom(getSavedTheme());
    applyFontSizeToDom(getSavedFontSize());

    const sync = () => {
      setLanguageState(getSavedLanguage());
      const nextTheme = getSavedTheme();
      setThemeState(nextTheme);
      applyThemeToDom(nextTheme);
      const nextFontSize = getSavedFontSize();
      setFontSizeState(nextFontSize);
      applyFontSizeToDom(nextFontSize);
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
    t: UI_TRANSLATIONS[language],
    setLanguage: setAppLanguage,
    setTheme: setAppTheme,
    setFontSize: setAppFontSize,
    toggleTheme: () => setAppTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}

interface LanguageThemeControlsProps {
  variant?: 'hero' | 'surface';
  className?: string;
}

export const LanguageThemeControls = ({
  variant = 'surface',
  className,
}: LanguageThemeControlsProps) => {
  const { language, theme, setLanguage, toggleTheme } = useAppPreferences();

  const isHero = variant === 'hero';

  return (
    <div
      data-testid="language-theme-controls"
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      {/* Language Selector: Bisaya, Tagalog, English */}
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition-colors',
          isHero
            ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm'
            : 'bg-muted/80 text-foreground border border-border'
        )}
      >
        <Globe
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isHero ? 'text-white/90' : 'text-primary'
          )}
        />
        <select
          aria-label="Select language"
          data-testid="language-selector"
          value={language}
          onChange={(e) => setLanguage(e.target.value as AppLanguage)}
          className={cn(
            'cursor-pointer bg-transparent text-xs font-semibold focus:outline-none',
            isHero ? 'text-white [&>option]:text-slate-900' : 'text-foreground'
          )}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
          isHero
            ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25'
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
