import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCheck,
  Circle,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Send,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
  id: string;
  thread_id: string;
  role: string;
  content: string;
  sender_id: string | null;
  created_at: string;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R';

const getThreadTime = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
};

const getMessageDateLabel = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
};

const AdminChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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

    const userIds = [...new Set(threads.map((thread) => thread.user_id))];
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds)
      .then(({ data }) => {
        if (!data) return;
        setProfileNames(
          Object.fromEntries(
            data.map((profile) => [profile.user_id, profile.full_name || 'Resident']),
          ),
        );
      });
  }, [threads]);

  useEffect(() => {
    if (activeId || threads.length === 0) return;
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setActiveId(threads[0].id);
    }
  }, [activeId, threads]);

  const threadIds = useMemo(() => threads.map((thread) => thread.id), [threads]);

  const { data: threadPreviews = {} } = useQuery({
    queryKey: ['admin-chat-thread-previews', threadIds],
    queryFn: async (): Promise<Record<string, Msg>> => {
      if (threadIds.length === 0) return {};

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      return ((data || []) as Msg[]).reduce<Record<string, Msg>>((latest, message) => {
        if (!latest[message.thread_id]) latest[message.thread_id] = message;
        return latest;
      }, {});
    },
    enabled: threadIds.length > 0,
  });

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
    enabled: Boolean(activeId),
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-chat-threads'] });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const message = payload.new as { thread_id?: string };
          if (message.thread_id === activeId) {
            queryClient.invalidateQueries({ queryKey: ['admin-chat-messages', activeId] });
          }
          queryClient.invalidateQueries({ queryKey: ['admin-chat-thread-previews'] });
          queryClient.invalidateQueries({ queryKey: ['admin-chat-threads'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, messages]);

  useEffect(() => {
    setShowDetails(false);
  }, [activeId]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;

    return threads.filter((thread) => {
      const name = profileNames[thread.user_id] || 'Resident';
      const preview = threadPreviews[thread.id]?.content || thread.title || '';
      return name.toLowerCase().includes(query) || preview.toLowerCase().includes(query);
    });
  }, [profileNames, search, threadPreviews, threads]);

  const activeThread = threads.find((thread) => thread.id === activeId) || null;
  const activeName = activeThread ? profileNames[activeThread.user_id] || 'Resident' : '';

  const sendMessage = async () => {
    if (!input.trim() || !activeId || !user || isSending) return;

    const content = input.trim();
    setInput('');
    setIsSending(true);

    const { error } = await supabase.from('chat_messages').insert({
      thread_id: activeId,
      role: 'admin',
      content,
      sender_id: user.id,
    });

    if (error) {
      toast.error('Failed to send');
      setInput(content);
      setIsSending(false);
      return;
    }

    await supabase
      .from('chat_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeId);
    setIsSending(false);
  };

  return (
    <AdminLayout
      title="Staff Chat"
      subtitle="Communicate and coordinate with barangay staff"
    >
      <div className="mx-auto grid h-[calc(100dvh-260px)] max-h-[520px] min-h-[440px] w-full max-w-[960px] grid-cols-1 gap-2 lg:grid-cols-[minmax(240px,35%)_minmax(0,1fr)]">
        <Card
          variant="default"
          className={cn(
            'flex min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 bg-card shadow-soft',
            activeId && 'hidden lg:flex',
          )}
        >
          <div className="shrink-0 space-y-2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-[-0.025em] sm:text-base">
                Conversations
              </h2>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-extrabold text-primary">
                {threads.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
                className="h-8 rounded-lg border-border/70 bg-muted/15 pl-8 text-xs shadow-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {filteredThreads.length === 0 ? (
              <div className="flex h-full min-h-52 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquare className="h-6 w-6 opacity-50" />
                </span>
                <p className="text-sm font-semibold">No conversations found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const name = profileNames[thread.user_id] || 'Resident';
                const preview =
                  threadPreviews[thread.id]?.content || thread.title || 'No messages yet';
                const isActive = activeId === thread.id;
                const isOpen = thread.status === 'open';

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveId(thread.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2 border-b px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 last:border-b-0',
                      isActive
                        ? 'rounded-xl border-b-transparent bg-primary/10'
                        : 'rounded-none border-border/60 bg-card hover:bg-primary/10',
                    )}
                  >
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                      {getInitials(name)}
                      {isOpen && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-extrabold text-foreground sm:text-sm">
                          {name}
                        </p>
                        <time className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          {getThreadTime(thread.last_message_at)}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {preview}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card
          variant="default"
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border-border/70 bg-card shadow-soft',
            !activeId && 'hidden lg:flex',
          )}
        >
          {!activeId || !activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-foreground">Select a conversation</p>
                <p className="mt-1 text-sm">Choose a resident from the list to start replying.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 rounded-full lg:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                  {getInitials(activeName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{activeName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                    {activeThread.status === 'open' ? 'Online' : activeThread.status}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0 rounded-full border border-border/80 bg-card shadow-sm hover:bg-primary/10 hover:text-primary',
                    showDetails && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => setShowDetails((visible) => !visible)}
                  aria-label="Toggle conversation information"
                  aria-pressed={showDetails}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>

              {showDetails && (
                <div className="shrink-0 border-b border-border/70 bg-primary/[0.045] px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Conversation started:</span>{' '}
                  {format(new Date(activeThread.created_at), 'MMM d, yyyy, h:mm a')}
                  <span className="mx-2">&bull;</span>
                  <span className="font-semibold capitalize text-foreground">
                    {activeThread.status}
                  </span>
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 px-3 py-3">
                {messages.length === 0 && (
                  <div className="flex h-full min-h-48 items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  </div>
                )}

                {messages.map((message, index) => {
                  const isAdmin = message.role === 'admin';
                  const date = new Date(message.created_at);
                  const previousMessage = messages[index - 1];
                  const showDate =
                    !previousMessage ||
                    format(new Date(previousMessage.created_at), 'yyyy-MM-dd') !==
                      format(date, 'yyyy-MM-dd');

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div
                          className="mb-3 flex justify-center"
                          aria-label={getMessageDateLabel(message.created_at)}
                        >
                          <time className="rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                            {getMessageDateLabel(message.created_at)}
                          </time>
                        </div>
                      )}

                      <div
                        className={cn(
                          'flex items-end gap-2',
                          isAdmin ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {!isAdmin && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-extrabold text-primary">
                            {getInitials(activeName)}
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[86%] px-3 py-2 text-xs sm:max-w-[72%]',
                            isAdmin
                              ? 'rounded-xl rounded-br-sm bg-primary text-primary-foreground shadow-sm'
                              : 'rounded-xl rounded-bl-sm bg-muted/80 text-foreground',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {message.content}
                          </p>
                          <span className="mt-1 flex items-center justify-end gap-1">
                            <time
                              className={cn(
                                'text-[9px]',
                                isAdmin
                                  ? 'text-primary-foreground/80'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {format(date, 'h:mm a')}
                            </time>
                            {isAdmin && (
                              <CheckCheck className="h-3 w-3 text-primary-foreground/85" />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex shrink-0 items-end gap-2 border-t border-border/70 bg-card p-2">
                <Textarea
                  autoResize={false}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="min-h-8 max-h-20 resize-none rounded-xl border-border/70 bg-muted/20 px-3 py-2 text-xs shadow-none"
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isSending}
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full shadow-sm"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
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
