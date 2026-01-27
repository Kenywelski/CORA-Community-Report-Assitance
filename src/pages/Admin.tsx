import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Users, ClipboardList, Megaphone, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('Access denied');
    } else if (isAdmin) {
      fetchRequests();
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
    setIsLoading(false);
  };

  const updateStatus = async (id: string, status: 'pending' | 'in_progress' | 'completed' | 'rejected') => {
    const { error } = await supabase
      .from('service_requests')
      .update({ status })
      .eq('id', id);
    if (!error) {
      toast.success('Status updated');
      fetchRequests();
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="app-container">
        <div className="hero-gradient px-4 pt-12 pb-8">
          <button onClick={() => navigate('/profile')} className="flex items-center gap-2 text-white/80 hover:text-white mb-6">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Admin Dashboard</h1>
              <p className="text-white/70 text-sm">Manage requests & content</p>
            </div>
          </div>
        </div>
        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        <div className="px-4 -mt-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pending', value: stats.pending, icon: ClipboardList, color: 'text-warning bg-warning/10' },
              { label: 'In Progress', value: stats.in_progress, icon: Clock, color: 'text-primary bg-primary/10' },
              { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-success bg-success/10' },
            ].map((stat) => (
              <Card key={stat.label} variant="elevated">
                <CardContent className="p-3 text-center">
                  <stat.icon className={cn("h-5 w-5 mx-auto mb-1", stat.color.split(' ')[0])} />
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card variant="elevated">
            <CardHeader><CardTitle className="text-lg">Service Requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {requests.slice(0, 10).map((req) => (
                <div key={req.id} className="p-3 border rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <Badge variant="secondary">{req.category}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), 'MMM d')}</span>
                  </div>
                  <p className="font-medium text-sm">{req.title}</p>
                  <div className="flex gap-2">
                    {(['pending', 'in_progress', 'completed', 'rejected'] as const).map((s) => (
                      <Button key={s} size="sm" variant={req.status === s ? 'default' : 'outline'} onClick={() => updateStatus(req.id, s)} className="text-xs px-2 py-1 h-7">
                        {s.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
