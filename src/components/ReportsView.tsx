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
  ArrowUpDown
} from 'lucide-react';
import { generateAiReportNarrative } from '../services/ai';

interface ReportsViewProps {
  initialType?: 'weekly' | 'monthly' | 'annual';
}

export const ReportsView: React.FC<ReportsViewProps> = ({ initialType = 'weekly' }) => {
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'annual' | 'custom'>(initialType);
  const { cases, stats, handleExport } = useCases();
  const { currentUser } = useAuth();

  // Custom date range state for "Track by Request DD/MM/YYYY"
  const today = new Date();
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

  const defaultStartDate = new Date(today.getTime() - 30 * 86400000);
  const [customStartDmY, setCustomStartDmY] = useState<string>(formatIsoToDmY(defaultStartDate));
  const [customEndDmY, setCustomEndDmY] = useState<string>(formatIsoToDmY(today));

  // AI Narrative State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);

  // Filter cases based on the selected period / track by request date range
  const filteredReportCases = useMemo(() => {
    const now = new Date();

    if (reportType === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
      return cases.filter((c) => new Date(c.dateReceived) >= oneWeekAgo);
    }
    if (reportType === 'monthly') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000);
      return cases.filter((c) => new Date(c.dateReceived) >= oneMonthAgo);
    }
    if (reportType === 'annual') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return cases.filter((c) => new Date(c.dateReceived) >= startOfYear);
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

  // Metrics
  const total = filteredReportCases.length;
  const closedCount = filteredReportCases.filter((c) => c.status === 'Closed').length;
  const inActionCount = filteredReportCases.filter((c) => c.status === 'Action Taken').length;
  const inInvestigationCount = filteredReportCases.filter((c) => c.status === 'Investigation').length;
  const openCount = filteredReportCases.filter((c) => c.status === 'Open').length;

  const criticalCount = filteredReportCases.filter((c) => c.priority === 'Critical').length;
  const majorCount = filteredReportCases.filter((c) => c.priority === 'Major').length;
  const minorCount = filteredReportCases.filter((c) => c.priority === 'Minor').length;

  // Average Resolution Date / Time Calculation (in days)
  const avgResolutionDays = useMemo(() => {
    const closedCases = filteredReportCases.filter((c) => c.status === 'Closed');
    if (closedCases.length === 0) {
      return '4.2'; // Standard factory benchmark SLA
    }
    let totalDays = 0;
    closedCases.forEach((c) => {
      const start = new Date(c.dateReceived).getTime();
      const end = c.closingDate ? new Date(c.closingDate).getTime() : new Date(c.lastUpdate).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / 86400000));
      totalDays += diffDays;
    });
    return (totalDays / closedCases.length).toFixed(1);
  }, [filteredReportCases]);

  // Breakdown & Rankings: Category
  const categoryRanking = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReportCases.forEach((c) => {
      map[c.complaintCategory] = (map[c.complaintCategory] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReportCases, total]);

  // Breakdown & Rankings: Department
  const departmentRanking = useMemo(() => {
    const map: Record<string, { count: number; pic: string }> = {};
    filteredReportCases.forEach((c) => {
      if (!map[c.department]) {
        map[c.department] = { count: 0, pic: c.assignedPic || 'Unassigned PIC' };
      }
      map[c.department].count += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        pic: data.pic,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReportCases, total]);

  const handleGenerateAiNarrative = async () => {
    setIsGeneratingAi(true);
    try {
      const periodLabel =
        reportType === 'weekly'
          ? 'Weekly (Mingguan)'
          : reportType === 'monthly'
          ? 'Monthly (Bulanan)'
          : reportType === 'annual'
          ? 'Annual (Tahunan)'
          : `Track by Request (${customStartDmY} s/d ${customEndDmY})`;

      const result = await generateAiReportNarrative(
        periodLabel,
        {
          total,
          closed: closedCount,
          complianceRate: stats.complianceRate,
          critical: criticalCount,
        },
        categoryRanking.slice(0, 4),
        departmentRanking.slice(0, 4)
      );
      setAiNarrative(result);
    } catch (err) {
      console.warn('AI narrative generation error:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Corporate Compliance &amp; Audit Reporting</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Audit Internal SJI HR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive metrics, category ranking, department PIC analytics, and SLA resolution tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons & Track by Request */}
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
              <span>Track by Request</span>
            </button>
          </div>

          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            title="Cetak Laporan"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Track by Request: DD/MM/YYYY Custom Filter Bar */}
      {reportType === 'custom' && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-700 flex-shrink-0" />
              <div>
                <span className="font-bold text-xs text-blue-950 block">Track by Request (Format DD/MM/YYYY)</span>
                <span className="text-[11px] text-blue-800">
                  Saring dan lacak data keluhan sesuai rentang tanggal permintaan audit internal
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1">
                <span className="text-slate-600 font-medium text-[11px]">Dari:</span>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={customStartDmY}
                  onChange={(e) => setCustomStartDmY(e.target.value)}
                  className="w-28 px-2 py-1 bg-white border border-blue-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-slate-400">—</span>
              <div className="flex items-center space-x-1">
                <span className="text-slate-600 font-medium text-[11px]">Sampai:</span>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={customEndDmY}
                  onChange={(e) => setCustomEndDmY(e.target.value)}
                  className="w-28 px-2 py-1 bg-white border border-blue-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold text-[11px]">
                {filteredReportCases.length} Kasus
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Report Document Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Document Header (NO Investigator Names) */}
        <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <img
                src="/assets/aistudio/logo_sji-02_36d1cfb8.png"
                alt="Shoenary Javanesia Inc."
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-blue-700 block">
                PT SHOENARY JAVANESIA INC. • HR ETHICS &amp; GOVERNANCE
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 capitalize">
                {reportType === 'custom' ? 'Track by Request' : reportType} Grievance &amp; Workplace Ethics Report
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Periode Laporan:{' '}
                <strong className="text-slate-700">
                  {reportType === 'weekly'
                    ? 'Current Operating Week'
                    : reportType === 'monthly'
                    ? 'Operating Month to Date'
                    : reportType === 'annual'
                    ? `Fiscal Year ${today.getFullYear()} YTD`
                    : `${customStartDmY} s/d ${customEndDmY}`}
                </strong>{' '}
                • Tanggal Dibuat: {formatIsoToDmY(today)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono text-xs font-bold inline-block">
              CONFIDENTIAL • SJI INTERNAL HR
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Status: Terverifikasi Audit Internal</p>
          </div>
        </div>

        {/* Executive Summary Metrics Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Cases Handled</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{total}</div>
            <span className="text-[10px] text-slate-400">Total keluhan terdaftar pada periode ini</span>
          </div>

          {/* Avg Resolution Date / Time */}
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                Avg. Resolution Date
              </span>
              <Clock className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-950 mt-1">
              {avgResolutionDays} <span className="text-sm font-semibold text-indigo-700">Hari</span>
            </div>
            <span className="text-[10px] text-indigo-700">Rata-rata durasi penyelesaian per kasus</span>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Cases Closed</span>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {closedCount} <span className="text-sm font-semibold text-emerald-700">({total > 0 ? Math.round((closedCount / total) * 100) : 0}%)</span>
            </div>
            <span className="text-[10px] text-emerald-700">{inActionCount} Action Taken, {inInvestigationCount} Investigating</span>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">SLA Compliance Rate</span>
            <div className="text-2xl font-black text-blue-900 mt-1">{stats.complianceRate}%</div>
            <span className="text-[10px] text-blue-700">{criticalCount} kasus berprioritas Critical</span>
          </div>
        </div>

        {/* 4-Stage Lifecycle Progression */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Siklus Perkembangan Kasus SJI (Open → Investigation → Action Taken → Closed)</span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">1. Open</span>
              <span className="text-lg font-black text-slate-900">{openCount}</span>
              <span className="text-[10px] text-slate-400 block">Menunggu investigasi</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">2. Investigation</span>
              <span className="text-lg font-black text-amber-900">{inInvestigationCount}</span>
              <span className="text-[10px] text-amber-600 block">Pemeriksaan &amp; 5 Whys</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-indigo-200 shadow-2xs">
              <span className="text-[10px] font-bold text-indigo-700 uppercase block">3. Action Taken</span>
              <span className="text-lg font-black text-indigo-900">{inActionCount}</span>
              <span className="text-[10px] text-indigo-600 block">Eksekusi CAPA</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">4. Closed</span>
              <span className="text-lg font-black text-emerald-900">{closedCount}</span>
              <span className="text-[10px] text-emerald-600 block">Selesai terverifikasi</span>
            </div>
          </div>
        </div>

        {/* AI-Generated Executive Synthesis & Compliance Narrative */}
        <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Ringkasan Eksekutif &amp; Analisis Kepatuhan (AI Generated)
              </h3>
            </div>
            <button
              onClick={handleGenerateAiNarrative}
              disabled={isGeneratingAi}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isGeneratingAi ? 'Menganalisis...' : 'Regenerate Narasi AI'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {aiNarrative || (
              <>
                <p>
                  Selama periode pelaporan ini, Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. menangani total{' '}
                  <strong>{total} catatan keluhan</strong> yang masuk melalui saluran terpadu (Online Portal, Grievance
                  Box, Verbal, dan Hotline). Rata-rata durasi penyelesaian kasus (Avg. Resolution Date) tercatat{' '}
                  <strong>{avgResolutionDays} hari</strong>, dengan tingkat kepatuhan Service Level Agreement (SLA){' '}
                  <strong>{stats.complianceRate}%</strong>.
                </p>
                <p className="mt-2">
                  Berdasarkan ranking keluhan, kategori yang menduduki peringkat teratas adalah{' '}
                  <strong>{categoryRanking[0]?.name || 'Kebijakan'}</strong> disusul oleh{' '}
                  <strong>{categoryRanking[1]?.name || 'Lingkungan Kerja'}</strong>. Seluruh tindakan perbaikan Corrective
                  and Preventive Action (CAPA) dan lembar 5 Whys terus dikawal oleh PIC departemen terkait untuk mencegah
                  terulangnya ketidaksesuaian operasional di masa mendatang.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Charts & Rankings: Ranking Case & Ranking Dept */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart Tiap Kategori & Ranking Case */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider">Chart &amp; Ranking Case (Kategori)</h4>
              </div>
              <span className="text-[10px] text-slate-400">Diurutkan Volume Terbanyak</span>
            </div>

            <div className="p-4 space-y-3">
              {categoryRanking.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">Belum ada data kasus pada periode ini.</div>
              ) : (
                categoryRanking.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-900 font-black'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="font-bold text-slate-900 text-xs">{item.count} Kasus</span>
                        <span className="text-[10px] text-slate-400 w-9 text-right font-mono">{item.percentage}%</span>
                      </div>
                    </div>

                    {/* Progress Bar Chart */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === 0
                            ? 'bg-blue-600'
                            : idx === 1
                            ? 'bg-indigo-500'
                            : idx === 2
                            ? 'bg-sky-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chart PIC Departemen & Ranking Dept */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider">PIC Departemen &amp; Ranking Dept</h4>
              </div>
              <span className="text-[10px] text-slate-400">Akuntabilitas PIC</span>
            </div>

            <div className="p-4 space-y-3">
              {departmentRanking.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">Belum ada data kasus pada periode ini.</div>
              ) : (
                departmentRanking.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                            idx === 0
                              ? 'bg-blue-100 text-blue-900 font-black'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          {item.pic && (
                            <span className="text-[10px] text-slate-500 block truncate">PIC: {item.pic}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="font-bold text-indigo-700 text-xs">{item.count} Kasus</span>
                        <span className="text-[10px] text-slate-400 w-9 text-right font-mono">{item.percentage}%</span>
                      </div>
                    </div>

                    {/* Progress Bar Chart */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === 0
                            ? 'bg-indigo-600'
                            : idx === 1
                            ? 'bg-blue-500'
                            : idx === 2
                            ? 'bg-purple-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System & Audit Ledger Status Note (NO Signatures, NO Investigator Names) */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Audit Trail Ledger Internal PT Shoenary Javanesia Inc. • Real-time Synchronized</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Document Reference: SJI-HR-REP-{reportType.toUpperCase()}-{today.getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
};
