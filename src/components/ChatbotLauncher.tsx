import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  MessageCircle, Send, Bot, Headphones, Loader2, ChevronDown,
  Trash2, FileText, AlertTriangle, Phone, Megaphone, Building2, HelpCircle,
  Mic, ImagePlus, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  content: '__WELCOME_CARD__',
};

const QUICK_ACTIONS = [
  { icon: AlertTriangle, label: 'Report an Issue', prompt: 'How do I report a community issue?' },
  { icon: Phone, label: 'Emergency Contacts', prompt: 'What are the emergency contact numbers in Cortes?' },
  { icon: Building2, label: 'Municipal Offices', prompt: 'List the municipal offices and what they do.' },
  { icon: FileText, label: 'Request Documents', prompt: 'How do I request a municipal document or service?' },
  { icon: Megaphone, label: 'Announcements', prompt: 'What are the latest announcements from the municipality?' },
  { icon: HelpCircle, label: 'FAQs', prompt: 'What are frequently asked questions about myCortes?' },
];

const STORAGE_KEY = 'mycortes-chat-ai-v2';
const OPEN_KEY = 'mycortes-chat-open-v1';
const TEAL = 'hsl(174,55%,22%)';
const TEAL_DARK = 'hsl(174,55%,16%)';

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const ChatbotLauncher = () => {
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
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [staffInput, setStaffInput] = useState('');
  const [staffThreadId, setStaffThreadId] = useState<string | null>(null);
  const staffScrollRef = useRef<HTMLDivElement>(null);
  const staffEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(aiMessages)); } catch { /* noop */ }
  }, [aiMessages]);
  useEffect(() => {
    try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* noop */ }
  }, [open]);

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

  const { data: staffMessages = [], isLoading: staffLoading } = useQuery({
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

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [aiMessages, aiBusy]);
  useEffect(() => {
    staffEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [staffMessages]);

  useEffect(() => {
    if (open && tab === 'ai') {
      requestAnimationFrame(() => aiTextareaRef.current?.focus());
    }
  }, [open, tab, aiBusy]);

  const sendAi = async (overrideText?: string) => {
    const text = (overrideText ?? aiInput).trim();
    if (!text || aiBusy) return;
    const userMsg: AiMsg = { role: 'user', content: text, ts: Date.now() };
    const base = aiMessages.filter((m) => m.content !== '__WELCOME_CARD__');
    const next = [...base, userMsg];
    setAiMessages(next);
    setAiInput('');
    setAiBusy(true);
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
          } catch { /* ignore */ }
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

  if (isAuthRoute) return null;
  if (!user) return null;

  const showWelcome = aiMessages.length === 1 && aiMessages[0].content === '__WELCOME_CARD__';

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-24 right-4 lg:bottom-6 z-40 h-14 w-14 rounded-2xl',
            'text-primary-foreground shadow-elevated',
            'flex items-center justify-center transition-all duration-300',
            'hover:scale-110 hover:shadow-2xl active:scale-95',
            'animate-scale-in',
          )}
          style={{ backgroundColor: TEAL }}
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
            'relative w-full sm:w-[420px]',
            'h-[100dvh] sm:h-[min(680px,90vh)]',
            'bg-card border border-border sm:rounded-3xl rounded-t-3xl',
            'shadow-elevated flex flex-col overflow-hidden animate-scale-in',
          )}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-primary-foreground shrink-0"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur ring-1 ring-white/20">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[hsl(174,55%,18%)] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight">myCortes AI Assistant</h3>
                  <p className="text-[11px] opacity-90 flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                    Always ready to help
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {tab === 'ai' && !showWelcome && (
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

            {/* Segmented tabs */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative grid grid-cols-2 bg-muted rounded-xl p-1 h-10">
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-all duration-300 ease-out"
                  style={{
                    backgroundColor: 'hsl(var(--card))',
                    transform: tab === 'ai' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))',
                  }}
                />
                <button
                  onClick={() => setTab('ai')}
                  className={cn(
                    'relative z-10 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors',
                    tab === 'ai' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Bot className="h-3.5 w-3.5" /> AI Assistant
                </button>
                <button
                  onClick={() => setTab('staff')}
                  className={cn(
                    'relative z-10 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors',
                    tab === 'staff' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Headphones className="h-3.5 w-3.5" /> Admin/Staff
                </button>
              </div>
            </div>

            {/* AI tab */}
            {tab === 'ai' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div ref={aiScrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-4 py-2">
                  <div className="space-y-4">
                    {showWelcome && (
                      <div className="animate-fade-in">
                        <div
                          className="relative rounded-2xl p-5 text-primary-foreground overflow-hidden shadow-md"
                          style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
                        >
                          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                          <div className="relative flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-base leading-tight">Welcome to myCortes</h4>
                              <p className="text-[13px] opacity-90 mt-1 leading-relaxed">
                                I can help you with municipal services, emergency info, announcements, and how to navigate the app.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 px-1">
                            Quick actions
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                              <button
                                key={label}
                                onClick={() => sendAi(prompt)}
                                className={cn(
                                  'group flex items-center gap-2 px-3 py-3 rounded-xl',
                                  'bg-card border border-border/70',
                                  'text-xs font-medium text-left transition-all',
                                  'hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
                                )}
                              >
                                <span
                                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                  style={{ backgroundColor: 'hsl(174,55%,22%,0.08)' }}
                                >
                                  <Icon className="h-4 w-4" style={{ color: TEAL }} />
                                </span>
                                <span className="truncate leading-tight">{label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {!showWelcome && aiMessages.map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex flex-col animate-fade-in',
                          m.role === 'user' ? 'items-end' : 'items-start',
                        )}
                      >
                        <div className="flex items-end gap-2 max-w-[88%]">
                          {m.role === 'assistant' && (
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-primary-foreground"
                              style={{ backgroundColor: TEAL }}
                            >
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div
                            className={cn(
                              'px-4 py-2.5 text-[14px] leading-relaxed shadow-sm',
                              m.role === 'user'
                                ? 'text-primary-foreground rounded-2xl rounded-br-md'
                                : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                            )}
                            style={m.role === 'user' ? { backgroundColor: TEAL } : undefined}
                          >
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
                        </div>
                        <span className={cn('text-[10px] text-muted-foreground mt-1', m.role === 'user' ? 'pr-1' : 'pl-9')}>
                          {formatTime(m.ts)}
                        </span>
                      </div>
                    ))}
                    <div ref={aiEndRef} />
                  </div>
                </div>

                <div className="p-3 border-t bg-card/80 backdrop-blur shrink-0">
                  <div className="flex items-end gap-2 bg-muted/60 rounded-2xl px-2 py-1.5 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted transition-colors">
                    <button
                      type="button"
                      className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                      aria-label="Attach image"
                      title="Attach image (coming soon)"
                      onClick={() => toast.info('Image uploads coming soon')}
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
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
                      placeholder="Ask me anything…"
                      rows={1}
                      className="resize-none min-h-[38px] max-h-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-1 py-2 text-sm"
                      disabled={aiBusy}
                    />
                    <button
                      type="button"
                      className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                      aria-label="Voice input"
                      title="Voice input (coming soon)"
                      onClick={() => toast.info('Voice input coming soon')}
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <Button
                      onClick={() => sendAi()}
                      disabled={!aiInput.trim() || aiBusy}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100 text-primary-foreground"
                      style={{ backgroundColor: TEAL }}
                    >
                      {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    AI can make mistakes. Verify important info.
                  </p>
                </div>
              </div>
            )}

            {/* Staff tab */}
            {tab === 'staff' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mx-3 mb-2 px-3 py-2 bg-muted/50 rounded-xl border border-border/60 text-xs text-muted-foreground shrink-0">
                  Messages go to municipal staff. They'll reply when available.
                </div>
                <div ref={staffScrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-4 py-2">
                  <div className="space-y-3">
                    {staffLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                            <div className="h-10 w-40 rounded-2xl bg-muted animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : staffMessages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-10">
                        No messages yet. Start by saying hello 👋
                      </div>
                    ) : staffMessages.map((m) => {
                      const isMine = m.sender_id === user.id;
                      return (
                        <div key={m.id} className={cn('flex flex-col animate-fade-in', isMine ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[85%] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm',
                              isMine
                                ? 'text-primary-foreground rounded-2xl rounded-br-md'
                                : 'bg-muted rounded-2xl rounded-bl-md',
                            )}
                            style={isMine ? { backgroundColor: TEAL } : undefined}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {!isMine && <span className="font-medium text-primary">Staff · </span>}
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={staffEndRef} />
                  </div>
                </div>
                <div className="p-3 border-t bg-card/80 backdrop-blur shrink-0">
                  <div className="flex items-end gap-2 bg-muted/60 rounded-2xl px-2 py-1.5 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted transition-colors">
                    <Textarea
                      value={staffInput}
                      onChange={(e) => setStaffInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendStaff();
                        }
                      }}
                      placeholder="Type your message to staff…"
                      rows={1}
                      className="resize-none min-h-[38px] max-h-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2 py-2 text-sm"
                      disabled={!staffThreadId}
                    />
                    <Button
                      onClick={sendStaff}
                      disabled={!staffInput.trim() || !staffThreadId}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100 text-primary-foreground"
                      style={{ backgroundColor: TEAL }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
