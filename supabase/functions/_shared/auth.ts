// Shared auth helpers. Every Edge Function must call `requireUser` before
// doing anything expensive so we never run on behalf of an anonymous caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AuthSuccess = { ok: true; userId: string; token: string };
type AuthFailure = { ok: false; status: number; message: string };

export async function requireUser(req: Request): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, message: "Missing bearer token" };
  }
  const token = authHeader.slice(7).trim();
  if (!token) return { ok: false, status: 401, message: "Empty bearer token" };

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return { ok: false, status: 500, message: "Server auth misconfigured" };
  }

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }

  return { ok: true, userId: data.user.id, token };
}

// Best-effort client IP extraction for rate-limit fallback when userId is absent.
export function clientIpFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
