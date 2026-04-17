// Shared CORS helpers for Supabase Edge Functions.
// The allow-list is intentionally narrow — add production origins explicitly.

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
]);

const ALLOWED_ORIGIN_SUFFIXES = [
  ".vercel.app",
  ".netlify.app",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allow = isAllowedOrigin(origin) ? origin! : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const cors = buildCorsHeaders(req.headers.get("origin"));
  return new Response(null, { status: 204, headers: cors });
}
