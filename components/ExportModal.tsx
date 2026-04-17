
import React from 'react';
import { Modal } from './Modal';
import { ImageIcon } from './icons/ImageIcon';
import { PdfIcon } from './icons/PdfIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportWebtoon: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  isProcessing: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExportWebtoon, onExportPDF, onExportJSON, isProcessing }) => {
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exportar Capítulo" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <p className="text-gray-400 text-sm">
            Selecciona el formato en el que deseas descargar tu capítulo. 
            {isProcessing && <span className="text-violet-400 font-bold ml-2 animate-pulse"> Procesando exportación... por favor espera.</span>}
        </p>

        <div className="grid grid-cols-1 gap-4">
            {/* Opción Webtoon */}
            <button 
                onClick={onExportWebtoon} 
                disabled={isProcessing}
                className="flex items-center p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-violet-500 rounded-xl transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="p-3 bg-violet-500/20 rounded-lg text-violet-400 mr-4 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                    <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-violet-300">Tira Webtoon (Vertical)</h3>
                    <p className="text-sm text-gray-400">Une todas las viñetas en una sola imagen larga (JPG). Ideal para subir a Webtoon o Tapas.</p>
                </div>
            </button>

            {/* Opción PDF */}
            <button 
                onClick={onExportPDF} 
                disabled={isProcessing}
                className="flex items-center p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-red-500 rounded-xl transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="p-3 bg-red-500/20 rounded-lg text-red-400 mr-4 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <PdfIcon className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-red-300">Documento PDF</h3>
                    <p className="text-sm text-gray-400">Genera un archivo PDF paginado. Ideal para imprimir, compartir por email o leer como libro.</p>
                </div>
            </button>

             {/* Opción JSON/Backup */}
             <button 
                onClick={onExportJSON} 
                disabled={isProcessing}
                className="flex items-center p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-cyan-500 rounded-xl transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="p-3 bg-cyan-500/20 rounded-lg text-cyan-400 mr-4 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                    <DownloadIcon className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">Archivo de Proyecto (Backup)</h3>
                    <p className="text-sm text-gray-400">Descarga los datos crudos del proyecto para importarlo más tarde. (Solo datos, imágenes referenciadas).</p>
                </div>
            </button>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/5">
             <button onClick={onClose} disabled={isProcessing} className="text-sm text-gray-400 hover:text-white px-4 py-2">Cancelar</button>
        </div>
      </div>
    </Modal>
  );
};
