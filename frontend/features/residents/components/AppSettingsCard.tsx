import { Bell, Check, Globe, Moon, Sun, Type } from 'lucide-react';
import {
  AppFontSize,
  AppLanguage,
  FONT_SIZE_OPTIONS,
  LANGUAGE_OPTIONS,
  useAppPreferences,
} from '@/lib/preferences';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const languageOrder: AppLanguage[] = ['en', 'tl', 'ceb'];

export const AppSettingsCard = () => {
  const {
    language,
    theme,
    fontSize,
    notificationsEnabled,
    t,
    translate,
    setLanguage,
    setTheme,
    setFontSize,
    setNotificationsEnabled,
  } = useAppPreferences();

  const orderedLanguages = languageOrder
    .map((code) => LANGUAGE_OPTIONS.find((option) => option.code === code))
    .filter((option): option is (typeof LANGUAGE_OPTIONS)[number] => Boolean(option));

  return (
    <div data-testid="app-settings-card" className="animate-slide-up space-y-3">
      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{translate('Language')}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {translate('Choose your preferred app language.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" data-testid="language-options-grid">
          {orderedLanguages.map((option) => {
            const isSelected = language === option.code;
            const displayLabel = option.label;

            return (
              <button
                key={option.code}
                type="button"
                data-testid={`language-btn-${option.code}`}
                onClick={() => setLanguage(option.code)}
                className={cn(
                  'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span className="truncate">{displayLabel}</span>
                {isSelected && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Moon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{translate('Appearance')}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {translate('Set your preferred theme.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="theme-mode-grid">
          <button
            type="button"
            data-testid="theme-btn-light"
            onClick={() => setTheme('light')}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-colors',
              theme === 'light'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            {t.lightMode}
            {theme === 'light' && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
          <button
            type="button"
            data-testid="theme-btn-dark"
            onClick={() => setTheme('dark')}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-colors',
              theme === 'dark'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <Moon className="h-3.5 w-3.5" />
            {t.darkMode}
            {theme === 'dark' && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Type className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{translate('Font & Text Size')}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {translate('Adjust the text size for better readability.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="font-size-options-grid">
          {FONT_SIZE_OPTIONS.map((option) => {
            const isSelected = fontSize === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`font-size-btn-${option.id}`}
                onClick={() => setFontSize(option.id as AppFontSize)}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-lg border px-2 text-[11px] font-semibold transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-bold',
                    option.id === 'small' && 'text-[10px]',
                    option.id === 'normal' && 'text-xs',
                    option.id === 'large' && 'text-sm',
                    option.id === 'xlarge' && 'text-base',
                  )}
                >
                  Aa
                </span>
                <span className="truncate">{translate(option.label)}</span>
                {isSelected && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">{translate('Notifications')}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {translate('Receive updates about your reports and announcements.')}
          </p>
        </div>
        <Switch
          checked={notificationsEnabled}
          onCheckedChange={setNotificationsEnabled}
          aria-label={translate('Enable notifications')}
          className="h-5 w-9 data-[state=checked]:bg-primary [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
        />
      </section>
    </div>
  );
};
