// Shared auth helpers for edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean; isStaff: boolean }
  | { ok: false; status: number; error: string };

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Verifies the caller's JWT and resolves admin/staff status. */
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Authentication required" };

  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: "Invalid or expired session" };

  const userId = data.user.id;

  const [{ data: roles }, { data: staff }] = await Promise.all([
    svc.from("user_roles").select("role").eq("user_id", userId),
    svc.from("staff_members").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle(),
  ]);

  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  const isStaff = isAdmin || !!staff || (roles ?? []).some((r: { role: string }) => r.role === "staff");

  return { ok: true, userId, isAdmin, isStaff };
}
