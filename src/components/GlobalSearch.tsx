import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, CalendarDays, MapPin, Siren, Sparkles, Building } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const staticPrograms = [
  { title: 'Scholarship Program', path: '/programs' },
  { title: 'Health Program', path: '/programs' },
  { title: 'Livelihood Program', path: '/programs' },
  { title: 'Youth Program', path: '/programs' },
  { title: 'Senior Citizen Program', path: '/programs' },
];
const staticOffices = [
  'Mayor', 'Vice Mayor', 'Civil Registrar', 'Treasurer', 'Assessor',
  'MSWDO', 'MDRRMO', 'Rural Health Unit', 'Agriculture', 'Engineering', 'PESO', 'BPLO',
].map(n => ({ title: n, path: '/directory' }));

export const GlobalSearch = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  // Realtime invalidation
  const { data, refetch } = useQuery({
    queryKey: ['global-search'],
    queryFn: async () => {
      const [a, e, t, ec] = await Promise.all([
        supabase.from('announcements').select('id,title,excerpt').eq('is_active', true).limit(50),
        supabase.from('events').select('id,title,location,status').eq('is_active', true).limit(50),
        supabase.from('tourist_spots').select('id,title,location').eq('is_active', true).limit(50),
        (supabase as any).from('emergency_contacts').select('id,department_name,service_type,contact_number').eq('is_active', true).limit(50),
      ]);
      return {
        announcements: a.data || [],
        events: e.data || [],
        spots: t.data || [],
        emergency: ec.data || [],
      };
    },
  });

  useEffect(() => {
    const channels = ['announcements', 'events', 'tourist_spots', 'emergency_contacts'].map(table =>
      supabase.channel(`gs-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => refetch())
        .subscribe()
    );
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [refetch]);

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const go = (path: string) => { onOpenChange(false); setQ(''); navigate(path); };

  const filteredPrograms = useMemo(() => {
    const s = q.toLowerCase();
    return staticPrograms.filter(p => p.title.toLowerCase().includes(s));
  }, [q]);
  const filteredOffices = useMemo(() => {
    const s = q.toLowerCase();
    return staticOffices.filter(p => p.title.toLowerCase().includes(s));
  }, [q]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search announcements, events, places, contacts..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Links">
          <CommandItem onSelect={() => go('/updates')}><Megaphone className="mr-2 h-4 w-4" />Announcements</CommandItem>
          <CommandItem onSelect={() => go('/events')}><CalendarDays className="mr-2 h-4 w-4" />Events</CommandItem>
          <CommandItem onSelect={() => go('/tourist-spots')}><MapPin className="mr-2 h-4 w-4" />Tourist Spots</CommandItem>
          <CommandItem onSelect={() => go('/emergency')}><Siren className="mr-2 h-4 w-4" />Emergency Contacts</CommandItem>
          <CommandItem onSelect={() => go('/programs')}><Sparkles className="mr-2 h-4 w-4" />Programs</CommandItem>
          <CommandItem onSelect={() => go('/directory')}><Building className="mr-2 h-4 w-4" />Directory</CommandItem>
        </CommandGroup>

        {!!data?.announcements.length && (
          <CommandGroup heading="Announcements">
            {data.announcements.map((a: any) => (
              <CommandItem key={a.id} value={`announcement ${a.title} ${a.excerpt || ''}`} onSelect={() => go('/updates')}>
                <Megaphone className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col"><span>{a.title}</span>{a.excerpt && <span className="text-xs text-muted-foreground line-clamp-1">{a.excerpt}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!data?.events.length && (
          <CommandGroup heading="Events">
            {data.events.map((ev: any) => (
              <CommandItem key={ev.id} value={`event ${ev.title} ${ev.location || ''}`} onSelect={() => go('/events')}>
                <CalendarDays className="mr-2 h-4 w-4 text-accent" />
                <div className="flex flex-col"><span>{ev.title}</span>{ev.location && <span className="text-xs text-muted-foreground">{ev.location}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!data?.spots.length && (
          <CommandGroup heading="Tourist Spots">
            {data.spots.map((s: any) => (
              <CommandItem key={s.id} value={`spot ${s.title} ${s.location || ''}`} onSelect={() => go('/tourist-spots')}>
                <MapPin className="mr-2 h-4 w-4 text-success" />
                <div className="flex flex-col"><span>{s.title}</span>{s.location && <span className="text-xs text-muted-foreground">{s.location}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!data?.emergency.length && (
          <CommandGroup heading="Emergency Contacts">
            {data.emergency.map((c: any) => (
              <CommandItem key={c.id} value={`emergency ${c.department_name} ${c.service_type} ${c.contact_number}`} onSelect={() => go('/emergency')}>
                <Siren className="mr-2 h-4 w-4 text-destructive" />
                <div className="flex flex-col"><span>{c.department_name}</span><span className="text-xs text-muted-foreground">{c.contact_number} • {c.service_type}</span></div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!filteredPrograms.length && (
          <CommandGroup heading="Programs">
            {filteredPrograms.map(p => (
              <CommandItem key={p.title} onSelect={() => go(p.path)}><Sparkles className="mr-2 h-4 w-4" />{p.title}</CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!filteredOffices.length && (
          <CommandGroup heading="Offices">
            {filteredOffices.map(p => (
              <CommandItem key={p.title} onSelect={() => go(p.path)}><Building className="mr-2 h-4 w-4" />{p.title}</CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};
