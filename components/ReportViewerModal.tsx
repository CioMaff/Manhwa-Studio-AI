import React from 'react';
import { Modal } from './Modal';
import { DownloadIcon } from './icons/DownloadIcon';
import type { LiveTranscriptEntry } from '../types';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportContent: string;
  transcripts: LiveTranscriptEntry[];
}

const ReportContent: React.FC<{ content: string; transcripts: LiveTranscriptEntry[] }> = ({ content, transcripts }) => {
    // Split by the timestamp placeholder, but keep the delimiter
    const parts = content.split(/(\[\d+\])/g);

    const renderMarkdownLine = (line: string, lineIndex: number) => {
        if (line.trim() === '---') {
            return <hr key={lineIndex} className="border-gray-600 my-4" />;
        }
        if (line.startsWith('#### ')) {
             return <h4 key={lineIndex} className="text-md font-bold text-purple-300 mt-4">{line.substring(5)}</h4>;
        }
        if (line.startsWith('### ')) {
            return <h3 key={lineIndex} className="text-lg font-bold text-purple-300 mt-4">{line.substring(4)}</h3>;
        }
        if (line.startsWith('## ')) {
            return <h2 key={lineIndex} className="text-xl font-bold text-cyan-300 border-b border-cyan-500/30 pb-1 mt-6">{line.substring(3)}</h2>;
        }
        if (line.startsWith('# ')) {
            return <h1 key={lineIndex} className="text-2xl font-bold mb-2">{line.substring(2)}</h1>;
        }
        if (line.startsWith('* ')) {
            const boldRegex = /\*\*(.*?)\*\*:/g;
            const formattedLine = line.substring(2).replace(boldRegex, '<strong class="text-gray-100">$1:</strong>');
            return <li key={lineIndex} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        }
        return <p key={lineIndex} className="my-2">{line}</p>;
    }

    return (
        <div className="prose prose-invert prose-sm max-w-none">
            {parts.map((part, index) => {
                const match = part.match(/\[(\d+)\]/);
                if (match) {
                    const timestamp = parseInt(match[1], 10);
                    const entry = transcripts.find(t => t.timestamp === timestamp);
                    if (entry && entry.image) {
                        return (
                            <div key={index} className="my-4">
                                <p className="text-xs text-gray-400 italic">Evidencia Visual (Captura de pantalla):</p>
                                <img src={entry.image} alt={`Screenshot at ${timestamp}`} className="rounded-md border border-gray-600 max-w-full" />
                            </div>
                        );
                    }
                    // If no image is found, render the placeholder text for debugging
                    return <span key={index} className="text-yellow-500 bg-yellow-900/50 p-1 rounded-sm text-xs font-mono">{`[No se encontró imagen para ${timestamp}]`}</span>;
                }

                const lines = part.split('\n');
                return <React.Fragment key={index}>{lines.map(renderMarkdownLine)}</React.Fragment>;
            })}
        </div>
    );
};

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({ isOpen, onClose, reportContent, transcripts }) => {

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Manhwa Studio Bug Report</title>');
            printWindow.document.write('<style>body { font-family: sans-serif; background-color: #111827; color: #D1D5DB; line-height: 1.6; } h1, h2, h3, h4, strong { color: #fff; } h2 { border-bottom: 1px solid #4B5563; padding-bottom: 5px; margin-top: 2em; } h3 { color: #A78BFA; margin-top: 1.5em; } h4 { color: #67E8F9; } code { background-color: #374151; padding: 2px 4px; border-radius: 4px; font-family: monospace; } ul { padding-left: 20px; } li { margin-bottom: 0.5em; } img { max-width: 90%; border: 1px solid #4B5563; border-radius: 8px; margin-top: 1em; } </style>');
            printWindow.document.write('</head><body>');
            const reportElement = document.getElementById('report-content');
            if (reportElement) {
                printWindow.document.write(reportElement.innerHTML);
            }
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generated Bug Report" maxWidth="max-w-4xl">
            <div className="max-h-[75vh] flex flex-col">
                <div id="report-content" className="flex-grow overflow-y-auto bg-gray-900/50 p-4 rounded-md border border-gray-700">
                    <ReportContent content={reportContent} transcripts={transcripts} />
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t border-gray-700">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        <DownloadIcon className="w-4 h-4" />
                        Print to PDF
                    </button>
                </div>
            </div>
        </Modal>
    );
};