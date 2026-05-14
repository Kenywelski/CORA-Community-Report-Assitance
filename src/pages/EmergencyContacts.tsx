import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Phone, MapPin, Clock, Siren, Shield, Flame, HeartPulse, Anchor, Building, AlertTriangle } from 'lucide-react';

const typeIcon: Record<string, any> = {
  Police: Shield,
  Fire: Flame,
  'Disaster/Rescue': AlertTriangle,
  'Health/Hospital': HeartPulse,
  Maritime: Anchor,
  Government: Building,
  Barangay: Building,
};

const EmergencyContacts = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['public-emergency-contacts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('emergency_contacts').select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('ec-public-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_contacts' },
        () => qc.invalidateQueries({ queryKey: ['public-emergency-contacts'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="bg-gradient-to-b from-destructive to-destructive/80 px-4 pt-12 pb-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/80 hover:text-white mb-6 lg:hidden">
            <ArrowLeft className="h-5 w-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Siren className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Emergency Contacts</h1>
              <p className="text-white/80 text-sm">Municipality of Cortes • Tap to call</p>
            </div>
          </div>
        </div>

        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        <div className="px-4 -mt-2 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8 col-span-full">Loading...</p>
          ) : !contacts?.length ? (
            <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">No emergency contacts available.</CardContent></Card>
          ) : contacts.map((c) => {
            const Icon = typeIcon[c.service_type] || Siren;
            return (
              <Card key={c.id} variant="elevated">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight">{c.department_name}</CardTitle>
                        <Badge variant="secondary" className="mt-1.5">{c.service_type}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <a href={`tel:${c.contact_number.replace(/[^0-9+]/g, '')}`}>
                    <Button variant="outline" className="w-full justify-start gap-2 font-semibold">
                      <Phone className="h-4 w-4" /> {c.contact_number}
                    </Button>
                  </a>
                  {c.address && <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{c.address}</p>}
                  <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />{c.availability}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav currentPath="/emergency" />
    </div>
  );
};

export default EmergencyContacts;
