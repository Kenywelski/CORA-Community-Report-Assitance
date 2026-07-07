import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  MessageCircle, X, Send, Bot, Headphones, Loader2, ChevronDown,
  Trash2, FileText, AlertTriangle, Phone, Sparkles, Building2, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AiMsg { role: 'user' | 'assistant'; content: string; ts: number }
interface StaffMsg { id: string; role: string; content: string; sender_id: string | null; created_at: string }

const AUTH_ROUTES = ['/auth', '/login', '/register', '/signup', '/forgot-password', '/reset-password', '/otp', '/verify'];

const WELCOME: AiMsg = {
  role: 'assistant',
  ts: Date.now(),
  content: "Hi! I'm **myCortes Assistant** 👋\n\nAsk me about municipal services, programs, emergency contacts, or how to use the app. For specific case help, switch to the **Admin/Staff** tab.",
};

const QUICK_ACTIONS = [
  { icon: FileText, label: 'Request Services', prompt: 'How do I request a municipal service or document?' },
  { icon: AlertTriangle, label: 'Report an Issue', prompt: 'How do I report a community issue?' },
  { icon: Phone, label: 'Emergency Contacts', prompt: 'What are the emergency contact numbers in Cortes?' },
  { icon: Sparkles, label: 'Municipal Programs', prompt: 'What programs does the municipality offer?' },
  { icon: Building2, label: 'Office Directory', prompt: 'List the municipal offices and what they do.' },
  { icon: HelpCircle, label: 'FAQs', prompt: 'What are frequently asked questions about myCortes?' },
];

