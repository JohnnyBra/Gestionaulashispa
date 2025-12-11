import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [show, setShow] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShow(true);
    else setTimeout(() => setShow(false), 300); // Wait for animation
  }, [isOpen]);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
          aria-hidden="true" 
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal Content */}
        <div className={`inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
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
            <div className="mt-2">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};