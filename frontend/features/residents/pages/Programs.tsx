import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
import { getProgramAppearance } from '@/features/barangay-programs/programAppearance';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentMobileBackHeader } from '@/features/residents/components/ResidentMobileBackHeader';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  BARANGAY_PROGRAM_GROUPS,
  type BarangayProgramGroup,
  type BarangayProgramItem,
  loadBarangayPrograms,
} from '@/lib/barangayContentStore';
import { subscribeToPublicDataSync } from '@/features/realtime/publicDataSync';
import { toast } from 'sonner';

const normalizeContent = (value: string) =>
  value
    .split('â€“').join('–')
    .split('â€™').join('’')
    .split('Â·').join('·');

const statusClass = (status: BarangayProgramItem['status']) => {
  switch (status) {
    case 'Upcoming':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'Ongoing':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'For Verification':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'Completed':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'Cancelled':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

const Programs = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<BarangayProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<BarangayProgramItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<BarangayProgramGroup, boolean>
  >({
    'Disaster Management Programs': true,
    'Infrastructure Programs': true,
  });

  useEffect(() => {
    let mounted = true;
    const fetchPrograms = async () => {
      try {
        const data = await loadBarangayPrograms();
        if (!mounted) return;
        setPrograms(data.filter((program) => program.is_active));
      } catch (error) {
        console.error('Failed to load barangay programs:', error);
        if (mounted) toast.error('Failed to load barangay programs');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchPrograms();
    const unsubscribe = subscribeToPublicDataSync(
      'knowledge_base',
      () => void fetchPrograms(),
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    const latestProgram = programs.find((program) => program.id === selectedProgram.id);
    if (!latestProgram) {
      setSelectedProgram(null);
    } else if (latestProgram !== selectedProgram) {
      setSelectedProgram(latestProgram);
    }
  }, [programs, selectedProgram]);

  const filteredPrograms = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return programs.filter((program) => {
      if (!searchTerm) return true;

      return `${program.title} ${program.description} ${program.schedule} ${program.location} ${program.status} ${program.program_group ?? ''}`
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [programs, query]);

  const groupedPrograms = useMemo(
    () =>
      BARANGAY_PROGRAM_GROUPS.map((group) => ({
        group,
        programs: filteredPrograms.filter(
          (program) => program.program_group === group,
        ),
      })),
    [filteredPrograms],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-24 lg:pb-10">
      <main className="app-container relative px-4 pb-6 pt-5 lg:pt-6">
        <ResidentMobileBackHeader title="Barangay Programs" onBack={() => navigate(-1)} />
        <div className="hidden lg:block">
          <ResidentPageHeader
            title="Barangay Programs"
            subtitle="Official programs and community initiatives of Barangay Purisima."
          />
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim()) {
                setExpandedGroups({
                  'Disaster Management Programs': true,
                  'Infrastructure Programs': true,
                });
              }
            }}
            placeholder="Search programs..."
            aria-label="Search barangay programs"
            className="h-10 rounded-full border-border/55 bg-card pl-10 pr-4 text-xs shadow-[0_3px_12px_rgba(15,23,42,0.04)] placeholder:text-muted-foreground/80"
          />
        </div>

        <section className="mt-4 space-y-2" aria-live="polite">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            groupedPrograms.map(({ group, programs: groupPrograms }, groupIndex) => {
              const isExpanded = expandedGroups[group];
              const groupId = `program-group-${groupIndex}`;
              const groupAppearance = getProgramAppearance(group);
              const GroupIcon = groupAppearance.icon;

              return (
                <section
                  key={group}
                  className="overflow-hidden rounded-2xl border border-border/40 bg-card/60"
                >
                  <h2>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={groupId}
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [group]: !current[group],
                        }))
                      }
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${groupAppearance.iconClass}`}>
                          <GroupIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 text-sm font-bold text-foreground sm:text-base">
                          {group}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {groupPrograms.length}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </button>
                  </h2>
                  {isExpanded && (
                    <div
                      id={groupId}
                      className="space-y-2 border-t border-border/35 px-3 py-3 sm:px-4"
                    >
                      {groupPrograms.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          {query.trim()
                            ? 'No matching programs in this group.'
                            : 'No visible programs in this group.'}
                        </p>
                      ) : (
                        groupPrograms.map((program, index) => {
                          return (
                            <button
                              key={program.id}
                              type="button"
                              onClick={() => setSelectedProgram(program)}
                              className="group flex min-h-[68px] w-full animate-slide-up items-center gap-3 rounded-2xl border border-border/35 bg-card px-3 py-2.5 text-left shadow-[0_5px_16px_rgba(15,23,42,0.05)] transition-colors hover:border-primary/25 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4"
                              style={{ animationDelay: `${index * 35}ms` }}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-bold leading-tight text-foreground sm:text-sm">
                                  {program.title}
                                </span>
                                <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                                  {normalizeContent(program.description)}
                                </span>
                              </span>

                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      </main>

      <Dialog open={Boolean(selectedProgram)} onOpenChange={(open) => !open && setSelectedProgram(null)}>
        {selectedProgram && (
          <DialogContent
            className="max-h-[85vh] max-w-lg overflow-y-auto"
            closeButtonClassName="rounded-none bg-transparent p-0 shadow-none ring-0 ring-offset-0 hover:bg-transparent focus:bg-transparent focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-transparent"
          >
            <DialogHeader>
              <DialogTitle className="pr-8 text-left text-xl leading-snug">
                {selectedProgram.title}
              </DialogTitle>
            </DialogHeader>
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">About the Program</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {normalizeContent(selectedProgram.description)}
              </p>
            </section>
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Scheduled</h3>
              <div className="flex items-start gap-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 space-y-2">
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {normalizeContent(selectedProgram.schedule) || 'Schedule not provided'}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(selectedProgram.status)}`}
                  >
                    {selectedProgram.status === 'Not set'
                      ? 'Status not set'
                      : selectedProgram.status}
                  </span>
                </div>
              </div>
            </section>
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Area Covered</h3>
              <p className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="whitespace-pre-wrap">
                  {normalizeContent(selectedProgram.location) || 'Area not provided'}
                </span>
              </p>
            </section>
          </DialogContent>
        )}
      </Dialog>

      <BottomNav currentPath="/programs" />
    </div>
  );
};

export default Programs;
