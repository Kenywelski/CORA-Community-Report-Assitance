import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Clock,
  GraduationCap,
  HeartPulse,
  Loader2,
  MapPin,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react';
import {
  type BarangayProgramItem,
  loadBarangayPrograms,
} from '@/lib/barangayContentStore';

const CATEGORY_STYLE: Record<
  BarangayProgramItem['category'],
  { icon: typeof GraduationCap; color: string; bg: string }
> = {
  'Health & Wellness': {
    icon: HeartPulse,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
  },
  'Youth & Education': {
    icon: GraduationCap,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
  },
  'Livelihood & Agriculture': {
    icon: Sprout,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  'Environment & Sanitation': {
    icon: Briefcase,
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-500/10',
  },
  'Senior Citizens & Social Welfare': {
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
  'Peace & Disaster Preparedness': {
    icon: ShieldCheck,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
};

const Programs = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<BarangayProgramItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchPrograms = () => {
      loadBarangayPrograms().then((data) => {
        if (!mounted) return;
        setPrograms(data.filter((p) => p.is_active));
        setLoading(false);
      });
    };
    fetchPrograms();
    window.addEventListener('cora:programs-updated', fetchPrograms);
    return () => {
      mounted = false;
      window.removeEventListener('cora:programs-updated', fetchPrograms);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Barangay Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official community programs and initiatives for Barangay Purisima, Tago, Surigao del Sur
          </p>
        </div>

        <div className="px-4 grid gap-4 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : programs.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-10 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No active barangay programs available for Barangay Purisima yet.
              </CardContent>
            </Card>
          ) : (
            programs.map((p, i) => {
              const style =
                CATEGORY_STYLE[p.category] ||
                CATEGORY_STYLE['Health & Wellness'];
              const Icon = style.icon;
              return (
                <Card
                  key={p.id}
                  variant="elevated"
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${style.bg} ${style.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="secondary">{p.category}</Badge>
                          <Badge variant="outline">{p.status}</Badge>
                        </div>
                        <CardTitle className="text-base leading-snug">
                          {p.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {p.description}
                    </p>
                    <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Schedule: {p.schedule}</span>
                      </p>
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>Venue: {p.location}</span>
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          Participants: {p.target_participants} ·{' '}
                          {p.coordinator}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
      <BottomNav currentPath="/programs" />
    </div>
  );
};

export default Programs;
