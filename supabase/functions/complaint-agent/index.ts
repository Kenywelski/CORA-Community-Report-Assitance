// Agentic complaint intake for myCortes.
// Flow: understand -> identify type -> detect missing info -> ask clarification
//       -> retrieve municipal rules (RAG) -> structure -> use authorized tools
//       -> create/update the complaint -> admin review.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

const BARANGAYS = [
  "Burgos", "Capandan", "Mabahin", "Madreliño", "Manlico", "Matho",
  "Poblacion", "Tag-Anongan", "Tigao", "Tuboran", "Uba",
];

const CATEGORIES = [
  "Road Damage", "Street Light Issue", "Garbage/Waste Problem", "Drainage/Canal Issue",
  "Water Supply Problem", "Public Safety Concern", "Noise Complaint", "Stray Animals",
  "Illegal Activity", "Environmental Issue", "Other Issue",
];

type Msg = { role: "user" | "assistant"; content: string };

const tools = [
  {
    type: "function",
    name: "search_municipal_rules",
    description:
      "Search the Cortes municipal knowledge base for rules, required details, response times and handling procedures. Use before asking clarifying questions and before creating a complaint.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Keywords about the complaint topic, e.g. 'street light' or 'response time'." },
      },
    },
  },
  {
    type: "function",
    name: "create_complaint",
    description:
      "File the structured complaint in the municipal system. Only call once every required detail is known and the resident confirmed.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["category", "summary", "description", "barangay", "location_details", "reporter_name", "contact_number", "is_public"],
      properties: {
        category: { type: "string", enum: CATEGORIES },
        summary: { type: "string", description: "Short title, max 80 chars." },
        description: {
          type: "string",
          description: "Complete structured description: what happened, when, how severe, who is affected.",
        },
        barangay: { type: "string", enum: BARANGAYS },
        location_details: { type: ["string", "null"], description: "Landmark or specific spot, null if unknown." },
        reporter_name: { type: ["string", "null"], description: "Resident's name, null if anonymous." },
        contact_number: { type: ["string", "null"], description: "Contact number, null if not given." },
        is_public: { type: "boolean", description: "True to show on the Community Wall." },
      },
    },
  },
  {
    type: "function",
    name: "update_complaint",
    description: "Add newly provided details to a complaint the resident already filed in this conversation.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["report_id", "additional_details"],
      properties: {
        report_id: { type: "string" },
        additional_details: { type: "string" },
      },
    },
  },
];

