import React, { useState, useMemo } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  CalendarRange,
  TrendingUp,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Building2,
  PieChart,
  BarChart3,
  Award,
  Sparkles,
  Filter,
  Layers,
  ArrowUpDown,
  AlertTriangle,
  UserCheck,
  Shield,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import { generateAiReportNarrative } from '../services/ai';
import { GrievanceCase } from '../types';

interface ReportsViewProps {
  initialType?: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
}

type ReportPeriodType = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({ initialType = 'weekly' }) => {
  const [reportType, setReportType] = useState<ReportPeriodType>(initialType);
  const { cases, handleExport } = useCases();
  const { currentUser } = useAuth();

  // Helper date conversions (DD/MM/YYYY)
  const formatIsoToDmY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseDmYToIso = (dmyStr: string): string => {
    const parts = dmyStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dmyStr;
  };

  const today = new Date();
  const defaultStartDate = new Date(today.getTime() - 30 * 86400000);
  const [customStartDmY, setCustomStartDmY] = useState<string>(formatIsoToDmY(defaultStartDate));
  const [customEndDmY, setCustomEndDmY] = useState<string>(formatIsoToDmY(today));

  // AI Narrative State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);

  // Group strictly by Grievance Date (c.dateReceived)
  const filteredCases = useMemo(() => {
    const now = new Date();

    if (reportType === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
      const startIso = oneWeekAgo.toISOString().substring(0, 10);
      return cases.filter((c) => (c.dateReceived || '') >= startIso);
    }
    if (reportType === 'monthly') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000);
      const startIso = oneMonthAgo.toISOString().substring(0, 10);
      return cases.filter((c) => (c.dateReceived || '') >= startIso);
    }
    if (reportType === 'quarterly') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000);
      const startIso = threeMonthsAgo.toISOString().substring(0, 10);
      return cases.filter((c) => (c.dateReceived || '') >= startIso);
    }
    if (reportType === 'annual') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10);
      return cases.filter((c) => (c.dateReceived || '') >= startOfYear);
    }
    if (reportType === 'custom') {
      const startIso = parseDmYToIso(customStartDmY);
      const endIso = parseDmYToIso(customEndDmY);
      return cases.filter((c) => {
        if (!c.dateReceived) return true;
        return c.dateReceived >= startIso && c.dateReceived <= endIso;
      });
    }

    return cases;
  }, [cases, reportType, customStartDmY, customEndDmY]);

  // Overall counts
  const totalCases = filteredCases.length;
  const closedCases = filteredCases.filter((c) => c.status === 'Closed');
  const openCases = filteredCases.filter((c) => c.status !== 'Closed');
  const overdueCases = filteredCases.filter((c) => c.slaStatus === 'Overdue');
  const onTrackCases = filteredCases.filter((c) => c.slaStatus !== 'Overdue');
  const slaComplianceRate = totalCases > 0 ? Math.round((onTrackCases.length / totalCases) * 100) : 100;

  // 10. RESOLUTION PERFORMANCE INDICATORS
  // Average Resolution Time (in Days): Calculated from dateReceived (Grievance Date) to closingDate for Closed cases
  const avgResolutionTimeDays = useMemo(() => {
    if (closedCases.length === 0) return 0;
    let totalDays = 0;
    closedCases.forEach((c) => {
      const start = new Date(c.dateReceived).getTime();
      const end = c.closingDate ? new Date(c.closingDate).getTime() : new Date(c.lastUpdate || c.dateReceived).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / 86400000));
      totalDays += diffDays;
    });
    return Number((totalDays / closedCases.length).toFixed(1));
  }, [closedCases]);

  // Resolution Time by Department
  const resolutionTimeByDept = useMemo(() => {
    const map: Record<string, { totalDays: number; count: number }> = {};
    closedCases.forEach((c) => {
      const start = new Date(c.dateReceived).getTime();
      const end = c.closingDate ? new Date(c.closingDate).getTime() : new Date(c.lastUpdate || c.dateReceived).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / 86400000));
      if (!map[c.department]) map[c.department] = { totalDays: 0, count: 0 };
      map[c.department].totalDays += diffDays;
      map[c.department].count += 1;
    });
    return Object.entries(map).map(([dept, data]) => ({
      dept,
      avgDays: Number((data.totalDays / data.count).toFixed(1)),
      count: data.count,
    })).sort((a, b) => a.avgDays - b.avgDays);
  }, [closedCases]);

  // Resolution Time by Category
  const resolutionTimeByCategory = useMemo(() => {
    const map: Record<string, { totalDays: number; count: number }> = {};
    closedCases.forEach((c) => {
      const start = new Date(c.dateReceived).getTime();
      const end = c.closingDate ? new Date(c.closingDate).getTime() : new Date(c.lastUpdate || c.dateReceived).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / 86400000));
      if (!map[c.complaintCategory]) map[c.complaintCategory] = { totalDays: 0, count: 0 };
      map[c.complaintCategory].totalDays += diffDays;
      map[c.complaintCategory].count += 1;
    });
    return Object.entries(map).map(([category, data]) => ({
      category,
      avgDays: Number((data.totalDays / data.count).toFixed(1)),
      count: data.count,
    })).sort((a, b) => a.avgDays - b.avgDays);
  }, [closedCases]);

  // 9. RANKING ANALYSIS
  // 1. Ranking Case by Category
  const rankingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCases.forEach((c) => {
      map[c.complaintCategory] = (map[c.complaintCategory] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalCases > 0 ? Math.round((count / totalCases) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCases, totalCases]);

  // 2. Ranking Department PIC by Case Volume
  const rankingByPic = useMemo(() => {
    const map: Record<string, { count: number; department: string }> = {};
    filteredCases.forEach((c) => {
      const pic = c.assignedPic || 'Unassigned PIC';
      if (!map[pic]) map[pic] = { count: 0, department: c.department };
      map[pic].count += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        department: data.department,
        count: data.count,
        percentage: totalCases > 0 ? Math.round((data.count / totalCases) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCases, totalCases]);

  // 3. Ranking Department by Grievance Volume
  const rankingByDepartment = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCases.forEach((c) => {
      map[c.department] = (map[c.department] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalCases > 0 ? Math.round((count / totalCases) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCases, totalCases]);

  // 4. Ranking Repeat Grievance Categories (categories occurring >= 2 times)
  const rankingRepeatCategories = useMemo(() => {
    return rankingByCategory.filter((item) => item.count >= 2);
  }, [rankingByCategory]);

  // 8. REPORT CHARTS DATA (DYNAMIC)
  // Chart: Priority
  const chartPriority = useMemo(() => {
    const map = { Critical: 0, Major: 0, Minor: 0 };
    filteredCases.forEach((c) => {
      if (c.priority in map) map[c.priority as keyof typeof map] += 1;
    });
    return Object.entries(map).map(([priority, count]) => ({ priority, count }));
  }, [filteredCases]);

  // Chart: Instrument / Channel Received
  const chartInstrument = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCases.forEach((c) => {
      const channel = c.channelReceived || 'Direct Intake';
      map[channel] = (map[channel] || 0) + 1;
    });
    return Object.entries(map).map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count);
  }, [filteredCases]);

  // Chart: Status
  const chartStatus = useMemo(() => {
    const map = { Open: 0, Investigation: 0, 'Action Taken': 0, Closed: 0 };
    filteredCases.forEach((c) => {
      if (c.status in map) map[c.status as keyof typeof map] += 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [filteredCases]);

  // Chart: Monthly Trends (last 6 months by Grievance Date)
  const chartMonthlyTrends = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCases.forEach((c) => {
      if (!c.dateReceived) return;
      const monthKey = c.dateReceived.substring(0, 7); // YYYY-MM
      map[monthKey] = (map[monthKey] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  }, [filteredCases]);

  // AI Narrative Generator
  const handleGenerateAiNarrative = async () => {
    setIsGeneratingAi(true);
    try {
      const periodLabel =
        reportType === 'weekly'
          ? 'Weekly (Mingguan)'
          : reportType === 'monthly'
          ? 'Monthly (Bulanan)'
          : reportType === 'quarterly'
          ? 'Quarterly (Kuartalan)'
          : reportType === 'annual'
          ? 'Annual (Tahunan)'
          : `Custom Range (${customStartDmY} s/d ${customEndDmY})`;

      const result = await generateAiReportNarrative(
        periodLabel,
        {
          total: totalCases,
          closed: closedCases.length,
          complianceRate: slaComplianceRate,
          critical: chartPriority.find((p) => p.priority === 'Critical')?.count || 0,
        },
        rankingByCategory.slice(0, 4),
        rankingByDepartment.slice(0, 4)
      );
      setAiNarrative(result);
    } catch (err) {
      console.warn('AI narrative error:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getPeriodTitle = () => {
    switch (reportType) {
      case 'weekly':
        return 'Laporan Mingguan (Weekly Report - 7 Hari Terakhir)';
      case 'monthly':
        return 'Laporan Bulanan (Monthly Report - 30 Hari Terakhir)';
      case 'quarterly':
        return 'Laporan Kuartalan (Quarterly Report - 90 Hari Terakhir)';
      case 'annual':
        return `Laporan Tahunan (Annual Report - Tahun ${today.getFullYear()})`;
      case 'custom':
        return `Laporan Rentang Kustom (${customStartDmY} s/d ${customEndDmY})`;
    }
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Top Corporate Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Weekly, Monthly &amp; Annual Corporate Report</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Grievance Date Based
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelompokan data berbasis <strong>Grievance Date</strong> (bukan tanggal input). Layout formal tanpa investigator name dan tanpa signature.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setReportType('weekly')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'weekly' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'monthly' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setReportType('quarterly')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'quarterly' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setReportType('annual')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'annual' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setReportType('custom')}
              className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1 ${
                reportType === 'custom' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Custom Range</span>
            </button>
          </div>

          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF / Cetak</span>
          </button>
        </div>
      </div>

      {/* Date Pickers for Custom Date Range */}
      {reportType === 'custom' && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs flex flex-wrap items-center gap-4 bg-blue-50/30 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Tentukan Rentang Tanggal Keluhan (DD/MM/YYYY):</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Start Date:</span>
            <input
              type="text"
              value={customStartDmY}
              onChange={(e) => setCustomStartDmY(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="px-2.5 py-1 text-xs rounded border border-slate-300 font-mono w-28 bg-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">End Date:</span>
            <input
              type="text"
              value={customEndDmY}
              onChange={(e) => setCustomEndDmY(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="px-2.5 py-1 text-xs rounded border border-slate-300 font-mono w-28 bg-white"
            />
          </div>

          <span className="text-xs text-slate-500 italic">
            *Menyaring keluhan yang terjadi antara tanggal di atas.
          </span>
        </div>
      )}

      {/* Printable Corporate Document Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Corporate Header SJI */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                PT Shoenary Javanesia Inc.
              </span>
              <span className="text-xs font-bold text-slate-500">HR Department Compliance</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {getPeriodTitle()}
            </h1>
            <p className="text-xs text-slate-600">
              Basis Pengelompokan: <strong>Grievance Date (Tanggal Keluhan)</strong> • Standar Audit &amp; Kepatuhan Hubungan Industrial
            </p>
          </div>

          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <div>Waktu Generate: <strong className="text-slate-800 font-mono">{today.toISOString().substring(0, 10)}</strong></div>
            <div>Total Kasus Periode: <strong className="text-blue-700 font-mono font-bold text-sm">{totalCases} Kasus</strong></div>
            <div className="text-[10px] text-slate-400">Dokumen Resmi Terenkripsi</div>
          </div>
        </div>

        {/* 10. RESOLUTION PERFORMANCE METRICS CARD */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Resolution Performance Indicators</span>
            </h3>
            <span className="text-xs text-slate-500">
              Satuan: <strong>Hari Kalender (Calendar Days)</strong> dari Grievance Date ke Closing Date
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Avg Resolution Time */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                Avg Resolution Time
              </div>
              <div className="text-2xl font-black text-blue-900 font-mono">
                {avgResolutionTimeDays} <span className="text-xs font-normal text-blue-700">Hari</span>
              </div>
              <div className="text-[10px] text-blue-600">Kasus Closed ({closedCases.length})</div>
            </div>

            {/* Total Cases */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                Total Keluhan
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {totalCases}
              </div>
              <div className="text-[10px] text-slate-500">Periode Terpilih</div>
            </div>

            {/* Total Resolved */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                Total Resolved
              </div>
              <div className="text-2xl font-black text-emerald-900 font-mono">
                {closedCases.length}
              </div>
              <div className="text-[10px] text-emerald-700">Status Closed</div>
            </div>

            {/* Total Open */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                Total Open Cases
              </div>
              <div className="text-2xl font-black text-amber-900 font-mono">
                {openCases.length}
              </div>
              <div className="text-[10px] text-amber-700">Dalam Penanganan</div>
            </div>

            {/* Overdue */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                Overdue Cases
              </div>
              <div className="text-2xl font-black text-rose-900 font-mono">
                {overdueCases.length}
              </div>
              <div className="text-[10px] text-rose-700">Melewati SLA</div>
            </div>

            {/* SLA Compliance */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                SLA Compliance
              </div>
              <div className="text-2xl font-black text-indigo-900 font-mono">
                {slaComplianceRate}%
              </div>
              <div className="text-[10px] text-indigo-700">Target Kepatuhan</div>
            </div>

            {/* Critical Priority Count */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">
                Critical Priority
              </div>
              <div className="text-2xl font-black text-purple-900 font-mono">
                {chartPriority.find((p) => p.priority === 'Critical')?.count || 0}
              </div>
              <div className="text-[10px] text-purple-700">Penanganan Segera</div>
            </div>
          </div>

          {/* Average Resolution Time by Department & Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Average Resolution Time by Department</h4>
              {resolutionTimeByDept.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada kasus closed pada periode ini.</p>
              ) : (
                <div className="space-y-1.5">
                  {resolutionTimeByDept.map((item) => (
                    <div key={item.dept} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[200px]">{item.dept}</span>
                      <span className="font-mono font-bold text-blue-800">
                        {item.avgDays} Hari <span className="text-[10px] text-slate-400 font-normal">({item.count} kasus)</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Average Resolution Time by Category</h4>
              {resolutionTimeByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada kasus closed pada periode ini.</p>
              ) : (
                <div className="space-y-1.5">
                  {resolutionTimeByCategory.map((item) => (
                    <div key={item.category} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[200px]">{item.category}</span>
                      <span className="font-mono font-bold text-indigo-800">
                        {item.avgDays} Hari <span className="text-[10px] text-slate-400 font-normal">({item.count} kasus)</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 8. REPORT CHARTS SECTION (6 CHARTS) */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Report Charts (Dinamis Sesuai Periode Terpilih)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Chart 1: Grievance by Category */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">1. Grievance by Category</h4>
              <div className="space-y-2">
                {rankingByCategory.slice(0, 5).map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate max-w-[170px] text-slate-700">{item.name}</span>
                      <span className="font-bold font-mono text-slate-900">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Grievance by Department PIC */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">2. Grievance by Department PIC</h4>
              <div className="space-y-2">
                {rankingByPic.slice(0, 5).map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate max-w-[170px] text-slate-700">{item.name}</span>
                      <span className="font-bold font-mono text-slate-900">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Grievance by Priority */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">3. Grievance by Priority</h4>
              <div className="space-y-2">
                {chartPriority.map((item) => {
                  const pct = totalCases > 0 ? Math.round((item.count / totalCases) * 100) : 0;
                  const color =
                    item.priority === 'Critical'
                      ? 'bg-rose-500'
                      : item.priority === 'Major'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <div key={item.priority} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.priority}</span>
                        <span className="font-bold font-mono text-slate-900">{item.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 4: Grievance by Instrument */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">4. Grievance by Instrument (Intake Channel)</h4>
              <div className="space-y-2">
                {chartInstrument.slice(0, 5).map((item) => {
                  const pct = totalCases > 0 ? Math.round((item.count / totalCases) * 100) : 0;
                  return (
                    <div key={item.channel} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate max-w-[170px] text-slate-700">{item.channel}</span>
                        <span className="font-bold font-mono text-slate-900">{item.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-teal-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 5: Grievance by Status */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">5. Grievance by Status (4 Tahapan SJI)</h4>
              <div className="space-y-2">
                {chartStatus.map((item) => {
                  const pct = totalCases > 0 ? Math.round((item.count / totalCases) * 100) : 0;
                  const color =
                    item.status === 'Open'
                      ? 'bg-rose-500'
                      : item.status === 'Investigation'
                      ? 'bg-amber-500'
                      : item.status === 'Action Taken'
                      ? 'bg-blue-500'
                      : 'bg-emerald-500';

                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.status}</span>
                        <span className="font-bold font-mono text-slate-900">{item.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 6: Monthly Grievance Trends */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">6. Monthly Grievance Trends (Berdasarkan Grievance Date)</h4>
              {chartMonthlyTrends.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada data bulanan.</p>
              ) : (
                <div className="space-y-2">
                  {chartMonthlyTrends.map((item) => {
                    const pct = totalCases > 0 ? Math.round((item.count / totalCases) * 100) : 0;
                    return (
                      <div key={item.month} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-700">{item.month}</span>
                          <span className="font-bold text-slate-900">{item.count} kasus</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.max(5, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 9. RANKING ANALYSIS (4 SECTIONS) */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Ranking Analysis (Diurutkan Berdasarkan Volume Kasus Tertinggi)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ranking 1: Case by Category */}
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Ranking Case by Category</h4>
              <div className="divide-y divide-slate-200/60 text-xs">
                {rankingByCategory.map((item, idx) => (
                  <div key={item.name} className="py-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-2 truncate max-w-[240px]">
                      <span className="w-5 font-bold font-mono text-slate-400">#{idx + 1}</span>
                      <span className="text-slate-800 font-medium truncate">{item.name}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-700 whitespace-nowrap">
                      {item.count} Kasus ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking 2: Department PIC by Case Volume */}
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Ranking Department PIC by Case Volume</h4>
              <div className="divide-y divide-slate-200/60 text-xs">
                {rankingByPic.map((item, idx) => (
                  <div key={item.name} className="py-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-2 truncate max-w-[240px]">
                      <span className="w-5 font-bold font-mono text-slate-400">#{idx + 1}</span>
                      <span className="text-slate-800 font-medium truncate">
                        {item.name} <span className="text-[10px] text-slate-400 font-normal">({item.department})</span>
                      </span>
                    </span>
                    <span className="font-mono font-bold text-indigo-700 whitespace-nowrap">
                      {item.count} Kasus
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking 3: Department by Grievance Volume */}
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Ranking Department by Grievance Volume</h4>
              <div className="divide-y divide-slate-200/60 text-xs">
                {rankingByDepartment.map((item, idx) => (
                  <div key={item.name} className="py-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-2 truncate max-w-[240px]">
                      <span className="w-5 font-bold font-mono text-slate-400">#{idx + 1}</span>
                      <span className="text-slate-800 font-medium truncate">{item.name}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {item.count} Kasus ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking 4: Repeat Grievance Categories */}
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">Ranking Repeat Grievance Categories</h4>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  ≥ 2 Kali Kejadian
                </span>
              </div>
              {rankingRepeatCategories.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Tidak ada kategori keluhan berulang pada periode ini.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 text-xs">
                  {rankingRepeatCategories.map((item, idx) => (
                    <div key={item.name} className="py-1.5 flex items-center justify-between">
                      <span className="flex items-center space-x-2 truncate max-w-[240px]">
                        <span className="w-5 font-bold font-mono text-rose-500">#{idx + 1}</span>
                        <span className="text-slate-800 font-medium truncate">{item.name}</span>
                      </span>
                      <span className="font-mono font-bold text-rose-700 whitespace-nowrap">
                        {item.count} Kejadian
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Executive Summary Box */}
        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3 print:bg-white print:text-slate-900 print:border print:border-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm">Rangkuman Eksekutif &amp; Analisis Kepatuhan</h3>
            </div>
            <button
              onClick={handleGenerateAiNarrative}
              disabled={isGeneratingAi}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition print:hidden"
            >
              {isGeneratingAi ? 'Menganalisis...' : 'Generate Narasi Laporan'}
            </button>
          </div>

          <div className="text-xs text-slate-300 print:text-slate-700 leading-relaxed whitespace-pre-line">
            {aiNarrative ||
              `Berdasarkan data aktual periode ini, tercatat sebanyak ${totalCases} keluhan dengan tingkat kepatuhan SLA mencapai ${slaComplianceRate}%. Sebanyak ${closedCases.length} kasus telah berhasil diselesaikan dengan rata-rata waktu penyelesaian ${avgResolutionTimeDays} hari kalender.`}
          </div>
        </div>

        {/* Case Detail Table (Public / Corporate Report Standard: NO Investigator Name, NO Signatures) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-bold text-sm text-slate-900">
              Daftar Rincian Kasus (Case Detail Table)
            </h3>
            <span className="text-xs text-slate-500">
              Menampilkan {filteredCases.length} Kasus
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Ticket ID</th>
                  <th className="px-3 py-2.5">Grievance Date</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Intake Channel</th>
                  <th className="px-3 py-2.5">Closing Date</th>
                  <th className="px-3 py-2.5 text-right">Durasi Resolusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c) => {
                  let resDays = '-';
                  if (c.status === 'Closed') {
                    const start = new Date(c.dateReceived).getTime();
                    const end = c.closingDate ? new Date(c.closingDate).getTime() : new Date(c.lastUpdate || c.dateReceived).getTime();
                    resDays = `${Math.max(1, Math.round((end - start) / 86400000))} Hari`;
                  }

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {c.ticketId}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-600">
                        {c.dateReceived}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 max-w-[180px] truncate">
                        {c.complaintCategory}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {c.department}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.priority === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : c.priority === 'Major'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 text-[11px]">{c.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {c.channelReceived}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-500">
                        {c.closingDate || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-blue-800 whitespace-nowrap">
                        {resDays}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Corporate Note (Strictly NO signature and NO investigator info) */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            PT Shoenary Javanesia Inc. • Sistem Manajemen Keluhan Karyawan (Grievance System)
          </div>
          <div>
            Kerahasiaan Terjaga • Sesuai Regulasi Ketenagakerjaan
          </div>
        </div>
      </div>
    </div>
  );
};
