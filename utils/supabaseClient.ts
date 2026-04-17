
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN ESTRICTA MANHWA AI ---
// Project ID: rkvjtxpngizairgzykez
// ADVERTENCIA: Esta configuración apunta EXCLUSIVAMENTE a la base de datos de Manhwa AI.

const SUPABASE_URL = 'https://cszizbtqgjhsoyybemhu.supabase.co';
// User's anon key
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeml6YnRxZ2poc295eWJlbWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzA2NjMsImV4cCI6MjA4NzYwNjY2M30.YsaXbKvGzEyfssizyIijS0tE-gvpStMxq7XHBlf4Bng'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});

export const checkSupabaseConnection = async (): Promise<{ status: 'ok' | 'error' | 'missing_table' | 'offline', message?: string }> => {
    try {
        // Intentamos una lectura ligera (count) para verificar acceso y existencia de tabla
        const { count, error } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("Supabase Check Error:", error);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return { status: 'offline', message: 'No se pudo conectar a Supabase (Offline/Red).' };
            }

            // Código de error PostgreSQL para "undefined table"
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
