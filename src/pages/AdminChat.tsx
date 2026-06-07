import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Send, MessageSquare, User, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Thread {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
}
interface Msg {
  id: string; thread_id: string; role: string; content: string; sender_id: string | null; created_at: string;
}

const AdminChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const { data: threads = [] } = useQuery({
    queryKey: ['admin-chat-threads'],
    queryFn: async (): Promise<Thread[]> => {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('mode', 'staff')
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Thread[];
    },
  });

  // Load reporter names
  useEffect(() => {
    if (threads.length === 0) return;
    const ids = [...new Set(threads.map(t => t.user_id))];
    supabase.from('profiles').select('user_id, full_name').in('user_id', ids).then(({ data }) => {
      if (data) setProfileNames(Object.fromEntries(data.map(p => [p.user_id, p.full_name || 'Resident'])));
    });
  }, [threads]);

  const { data: messages = [] } = useQuery({
    queryKey: ['admin-chat-messages', activeId],
    queryFn: async (): Promise<Msg[]> => {
      if (!activeId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', activeId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Msg[];
    },
    enabled: !!activeId,
  });

  useEffect(() => {
    const ch = supabase
      .channel('admin-chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () =>
        queryClient.invalidateQueries({ queryKey: ['admin-chat-threads'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        if (payload?.new?.thread_id === activeId) {
          queryClient.invalidateQueries({ queryKey: ['admin-chat-messages', activeId] });
        }
        queryClient.invalidateQueries({ queryKey: ['admin-chat-threads'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, queryClient]);

  const send = async () => {
    if (!input.trim() || !activeId || !user) return;
    const text = input.trim();
    setInput('');
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: activeId, role: 'admin', content: text, sender_id: user.id,
    });
    if (error) { toast.error('Failed to send'); setInput(text); return; }
    await supabase.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', activeId);
  };

  return (
    <AdminLayout title="Staff Chat">
      <div className="space-y-4">
        <div hidden>
          <h1 className="text-2xl font-bold">Staff Chat</h1>
          <p className="text-sm text-muted-foreground">Live conversations with residents.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
          {/* Thread list */}
          <Card variant="elevated" className="overflow-hidden flex flex-col">
            <CardContent className="p-0 overflow-y-auto flex-1">
              {threads.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No conversations yet
                </div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      'w-full text-left p-3 border-b hover:bg-muted/50 transition-colors flex items-start gap-2',
                      activeId === t.id && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profileNames[t.user_id] || 'Resident'}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.title || 'Conversation'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">{t.status}</Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card variant="elevated" className="flex flex-col overflow-hidden">
            {!activeId ? (
              <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </CardContent>
            ) : (
              <>
                <div className="px-4 py-3 border-b">
                  <p className="font-semibold text-sm">{profileNames[threads.find(t => t.id === activeId)?.user_id || ''] || 'Resident'}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const isAdmin = m.role === 'admin';
                    return (
                      <div key={m.id} className={cn('flex flex-col', isAdmin ? 'items-end' : 'items-start')}>
                        <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                          isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          {isAdmin ? 'You · ' : ''}{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 border-t flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Reply to resident..."
                    rows={2}
                    className="resize-none"
                  />
                  <Button onClick={send} disabled={!input.trim()} size="icon" className="h-10 w-10 self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminChat;
