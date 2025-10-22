
import React from 'react';
import type { ContextPillItem } from '../types';

interface ContextPillProps {
  item: ContextPillItem;
  onRemove: (id: string) => void;
}

export const ContextPill: React.FC<ContextPillProps> = ({ item, onRemove }) => {
  const getPillColor = () => {
    switch (item.type) {
      case 'character': return 'bg-blue-500/30 text-blue-300 border-blue-500';
      case 'style': return 'bg-green-500/30 text-green-300 border-green-500';
      case 'dialogue': return 'bg-yellow-500/30 text-yellow-300 border-yellow-500';
      case 'knowledge': return 'bg-gray-500/30 text-gray-300 border-gray-500';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getPillColor()}`}>
      <span className="truncate max-w-[100px]">{item.name}</span>
      <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-white">
        &times;
      </button>
    </div>
  );
};