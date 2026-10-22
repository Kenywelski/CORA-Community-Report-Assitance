// Agentic AI complaint routing for myCortes.
// Classifies a new report, determines priority, picks a department, logs its reasoning,
// assigns the report and notifies the department staff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Dept = { id: string; name: string; description: string | null; response_hours: number };
type Cat = { id: string; name: string; description: string | null; keywords: string[]; default_department_id: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { report_id } = await req.json() as { report_id?: string };
    if (!report_id) return json({ error: "report_id is required" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await requireUser(req);
    let anonymousPass = false;
    if (!auth.ok) {
      // Guest submissions carry no session. Allow a one-shot unauthenticated
      // routing pass for anonymous reports only (user_id null, never routed).
      const { data: candidate } = await supabase
        .from("service_requests").select("user_id, ai_processed_at").eq("id", report_id).maybeSingle();
      anonymousPass = !!candidate && candidate.user_id === null && !candidate.ai_processed_at;
      if (!anonymousPass) return json({ error: auth.error }, auth.status);
    }

    const { data: report, error: rErr } = await supabase
      .from("service_requests")
      .select("id, title, description, category, location, status, department_id")
      .eq("id", report_id)
      .maybeSingle();
    if (rErr || !report) return json({ error: "Report not found" }, 404);

    // Only admins/staff, or the citizen who filed the report, may trigger routing.
    // Anonymous reports were already vetted in the anonymousPass check above.
    if (auth.ok && !auth.isStaff) {
      const { data: owner } = await supabase
        .from("service_requests").select("user_id, ai_processed_at").eq("id", report_id).maybeSingle();
      if (!owner || owner.user_id !== auth.userId) return json({ error: "Not authorized for this report" }, 403);
      if (owner.ai_processed_at) return json({ error: "This report has already been routed" }, 409);
    }

    const [{ data: depts }, { data: cats }, { data: settings }] = await Promise.all([
      supabase.from("departments").select("id, name, description, response_hours").eq("is_active", true),
      supabase.from("complaint_categories").select("id, name, description, keywords, default_department_id").eq("is_active", true),
      supabase.from("system_settings").select("key, value"),
    ]);

    const departments = (depts ?? []) as Dept[];
    const categories = (cats ?? []) as Cat[];
    if (departments.length === 0) return json({ error: "No active departments configured" }, 400);

    const settingsMap = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
    const threshold = Number(settingsMap.ai_confidence_threshold ?? 70);
    const routingEnabled = settingsMap.ai_routing_enabled !== false;
    if (!routingEnabled) return json({ skipped: "AI routing disabled" });

    // ---- Fallback: keyword matching if AI is unavailable ----
    const text = `${report.title} ${report.description} ${report.category}`.toLowerCase();
    const keywordMatch = categories.find((c) => c.keywords?.some((k) => k && text.includes(k.toLowerCase())));

    let decision: {
      category: string; priority: string; department: string; confidence: number; reasoning: string;
    } | null = null;

    if (key) {
      const tools = [{
        type: "function",
        function: {
          name: "assign_complaint",
          description: "Classify the complaint, set its priority, and assign the responsible department.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: `One of: ${categories.map((c) => c.name).join(", ")}` },
              priority: { type: "string", description: "One of: low, medium, high, critical" },
              department: { type: "string", description: `Exact department name, one of: ${departments.map((d) => d.name).join(", ")}` },
              confidence: { type: "number", description: "Confidence 0-100 in the department choice" },
              reasoning: { type: "string", description: "Short explanation (1-3 sentences) of the classification and routing choice" },
            },
            required: ["category", "priority", "department", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      }];

      const systemPrompt = `You are the AI Complaint Routing Agent for the Municipality of Cortes, Surigao del Sur.
Analyze the citizen complaint and route it to the correct department.

Departments:
${departments.map((d) => `- ${d.name}: ${d.description ?? ""}`).join("\n")}

Categories:
${categories.map((c) => `- ${c.name}: ${c.description ?? ""}`).join("\n")}

Priority guide:
- critical: danger to life, active hazard, crime in progress
- high: safety risk, service outage affecting many residents
- medium: standard repairs and service concerns
- low: minor or cosmetic issues, general inquiries

Always call the assign_complaint tool exactly once. Be honest about confidence: below 70 means a human should review.`;

      const userPrompt = `Title: ${report.title}
Category tag: ${report.category}
Location: ${report.location ?? "unspecified"}
Description: ${report.description}`;

      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          tools,
          tool_choice: { type: "function", function: { name: "assign_complaint" } },
        }),
      });

      if (res.status === 429) return json({ error: "Rate limited. Please try again shortly." }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted. Add credits to continue AI routing." }, 402);

      if (res.ok) {
        const data = await res.json();
        const call = data?.choices?.[0]?.message?.tool_calls?.[0];
        if (call?.function?.arguments) {
          try { decision = JSON.parse(call.function.arguments); } catch { /* fall through */ }
        }
      } else {
        console.error("AI gateway error", res.status, await res.text());
      }
    }

    let department = decision
      ? departments.find((d) => d.name.toLowerCase() === String(decision!.department).toLowerCase())
      : undefined;
    let confidence = decision ? Math.max(0, Math.min(100, Number(decision.confidence) || 0)) : 0;
    let reasoning = decision?.reasoning ?? "";
    let categoryName = decision?.category ?? keywordMatch?.name ?? "Other";
    let priority = (decision?.priority ?? "medium").toLowerCase();

    if (!department) {
      const fallbackDeptId = keywordMatch?.default_department_id;
      department = departments.find((d) => d.id === fallbackDeptId);
      confidence = department ? 45 : 0;
      reasoning = reasoning || (department
        ? `Keyword fallback: matched category "${keywordMatch?.name}" and routed to its default department.`
        : "Could not determine a department automatically. Flagged for admin review.");
    }

    const matchedCategory = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    const requiresReview = !department || confidence < threshold;
    const responseHours = department?.response_hours ?? Number(settingsMap.default_response_hours ?? 72);
    const dueAt = new Date(Date.now() + responseHours * 3600_000).toISOString();

    const { error: uErr } = await supabase
      .from("service_requests")
      .update({
        department_id: requiresReview ? null : department?.id ?? null,
        category_id: matchedCategory?.id ?? null,
        ai_category: categoryName,
        ai_priority: priority,
        ai_department_id: department?.id ?? null,
        ai_confidence: confidence,
        ai_reason: reasoning,
        ai_processed_at: new Date().toISOString(),
        requires_review: requiresReview,
        due_at: dueAt,
      })
      .eq("id", report.id);
    if (uErr) console.error("update failed", uErr);

    await supabase.from("ai_logs").insert({
      report_id: report.id,
      action: "route_complaint",
      decision: `${categoryName} | ${priority} | ${department?.name ?? "unassigned"}`,
      confidence,
      reasoning,
      department_id: department?.id ?? null,
      metadata: { requires_review: requiresReview, threshold, model: decision ? MODEL : "keyword-fallback" },
    });

    // Notify department staff
    if (!requiresReview && department) {
      const { data: staff } = await supabase
        .from("staff_members")
        .select("user_id")
        .eq("department_id", department.id)
        .eq("is_active", true);
      if (staff?.length) {
        await supabase.from("notifications").insert(
          staff.map((s: any) => ({
            user_id: s.user_id,
            type: "complaint_assigned",
            title: report.title,
            body: `New ${priority} priority complaint assigned to ${department!.name}`,
            link: "/staff",
          })),
        );
      }
    }

    return json({
      report_id: report.id,
      category: categoryName,
      priority,
      department: department?.name ?? null,
      department_id: department?.id ?? null,
      confidence,
      reasoning,
      requires_review: requiresReview,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
