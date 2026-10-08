import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, GraduationCap, HeartPulse, Briefcase, Users, Baby, Sprout } from 'lucide-react';

const programs: { icon: typeof GraduationCap; category: string; title: string; description: string; schedule: string; color: string; bg: string }[] = [];

const Programs = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden">
            <ArrowLeft className="h-5 w-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Community Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">Community programs for Barangay Purisima, Tago, Surigao del Sur</p>
        </div>
        <div className="px-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">No verified community programs available for Barangay Purisima yet.</p>}
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
