
import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { ClinicalTask, TaskPriority, ClinicalUnit } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { TASK_PRIORITIES, PRIORITY_COLORS, UNIT_DETAILS } from '../constants';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const TasksPage: React.FC = () => {
  const { activeUnit } = useUnit();
  const { currentUser, canManageRecords } = useAuth();
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'created' | 'due'>('created');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'clinical_tasks'),
      where('unit', '==', activeUnit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const taskData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ClinicalTask[];
      
      // Client-side sorting: Pending tasks first, then by selected strategy
      const sortedTasks = [...taskData].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'Pending' ? -1 : 1;
        }

        if (sortBy === 'due') {
          // If sorting by due date, tasks without a due date go to the bottom
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (dateA !== dateB) return dateA - dateB;
        }

        // Fallback to creation date descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setTasks(sortedTasks);
      setLoading(false);
    }, (error: any) => {
      console.error("Task Board Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUnit, sortBy]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'clinical_tasks'), {
        unit: activeUnit,
        title: title.trim().toUpperCase(),
        description: description.trim(),
        priority,
        status: 'Pending',
        dueDate: dueDate || null,
        assignedBy: currentUser?.displayName || 'Unknown Staff',
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setDueDate('');
    } catch (err) {
      console.error("Failed to commit task:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTaskStatus = async (task: ClinicalTask) => {
    if (!canManageRecords) return;
    try {
      const newStatus = task.status === 'Pending' ? 'Completed' : 'Pending';
      await updateDoc(doc(db, 'clinical_tasks', task.id), { status: newStatus });
    } catch (err) {
      console.error("Status Toggle Failed:", err);
    }
  };

  const deleteTask = async () => {
    if (!idToDelete) return;
    try {
      await deleteDoc(doc(db, 'clinical_tasks', idToDelete));
      setIdToDelete(null);
    } catch (err) {
      console.error("Purge Failed:", err);
    }
  };

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'Pending').length,
      high: tasks.filter(t => t.priority === 'High' && t.status === 'Pending').length
    };
  }, [tasks]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr) < today;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Task Terminal</h1>
          <p className="text-slate-500 text-sm font-medium">Procedural checklist and nursing orders for <span className="text-slate-900 font-bold">{UNIT_DETAILS[activeUnit].label}</span></p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mr-2">
            <button 
              onClick={() => setSortBy('created')}
              className={`px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-slate-100 transition-colors ${sortBy === 'created' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Order: Created
            </button>
            <button 
              onClick={() => setSortBy('due')}
              className={`px-3 py-2 text-[8px] font-black uppercase tracking-widest transition-colors ${sortBy === 'due' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Order: Deadline
            </button>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2 border-r border-slate-100 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
              <p className="text-sm font-black text-slate-800">{stats.pending}</p>
            </div>
            <div className="px-4 py-2 text-center bg-red-50">
              <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Urgent</p>
              <p className="text-sm font-black text-red-600">{stats.high}</p>
            </div>
          </div>
          {canManageRecords && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              New Order
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Duty Board...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={`bg-white rounded-2xl border transition-all relative overflow-hidden group shadow-sm hover:shadow-md ${
                task.status === 'Completed' ? 'opacity-60 grayscale-[0.5] border-slate-100' : 'border-slate-200'
              }`}
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority} Priority
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setIdToDelete(task.id); setIsConfirmOpen(true); }}
                      className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <button 
                    onClick={() => toggleTaskStatus(task)}
                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.status === 'Completed' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 hover:border-red-400'
                    }`}
                  >
                    {task.status === 'Completed' && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-black uppercase tracking-tight truncate ${task.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {task.title}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                      {task.description || 'No additional clinical specs.'}
                    </p>
                    
                    {task.dueDate && task.status === 'Pending' && (
                      <div className={`mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${isOverdue(task.dueDate) ? 'text-red-600' : 'text-slate-400'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                        <span>Due: {formatDate(task.dueDate)}</span>
                        {isOverdue(task.dueDate) && <span className="animate-pulse"> (OVERDUE)</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      {task.assignedBy[0]}
                    </div>
                    {task.assignedBy}
                  </div>
                  <span>{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}
          
          {tasks.length === 0 && (
            <div className="col-span-full py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active clinical tasks for this unit.</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Clinical Order Registration">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure/Task Title *</label>
            <input 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. LABS FOR BED 4"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-red-200"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority Level *</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-red-200 bg-white"
              >
                {TASK_PRIORITIES.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</label>
              <input 
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[11px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clinical Notes</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional procedure details..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[11px] font-bold outline-none focus:ring-1 focus:ring-red-200 resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSaving || !title.trim()}
            className={`w-full py-4 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all shadow-lg ${
              isSaving || !title.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'
            }`}
          >
            {isSaving ? "Syncing Duty..." : "Commit Task Order"}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={deleteTask} 
        title="Purge Task" 
        message="Permanently remove this clinical order from the unit board?" 
      />
    </div>
  );
};

export default TasksPage;