const systemPrompt = `You are the AI Complaint Intake Agent of the Municipality of Cortes, Surigao del Sur (myCortes).

Your job, in order:
1. Understand the resident's complaint in their own words (English, Tagalog or Bisaya — always reply in the language they used).
2. Identify the complaint type from: ${CATEGORIES.join(", ")}.
3. Check for missing information. Required: complaint type, barangay (one of ${BARANGAYS.join(", ")}), what happened, when it happened/how long it has been there, and how severe it is.
4. Ask clarifying questions — at most 2 short questions per message, never repeat what you already know.
5. Call search_municipal_rules to retrieve the municipal rules, required details and response times for that complaint type, and use them in your answers.
6. Structure the complaint clearly.
7. Before filing, show the resident a short summary (Type, Barangay, Location, Details) and ask them to confirm.
8. Once confirmed, call create_complaint exactly once. Afterwards tell them the reference and that the municipal office will review it.

Rules:
- Life-threatening emergencies: tell them to call MDRRMO/Rescue, Police or Fire immediately, then continue documenting.
- Never invent facts, names, dates or barangays. If a barangay is not on the list, ask again.
- Keep replies short, warm and plain — residents are not technical. Use a few short lines, no markdown tables.
- Never mention tools, models, databases or internal systems.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured." }, 500);

    const body = await req.json() as { messages?: Msg[] };
    const history = (body.messages ?? []).slice(-24);
    if (history.length === 0) return json({ error: "messages is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build the stateless input array from plain conversation text.
    const input: any[] = history.map((m) => ({
      role: m.role,
      content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content }],
    }));

    let createdReportId: string | null = null;
    let finalText = "";

    for (let step = 0; step < 5; step++) {
      const res = await fetch(RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: MODEL,
          instructions: systemPrompt,
          input,
          tools,
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
          include: ["reasoning.encrypted_content"],
        }),
      });

      if (res.status === 429) return json({ error: "The assistant is busy right now. Please try again in a moment." }, 429);
      if (res.status === 402) return json({ error: "AI credits are exhausted. Please add credits to continue." }, 402);
      if (!res.ok || !res.body) {
        const detail = await res.text();
        console.error("gateway error", res.status, detail);
        return json({ error: "The assistant is unavailable right now." }, 502);
      }

      // Read the SSE stream and keep the final response payload.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed: any = null;
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
            if (evt.type === "response.completed" || evt.type === "response.incomplete") completed = evt.response;
          } catch { /* ignore keepalives */ }
        }
      }

      const output: any[] = completed?.output ?? [];
      const calls = output.filter((o) => o.type === "function_call");

      if (calls.length === 0) {
        finalText = text || completed?.output_text ||
          "Sorry, I did not catch that. Could you describe the problem again?";
        break;
      }

      // Round-trip: resend the returned items, then append each tool result.
      input.push(...output);

      for (const call of calls) {
        let args: any = {};
        try { args = JSON.parse(call.arguments ?? "{}"); } catch { /* ignore */ }
        let result: unknown;

        if (call.name === "search_municipal_rules") {
          const q = String(args.query ?? "").slice(0, 120);
          const { data } = await supabase
            .from("municipal_knowledge")
            .select("title, category, content")
            .eq("is_active", true)
            .or(`title.ilike.%${q}%,content.ilike.%${q}%,tags.cs.{${q}}`)
            .limit(4);
          const rows = data?.length
            ? data
            : (await supabase.from("municipal_knowledge").select("title, category, content").eq("is_active", true).limit(4)).data;
          result = { results: rows ?? [] };
        } else if (call.name === "create_complaint") {
          const description = [
            args.description,
            args.reporter_name ? `Reporter: ${args.reporter_name}` : "Anonymous Report",
            args.contact_number ? `Contact: ${args.contact_number}` : "",
            args.location_details ? `Location Details: ${args.location_details}` : "",
            "Filed with the help of the myCortes AI intake agent.",
          ].filter(Boolean).join("\n");

          const { data: inserted, error } = await supabase
            .from("service_requests")
            .insert({
              user_id: auth.userId,
              title: `[REPORT] ${args.summary ?? args.category}`,
              description,
              category: `Report: ${args.category}`,
              location: `${args.barangay}${args.location_details ? `, ${args.location_details}` : ""}`,
              reporter_name: args.reporter_name || null,
              is_public: args.is_public !== false,
            })
            .select("id")
            .single();

          if (error) {
            console.error("insert failed", error);
            result = { ok: false, error: "Could not file the complaint." };
          } else {
            createdReportId = inserted.id;
            result = { ok: true, report_id: inserted.id, reference: inserted.id.slice(0, 8).toUpperCase() };
            // Hand off to the routing agent (classification, priority, department).
            supabase.functions.invoke("route-complaint", {
              body: { report_id: inserted.id },
              headers: { Authorization: req.headers.get("Authorization") ?? "" },
            }).catch((e) => console.error("routing failed", e));
          }
        } else if (call.name === "update_complaint") {
          const { data: existing } = await supabase
            .from("service_requests")
            .select("id, description, user_id")
            .eq("id", args.report_id)
            .maybeSingle();
          if (!existing || existing.user_id !== auth.userId) {
            result = { ok: false, error: "Report not found." };
          } else {
            await supabase
              .from("service_requests")
              .update({ description: `${existing.description}\nAdditional details: ${args.additional_details}` })
              .eq("id", existing.id);
            result = { ok: true };
          }
        } else {
          result = { ok: false, error: "Unknown tool." };
        }

        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }
    }

    return json({ reply: finalText, report_id: createdReportId });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
