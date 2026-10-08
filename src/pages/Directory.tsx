import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Search, Phone, Mail, MapPin, Clock } from 'lucide-react';

const offices: { name: string; phone: string; email: string; location: string; hours: string }[] = [];

const Directory = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return offices;
    return offices.filter(o => `${o.name} ${o.location} ${o.email}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden">
            <ArrowLeft className="h-5 w-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Barangay Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Office information for Barangay Purisima, Tago, Surigao del Sur</p>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search office, location, email..." className="pl-9" />
          </div>
        </div>

        <div className="px-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-muted-foreground">No verified office information available for Barangay Purisima yet.</CardContent></Card>
          ) : filtered.map((o, i) => (
            <Card key={o.name} variant="elevated" className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{o.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-4 w-4" /> {o.phone}
                </a>
                <a href={`mailto:${o.email}`} className="flex items-center gap-2 text-primary hover:underline break-all">
                  <Mail className="h-4 w-4 shrink-0" /> {o.email}
                </a>
                <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {o.location}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> {o.hours}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav currentPath="/directory" />
    </div>
  );
};

export default Directory;
