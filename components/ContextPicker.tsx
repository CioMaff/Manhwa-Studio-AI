import React from 'react';

// Using a generic type to handle different item structures
interface Item {
  id: string;
  name: string;
  [key: string]: any; // Allow other properties
}

interface ContextPickerProps {
    items: Item[];
    onSelect: (item: Item) => void;
    onClose: () => void;
}

export const ContextPicker: React.FC<ContextPickerProps> = ({ items, onSelect, onClose }) => {
    if (items.length === 0) {
        return (
            <div className="absolute bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg p-2 text-center text-sm text-gray-400">
                No items to select.
            </div>
        )
    }
    return (
        <div className="absolute bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
            <ul className="divide-y divide-gray-700">
                {items.map(item => (
                    <li key={item.id} onClick={() => onSelect(item)} className="p-2 text-sm hover:bg-purple-500/20 cursor-pointer truncate">
                        {item.name}
                    </li>
                ))}
            </ul>
        </div>
    );
};