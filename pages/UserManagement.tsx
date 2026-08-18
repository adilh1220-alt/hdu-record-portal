
import React, { useEffect, useState, useMemo } from 'react';
import { AuthUser, AuditLog } from '../types';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { exportAccessSlipPDF } from '../services/pdfService';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { TableSkeleton, LoadingSpinner } from '../components/LoadingSpinner';
import { 
  Share2, 
  Download, 
  Copy, 
  Check, 
  CheckCircle2, 
  MessageSquare, 
  Mail, 
  FileText, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Send, 
  Printer, 
  Sparkles,
  Lock,
  Smartphone
} from 'lucide-react';

type SortDirection = 'asc' | 'desc';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [userSortConfig, setUserSortConfig] = useState<{ key: keyof AuthUser; direction: SortDirection }>({
    key: 'displayName',
    direction: 'asc'
  });
  
  const [logSortConfig, setLogSortConfig] = useState<{ key: keyof AuditLog; direction: SortDirection }>({
    key: 'timestamp',
    direction: 'desc'
  });

  const [logActionFilter, setLogActionFilter] = useState('ALL');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [maxLogs, setMaxLogs] = useState(50);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Consultant' | 'Staff'>('Staff');
  const [newAssignedUnit, setNewAssignedUnit] = useState<string>('');

  const [lastRegisteredUser, setLastRegisteredUser] = useState<{name: string, email: string, password?: string, role: string, assignedUnit?: string} | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedField, setCopiedField] = useState<'password' | 'all' | 'link' | 'txt' | null>(null);
  const [showDirectShareMenu, setShowDirectShareMenu] = useState(false);

  // Confirmation states
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [pendingUpdateUser, setPendingUpdateUser] = useState<AuthUser | null>(null);
  const [isDeactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [pendingDeactivateUid, setPendingDeactivateUid] = useState<string | null>(null);
  const [isActivateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [pendingActivateUid, setPendingActivateUid] = useState<string | null>(null);

  const { currentUser } = useAuth();

  useEffect(() => {
    loadData();
  }, [maxLogs]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [userData, logData] = await Promise.all([
        userService.getAllUsers(),
        userService.getAuditLogs(maxLogs)
      ]);
      setUsers(userData);
      setLogs(logData);
    } catch (error) {
      setMessage({ text: "Failed to load personnel data.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshLogs = async () => {
    const logData = await userService.getAuditLogs(maxLogs);
    setLogs(logData);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) {
      setMessage({ text: "Please fill in Name and Email fields.", type: 'error' });
      return;
    }

    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();

    try {
      setCreating(true);
      setMessage(null);
      
      await userService.adminCreateUser(newEmail, tempPassword, newName, newRole, newAssignedUnit || undefined);
      const userData = { name: newName, email: newEmail, password: tempPassword, role: newRole, assignedUnit: newAssignedUnit };
      exportAccessSlipPDF(userData);
      setLastRegisteredUser(userData);
      
      await userService.addAuditLog({
        action: 'User Registered',
        performedBy: currentUser?.displayName || 'System Admin',
        targetUser: newName,
        details: `Created account with initial role: ${newRole}. Password slip generated.`
      });

      setNewName('');
      setNewEmail('');
      setNewRole('Staff');
      setNewAssignedUnit('');
      
      setMessage({ text: `Successfully registered ${newName}. Access slip has been generated.`, type: 'success' });
      setIsSlipModalOpen(true);
      
      await loadData();
      setTimeout(() => setMessage(null), 8000);
    } catch (error: any) {
      setMessage({ text: error.message || "Critical error during user registration.", type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = (uid: string, newRole: string) => {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole as any } : u));
  };

  const handleUnitChange = (uid: string, newUnit: string) => {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, assignedUnit: (newUnit || undefined) as any } : u));
  };

  const handleUserSort = (key: keyof AuthUser) => {
    let direction: SortDirection = 'asc';
    if (userSortConfig.key === key && userSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setUserSortConfig({ key, direction });
  };

  const handleLogSort = (key: keyof AuditLog) => {
    let direction: SortDirection = 'asc';
    if (logSortConfig.key === key && logSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setLogSortConfig({ key, direction });
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let aValue: any = a[userSortConfig.key] || '';
      let bValue: any = b[userSortConfig.key] || '';

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return userSortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return userSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, userSortConfig]);

  const sortedAndFilteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      const matchesAction = logActionFilter === 'ALL' || log.action === logActionFilter;
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);
      
      let matchesRange = true;
      if (logStartDate) {
        const start = new Date(logStartDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) matchesRange = false;
      }
      if (logEndDate) {
        const end = new Date(logEndDate);
        end.setHours(0, 0, 0, 0);
        if (logDate > end) matchesRange = false;
      }
      
      return matchesAction && matchesRange;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[logSortConfig.key] || '';
      let bValue: any = b[logSortConfig.key] || '';

      if (logSortConfig.key === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return logSortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return logSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [logs, logActionFilter, logStartDate, logEndDate, logSortConfig]);

  const SortIndicator = ({ active, direction }: { active: boolean; direction: SortDirection }) => {
    if (!active) return (
      <div className="flex flex-col ml-1 opacity-20 group-hover:opacity-100 transition-opacity shrink-0">
        <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 10 10"><path d="M5 0L0 5h10L5 0z" /></svg>
        <svg className="w-1.5 h-1.5 mt-0.5" fill="currentColor" viewBox="0 0 10 10"><path d="M5 10L0 5h10L5 10z" /></svg>
      </div>
    );
    return (
      <div className="flex flex-col ml-1 text-red-600 animate-in fade-in zoom-in duration-300 shrink-0">
        {direction === 'asc' ? (
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 10 10"><path d="M5 0L0 5h10L5 0z" /></svg>
        ) : (
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 10 10"><path d="M5 10L0 5h10L5 10z" /></svg>
        )}
      </div>
    );
  };

  const triggerUpdateFlow = (user: AuthUser) => {
    setPendingUpdateUser(user);
    setUpdateConfirmOpen(true);
  };

  const executeRoleUpdate = async () => {
    if (!pendingUpdateUser || !pendingUpdateUser.role) return;
    const user = pendingUpdateUser;
    try {
      setUpdatingId(user.uid);
      await userService.updateUserRoleAndUnit(user.uid, user.role, user.assignedUnit);
      await userService.addAuditLog({
        action: 'User Access Updated',
        performedBy: currentUser?.displayName || 'System Admin',
        targetUser: user.displayName || 'Unknown User',
        details: `Updated role: ${user.role}, Assigned Unit: ${user.assignedUnit || 'Global Access'}`
      });
      setMessage({ text: `Access level and unit permissions updated for ${user.displayName}`, type: 'success' });
      await refreshLogs();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: "Critical error during user permissions update.", type: 'error' });
    } finally {
      setUpdatingId(null);
      setPendingUpdateUser(null);
    }
  };

  const executeDeactivation = async () => {
    if (!pendingDeactivateUid) return;
    try {
      const user = users.find(u => u.uid === pendingDeactivateUid);
      await userService.deactivateUser(pendingDeactivateUid);
      await userService.addAuditLog({
        action: 'User Deactivated',
        performedBy: currentUser?.displayName || 'System Admin',
        targetUser: user?.displayName || 'Unknown User',
        details: `Account status updated to: Left (Access Revoked)`
      });
      setMessage({ text: `Staff member deactivated successfully.`, type: 'success' });
      await loadData();
    } catch (error) {
      setMessage({ text: "Failed to deactivate account.", type: 'error' });
    } finally {
      setPendingDeactivateUid(null);
    }
  };

  const executeActivation = async () => {
    if (!pendingActivateUid) return;
    try {
      const user = users.find(u => u.uid === pendingActivateUid);
      await userService.activateUser(pendingActivateUid);
      await userService.addAuditLog({
        action: 'User Activated',
        performedBy: currentUser?.displayName || 'System Admin',
        targetUser: user?.displayName || 'Unknown User',
        details: `Credential status restored to: ACTIVE SERVICE`
      });
      setMessage({ text: `Staff member account restored to Active Service.`, type: 'success' });
      await loadData();
    } catch (error) {
      setMessage({ text: "Failed to restore account access.", type: 'error' });
    } finally {
      setPendingActivateUid(null);
    }
  };

  const getCredentialsShareText = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thekidneycentre.portal';
    return `🏥 THE KIDNEY CENTRE MEDICAL RECORD SYSTEM\nStaff Access Credentials\n\n` +
      `👤 Staff Name: ${user.name}\n` +
      `📧 Login Email: ${user.email}\n` +
      `🔑 Master Key / Password: ${user.password || '******** (Previously Assigned)'}\n` +
      `🛡️ Access Role: ${user.role}\n` +
      (user.assignedUnit ? `🏢 Assigned Unit: ${user.assignedUnit}\n` : '') +
      `🌐 Portal URL: ${origin}\n\n` +
      `⚠️ Confidential Notice: Please log in and change your password upon first entry. Do not share these credentials with unauthorized staff.`;
  };

  const handleDownloadTxt = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const text = getCredentialsShareText(user);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `access_credentials_${user.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedField('txt');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleShareCredentials = async (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const shareText = getCredentialsShareText(user);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `The Kidney Centre Access Credentials - ${user.name}`,
          text: shareText,
          url: origin
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setShowDirectShareMenu(true);
        }
      }
    } else {
      setShowDirectShareMenu(prev => !prev);
    }
  };

  const handleShareWhatsApp = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const text = getCredentialsShareText(user);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareGmail = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const text = getCredentialsShareText(user);
    const subject = `The Kidney Centre Medical Records - Account Credentials for ${user.name}`;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareEmail = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const text = getCredentialsShareText(user);
    const subject = `The Kidney Centre Medical Records - Account Credentials for ${user.name}`;
    const mailtoUrl = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopyPassword = (password?: string) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedField('password');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyAll = (user: { name: string; email: string; password?: string; role: string; assignedUnit?: string }) => {
    const text = getCredentialsShareText(user);
    navigator.clipboard.writeText(text);
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const generateExistingUserSlip = (user: AuthUser) => {
    setLastRegisteredUser({
      name: user.displayName || 'STAFF',
      email: user.email || 'N/A',
      role: user.role || 'Staff',
      assignedUnit: user.assignedUnit
    });
    setIsSlipModalOpen(true);
  };

  const ACTION_TYPES = ['ALL', 'User Registered', 'Role Updated', 'User Deactivated', 'User Activated'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Personnel & Access Control</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Configure medical staff accounts and monitor administrative activity</p>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Account Registration Terminal
          </h2>
        </div>
        <form onSubmit={handleCreateUser} className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. DR. ADAM REED"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none transition-all text-[11px] font-bold uppercase"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical Email</label>
            <input
              type="email"
              required
              placeholder="personnel@hospital.org"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none transition-all text-[11px] font-bold"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Unit</label>
            <select
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none transition-all text-[11px] font-black uppercase bg-white cursor-pointer"
              value={newAssignedUnit}
              onChange={(e) => setNewAssignedUnit(e.target.value)}
            >
              <option value="">No Specific Unit</option>
              <option value="HDU">High Dependency (HDU)</option>
              <option value="ICU">Intensive Care (ICU)</option>
              <option value="TRANSPLANT">Transplant Bay</option>
              <option value="4th-WARD">Ward</option>
              <option value="WARD5">5th Floor Ward</option>
              <option value="ENDOSCOPY">Endoscopy Reporting</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none transition-all text-[11px] font-black uppercase bg-white cursor-pointer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
              >
                <option value="Staff">Staff</option>
                <option value="Consultant">Consultant</option>
                <option value="Admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={creating || !newName || !newEmail}
                className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                  creating 
                    ? 'bg-slate-100 text-slate-400 cursor-wait' 
                    : (!newName || !newEmail) 
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-lg shadow-red-100'
                }`}
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                )}
                <span>Register</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center justify-between animate-in slide-in-from-top-2 shadow-sm ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-3">
             <div className={`w-6 h-6 rounded-full flex items-center justify-center ${message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {message.type === 'success' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                )}
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Medical Staff Directory</h2>
            <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black tracking-tighter">
              FACILITY POOL: {users.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={6} cols={4} />
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">
                    <th 
                      className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleUserSort('displayName')}
                    >
                      <div className="flex items-center">
                        <span>Staff Identity</span>
                        <SortIndicator active={userSortConfig.key === 'displayName'} direction={userSortConfig.direction} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleUserSort('status')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Status</span>
                        <SortIndicator active={userSortConfig.key === 'status'} direction={userSortConfig.direction} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleUserSort('role')}
                    >
                      <div className="flex items-center">
                        <span>Role</span>
                        <SortIndicator active={userSortConfig.key === 'role'} direction={userSortConfig.direction} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => handleUserSort('assignedUnit' as any)}
                    >
                      <div className="flex items-center">
                        <span>Assigned Unit</span>
                        <SortIndicator active={userSortConfig.key === 'assignedUnit' as any} direction={userSortConfig.direction} />
                      </div>
                    </th>
                    <th className="px-6 py-5 text-right bg-slate-50">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                  {sortedUsers.map((user) => (
                    <tr key={user.uid} className={`hover:bg-slate-50/50 transition-colors group ${user.status === 'Left' ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${
                            user.status === 'Left' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {user.displayName?.[0] || '?'}
                          </div>
                          <div>
                            <p className={`font-black tracking-tight ${user.status === 'Left' ? 'text-slate-400' : 'text-slate-900'}`}>{user.displayName}</p>
                            <p className="text-[9px] text-slate-400 font-bold lowercase italic">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {user.status === 'Left' ? (
                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-[7px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase border border-red-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              DEACTIVATED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[7px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          disabled={user.status === 'Left' || (user.uid === currentUser?.uid && currentUser?.role === 'Admin')}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                          className={`text-[10px] font-black uppercase border rounded-lg px-3 py-1.5 outline-none transition-all bg-white cursor-pointer ${
                            (user.status === 'Left' || (user.uid === currentUser?.uid && currentUser?.role === 'Admin')) ? 'border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-slate-200 focus:ring-2 focus:ring-red-100 hover:border-slate-300'
                          }`}
                        >
                          <option value="Staff">Staff</option>
                          <option value="Consultant">Consultant</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.assignedUnit || ''}
                          disabled={user.status === 'Left' || (user.uid === currentUser?.uid && currentUser?.role === 'Admin')}
                          onChange={(e) => handleUnitChange(user.uid, e.target.value)}
                          className={`text-[10px] font-black uppercase border rounded-lg px-2.5 py-1.5 outline-none transition-all bg-white cursor-pointer ${
                            (user.status === 'Left' || (user.uid === currentUser?.uid && currentUser?.role === 'Admin')) 
                              ? 'border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed' 
                              : 'border-slate-200 focus:ring-2 focus:ring-red-100 hover:border-slate-300'
                          }`}
                        >
                          <option value="">No Specific Unit</option>
                          <option value="HDU">HDU</option>
                          <option value="ICU">ICU</option>
                          <option value="TRANSPLANT">Transplant Bay</option>
                          <option value="4th-WARD">Ward</option>
                          <option value="WARD5">5th Floor Ward</option>
                          <option value="ENDOSCOPY">Endoscopy Reporting</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => generateExistingUserSlip(user)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
                            title="Re-issue Credentials Slip"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                          
                          {/* Account Action Buttons */}
                          {user.status === 'Active' ? (
                            <>
                              <button
                                disabled={updatingId === user.uid || (user.uid === currentUser?.uid && currentUser?.role === 'Admin')}
                                onClick={() => triggerUpdateFlow(user)}
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                  updatingId === user.uid 
                                    ? 'bg-slate-100 text-slate-400 cursor-wait' 
                                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-md'
                                }`}
                              >
                                {updatingId === user.uid ? 'Syncing...' : 'Update'}
                              </button>
                              <button
                                disabled={user.uid === currentUser?.uid && currentUser?.role === 'Admin'}
                                onClick={() => { setPendingDeactivateUid(user.uid); setDeactivateConfirmOpen(true); }}
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-200 text-red-600 hover:bg-red-50 transition-all active:scale-95 ${
                                  (user.uid === currentUser?.uid && currentUser?.role === 'Admin') ? 'invisible' : ''
                                }`}
                                title="Deactivate Account"
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setPendingActivateUid(user.uid); setActivateConfirmOpen(true); }}
                              className="px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-100 transition-all"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Facility Audit Logs
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Limit:</label>
                <select 
                  value={maxLogs}
                  onChange={(e) => setMaxLogs(Number(e.target.value))}
                  className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded text-[8px] font-black outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <button 
                onClick={refreshLogs} 
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                title="Refresh Logs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Sort Strategy</label>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { key: 'action', label: 'By Action' },
                  { key: 'performedBy', label: 'By Actor' },
                  { key: 'timestamp', label: 'Chronological' }
                ].map(btn => (
                  <button
                    key={btn.key}
                    onClick={() => handleLogSort(btn.key as keyof AuditLog)}
                    className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tighter whitespace-nowrap transition-all border ${
                      logSortConfig.key === btn.key 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {btn.label} {logSortConfig.key === btn.key && (logSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter Action</label>
                <select 
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="w-full text-[10px] font-black uppercase p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-red-200"
                >
                  {ACTION_TYPES.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">From</label>
                <input 
                  type="date" 
                  value={logStartDate}
                  onChange={(e) => setLogStartDate(e.target.value)}
                  className="w-full text-[10px] font-bold p-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">To</label>
                <input 
                  type="date" 
                  value={logEndDate}
                  onChange={(e) => setLogEndDate(e.target.value)}
                  className="w-full text-[10px] font-bold p-1.5 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
            {sortedAndFilteredLogs.length === 0 ? (
              <div className="text-center py-20 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No matching logs.</p>
              </div>
            ) : (
              sortedAndFilteredLogs.map((log) => (
                <div key={log.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-red-100 transition-all group animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                      log.action.includes('Registered') ? 'bg-green-50 text-green-700 border-green-100' : log.action.includes('Deactivated') ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-[8px] text-slate-400 font-black uppercase">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] font-black text-slate-800 tracking-tight leading-tight">
                    {log.performedBy} <span className="font-bold text-slate-400">updated</span> {log.targetUser}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-2 font-medium leading-relaxed italic">
                    "{log.details}"
                  </p>
                  <div className="mt-3 text-[7px] text-slate-300 font-black uppercase tracking-widest flex items-center gap-1.5 border-t border-slate-50 pt-2">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
             <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">Medical Security Operations Center</p>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isSlipModalOpen} 
        onClose={() => { 
          setIsSlipModalOpen(false); 
          setLastRegisteredUser(null); 
          setShowDirectShareMenu(false);
          setCopiedField(null);
        }} 
        title="Provisioning Complete"
        maxWidth="max-w-lg"
      >
        <div className="text-center space-y-5 p-1">
          {/* Status Header Badge */}
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100/80">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 mb-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100/70 text-emerald-800 border border-emerald-200">
              Account Provisioned
            </span>
            <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Access Ready</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-bold">
              Credentials for <span className="font-black text-slate-900 dark:text-slate-100">{lastRegisteredUser?.name}</span> have been synchronized.
            </p>
          </div>
          
          {/* Credentials Display Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-left space-y-3.5 shadow-inner">
            {/* Master Key Row with Copy & Visibility Toggle */}
            <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-red-500" />
                  Master Key / Temporary Password
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(lastRegisteredUser?.password)}
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all active:scale-95"
                    title="Copy Password"
                  >
                    {copiedField === 'password' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-black">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-mono font-black text-red-600 dark:text-red-400 tracking-wider">
                  {showPassword ? (lastRegisteredUser?.password || '••••••••') : '••••••••'}
                </span>
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tight">One-time Secret</span>
              </div>
            </div>

            {/* User Meta Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Login Email</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block text-[11px]">{lastRegisteredUser?.email}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Access Role</span>
                <span className="font-black text-slate-900 dark:text-slate-100 uppercase text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {lastRegisteredUser?.role}
                </span>
              </div>
            </div>

            <p className="text-[8.5px] text-slate-400 dark:text-slate-400 font-bold italic leading-tight uppercase tracking-tighter">
              Hand this digital or physical slip directly to the registered medical personnel.
            </p>
          </div>

          {/* Primary Action Buttons: Share & Downloads */}
          <div className="space-y-3">
            {/* Primary Action: Share via Native Sheet / Apps */}
            <button
              onClick={() => lastRegisteredUser && handleShareCredentials(lastRegisteredUser)}
              className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white py-3.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Access Credentials</span>
              <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full normal-case font-medium">WhatsApp / Gmail / Mobile</span>
            </button>

            {/* Download Buttons Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => lastRegisteredUser && exportAccessSlipPDF(lastRegisteredUser)}
                className="bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 py-3 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                title="Download Official PDF Slip"
              >
                <Download className="w-4 h-4 text-red-400" />
                <span>Download PDF Slip</span>
              </button>

              <button
                onClick={() => lastRegisteredUser && handleDownloadTxt(lastRegisteredUser)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 py-3 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95"
                title="Download Text File (.txt)"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                <span>{copiedField === 'txt' ? 'Downloaded .TXT' : 'Download .TXT'}</span>
              </button>
            </div>

            {/* Direct Platform Quick Launch Channels */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-slate-500" />
                  Quick Direct Send:
                </span>
                <span className="text-[8px] text-slate-400">1-Tap Redirect</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={() => lastRegisteredUser && handleShareWhatsApp(lastRegisteredUser)}
                  className="flex items-center justify-center gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#128C7E] dark:text-[#25D366] font-bold text-[10px] py-2 px-2.5 rounded-lg transition-all active:scale-95"
                  title="Send via WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>WhatsApp</span>
                </button>

                {/* Gmail */}
                <button
                  type="button"
                  onClick={() => lastRegisteredUser && handleShareGmail(lastRegisteredUser)}
                  className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-[10px] py-2 px-2.5 rounded-lg transition-all active:scale-95"
                  title="Compose in Gmail Web"
                >
                  <Mail className="w-3.5 h-3.5 text-red-500" />
                  <span>Gmail</span>
                </button>

                {/* Default Mail */}
                <button
                  type="button"
                  onClick={() => lastRegisteredUser && handleShareEmail(lastRegisteredUser)}
                  className="flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-[10px] py-2 px-2.5 rounded-lg transition-all active:scale-95"
                  title="Send with Default Email Client"
                >
                  <Send className="w-3.5 h-3.5 text-blue-500" />
                  <span>Email App</span>
                </button>

                {/* Copy Full Slip */}
                <button
                  type="button"
                  onClick={() => lastRegisteredUser && handleCopyAll(lastRegisteredUser)}
                  className="flex items-center justify-center gap-1.5 bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[10px] py-2 px-2.5 rounded-lg transition-all active:scale-95"
                  title="Copy Full Credentials Text"
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-black">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                      <span>Copy Slip</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => { 
                setIsSlipModalOpen(false); 
                setLastRegisteredUser(null);
                setShowDirectShareMenu(false);
                setCopiedField(null);
              }}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Dismiss Notification
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isUpdateConfirmOpen}
        onClose={() => { setUpdateConfirmOpen(false); setPendingUpdateUser(null); }}
        onConfirm={executeRoleUpdate}
        title="Confirm Personnel Elevation"
        message="Are you sure you want to modify this staff member's administrative privileges? This action will be logged in the permanent audit trail."
        confirmLabel="Confirm Update"
        variant="warning"
      />

      <ConfirmModal
        isOpen={isDeactivateConfirmOpen}
        onClose={() => { setDeactivateConfirmOpen(false); setPendingDeactivateUid(null); }}
        onConfirm={executeDeactivation}
        title="Revoke Facility Access"
        message="You are about to deactivate this account. The personnel will be immediately barred from accessing all clinical databases and terminals."
        confirmLabel="Finalize Revocation"
        variant="danger"
      />

      <ConfirmModal
        isOpen={isActivateConfirmOpen}
        onClose={() => { setActivateConfirmOpen(false); setPendingActivateUid(null); }}
        onConfirm={executeActivation}
        title="Restore Facility Access"
        message="Restore this account to ACTIVE SERVICE status? This personnel will regain full access to clinical data management tools."
        confirmLabel="Finalize Restoration"
        variant="warning"
      />
    </div>
  );
};

export default UserManagement;
