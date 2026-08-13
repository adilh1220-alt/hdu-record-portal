import React, { useState, useEffect } from 'react';
import { offlineService, NetworkStatus, OfflineDraft } from '../services/offlineService';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, CheckCircle2, FileText, CloudUpload, Trash2, X, Eye, Layers } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const OfflineStatusBanner: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(offlineService.getNetworkStatus());
  const [drafts, setDrafts] = useState<OfflineDraft[]>(offlineService.getOfflineDrafts());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<OfflineDraft | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Register status and draft listeners
    const unsubscribeStatus = offlineService.onStatusChange((status, info) => {
      setNetworkStatus(status);
    });

    const unsubscribeDrafts = offlineService.onDraftsChange((updatedDrafts) => {
      setDrafts(updatedDrafts);
    });

    const handleSyncedEvent = (e: any) => {
      const { successCount, failCount } = e.detail || {};
      if (successCount > 0) {
        toast.success(
          'Offline Drafts Synchronized',
          `Successfully uploaded ${successCount} offline record draft(s) to Firestore.`
        );
      }
      if (failCount > 0) {
        toast.error(
          'Sync Issues Encountered',
          `Failed to sync ${failCount} draft(s). Please check network stability.`
        );
      }
    };

    window.addEventListener('medilog_drafts_synced', handleSyncedEvent);

    return () => {
      unsubscribeStatus();
      unsubscribeDrafts();
      window.removeEventListener('medilog_drafts_synced', handleSyncedEvent);
    };
  }, []);

  const pendingDrafts = drafts.filter(d => d.syncStatus === 'PENDING_SYNC' || d.syncStatus === 'DRAFT' || d.syncStatus === 'FAILED');

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const status = await offlineService.checkRealConnectionStatus();
      if (status === 'offline') {
        toast.warning('Network Unavailable', 'Cannot sync while offline. Please connect to Wi-Fi or Cellular network.');
        setIsSyncing(false);
        return;
      }
      const result = await offlineService.syncPendingDrafts();
      if (result.successCount === 0 && result.failCount === 0) {
        toast.info('All Up to Date', 'No pending drafts require synchronization.');
      }
    } catch (err: any) {
      toast.error('Sync Error', err.message || 'Failed to sync offline drafts.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearSynced = () => {
    offlineService.clearSyncedDrafts();
    toast.info('Draft Queue Cleaned', 'Removed all successfully synchronized offline records.');
  };

  const handleDeleteDraft = (id: string) => {
    offlineService.deleteOfflineDraft(id);
    if (selectedDraft?.id === id) setSelectedDraft(null);
    toast.info('Draft Removed', 'Offline draft permanently removed.');
  };

  // Do not display banner if online and no pending drafts
  if (networkStatus === 'online' && pendingDrafts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Top Sticky Network & Draft Banner */}
      <div 
        className={`w-full py-2.5 px-4 text-xs font-medium border-b flex flex-wrap items-center justify-between gap-3 shadow-sm transition-all z-40 ${
          networkStatus === 'offline' 
            ? 'bg-rose-950/90 text-rose-200 border-rose-800' 
            : networkStatus === 'unstable'
            ? 'bg-amber-950/90 text-amber-200 border-amber-800'
            : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {networkStatus === 'offline' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-900/80 text-rose-300 font-semibold border border-rose-700 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              Offline Mode
            </span>
          )}

          {networkStatus === 'unstable' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-900/80 text-amber-300 font-semibold border border-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Connection Unstable
            </span>
          )}

          {networkStatus === 'online' && pendingDrafts.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-semibold border border-emerald-700">
              <Wifi className="w-3.5 h-3.5" />
              Connection Restored
            </span>
          )}

          <p className="text-slate-200">
            {networkStatus === 'offline' && "Viewing cached patient records. Form entries are auto-saving to local draft protection."}
            {networkStatus === 'unstable' && "High network latency detected. Form edits will auto-save locally to prevent data loss."}
            {networkStatus === 'online' && pendingDrafts.length > 0 && `${pendingDrafts.length} offline record draft(s) ready to synchronize with Firestore.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingDrafts.length > 0 && (
            <button
              onClick={() => setShowDraftModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              View Drafts ({pendingDrafts.length})
            </button>
          )}

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            onClick={() => offlineService.checkRealConnectionStatus()}
            title="Re-check network latency & server health"
            className="p-1.5 rounded hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Offline Drafts Management Drawer/Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Offline Patient Drafts & Local Protection</h3>
                  <p className="text-xs text-slate-400">Records saved locally while connection was offline or unstable</p>
                </div>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-300">No Offline Drafts Found</p>
                  <p className="text-xs">All patient records and clinical forms are synchronized with the cloud.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div 
                      key={draft.id}
                      className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 transition-all flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            draft.type === 'endoscopy' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            draft.type === 'patient' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                            draft.type === 'mortality' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {draft.type}
                          </span>
                          <h4 className="text-sm font-semibold text-white">{draft.title || 'Untitled Draft'}</h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          {draft.patientName && <span>Patient: <strong className="text-slate-200">{draft.patientName}</strong></span>}
                          {draft.regNo && <span>Reg#: <strong className="font-mono text-slate-200">{draft.regNo}</strong></span>}
                          <span>Unit: <strong className="text-slate-300">{draft.unit}</strong></span>
                          <span>Saved: <span className="text-slate-300">{new Date(draft.savedAt).toLocaleTimeString()}</span></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status badge */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                          draft.syncStatus === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          draft.syncStatus === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {draft.syncStatus === 'SYNCED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {draft.syncStatus === 'PENDING_SYNC' && <CloudUpload className="w-3.5 h-3.5" />}
                          {draft.syncStatus === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5" />}
                          {draft.syncStatus}
                        </span>

                        <button
                          onClick={() => setSelectedDraft(draft)}
                          title="Inspect draft details"
                          className="p-1.5 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          title="Delete draft"
                          className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Draft Viewer Sub-Modal */}
              {selectedDraft && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                    <span>Draft Inspector: {selectedDraft.id}</span>
                    <button 
                      onClick={() => setSelectedDraft(null)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      Close
                    </button>
                  </div>
                  <pre className="p-3 rounded bg-slate-900 text-slate-300 overflow-x-auto max-h-48 text-[11px] leading-relaxed">
                    {JSON.stringify(selectedDraft.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
              <button
                onClick={handleClearSynced}
                className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors cursor-pointer"
              >
                Clear Synced Items
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || pendingDrafts.length === 0}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4" />
                  {isSyncing ? 'Uploading...' : `Upload All (${pendingDrafts.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
