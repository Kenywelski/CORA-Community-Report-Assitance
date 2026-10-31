import { useEffect, useState } from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppLanguage = 'en' | 'tl' | 'ceb';
export type ThemeMode = 'light' | 'dark';

const LANG_STORAGE_KEY = 'cora:language_v1';
const THEME_STORAGE_KEY = 'cora:theme_v1';
const PREF_EVENT = 'cora:preferences-changed';

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string; short: string }[] = [
  { code: 'ceb', label: 'Bisaya', short: 'BIS' },
  { code: 'tl', label: 'Tagalog', short: 'TAG' },
  { code: 'en', label: 'English', short: 'ENG' },
];

export const UI_TRANSLATIONS: Record<
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
  },
};

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

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
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

export function useAppPreferences() {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    getSavedLanguage()
  );
  const [theme, setThemeState] = useState<ThemeMode>(() => getSavedTheme());

  useEffect(() => {
    applyThemeToDom(getSavedTheme());
    const sync = () => {
      setLanguageState(getSavedLanguage());
      const nextTheme = getSavedTheme();
      setThemeState(nextTheme);
      applyThemeToDom(nextTheme);
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
    t: UI_TRANSLATIONS[language],
    setLanguage: setAppLanguage,
    setTheme: setAppTheme,
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
