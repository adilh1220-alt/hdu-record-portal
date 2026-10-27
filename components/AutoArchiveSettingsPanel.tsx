import React, { useState, useEffect } from 'react';
import { autoArchiveService, AutoArchiveSettings, AutoArchiveLogItem } from '../services/autoArchiveService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Archive, Clock, Sparkles, Play, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, History, Info } from 'lucide-react';

export const AutoArchiveSettingsPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<AutoArchiveSettings>({
    enabled: true,
    inactivityThresholdDays: 7,
    lastRunAt: null,
    lastStatus: null,
    totalArchivedCount: 0
  });

  const [logs, setLogs] = useState<AutoArchiveLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await autoArchiveService.getConfig();
      setSettings(data.settings);
      setLogs(data.logs);
    } catch (err) {
      console.warn('Failed to load auto archive config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    const updatedEnabled = !settings.enabled;
    const updated = await autoArchiveService.saveConfig({ enabled: updatedEnabled });
    setSettings(updated);
    toast.info(updatedEnabled ? 'Automated patient archiving enabled.' : 'Automated patient archiving paused.');
  };

  const handleSelectThreshold = async (days: number) => {
    const updated = await autoArchiveService.saveConfig({ inactivityThresholdDays: days });
    setSettings(updated);
    toast.info(`Auto-archive threshold set to ${days} days of inactivity.`);
  };

  const handleRunScanNow = async () => {
    setIsExecuting(true);
    setResultMessage(null);
    try {
      const res = await autoArchiveService.runAutoArchive(
        'MANUAL_TRIGGER',
        undefined,
        currentUser?.displayName || currentUser?.email || 'Unit Admin'
      );
      
      const refresh = await autoArchiveService.getConfig();
      setSettings(refresh.settings);
      setLogs(refresh.logs);

      if (res.archivedCount > 0) {
        setResultMessage({
          text: `Scan complete: Auto-archived ${res.archivedCount} patient record(s) to 'Discharged' status.`,
          type: 'success'
        });
        toast.success(`Archived ${res.archivedCount} inactive patient record(s).`);
      } else {
        setResultMessage({
          text: `Scan complete: No active patients exceeded the ${settings.inactivityThresholdDays}-day inactivity threshold. Active census is clean!`,
          type: 'info'
        });
        toast.info(`Active census is clean. 0 inactive records found.`);
      }
    } catch (err: any) {
      setResultMessage({
        text: `Execution failed: ${err.message || 'Error running auto-archive scan.'}`,
        type: 'error'
      });
      toast.error('Auto-archive scan failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'Never Executed';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Census Hygiene Controls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 p-5 rounded-2xl text-white shadow-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-white">
                Census Hygiene & Auto-Archive Engine
              </h4>
              <p className="text-[10px] text-slate-300 font-medium">
                Automatically archives inactive patients to 'Discharged' after configurable inactivity to keep active clinical census lists pristine.
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
            settings.enabled 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-slate-700/50 border-slate-600 text-slate-400'
          }`}>
            {settings.enabled ? '● Engine Active' : '○ Engine Paused'}
          </span>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Inactivity Limit</span>
            <span className="text-sm font-black text-amber-400 block">{settings.inactivityThresholdDays} Days</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Last Scheduled Run</span>
            <span className="text-xs font-bold text-slate-200 block truncate">{formatDate(settings.lastRunAt)}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Lifetime Archived</span>
            <span className="text-sm font-black text-emerald-400 block">{settings.totalArchivedCount} Patients</span>
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Automation Toggle & Parameters</h5>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Configure when patient records trigger automatic discharge archiving.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.enabled} 
              onChange={handleToggleEnabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* Threshold Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Inactivity Period Threshold</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[3, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleSelectThreshold(days)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  settings.inactivityThresholdDays === days
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{days} Days</span>
                <span className="text-[8px] font-bold opacity-80">
                  {days === 7 ? 'Recommended' : days === 3 ? 'Aggressive' : days === 14 ? 'Standard' : 'Extended'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Action Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 max-w-md">
            <p className="text-xs font-bold text-slate-800">On-Demand Census Hygiene Scan</p>
            <p className="text-[10px] text-slate-500 font-medium">
              Run an immediate evaluation across all active patients. Records inactive for &ge; {settings.inactivityThresholdDays} days will be marked as 'Discharged'.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunScanNow}
            disabled={isExecuting}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-red-100 transition-all active:scale-95 flex items-center gap-2 cursor-pointer shrink-0"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Evaluating Census...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Auto-Archive Now</span>
              </>
            )}
          </button>
        </div>

        {/* Result notification alert */}
        {resultMessage && (
          <div className={`p-3.5 rounded-xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 ${
            resultMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            resultMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-sky-50 text-sky-800 border border-sky-200'
          }`}>
            {resultMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> :
             resultMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> :
             <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />}
            <div className="leading-snug">{resultMessage.text}</div>
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Auto-Archive Audit Logs</h5>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">{logs.length} Recent Runs</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
            <Clock className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-500">No auto-archive scans recorded yet.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Click "Run Auto-Archive Now" above to initiate your first census audit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-60 overflow-y-auto pr-1">
            <table className="w-full text-left text-[10px] font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Trigger Type</th>
                  <th className="py-2 px-3 text-center">Archived Count</th>
                  <th className="py-2 px-3">Scan Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        log.triggerType === 'AUTOMATED_SCHEDULE' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {log.triggerType === 'AUTOMATED_SCHEDULE' ? 'Scheduled Cron' : 'Manual Trigger'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-black">
                      <span className={`px-2 py-0.5 rounded text-[9px] ${
                        log.archivedCount > 0 ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {log.archivedCount} Record(s)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
