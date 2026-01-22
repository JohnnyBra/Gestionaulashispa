import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  const [show, setShow] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShow(true);
    else setTimeout(() => setShow(false), 300); // Wait for animation
  }, [isOpen]);

  if (!show) return null;

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case '2xl': return 'max-w-2xl';
      case 'full': return 'w-[95vw] max-w-none h-[90vh]';
      default: return 'max-w-lg';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
      {/* Container to center the modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
          aria-hidden="true" 
          onClick={onClose}
        ></div>

        {/* Modal Content */}
        <div className={`relative bg-white rounded-2xl text-left shadow-2xl transform transition-all w-full flex flex-col ${getSizeClass()} ${isOpen ? 'scale-100' : 'scale-95'}`}>
          <div className="flex-none px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {children}
          </div>
        </div>
      </div>
    </div>
  );
};
