// AI Monitoring Agent: finds complaints that are overdue or stalled, escalates them,
// notifies admins and department staff, and records the decision in the AI audit log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Allow a trusted scheduler (shared secret) or an authenticated admin only.
    const cronSecret = Deno.env.get("MONITOR_CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const viaScheduler = !!cronSecret && providedSecret === cronSecret;

    if (!viaScheduler) {
      const auth = await requireUser(req);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      if (!auth.isAdmin) return json({ error: "Admin access required" }, 403);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase.from("system_settings").select("key, value");
    const settingsMap = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
    const defaultHours = Number(settingsMap.default_response_hours ?? 72);
    const now = Date.now();

    const { data: open } = await supabase
      .from("service_requests")
      .select("id, title, status, created_at, due_at, department_id, escalated_at, acknowledged_at, ai_priority")
      .not("status", "in", "(completed,rejected,closed)")
      .is("escalated_at", null);

    const overdue = (open ?? []).filter((r: any) => {
      const due = r.due_at ? new Date(r.due_at).getTime() : new Date(r.created_at).getTime() + defaultHours * 3600_000;
      return now > due;
    });

    if (overdue.length === 0) return json({ escalated: 0, checked: open?.length ?? 0 });

    const nowIso = new Date().toISOString();
    const ids = overdue.map((r: any) => r.id);

    await supabase.from("service_requests").update({ escalated_at: nowIso, requires_review: true }).in("id", ids);

    await supabase.from("ai_logs").insert(
      overdue.map((r: any) => ({
        report_id: r.id,
        action: "escalate_overdue",
        decision: "escalated",
        confidence: 100,
        reasoning: `Complaint remained "${r.status}" past its response deadline. Escalated for administrative attention.`,
        department_id: r.department_id,
        metadata: { due_at: r.due_at, priority: r.ai_priority },
      })),
    );

    // Notify admins
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const notifs: any[] = [];
    for (const r of overdue) {
      for (const a of admins ?? []) {
        notifs.push({
          user_id: a.user_id,
          type: "complaint_escalated",
          title: r.title,
          body: "Complaint is overdue and has been escalated by the AI monitoring agent",
          link: "/admin/requests",
        });
      }
      if (r.department_id) {
        const { data: staff } = await supabase
          .from("staff_members").select("user_id").eq("department_id", r.department_id).eq("is_active", true);
        for (const s of staff ?? []) {
          notifs.push({
            user_id: s.user_id,
            type: "complaint_escalated",
            title: r.title,
            body: "This complaint is overdue — please act on it now",
            link: "/staff",
          });
        }
      }
    }
    if (notifs.length) await supabase.from("notifications").insert(notifs);

    return json({ escalated: overdue.length, checked: open?.length ?? 0 });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
