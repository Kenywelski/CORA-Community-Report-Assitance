import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { emergencyContactQueryKeys } from '@/features/emergency-contacts/queryKeys';
import { reportQueryKeys } from '@/features/reports/api/reportQueryKeys';
import {
  dispatchPublicDataSync,
  type PublicSyncTable,
} from '@/features/realtime/publicDataSync';
import { supabase } from '@/integrations/supabase/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const publicSyncTables: PublicSyncTable[] = [
  'announcements',
  'emergency_contacts',
  'events',
  'knowledge_base',
  'community_reports',
];

const isPublicSyncTable = (value: unknown): value is PublicSyncTable =>
  publicSyncTables.some((table) => table === value);

function PublicRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('cora-public-sync', { config: { private: false } })
      .on('broadcast', { event: 'change' }, ({ payload }) => {
        const table = payload?.table;
        if (!isPublicSyncTable(table)) return;

        if (table === 'announcements') {
          void queryClient.invalidateQueries({ queryKey: ['landing-announcements'] });
          void queryClient.invalidateQueries({ queryKey: ['announcements-feed'] });
          void queryClient.invalidateQueries({ queryKey: ['announcement-count'] });
          void queryClient.invalidateQueries({ queryKey: ['wall-announcements'] });
        } else if (table === 'emergency_contacts') {
          void queryClient.invalidateQueries({ queryKey: emergencyContactQueryKeys.resident });
          void queryClient.invalidateQueries({ queryKey: emergencyContactQueryKeys.landing });
        } else if (table === 'knowledge_base') {
          void queryClient.invalidateQueries({ queryKey: ['landing-programs'] });
        } else if (table === 'community_reports') {
          void queryClient.invalidateQueries({ queryKey: reportQueryKeys.publicFeed() });
          void queryClient.invalidateQueries({ queryKey: [...reportQueryKeys.all, 'mine'] });
        }

        dispatchPublicDataSync(table);
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Public realtime synchronization failed:', error);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PublicRealtimeSync />
        <TooltipProvider>{children}</TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
