import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// @ts-ignore
import { collection, onSnapshot, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Patient, EndoscopyRecord, InventoryItem, ClinicalUnit } from '../types';
import { COLORS, MONTHS, UNIT_DETAILS } from '../constants';
import { useUnit } from '../contexts/UnitContext';

const Dashboard: React.FC = () => {
  const { activeUnit } = useUnit();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activeCount, setActiveCount] = useState(0);
  const [mortalityCount, setMortalityCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [monthlyAdmissions, setMonthlyAdmissions] = useState<{ month: string, count: number }[]>([]);
  const [monthlyMortality, setMonthlyMortality] = useState<{ month: string, count: number }[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const YEAR_OPTIONS = useMemo(() => {
    const years = [];
    for (let y = 2025; y <= 2040; y++) years.push(y);
    return years;
  }, []);

  useEffect(() => {
    const startOfYear = `${selectedYear}-01-01`;
    const endOfYear = `${selectedYear}-12-31`;

    const qActive = query(
      collection(db, 'patients'),
      where('admissionDate', '>=', startOfYear),
      where('admissionDate', '<=', endOfYear)
    );
    const unsubActive = onSnapshot(qActive, (snap: any) => {
        const unitDocs = snap.docs.filter((d: any) => d.data().unit === activeUnit);
        setActiveCount(unitDocs.length);
        const counts = Array(12).fill(0);
        unitDocs.forEach((doc: any) => {
          const data = doc.data() as Patient;
          if (data.admissionDate) {
            const date = new Date(data.admissionDate);
            counts[date.getMonth()]++;
          }
        });
        setMonthlyAdmissions(MONTHS.map((m, i) => ({ month: m, count: counts[i] })));
    });

    const qMortality = query(
      collection(db, 'mortality_records'),
      where('dischargeDate', '>=', startOfYear),
      where('dischargeDate', '<=', endOfYear)
    );
    const unsubMortality = onSnapshot(qMortality, (snap: any) => {
        const unitDocs = snap.docs.filter((d: any) => d.data().unit === activeUnit);
        setMortalityCount(unitDocs.length);
        const mCounts = Array(12).fill(0);
        unitDocs.forEach((doc: any) => {
          const data = doc.data() as Patient;
          if (data.dischargeDate) {
            const date = new Date(data.dischargeDate);
            mCounts[date.getMonth()]++;
          }
        });
        setMonthlyMortality(MONTHS.map((m, i) => ({ month: m, count: mCounts[i] })));
    });

    const qInventory = collection(db, 'inventory');
    const unsubInventory = onSnapshot(qInventory, (snap: any) => {
      const items = snap.docs
        .map((doc: any) => doc.data() as InventoryItem)
        .filter((i: any) => (i.unit === activeUnit || (i as any).unit_location === activeUnit));
      const lowStock = items.filter((i: any) => i.quantity <= i.minThreshold).length;
      setLowStockCount(lowStock);
    });

    return () => {
      unsubActive();
      unsubMortality();
      unsubInventory();
    };
  }, [selectedYear, activeUnit]);

  const generateMasterBackup = async () => {
    setIsBackupLoading(true);
    try {
      const headers = [
        "Unit", "Record_Type", "Serial_No", "Reg_No", "Patient_Name", "Gender", 
        "Date_Start", "Date_End", "Category_Procedure", "Consultant_Doctor", 
        "Stay_LOS", "Code_Status"
      ];
      let csvContent = headers.join(",") + "\n";
      const clean = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      const [patientsSnap, mortalitySnap, endoscopySnap] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'mortality_records')),
        getDocs(collection(db, 'endoscopy_records'))
      ]);
      patientsSnap.docs.forEach(doc => {
        const p = doc.data() as Patient;
        csvContent += [clean(p.unit), "ADMISSION", clean(p.serialNo), clean(p.regNo), clean(p.name), clean(p.gender), clean(p.admissionDate), "N/A", clean(p.category), clean(p.consultant), clean(p.lengthOfStay), clean(p.codeStatus)].join(",") + "\n";
      });
      mortalitySnap.docs.forEach(doc => {
        const p = doc.data() as Patient;
        csvContent += [clean(p.unit), "MORTALITY", clean(p.serialNo), clean(p.regNo), clean(p.name), clean(p.gender), clean(p.admissionDate), clean(p.dischargeDate), clean(p.category), clean(p.consultant), clean(p.lengthOfStay), clean(p.codeStatus)].join(",") + "\n";
      });
      endoscopySnap.docs.forEach(doc => {
        const r = doc.data() as EndoscopyRecord;
        csvContent += [clean(r.referringUnit), "ENDOSCOPY", clean(r.serialNo), clean(r.regNo), clean(r.name), "N/A", clean(r.date), "N/A", clean(r.procedure), clean(r.doctor), "N/A", "N/A"].join(",") + "\n";
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `HDU_MASTER_BACKUP_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
    } catch (error) {
      console.error("Backup Failure:", error);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, subText }: { title: string, value: number, icon: any, color: string, subText: string }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between transition-all hover:shadow-md hover:border-slate-300">
      <div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black mt-1 text-slate-800 tracking-tighter">{value}</h3>
        <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tight">{subText}</p>
      </div>
      <div className={`${color} p-3 rounded-xl text-white shadow-lg`}>
        {icon}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{UNIT_DETAILS[activeUnit].label} Dashboard</h2>
             <span className={`px-3 py-1 rounded text-[8px] font-black text-white uppercase tracking-widest ${UNIT_DETAILS[activeUnit].color}`}>
               Unit: {activeUnit}
             </span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Performance tracking for fiscal year {selectedYear}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-slate-900 text-white border border-slate-700 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer appearance-none pr-10 shadow-lg"
            >
              {YEAR_OPTIONS.map(year => (
                <option key={year} value={year}>{year} ANALYTICS</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          <button 
            onClick={generateMasterBackup}
            disabled={isBackupLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              isBackupLoading 
                ? 'bg-slate-100 text-slate-400 cursor-wait' 
                : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
            }`}
          >
            {isBackupLoading ? (
              <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            <span>{isBackupLoading ? 'Syncing...' : 'Master Log'}</span>
          </button>
        </div>
      </header>

      {showToast && (
        <div className="fixed top-24 right-8 z-[100] max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 animate-in slide-in-from-right-4">
          <div className="flex gap-3">
             <div className="bg-green-500 p-2 rounded-lg shrink-0 h-fit">
               <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
             </div>
             <div>
               <p className="text-[11px] font-black uppercase tracking-wider text-green-400">Sync Complete!</p>
               <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                 Facility-wide audit is ready. CSV contains data from all units (HDU, ICU, CCU, NICU).
               </p>
             </div>
             <button onClick={() => setShowToast(false)} className="text-slate-500 hover:text-white p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Unit Census" 
          value={activeCount} 
          subText={`Admitted in ${selectedYear}`}
          color={UNIT_DETAILS[activeUnit].color}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <StatCard 
          title="Total Mortality" 
          value={mortalityCount} 
          subText={`Expiry logs for ${selectedYear}`}
          color="bg-slate-900"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard 
          title="Stock Critical" 
          value={lowStockCount} 
          subText="Items requiring replenishment"
          color="bg-amber-500"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Admission Velocity</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Monthly breakdown for {activeUnit}</p>
            </div>
          </div>
          <div className="w-full h-[350px] min-h-[350px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAdmissions} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                  {monthlyAdmissions.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count > 0 ? (activeUnit === 'HDU' ? COLORS.primary : '#4f46e5') : '#e2e8f0'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Unit Mortality Velocity</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Monthly breakdown for {activeUnit} Expiry Logs</p>
            </div>
          </div>
          <div className="w-full h-[350px] min-h-[350px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMortality} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                  {monthlyMortality.map((entry, index) => (
                    <Cell 
                      key={`cell-mortality-${index}`} 
                      fill={entry.count > 0 ? '#1e293b' : '#e2e8f0'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;