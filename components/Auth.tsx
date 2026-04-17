
import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { showToast } from '../systems/uiSystem';

interface AuthProps {
    onLogin: (userId: string, email: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;

        setIsLoading(true);
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password.trim(),
                });
                if (error) throw error;
                if (data.user) {
                    showToast("Cuenta creada exitosamente. Por favor inicia sesión.", "success");
                    setIsSignUp(false);
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password.trim(),
                });
                if (error) throw error;
                if (data.user) {
                    onLogin(data.user.id, data.user.email || email);
                }
            }
        } catch (error: any) {
            console.error("Auth error:", error);
            showToast(error.message || "Error de autenticación", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#09090b] text-white font-sans items-center justify-center relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-[#09090b] to-[#09090b] pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-md p-8">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-2xl shadow-violet-500/20 mb-6">
                        <span className="text-3xl font-bold text-white">M</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Manhwa AI Studio</h1>
                    <p className="text-gray-400 text-sm">{isSignUp ? 'Crea una cuenta para guardar tus proyectos en la nube.' : 'Inicia sesión para acceder a tu espacio de trabajo.'}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-sm"
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-sm"
                            required
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!email.trim() || !password.trim() || isLoading}
                        className="w-full bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                        ) : (
                            <span>{isSignUp ? 'Crear Cuenta' : 'Entrar al Estudio'}</span>
                        )}
                        {!isLoading && <span className="text-lg">→</span>}
                    </button>
                    
                    <div className="text-center mt-4 flex flex-col gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                        </button>
                        
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs">O</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <button 
                            type="button" 
                            onClick={() => onLogin('guest', 'guest')}
                            className="text-sm font-semibold text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 py-3 rounded-xl border border-white/5"
                        >
                            Continuar sin cuenta (Modo Local)
                        </button>
                    </div>
                    
                    <p className="text-[10px] text-center text-gray-500 leading-relaxed px-4 mt-4">
                        Tus proyectos se guardan de forma segura en la nube usando Supabase.
                    </p>
                </form>
            </div>
        </div>
    );
};
