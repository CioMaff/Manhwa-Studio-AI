import React from 'react';
import { Modal } from './Modal';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, imageUrl }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Image Viewer" maxWidth="max-w-4xl">
      <div className="bg-gray-900 p-4 rounded-lg">
        <img src={imageUrl} alt="Full size view" className="max-h-[80vh] w-auto mx-auto object-contain" />
      </div>
    </Modal>
  );
};