const STORAGE_KEY = 'mycortes-chat-ai-v1';
const OPEN_KEY = 'mycortes-chat-open-v1';

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const ChatbotLauncher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAuthRoute = useMemo(
    () => AUTH_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(r + '/')),
    [location.pathname],
  );

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(OPEN_KEY) === '1';
  });
  const [tab, setTab] = useState<'ai' | 'staff'>('ai');

  // ===== AI chat state (persisted) =====
  const [aiMessages, setAiMessages] = useState<AiMsg[]>(() => {
    if (typeof window === 'undefined') return [WELCOME];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AiMsg[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* noop */ }
    return [WELCOME];
  });
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ===== Staff chat state =====
  const [staffInput, setStaffInput] = useState('');
  const [staffThreadId, setStaffThreadId] = useState<string | null>(null);
  const staffScrollRef = useRef<HTMLDivElement>(null);

  // Persist AI messages + open state
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(aiMessages)); } catch { /* noop */ }
  }, [aiMessages]);
  useEffect(() => {
    try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* noop */ }
  }, [open]);

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
  }, [aiMessages, aiBusy]);
  useEffect(() => {
    if (staffScrollRef.current) staffScrollRef.current.scrollTop = staffScrollRef.current.scrollHeight;
  }, [staffMessages]);

  // Focus textarea on open / after sending
  useEffect(() => {
    if (open && tab === 'ai') {
      requestAnimationFrame(() => aiTextareaRef.current?.focus());
    }
  }, [open, tab, aiBusy]);

  const sendAi = async (overrideText?: string) => {
    const text = (overrideText ?? aiInput).trim();
    if (!text || aiBusy) return;
    const userMsg: AiMsg = { role: 'user', content: text, ts: Date.now() };
    const next = [...aiMessages, userMsg];
    setAiMessages(next);
    setAiInput('');
    setAiBusy(true);
    // Optimistic empty assistant message
    setAiMessages([...next, { role: 'assistant', content: '', ts: Date.now() }]);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON}`,
        },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
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
                copy[copy.length - 1] = { role: 'assistant', content: assistant, ts: copy[copy.length - 1].ts };
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
        copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${message}`, ts: Date.now() };
        return copy;
      });
      toast.error(message);
    } finally {
      setAiBusy(false);
    }
  };

  const clearAi = () => {
    setAiMessages([{ ...WELCOME, ts: Date.now() }]);
    toast.success('Chat cleared');
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

  // Hide entirely on auth-related routes
  if (isAuthRoute) return null;

  // Not signed in — hide widget (only authenticated users can access)
  if (!user) return null;

  const showQuickActions = aiMessages.length <= 1 && !aiBusy;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-24 right-4 lg:bottom-6 z-40 h-14 w-14 rounded-2xl',
            'bg-[hsl(174,55%,22%)] text-primary-foreground shadow-elevated',
            'flex items-center justify-center transition-all duration-300',
            'hover:scale-110 hover:shadow-2xl active:scale-95',
            'animate-scale-in',
          )}
          aria-label="Open chatbot"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 bg-background/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-0 animate-fade-in">
          <div
            className="absolute inset-0 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className={cn(
            'relative w-full sm:w-[420px] h-[85vh] sm:h-[640px] max-h-[720px]',
            'bg-card border border-border rounded-t-3xl sm:rounded-3xl',
            'shadow-elevated flex flex-col overflow-hidden animate-scale-in',
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-[hsl(174,55%,22%)] text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[hsl(174,55%,22%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight">myCortes Helper</h3>
                  <p className="text-[11px] opacity-90 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                    Always here to help
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {tab === 'ai' && aiMessages.length > 1 && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={clearAi}
                    className="text-primary-foreground hover:bg-white/20 h-8 w-8"
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setOpen(false)}
                  className="text-primary-foreground hover:bg-white/20 h-8 w-8"
                  aria-label="Minimize chat"
                >
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'ai' | 'staff')} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2 mx-3 mt-3 mb-0 rounded-xl">
                <TabsTrigger value="ai" className="gap-1.5 rounded-lg"><Bot className="h-4 w-4" /> AI Assistant</TabsTrigger>
                <TabsTrigger value="staff" className="gap-1.5 rounded-lg"><Headphones className="h-4 w-4" /> Admin/Staff</TabsTrigger>
              </TabsList>

              {/* AI tab */}
              <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden m-0 mt-3">
                <div ref={aiScrollRef} className="flex-1 px-3 overflow-y-auto scroll-smooth">
                  <div className="space-y-3 py-2">
                    {aiMessages.map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex flex-col animate-fade-in',
                          m.role === 'user' ? 'items-end' : 'items-start',
                        )}
                      >
                        <div className={cn(
                          'max-w-[85%] px-3.5 py-2.5 text-sm shadow-sm',
                          m.role === 'user'
                            ? 'bg-[hsl(174,55%,22%)] text-primary-foreground rounded-2xl rounded-br-md'
                            : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                        )}>
                          {m.role === 'assistant' ? (
                            m.content ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            )
                          ) : (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {formatTime(m.ts)}
                        </span>
                      </div>
                    ))}

                    {showQuickActions && (
                      <div className="pt-2 pb-1 animate-fade-in">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2 px-1">
                          Quick actions
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                            <button
                              key={label}
                              onClick={() => sendAi(prompt)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2.5 rounded-xl',
                                'bg-muted/60 hover:bg-muted border border-border/50',
                                'text-xs font-medium text-left transition-all',
                                'hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0',
                              )}
                            >
                              <Icon className="h-4 w-4 text-[hsl(174,55%,22%)] shrink-0" />
                              <span className="truncate">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 border-t bg-card">
                  <div className="flex items-end gap-2 bg-muted/50 rounded-2xl p-1.5 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted/80 transition-colors">
                    <Textarea
                      ref={aiTextareaRef}
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
                      className="resize-none min-h-[38px] max-h-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2 py-2 text-sm"
                      disabled={aiBusy}
                    />
                    <Button
                      onClick={() => sendAi()}
                      disabled={!aiInput.trim() || aiBusy}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl bg-[hsl(174,55%,22%)] hover:bg-[hsl(174,55%,18%)] transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
                    >
                      {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Staff tab */}
              <TabsContent value="staff" className="flex-1 flex flex-col overflow-hidden m-0 mt-3">
                <div className="mx-3 mb-2 px-3 py-2 bg-muted/50 rounded-xl border border-border/60 text-xs text-muted-foreground">
                  Messages go to municipal staff. They'll reply when available.
                </div>
                <div ref={staffScrollRef} className="flex-1 px-3 overflow-y-auto scroll-smooth">
                  <div className="space-y-3 py-2">
                    {staffMessages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No messages yet. Start by saying hello 👋
                      </div>
                    ) : staffMessages.map((m) => {
                      const isMine = m.sender_id === user.id;
                      return (
                        <div key={m.id} className={cn('flex flex-col animate-fade-in', isMine ? 'items-end' : 'items-start')}>
                          <div className={cn(
                            'max-w-[85%] px-3.5 py-2.5 text-sm shadow-sm',
                            isMine
                              ? 'bg-[hsl(174,55%,22%)] text-primary-foreground rounded-2xl rounded-br-md'
                              : 'bg-muted rounded-2xl rounded-bl-md',
                          )}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {!isMine && <span className="font-medium text-primary">Staff · </span>}
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-3 border-t bg-card">
                  <div className="flex items-end gap-2 bg-muted/50 rounded-2xl p-1.5 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted/80 transition-colors">
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
                      className="resize-none min-h-[38px] max-h-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2 py-2 text-sm"
                      disabled={!staffThreadId}
                    />
                    <Button
                      onClick={sendStaff}
                      disabled={!staffInput.trim() || !staffThreadId}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl bg-[hsl(174,55%,22%)] hover:bg-[hsl(174,55%,18%)] transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </>
  );
};
