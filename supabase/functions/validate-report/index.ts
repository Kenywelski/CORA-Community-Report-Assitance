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

const FOUR_SUPPORTED_CLASSES = [
  "Drainage/Flooding Concern",
  "Streetlight Problem",
  "Road Damage",
  "Improper Waste Disposal",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["valid", "rejected"] },
    confidence: { type: "integer" },
    matched_class: {
      type: ["string", "null"],
      enum: [...FOUR_SUPPORTED_CLASSES, null],
    },
    is_blurred: { type: "boolean" },
    is_unrelated: { type: "boolean" },
    reason: { type: "string" },
    description_assessment: { type: "string" },
    location_assessment: { type: "string" },
    image_assessment: { type: ["string", "null"] },
    image_authenticity: {
      type: "string",
      enum: ["likely_authentic", "likely_ai_generated", "uncertain", "no_image"],
    },
    knowledge_used: { type: "array", items: { type: "string" } },
    recommended_actions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "confidence",
    "matched_class",
    "is_blurred",
    "is_unrelated",
    "reason",
    "description_assessment",
    "location_assessment",
    "image_assessment",
    "image_authenticity",
    "knowledge_used",
    "recommended_actions",
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
        "id, user_id, title, description, category, location, latitude, longitude, photo_url, media_urls, media_types, ai_validation_status, status",
      )
      .eq("id", reportId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!report) return json({ error: "Report not found" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const instructions = `You are the Autonomous AI Verification Agent for Barangay Purisima, Tago, Surigao del Sur (CORA).
There is NO human-in-the-loop review. You must make the final automatic decision to either APPROVE ("valid") or REJECT ("rejected") the resident's report.

Strict Verification Rules:
1. Supported Four Classes ONLY:
   - "Drainage/Flooding Concern" (clogged canals, drainage blockages, standing floodwater)
   - "Streetlight Problem" (broken, unlit, flickering, or damaged street lighting fixtures)
   - "Road Damage" (potholes, cracked concrete pavement, damaged roads)
   - "Improper Waste Disposal" (uncollected garbage, illegal dumping, roadside litter)
2. Image Quality & Blur Check:
   - If no image is attached, OR the attached image is very blurred, pitch dark, unreadable, or manipulated/fake, you MUST set "is_blurred": true and "status": "rejected".
3. Relevance Check:
   - If the image or report does NOT clearly belong to one of the four supported classes above (e.g., selfies, memes, indoor objects, random scenery, unrelated complaints, spam), you MUST set "is_unrelated": true, "matched_class": null, and "status": "rejected".
4. Automatic Approval:
   - If the photo is clear (not blurred) AND shows a real concern matching one of the 4 classes (${FOUR_SUPPORTED_CLASSES.join(", ")}), set "status": "valid", "is_blurred": false, "is_unrelated": false, and set "matched_class" to that exact class.
5. Write a clear, concise 1-2 sentence "reason" explaining why the report was automatically approved or automatically rejected.

Approved knowledge base:
${knowledgeBlock}`;

    const content: unknown[] = [
      {
        type: "input_text",
        text: `Report for autonomous AI decision:
Title: ${report.title}
Category: ${report.category}
Location: ${report.location ?? "not provided"}${
          report.latitude ? ` (GPS: ${report.latitude}, ${report.longitude})` : ""
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
            name: "autonomous_report_decision",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
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

    const isRejected =
      parsed.status === "rejected" ||
      parsed.is_blurred === true ||
      parsed.is_unrelated === true ||
      !parsed.matched_class ||
      usedImages.length === 0;

    const finalAiStatus = isRejected ? "rejected" : "valid";
    const finalRequestStatus = isRejected ? "rejected" : "in_progress";
    const finalAdminReviewStatus = isRejected ? "rejected" : "approved";
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 85));
    const nowIso = new Date().toISOString();

    const elements = {
      description: parsed.description_assessment ?? null,
      location: parsed.location_assessment ?? null,
      image: parsed.image_assessment ?? null,
      image_authenticity: parsed.image_authenticity ?? (usedImages.length ? "likely_authentic" : "no_image"),
      image_clarity: parsed.is_blurred ? "blurred_or_unreadable" : usedImages.length ? "clear" : "no_image",
      matched_four_class: parsed.matched_class ?? null,
      images_analyzed: usedImages.length,
      knowledge_used: parsed.knowledge_used ?? [],
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [],
      is_unrelated: parsed.is_unrelated === true,
      decision_mode: "autonomous_ai_no_hitl",
    };

    const autoReason = (parsed.reason as string) ??
      (isRejected
        ? "Automatically rejected by AI: Image is blurred or report does not match the 4 supported community concern classes."
        : `Automatically approved by AI under ${parsed.matched_class}.`);

    const { error: updateErr } = await svc
      .from("service_requests")
      .update({
        status: finalRequestStatus,
        ai_validation_status: finalAiStatus,
        ai_validation_reason: autoReason,
        ai_validation_confidence: confidence,
        ai_validated_at: nowIso,
        ai_validation_elements: elements,
        admin_review_status: finalAdminReviewStatus,
        admin_notes: isRejected
          ? `AI Auto-Rejected: ${autoReason}`
          : `AI Auto-Approved (${parsed.matched_class}): ${autoReason}`,
        acknowledged_at: isRejected ? null : nowIso,
        response_at: isRejected ? null : nowIso,
        requires_review: false,
      })
      .eq("id", reportId);
    if (updateErr) throw updateErr;

    await svc.from("ai_logs").insert({
      report_id: reportId,
      action: "autonomous_validate_report",
      decision: finalAiStatus,
      confidence,
      reasoning: autoReason,
      actor: "autonomous_ai_agent",
      metadata: elements,
    });

    if (report.user_id) {
      await svc.from("notifications").insert({
        user_id: report.user_id,
        type: isRejected ? "report_invalid" : "report_approved",
        title: isRejected
          ? "Your report was automatically rejected by AI"
          : "Your report was automatically approved by AI",
        body: isRejected
          ? `"${report.title}" was automatically rejected: ${autoReason}`
          : `"${report.title}" matched ${parsed.matched_class} and was automatically approved for barangay action.`,
        link: "/my-requests",
      });
    }

    return json({
      status: finalAiStatus,
      request_status: finalRequestStatus,
      confidence,
      reason: autoReason,
      elements,
      requires_review: false,
    });
  } catch (error) {
    console.error("validate-report error:", error);
    return json({ error: (error as Error).message ?? "Validation failed", status: "pending" }, 500);
  }
});
