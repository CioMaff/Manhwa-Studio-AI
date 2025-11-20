
import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generateCharacterSheetView } from '../services/geminiService';
import { showToast } from '../systems/uiSystem';
import { Loader } from './Loader';

interface CharacterSheetGeneratorProps {
  baseImage: string;
  onFinalize: (sheetImage: string) => void;
  onCancel: () => void;
}

const sheetSlots = [
  { id: 'front', label: 'FRENTE', className: 'col-span-2 row-span-4' },
  { id: 'side', label: 'LADO', className: 'col-span-2 row-span-4' },
  { id: 't_pose', label: 'T POSE', className: 'col-span-1 row-span-2' },
  { id: 'accessories', label: 'ACCESORIOS', className: 'col-span-1 row-span-2' },
  { id: 'face', label: 'CARA', className: 'col-span-2 row-span-2' },
];

// FIX: Removed React.FC type to correctly type a component using React.forwardRef, which allows the 'ref' prop to be passed.
const CharacterSheetTemplate = React.forwardRef<HTMLDivElement, { generatedImages: Record<string, string | null>, isLoadingSlot: (id: string) => boolean; }>((props, ref) => (
    <div ref={ref} className="grid grid-cols-6 grid-rows-4 gap-4 p-4 bg-white rounded-lg aspect-[16/9]">
        {sheetSlots.map(slot => (
          <div key={slot.id} className={`${slot.className} rounded-md flex flex-col p-1`}>
            <p className="text-xs font-bold text-black text-left mb-1 uppercase">{slot.label}</p>
            <div className="flex-grow w-full h-0 min-h-0 rounded-sm flex items-center justify-center overflow-hidden border-2 border-gray-200">
                {props.isLoadingSlot(slot.id) && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>}
                {props.generatedImages[slot.id] && 
                    <img src={props.generatedImages[slot.id]!} alt={slot.label} className="w-full h-full object-contain" />
                }
            </div>
          </div>
        ))}
      </div>
));
CharacterSheetTemplate.displayName = 'CharacterSheetTemplate';


export const CharacterSheetGenerator: React.FC<CharacterSheetGeneratorProps> = ({ baseImage, onFinalize, onCancel }) => {
  const [generatedImages, setGeneratedImages] = useState<Record<string, string | null>>({
    front: null, side: null, t_pose: null, face: null, accessories: null,
  });
  const [loadingSlots, setLoadingSlots] = useState<string[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);
  
  const isGenerating = loadingSlots.length > 0;

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setLoadingSlots(sheetSlots.map(s => s.id));
    showToast("Generating character sheet views... This may take a few moments.", 'info');

    const generationPromises = sheetSlots.map(async (slot) => {
      try {
        const viewType = slot.id as 'front' | 'side' | 't_pose' | 'face' | 'accessories';
        const imageUrl = await generateCharacterSheetView(baseImage, viewType);
        setGeneratedImages(prev => ({ ...prev, [slot.id]: imageUrl }));
      } catch (error) {
        console.error(`Failed to generate '${slot.label}' view:`, error);
        showToast(`Failed to generate '${slot.label}' view.`, 'error');
      } finally {
        setLoadingSlots(prev => prev.filter(id => id !== slot.id));
      }
    });
      
    await Promise.all(generationPromises);
    showToast("Character sheet generation complete!", 'success');
  };

  const handleFinalize = async () => {
    if (!sheetRef.current) {
        showToast("Error capturing sheet.", 'error');
        return;
    }
    setLoadingSlots(['finalizing']); // Use loading state for feedback
    try {
        const canvas = await html2canvas(sheetRef.current, {
            backgroundColor: '#ffffff',
            scale: 2, // Higher resolution capture
        });
        const finalImage = canvas.toDataURL('image/png');
        onFinalize(finalImage);
    } catch (error) {
        console.error("Failed to finalize character sheet:", error);
        showToast("Could not finalize sheet.", 'error');
    } finally {
        setLoadingSlots([]);
    }
  };
  
  const allImagesGenerated = Object.values(generatedImages).every(img => img !== null);

  return (
    <div className="space-y-4">
      {isGenerating && <Loader message="Generating AI Views..." />}
      <p className="text-sm text-gray-400 text-center">AI is generating all 5 views for your character sheet based on the reference. You can then finalize it into a single image.</p>
      
       <CharacterSheetTemplate 
          ref={sheetRef}
          generatedImages={generatedImages}
          isLoadingSlot={(id) => loadingSlots.includes(id) && !generatedImages[id]}
       />

      <div className="flex justify-between items-center pt-4 border-t border-gray-700">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">
          Back to Editor
        </button>
        <div className="flex gap-4">
            <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {isGenerating ? 'Generating...' : 'Regenerate All'}
            </button>
            <button onClick={handleFinalize} disabled={!allImagesGenerated || isGenerating} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                {loadingSlots.includes('finalizing') ? 'Finalizing...' : 'Finalize Sheet'}
            </button>
        </div>
      </div>
    </div>
  );
};