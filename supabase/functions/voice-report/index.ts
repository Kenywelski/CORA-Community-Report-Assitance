// CORA Voice-Assisted Reporting
// 1) multipart POST with `audio` -> transcribes speech (audio is never stored)
// 2) JSON POST { action: "organize", transcript, ... } -> structures the statement,
//    lists missing info and follow-up questions. Never approves/rejects reports.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { serviceClient } from "../_shared/auth.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MAX_AUDIO = 10 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CATEGORIES = [
  "road_damage", "street_light", "garbage", "drainage", "water_supply", "public_safety",
  "noise", "stray_animals", "illegal_activity", "environmental", "other", "unknown",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: CATEGORIES },
    title: { type: "string" },
    description: { type: "string" },
    location_details: { type: ["string", "null"] },
    incident_time: { type: ["string", "null"] },
    missing: { type: "array", items: { type: "string", enum: ["report_type", "incident_details", "location"] } },
    follow_up_questions: { type: "array", items: { type: "string" } },
    relevance: { type: "string", enum: ["community_concern", "unclear", "not_a_community_concern"] },
    concerns: { type: "array", items: { type: "string" } },
  },
  required: ["category", "title", "description", "location_details", "incident_time", "missing", "follow_up_questions", "relevance", "concerns"],
};

const OrganizeBody = z.object({
  action: z.literal("organize"),
  transcript: z.string().trim().min(3).max(4000),
  barangay: z.string().max(100).optional().nullable(),
  location_details: z.string().max(300).optional().nullable(),
  has_photo: z.boolean().optional(),
  language: z.string().max(20).optional().nullable(),
});

async function readSse(res: Response, onEvent: (evt: any) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try { onEvent(JSON.parse(p)); } catch { /* partial frame */ }
    }
  }
}

async function gatewayError(res: Response) {
  const text = await res.text();
  console.error("AI gateway error", res.status, text.slice(0, 500));
  let message = "The voice assistant is unavailable right now. You can type your report instead.";
  if (res.status === 429) message = "Too many requests right now. Please wait a moment and try again, or type your report.";
  if (res.status === 402) message = "AI service credits are exhausted. Please type your report manually.";
  return json({ error: message }, [400, 402, 403, 429].includes(res.status) ? res.status : 503);
}

async function transcribe(req: Request, apiKey: string) {
  const form = await req.formData();
  const audio = form.get("audio");
  const lang = String(form.get("language") ?? "");
  if (!(audio instanceof File) || !audio.size) return json({ error: "No audio received. Please try recording again." }, 400);
  if (audio.size > MAX_AUDIO) return json({ error: "Recording is too long. Please keep it under 2 minutes." }, 400);

  const type = audio.type.startsWith("video/") ? audio.type.replace("video/", "audio/") : audio.type || "audio/webm";
  const file = new File([await audio.arrayBuffer()], audio.name || "speech.webm", { type });

  const fd = new FormData();
  fd.append("model", "openai/gpt-transcribe");
  fd.append("file", file, file.name);
  fd.append("response_format", "json");
  fd.append("stream", "true");
  const iso = lang.split("-")[0];
  // Hint expected languages (Filipino/Tagalog, English, Cebuano/Bisaya).
  fd.append("prompt", "Resident reporting a community problem in Barangay Purisima, Tago, Surigao del Sur. May speak Filipino, English, or Bisaya/Cebuano, possibly mixed.");
  if (iso && ["en", "tl", "fil"].includes(iso)) fd.append("languages", iso === "fil" ? "tl" : iso);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
    body: fd,
  });
  if (!res.ok) return gatewayError(res);

  let text = "";
  let final = "";
  await readSse(res, (evt) => {
    if (evt.type === "transcript.text.delta" && typeof evt.delta === "string") text += evt.delta;
    if (evt.type === "transcript.text.done" && typeof evt.text === "string") final = evt.text;
  });
  const transcript = (final || text).trim();
  if (!transcript) return json({ error: "We couldn't hear any speech. Please speak closer to the microphone and try again." }, 422);
  return json({ transcript });
}

async function organize(req: Request, apiKey: string) {
  const parsed = OrganizeBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Please say or type a little more about the problem." }, 400);
  const b = parsed.data;

  const svc = serviceClient();
  const { data: knowledge } = await svc
    .from("municipal_knowledge").select("title, category, content").eq("is_active", true).limit(20);
  const kb = (knowledge ?? []).map((k) => `- ${k.title} (${k.category}): ${k.content.slice(0, 300)}`).join("\n") || "none";

  const instructions = `You help residents of Barangay Purisima, Tago, Surigao del Sur file community complaints by voice.
The input is a speech transcript (Filipino, English, Bisaya/Cebuano, or mixed) and may contain filler words or recognition errors.
Tasks:
- Organize the statement into a clear report description in the SAME language(s) the resident used. Do NOT add facts, change meaning, exaggerate, or remove details. Only remove fillers/repetition and fix obvious recognition errors.
- title: short (max 8 words) summary.
- category: best match, or "unknown" if not stated/clear.
- location_details: specific place mentioned (purok, street, landmark), else null. Never invent locations.
- incident_time: when it happened if stated, else null.
- missing: include "report_type" if the kind of problem is unclear, "incident_details" if what happened is too vague, "location" if no specific place is mentioned AND none was provided in the form.
- follow_up_questions: one short, friendly question per missing item, in the resident's language. Empty if nothing missing.
- relevance: whether this is a community/municipal concern. Use "unclear" when unsure. This is only a hint for staff; you never approve or reject reports.
- concerns: short notes for staff on inconsistencies or incomplete info (empty if none). Do not accuse the resident.
Approved municipal knowledge (reference only, do not invent policies):
${kb}`;

  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions,
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: `Transcript: ${b.transcript}\nBarangay selected in form: ${b.barangay || "not selected"}\nSpecific location typed in form: ${b.location_details || "none"}\nPhoto attached: ${b.has_photo ? "yes" : "no"}\nSpeech language setting: ${b.language || "unknown"}`,
        }],
      }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "voice_report", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok) return gatewayError(res);

  let text = "";
  let completed = "";
  await readSse(res, (evt) => {
    if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
    if (evt.type === "response.completed") completed = evt.response?.output_text ?? "";
  });
  try {
    return json({ result: JSON.parse((text || completed).trim()) });
  } catch {
    console.error("Unparseable organize output", (text || completed).slice(0, 300));
    return json({ error: "The assistant could not organize this statement. You can edit it manually." }, 503);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Voice assistant is not configured." }, 500);
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) return await transcribe(req, apiKey);
    return await organize(req, apiKey);
  } catch (e) {
    console.error("voice-report error", e);
    return json({ error: "Something went wrong. Please try again or type your report." }, 500);
  }
});
