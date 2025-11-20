import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { TrashIcon } from './icons/TrashIcon';
import type { KnowledgeFile } from '../types';
import { showConfirmation } from '../systems/uiSystem';

interface StoryEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeFile: KnowledgeFile | Omit<KnowledgeFile, 'id'>;
  onSave: (asset: KnowledgeFile | Omit<KnowledgeFile, 'id'>) => void;
  onDelete: (id: string) => void;
}

export const StoryEditorModal: React.FC<StoryEditorModalProps> = ({ isOpen, onClose, knowledgeFile, onSave, onDelete }) => {
  const [asset, setAsset] = useState(knowledgeFile);
  const isCreating = !('id' in knowledgeFile) || !knowledgeFile.id;

  useEffect(() => {
    setAsset(knowledgeFile);
  }, [knowledgeFile, isOpen]);

  const handleSave = () => {
    onSave(asset);
  };

  const handleDelete = async () => {
    if (isCreating || !('id' in asset)) return;
    const confirmed = await showConfirmation({
      title: 'Delete Knowledge File',
      message: `Are you sure you want to delete "${asset.name}"? This cannot be undone.`,
    });
    if (confirmed) {
      onDelete(asset.id);
    }
  };
  
  const title = isCreating ? "Create New Knowledge File" : `Edit ${asset.name}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={asset.name}
            onChange={(e) => setAsset(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 bg-gray-900 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Content</label>
          <textarea
            value={asset.content}
            onChange={(e) => setAsset(prev => ({ ...prev, content: e.target.value }))}
            className="w-full p-2 bg-gray-900 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 h-96 font-mono text-sm"
            placeholder="Write your story, dialogues, or scene descriptions here..."
          />
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <button
            onClick={handleDelete}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-900/50 rounded-md hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              {isCreating ? 'Create File' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
