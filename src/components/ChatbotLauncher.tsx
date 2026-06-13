import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Bot, Headphones, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AiMsg { role: 'user' | 'assistant'; content: string }
interface StaffMsg { id: string; role: string; content: string; sender_id: string | null; created_at: string }

export const ChatbotLauncher = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'ai' | 'staff'>('ai');

  // ===== AI chat state =====
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([
    { role: 'assistant', content: "Hi! I'm myCortes Assistant 👋\n\nAsk me about municipal services, programs, emergency contacts, or how to use the app. For specific case help, switch to the **Admin/Staff** tab." },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  // ===== Staff chat state =====
  const [staffInput, setStaffInput] = useState('');
  const [staffThreadId, setStaffThreadId] = useState<string | null>(null);
  const staffScrollRef = useRef<HTMLDivElement>(null);

  // Load or create staff thread when tab opens
  useEffect(() => {
    if (!user || tab !== 'staff' || staffThreadId) return;
    (async () => {
      const { data: existing } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .eq('mode', 'staff')
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        setStaffThreadId(existing.id);
      } else {
        const { data: created, error } = await supabase
          .from('chat_threads')
          .insert({ user_id: user.id, mode: 'staff', title: 'Conversation with municipal staff' })
          .select('id')
          .single();
        if (!error && created) setStaffThreadId(created.id);
      }
    })();
  }, [user, tab, staffThreadId]);

  const { data: staffMessages = [] } = useQuery({
    queryKey: ['staff-thread-messages', staffThreadId],
    queryFn: async (): Promise<StaffMsg[]> => {
      if (!staffThreadId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', staffThreadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StaffMsg[];
    },
    enabled: !!staffThreadId,
  });

  useEffect(() => {
    if (!staffThreadId) return;
    const ch = supabase
      .channel(`thread-${staffThreadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${staffThreadId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['staff-thread-messages', staffThreadId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [staffThreadId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiMessages]);
  useEffect(() => {
    if (staffScrollRef.current) staffScrollRef.current.scrollTop = staffScrollRef.current.scrollHeight;
  }, [staffMessages]);

  const sendAi = async () => {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    const next = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(next);
    setAiInput('');
    setAiBusy(true);
    // Optimistic empty assistant message
    setAiMessages([...next, { role: 'assistant', content: '' }]);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let assistant = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              setAiMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistant };
                return copy;
              });
            }
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch (e) {
      const message = (e as Error).message || 'Failed to reach the assistant';
      setAiMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${message}` };
        return copy;
      });
      toast.error(message);
    } finally {
      setAiBusy(false);
    }
  };

  const sendStaff = async () => {
    const text = staffInput.trim();
    if (!text || !user || !staffThreadId) return;
    setStaffInput('');
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: staffThreadId, role: 'user', content: text, sender_id: user.id,
    });
    if (error) {
      toast.error('Failed to send');
      setStaffInput(text);
      return;
    }
    await supabase.from('chat_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', staffThreadId);
  };

  if (!user) {
    return (
      <button
        onClick={() => navigate('/auth')}
        className="fixed bottom-24 right-4 lg:bottom-6 z-40 h-14 w-14 rounded-full bg-[hsl(174,55%,22%)] text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Sign in to chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-6 z-40 h-14 w-14 rounded-full bg-[hsl(174,55%,22%)] text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Open chatbot"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 bg-background/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-0">
          <div
            className="absolute inset-0 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:w-[400px] h-[85vh] sm:h-[600px] bg-card border border-border sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">myCortes Helper</h3>
                  <p className="text-xs opacity-90">Always here to help</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-primary-foreground hover:bg-white/20 h-8 w-8">
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'ai' | 'staff')} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2 m-2 mb-0">
                <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> AI Assistant</TabsTrigger>
                <TabsTrigger value="staff" className="gap-1.5"><Headphones className="h-4 w-4" /> Admin/Staff</TabsTrigger>
              </TabsList>

              {/* AI tab */}
              <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden m-0 mt-2">
                <div ref={aiScrollRef} className="flex-1 px-3 overflow-y-auto">
                  <div className="space-y-3 py-2">
                    {aiMessages.map((m, i) => (
                      <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}>
                          {m.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                              {m.content ? (
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin opacity-60" />
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-2 border-t bg-card flex gap-2">
                  <Textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendAi();
                      }
                    }}
                    placeholder="Ask about services, offices, programs..."
                    rows={1}
                    className="resize-none min-h-[40px] max-h-32"
                    disabled={aiBusy}
                  />
                  <Button onClick={sendAi} disabled={!aiInput.trim() || aiBusy} size="icon" className="h-10 w-10 shrink-0">
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </TabsContent>

              {/* Staff tab */}
              <TabsContent value="staff" className="flex-1 flex flex-col overflow-hidden m-0 mt-2">
                <div className="px-3 py-2 bg-muted/40 border-b text-xs text-muted-foreground">
                  Messages go to municipal staff. They'll reply when available.
                </div>
                <div ref={staffScrollRef} className="flex-1 px-3 overflow-y-auto">
                  <div className="space-y-3 py-2">
                    {staffMessages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No messages yet. Start by saying hello 👋
                      </div>
                    ) : staffMessages.map((m) => {
                      const isMine = m.sender_id === user.id;
                      return (
                        <div key={m.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                          <div className={cn(
                            'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                            isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            {!isMine && <span className="font-medium text-primary">Staff · </span>}
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-2 border-t bg-card flex gap-2">
                  <Textarea
                    value={staffInput}
                    onChange={(e) => setStaffInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendStaff();
                      }
                    }}
                    placeholder="Type your message to staff..."
                    rows={1}
                    className="resize-none min-h-[40px] max-h-32"
                    disabled={!staffThreadId}
                  />
                  <Button onClick={sendStaff} disabled={!staffInput.trim() || !staffThreadId} size="icon" className="h-10 w-10 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </>
  );
};
