import { Globe, Moon, Sun, Type, Sliders, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  useAppPreferences,
  LANGUAGE_OPTIONS,
  FONT_SIZE_OPTIONS,
  AppLanguage,
  ThemeMode,
  AppFontSize,
} from '@/lib/preferences';
import { cn } from '@/lib/utils';

export const AppSettingsCard = () => {
  const { language, theme, fontSize, t, setLanguage, setTheme, setFontSize } =
    useAppPreferences();

  return (
    <Card
      data-testid="app-settings-card"
      variant="elevated"
      className="animate-slide-up"
      style={{ animationDelay: '100ms' }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">
              {t.settingsTitle}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t.settingsSubtitle}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-1">
        {/* Section 1: Language */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t.languageTitle}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{t.languageDesc}</p>

          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            data-testid="language-options-grid"
          >
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  data-testid={`language-btn-${opt.code}`}
                  onClick={() => setLanguage(opt.code as AppLanguage)}
                  className={cn(
                    'relative flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-semibold text-sm">{opt.label}</span>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {opt.native}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Theme Mode */}
        <div className="space-y-2.5 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500" />
            )}
            <h3 className="text-sm font-semibold text-foreground">
              {t.themeTitle}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{t.themeDesc}</p>

          <div
            className="grid grid-cols-2 gap-2.5"
            data-testid="theme-mode-grid"
          >
            <button
              type="button"
              data-testid="theme-btn-light"
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border p-3 transition-all',
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-foreground'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Sun className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">{t.lightMode}</span>
                <span className="text-[11px] text-muted-foreground">
                  Daytime Clean
                </span>
              </div>
            </button>

            <button
              type="button"
              data-testid="theme-btn-dark"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border p-3 transition-all',
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-foreground'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Moon className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">{t.darkMode}</span>
                <span className="text-[11px] text-muted-foreground">
                  Nighttime Soft
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Section 3: Font Size / System Scaling */}
        <div className="space-y-2.5 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t.fontSizeTitle}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{t.fontSizeDesc}</p>

          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            data-testid="font-size-options-grid"
          >
            {FONT_SIZE_OPTIONS.map((opt) => {
              const isSelected = fontSize === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`font-size-btn-${opt.id}`}
                  onClick={() => setFontSize(opt.id as AppFontSize)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {opt.scalePercent}
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground leading-tight">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
