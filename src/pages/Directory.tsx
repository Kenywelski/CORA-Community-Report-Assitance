import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import {
  ArrowLeft,
  Building2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  UserCheck,
} from 'lucide-react';
import {
  type BarangayOfficeItem,
  loadBarangayOffices,
} from '@/lib/barangayContentStore';

const Directory = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [offices, setOffices] = useState<BarangayOfficeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchOffices = () => {
      loadBarangayOffices().then((data) => {
        if (!mounted) return;
        setOffices(data.filter((o) => o.is_active));
        setLoading(false);
      });
    };
    fetchOffices();
    window.addEventListener('cora:offices-updated', fetchOffices);
    return () => {
      mounted = false;
      window.removeEventListener('cora:offices-updated', fetchOffices);
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return offices;
    return offices.filter((o) =>
      `${o.name} ${o.head_or_role} ${o.location} ${o.email} ${o.services_offered}`
        .toLowerCase()
        .includes(s)
    );
  }, [q, offices]);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Barangay Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official barangay offices and contact information for Barangay Purisima, Tago, Surigao del Sur
          </p>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search office, services, location, email..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="px-4 grid gap-4 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-10 text-center text-muted-foreground">
                No matching barangay office found.
              </CardContent>
            </Card>
          ) : (
            filtered.map((o, i) => (
              <Card
                key={o.id}
                variant="elevated"
                className="animate-slide-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug">
                        {o.name}
                      </CardTitle>
                      {o.head_or_role && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{o.head_or_role}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {o.services_offered && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/60 rounded-lg p-2.5">
                      {o.services_offered}
                    </p>
                  )}
                  <a
                    href={`tel:${o.phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-2 text-primary font-medium hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0" /> {o.phone}
                  </a>
                  {o.email && (
                    <a
                      href={`mailto:${o.email}`}
                      className="flex items-center gap-2 text-primary hover:underline break-all"
                    >
                      <Mail className="h-4 w-4 shrink-0" /> {o.email}
                    </a>
                  )}
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                    {o.location}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0 text-primary" />{' '}
                    {o.hours}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      <BottomNav currentPath="/directory" />
    </div>
  );
};

export default Directory;
