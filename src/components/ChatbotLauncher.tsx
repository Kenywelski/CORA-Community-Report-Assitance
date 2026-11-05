import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  MessageCircle, Send, Bot, Headphones, Loader2, ChevronDown, X,
  Trash2, FileText, AlertTriangle, Phone, Megaphone, Building2, HelpCircle,
  Sparkles,
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
  { icon: Phone, label: 'Emergency Contacts', prompt: 'What are the emergency contact numbers in Barangay Purisima, Tago?' },
  { icon: Building2, label: 'Barangay Offices', prompt: 'List the barangay and municipal offices and what they do.' },
  { icon: FileText, label: 'Request Documents', prompt: 'How do I request a barangay clearance or certificate?' },
  { icon: Megaphone, label: 'Announcements', prompt: 'What are the latest announcements in Barangay Purisima?' },
  { icon: HelpCircle, label: 'FAQs', prompt: 'What are frequently asked questions about CORA?' },
];

const STORAGE_KEY = 'cora-purisima-chat-ai-v3';
const OPEN_KEY = 'cora-purisima-chat-open-v2';
const TEAL = 'hsl(174,55%,22%)';
const TEAL_DARK = 'hsl(174,55%,16%)';

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const ChatbotLauncher = () => {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAuthRoute = useMemo(
    () =>
      AUTH_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(r + '/')) ||
      location.pathname === '/landing' ||
      location.pathname === '/admin' ||
      location.pathname.startsWith('/admin/'),
    [location.pathname],
  );

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(OPEN_KEY) === '1';
  });
  const [tab, setTab] = useState<'ai' | 'staff'>('ai');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

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

  const [staffInput, setStaffInput] = useState('');
  const [staffThreadId, setStaffThreadId] = useState<string | null>(null);
  const staffScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(aiMessages)); } catch { /* noop */ }
  }, [aiMessages]);
  useEffect(() => {
    try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* noop */ }
  }, [open]);

  // Track visualViewport on mobile so virtual keyboard never pushes header off-screen
  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      setViewportHeight(null);
      return;
    }

    const updateViewport = () => {
      const vv = window.visualViewport;
      if (vv && window.innerWidth < 640) {
        setViewportHeight(Math.floor(vv.height));
      } else {
        setViewportHeight(null);
      }
    };

    updateViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateViewport);
    window.addEventListener('resize', updateViewport);

    // Lock background body scroll on mobile when chat is open
    const prevOverflow = document.body.style.overflow;
    if (window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      vv?.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateViewport);
      document.body.style.overflow = prevOverflow;
    };
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

  // Scroll strictly inside the message container (never window/document scrollIntoView)
  useEffect(() => {
    const el = aiScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [aiMessages, aiBusy, open, tab]);

  useEffect(() => {
    const el = staffScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [staffMessages, open, tab]);

  // Only auto-focus input on desktop screens so mobile virtual keyboard doesn't pop up automatically
  useEffect(() => {
    if (open && tab === 'ai' && typeof window !== 'undefined' && window.innerWidth >= 640) {
      requestAnimationFrame(() => aiTextareaRef.current?.focus());
    }
  }, [open, tab]);

  const sendAi = async (overrideText?: string) => {
    const text = (overrideText ?? aiInput).trim();
    if (!text || aiBusy) return;
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      aiTextareaRef.current?.blur();
    }
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in to use the assistant.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON,
          'Authorization': `Bearer ${session.access_token}`,
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
    requestAnimationFrame(() => {
      if (aiScrollRef.current) aiScrollRef.current.scrollTop = 0;
    });
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

  const mobileDynamicStyle = viewportHeight
    ? { height: `${Math.min(520, Math.max(280, viewportHeight - 24))}px`, maxHeight: `${viewportHeight - 16}px` }
    : undefined;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-24 right-4 lg:bottom-6 z-40 h-13 w-13 sm:h-14 sm:w-14 rounded-2xl',
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:justify-end p-2.5 sm:p-4 bg-black/50 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-0 animate-fade-in"
          style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
        >
          <div
            className="absolute inset-0 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            style={mobileDynamicStyle}
            className={cn(
              'relative w-full max-w-[calc(100vw-1.25rem)] sm:w-[400px] sm:max-w-[400px]',
              'h-[min(480px,74dvh)] max-h-[calc(100dvh-4.5rem)] sm:h-[min(600px,84vh)] sm:max-h-[calc(100vh-2rem)]',
              'bg-card border border-border rounded-2xl sm:rounded-3xl',
              'shadow-2xl flex flex-col overflow-hidden animate-scale-in',
            )}
          >
            {/* Sticky Top Header */}
            <div
              className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 text-primary-foreground shrink-0"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur ring-1 ring-white/20">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[hsl(174,55%,18%)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm leading-tight truncate">CORA AI Assistant</h3>
                  <p className="text-[10px] sm:text-[11px] opacity-90 flex items-center gap-1.5 mt-0.5 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                    <span className="truncate">Barangay Purisima · Ready to help</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {tab === 'ai' && !showWelcome && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={clearAi}
                    className="text-primary-foreground hover:bg-white/20 h-8 w-8 rounded-lg"
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setOpen(false)}
                  className="text-primary-foreground hover:bg-white/20 h-8 w-8 rounded-lg"
                  aria-label="Close chat"
                  title="Close chat"
                >
                  <X className="h-4 w-4 sm:hidden" />
                  <ChevronDown className="h-5 w-5 hidden sm:block" />
                </Button>
              </div>
            </div>

            {/* Segmented tabs */}
            <div className="px-3 pt-2 pb-1.5 shrink-0 border-b border-border/50 bg-card">
              <div className="relative grid grid-cols-2 bg-muted rounded-xl p-1 h-9">
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-all duration-300 ease-out"
                  style={{
                    backgroundColor: 'hsl(var(--card))',
                    transform: tab === 'ai' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className={cn(
                    'relative z-10 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors',
                    tab === 'ai' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Bot className="h-3.5 w-3.5" /> AI Assistant
                </button>
                <button
                  type="button"
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
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div
                  ref={aiScrollRef}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-2.5 touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="space-y-3">
                    {showWelcome && (
                      <div className="animate-fade-in">
                        <div
                          className="relative rounded-xl p-3.5 sm:p-4 text-primary-foreground overflow-hidden shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
                        >
                          <div className="relative flex items-start gap-2.5">
                            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs sm:text-sm leading-tight">Welcome to CORA</h4>
                              <p className="text-[11px] sm:text-xs opacity-90 mt-1 leading-relaxed">
                                Ask about barangay services, issue reporting, emergency hotlines, or announcements.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 px-1">
                            Quick actions
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => sendAi(prompt)}
                                className={cn(
                                  'group flex items-center gap-2 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl',
                                  'bg-card border border-border/70',
                                  'text-[11px] sm:text-xs font-medium text-left transition-all',
                                  'hover:border-primary/40 hover:shadow-sm active:scale-[0.99]',
                                )}
                              >
                                <span
                                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                  style={{ backgroundColor: 'hsl(174,55%,22%,0.08)' }}
                                >
                                  <Icon className="h-3.5 w-3.5" style={{ color: TEAL }} />
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
                        <div className="flex items-end gap-1.5 sm:gap-2 max-w-[90%]">
                          {m.role === 'assistant' && (
                            <div
                              className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shrink-0 text-primary-foreground"
                              style={{ backgroundColor: TEAL }}
                            >
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div
                            className={cn(
                              'px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed shadow-xs break-words overflow-hidden',
                              m.role === 'user'
                                ? 'text-primary-foreground rounded-2xl rounded-br-sm'
                                : 'bg-muted text-foreground rounded-2xl rounded-bl-sm',
                            )}
                            style={m.role === 'user' ? { backgroundColor: TEAL } : undefined}
                          >
                            {m.role === 'assistant' ? (
                              m.content ? (
                                <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-xs sm:text-[13.5px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                                  <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              )
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            )}
                          </div>
                        </div>
                        <span className={cn('text-[10px] text-muted-foreground mt-1', m.role === 'user' ? 'pr-1' : 'pl-8')}>
                          {formatTime(m.ts)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 border-t bg-card/95 backdrop-blur shrink-0">
                  <div className="flex items-end gap-1.5 bg-muted/60 rounded-xl px-2.5 py-1 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted transition-colors">
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
                      className="resize-none min-h-[34px] max-h-24 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-1 py-1.5 text-base sm:text-sm"
                      disabled={aiBusy}
                    />
                    <Button
                      type="button"
                      onClick={() => sendAi()}
                      disabled={!aiInput.trim() || aiBusy}
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg transition-transform active:scale-95 text-primary-foreground"
                      style={{ backgroundColor: TEAL }}
                    >
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    AI can make mistakes. Verify important info.
                  </p>
                </div>
              </div>
            )}

            {/* Staff tab */}
            {tab === 'staff' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="mx-3 mt-2 mb-1 px-2.5 py-1.5 bg-muted/50 rounded-lg border border-border/60 text-[11px] text-muted-foreground shrink-0">
                  Messages go to barangay staff. They'll reply when available.
                </div>
                <div
                  ref={staffScrollRef}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-2 touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="space-y-2.5">
                    {staffLoading ? (
                      <div className="space-y-2.5">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                            <div className="h-9 w-36 rounded-2xl bg-muted animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : staffMessages.length === 0 ? (
                      <div className="text-center text-xs sm:text-sm text-muted-foreground py-8">
                        No messages yet. Start by saying hello 👋
                      </div>
                    ) : staffMessages.map((m) => {
                      const isMine = m.sender_id === user.id;
                      return (
                        <div key={m.id} className={cn('flex flex-col animate-fade-in', isMine ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[88%] px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed shadow-xs break-words',
                              isMine
                                ? 'text-primary-foreground rounded-2xl rounded-br-sm'
                                : 'bg-muted rounded-2xl rounded-bl-sm',
                            )}
                            style={isMine ? { backgroundColor: TEAL } : undefined}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
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
                <div className="p-2 sm:p-2.5 border-t bg-card/95 backdrop-blur shrink-0">
                  <div className="flex items-end gap-1.5 bg-muted/60 rounded-xl px-2.5 py-1 border border-border/60 focus-within:border-primary/50 focus-within:bg-muted transition-colors">
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
                      className="resize-none min-h-[34px] max-h-24 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-1 py-1.5 text-base sm:text-sm"
                      disabled={!staffThreadId}
                    />
                    <Button
                      type="button"
                      onClick={sendStaff}
                      disabled={!staffInput.trim() || !staffThreadId}
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg transition-transform active:scale-95 text-primary-foreground"
                      style={{ backgroundColor: TEAL }}
                    >
                      <Send className="h-3.5 w-3.5" />
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

