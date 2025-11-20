import React, { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { generateAppStatusReport } from '../services/geminiService';
import { showToast } from '../systems/uiSystem';
import { Modal } from './Modal';
import { Loader } from './Loader';

const userRequestHistory = `
- Implementar Nano Banana Pro (Gemini 3.0) reemplazando al normal.
- Fix: Style References deben aplicar solo el estilo, NO copiar contenido.
- Fix: Mejorar calidad de viñeta y aspect ratio exacto.
- New Feature: Opcion de la "flechita" (Continuidad) rediseñada como herramienta de Director.
`;

const implementationSummary = `
- v1.9.5 (Director's Cut Update):
- **Strict Style Constraints**: Se ha implementado un "Negative Prompting" forzoso en el motor. Ahora, cuando usas una referencia de estilo, Gemini 3.0 recibe la orden explícita de copiar *solo* la técnica (línea, color), ignorando personajes y objetos de la referencia.
- **Pixel-Perfect Aspect Ratio**: El sistema ahora calcula la proporción matemática exacta del contenedor de la viñeta y la asigna al ratio nativo más cercano soportado por el modelo Pro (1:1, 4:3, 3:4, 16:9, 9:16), garantizando que la imagen encaje perfectamente sin deformarse.
- **Nueva Herramienta "Continuar Escena"**: El botón de la flecha ahora abre una **Consola de Director**. Permite ver la viñeta anterior, elegir el layout de la siguiente, escribir qué sucede a continuación y activar un modo de "Consistencia Estricta" que usa la viñeta anterior como ancla visual.
- **Resolución 2K Nativa**: Se fuerza \`imageSize: '2K'\` en todas las generaciones de viñetas.
`;

const BoldRenderer: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <>
            {lines.map((line, lineIndex) => (
                <p key={lineIndex} className="mb-2 whitespace-pre-wrap">
                    {line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, partIndex) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith('`') && part.endsWith('`')) {
                            return <code key={partIndex} className="bg-gray-900/50 text-purple-300 text-xs p-1 rounded-md">{part.slice(1, -1)}</code>;
                        }
                        return part;
                    })}
                </p>
            ))}
        </>
    );
};


export const NanoReport: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setIsModalOpen(true);
        setReport(null);
        try {
            const generatedReport = await generateAppStatusReport(userRequestHistory, implementationSummary);
            setReport(generatedReport);
        } catch (error) {
            console.error("Failed to generate report:", error);
            showToast("Could not generate Nano's report.", "error");
            setIsModalOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h2 className="text-xl font-bold text-gray-200 mb-2">Nano's Report</h2>
            <p className="text-sm text-gray-400 mb-4">
                Pide a Nano Banana Pro un análisis del estado actual de la aplicación, los errores conocidos y el progreso de tus peticiones.
            </p>
            <button
                onClick={handleGenerateReport}
                className="w-full bg-cyan-600 text-white font-bold py-2 rounded-md hover:bg-cyan-700 transition-colors"
            >
                Generar Informe
            </button>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Informe de Estado de Nano Pro" maxWidth="max-w-3xl">
                {isLoading && <Loader message="Nano Banana Pro está analizando el sistema..." />}
                {report && (
                    <div className="text-gray-300 max-h-[70vh] overflow-y-auto pr-2">
                       <BoldRenderer text={report} />
                    </div>
                )}
            </Modal>
        </div>
    );
};