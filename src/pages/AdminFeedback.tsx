import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Star, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Tables } from '@/integrations/supabase/types';

type Feedback = Tables<'feedback'>;

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setFeedback(data);
    setIsLoading(false);
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete feedback');
    } else {
      toast.success('Feedback deleted');
      fetchFeedback();
    }
  };

  const averageRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.filter(f => f.rating).length).toFixed(1)
    : '0';

  if (isLoading) {
    return (
      <AdminLayout title="Feedback" subtitle="View user feedback">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Feedback" subtitle={`${feedback.length} total submissions`}>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-warning/10">
              <Star className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{averageRating}</p>
              <p className="text-xs text-muted-foreground">Average Rating</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{feedback.length}</p>
              <p className="text-xs text-muted-foreground">Total Feedback</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {feedback.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No feedback yet</p>
            </CardContent>
          </Card>
        ) : (
          feedback.map((item) => (
            <Card key={item.id} variant="elevated">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{item.subject}</h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_anonymous && (
                      <Badge variant="secondary" className="text-xs">Anonymous</Badge>
                    )}
                    {item.rating && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < item.rating! ? 'text-warning fill-warning' : 'text-muted'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{item.message}</p>
                <div className="flex justify-end mt-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFeedback(item.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFeedback;
