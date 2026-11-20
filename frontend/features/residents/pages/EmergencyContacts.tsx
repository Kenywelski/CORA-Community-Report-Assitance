import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Siren,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import { getEmergencyContactAppearance } from '@/features/emergency-contacts/contactAppearance';
import { emergencyContactQueryKeys } from '@/features/emergency-contacts/queryKeys';
import { emergencyContactTelHref, parseEmergencyContactNumbers } from '@/features/emergency-contacts/contactNumbers';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'emergency_contacts'>;

const EmergencyContacts = () => {
  const { data: contacts, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: emergencyContactQueryKeys.resident,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <main className="app-container px-4 pb-6 pt-5 lg:pt-6">
        <ResidentPageHeader
          title="Emergency Contacts"
          subtitle="Reach local emergency and public services in Tago."
          className="mb-5"
        />

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading emergency contacts">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-48 animate-pulse rounded-2xl border border-border/40 bg-card" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-sm">
            <Siren className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-3 font-semibold text-foreground">Contacts couldn't be loaded</h2>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button className="mt-4" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              Try again
            </Button>
          </div>
        ) : !contacts?.length ? (
          <div className="rounded-2xl border border-border/40 bg-card px-4 py-12 text-center shadow-sm">
            <Siren className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold text-foreground">No emergency contacts yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published Tago emergency numbers will appear here.</p>
          </div>
        ) : (
          <section aria-label="Emergency contact list" className="space-y-2">
            {contacts.map((contact) => {
              const appearance = getEmergencyContactAppearance(contact.department_name, contact.service_type);
              const Icon = appearance.icon;
              const contactNumbers = parseEmergencyContactNumbers(contact.contact_number);
              const location = contact.address?.trim() || 'Tago, Surigao del Sur';

              return (
                <details
                  key={contact.id}
                  className="group overflow-hidden rounded-xl border border-border/55 bg-card shadow-[0_3px_9px_rgba(15,23,42,0.07)] transition-colors"
                >
                  <summary className="flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 sm:px-4 [&::-webkit-details-marker]:hidden">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${appearance.iconClass}`}>
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span aria-hidden="true" className="h-8 border-l border-emerald-700/35" />
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                        {contact.department_name}
                      </h2>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                        {contact.service_type}
                      </p>
                    </div>
                    {contactNumbers.length > 0 && (
                      <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                        {contactNumbers.length} {contactNumbers.length === 1 ? 'number' : 'numbers'}
                      </span>
                    )}
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-foreground/70 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>

                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="border-t border-border/60 pt-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {location}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {contact.availability}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {contactNumbers.length ? 'Call this service' : 'Phone contact'}
                          </p>
                          {contactNumbers.length > 0 && (
                            <span className="text-[10px] font-medium text-muted-foreground sm:hidden">
                              {contactNumbers.length} {contactNumbers.length === 1 ? 'number' : 'numbers'}
                            </span>
                          )}
                        </div>
                        {contactNumbers.length ? (
                          <div className="grid gap-2">
                            {contactNumbers.map((number, index) => (
                              <a
                                key={`${number}-${index}`}
                                href={emergencyContactTelHref(number)}
                                aria-label={`Call ${contact.department_name} at ${number}`}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold tabular-nums text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                <Phone className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap">{number}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-muted px-3 py-3 text-center text-sm font-medium text-muted-foreground">
                            Number not available
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </section>
        )}
      </main>

      <BottomNav currentPath="/emergency" />
    </div>
  );
};

export default EmergencyContacts;
