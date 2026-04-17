
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import type { Settings } from '../types';
import { checkSupabaseConnection } from '../utils/supabaseClient';
import { CopyIcon } from './icons/CopyIcon';
import { showToast } from '../systems/uiSystem';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: Settings;
  onSave: (newSettings: Settings) => void;
}

const TABLE_SQL = `
create table if not exists public.projects (
    id text primary key,
    user_id text not null,
    title text,
    data jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.projects enable row level security;
create policy "Public Access" on public.projects for all using (true) with check (true);
`;

const PROJECT_ID = 'rkvjtxpngizairgzykez';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'cloud'>('general');
  const [settings, setSettings] = useState<Settings>(currentSettings);
  
  const [dbStatus, setDbStatus] = useState<'idle' | 'checking' | 'ok' | 'error' | 'missing_table'>('idle');
  const [dbMessage, setDbMessage] = useState('');

  useEffect(() => {
    setSettings(currentSettings);
    if (isOpen) {
        checkConnection();
    }
  }, [currentSettings, isOpen]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleChange = (field: keyof Settings, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSettings(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const checkConnection = async () => {
      setDbStatus('checking');
      const result = await checkSupabaseConnection();
      setDbStatus(result.status);
      setDbMessage(result.message || '');
  };

  const copySQL = () => {
      navigator.clipboard.writeText(TABLE_SQL);
      showToast("SQL copiado", "success");
  };

  const openSupabaseSQL = () => {
      window.open(`https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustes de Estudio">
      <div className="flex border-b border-gray-700 mb-6">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'text-violet-400 border-violet-500' : 'text-gray-400 border-transparent'}`}>General</button>
          <button onClick={() => setActiveTab('cloud')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cloud' ? 'text-violet-400 border-violet-500' : 'text-gray-400 border-transparent'}`}>
              Base de Datos {dbStatus === 'missing_table' && '⚠️'}
          </button>
      </div>

      <div className="space-y-6 min-h-[300px]">
        {activeTab === 'general' && (
            <>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ancho de Página ({settings.pageWidth}px)</label>
                    <input type="range" min="600" max="1200" step="20" value={settings.pageWidth} onChange={(e) => handleChange('pageWidth', e.target.value)} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Espaciado ({settings.panelSpacing}px)</label>
                    <input type="range" min="0" max="40" step="2" value={settings.panelSpacing} onChange={(e) => handleChange('panelSpacing', e.target.value)} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                </div>
            </>
        )}

        {activeTab === 'cloud' && (
            <div className="space-y-4">
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Estado Supabase (Manhwa AI)</h3>
                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5 mb-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${dbStatus === 'ok' ? 'bg-green-500 shadow-[0_0_10px_lime]' : dbStatus === 'error' || dbStatus === 'missing_table' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            <span className="text-sm font-mono text-gray-300">
                                {dbStatus === 'checking' ? 'Conectando...' : dbMessage}
                            </span>
                        </div>
                        <button onClick={checkConnection} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold">Probar</button>
                    </div>
                </div>

                {(dbStatus === 'missing_table' || dbStatus === 'error') && (
                    <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-blue-300 mb-2">⚠️ Configuración Requerida</h3>
                        <p className="text-xs text-gray-400 mb-3">
                            La base de datos está conectada pero falta la tabla. Haz clic abajo para ir a Supabase y pegar el código SQL.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={copySQL} className="flex-1 py-2 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-lg hover:bg-blue-500/30 flex items-center justify-center gap-2"><CopyIcon className="w-4 h-4"/> Copiar SQL</button>
                            <button onClick={openSupabaseSQL} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 flex items-center justify-center gap-2">Ir a Supabase 🚀</button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
      
      <div className="flex justify-end pt-4 border-t border-gray-700 mt-6 gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cerrar</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700">Guardar</button>
      </div>
    </Modal>
  );
};
