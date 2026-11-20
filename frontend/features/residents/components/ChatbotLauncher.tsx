import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  MessageCircle, Send, Bot, Headphones, Loader2, X,
  Trash2, FileText, Phone, HelpCircle, Plus, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppPreferences, type AppLanguage } from '@/lib/preferences';
import { formatResidentRelativeTime } from '@/lib/residentTranslations';

interface AiMsg { role: 'user' | 'assistant'; content: string; ts: number }
interface StaffMsg { id: string; role: string; content: string; sender_id: string | null; created_at: string }

const AUTH_ROUTES = ['/auth', '/login', '/register', '/signup', '/forgot-password', '/reset-password', '/otp', '/verify'];

const WELCOME: AiMsg = {
  role: 'assistant',
  ts: Date.now(),
  content: '__WELCOME_CARD__',
};

const QUICK_ACTIONS = [
  { icon: Plus, label: 'How to report a concern?', prompt: 'How do I report a community concern in CORA?' },
  { icon: Phone, label: 'Emergency guide', prompt: 'Show me the emergency guide and contact numbers for Barangay Purisima.' },
  { icon: ClipboardList, label: 'How do I check My Reports?', prompt: 'How do I check and track My Reports in CORA?' },
  { icon: FileText, label: 'What are the report categories?', prompt: 'What community concern categories can I report in CORA?' },
];

const STORAGE_KEY = 'cora-purisima-chat-ai-v3';
const OPEN_KEY = 'cora-purisima-chat-open-v2';
const STAFF_READ_KEY_PREFIX = 'cora-purisima-staff-chat-read-';
const getAiStorageKey = (language: AppLanguage) => `${STORAGE_KEY}-${language}`;

