import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Send, MessageSquare, User, Search, ArrowLeft, Circle } from 'lucide-react';
import { formatDistanceToNow, format, isToday } from 'date-fns';
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

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || 'R';

const AdminChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      (profileNames[t.user_id] || 'Resident').toLowerCase().includes(q) ||
      (t.title || '').toLowerCase().includes(q));
  }, [threads, search, profileNames]);

  const activeThread = threads.find((t) => t.id === activeId) || null;
  const activeName = activeThread ? (profileNames[activeThread.user_id] || 'Resident') : '';

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
    <AdminLayout title="Staff Chat" subtitle="Live conversations with residents">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-190px)]">
        {/* Thread list */}
        <Card
          variant="elevated"
          className={cn('overflow-hidden flex flex-col', activeId && 'hidden lg:flex')}
        >
          <div className="p-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Conversations</p>
              <Badge variant="secondary" className="text-[10px]">{threads.length}</Badge>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search residents..."
                className="pl-9 h-9 rounded-xl"
              />
            </div>
          </div>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No conversations found
              </div>
            ) : (
              filtered.map((t) => {
                const name = profileNames[t.user_id] || 'Resident';
                const isActive = activeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      'w-full text-left px-3 py-3 border-b last:border-b-0 flex items-start gap-3 transition-colors',
                      isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                      {initials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.title || 'Conversation with municipal staff'}</p>
                      <Badge
                        variant={t.status === 'open' ? 'secondary' : 'outline'}
                        className="mt-1 text-[9px] capitalize"
                      >
                        {t.status}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card variant="elevated" className={cn('flex flex-col overflow-hidden', !activeId && 'hidden lg:flex')}>
          {!activeId ? (
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <MessageSquare className="h-7 w-7 opacity-50" />
              </div>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs">Choose a resident from the list to start replying.</p>
            </CardContent>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-3 bg-muted/30">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => setActiveId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                  {initials(activeName)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{activeName}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Circle className="h-2 w-2 fill-current text-emerald-500" />
                    {activeThread?.status === 'open' ? 'Open conversation' : activeThread?.status}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
                )}
                {messages.map((m) => {
                  const isAdmin = m.role === 'admin';
                  const d = new Date(m.created_at);
                  return (
                    <div key={m.id} className={cn('flex flex-col', isAdmin ? 'items-end' : 'items-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 text-sm shadow-sm',
                          isAdmin
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                            : 'bg-card border rounded-2xl rounded-bl-md'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {isAdmin ? 'You · ' : ''}
                        {isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d, h:mm a')}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t bg-card flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type your reply... (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="resize-none min-h-[44px] max-h-32 rounded-2xl"
                />
                <Button onClick={send} disabled={!input.trim()} size="icon" className="h-11 w-11 rounded-full shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminChat;
