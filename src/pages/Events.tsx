import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CalendarDays, MapPin, Users, Target, User, Phone, Clock } from 'lucide-react';
import { format } from 'date-fns';

const statusColor: Record<string, string> = {
  upcoming: 'bg-primary/10 text-primary',
  ongoing: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  postponed: 'bg-warning/10 text-warning',
};

const Events = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ['public-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events').select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('events-public-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },
        () => qc.invalidateQueries({ queryKey: ['public-events'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 lg:pt-8 pb-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground mb-4 lg:hidden">
            <ArrowLeft className="h-5 w-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground text-sm mt-1">Upcoming and recent municipal events</p>
        </div>

        <div className="px-4 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : !events?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No events scheduled yet.</CardContent></Card>
          ) : events.map((ev) => (
            <Card key={ev.id} variant="elevated">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ev.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(ev.event_date), 'PPP • p')}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColor[ev.status] || ''}>{ev.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {ev.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {ev.location}</p>}
                {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
                {ev.purpose && <div><span className="font-semibold">Purpose: </span><span className="text-muted-foreground">{ev.purpose}</span></div>}
                {ev.objective && <p className="flex items-start gap-2"><Target className="h-4 w-4 text-muted-foreground mt-0.5" /><span><span className="font-semibold">Objective: </span>{ev.objective}</span></p>}
                {ev.target_participants && <p className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span><span className="font-semibold">Participants: </span>{ev.target_participants}</span></p>}
                {ev.organizer_name && (
                  <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />
                    <span><span className="font-semibold">Organizer: </span>{ev.organizer_name}</span>
                  </p>
                )}
                {ev.organizer_contact && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{ev.organizer_contact}</p>}
                {ev.schedule_details && (
                  <div className="rounded-lg bg-muted/40 p-3 mt-2">
                    <p className="font-semibold flex items-center gap-2 mb-1"><Clock className="h-4 w-4" /> Schedule</p>
                    <p className="text-muted-foreground whitespace-pre-line">{ev.schedule_details}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav currentPath="/events" />
    </div>
  );
};

export default Events;
