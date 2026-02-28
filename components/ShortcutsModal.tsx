
import React from 'react';
import Modal from './Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'Alt + 1', action: 'Go to Facility Dashboard' },
    { key: 'Alt + 2', action: 'Go to Unit Census' },
    { key: 'Alt + 3', action: 'Go to Clinical Tasks' },
    { key: 'Alt + 4', action: 'Go to Unit Stock' },
    { key: 'Alt + 5', action: 'Go to Unit Mortality' },
    { key: 'Alt + 6', action: 'Go to Clinical Incident' },
    { key: 'Alt + 7', action: 'Go to Endoscopy Logs (Admins Only)' },
    { key: 'Alt + N', action: 'New Admission / Add Stock / Log Procedure' },
    { key: 'Alt + S', action: 'Focus Search Bar' },
    { key: 'Alt + E', action: 'Open Export Modal' },
    { key: 'Alt + H', action: 'Show Keyboard Shortcuts' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Use these shortcuts to navigate and perform actions faster.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{s.action}</span>
              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-red-600 shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
};

export default ShortcutsModal;
