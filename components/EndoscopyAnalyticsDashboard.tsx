import React, { useState, useMemo, useEffect } from 'react';
import { EndoscopyRecord } from '../types';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Sector,
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

// Custom Volume Tooltip ensuring Total Procedures always appears at the end
const CustomVolumeTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const specificItems = payload.filter((p: any) => p && p.dataKey !== 'total');
    const totalItem = payload.find((p: any) => p && p.dataKey === 'total');

    return (
      <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-xl text-xs font-bold space-y-2 min-w-[210px]">
        <p className="text-sky-600 font-extrabold uppercase text-[11px] pb-1 border-b border-slate-100 tracking-wider">
          {label}
        </p>
        <div className="space-y-1.5">
          {specificItems.map((entry: any, index: number) => {
            if (!entry) return null;
            const itemBg = entry.stroke || entry.color || entry.fill || '#3b82f6';
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-slate-700">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: itemBg }} />
                  <span>{entry.name || 'Procedure'}:</span>
                </span>
                <span className="font-black text-slate-900 font-mono">{entry.value ?? 0}</span>
              </div>
            );
          })}
        </div>
        {totalItem && (
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4 text-orange-800 font-black">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-orange-500" />
              <span>{totalItem.name || 'Total'}:</span>
            </span>
            <span className="text-orange-900 text-sm font-extrabold font-mono">{totalItem.value ?? 0}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface EndoscopyAnalyticsDashboardProps {
  records: EndoscopyRecord[];
  activeUnit?: string;
  onOpenNewReport?: () => void;
}

type TimeFrame = 'all' | 'ytd' | '6m' | '3m';
type ProcedureFilter = 'all' | 'upper_gi' | 'lower_gi' | 'sigmoidoscopy' | 'pulmonary';

// Color palette for charts (Vibrant theme with Orange & Pink accent, no green)
const COLORS = [
  '#f97316', // Vibrant Orange
  '#ec4899', // Vibrant Pink
  '#6366f1', // Indigo
  '#f59e0b', // Amber / Golden
  '#8b5cf6', // Purple
  '#3b82f6', // Royal Blue
  '#e11d48', // Crimson / Rose
  '#d946ef', // Fuchsia
  '#06b6d4', // Cyan
  '#ea580c', // Deep Orange
];

// Custom active shape component rendering expanded slice, glow ring, crosshair hover lines & target dots
const renderActivePieShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  // Line coordinates from center outwards through the midAngle
  const xStart = cx + (innerRadius - 6) * cos;
  const yStart = cy + (innerRadius - 6) * sin;
  const xEnd = cx + (outerRadius + 16) * cos;
  const yEnd = cy + (outerRadius + 16) * sin;

  return (
    <g>
      {/* Expanded Main Sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* Outer Halo Highlight Ring */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 12}
        fill={fill}
        opacity={0.7}
      />
      {/* Crosshair Radial Hover Line */}
      <line
        x1={xStart}
        y1={yStart}
        x2={xEnd}
        y2={yEnd}
        stroke="#0f172a"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        opacity={0.85}
      />
      {/* Inner Target Point */}
      <circle
        cx={cx + innerRadius * cos}
        cy={cy + innerRadius * sin}
        r={3}
        fill="#ffffff"
        stroke={fill}
        strokeWidth={2}
      />
      {/* Outer Target Crosshair Dot */}
      <circle
        cx={cx + (outerRadius + 6) * cos}
        cy={cy + (outerRadius + 6) * sin}
        r={4}
        fill="#0f172a"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  );
};

const PieComponent = Pie as any;

export const EndoscopyAnalyticsDashboard: React.FC<EndoscopyAnalyticsDashboardProps> = ({
  records,
  activeUnit = 'ENDOSCOPY',
  onOpenNewReport
}) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [procedureFilter, setProcedureFilter] = useState<ProcedureFilter>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [timeFrame, selectedYear, procedureFilter, selectedDoctor, activeUnit, records]);

  // Extract available years list covering 2026 to 2040 plus any record dates
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (let y = 2026; y <= 2040; y++) {
      set.add(y.toString());
    }
    records.forEach(r => {
      if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d.getFullYear())) {
          set.add(d.getFullYear().toString());
        }
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [records]);

  // Filter records based on selected controls
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Filter by unit if specified
    if (activeUnit && activeUnit !== 'ALL' && activeUnit !== 'NO SPECIFIC UNIT') {
      // Show all endoscopy records or filter by unit
      result = result.filter(r => !r.referringUnit || r.referringUnit === activeUnit || activeUnit === 'ENDOSCOPY');
    }

    // Filter by specific year
    if (selectedYear !== 'all') {
      result = result.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return d.getFullYear().toString() === selectedYear;
      });
    }

    // Filter by time frame
    const now = new Date();
    if (timeFrame === 'ytd') {
      const currentYear = now.getFullYear();
      result = result.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return d.getFullYear() === currentYear;
      });
    } else if (timeFrame === '6m') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      result = result.filter(r => {
        if (!r.date) return false;
        return new Date(r.date) >= sixMonthsAgo;
      });
    } else if (timeFrame === '3m') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      result = result.filter(r => {
        if (!r.date) return false;
        return new Date(r.date) >= threeMonthsAgo;
      });
    }

    // Filter by procedure category
    if (procedureFilter === 'upper_gi') {
      result = result.filter(r => {
        const p = (r.procedure || '').toLowerCase();
        return p.includes('egd') || p.includes('esophag') || p.includes('gastros') || p.includes('duoden') || p.includes('upper');
      });
    } else if (procedureFilter === 'lower_gi') {
      result = result.filter(r => {
        const p = (r.procedure || '').toLowerCase();
        return (p.includes('colon') || p.includes('lower') || p.includes('recto')) && !p.includes('sigmo');
      });
    } else if (procedureFilter === 'sigmoidoscopy') {
      result = result.filter(r => {
        const p = (r.procedure || '').toLowerCase();
        return p.includes('sigmo');
      });
    } else if (procedureFilter === 'pulmonary') {
      result = result.filter(r => {
        const p = (r.procedure || '').toLowerCase();
        return p.includes('bronch') || p.includes('lung') || p.includes('pulmon');
      });
    }

    // Filter by doctor
    if (selectedDoctor !== 'all') {
      result = result.filter(r => r.doctor === selectedDoctor);
    }

    return result;
  }, [records, activeUnit, selectedYear, timeFrame, procedureFilter, selectedDoctor]);

  // Extract unique doctors list
  const doctorsList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.doctor && r.doctor.trim()) {
        set.add(r.doctor.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const total = filteredRecords.length;

    // Current Month & Previous Month counts
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const prevMonthDate = new Date();
    prevMonthDate.setMonth(now.getMonth() - 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    let thisMonthCount = 0;
    let prevMonthCount = 0;

    filteredRecords.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        thisMonthCount++;
      } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
        prevMonthCount++;
      }
    });

    const monthChange = prevMonthCount > 0 
      ? Math.round(((thisMonthCount - prevMonthCount) / prevMonthCount) * 100)
      : thisMonthCount > 0 ? 100 : 0;

    // Most common procedure
    const procedureCounts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const p = r.procedure || 'Unspecified Procedure';
      procedureCounts[p] = (procedureCounts[p] || 0) + 1;
    });

    let topProcedure = 'N/A';
    let topProcCount = 0;
    Object.entries(procedureCounts).forEach(([proc, cnt]) => {
      if (cnt > topProcCount) {
        topProcCount = cnt;
        topProcedure = proc;
      }
    });

    // Top Diagnosis
    const diagnosisCounts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const diag = r.diagnosis || 'Unspecified';
      if (diag && diag !== 'N/A') {
        diagnosisCounts[diag] = (diagnosisCounts[diag] || 0) + 1;
      }
    });

    let topDiag = 'Normal / Unremarkable';
    let topDiagCount = 0;
    Object.entries(diagnosisCounts).forEach(([diag, cnt]) => {
      if (cnt > topDiagCount) {
        topDiagCount = cnt;
        topDiag = diag;
      }
    });

    // Gender breakdown
    let maleCount = 0;
    let femaleCount = 0;
    filteredRecords.forEach(r => {
      if ((r.gender || '').toLowerCase().startsWith('m')) maleCount++;
      else if ((r.gender || '').toLowerCase().startsWith('f')) femaleCount++;
    });

    return {
      total,
      thisMonthCount,
      prevMonthCount,
      monthChange,
      topProcedure,
      topProcCount,
      topDiag,
      topDiagCount,
      maleCount,
      femaleCount,
      doctorCount: new Set(filteredRecords.map(r => r.doctor).filter(Boolean)).size
    };
  }, [filteredRecords]);

  // Chart 1: Monthly Procedure Volumes Trend
  const monthlyVolumeData = useMemo(() => {
    const monthMap: Record<string, { month: string; total: number; upperGI: number; lowerGI: number; sigmoidoscopy: number; bronchoscopy: number; sortKey: string }> = {};

    filteredRecords.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const sortKey = `${year}-${monthNum}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!monthMap[sortKey]) {
        monthMap[sortKey] = {
          month: monthLabel,
          total: 0,
          upperGI: 0,
          lowerGI: 0,
          sigmoidoscopy: 0,
          bronchoscopy: 0,
          sortKey
        };
      }

      monthMap[sortKey].total += 1;

      const p = (r.procedure || '').toLowerCase();
      if (p.includes('egd') || p.includes('esophag') || p.includes('gastros') || p.includes('upper')) {
        monthMap[sortKey].upperGI += 1;
      } else if (p.includes('sigmo')) {
        monthMap[sortKey].sigmoidoscopy += 1;
      } else if (p.includes('colon') || p.includes('lower') || p.includes('recto')) {
        monthMap[sortKey].lowerGI += 1;
      } else if (p.includes('bronch') || p.includes('lung')) {
        monthMap[sortKey].bronchoscopy += 1;
      }
    });

    const sorted = Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // If less than 2 months of data, generate a smooth trailing month display or show available
    return sorted;
  }, [filteredRecords]);

  // Chart 2: Common Diagnostic Findings Breakdown
  const commonFindingsData = useMemo(() => {
    const findingCategories: Record<string, number> = {
      'Normal Mucosa': 0,
      'Esophageal Varices': 0,
      'Gastric Ulcer': 0,
      'Duodenal Ulcer': 0,
      'Gastritis / GERD': 0,
      'Polyps / Polypectomy': 0,
      'Hemorrhoids': 0,
      'Diverticulosis': 0,
      'Colitis / IBD': 0,
      'Active Bleeding': 0,
      'Stricture / Mass': 0,
      'Other Pathology': 0,
    };

    filteredRecords.forEach(r => {
      const text = `${r.diagnosis || ''} ${r.findings || ''} ${r.esophagusFindings || ''} ${r.stomachFindings || ''} ${r.duodenumFindings || ''} ${r.colonFindings || ''}`.toLowerCase();

      let matched = false;
      if (text.includes('normal') || text.includes('unremarkable')) {
        findingCategories['Normal Mucosa'] += 1;
        matched = true;
      }
      if (text.includes('varic') || text.includes('portal hypertension')) {
        findingCategories['Esophageal Varices'] += 1;
        matched = true;
      }
      if (text.includes('gastric ulcer') || text.includes('stomach ulcer')) {
        findingCategories['Gastric Ulcer'] += 1;
        matched = true;
      }
      if (text.includes('duodenal ulcer') || text.includes('duodenitis')) {
        findingCategories['Duodenal Ulcer'] += 1;
        matched = true;
      }
      if (text.includes('gastritis') || text.includes('esophagitis') || text.includes('reflux') || text.includes('gerd')) {
        findingCategories['Gastritis / GERD'] += 1;
        matched = true;
      }
      if (text.includes('polyp') || text.includes('polypectomy')) {
        findingCategories['Polyps / Polypectomy'] += 1;
        matched = true;
      }
      if (text.includes('hemorrhoid') || text.includes('piles')) {
        findingCategories['Hemorrhoids'] += 1;
        matched = true;
      }
      if (text.includes('divertic')) {
        findingCategories['Diverticulosis'] += 1;
        matched = true;
      }
      if (text.includes('colitis') || text.includes('crohn') || text.includes('ibd')) {
        findingCategories['Colitis / IBD'] += 1;
        matched = true;
      }
      if (text.includes('active bleed') || text.includes('hemorrhage')) {
        findingCategories['Active Bleeding'] += 1;
        matched = true;
      }
      if (text.includes('stricture') || text.includes('mass') || text.includes('lesion') || text.includes('tumor')) {
        findingCategories['Stricture / Mass'] += 1;
        matched = true;
      }

      if (!matched && (r.diagnosis || r.findings)) {
        findingCategories['Other Pathology'] += 1;
      }
    });

    return Object.entries(findingCategories)
      .map(([name, count]) => ({ name, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  // Chart 3: Procedure Distribution Donut
  const procedureDistributionData = useMemo(() => {
    const categories: Record<string, number> = {
      'Upper GI (EGD)': 0,
      'Lower GI (Colonoscopy)': 0,
      'Flexible Bronchoscopy': 0,
      'Sigmoidoscopy': 0,
      'Other Endoscopy': 0,
    };

    filteredRecords.forEach(r => {
      const p = (r.procedure || '').toLowerCase();
      if (p.includes('egd') || p.includes('esophag') || p.includes('gastros') || p.includes('upper')) {
        categories['Upper GI (EGD)'] += 1;
      } else if (p.includes('sigmo')) {
        categories['Sigmoidoscopy'] += 1;
      } else if (p.includes('colon') || p.includes('lower')) {
        categories['Lower GI (Colonoscopy)'] += 1;
      } else if (p.includes('bronch') || p.includes('lung')) {
        categories['Flexible Bronchoscopy'] += 1;
      } else {
        categories['Other Endoscopy'] += 1;
      }
    });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [filteredRecords]);

  // Chart 4: Endoscopist Workload Bar Chart
  const doctorWorkloadData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const doc = r.doctor || 'Unassigned';
      map[doc] = (map[doc] || 0) + 1;
    });

    return Object.entries(map)
      .map(([doctor, count]) => ({ doctor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 doctors
  }, [filteredRecords]);

  // Max and Min values for Physician Workload color indications (Top, Middle, Lowest)
  const maxDoctorWorkload = useMemo(() => {
    if (!doctorWorkloadData || doctorWorkloadData.length === 0) return 0;
    return Math.max(...doctorWorkloadData.map(d => d.count));
  }, [doctorWorkloadData]);

  const minDoctorWorkload = useMemo(() => {
    if (!doctorWorkloadData || doctorWorkloadData.length === 0) return 0;
    return Math.min(...doctorWorkloadData.map(d => d.count));
  }, [doctorWorkloadData]);

  // Max and Min values for Common Diagnostic Findings color indications
  const maxFindingCount = useMemo(() => {
    if (!commonFindingsData || commonFindingsData.length === 0) return 0;
    return Math.max(...commonFindingsData.map(d => d.count));
  }, [commonFindingsData]);

  const minFindingCount = useMemo(() => {
    if (!commonFindingsData || commonFindingsData.length === 0) return 0;
    return Math.min(...commonFindingsData.map(d => d.count));
  }, [commonFindingsData]);

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-2xl shadow-md shadow-red-500/20 ring-2 ring-red-100 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3c-3.5 0-6.5 2.2-7.5 5.5C3.3 12 3 15.5 4.8 19c1.8 3.5 5.2 5 8.7 5 4.5 0 7.5-3 7.5-7.5 0-3.5-2.2-6.5-5.5-7.5" strokeWidth="2" opacity="0.9" />
                <circle cx="17.5" cy="6.5" r="3" strokeWidth="2" fill="currentColor" fillOpacity="0.2" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
                <path d="M14 9l-4 4" strokeWidth="2.2" />
                <path d="M7 6c1.2 1.5 2.8 2.2 4.5 2.2" strokeWidth="1.8" strokeDasharray="2 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <span>Endoscopy Clinical Analytics & Intelligence</span>
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time monitoring of procedure volumes, monthly trends, diagnostic pathology distributions, and physician productivity.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="px-2 text-[10px] font-black uppercase text-slate-400">Range:</span>
              {(['all', 'ytd', '6m', '3m'] as TimeFrame[]).map(tf => (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeFrame(tf);
                    if (tf !== 'all') {
                      setSelectedYear('all');
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    timeFrame === tf && selectedYear === 'all'
                      ? 'bg-white text-orange-700 shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf === 'all' ? 'All Time' : tf === 'ytd' ? `YTD ${new Date().getFullYear()}` : tf === '6m' ? 'Last 6 Mo' : 'Last 3 Mo'}
                </button>
              ))}
            </div>

            {/* Year Selector Dropdown */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                if (e.target.value !== 'all') {
                  setTimeFrame('all');
                }
              }}
              className={`px-3 py-1.5 border rounded-xl font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer ${
                selectedYear !== 'all'
                  ? 'bg-orange-50 border-orange-300 text-orange-800 ring-1 ring-orange-200'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">All Years ({availableYears.length})</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={procedureFilter}
              onChange={(e) => setProcedureFilter(e.target.value as ProcedureFilter)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer"
            >
              <option value="all">All Procedure Types</option>
              <option value="upper_gi">Upper GI (EGD)</option>
              <option value="lower_gi">Lower GI (Colonoscopy)</option>
              <option value="sigmoidoscopy">Sigmoidoscopy</option>
              <option value="pulmonary">Flexible Bronchoscopy</option>
            </select>

            {/* Doctor Filter */}
            {doctorsList.length > 0 && (
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer"
              >
                <option value="all">All Endoscopists ({doctorsList.length})</option>
                {doctorsList.map(doc => (
                  <option key={doc} value={doc}>{doc}</option>
                ))}
              </select>
            )}
          </div>

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">{filteredRecords.length}</span> Records
          </div>
        </div>
      </div>

      {/* KPI Cards & Charts Skeleton Grid */}
      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="w-8 h-8 bg-slate-100 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-24 bg-slate-200 rounded-md" />
                  <div className="h-3 w-36 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Bar Chart Skeleton */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                      Loading
                    </span>
                  </div>
                  <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="h-72 w-full relative flex flex-col justify-between pt-4">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="border-b border-dashed border-slate-100 w-full" />
                  ))}
                </div>
                <div className="relative z-10 w-full h-full flex items-end justify-between gap-2 pt-4">
                  {[30, 50, 75, 40, 85, 60, 95, 70, 45, 80, 65, 50].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div 
                        className="w-full bg-gradient-to-t from-slate-200 via-slate-300 to-slate-200 rounded-t-lg animate-pulse" 
                        style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} 
                      />
                      <div className="h-2 w-6 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pie Chart Skeleton */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-72 w-full flex flex-col items-center justify-center space-y-4">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[18px] border-slate-100 animate-pulse" />
                  <div className="absolute inset-2 rounded-full border-[18px] border-orange-200/60 border-t-orange-500 animate-spin" />
                  <div className="w-12 h-12 bg-white rounded-full shadow-inner flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  {[1, 2, 3].map(k => (
                    <div key={k} className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Horizontal Bar Chart Skeleton */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="h-4 w-56 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-72 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="h-80 w-full flex flex-col justify-around pt-2">
                {[70, 50, 85, 40, 60].map((w, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-3 w-28 bg-slate-200 rounded shrink-0 animate-pulse" />
                    <div 
                      className="h-6 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 rounded-r-lg animate-pulse" 
                      style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Doctor Workload Bar Chart Skeleton */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-20 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-80 w-full flex items-end justify-between gap-3 pt-6">
                {[45, 70, 35, 90, 60].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div 
                      className="w-full bg-gradient-to-t from-slate-200 via-slate-300 to-slate-200 rounded-t-lg animate-pulse" 
                      style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }} 
                    />
                    <div className="h-2 w-10 bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Procedures */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-orange-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Procedures</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {metrics.total}
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                metrics.monthChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {metrics.monthChange >= 0 ? `+${metrics.monthChange}%` : `${metrics.monthChange}%`}
              </span>
              <span className="text-[10px] font-bold text-slate-400">vs. last month ({metrics.thisMonthCount} this month)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Most Common Procedure */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Leading Procedure</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight line-clamp-1 uppercase" title={metrics.topProcedure}>
              {metrics.topProcedure}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-1">
              <span className="text-indigo-600 font-extrabold">{metrics.topProcCount}</span> cases ({metrics.total ? Math.round((metrics.topProcCount / metrics.total) * 100) : 0}% of volume)
            </div>
          </div>
        </div>

        {/* Card 3: Top Diagnostic Finding */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Top Pathology / Finding</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight line-clamp-1 uppercase" title={metrics.topDiag}>
              {metrics.topDiag}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-1">
              <span className="text-amber-600 font-extrabold">{metrics.topDiagCount}</span> diagnoses logged
            </div>
          </div>
        </div>

        {/* Card 4: Demographics & Physicians */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clinical Coverage</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Active Endoscopists:</span>
              <span className="text-purple-600 font-black">{metrics.doctorCount}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mt-1">
              <span>Male / Female Ratio:</span>
              <span className="text-slate-800 font-bold">{metrics.maleCount} M : {metrics.femaleCount} F</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section (Row 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Monthly Volume Trend (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Monthly Procedure Volume Trend
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                Tracking monthly endoscopy case counts across GI & Pulmonary procedures
              </p>
            </div>
            <span className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[9px] font-black uppercase">
              Monthly Volume
            </span>
          </div>

          {monthlyVolumeData.length > 0 ? (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomVolumeTooltip />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                  />
                  <Bar 
                    dataKey="upperGI" 
                    name="Upper GI (EGD)" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="lowerGI" 
                    name="Lower GI (Colonoscopy)" 
                    fill="#ec4899" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="sigmoidoscopy" 
                    name="Sigmoidoscopy" 
                    fill="#f59e0b" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="bronchoscopy" 
                    name="Flexible Bronchoscopy" 
                    fill="#8b5cf6" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="total" 
                    name="Total Procedures" 
                    fill="#f97316" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-xs font-bold uppercase tracking-wider">No Monthly Volume Data Logged Yet</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Save endoscopy reports to generate live analytical charts.</p>
            </div>
          )}
        </div>

        {/* Chart 2: Procedure Type Breakdown Donut Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Procedure Mix
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                Share by endoscopy category
              </p>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black uppercase">
              Distribution
            </span>
          </div>

          {procedureDistributionData.length > 0 ? (
            <div className="h-72 w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <PieComponent
                    activeIndex={activePieIndex}
                    activeShape={renderActivePieShape}
                    data={procedureDistributionData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    onMouseEnter={(_: any, index: number) => setActivePieIndex(index)}
                    onMouseLeave={() => setActivePieIndex(undefined)}
                  >
                    {procedureDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </PieComponent>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '8px 12px'
                    }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider">No Mix Data</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Common Diagnostic Findings & Physician Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: Common Diagnostic Findings (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Common Diagnostic Findings & Pathologies
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                Frequency of clinical diagnoses (Varices, Ulcers, Polyps, Bleeding, Normal, etc.)
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider shrink-0">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Top
              </span>
              <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Middle
              </span>
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Lowest
              </span>
            </div>
          </div>

          {commonFindingsData.length > 0 ? (
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={commonFindingsData} 
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    allowDecimals={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#334155', fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    width={130}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '8px 12px'
                    }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" name="Case Count" radius={[0, 8, 8, 0]}>
                    {commonFindingsData.map((entry, index) => {
                      let fill = '#6366f1';
                      if (maxFindingCount > minFindingCount) {
                        if (entry.count === maxFindingCount) fill = '#10b981'; // Top Peak (Emerald Green)
                        else if (entry.count === minFindingCount) fill = '#f59e0b'; // Lowest (Amber)
                        else fill = '#6366f1'; // Middle (Indigo)
                      }
                      return <Cell key={`cell-finding-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="text-xs font-bold uppercase tracking-wider">No Pathological Findings Logged</p>
            </div>
          )}
        </div>

        {/* Chart 4: Physician Workload Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Physician Workload
              </h3>
              <p className="text-[10px] font-medium text-slate-500">
                Procedures performed per doctor
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider shrink-0">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Top
              </span>
              <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Middle
              </span>
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Lowest
              </span>
            </div>
          </div>

          {doctorWorkloadData.length > 0 ? (
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorWorkloadData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="doctor" 
                    tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '8px 12px'
                    }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" name="Procedures" radius={[6, 6, 0, 0]}>
                    {doctorWorkloadData.map((entry, index) => {
                      let fill = '#6366f1';
                      if (maxDoctorWorkload > minDoctorWorkload) {
                        if (entry.count === maxDoctorWorkload) fill = '#10b981'; // Top Performer (Emerald Green)
                        else if (entry.count === minDoctorWorkload) fill = '#f59e0b'; // Lowest (Amber)
                        else fill = '#6366f1'; // Middle (Indigo)
                      }
                      return <Cell key={`cell-doc-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider">No Physician Data</p>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Findings Summary Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Clinical Findings & Diagnostic Summary Table
            </h3>
            <p className="text-[10px] font-medium text-slate-500">
              Structured summary of recorded findings grouped by clinical categories
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-widest border-b border-slate-200">
                <th className="px-4 py-3 border-b border-slate-200 rounded-tl-xl">Clinical Finding Category</th>
                <th className="px-4 py-3 border-b border-slate-200">Recorded Cases</th>
                <th className="px-4 py-3 border-b border-slate-200">% Total Share</th>
                <th className="px-4 py-3 border-b border-slate-200">Clinical Recommendation / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
              {commonFindingsData.length > 0 ? (
                commonFindingsData.map((item, idx) => {
                  const share = metrics.total ? Math.round((item.count / metrics.total) * 100) : 0;
                  let recommendation = "Routine clinical follow-up as indicated.";
                  if (item.name.includes("Varices")) recommendation = "Consider beta-blockers or EVL banding follow-up.";
                  else if (item.name.includes("Ulcer")) recommendation = "PPI therapy + H. pylori testing / eradication.";
                  else if (item.name.includes("Polyp")) recommendation = "Histopathology review & surveillance colonoscopy.";
                  else if (item.name.includes("Bleeding")) recommendation = "Hemostasis verification & Hb monitoring.";
                  else if (item.name.includes("Normal")) recommendation = "Reassure patient; no immediate endoscopic follow-up required.";

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span>{item.name}</span>
                      </td>
                      <td className="px-4 py-3.5 font-black text-slate-800">{item.count}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                          </div>
                          <span className="text-[10px] font-black text-slate-600">{share}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-[10px] font-medium">{recommendation}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold uppercase text-xs">
                    No clinical findings recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
