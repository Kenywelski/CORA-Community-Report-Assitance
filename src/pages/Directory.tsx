import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Search, Phone, Mail, MapPin, Clock } from 'lucide-react';

const offices = [
  { name: 'Office of the Municipal Mayor', phone: '(086) 211-1001', email: 'mayor@cortes.gov.ph', location: 'Municipal Hall, Poblacion, Cortes', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'Office of the Vice Mayor / SB', phone: '(086) 211-1002', email: 'sb@cortes.gov.ph', location: 'Municipal Hall, 2nd Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'Municipal Civil Registrar (MCR)', phone: '(086) 211-1003', email: 'mcr@cortes.gov.ph', location: 'Municipal Hall, Ground Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'Municipal Treasurer\'s Office (MTO)', phone: '(086) 211-1004', email: 'treasurer@cortes.gov.ph', location: 'Municipal Hall, Ground Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'Municipal Assessor\'s Office', phone: '(086) 211-1005', email: 'assessor@cortes.gov.ph', location: 'Municipal Hall, Ground Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'MSWDO – Social Welfare', phone: '(086) 211-1006', email: 'mswdo@cortes.gov.ph', location: 'Municipal Hall Annex', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'MDRRMO – Disaster Risk', phone: '(086) 211-1007', email: 'mdrrmo@cortes.gov.ph', location: 'MDRRMO Building, Poblacion', hours: '24/7 Emergency Response' },
  { name: 'Rural Health Unit (RHU)', phone: '(086) 211-1008', email: 'rhu@cortes.gov.ph', location: 'Health Center, Poblacion', hours: 'Mon–Fri, 7:00 AM – 5:00 PM' },
  { name: 'Municipal Agriculture Office', phone: '(086) 211-1009', email: 'agri@cortes.gov.ph', location: 'Municipal Hall Annex', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'Municipal Engineering Office', phone: '(086) 211-1010', email: 'engineering@cortes.gov.ph', location: 'Municipal Hall, 2nd Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'PESO – Public Employment', phone: '(086) 211-1011', email: 'peso@cortes.gov.ph', location: 'Municipal Hall, Ground Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
  { name: 'BPLO – Business Permits', phone: '(086) 211-1012', email: 'bplo@cortes.gov.ph', location: 'Municipal Hall, Ground Floor', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
];

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
          <h1 className="text-2xl font-bold">Municipal Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Offices and contact information of LGU Cortes</p>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search office, location, email..." className="pl-9" />
          </div>
        </div>

        <div className="px-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-muted-foreground">No offices match your search.</CardContent></Card>
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
