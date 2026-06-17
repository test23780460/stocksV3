import { getSupabaseAdmin, hasSupabaseServerConfig } from "./supabaseServer";

export interface AdminCheck {
  ok: boolean;
  status: 401 | 403 | 200;
  message: string;
  userId?: string;
}

export const requireAdmin = async (request: Request): Promise<AdminCheck> => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) {
    return { ok: false, status: 401, message: "Supabase Auth is not configured." };
  }
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return { ok: false, status: 401, message: "Missing bearer session." };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, status: 401, message: "Invalid or expired session." };

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profileError) return { ok: false, status: 403, message: "Profile role could not be verified." };
  if (profile?.role !== "admin") return { ok: false, status: 403, message: "Admin role required." };
  return { ok: true, status: 200, message: "Admin verified.", userId: userData.user.id };
};
