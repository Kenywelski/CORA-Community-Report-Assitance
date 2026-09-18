import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Bot, Send, Loader2, CheckCircle, Sparkles, User as UserIcon } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const WELCOME: Msg = {
  role: 'assistant',
  content:
    "Kumusta! I'm the myCortes complaint assistant. Tell me what problem you want to report — for example \"walang ilaw sa kalsada sa Poblacion\" — and I'll ask only what's needed, then file it for you.",
};

const SUGGESTIONS = [
  'Broken street light in our purok',
  'Malalim na lubak sa kalsada',
  'Uncollected garbage for a week',
  'Baradong kanal, binabaha kami',
];

export const ComplaintAgentChat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || isSending) return;
    if (!user) {
      toast.error('Please sign in to use the assistant, or use the manual form.');
      return;
    }

    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('complaint-agent', {
        body: { messages: next.filter((m) => m !== WELCOME) },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.report_id) setFiledId(data.report_id);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || 'The assistant is unavailable right now.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not respond just now. Please try again or use the manual form.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card variant="elevated" className="animate-slide-up overflow-hidden">
      <div className="flex items-center gap-3 bg-primary px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-primary-foreground font-semibold text-sm">Complaint Assistant</p>
          <p className="text-primary-foreground/70 text-xs">Guided filing • English, Tagalog or Bisaya</p>
        </div>
        <Sparkles className="h-4 w-4 text-primary-foreground/70" />
      </div>

      <CardContent className="p-0">
        <div className="h-[380px] overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex gap-2">
              <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {filedId && (
          <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-success/10 p-3">
            <CheckCircle className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm flex-1">Your report was filed and sent to the municipal office.</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/my-requests')}>Track</Button>
          </div>
        )}

        {messages.length === 1 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs rounded-full border bg-card px-3 py-1.5 hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 border-t p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user ? 'Describe the problem...' : 'Sign in to use the assistant'}
            maxLength={800}
            disabled={isSending || !user}
            className="rounded-full"
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={isSending || !input.trim() || !user}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
