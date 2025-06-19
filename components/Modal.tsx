
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void; // Optional: if modal can be closed by backdrop click or escape key
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div 
        className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4"
        onClick={onClose} // Close on backdrop click
    >
      <div
        className={`bg-white rounded-2xl p-5 sm:p-6 shadow-xl w-full ${sizeClasses[size]} transform transition-all duration-300 ease-modal-ease scale-100 opacity-100`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {title && (
          <h2 className="text-2xl font-black text-center text-sky-600 mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
