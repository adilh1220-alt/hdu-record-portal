import React from 'react';
import Modal from './Modal';
import EmailConnectionDiagnostic from './EmailConnectionDiagnostic';

interface EmailConnectionDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSmtpConfig?: () => void;
}

export const EmailConnectionDiagnosticModal: React.FC<EmailConnectionDiagnosticModalProps> = ({
  isOpen,
  onClose,
  onOpenSmtpConfig
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Connection Diagnostics & SMTP Health">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <EmailConnectionDiagnostic 
          onOpenSmtpConfig={() => {
            onClose();
            if (onOpenSmtpConfig) onOpenSmtpConfig();
          }} 
        />
      </div>
    </Modal>
  );
};

export default EmailConnectionDiagnosticModal;
