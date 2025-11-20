import React from 'react';
import { Modal } from './Modal';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeatureItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <li className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-1 text-xl">✨</span>
        <div>
            <h4 className="font-semibold text-purple-300">{title}</h4>
            <p className="text-gray-400 text-sm">{children}</p>
        </div>
    </li>
);

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🚀 ¡Actualización Masiva: Nano Banana Pro 1.9!" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <p className="text-gray-300 text-lg font-medium border-b border-gray-700 pb-4">
          ¡Hemos integrado oficialmente el motor Gemini 3.0 Pro (Nano Banana Pro)! La IA ahora es más inteligente y consistente que nunca.
        </p>
        <ul className="space-y-4">
            <FeatureItem title="🧠 Nano Conciencia (Narrative Memory)">
                Nano Banana Pro ahora "recuerda" lo que pasó en viñetas anteriores. Entiende la continuidad de la acción, la posición de los personajes y el flujo de la historia sin que tengas que repetirlo en cada prompt.
            </FeatureItem>
            <FeatureItem title="🦍 Motor Gemini 3.0 Pro">
                Todas las generaciones (imágenes, texto, agentes) ahora utilizan los modelos Gemini 3.0 Pro. Esto significa mejor calidad de imagen, mejor razonamiento y resoluciones 2K por defecto.
            </FeatureItem>
             <FeatureItem title="🎨 Assets Predeterminados Robustos">
                Hemos añadido estilos predeterminados (Solo Leveling, Omniscient Reader) y fondos corregidos para que puedas empezar a crear al instante sin errores de generación.
            </FeatureItem>
            <FeatureItem title="🛠️ Corrección de 'Generation Failed'">
                Solucionado el problema crítico donde las imágenes de referencia en formato SVG causaban fallos en la API. Ahora el sistema utiliza formatos compatibles universalmente.
            </FeatureItem>
        </ul>
        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-6 py-2 font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:opacity-90 transform transition hover:scale-105 shadow-lg"
          >
            ¡Entendido! Probar Nano Pro 🦍
          </button>
        </div>
      </div>
    </Modal>
  );
};