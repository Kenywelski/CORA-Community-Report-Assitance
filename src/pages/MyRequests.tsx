import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ClipboardList, Clock, CheckCircle2, XCircle, Loader2, ListChecks, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ServiceRequest {
  id: string;
  title: string;
  category: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
  location: string | null;
}

const statusConfig = {
  pending: { icon: ClipboardList, color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', label: 'Pending' },
  in_progress: { icon: Clock, color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'bg-green-500/15 text-green-600 dark:text-green-400', label: 'Completed' },
  rejected: { icon: XCircle, color: 'bg-destructive/10 text-destructive', label: 'Rejected' },
};

const MyRequests = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['my-requests', user?.id],
    queryFn: async (): Promise<ServiceRequest[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('id,title,category,status,created_at,location')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ServiceRequest[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-requests-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['my-requests', user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  const recentRequests = requests.slice(0, 5);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        {/* Header */}
        <div className="px-4 pt-12 pb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your service requests in real time</p>
        </div>

        <AuthGuard fallback="message">
          {/* Stats Grid */}
          <div className="px-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-muted', Icon: ListChecks },
                { label: 'Pending', value: stats.pending, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', Icon: ClipboardList },
                { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', Icon: Clock },
                { label: 'Completed', value: stats.completed, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', Icon: CheckCircle2 },
              ].map((stat) => (
                <Card key={stat.label} variant="elevated">
                  <CardContent className="p-4">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', stat.bg)}>
                      <stat.Icon className={cn('h-5 w-5', stat.color)} />
                    </div>
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 mb-4">
              <Card variant="flat" className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">Failed to load requests. Please try again.</p>
                </div>
              </Card>
            </div>
          )}

          {/* Recent Requests */}
          <div className="px-4 mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Requests</h2>
            {requests.length > 5 && (
              <span className="text-xs text-muted-foreground">Showing 5 of {requests.length}</span>
            )}
          </div>

          <div className="px-4 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentRequests.length === 0 ? (
              <Card variant="flat" className="p-8 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No requests yet</p>
                <button
                  onClick={() => navigate('/request-service')}
                  className="text-primary font-medium mt-2 hover:underline"
                >
                  Submit your first request
                </button>
              </Card>
            ) : (
              recentRequests.map((request, index) => {
                const config = statusConfig[request.status];
                const Icon = config.icon;

                return (
                  <Card
                    key={request.id}
                    variant="elevated"
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {request.category}
                        </Badge>
                        <Badge className={cn('text-xs', config.color)}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <h3 className="font-semibold">{request.title}</h3>
                      {request.location && (
                        <p className="text-sm text-muted-foreground mt-1">{request.location}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Submitted {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </AuthGuard>
      </div>

      <BottomNav currentPath="/" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default MyRequests;
