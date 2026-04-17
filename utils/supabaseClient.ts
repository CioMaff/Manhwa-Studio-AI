import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN MANHWA AI ---
// Required env vars (set in .env.local):
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon-key>
const env = (import.meta as any).env ?? {};
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL;
export const SUPABASE_KEY: string = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
        "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local."
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});

// Invoke a Supabase Edge Function with the user's JWT attached.
// Throws on non-2xx (and surfaces the server error message).
export async function invokeEdgeFunction<T>(
    name: string,
    body: Record<string, unknown>
): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
        throw new Error(
            "No active Supabase session — user must be logged in before calling Edge Functions. " +
            "If you're in guest mode, backend-proxied features are disabled."
        );
    }

    const url = `${SUPABASE_URL}/functions/v1/${name}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: any;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

    if (!response.ok) {
        const msg = (parsed && typeof parsed === 'object' && parsed.error) || text || `HTTP ${response.status}`;
        const err = new Error(`[${name}] ${msg}`);
        (err as any).status = response.status;
        throw err;
    }

    return parsed as T;
}

export const checkSupabaseConnection = async (): Promise<{ status: 'ok' | 'error' | 'missing_table' | 'offline', message?: string }> => {
    try {
        const { count, error } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("Supabase Check Error:", error);
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return { status: 'offline', message: 'No se pudo conectar a Supabase (Offline/Red).' };
            }
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                return { status: 'missing_table', message: 'La tabla "projects" no existe en Supabase.' };
            }
            return { status: 'error', message: error.message };
        }
        return { status: 'ok', message: `Conectado a Manhwa AI. ${count || 0} proyectos.` };
    } catch (e: any) {
        const msg = e.message || "Error desconocido";
        if (msg.includes('Failed to fetch')) {
            return { status: 'offline', message: 'No se pudo conectar a Supabase (Offline).' };
        }
        return { status: 'error', message: msg };
    }
};
