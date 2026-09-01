import React, { useState, useMemo } from 'react';
import { UserActivity } from '../services/activityService';
import {
  Calendar,
  Flame,
  Clock,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart2,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ActivityCalendarHeatmapProps {
  activities: UserActivity[];
  selectedDate?: string;
  onSelectDate: (dateStr: string | null) => void;
  className?: string;
}

interface DayData {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  month: number;
  total: number;
  clinical: number;
  auth: number;
  config: number;
  failures: number;
  users: Set<string>;
  peakHour?: number;
  hourDistribution: number[]; // 24 hours
}

const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ActivityCalendarHeatmap: React.FC<ActivityCalendarHeatmapProps> = ({
  activities,
  selectedDate,
  onSelectDate,
  className = ''
}) => {
  // Range view: 12 weeks, 16 weeks, or 24 weeks
  const [rangeWeeks, setRangeWeeks] = useState<12 | 16 | 24>(16);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'CLINICAL' | 'AUTH_SESSION' | 'CONFIG_PERSISTENCE'>('ALL');
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  // Parse activities into aggregated daily map
  const dailyActivityMap = useMemo(() => {
    const map = new Map<string, DayData>();

    activities.forEach(act => {
      // Category filter inside heatmap
      if (selectedCategory === 'CLINICAL') {
        const isClinical = act.category === 'CLINICAL' || act.action === 'CREATE' || act.action === 'MODIFY' || act.action === 'DELETE';
        if (!isClinical) return;
      } else if (selectedCategory === 'AUTH_SESSION') {
        const isAuth = act.category === 'AUTH_SESSION' || act.action.startsWith('AUTH_') || act.action === 'SESSION_RESTORE';
        if (!isAuth) return;
      } else if (selectedCategory === 'CONFIG_PERSISTENCE') {
        const isConfig = act.category === 'CONFIG_PERSISTENCE' || act.action.startsWith('CONFIG_') || act.action === 'STORAGE_SYNC';
        if (!isConfig) return;
      }

      const timestamp = new Date(act.timestamp);
      if (isNaN(timestamp.getTime())) return;

      const dateStr = formatLocalDate(timestamp);
      const hour = timestamp.getHours();

      if (!map.has(dateStr)) {
        map.set(dateStr, {
          date: new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()),
          dateStr,
          dayOfWeek: timestamp.getDay(),
          month: timestamp.getMonth(),
          total: 0,
          clinical: 0,
          auth: 0,
          config: 0,
          failures: 0,
          users: new Set<string>(),
          hourDistribution: new Array(24).fill(0)
        });
      }

      const entry = map.get(dateStr)!;
      entry.total++;
      entry.hourDistribution[hour] = (entry.hourDistribution[hour] || 0) + 1;
      if (act.performedBy) entry.users.add(act.performedBy);

      const isClinical = act.category === 'CLINICAL' || act.action === 'CREATE' || act.action === 'MODIFY' || act.action === 'DELETE';
      const isAuth = act.category === 'AUTH_SESSION' || act.action.startsWith('AUTH_') || act.action === 'SESSION_RESTORE';
      const isConfig = act.category === 'CONFIG_PERSISTENCE' || act.action.startsWith('CONFIG_') || act.action === 'STORAGE_SYNC';
      const isFail = act.status === 'ERROR' || act.status === 'WARNING' || act.action === 'AUTH_FAILED' || act.action === 'CONFIG_FAIL';

      if (isClinical) entry.clinical++;
      if (isAuth) entry.auth++;
      if (isConfig) entry.config++;
      if (isFail) entry.failures++;
    });

    // Calculate peak hour for days with activity
    map.forEach(entry => {
      let maxH = 0;
      let maxCount = 0;
      entry.hourDistribution.forEach((cnt, h) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          maxH = h;
        }
      });
      entry.peakHour = maxCount > 0 ? maxH : undefined;
    });

    return map;
  }, [activities, selectedCategory]);

  // Generate calendar grid array based on rangeWeeks ending at today
  const { weeks, monthLabels, stats } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = (rangeWeeks || 16) * 7;
    
    // Find the end date: end of current week (Sunday)
    // 0=Sun, 1=Mon, ..., 6=Sat
    // Row mapping: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    const currentDayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const daysUntilEndOfWeek = 6 - currentDayOfWeek;
    
    const calendarEndDate = new Date(today);
    calendarEndDate.setDate(today.getDate() + daysUntilEndOfWeek);

    const calendarStartDate = new Date(calendarEndDate);
    calendarStartDate.setDate(calendarEndDate.getDate() - totalDays + 1);

    const weeksArray: DayData[][] = [];
    let currentWeek: DayData[] = [];
    const monthHeaderPositions: { monthName: string; weekIndex: number }[] = [];
    let lastSeenMonth = -1;

    let totalRecordedDays = 0;
    let maxDayCount = 0;
    let busiestDate: string | null = null;
    let currentStreak = 0;
    let streakCount = 0;
    let totalEventsInRange = 0;

    const iterDate = new Date(calendarStartDate);
    let weekIdx = 0;

    while (iterDate <= calendarEndDate) {
      const dateStr = formatLocalDate(iterDate);
      const isFuture = iterDate.getTime() > today.getTime();

      const existingData = dailyActivityMap.get(dateStr);
      const dayData: DayData = existingData || {
        date: new Date(iterDate),
        dateStr,
        dayOfWeek: iterDate.getDay(),
        month: iterDate.getMonth(),
        total: 0,
        clinical: 0,
        auth: 0,
        config: 0,
        failures: 0,
        users: new Set<string>(),
        hourDistribution: new Array(24).fill(0)
      };

      if (!isFuture && dayData.total > 0) {
        totalRecordedDays++;
        totalEventsInRange += dayData.total;
        if (dayData.total > maxDayCount) {
          maxDayCount = dayData.total;
          busiestDate = dateStr;
        }
      }

      // Check month header marker on the first week it appears
      if (iterDate.getMonth() !== lastSeenMonth && iterDate.getDate() <= 7) {
        const monthName = iterDate.toLocaleString('default', { month: 'short' });
        monthHeaderPositions.push({ monthName, weekIndex: weekIdx });
        lastSeenMonth = iterDate.getMonth();
      }

      currentWeek.push(dayData);

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      iterDate.setDate(iterDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }

    // Calculate active streak working backwards from today
    const checkStreakDate = new Date(today);
    while (true) {
      const dStr = formatLocalDate(checkStreakDate);
      const entry = dailyActivityMap.get(dStr);
      if (entry && entry.total > 0) {
        streakCount++;
        checkStreakDate.setDate(checkStreakDate.getDate() - 1);
      } else {
        // If today has 0, check if yesterday had activity before breaking
        if (checkStreakDate.getTime() === today.getTime()) {
          checkStreakDate.setDate(checkStreakDate.getDate() - 1);
          const yestStr = formatLocalDate(checkStreakDate);
          const yestEntry = dailyActivityMap.get(yestStr);
          if (yestEntry && yestEntry.total > 0) {
            streakCount++;
            checkStreakDate.setDate(checkStreakDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    currentStreak = streakCount;

    return {
      weeks: weeksArray,
      monthLabels: monthHeaderPositions,
      stats: {
        totalRecordedDays,
        totalEventsInRange,
        maxDayCount,
        busiestDate,
        currentStreak,
        avgPerActiveDay: totalRecordedDays > 0 ? (totalEventsInRange / totalRecordedDays).toFixed(1) : '0'
      }
    };
  }, [dailyActivityMap, rangeWeeks]);

  // Color intensity scale for heatmap
  const getIntensityClass = (count: number, isFuture: boolean, isSelected: boolean) => {
    if (isFuture) {
      return 'bg-slate-50 border-slate-100 opacity-30 cursor-not-allowed';
    }

    let baseBg = '';
    let border = 'border-slate-200';

    if (count === 0) {
      baseBg = 'bg-slate-100 hover:bg-slate-200 text-slate-400';
    } else if (count <= 2) {
      baseBg = 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300';
      border = 'border-emerald-300';
    } else if (count <= 5) {
      baseBg = 'bg-emerald-300 hover:bg-emerald-400 text-emerald-950 border-emerald-400';
      border = 'border-emerald-400';
    } else if (count <= 10) {
      baseBg = 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600';
      border = 'border-emerald-600';
    } else {
      baseBg = 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 shadow-xs';
      border = 'border-emerald-800';
    }

    if (isSelected) {
      return `${baseBg} ring-2 ring-indigo-600 ring-offset-1 z-10 font-bold scale-110 shadow-sm`;
    }

    return `${baseBg} ${border}`;
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = new Date().toISOString().slice(0, 10);

  const formatHourLabel = (h?: number) => {
    if (h === undefined) return 'N/A';
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:00 ${period}`;
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 ${className}`}>
      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Clinical Activity & Recording Heatmap
              </h3>
              <span className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-200">
                Pattern Matrix
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Visual telemetry showing recording density, shift activity, and clinician workflow streaks.
            </p>
          </div>
        </div>

        {/* View Range & Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[10px] font-black uppercase">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedCategory === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedCategory('CLINICAL')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedCategory === 'CLINICAL' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clinical
            </button>
            <button
              onClick={() => setSelectedCategory('AUTH_SESSION')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedCategory === 'AUTH_SESSION' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Auth
            </button>
          </div>

          {/* Time Horizon Selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[10px] font-black uppercase">
            <button
              onClick={() => setRangeWeeks(12)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                rangeWeeks === 12 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Wks
            </button>
            <button
              onClick={() => setRangeWeeks(16 as any)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                rangeWeeks === 16 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              16 Wks
            </button>
            <button
              onClick={() => setRangeWeeks(24)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                rangeWeeks === 24 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              24 Wks
            </button>
          </div>

          {/* Clear Selected Day button if active */}
          {selectedDate && (
            <button
              onClick={() => onSelectDate(null)}
              className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
              title="Reset day filter to show all logs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Date ({selectedDate})</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Activity Streak</span>
            <span className="text-xs font-black text-slate-800">{stats.currentStreak} Consecutive Days</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Active Days</span>
            <span className="text-xs font-black text-slate-800">{stats.totalRecordedDays} Days Logged</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Daily Average</span>
            <span className="text-xs font-black text-slate-800">{stats.avgPerActiveDay} Records / Day</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Peak Recording</span>
            <span className="text-xs font-black text-slate-800">
              {stats.maxDayCount > 0 ? `${stats.maxDayCount} Events (${stats.busiestDate})` : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Matrix Grid */}
      <div className="overflow-x-auto pb-2 pt-1 scrollbar-thin">
        <div className="inline-block min-w-full">
          {/* Month Labels Header */}
          <div className="flex items-center ml-10 mb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {monthLabels.map((lbl, idx) => (
              <span
                key={idx}
                style={{
                  minWidth: `${(weeks.length / monthLabels.length) * 16}px`,
                  textAlign: 'left'
                }}
                className="truncate pr-4"
              >
                {lbl.monthName}
              </span>
            ))}
          </div>

          {/* Heatmap Row by Day of Week (0=Mon to 6=Sun) */}
          <div className="flex flex-col gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const showLabel = dayIdx === 0 || dayIdx === 2 || dayIdx === 4 || dayIdx === 6; // Mon, Wed, Fri, Sun
              return (
                <div key={dayIdx} className="flex items-center gap-1.5">
                  {/* Day of Week Label */}
                  <span className="w-8 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right select-none pr-1">
                    {showLabel ? dayLabels[dayIdx] : ''}
                  </span>

                  {/* Weeks Columns */}
                  <div className="flex items-center gap-1">
                    {weeks.map((week, wIdx) => {
                      const day = week[dayIdx];
                      if (!day) return <div key={wIdx} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />;

                      const isToday = day.dateStr === todayStr;
                      const isSelected = selectedDate === day.dateStr;
                      const isFuture = day.date > new Date();

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          disabled={isFuture}
                          onClick={() => {
                            if (isSelected) {
                              onSelectDate(null);
                            } else {
                              onSelectDate(day.dateStr);
                            }
                          }}
                          onMouseEnter={() => !isFuture && setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3.5px] border transition-all duration-150 relative cursor-pointer ${getIntensityClass(
                            day.total,
                            isFuture,
                            isSelected
                          )} ${isToday ? 'outline-1 outline-slate-900 outline-offset-1' : ''}`}
                          title={`${day.dateStr}: ${day.total} activities (Click to filter)`}
                        >
                          {isToday && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Hover Details Card & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
        {/* Dynamic Hovered or Selected Day Inspection */}
        <div className="flex items-center gap-2 min-h-[28px]">
          {hoveredDay ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="font-black text-slate-900">
                {hoveredDay.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}:
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                {hoveredDay.total} Activities
              </span>
              {hoveredDay.clinical > 0 && (
                <span className="text-slate-600 text-[10px]">
                  • <strong>{hoveredDay.clinical}</strong> Clinical
                </span>
              )}
              {hoveredDay.auth > 0 && (
                <span className="text-slate-600 text-[10px]">
                  • <strong>{hoveredDay.auth}</strong> Auth
                </span>
              )}
              {hoveredDay.failures > 0 && (
                <span className="text-rose-600 font-bold text-[10px]">
                  • <strong>{hoveredDay.failures}</strong> Warnings
                </span>
              )}
              {hoveredDay.peakHour !== undefined && (
                <span className="text-purple-700 text-[10px] font-medium flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Peak: {formatHourLabel(hoveredDay.peakHour)}
                </span>
              )}
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                [Click cell to filter table]
              </span>
            </div>
          ) : selectedDate ? (
            <div className="flex items-center gap-2 text-[11px] bg-indigo-50 text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-200 font-bold">
              <span>Filter active for date: {selectedDate}</span>
              <button
                onClick={() => onSelectDate(null)}
                className="text-xs text-indigo-600 hover:text-indigo-900 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 italic flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              Hover over any square for shift details, or click a date to filter the activity stream below.
            </span>
          )}
        </div>

        {/* Legend Scale */}
        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0 self-end sm:self-center">
          <span>Less</span>
          <span className="w-3 h-3 rounded-[2.5px] bg-slate-100 border border-slate-200 inline-block" title="0 events" />
          <span className="w-3 h-3 rounded-[2.5px] bg-emerald-100 border border-emerald-300 inline-block" title="1-2 events" />
          <span className="w-3 h-3 rounded-[2.5px] bg-emerald-300 border border-emerald-400 inline-block" title="3-5 events" />
          <span className="w-3 h-3 rounded-[2.5px] bg-emerald-500 border border-emerald-600 inline-block" title="6-10 events" />
          <span className="w-3 h-3 rounded-[2.5px] bg-emerald-700 border border-emerald-800 inline-block" title="11+ events" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
