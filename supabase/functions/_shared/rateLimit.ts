// Server-side rate limiting via the `check_rate_limit` RPC defined in the
// supabase/migrations. Fails closed — if the DB is unreachable we deny the call
// rather than opening the floodgates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface RateLimitArgs {
  identifier: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
}

export async function checkRateLimit(args: RateLimitArgs): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error("[rateLimit] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return false;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("check_rate_limit", {
    p_identifier: args.identifier,
    p_endpoint: args.endpoint,
    p_max_requests: args.maxRequests,
    p_window_seconds: args.windowSeconds,
  });

  if (error) {
    console.error("[rateLimit] RPC failed:", error.message);
    return false;
  }
  return Boolean(data);
}

export function tooManyRequests(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Too Many Requests" }), {
    status: 429,
    headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" },
  });
}
