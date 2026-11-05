import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowRight,
  HelpCircle,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CORA_FAQS,
  FAQ_CATEGORIES,
  FaqAction,
  FaqCategory,
  FaqItem,
  LiveLandingContext,
  answerSystemFaq,
  getFaqsByCategory,
} from '@/lib/coraFaqEngine';

const CORA_LOGO_URL =
  '/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  relatedQuestions?: FaqItem[];
  action?: FaqAction;
}

interface LandingFaqChatbotProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onScrollToSection?: (sectionId: string) => void;
  onNavigate?: (path: string) => void;
  isAuthenticated?: boolean;
  liveContext?: LiveLandingContext;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const LandingFaqChatbot = ({
  open: controlledOpen,
  onOpenChange,
  onScrollToSection,
  onNavigate,
  isAuthenticated = false,
  liveContext,
}: LandingFaqChatbotProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');
  const [showFaqBrowser, setShowFaqBrowser] = useState(true);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const visibleFaqs = getFaqsByCategory(selectedCategory);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
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

    const prevOverflow = document.body.style.overflow;
    if (window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      vv?.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateViewport);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      if (showFaqBrowser && turns.length === 0) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [turns, isOpen, showFaqBrowser, selectedCategory]);

  const handleAskQuestion = (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      inputRef.current?.blur();
    }

    const now = Date.now();
    const userTurn: ChatTurn = {
      id: `user-${now}`,
      role: 'user',
      content: trimmed,
      timestamp: now,
    };

    const reply = answerSystemFaq(trimmed, liveContext);
    const assistantTurn: ChatTurn = {
      id: `assistant-${now + 1}`,
      role: 'assistant',
      content: reply.answer,
      timestamp: now + 1,
      relatedQuestions: reply.relatedQuestions,
      action: reply.action,
    };

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setShowFaqBrowser(false);
    setInput('');
  };

  const handleActionClick = (action: FaqAction) => {
    if (action.type === 'scroll') {
      onScrollToSection?.(action.target);
      if (window.innerWidth < 640) {
        setOpen(false);
      }
      return;
    }

    if (action.type === 'navigate') {
      const destination =
        action.target === '/auth' && isAuthenticated
          ? '/report-issue'
          : action.target;
      onNavigate?.(destination);
    }
  };

  const handleReset = () => {
    setTurns([]);
    setSelectedCategory('all');
    setShowFaqBrowser(true);
    setInput('');
  };

  const mobileDynamicStyle = viewportHeight
    ? { height: `${Math.min(520, Math.max(280, viewportHeight - 24))}px`, maxHeight: `${viewportHeight - 16}px` }
    : undefined;

  return (
    <>
      {/* Floating FAQ Chatbot Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          data-testid="landing-faq-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open CORA System FAQ Chatbot"
          className={cn(
            'fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex items-center gap-2 rounded-2xl',
            'bg-[#177A73] px-3.5 py-2.5 sm:px-4 sm:py-3.5 text-white shadow-lg ring-1 ring-white/20',
            'transition-all duration-200 hover:bg-[#12625D] hover:shadow-xl active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2'
          )}
        >
          <span className="relative flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center">
            <MessageCircleQuestion className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#F36B3F] ring-2 ring-[#177A73]" />
          </span>
          <span className="text-xs font-semibold tracking-tight sm:text-sm">
            Have Questions? FAQs
          </span>
        </button>
      )}

      {/* Interactive FAQ Chatbot Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="CORA System FAQ Assistant"
          data-testid="landing-faq-dialog"
          style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-2.5 backdrop-blur-[2px] sm:inset-auto sm:bottom-5 sm:right-5 sm:bg-transparent sm:p-0 sm:backdrop-blur-0"
        >
          {/* Mobile backdrop tap to close */}
          <div
            className="absolute inset-0 sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            style={mobileDynamicStyle}
            className={cn(
              'relative flex w-full flex-col overflow-hidden bg-white shadow-2xl animate-scale-in',
              'h-[min(480px,74dvh)] max-h-[calc(100dvh-4.5rem)] sm:h-[min(600px,84vh)]',
              'rounded-2xl border border-[#E2E8F0]',
              'max-w-[calc(100vw-1.25rem)] sm:w-[400px] sm:max-w-[400px]'
            )}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between gap-2.5 px-3.5 py-2.5 text-white sm:px-4 sm:py-3"
              style={{
                background: 'linear-gradient(135deg, #142B38 0%, #177A73 100%)',
              }}
            >
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/25">
                  <img
                    src={CORA_LOGO_URL}
                    alt="CORA Logo"
                    className="h-full w-full scale-[1.18] object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold leading-tight text-white sm:text-sm">
                    CORA FAQ Assistant
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] sm:text-[11px] font-medium text-[#EAF6F4]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>System Guide · Barangay Purisima</span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reset & show all FAQs"
                    aria-label="Reset conversation and show all FAQs"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close FAQ assistant"
                  data-testid="landing-faq-close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Bar */}
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 no-scrollbar">
              {FAQ_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id && showFaqBrowser;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setShowFaqBrowser(true);
                    }}
                    className={cn(
                      'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                      active
                        ? 'bg-[#177A73] text-white shadow-xs'
                        : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:border-[#177A73]/40 hover:text-[#142B38]'
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Body */}
            <div
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 sm:px-4 py-3.5 space-y-3.5 bg-white touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Welcome Banner */}
              <div className="rounded-xl border border-[#177A73]/20 bg-[#EAF6F4]/70 p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#177A73] text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#142B38]">
                      Have questions about CORA?
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">
                      Select any frequently asked question below or type your question in English, Tagalog, or Bisaya.
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversation History */}
              {turns.length > 0 && (
                <div className="space-y-3.5">
                  {turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={cn(
                        'flex flex-col',
                        turn.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed',
                          turn.role === 'user'
                            ? 'rounded-br-sm bg-[#177A73] text-white font-medium'
                            : 'rounded-bl-sm border border-[#E2E8F0] bg-[#F8FAFC] text-[#142B38]'
                        )}
                      >
                        {turn.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none text-[#142B38] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:text-[#142B38]">
                            <ReactMarkdown>{turn.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{turn.content}</p>
                        )}

                        {/* Contextual Action Button inside Assistant Reply */}
                        {turn.role === 'assistant' && turn.action && (
                          <div className="mt-3 pt-2.5 border-t border-[#E2E8F0]">
                            <button
                              type="button"
                              onClick={() => handleActionClick(turn.action!)}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F36B3F] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#dc5a30]"
                            >
                              <span>{turn.action.label}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <span className="mt-1 px-1 text-[10px] text-[#64748B]">
                        {formatTime(turn.timestamp)}
                      </span>

                      {/* Related Follow-up Questions */}
                      {turn.role === 'assistant' &&
                        turn.relatedQuestions &&
                        turn.relatedQuestions.length > 0 && (
                          <div className="mt-2 w-full space-y-1.5">
                            <p className="px-1 text-[11px] font-semibold text-[#64748B]">
                              Related questions:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {turn.relatedQuestions.map((rel) => (
                                <button
                                  key={rel.id}
                                  type="button"
                                  onClick={() => handleAskQuestion(rel.question)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#177A73]/30 bg-[#EAF6F4]/60 px-2.5 py-1.5 text-left text-xs font-medium text-[#142B38] transition-colors hover:border-[#177A73] hover:bg-[#EAF6F4]"
                                >
                                  <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[#177A73]" />
                                  <span>{rel.shortLabel}</span>
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setShowFaqBrowser(true)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#177A73] transition-colors hover:bg-[#F8FAFC]"
                              >
                                <span>Browse all FAQs ({CORA_FAQS.length})</span>
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}

              {/* Categorized FAQ List Browser */}
              {showFaqBrowser && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      {selectedCategory === 'all'
                        ? 'Frequently Asked Questions'
                        : FAQ_CATEGORIES.find((c) => c.id === selectedCategory)
                            ?.label}
                    </p>
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {visibleFaqs.length} topics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {visibleFaqs.map((faq) => (
                      <button
                        key={faq.id}
                        type="button"
                        onClick={() => handleAskQuestion(faq.question)}
                        className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left transition-colors hover:border-[#177A73]/50 hover:bg-[#EAF6F4]/50"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF6F4] text-[#177A73] group-hover:bg-[#177A73] group-hover:text-white transition-colors">
                            <HelpCircle className="h-4 w-4" />
                          </span>
                          <span className="text-xs font-semibold text-[#142B38] group-hover:text-[#177A73]">
                            {faq.question}
                          </span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#64748B] transition-transform group-hover:translate-x-0.5 group-hover:text-[#177A73]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion(input);
              }}
              className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] p-2 sm:p-2.5"
            >
              <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 focus-within:border-[#177A73] focus-within:ring-1 focus-within:ring-[#177A73]">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about CORA..."
                  aria-label="Ask a question about CORA"
                  data-testid="landing-faq-input"
                  className="min-w-0 flex-1 bg-transparent py-1 text-base text-[#142B38] placeholder:text-[#64748B] focus:outline-none sm:text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  aria-label="Send question"
                  data-testid="landing-faq-send"
                  className="h-8 w-8 shrink-0 rounded-lg bg-[#177A73] text-white hover:bg-[#12625D] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
