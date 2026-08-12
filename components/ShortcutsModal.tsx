
import React from 'react';
import Modal from './Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcutGroups = [
    {
      category: 'Quick Actions',
      items: [
        { key: 'Alt + E', action: 'Export Master CSV (Filtered by Unit & Year)' },
        { key: 'Alt + P', action: 'Print Active View / Clinical Report' },
        { key: 'Alt + N', action: 'New Admission / Add Stock / Log Procedure' },
        { key: 'Alt + S', action: 'Focus Search Bar / Advanced Search' },
        { key: 'Alt + H', action: 'Open Keyboard Shortcuts Help' },
        { key: 'Esc', action: 'Close Active Modal or Overlay' },
      ]
    },
    {
      category: 'Tab Navigation',
      items: [
        { key: 'Alt + 1', action: 'Go to Facility Dashboard' },
        { key: 'Alt + 2', action: 'Go to In-Patient Census' },
        { key: 'Alt + 3', action: 'Go to Clinical Tasks' },
        { key: 'Alt + 4', action: 'Go to Inventory & Stock' },
        { key: 'Alt + 5', action: 'Go to Mortality Records' },
        { key: 'Alt + 6', action: 'Go to Safety Incidents' },
        { key: 'Alt + 7', action: 'Go to Endoscopy Reporting' },
        { key: 'Alt + 8', action: 'Go to Endoscopy Logs' },
      ]
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts Reference">
      <div className="space-y-5">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Boost your productivity using system-wide keyboard shortcuts across any view:
        </p>

        {shortcutGroups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
              {group.category}
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {group.items.map((s, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {s.action}
                  </span>
                  <kbd className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold font-mono text-red-600 dark:text-red-400 shadow-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button 
          onClick={onClose}
          className="w-full mt-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all active:scale-95 shadow-md cursor-pointer"
        >
          Close Help
        </button>
      </div>
    </Modal>
  );
};

export default ShortcutsModal;
