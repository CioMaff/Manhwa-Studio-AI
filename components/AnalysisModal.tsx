
import React from 'react';
import { Modal } from './Modal';

interface AnalysisResult {
    score: number;
    issues: string[];
    advice: string;
    fixed: boolean;
}

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, imageUrl, analysis, isAnalyzing }) => {
  
  const getScoreColor = (score: number) => {
      if (score >= 9) return 'text-green-400';
      if (score >= 7) return 'text-yellow-400';
      return 'text-red-400';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análisis de Calidad (Director Mode)" maxWidth="max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Preview */}
        <div className="rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center h-[50vh]">
            <img src={imageUrl} alt="To Analyze" className="max-w-full max-h-full object-contain" />
        </div>

        {/* Report Section */}
        <div className="flex flex-col h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-16 h-16 border-4 border-t-cyan-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
                    <p className="text-cyan-400 font-mono text-sm animate-pulse">Analizando composición, anatomía e iluminación...</p>
                </div>
            ) : analysis ? (
                <div className="space-y-6">
                    {/* Score Card */}
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Puntuación General</p>
                        <div className={`text-6xl font-black ${getScoreColor(analysis.score)}`}>
                            {analysis.score}<span className="text-2xl text-gray-600">/10</span>
                        </div>
                    </div>

                    {/* Verdict */}
                    <div className={`p-4 rounded-xl border-l-4 ${analysis.fixed ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                        <h4 className={`font-bold ${analysis.fixed ? 'text-green-400' : 'text-red-400'} mb-1`}>
                            {analysis.fixed ? '✅ APROBADO' : '❌ REQUIERE ATENCIÓN'}
                        </h4>
                        <p className="text-sm text-gray-300">{analysis.advice}</p>
                    </div>

                    {/* Issues List */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Problemas Detectados</h4>
                        {analysis.issues.length > 0 ? (
                            <ul className="space-y-2">
                                {analysis.issues.map((issue, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                        <span className="text-red-400 mt-0.5">⚠️</span>
                                        <span className="text-gray-300">{issue}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No se detectaron problemas críticos.</p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    Error al cargar el análisis.
                </div>
            )}
        </div>
      </div>
    </Modal>
  );
};
