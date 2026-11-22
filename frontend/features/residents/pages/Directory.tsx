import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  FileText,
  Loader2,
} from 'lucide-react';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentMobileBackHeader } from '@/features/residents/components/ResidentMobileBackHeader';
import { getOfficeAppearance } from '@/features/barangay-offices/officeAppearance';
import {
  type BarangayOfficeItem,
  loadBarangayOffices,
} from '@/lib/barangayContentStore';
import { subscribeToPublicDataSync } from '@/features/realtime/publicDataSync';
import { toast } from 'sonner';

const normalizeContent = (value: string) =>
  value
    .split('â€“').join('–')
    .split('â€™').join('’')
    .split('Ã¢â‚¬â€œ').join('–')
    .split('Ã¢â‚¬â„¢').join('’');

const getOfficeOrder = (officeName: string) => {
  const name = officeName.toLowerCase();
  if (name.includes('punong')) return 0;
  if (name.includes('sangguniang barangay')) return 1;
  if (name.includes('secretary')) return 2;
  if (name.includes('treasurer')) return 3;
  if (name.includes('sangguniang kabataan')) return 4;
  return 5;
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const Directory = () => {
  const navigate = useNavigate();
  const [offices, setOffices] = useState<BarangayOfficeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchOffices = async () => {
      try {
        const data = await loadBarangayOffices();
        if (!mounted) return;
        setOffices(data.filter((office) => office.is_active));
      } catch (error) {
        console.error('Failed to load barangay offices:', error);
        if (mounted) toast.error('Failed to load barangay offices');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchOffices();
    const unsubscribe = subscribeToPublicDataSync(
      'knowledge_base',
      () => void fetchOffices(),
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const orderedOffices = useMemo(
    () => [...offices].sort((a, b) => getOfficeOrder(a.name) - getOfficeOrder(b.name)),
    [offices],
  );

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <main className="app-container relative px-4 pb-6 pt-5 lg:pt-6">
        <ResidentMobileBackHeader title="Barangay Directory" onBack={() => navigate(-1)} />
        <header className="mb-4 hidden items-start gap-3 lg:flex">
          <span aria-hidden="true" className="mt-0.5 h-10 w-1.5 shrink-0 rounded-full bg-emerald-600" />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-[-0.025em] text-foreground sm:text-2xl">
              Barangay Offices
            </h1>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground sm:text-sm">
              Meet the barangay offices and the officials who serve Barangay Purisima.
            </p>
          </div>
        </header>

        <section aria-label="Barangay offices" className="space-y-2">
          {loading ? (
            <div role="status" aria-label="Loading offices" className="flex min-h-52 items-center justify-center rounded-2xl border border-border/45 bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orderedOffices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">No barangay offices are available</h2>
            </div>
          ) : (
            orderedOffices.map((office) => {
              const appearance = getOfficeAppearance(office.name);
              const Icon = appearance.icon;

              return (
                <details
                  key={office.id}
                  open={office.name.toLowerCase().includes('punong')}
                  className="group overflow-hidden rounded-xl border border-border/55 bg-card shadow-[0_3px_9px_rgba(15,23,42,0.07)] transition-colors open:border-emerald-500/50"
                >
                  <summary
                    className="flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 group-open:bg-gradient-to-r group-open:from-emerald-50 group-open:to-emerald-100/80 dark:group-open:from-emerald-950/35 dark:group-open:to-emerald-900/30 sm:px-4"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${appearance.iconClass}`}>
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span aria-hidden="true" className="h-8 border-l border-emerald-700/35" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                        {office.name}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                        {office.officials.length} {office.officials.length === 1 ? 'official' : 'officials'}
                      </span>
                    </span>
                    <span aria-hidden="true" className="hidden rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 group-open:inline-flex dark:bg-emerald-900/60 dark:text-emerald-200">
                      Expanded
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-foreground/70 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>

                  <div className="px-3 pb-3.5 sm:px-5 sm:pb-4">
                    <div className="border-t border-border/50 pt-2.5">
                      {office.officials.length > 0 ? (
                        <div className="divide-y divide-border/60">
                          {office.officials.map((official, officialIndex) => (
                            <div key={`${official.name}-${official.position}-${officialIndex}`} className="flex items-center gap-3 py-2.5 sm:gap-4">
                              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 bg-emerald-50 text-sm font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                {getInitials(official.name)}
                              </span>
                              <span aria-hidden="true" className="h-9 border-l border-border" />
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-bold leading-snug text-foreground">
                                  {official.name}
                                </p>
                                {official.position && (
                                  <span className="mt-1 inline-flex max-w-full rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold leading-tight text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                    {official.position}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No officials listed.</p>
                      )}

                      <div className="mt-1 border-t border-border/60 pt-2.5">
                        <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                          About This Office
                        </h3>
                        <p className="mt-1.5 whitespace-pre-wrap pl-6 text-[11px] leading-relaxed text-foreground/85 sm:text-xs">
                          {normalizeContent(office.responsibilities).trim() || 'Office responsibilities have not been provided.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </section>
      </main>

      <BottomNav currentPath="/directory" />
    </div>
  );
};

export default Directory;
