import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.25.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { requireUser, clientIpFrom } from "../_shared/auth.ts";
import { checkRateLimit, tooManyRequests } from "../_shared/rateLimit.ts";

// Allow-list of Gemini model IDs the client is allowed to request.
// Keeping this short closes the door on someone calling unexpected / expensive models.
const ALLOWED_MODELS = new Set<string>([
  "gemini-3.1-pro",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-preview-tts",
]);

// Hard cap on request body size (base64 images can get big; 12 MB is generous).
const MAX_BODY_BYTES = 12 * 1024 * 1024;

interface ProxyRequest {
  model?: string;
  contents?: unknown;
  config?: Record<string, unknown>;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function modelBucket(model: string): { maxRequests: number; windowSeconds: number } {
  // Image generation is expensive; allow a smaller burst.
  if (model.includes("image")) return { maxRequests: 30, windowSeconds: 60 };
  if (model.includes("tts")) return { maxRequests: 20, windowSeconds: 60 };
  return { maxRequests: 60, windowSeconds: 60 };
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405, cors);
  }

  // Size guard.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && parseInt(lenHeader, 10) > MAX_BODY_BYTES) {
    return json({ error: "Payload Too Large" }, 413, cors);
  }

  // 1. Auth — reject missing/invalid JWTs.
  const auth = await requireUser(req);
  if (!auth.ok) return json({ error: auth.message }, auth.status, cors);

  // 2. Parse body.
  let body: ProxyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const model = body.model;
  if (!model || typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
    return json({ error: `Model not allowed: ${model}` }, 400, cors);
  }
  if (body.contents === undefined || body.contents === null) {
    return json({ error: "Missing contents" }, 400, cors);
  }

  // 3. Rate limit — per user, per endpoint (model-class bucket).
  const identifier = auth.userId || clientIpFrom(req);
  const bucket = modelBucket(model);
  const allowed = await checkRateLimit({
    identifier,
    endpoint: `gemini:${model.includes("image") ? "image" : model.includes("tts") ? "tts" : "text"}`,
    maxRequests: bucket.maxRequests,
    windowSeconds: bucket.windowSeconds,
  });
  if (!allowed) return tooManyRequests(cors);

  // 4. Call Gemini with the server-side key.
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[gemini-proxy] GEMINI_API_KEY secret is not set.");
    return json({ error: "Server misconfigured: missing GEMINI_API_KEY" }, 500, cors);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      // deno-lint-ignore no-explicit-any
      contents: body.contents as any,
      // deno-lint-ignore no-explicit-any
      config: (body.config ?? undefined) as any,
    });

    // The SDK exposes `text` as a getter; materialize it so JSON serialization preserves it.
    // deno-lint-ignore no-explicit-any
    const text = (response as any).text ?? null;
    // deno-lint-ignore no-explicit-any
    const candidates = (response as any).candidates ?? [];

    return json({ text, candidates }, 200, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gemini-proxy] Gemini call failed:", message);
    // Surface upstream status codes so the client retry logic keeps working.
    const status = /429|RESOURCE_EXHAUSTED/i.test(message) ? 429
                 : /403|PERMISSION_DENIED/i.test(message) ? 403
                 : /404|NOT_FOUND/i.test(message) ? 404
                 : /503|overload/i.test(message) ? 503
                 : 500;
    return json({ error: message }, status, cors);
  }
});
