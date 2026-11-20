import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, LogOut, MapPin, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { isConfirmedTestReport } from '@/features/reports/testReports';

type StaffReport = Pick<
  Tables<'community_reports'>,
  'id' | 'title' | 'description' | 'status' | 'location' | 'created_at' | 'ai_priority' | 'due_at'
>;

const staffRequestKey = ['staff', 'requests'] as const;

export default function StaffRequests() {
  const { signOut, staffDepartmentId } = useAuth();
  const queryClient = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: staffRequestKey,
    queryFn: async (): Promise<StaffReport[]> => {
      const { data, error } = await supabase
        .from('community_reports')
        .select('id,title,description,status,location,created_at,ai_priority,due_at')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.filter((report) => !isConfirmedTestReport(report));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`staff-requests-${staffDepartmentId ?? 'department'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_reports' }, () =>
        queryClient.invalidateQueries({ queryKey: staffRequestKey }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, staffDepartmentId]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'in_progress' | 'completed' }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('community_reports')
        .update({
          status,
          acknowledged_at: status === 'in_progress' ? now : undefined,
          resolved_at: status === 'completed' ? now : undefined,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request status updated');
      queryClient.invalidateQueries({ queryKey: staffRequestKey });
    },
    onError: (error: Error) => toast.error(error.message || 'Update failed'),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">Department Request Queue</h1>
            <p className="text-sm text-muted-foreground">Requests assigned to your department</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 p-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : reports.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No requests are assigned to your department.</CardContent></Card>
        ) : reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="text-base">{report.title.replace(/^\[REPORT\]\s*/, '')}</CardTitle>
                <Badge variant="secondary">{report.status.replace(/_/g, ' ')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm text-muted-foreground">{report.description}</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {report.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{report.location}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(report.created_at).toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                {['pending', 'under_review', 'assigned'].includes(report.status) && (
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: report.id, status: 'in_progress' })}>
                    <PlayCircle className="mr-2 h-4 w-4" />Start work
                  </Button>
                )}
                {report.status === 'in_progress' && (
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: report.id, status: 'completed' })}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Mark resolved
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
