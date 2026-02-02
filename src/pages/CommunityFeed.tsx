import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Heart, MapPin, Clock, AlertTriangle, Construction, Trash2, Lightbulb, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, React.ElementType> = {
  'Report: Road Damage': Construction,
  'Report: Garbage': Trash2,
  'Report: Flooding': AlertTriangle,
  'Report: Street Light': Lightbulb,
  'Report: Other': HelpCircle,
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  in_progress: 'bg-primary/10 text-primary border-primary/20',
  completed: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

const CommunityFeed = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('session_id', id);
    }
    return id;
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ['community-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .like('category', 'Report:%')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: likesData } = useQuery({
    queryKey: ['report-likes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_likes')
        .select('report_id, user_id, session_id');
      if (error) throw error;
      return data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (reportId: string) => {
      if (user) {
        const { error } = await supabase
          .from('report_likes')
          .insert({ report_id: reportId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_likes')
          .insert({ report_id: reportId, session_id: sessionId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-likes'] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async (reportId: string) => {
      if (user) {
        const { error } = await supabase
          .from('report_likes')
          .delete()
          .eq('report_id', reportId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_likes')
          .delete()
          .eq('report_id', reportId)
          .eq('session_id', sessionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-likes'] });
    },
  });

  const getLikesCount = (reportId: string) => {
    return likesData?.filter((like) => like.report_id === reportId).length || 0;
  };

  const isLikedByUser = (reportId: string) => {
    if (!likesData) return false;
    if (user) {
      return likesData.some((like) => like.report_id === reportId && like.user_id === user.id);
    }
    return likesData.some((like) => like.report_id === reportId && like.session_id === sessionId);
  };

  const handleLikeToggle = (reportId: string) => {
    if (isLikedByUser(reportId)) {
      unlikeMutation.mutate(reportId);
    } else {
      likeMutation.mutate(reportId);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-container">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Community Reports</h1>
              <p className="text-xs text-muted-foreground">See what's happening in your area</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
          ) : reports?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No community reports yet. Be the first to report an issue!
              </CardContent>
            </Card>
          ) : (
            reports?.map((report) => {
              const Icon = categoryIcons[report.category] || HelpCircle;
              const likesCount = getLikesCount(report.id);
              const liked = isLikedByUser(report.id);

              return (
                <Card key={report.id} variant="elevated" className="overflow-hidden">
                  {report.photo_url && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={report.photo_url}
                        alt={report.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-sm line-clamp-1">{report.title}</h3>
                          <Badge className={cn('text-xs', statusColors[report.status])}>
                            {report.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {report.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {report.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(report.created_at), 'MMM d')}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'gap-1.5 text-muted-foreground hover:text-destructive',
                          liked && 'text-destructive'
                        )}
                        onClick={() => handleLikeToggle(report.id)}
                        disabled={likeMutation.isPending || unlikeMutation.isPending}
                      >
                        <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
                        <span>{likesCount}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
};

export default CommunityFeed;
