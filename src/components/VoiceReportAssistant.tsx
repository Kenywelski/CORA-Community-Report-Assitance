import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Square, RotateCcw, Sparkles, Loader2, AlertCircle, HelpCircle, Check } from 'lucide-react';

export type VoiceOrganized = {
  category: string;
  title: string;
  description: string;
  location_details: string | null;
  incident_time: string | null;
  missing: ('report_type' | 'incident_details' | 'location')[];
  follow_up_questions: string[];
  relevance: 'community_concern' | 'unclear' | 'not_a_community_concern';
  concerns: string[];
};

const LANGS = [
  { value: 'fil-PH', label: 'Filipino / Tagalog' },
  { value: 'en-PH', label: 'English' },
  { value: 'ceb-PH', label: 'Bisaya / Cebuano' },
];

type Props = {
  barangay: string;
  locationDetails: string;
  hasPhoto: boolean;
  onApply: (r: VoiceOrganized) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSpeechRecognition = (): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const MAX_RECORD_MS = 120_000;

export const VoiceReportAssistant = ({ barangay, locationDetails, hasPhoto, onApply }: Props) => {
  const [lang, setLang] = useState('fil-PH');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [state, setState] = useState<'idle' | 'listening' | 'transcribing' | 'organizing'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<VoiceOrganized | null>(null);
  const [applied, setApplied] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const baseRef = useRef('');

  const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const cleanup = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => { recognitionRef.current?.abort?.(); recorderRef.current?.stop(); cleanup(); }, []);

  const appendText = (t: string) => {
    const clean = t.trim();
    if (!clean) return;
    setTranscript((prev) => (prev ? `${prev.trim()} ${clean}` : clean));
    setResult(null); setApplied(false);
  };

  const permissionMessage = (e: unknown) => {
    const name = (e as { name?: string; error?: string })?.name || (e as { error?: string })?.error;
    if (name === 'NotAllowedError' || name === 'not-allowed' || name === 'service-not-allowed')
      return 'Microphone access was blocked. Allow the microphone in your browser settings, then tap Retry — or type your report below.';
    if (name === 'NotFoundError' || name === 'audio-capture') return 'No microphone was found on this device. Please type your report below.';
    if (name === 'network') return 'Speech recognition needs an internet connection. Please check your connection or type instead.';
    if (name === 'no-speech') return "We didn't hear anything. Tap Speak and talk a little closer to the microphone.";
    return 'Voice input stopped unexpectedly. Tap Retry or type your report below.';
  };

  // Server-side transcription (fallback when the browser lacks live recognition). Audio is not stored.
  const startRecorder = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    streamRef.current = stream;
    const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cleanup();
      const type = (rec.mimeType || 'audio/webm').split(';')[0].replace('video/', 'audio/');
      const blob = new Blob(chunks, { type });
      if (!blob.size) { setState('idle'); setError("We didn't capture any audio. Please try again."); return; }
      setState('transcribing');
      try {
        const fd = new FormData();
        fd.append('audio', new File([blob], `speech.${type.split('/')[1] || 'webm'}`, { type }));
        fd.append('language', lang);
        const { data, error: fnErr } = await supabase.functions.invoke('voice-report', { body: fd });
        if (fnErr) {
          const ctx = await (fnErr as { context?: Response }).context?.json?.().catch(() => null);
          throw new Error(ctx?.error || 'Transcription failed. Please try again or type your report.');
        }
        appendText(data?.transcript ?? '');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setState('idle');
      }
    };
    recorderRef.current = rec;
    rec.start();
    setState('listening');
    timerRef.current = window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), MAX_RECORD_MS);
  };

  const start = async () => {
    setError('');
    const SR = getSpeechRecognition();
    // Browsers rarely support live Bisaya recognition, so Bisaya uses server transcription.
    if (SR && lang !== 'ceb-PH') {
      try {
        const r = new SR();
        r.lang = lang;
        r.continuous = true;
        r.interimResults = true;
        baseRef.current = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.onresult = (ev: any) => {
          let live = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            if (res.isFinal) appendText(res[0].transcript);
            else live += res[0].transcript;
          }
          setInterim(live);
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.onerror = (ev: any) => {
          if (ev.error === 'aborted') return;
          setError(permissionMessage(ev));
        };
        r.onend = () => { setInterim(''); setState((s) => (s === 'listening' ? 'idle' : s)); };
        recognitionRef.current = r;
        r.start();
        setState('listening');
        return;
      } catch {
        /* fall through to recorder */
      }
    }
    if (!micSupported || typeof MediaRecorder === 'undefined') {
      setError('Voice input is not supported in this browser. Please type your report below.');
      return;
    }
    try { await startRecorder(); } catch (e) { cleanup(); setState('idle'); setError(permissionMessage(e)); }
  };

  const stop = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; setState('idle'); }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    recorderRef.current = null;
  };

  const organize = async () => {
    if (transcript.trim().length < 3) { setError('Please speak or type your statement first.'); return; }
    setError(''); setState('organizing');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('voice-report', {
        body: { action: 'organize', transcript: transcript.trim(), barangay, location_details: locationDetails, has_photo: hasPhoto, language: lang },
      });
      if (fnErr) {
        const ctx = await (fnErr as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(ctx?.error || 'The assistant could not organize your statement. You can still fill in the form yourself.');
      }
      setResult(data.result as VoiceOrganized);
      setApplied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState('idle');
    }
  };

  const listening = state === 'listening';
  const busy = state === 'transcribing' || state === 'organizing';

  return (
    <section aria-labelledby="voice-title" className="rounded-xl border bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary flex items-center justify-center">
          <Mic className="h-5 w-5 text-primary-foreground" aria-hidden />
        </div>
        <div className="flex-1">
          <h2 id="voice-title" className="text-base font-semibold">Speak your report</h2>
          <p className="text-sm text-muted-foreground">Talk instead of typing. You can edit everything before sending. Your voice recording is not saved.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={lang} onValueChange={setLang} disabled={listening || busy}>
          <SelectTrigger className="w-[190px]" aria-label="Speaking language"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
        {!listening ? (
          <Button type="button" size="lg" onClick={start} disabled={busy} className="min-h-12 flex-1 sm:flex-none">
            <Mic className="h-5 w-5 mr-2" /> {transcript ? 'Speak more' : 'Speak'}
          </Button>
        ) : (
          <Button type="button" size="lg" variant="destructive" onClick={stop} className="min-h-12 flex-1 sm:flex-none">
            <Square className="h-5 w-5 mr-2" /> Stop
          </Button>
        )}
        {error && !listening && (
          <Button type="button" variant="outline" size="lg" className="min-h-12" onClick={start} disabled={busy}>
            <RotateCcw className="h-4 w-4 mr-2" /> Retry
          </Button>
        )}
      </div>

      <div aria-live="polite" className="text-sm">
        {listening && (
          <p className="flex items-center gap-2 font-medium text-destructive">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" aria-hidden /> Listening… tap Stop when finished.
          </p>
        )}
        {state === 'transcribing' && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Turning your speech into text…</p>}
        {state === 'organizing' && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Organizing your statement…</p>}
        {error && <p role="alert" className="flex items-start gap-2 text-destructive"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="voice-transcript" className="text-sm font-medium">Your statement (you can edit or type here)</label>
        <Textarea
          id="voice-transcript"
          value={transcript + (interim ? ` ${interim}` : '')}
          onChange={(e) => { setTranscript(e.target.value); setInterim(''); setResult(null); setApplied(false); }}
          rows={4}
          maxLength={4000}
          readOnly={listening}
          className="text-base"
          placeholder="Your words will appear here…"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={organize} disabled={busy || listening || transcript.trim().length < 3}>
            <Sparkles className="h-4 w-4 mr-2" /> Organize with AI
          </Button>
          {transcript && (
            <Button type="button" variant="ghost" onClick={() => { setTranscript(''); setResult(null); setApplied(false); setError(''); }} disabled={busy || listening}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border bg-card p-3 space-y-2 text-sm">
          <p className="font-semibold">Suggested report — please check it matches what you meant</p>
          <p><span className="text-muted-foreground">Title:</span> {result.title}</p>
          <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Description:</span> {result.description}</p>
          {result.location_details && <p><span className="text-muted-foreground">Place mentioned:</span> {result.location_details}</p>}
          {result.incident_time && <p><span className="text-muted-foreground">When:</span> {result.incident_time}</p>}
          {result.follow_up_questions.length > 0 && (
            <div className="rounded-md bg-warning/10 p-2 space-y-1">
              <p className="font-medium flex items-center gap-1"><HelpCircle className="h-4 w-4" /> A few more details would help:</p>
              <ul className="list-disc pl-5">{result.follow_up_questions.map((q) => <li key={q}>{q}</li>)}</ul>
              <p className="text-xs text-muted-foreground">Tap “Speak more” to answer, then “Organize with AI” again.</p>
            </div>
          )}
          {result.relevance !== 'community_concern' && (
            <p className="text-xs text-muted-foreground">Note: this may need extra details for municipal staff to act on it. Staff will review every report.</p>
          )}
          <Button type="button" onClick={() => { onApply(result); setApplied(true); }} disabled={applied}>
            {applied ? <><Check className="h-4 w-4 mr-2" /> Added to form</> : 'Use this in my report'}
          </Button>
        </div>
      )}
    </section>
  );
};