const loadAiMessages = (language: AppLanguage): AiMsg[] => {
  if (typeof window === 'undefined') return [WELCOME];
  try {
    const raw = window.localStorage.getItem(getAiStorageKey(language))
      || (language === 'en' ? window.localStorage.getItem(STORAGE_KEY) : null);
    if (raw) {
      const parsed = JSON.parse(raw) as AiMsg[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    return [WELCOME];
  }
  return [WELCOME];
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const ChatbotLauncher = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { language, translate } = useAppPreferences();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const isChatHiddenRoute = useMemo(
    () =>
      AUTH_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(r + '/')) ||
      location.pathname === '/landing' ||
      location.pathname === '/guest' ||
      location.pathname === '/report-issue' ||
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

  const [aiMessages, setAiMessages] = useState<AiMsg[]>(() => loadAiMessages(language));
  const aiLanguageRef = useRef(language);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [staffInput, setStaffInput] = useState('');
  const [staffThreadId, setStaffThreadId] = useState<string | null>(null);
  const [staffThreadReady, setStaffThreadReady] = useState(false);
  const [staffLastReadAt, setStaffLastReadAt] = useState<string | null>(null);
  const staffScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiLanguageRef.current !== language) return;
    try { window.localStorage.setItem(getAiStorageKey(language), JSON.stringify(aiMessages)); } catch { /* noop */ }
  }, [aiMessages, language]);
  useEffect(() => {
    if (aiLanguageRef.current === language) return;
    aiLanguageRef.current = language;
    setAiMessages(loadAiMessages(language));
  }, [language]);
  useEffect(() => {
    try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* noop */ }
  }, [open]);

  // Track visualViewport on mobile so virtual keyboard never pushes header off-screen
  useEffect(() => {
    if (!open || isChatHiddenRoute || typeof window === 'undefined') {
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
  }, [open, isChatHiddenRoute]);

  useEffect(() => {
    if (!userId || isChatHiddenRoute) {
      setStaffThreadId(null);
      setStaffThreadReady(false);
      return;
    }

    let active = true;
    setStaffThreadId(null);
    setStaffThreadReady(false);

    const loadThread = async () => {
      const { data: existing, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', userId)
        .eq('mode', 'staff')
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        toast.error(translate('Failed to load staff chat'));
        return;
      }

      setStaffThreadId(existing?.id || null);
      setStaffThreadReady(true);
    };

    void loadThread();
    return () => {
      active = false;
    };
  }, [userId, isChatHiddenRoute, translate]);

  useEffect(() => {
    if (!userId || isChatHiddenRoute || !staffThreadReady || tab !== 'staff' || staffThreadId) {
      return;
    }

    let active = true;
    const createThread = async () => {
      const { data: created, error } = await supabase
        .from('chat_threads')
        .insert({ user_id: userId, mode: 'staff', title: 'Conversation with municipal staff' })
        .select('id')
        .single();

      if (!active) return;
      if (error) {
        toast.error(translate('Failed to start staff chat'));
        return;
      }
      setStaffThreadId(created.id);
    };

    void createThread();
    return () => {
      active = false;
    };
  }, [userId, isChatHiddenRoute, staffThreadReady, tab, staffThreadId, translate]);

  useEffect(() => {
    if (!userId || isChatHiddenRoute) {
      setStaffLastReadAt(null);
      return;
    }

    const key = `${STAFF_READ_KEY_PREFIX}${userId}`;
    let lastReadAt: string | null = null;
    try {
      lastReadAt = window.localStorage.getItem(key);
      if (!lastReadAt) {
        lastReadAt = new Date().toISOString();
        window.localStorage.setItem(key, lastReadAt);
      }
    } catch {
      toast.error(translate('Unable to save staff chat read status'));
      lastReadAt = new Date().toISOString();
    }
    setStaffLastReadAt(lastReadAt);
  }, [userId, isChatHiddenRoute, translate]);

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
    if (!open || tab !== 'staff' || !userId || !staffLastReadAt) return;
    const latestAdminMessage = [...staffMessages]
      .reverse()
      .find((message) => message.role === 'admin');
    if (!latestAdminMessage || latestAdminMessage.created_at <= staffLastReadAt) return;

    const readAt = new Date().toISOString();
    setStaffLastReadAt(readAt);
    try {
      window.localStorage.setItem(`${STAFF_READ_KEY_PREFIX}${userId}`, readAt);
    } catch {
      toast.error(translate('Unable to save staff chat read status'));
    }
  }, [open, tab, userId, staffLastReadAt, staffMessages, translate]);

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
      const backendUrl = import.meta.env.VITE_CORA_API_URL?.trim();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in to use the assistant.');
      const res = await fetch(
        backendUrl
          ? `${backendUrl.replace(/\/+$/, '')}/api/chat`
          : `${SUPABASE_URL}/functions/v1/chat-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(backendUrl ? {} : { apikey: ANON }),
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mode: 'resident',
            language,
            messages: next
              .slice(-6)
              .map(({ role, content }) => ({ role, content })),
          }),
        },
      );

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
            const interactionDelta =
              json.event_type === 'step.delta' &&
              json.delta?.type === 'text'
                ? json.delta.text
                : '';
            const parts = json.candidates?.[0]?.content?.parts;
            const delta = interactionDelta ||
              (Array.isArray(parts)
              ? parts.map((part) => part?.text ?? '').join('')
              : '');
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
      const message = translate((e as Error).message || 'Failed to reach the assistant');
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
    toast.success(translate('Chat cleared'));
  };

  const sendStaff = async () => {
    const text = staffInput.trim();
    if (!text || !user || !staffThreadId) return;
    setStaffInput('');
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: staffThreadId, role: 'user', content: text, sender_id: user.id,
    });
    if (error) {
      toast.error(translate('Failed to send'));
      setStaffInput(text);
      return;
    }
    await supabase.from('chat_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', staffThreadId);
  };

  if (isChatHiddenRoute) return null;
  if (!user) return null;

  const showWelcome = aiMessages.length === 1 && aiMessages[0].content === '__WELCOME_CARD__';
  const unreadStaffCount = staffLastReadAt
    ? staffMessages.filter(
        (message) =>
          message.role === 'admin' &&
          new Date(message.created_at).getTime() > new Date(staffLastReadAt).getTime(),
      ).length
    : 0;

  const mobileDynamicStyle = viewportHeight
    ? { height: `${Math.min(520, Math.max(280, viewportHeight - 24))}px`, maxHeight: `${viewportHeight - 16}px` }
    : undefined;

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            if (unreadStaffCount > 0) setTab('staff');
            setOpen(true);
          }}
          className={cn(
            'fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-40 h-12 w-12 sm:bottom-24 sm:right-4 sm:h-14 sm:w-14 lg:bottom-6',
            'rounded-full border-2 border-background bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(15,23,42,0.22)]',
            'flex items-center justify-center transition-all duration-300',
            'hover:scale-105 hover:shadow-2xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'animate-scale-in',
          )}
          aria-label={unreadStaffCount > 0
            ? translate(
                unreadStaffCount === 1
                  ? 'Open staff chat, {count} unread message'
                  : 'Open staff chat, {count} unread messages',
                { count: unreadStaffCount },
              )
            : translate('Open chatbot')}
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
          {unreadStaffCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
              {unreadStaffCount > 9 ? '9+' : unreadStaffCount}
            </span>
          ) : (
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background sm:h-3 sm:w-3" />
          )}
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
            <header className="flex shrink-0 items-center justify-between bg-primary px-3.5 py-3 text-primary-foreground sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-sm">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold leading-tight">{translate('CORA AI Assistant')}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-primary-foreground/85">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="truncate">{translate('Online | Gemini chatbot')}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {tab === 'ai' && !showWelcome && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={clearAi}
                    className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                    aria-label={translate('Clear chat')}
                    title={translate('Clear chat')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  aria-label={translate('Close chat')}
                  title={translate('Close chat')}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="shrink-0 bg-card px-2 py-2">
              <div className="grid h-11 grid-cols-2 rounded-full bg-muted/70 p-1">
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-full text-xs font-medium transition-all',
                    tab === 'ai' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>{translate('AI Assistant')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('staff')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-full text-xs font-medium transition-all',
                    tab === 'staff' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  <span>{translate('Admin/Staff')}</span>
                </button>
              </div>
            </div>

            {tab === 'ai' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/60">
                <div
                  ref={aiScrollRef}
                  className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="space-y-3">
                    {showWelcome && (
                      <div className="animate-fade-in">
                        <section>
                          <p className="mb-2 text-xs font-semibold text-primary">
                            {translate('Quick chats')}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => sendAi(translate(prompt))}
                                className={cn(
                                  'group flex min-h-12 items-center gap-2 rounded-2xl bg-primary/10 px-2.5 py-2 text-left',
                                  'text-[11px] font-medium leading-snug text-foreground transition-colors sm:text-xs',
                                  'hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                )}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-xs">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span>{translate(label)}</span>
                              </button>
                            ))}
                          </div>
                        </section>

                        <div className="mt-5 flex items-end gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                            <h4 className="text-sm font-semibold text-foreground">{translate('Welcome to CORA')}</h4>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                              {translate('Ask me about reporting concerns, tracking updates, report categories, location requirements, privacy, and emergency guidance.')}
                            </p>
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
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div
                            className={cn(
                              'px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed shadow-xs break-words overflow-hidden',
                              m.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                                : 'bg-muted text-foreground rounded-2xl rounded-bl-sm',
                            )}
                          >
                            {m.role === 'assistant' ? (
                              m.content ? (
                                <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-xs sm:text-[13.5px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                                  <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 py-1" aria-label={translate('Assistant is typing')}>
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

                <div className="shrink-0 border-t border-border/60 bg-card px-2.5 pb-2 pt-2">
                  <div className="flex items-end gap-1.5 rounded-[22px] bg-muted/70 p-1.5 pl-3 focus-within:ring-1 focus-within:ring-primary/40">
                    <Textarea
                      ref={aiTextareaRef}
                      autoResize
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      maxLength={4000}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendAi();
                        }
                      }}
                      placeholder={translate('Ask about CORA reports...')}
                      rows={1}
                      className="min-h-9 resize-none overflow-y-hidden border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                      disabled={aiBusy}
                    />
                    <Button
                      type="button"
                      onClick={() => sendAi()}
                      disabled={!aiInput.trim() || aiBusy}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
                      aria-label={translate('Send message')}
                    >
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="mt-1.5 flex items-start justify-center gap-1 text-center text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                    <HelpCircle className="mt-px h-3 w-3 shrink-0" />
                    <span>
                      {translate('Chat messages are processed by Gemini. Do not enter sensitive information. For emergencies, call 911.')}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {tab === 'staff' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/60">
                <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Headphones className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{translate('Barangay Admin/Staff')}</p>
                    <p className="text-xs text-muted-foreground">{translate('Send a message to authorized personnel')}</p>
                  </div>
                </div>
                <div
                  ref={staffScrollRef}
                  className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className={cn('space-y-2.5', !staffLoading && staffMessages.length === 0 && 'flex h-full items-center justify-center')}>
                    {staffLoading ? (
                      <div className="space-y-2.5">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                            <div className="h-9 w-36 rounded-2xl bg-muted animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : staffMessages.length === 0 ? (
                      <div className="max-w-xs text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Headphones className="h-5 w-5" />
                        </div>
                        <h4 className="mt-3 text-sm font-semibold text-foreground">{translate('Start a conversation')}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {translate('Ask barangay staff about CORA reports or account assistance. For emergencies, call 911.')}
                        </p>
                      </div>
                    ) : staffMessages.map((m) => {
                      const isMine = m.sender_id === user.id;
                      return (
                        <div key={m.id} className={cn('flex flex-col animate-fade-in', isMine ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[88%] px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed shadow-xs break-words',
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                                : 'bg-muted rounded-2xl rounded-bl-sm',
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {!isMine && <span className="font-medium text-primary">{translate('Staff · ')}</span>}
                            {formatResidentRelativeTime(new Date(m.created_at), language)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="shrink-0 border-t border-border/60 bg-card px-2.5 pb-2 pt-2">
                  <div className="flex items-end gap-1.5 rounded-[22px] bg-muted/70 p-1.5 pl-3 focus-within:ring-1 focus-within:ring-primary/40">
                    <Textarea
                      autoResize
                      value={staffInput}
                      onChange={(e) => setStaffInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendStaff();
                        }
                      }}
                      placeholder={translate('Message barangay staff...')}
                      rows={1}
                      className="min-h-9 resize-none overflow-y-hidden border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                      disabled={!staffThreadId}
                    />
                    <Button
                      type="button"
                      onClick={sendStaff}
                      disabled={!staffInput.trim() || !staffThreadId}
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
                      aria-label={translate('Send message to staff')}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-center text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                    {translate('Messages are visible to authorized barangay administrators.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
