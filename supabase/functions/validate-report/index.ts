import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["valid", "suspicious", "rejected"] },
    confidence: { type: "integer" },
    reason: { type: "string" },
    description_assessment: { type: "string" },
    location_assessment: { type: "string" },
    image_assessment: { type: ["string", "null"] },
    image_authenticity: {
      type: "string",
      enum: ["likely_authentic", "likely_ai_generated", "uncertain", "no_image"],
    },
    knowledge_used: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "confidence",
    "reason",
    "description_assessment",
    "location_assessment",
    "image_assessment",
    "image_authenticity",
    "knowledge_used",
  ],
};

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text) {
          text = evt.response?.output_text ?? "";
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const svc = serviceClient();
  let reportId: string | undefined;

  try {
    const body = await req.json();
    reportId = body?.reportId;
    if (!reportId) return json({ error: "reportId is required" }, 400);

    const { data: report, error: fetchErr } = await svc
      .from("service_requests")
      .select(
        "id, title, description, category, location, latitude, longitude, photo_url, media_urls, media_types, ai_validation_status",
      )
      .eq("id", reportId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!report) return json({ error: "Report not found" }, 404);

    // One-shot: only a freshly submitted report may be validated. Prevents
    // clients from re-running or manipulating an existing verdict.
    if (report.ai_validation_status !== "pending") {
      return json({
        status: report.ai_validation_status,
        alreadyValidated: true,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // --- Knowledge retrieval (Settings -> Knowledge) ---
    const { data: knowledge } = await svc
      .from("municipal_knowledge")
      .select("title, category, content, tags")
      .eq("is_active", true)
      .limit(60);

    const haystack = `${report.title} ${report.description} ${report.category} ${report.location}`.toLowerCase();
    const scored = (knowledge ?? [])
      .map((k) => {
        const terms = [k.category, ...(k.tags ?? []), ...k.title.split(/\s+/)]
          .filter(Boolean)
          .map((t: string) => t.toLowerCase());
        const score = terms.reduce((acc, t) => (t.length > 3 && haystack.includes(t) ? acc + 1 : acc), 0);
        return { k, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ k }) => `### ${k.title} (${k.category})\n${k.content}`);

    const { data: categories } = await svc
      .from("complaint_categories")
      .select("name, description")
      .eq("is_active", true);

    const knowledgeBlock = scored.length
      ? scored.join("\n\n")
      : "No specific municipal knowledge entries matched this report.";

    const imageUrls: string[] = [];
    const urls: string[] = report.media_urls ?? [];
    const types: string[] = report.media_types ?? [];
    urls.forEach((u, i) => {
      if ((types[i] ?? "image") === "image") imageUrls.push(u);
    });
    if (!imageUrls.length && report.photo_url) imageUrls.push(report.photo_url);
    const usedImages = imageUrls.slice(0, 3);

    const instructions = `You are the validation agent of the Municipality of Cortes complaint system.
Decide whether a submitted resident report is a plausible community/municipal concern.

Rules:
- Use SEMANTIC, CONTEXTUAL judgement. Photos may be taken from different angles, distances, lighting or times.
- NEVER require an exact match between image and description. Only flag when the image clearly has no reasonable relation to the reported issue.
- "valid": description describes a community/municipal concern, the location is plausible, and any image reasonably supports it.
- "suspicious": there are significant inconsistencies (e.g. image shows an entirely unrelated subject), or the report lacks enough information to proceed.
- "rejected": only when the submission clearly fails the municipality's reporting requirements (spam, gibberish, abusive, or clearly not a municipal concern).
- You assist administrators; you never make the final decision. When unsure, prefer "suspicious" over "rejected".
- Also judge whether the photo looks like a real photograph or AI-generated/manipulated. Uncertainty is normal — do not assume fake.
- confidence is 0-100 for how sure you are of your verdict.
- Write reason and assessments in clear, short English (1-2 sentences each).

Approved municipal knowledge base (the only authoritative reference):
${knowledgeBlock}

Official report categories: ${(categories ?? []).map((c) => c.name).join(", ") || "n/a"}`;

    const content: unknown[] = [
      {
        type: "input_text",
        text: `Report for validation:
Title: ${report.title}
Category: ${report.category}
Location / specific place: ${report.location ?? "not provided"}${
          report.latitude ? ` (map pin: ${report.latitude}, ${report.longitude})` : ""
        }
Description: ${report.description}
Images attached: ${usedImages.length}`,
      },
      ...usedImages.map((url) => ({ type: "input_image", image_url: url })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions,
        input: [{ role: "user", content }],
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "report_validation",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      await svc
        .from("service_requests")
        .update({ ai_validation_status: "pending", ai_validation_reason: "AI validation unavailable — queued for review." })
        .eq("id", reportId);
      return json({ error: "AI validation unavailable", status: "pending" }, res.status === 429 || res.status === 402 ? res.status : 503);
    }

    const raw = await readStream(res);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      console.error("Unparseable AI output", raw.slice(0, 500));
      return json({ error: "AI validation unavailable", status: "pending" }, 503);
    }

    const status = ["valid", "suspicious", "rejected"].includes(parsed.status as string)
      ? (parsed.status as string)
      : "suspicious";
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 50));

    const elements = {
      description: parsed.description_assessment ?? null,
      location: parsed.location_assessment ?? null,
      image: parsed.image_assessment ?? null,
      image_authenticity: parsed.image_authenticity ?? (usedImages.length ? "uncertain" : "no_image"),
      images_analyzed: usedImages.length,
      knowledge_used: parsed.knowledge_used ?? [],
    };

    const { error: updateErr } = await svc
      .from("service_requests")
      .update({
        ai_validation_status: status,
        ai_validation_reason: (parsed.reason as string) ?? null,
        ai_validation_confidence: confidence,
        ai_validated_at: new Date().toISOString(),
        ai_validation_elements: elements,
        requires_review: status !== "valid",
      })
      .eq("id", reportId);
    if (updateErr) throw updateErr;

    await svc.from("ai_logs").insert({
      report_id: reportId,
      action: "validate_report",
      decision: status,
      confidence,
      reasoning: (parsed.reason as string) ?? null,
      actor: "validation_agent",
      metadata: elements,
    });

    return json({ status, confidence, reason: parsed.reason ?? null, elements });
  } catch (error) {
    console.error("validate-report error:", error);
    return json({ error: (error as Error).message ?? "Validation failed", status: "pending" }, 500);
  }
});
