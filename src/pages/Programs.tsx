import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, GraduationCap, HeartPulse, Briefcase, Users, Baby, Sprout } from 'lucide-react';

const programs = [
  {
    icon: GraduationCap,
    category: 'Scholarship',
    title: 'Cortes Municipal Scholarship Program',
    description: 'Financial assistance for deserving students from Cortes pursuing college education.',
    schedule: 'Application: June – August yearly',
    color: 'text-primary', bg: 'bg-primary/10',
  },
  {
    icon: HeartPulse,
    category: 'Health',
    title: 'Free Medical & Dental Mission',
    description: 'Quarterly medical, dental, and laboratory check-ups for residents at the Rural Health Unit.',
    schedule: 'Every 1st Saturday of the quarter',
    color: 'text-destructive', bg: 'bg-destructive/10',
  },
  {
    icon: Sprout,
    category: 'Livelihood',
    title: 'Sustainable Livelihood Program (SLP)',
    description: 'Capital, training, and seedling assistance for farmers, fisherfolk, and small enterprises.',
    schedule: 'Continuous enrollment at MSWDO',
    color: 'text-success', bg: 'bg-success/10',
  },
  {
    icon: Users,
    category: 'Youth',
    title: 'Sangguniang Kabataan (SK) Programs',
    description: 'Sports clinics, leadership training, and youth development activities per barangay.',
    schedule: 'Year-round',
    color: 'text-accent', bg: 'bg-accent/10',
  },
  {
    icon: Baby,
    category: 'Senior Citizen',
    title: 'OSCA Benefits & Pension Distribution',
    description: 'Social pension, ID issuance, and special assistance for senior citizens of Cortes.',
    schedule: 'Distribution every quarter',
    color: 'text-warning', bg: 'bg-warning/10',
  },
  {
    icon: Briefcase,
    category: 'Employment',
    title: 'PESO Job Placement & TUPAD',
    description: 'Job referrals, special program for employment, and emergency employment (TUPAD).',
    schedule: 'Apply anytime at PESO Office',
    color: 'text-primary', bg: 'bg-primary/10',
  },
];

const Programs = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden">
            <ArrowLeft className="h-5 w-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Municipal Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">Active programs and services for Cortes residents</p>
        </div>
        <div className="px-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((p, i) => {
            const Icon = p.icon;
            return (
              <Card key={p.title} variant="elevated" className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${p.bg} ${p.color}`}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <Badge variant="secondary" className="mb-1">{p.category}</Badge>
                      <CardTitle className="text-base leading-snug">{p.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <p className="text-xs font-medium text-foreground"><span className="text-muted-foreground">Schedule: </span>{p.schedule}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav currentPath="/programs" />
    </div>
  );
};

export default Programs;
