import React, { useState, memo } from 'react';
import Modal from './Modal';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PasswordInputProps {
  label: string;
  value: string;
  setValue: (v: string) => void;
  show: boolean;
  setShow: (s: boolean) => void;
  placeholder: string;
  disabled: boolean;
  id: string;
}

// Optimization: Defined outside parent and memoized to prevent focus loss on mobile re-renders
const PasswordInput = memo(({ 
  label, 
  value, 
  setValue, 
  show, 
  setShow, 
  placeholder,
  disabled,
  id
}: PasswordInputProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        required
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-400 outline-none transition-all text-sm font-medium bg-slate-50/50 pr-12"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
        tabIndex={-1}
      >
        {show ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </div>
  </div>
));

PasswordInput.displayName = 'PasswordInput';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { currentUser } = useAuth();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setMessage({ text: "Session Expired: Please log in again to update credentials.", type: 'error' });
      return;
    }
    
    setMessage(null);

    if (!currentPassword) {
      setMessage({ text: "Verification Required: Current password field is empty.", type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: "Protocol Violation: New password must be at least 6 characters long.", type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: "Verification Error: Confirmation password does not match.", type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await authService.updateUserPassword(currentPassword, newPassword);
      
      setMessage({ text: "Security credentials successfully updated.", type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 2500);
    } catch (error: any) {
      setMessage({ text: error.message || "Failed to finalize security update.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Security Terminal">
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Personnel Account</p>
            <p className="text-sm font-bold text-slate-800">{currentUser?.email || 'N/A'}</p>
          </div>
          <div className="p-2 bg-slate-200 text-slate-500 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2 border shadow-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              {message.text}
            </div>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          <PasswordInput 
            key="current-password-field"
            id="current-credential"
            label="Current Access Credential"
            value={currentPassword}
            setValue={setCurrentPassword}
            show={showCurrent}
            setShow={setShowCurrent}
            placeholder="Verify current password"
            disabled={loading}
          />

          <div className="h-px bg-slate-100 my-2" />

          <PasswordInput 
            key="new-password-field"
            id="new-credential"
            label="New Access Credential"
            value={newPassword}
            setValue={setNewPassword}
            show={showNew}
            setShow={setShowNew}
            placeholder="New (Min 6 chars)"
            disabled={loading}
          />

          <PasswordInput 
            key="confirm-password-field"
            id="confirm-credential"
            label="Verify New Credential"
            value={confirmPassword}
            setValue={setConfirmPassword}
            show={showConfirm}
            setShow={setShowConfirm}
            placeholder="Confirm new password"
            disabled={loading}
          />

          <div className="pt-3">
            <button
              type="submit"
              disabled={isButtonDisabled}
              className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                isButtonDisabled 
                  ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                  : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Updating Security...
                </>
              ) : (
                'Finalize Security Update'
              )}
            </button>
          </div>
        </form>
        
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
          <p className="text-center text-[9px] text-amber-700 font-bold uppercase tracking-widest leading-relaxed">
            CRITICAL: Updating your password will invalidate existing sessions on other clinical terminals. Ensure you have memorized your new credentials before proceeding.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;