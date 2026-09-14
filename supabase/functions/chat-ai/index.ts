// AI chatbot for myCortes. Streams Lovable AI Gateway responses.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { requireUser } from "../_shared/auth.ts";

interface Msg { role: "user" | "assistant" | "system"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json() as { messages: Msg[] };
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are myCortes Assistant, a friendly AI helper for the Municipality of Cortes, Surigao del Sur, Philippines.

Help citizens with:
- Municipal services (Mayor's Office, Treasurer, Civil Registrar, Health, MSWDO, Engineering, Assessor, Agriculture, BPLO, etc.)
- How to request services or documents (Barangay Clearance, Cedula, Business Permit, Birth Certificate, etc.)
- Reporting community issues (road damage, garbage, flooding, street lights, water supply, public safety)
- Emergency contacts (PNP, BFP, MDRRMO, Rural Health)
- Programs (scholarships, health, livelihood, youth, senior citizen)
- Tourist spots and events in Cortes
- The myCortes app (Community Wall, My Requests, Profile, Updates)

Guidelines:
- Be concise, warm, and use simple language. Mix in Filipino phrases sparingly when natural.
- For requests requiring in-person visits, mention office hours are typically Mon-Fri 8AM-5PM.
- If a question needs a real person (specific case details, complaints about staff, urgent issues), suggest the user switch to the "Admin/Staff" tab to chat with municipal staff.
- For emergencies, always direct to 911 or the relevant hotline immediately.
- Never invent specific names, fees, or schedules you aren't sure about. Say "please confirm with the office" instead.
- Format responses with markdown when helpful (lists, bold).`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (upstream.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (upstream.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact the administrator." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      return new Response(JSON.stringify({ error: t || "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
