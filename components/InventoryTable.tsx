
import React, { useState, useEffect, useRef, useMemo } from 'react';
// @ts-ignore
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { InventoryItem, ClinicalUnit } from '../types';
import { exportInventoryPDF, ReportMetadata } from '../services/pdfService';
import { downloadCSV } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../constants';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import ExportModal from './ExportModal';

type SortKey = keyof InventoryItem;
type SortDirection = 'asc' | 'desc';

const InventoryTable: React.FC = () => {
  const { activeUnit } = useUnit();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Date Filter states
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'lastUpdated', 
    direction: 'desc' 
  });

  const prevIdsRef = useRef<Set<string>>(new Set());
  const { isAdmin, canManageRecords } = useAuth();

  // Standardized categories list (sorted)
  const sortedCategories = useMemo(() => [...INVENTORY_CATEGORIES].sort(), []);
  const filterCategories = useMemo(() => ['ALL', ...sortedCategories], [sortedCategories]);

  useEffect(() => {
    // onSnapshot with client-side processing
    const q = query(collection(db, 'inventory'));
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const inventoryData = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => (item.unit === activeUnit || item.unit_location === activeUnit)) as InventoryItem[];
      
      // Highlight Logic for Stock Changes
      const currentIds = new Set(inventoryData.map(i => i.id));
      if (prevIdsRef.current.size > 0) {
        const newlyCreated = inventoryData.find(i => !prevIdsRef.current.has(i.id));
        if (newlyCreated) {
          setNewlyAddedId(newlyCreated.id);
          setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      prevIdsRef.current = currentIds;
      setItems(inventoryData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUnit]);

  const getExpiryStatus = (expiryDateStr: string) => {
    if (!expiryDateStr) return 'OK';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(expiryDateStr);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 60) return 'NEAR EXPIRY';
    return 'OK';
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput || !endDateInput) {
      alert('Please select a date range to view stock logs.');
      return;
    }

    const start = new Date(startDateInput);
    const end = new Date(endDateInput);

    if (end < start) {
      alert('Invalid Date Range: End date cannot be before start date.');
      return;
    }

    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const sortedAndFiltered = useMemo(() => {
    const filtered = items.filter(i => {
      const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            i.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || i.category === selectedCategory;
      
      const updateDate = new Date(i.lastUpdated);
      updateDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (appliedStartDate) {
        const start = new Date(appliedStartDate);
        start.setHours(0, 0, 0, 0);
        matchesStartDate = updateDate >= start;
      }
      
      let matchesEndDate = true;
      if (appliedEndDate) {
        const end = new Date(appliedEndDate);
        end.setHours(0, 0, 0, 0);
        matchesEndDate = updateDate <= end;
      }

      return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (sortConfig.key === 'quantity' || sortConfig.key === 'minThreshold') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (sortConfig.key === 'lastUpdated' || sortConfig.key === 'expiryDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [items, searchTerm, selectedCategory, appliedStartDate, appliedEndDate, sortConfig]);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (idToDelete && isAdmin) {
      try {
        await deleteDoc(doc(db, 'inventory', idToDelete));
        setIdToDelete(null);
      } catch (err) {
        console.error("Delete Error:", err);
      }
    }
  };

  const handleView = (item: InventoryItem) => {
    setViewingItem(item);
    setIsDetailsOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    if (!canManageRecords) return;
    setEditingItem(item);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    if (!canManageRecords) return;
    setEditingItem(null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const errors: Record<string, string> = {};

    const itemName = formData.get('itemName') as string;
    const category = formData.get('category') as string;
    const initialQtyStr = formData.get('initialQty') as string;
    const initialQty = Number(initialQtyStr);
    const unit = formData.get('unit') as string;
    const expiryDate = formData.get('expiryDate') as string;

    if (!itemName?.trim()) errors.itemName = "Item name is required";
    if (!category || category === "") errors.category = "Category selection is required";
    if (!initialQtyStr || isNaN(initialQty) || initialQty < 0) errors.initialQty = "Valid quantity required";
    if (!unit || unit === "") errors.unit = "Measurement unit required";
    if (!expiryDate) errors.expiryDate = "Expiry date required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const itemData = {
        name: itemName.trim().toUpperCase(),
        category: category,
        quantity: initialQty,
        minThreshold: Math.floor(initialQty * 0.2) || 5,
        measurementUnit: unit.toUpperCase(),
        expiryDate: expiryDate,
        status: 'ADEQUATE',
        lastUpdated: new Date().toISOString(),
        unit_location: activeUnit,
        unit: activeUnit,
      };

      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
      } else {
        await addDoc(collection(db, 'inventory'), itemData);
      }
      
      setIsModalOpen(false);
      setEditingItem(null);
      setFormErrors({});
    } catch (err) {
      console.error("Save Inventory Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (opts: any) => {
    const reportTitle = `${activeUnit} Stock Records`;
    const headers = ['Item Name', 'Category', 'Stock', 'Min', 'Unit', 'Last Updated', 'Expiry Date'];
    const rows = sortedAndFiltered.map(i => [
      i.name, 
      i.category, 
      i.quantity, 
      i.minThreshold, 
      i.measurementUnit, 
      i.lastUpdated,
      i.expiryDate
    ]);

    if (opts.format === 'CSV') {
      downloadCSV(reportTitle, headers, rows);
    } else {
      const metadata: ReportMetadata = {
        generatedBy: opts.generatedBy,
        filters: `Unit: ${activeUnit}, Category: ${selectedCategory}${searchTerm ? `, Search: '${searchTerm}'` : ''}`,
      };
      exportInventoryPDF(sortedAndFiltered, metadata);
    }
  };

  const InputError = ({ name }: { name: string }) => (
    formErrors[name] ? <p className="text-red-500 text-[10px] mt-1 font-medium">{formErrors[name]}</p> : null
  );

  const getInputClass = (name: string) => `w-full p-2 border border-slate-200 rounded-lg outline-none transition-all text-[10px] font-bold ${
    formErrors[name] 
      ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-100' 
      : 'focus:ring-2 focus:ring-red-100 bg-slate-50'
  }`;

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <div className="w-3 h-3 ml-1 opacity-20"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div>;
    return (
      <div className="w-3 h-3 ml-1 text-red-500 animate-in fade-in zoom-in duration-300">
        {sortConfig.direction === 'asc' ? (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <input 
                type="text" 
                placeholder={`Search ${activeUnit} stock...`} 
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-red-100 outline-none transition-all text-[10px] font-bold shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-[10px] font-bold focus:ring-2 focus:ring-red-100 outline-none cursor-pointer shadow-sm"
            >
              {filterCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'ALL CATEGORIES' : cat.toUpperCase()}
                </option>
              ))}
            </select>

            {canManageRecords && (
              <button 
                onClick={openAddModal}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-red-700 transition-colors shadow-lg text-[10px] font-bold shadow-red-100 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                <span>ADD STOCK</span>
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-white transition-all text-[10px] font-bold shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>Export Records</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">From:</label>
            <input 
              type="date" 
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">To:</label>
            <input 
              type="date" 
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50"
            />
          </div>
          <button 
            onClick={handleApplyDateFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Fetch Stock
          </button>
          <button 
            onClick={resetFilters}
            className="ml-auto text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying {activeUnit} Stores...</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white shadow-md select-none">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Equipment <SortIndicator column="name" /></div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('category')}>
                    <div className="flex items-center">Category <SortIndicator column="category" /></div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center">Stock <SortIndicator column="quantity" /></div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('lastUpdated')}>
                    <div className="flex items-center justify-center">Updated <SortIndicator column="lastUpdated" /></div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right bg-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                {sortedAndFiltered.map((item) => {
                  const isLow = item.quantity <= item.minThreshold;
                  const expiryStatus = getExpiryStatus(item.expiryDate);
                  
                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-all group cursor-pointer ${
                        newlyAddedId === item.id 
                          ? 'bg-amber-50/70 border-l-4 border-l-amber-500 animate-in fade-in duration-1000' 
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => handleView(item)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 uppercase tracking-tight">{item.name}</p>
                        <p className="text-[8px] text-slate-400 font-bold">EXP: {item.expiryDate || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`${isLow ? 'text-red-600 font-black' : 'text-emerald-600 font-black'} text-[9px] uppercase`}>
                            {isLow ? 'Low Stock' : (item as any).status || 'Adequate'}
                          </span>
                          {expiryStatus !== 'OK' && (
                            <span className={`text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${expiryStatus === 'EXPIRED' ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
                              {expiryStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-end space-x-1">
                          <span className={`text-base font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.quantity}
                          </span>
                          <span className="text-[9px] text-slate-400 mb-1 font-bold">/ {item.minThreshold} {item.measurementUnit}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-slate-500 font-bold">
                          {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                          {canManageRecords && (
                            <button onClick={(e) => handleEditClick(e, item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={(e) => handleDeleteClick(e, item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedAndFiltered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic font-medium">No stock records found for this criteria.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={isDetailsOpen} onClose={() => { setIsDetailsOpen(false); setViewingItem(null); }} title={`${activeUnit} SPECS`}>
        {viewingItem && (
          <div className="space-y-6">
            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{viewingItem.name}</h4>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">STOCK</p>
                <p className="text-base font-black text-slate-800">{viewingItem.quantity} {viewingItem.measurementUnit}</p>
              </div>
              <div className="text-center border-l border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">EXPIRY</p>
                <p className={`text-base font-black ${getExpiryStatus(viewingItem.expiryDate) !== 'OK' ? 'text-red-600' : 'text-slate-800'}`}>{viewingItem.expiryDate}</p>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px]">
              <p className="text-[10px] text-slate-700 leading-relaxed">{viewingItem.notes || "No unit-specific clinical specs."}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => { if(!isSaving) { setIsModalOpen(false); setEditingItem(null); } }} title={editingItem ? `MODIFY ${activeUnit} ITEM` : `ADD TO ${activeUnit}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Item Name (e.g. Kinz 10 mg)</label>
            <input name="itemName" defaultValue={editingItem?.name} className={getInputClass('itemName')} placeholder="e.g. VENTILATOR MASK" />
            <InputError name="itemName" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Category</label>
              <select name="category" defaultValue={editingItem?.category || ""} className={getInputClass('category')}>
                <option value="" disabled>Select Category</option>
                {sortedCategories.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
              </select>
              <InputError name="category" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Unit (e.g. VIAL)</label>
              <select name="unit" defaultValue={editingItem?.measurementUnit || ""} className={getInputClass('unit')}>
                <option value="" disabled>Select Unit</option>
                {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <InputError name="unit" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Initial Qty</label>
              <input name="initialQty" type="number" defaultValue={editingItem?.quantity} className={getInputClass('initialQty')} />
              <InputError name="initialQty" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Expiry Date</label>
              <input name="expiryDate" type="date" defaultValue={editingItem?.expiryDate} className={getInputClass('expiryDate')} />
              <InputError name="expiryDate" />
            </div>
          </div>
          <button type="submit" disabled={isSaving} className={`w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center space-x-2 active:scale-95`}>
            {isSaving ? "Syncing..." : "Commit Stock"}
          </button>
        </form>
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => { setIsConfirmOpen(false); setIdToDelete(null); }} onConfirm={confirmDelete} title="Purge Record" message="Permanently remove from inventory?" />
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={handleExport} 
        title={`${activeUnit} Stock Audit`} 
        showDateRange={false} 
      />
    </div>
  );
};

export default InventoryTable;
