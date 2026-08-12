import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// @ts-ignore
import { collection, onSnapshot, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Patient, EndoscopyRecord, InventoryItem } from '../types';
import { COLORS, MONTHS, UNIT_DETAILS, formatProcedureDisplay } from '../constants';
import { useUnit } from '../contexts/UnitContext';

const Dashboard: React.FC = () => {
  const { activeUnit } = useUnit();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [activeCount, setActiveCount] = useState(0);
  const [mortalityCount, setMortalityCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [currentActiveCount, setCurrentActiveCount] = useState(0);
  const [averageLOS, setAverageLOS] = useState(0);
  const [frequentProcedures, setFrequentProcedures] = useState<{ name: string, count: number }[]>([]);
  const [monthlyAdmissions, setMonthlyAdmissions] = useState<{ month: string, count: number }[]>([]);
  const [monthlyMortality, setMonthlyMortality] = useState<{ month: string, count: number }[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [loading, setLoading] = useState(true);

  // Calculations for Admission Velocity color indications (Top, Middle, Lowest)
  const maxAdmissions = useMemo(() => Math.max(...monthlyAdmissions.map(a => a.count), 0), [monthlyAdmissions]);
  const minAdmissions = useMemo(() => {
    const positive = monthlyAdmissions.filter(a => a.count > 0).map(a => a.count);
    return positive.length > 0 ? Math.min(...positive) : 0;
  }, [monthlyAdmissions]);

  // Calculations for Unit Mortality Velocity color indications
  const maxMortality = useMemo(() => Math.max(...monthlyMortality.map(m => m.count), 0), [monthlyMortality]);
  const minMortality = useMemo(() => {
    const positive = monthlyMortality.filter(m => m.count > 0).map(m => m.count);
    return positive.length > 0 ? Math.min(...positive) : 0;
  }, [monthlyMortality]);

  const YEAR_OPTIONS = useMemo(() => {
    const years = [];
    for (let y = 2026; y <= 2040; y++) {
      years.push(y);
    }
    return years.sort((a, b) => b - a); // descending order (2040 to 2026)
  }, []);

  useEffect(() => {
    setLoading(true);
    const isRecordInSelectedYear = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getFullYear()) && d.getFullYear() === selectedYear;
    };

    const qActive = query(
      collection(db, 'patients'),
      where('unit', '==', activeUnit)
    );
    const unsubActive = onSnapshot(qActive, (snap: any) => {
        const unitDocs = snap.docs.map((d: any) => d.data() as Patient);
        
        const yearDocs = unitDocs.filter((data: any) => isRecordInSelectedYear(data.admissionDate));
        setActiveCount(yearDocs.length);

        const activeNow = unitDocs.filter((data: any) => data.status === 'ACTIVE' || !data.dischargeDate);
        setCurrentActiveCount(activeNow.length);

        const discharged = unitDocs.filter((data: any) => isRecordInSelectedYear(data.admissionDate) && (data.lengthOfStay !== undefined));
        if (discharged.length > 0) {
          const totalLOS = discharged.reduce((acc, curr) => acc + (curr.lengthOfStay || 0), 0);
          setAverageLOS(parseFloat((totalLOS / discharged.length).toFixed(1)));
        } else {
          setAverageLOS(0);
        }

        const counts = Array(12).fill(0);
        yearDocs.forEach((data: any) => {
          if (data.admissionDate) {
            const date = new Date(data.admissionDate);
            if (!isNaN(date.getMonth())) {
              counts[date.getMonth()]++;
            }
          }
        });
        setMonthlyAdmissions(MONTHS.map((m, i) => ({ month: m, count: counts[i] })));
        setLoading(false);
    });

    const qMortality = query(
      collection(db, 'mortality_records'),
      where('unit', '==', activeUnit)
    );
    const unsubMortality = onSnapshot(qMortality, (snap: any) => {
        const unitDocs = snap.docs.filter((doc: any) => {
          const data = doc.data();
          return isRecordInSelectedYear(data.dischargeDate);
        });
        setMortalityCount(unitDocs.length);
        const mCounts = Array(12).fill(0);
        unitDocs.forEach((doc: any) => {
          const data = doc.data() as Patient;
          if (data.dischargeDate) {
            const date = new Date(data.dischargeDate);
            if (!isNaN(date.getMonth())) {
              mCounts[date.getMonth()]++;
            }
          }
        });
        setMonthlyMortality(MONTHS.map((m, i) => ({ month: m, count: mCounts[i] })));
    });

    const qInventory = query(
      collection(db, 'inventory'),
      where('unit', '==', activeUnit)
    );
    const unsubInventory = onSnapshot(qInventory, (snap: any) => {
      const items = snap.docs
        .map((doc: any) => doc.data() as InventoryItem);
      const lowStock = items.filter((i: any) => i.quantity <= i.minThreshold).length;
      setLowStockCount(lowStock);
    });

    const qEndoscopy = query(
      collection(db, 'endoscopy_records'),
      where('referringUnit', '==', activeUnit)
    );
    const unsubEndoscopy = onSnapshot(qEndoscopy, (snap: any) => {
      const unitDocs = snap.docs
        .map((doc: any) => doc.data() as EndoscopyRecord)
        .filter(r => isRecordInSelectedYear(r.date));
      
      const counts: Record<string, number> = {};
      unitDocs.forEach(r => {
        const procName = formatProcedureDisplay(r.procedure);
        counts[procName] = (counts[procName] || 0) + 1;
      });
      
      const sorted = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setFrequentProcedures(sorted);
    });

    return () => {
      unsubActive();
      unsubMortality();
      unsubInventory();
      unsubEndoscopy();
    };
  }, [selectedYear, activeUnit]);

  useEffect(() => {
    setIsMounted(true);

    const handleExport = () => {
      generateMasterBackup();
    };
    window.addEventListener('app:export', handleExport);
    return () => {
      window.removeEventListener('app:export', handleExport);
    };
  }, [activeUnit, selectedYear]);

  const generateMasterBackup = async () => {
    setIsBackupLoading(true);
    try {
      const headers = [
        "Unit", "Record_Type", "Filter_Year", "Serial_No", "Reg_No", "Patient_Name", "Gender", 
        "Date_Start", "Date_End", "Category_Procedure", "Consultant_Doctor", 
        "Stay_LOS", "Code_Status", "Details_Notes"
      ];
      let csvContent = headers.join(",") + "\n";
      const clean = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

      const isRecordInSelectedYear = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getFullYear()) && d.getFullYear() === selectedYear;
      };

      const [patientsSnap, mortalitySnap, endoscopySnap, inventorySnap] = await Promise.all([
        getDocs(query(collection(db, 'patients'), where('unit', '==', activeUnit))),
        getDocs(query(collection(db, 'mortality_records'), where('unit', '==', activeUnit))),
        getDocs(query(collection(db, 'endoscopy_records'), where('referringUnit', '==', activeUnit))),
        getDocs(query(collection(db, 'inventory'), where('unit', '==', activeUnit)))
      ]);

      let recordCount = 0;

      patientsSnap.docs.forEach(doc => {
        const p = doc.data() as Patient;
        if (isRecordInSelectedYear(p.admissionDate)) {
          csvContent += [clean(p.unit || activeUnit), "ADMISSION", clean(selectedYear), clean(p.serialNo), clean(p.regNo), clean(p.name), clean(p.gender), clean(p.admissionDate), clean(p.dischargeDate || 'Active'), clean(p.category), clean(p.consultant), clean(p.lengthOfStay ?? ''), clean(p.codeStatus), clean(p.location)].join(",") + "\n";
          recordCount++;
        }
      });

      mortalitySnap.docs.forEach(doc => {
        const p = doc.data() as Patient;
        if (isRecordInSelectedYear(p.dischargeDate || p.admissionDate)) {
          csvContent += [clean(p.unit || activeUnit), "MORTALITY", clean(selectedYear), clean(p.serialNo), clean(p.regNo), clean(p.name), clean(p.gender), clean(p.admissionDate), clean(p.dischargeDate), clean(p.category), clean(p.consultant), clean(p.lengthOfStay ?? ''), clean(p.codeStatus), clean(p.location)].join(",") + "\n";
          recordCount++;
        }
      });

      endoscopySnap.docs.forEach(doc => {
        const r = doc.data() as EndoscopyRecord;
        if (isRecordInSelectedYear(r.date)) {
          csvContent += [clean(r.referringUnit || activeUnit), "ENDOSCOPY", clean(selectedYear), clean(r.serialNo), clean(r.regNo), clean(r.name), "N/A", clean(r.date), "N/A", clean(r.procedure), clean(r.doctor), "N/A", "N/A", clean(r.diagnosis || r.findings)].join(",") + "\n";
          recordCount++;
        }
      });

      inventorySnap.docs.forEach(doc => {
        const item = doc.data() as InventoryItem;
        csvContent += [clean(item.unit || activeUnit), "INVENTORY", clean(selectedYear), clean(item.id), "N/A", clean(item.name), "N/A", "N/A", "N/A", clean(item.category), "N/A", clean(item.quantity), clean(item.measurementUnit), clean(item.notes || `Min threshold: ${item.minThreshold}`)].join(",") + "\n";
        recordCount++;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${activeUnit}_Analytics_${selectedYear}_Export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
    } catch (error) {
      console.error("CSV Export Failure:", error);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const StatCardSkeleton = () => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between animate-pulse">
      <div className="space-y-2.5">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
      </div>
      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
    </div>
  );

  const ChartSkeleton = ({ title, subTitle }: { title: string, subTitle: string }) => (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">{title}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              Fetching Data
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subTitle}</p>
        </div>

        {/* Legend Skeletons */}
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200/60 dark:border-slate-700/60 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Chart Canvas Area with Mock Grid & Staggered Bar Animation */}
      <div className="w-full h-[350px] relative flex flex-col justify-between pt-4 pb-2">
        {/* Y-Axis Horizontal Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-4 pl-8 pr-2">
          {[100, 75, 50, 25, 0].map((val, i) => (
            <div key={i} className="flex items-center gap-2 w-full">
              <span className="text-[9px] font-mono text-slate-300 dark:text-slate-700 w-6 text-right select-none">{val}</span>
              <div className="border-b border-dashed border-slate-100 dark:border-slate-800/80 flex-1" />
            </div>
          ))}
        </div>

        {/* Animated Bar Skeletons */}
        <div className="relative z-10 w-full h-full flex items-end justify-between gap-1.5 sm:gap-3 pl-10 pr-2 pt-4">
          {[35, 60, 25, 80, 50, 95, 40, 70, 30, 85, 65, 45].map((height, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <div 
                className="w-full max-w-[36px] bg-gradient-to-t from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700/80 dark:to-slate-800 rounded-t-lg animate-pulse transition-all shadow-sm"
                style={{ 
                  height: `${height}%`,
                  animationDuration: '1.8s',
                  animationDelay: `${index * 80}ms`
                }}
              />
              <div className="h-2.5 w-6 sm:w-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const StatCard = ({ title, value, icon, color, subText, suffix = "" }: { title: string, value: number | string, icon: any, color: string, subText: string, suffix?: string }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black mt-1 text-slate-800 dark:text-slate-100 tracking-tighter">{value}{suffix}</h3>
        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-bold uppercase tracking-tight">{subText}</p>
      </div>
      <div className={`${color} p-3 rounded-xl text-white shadow-lg`}>
        {icon}
      </div>
    </div>
  );

  const occupancyRate = useMemo(() => {
    const capacity = UNIT_DETAILS[activeUnit].capacity;
    return Math.min(100, Math.round((currentActiveCount / capacity) * 100));
  }, [currentActiveCount, activeUnit]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{UNIT_DETAILS[activeUnit].label} Dashboard</h2>
             <span className={`px-3 py-1 rounded text-[8px] font-black text-white uppercase tracking-widest ${UNIT_DETAILS[activeUnit].color}`}>
               Unit: {activeUnit}
             </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Performance tracking for fiscal year {selectedYear}</p>
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
            title="Export CSV (Alt+E)"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              isBackupLoading 
                ? 'bg-slate-100 text-slate-400 cursor-wait' 
                : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
            }`}
          >
            {isBackupLoading ? (
              <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
            )}
            <span>{isBackupLoading ? 'Exporting...' : 'Export CSV (Alt+E)'}</span>
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
               <p className="text-[11px] font-black uppercase tracking-wider text-green-400">Export Complete!</p>
               <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                 CSV export created for <span className="text-white font-bold">{activeUnit}</span> (Year <span className="text-white font-bold">{selectedYear}</span>).
               </p>
             </div>
             <button onClick={() => setShowToast(false)} className="text-slate-500 hover:text-white p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-8">
            <ChartSkeleton title="Admission Velocity" subTitle={`Monthly breakdown for ${activeUnit}`} />
            <ChartSkeleton title="Unit Mortality Velocity" subTitle={`Monthly breakdown for ${activeUnit} Expiry Logs`} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Unit Census" 
              value={activeCount} 
              subText={`Admitted in ${selectedYear}`}
              color={UNIT_DETAILS[activeUnit].color}
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            <StatCard 
              title="Bed Occupancy" 
              value={occupancyRate} 
              suffix="%"
              subText={`${currentActiveCount} / ${UNIT_DETAILS[activeUnit].capacity} Beds Occupied`}
              color="bg-blue-600"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            />
            <StatCard 
              title="Average LOS" 
              value={averageLOS} 
              suffix=" Days"
              subText="Mean length of stay"
              color="bg-emerald-600"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
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
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">Admission Velocity</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Monthly breakdown for {activeUnit}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Top Peak
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Moderate
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Lowest
                  </span>
                </div>
              </div>
              <div id="admission-velocity-chart" className="w-full h-[350px]">
                {isMounted && (
                  <ResponsiveContainer width="100%" height={350}>
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
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                      {monthlyAdmissions.map((entry, index) => {
                        let fill = '#e2e8f0';
                        if (entry.count > 0) {
                          if (maxAdmissions > minAdmissions) {
                            if (entry.count === maxAdmissions) fill = '#10b981'; // Emerald Green Top Peak
                            else if (entry.count === minAdmissions) fill = '#f59e0b'; // Amber Lowest
                            else fill = '#3b82f6'; // Royal Blue Moderate
                          } else {
                            fill = '#3b82f6';
                          }
                        }
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                      labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">Unit Mortality Velocity</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Monthly breakdown for {activeUnit} Expiry Logs</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Zero Expiry (Safest)
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Lowest
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Moderate
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Peak Expiry
                  </span>
                </div>
              </div>
              <div id="mortality-velocity-chart" className="w-full h-[350px]">
                {isMounted && (
                  <ResponsiveContainer width="100%" height={350}>
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
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                      {monthlyMortality.map((entry, index) => {
                        let fill = '#10b981'; // 0 count = Emerald Green (Safest)
                        if (entry.count > 0) {
                          if (maxMortality > minMortality) {
                            if (entry.count === maxMortality) fill = '#ef4444'; // Rose/Red Peak Expiry
                            else if (entry.count === minMortality) fill = '#3b82f6'; // Royal Blue Lowest
                            else fill = '#f59e0b'; // Amber Moderate
                          } else {
                            fill = '#ef4444';
                          }
                        }
                        return <Cell key={`cell-mortality-${index}`} fill={fill} />;
                      })}
                    </Bar>
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                      labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;