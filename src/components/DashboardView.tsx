import React, { useState, useMemo } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  PlusCircle,
  Building2,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  BarChart3,
  PieChart,
  Globe,
  Inbox,
  PhoneCall,
  MessageSquare,
  Flame,
  Calendar,
  Filter,
  Users,
  Target,
  FileText
} from 'lucide-react';
import { GrievanceCase } from '../types';

interface DashboardViewProps {
  onOpenCase: (c: GrievanceCase) => void;
  onNavigateToCases: () => void;
}

type PeriodFilter = 'all' | 'year' | 'month' | '30days';

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenCase, onNavigateToCases }) => {
  const {
    cases,
    stats: globalStats,
    setIsNewCaseModalOpen,
    setIsImportModalOpen,
    handleExport,
    syncStatus,
    handleSyncOffline,
  } = useCases();

  const { currentUser, canRegisterCase } = useAuth();

  // Reporting period selector state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');

  // Filter cases based on the selected reporting period
  const filteredCases = useMemo(() => {
    if (selectedPeriod === 'all') return cases;

    const now = new Date();
    const currentYearStr = now.getFullYear().toString();
    const currentMonthPrefix = `${currentYearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return cases.filter((c) => {
      if (!c.dateReceived) return false;
      if (selectedPeriod === 'year') {
        return c.dateReceived.startsWith(currentYearStr);
      }
      if (selectedPeriod === 'month') {
        return c.dateReceived.startsWith(currentMonthPrefix);
      }
      if (selectedPeriod === '30days') {
        const receivedTime = new Date(c.dateReceived).getTime();
        return !isNaN(receivedTime) && receivedTime >= thirtyDaysAgoMs;
      }
      return true;
    });
  }, [cases, selectedPeriod]);

  // Derived filtered KPI stats
  const periodStats = useMemo(() => {
    const total = filteredCases.length;
    const closed = filteredCases.filter((c) => c.status === 'Closed').length;
    const open = filteredCases.filter((c) => c.status === 'Open').length;
    const investigation = filteredCases.filter((c) => c.status === 'Investigation').length;
    const actionTaken = filteredCases.filter((c) => c.status === 'Action Taken').length;
    const activeCount = total - closed;

    const activeBreached = filteredCases.filter(
      (c) => c.slaStatus === 'Breached' && c.status !== 'Closed'
    ).length;

    const criticalCount = filteredCases.filter(
      (c) => c.priority === 'Critical' && c.status !== 'Closed'
    ).length;

    const approachingCount = filteredCases.filter(
      (c) => c.slaStatus === 'Approaching Due' && c.status !== 'Closed'
    ).length;

    const pendingCapaCount = filteredCases.filter(
      (c) => (c.status === 'Investigation' || c.status === 'Action Taken')
    ).length;

    const hasCases = total > 0;
    const complianceRate = hasCases
      ? Math.max(0, Math.round(((total - activeBreached) / total) * 100))
      : 0;

    const resolutionRate = hasCases ? Math.round((closed / total) * 100) : 0;

    return {
      total,
      closed,
      open,
      investigation,
      actionTaken,
      activeCount,
      activeBreached,
      criticalCount,
      approachingCount,
      pendingCapaCount,
      hasCases,
      complianceRate,
      resolutionRate,
    };
  }, [filteredCases]);

  // Urgent attention queue: Breached or Critical or Approaching
  const urgentQueue = useMemo(() => {
    return filteredCases
      .filter(
        (c) =>
          c.status !== 'Closed' &&
          (c.slaStatus === 'Breached' || c.priority === 'Critical' || c.slaStatus === 'Approaching Due')
      )
      .sort((a, b) => {
        // Prioritize Breached first, then Critical, then Approaching
        const score = (c: GrievanceCase) => {
          if (c.slaStatus === 'Breached') return 3;
          if (c.priority === 'Critical') return 2;
          if (c.slaStatus === 'Approaching Due') return 1;
          return 0;
        };
        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [filteredCases]);

  // Status stage distribution
  const statusCounts = useMemo(() => {
    return {
      Open: filteredCases.filter((c) => c.status === 'Open').length,
      Investigation: filteredCases.filter((c) => c.status === 'Investigation').length,
      'Action Taken': filteredCases.filter((c) => c.status === 'Action Taken').length,
      Closed: filteredCases.filter((c) => c.status === 'Closed').length,
    };
  }, [filteredCases]);

  // Channel (instrument) counts
  const channelCounts = useMemo(() => {
    const total = filteredCases.length || 1;
    const online = filteredCases.filter((c) => c.channelReceived === 'Online').length;
    const box = filteredCases.filter((c) => c.channelReceived === 'Grievance Box').length;
    const verbal = filteredCases.filter((c) => c.channelReceived === 'Verbal').length;
    const hotline = filteredCases.filter((c) => c.channelReceived === 'Hotline').length;

    return {
      Online: { count: online, pct: Math.round((online / total) * 100) },
      'Grievance Box': { count: box, pct: Math.round((box / total) * 100) },
      Verbal: { count: verbal, pct: Math.round((verbal / total) * 100) },
      Hotline: { count: hotline, pct: Math.round((hotline / total) * 100) },
    };
  }, [filteredCases]);

  // Category counts
  const categoryMap = useMemo(() => {
    return filteredCases.reduce((acc, c) => {
      acc[c.complaintCategory] = (acc[c.complaintCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredCases]);

  // Department counts
  const departmentMap = useMemo(() => {
    return filteredCases.reduce((acc, c) => {
      acc[c.department] = (acc[c.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredCases]);

  // Monthly trends (Last 6 months or full current year)
  const monthlyTrends = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const trendData: { month: string; total: number; closed: number }[] = [];

    // Build array for months 1..12 or months up to current
    const currentMonthIdx = new Date().getMonth();
    // Show 6 most relevant months
    const startIdx = Math.max(0, currentMonthIdx - 5);
    for (let i = startIdx; i <= currentMonthIdx; i++) {
      const monthPrefix = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const monthCases = cases.filter((c) => c.dateReceived && c.dateReceived.startsWith(monthPrefix));
      trendData.push({
        month: `${months[i]} '${String(currentYear).slice(2)}`,
        total: monthCases.length,
        closed: monthCases.filter((c) => c.status === 'Closed').length,
      });
    }
    return trendData;
  }, [cases]);

  // SLA performance breakdown
  const slaBreakdown = useMemo(() => {
    const met = filteredCases.filter((c) => c.slaStatus === 'Met' || (c.status === 'Closed' && c.slaStatus !== 'Breached')).length;
    const onTrack = filteredCases.filter((c) => c.slaStatus === 'On Track' && c.status !== 'Closed').length;
    const approaching = filteredCases.filter((c) => c.slaStatus === 'Approaching Due' && c.status !== 'Closed').length;
    const breached = filteredCases.filter((c) => c.slaStatus === 'Breached' && c.status !== 'Closed').length;

    return { met, onTrack, approaching, breached };
  }, [filteredCases]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SECTION A: PAGE HEADER
          Welcome message, Dashboard title, Reporting period selector, Quick action buttons
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Executive HRIS Grievance Dashboard
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
              PT Shoenary Javanesia Inc.
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-800">{currentUser?.displayName}</span> (
            <span className="capitalize">{currentUser?.role.replace('_', ' ')}</span>) •{' '}
            {currentUser?.role === 'department_pic'
              ? `Department PIC View (${currentUser.department})`
              : 'Full HR Enterprise Scope'}
          </p>
        </div>

        {/* Controls: Reporting Period Selector + Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Selector Tabs */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                selectedPeriod === 'all'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setSelectedPeriod('year')}
              className={`px-2.5 py-1 rounded-md transition ${
                selectedPeriod === 'year'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              This Year ({new Date().getFullYear()})
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-2.5 py-1 rounded-md transition ${
                selectedPeriod === 'month'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setSelectedPeriod('30days')}
              className={`px-2.5 py-1 rounded-md transition ${
                selectedPeriod === '30days'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {canRegisterCase && (
              <>
                <button
                  onClick={() => setIsNewCaseModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                  title="Register new grievance ticket"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Register Grievance</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
                  title="Import Excel from website"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Import Excel</span>
                </button>
              </>
            )}
            <button
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
              title="Export filtered grievance data"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Failure Notice for Admin */}
      {syncStatus.hasError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Pemberitahuan Sinkronisasi Cloud Firestore
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {syncStatus.errorMessage || 'Terdapat data kasus lokal yang belum berhasil terkirim ke Cloud Firestore.'}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await handleSyncOffline();
              if (res.errors.length === 0) {
                alert(`Berhasil menyinkronkan ${res.synced} kasus ke Cloud Firestore.`);
              } else {
                alert(`Gagal sinkronisasi: ${res.errors.join(', ')}`);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition self-start sm:self-auto shrink-0"
          >
            Sinkronkan Ulang Sekarang
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION B: KPI OVERVIEW GRID (5 KEY METRICS)
          1. Total Grievance
          2. Active Cases
          3. Resolved / Closed
          4. Overdue Cases
          5. SLA Compliance Rate
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Grievance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Grievance
            </span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{periodStats.total}</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {globalStats.total} all-time
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Scope: {selectedPeriod === 'all' ? 'Entire Registry' : selectedPeriod}</span>
          </p>
        </div>

        {/* 2. Active Cases */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Cases
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{periodStats.activeCount}</span>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              In Workflow
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{periodStats.open} Open</span>
            <span>•</span>
            <span>{periodStats.investigation} Inv</span>
            <span>•</span>
            <span>{periodStats.actionTaken} Action</span>
          </div>
        </div>

        {/* 3. Resolved / Closed */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Resolved / Closed
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{periodStats.closed}</span>
            <span className="text-xs font-semibold text-emerald-700">
              {periodStats.resolutionRate}% Rate
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${periodStats.resolutionRate}%` }}
            />
          </div>
        </div>

        {/* 4. Overdue Cases */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overdue Cases
            </span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                periodStats.activeBreached > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {periodStats.activeBreached}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                periodStats.activeBreached > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {periodStats.activeBreached > 0 ? 'Action Required' : 'Zero Breach'}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {periodStats.activeBreached > 0
              ? 'Exceeded corporate resolution timeline'
              : 'All active cases within deadline'}
          </p>
        </div>

        {/* 5. SLA Compliance Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SLA Compliance Rate
            </span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {periodStats.hasCases ? `${periodStats.complianceRate}%` : '0%'}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                !periodStats.hasCases
                  ? 'bg-slate-100 text-slate-600'
                  : periodStats.complianceRate >= 90
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {!periodStats.hasCases
                ? 'Belum Ada Data'
                : periodStats.activeBreached === 0
                ? 'Optimal'
                : `${periodStats.activeBreached} Overdue`}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                !periodStats.hasCases
                  ? 'bg-slate-300'
                  : periodStats.complianceRate >= 90
                  ? 'bg-indigo-600'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${periodStats.hasCases ? periodStats.complianceRate : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION C: ATTENTION REQUIRED
          Highlights for Critical cases (72h), Overdue cases, Approaching due (<= 48h), Pending CAPA
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <Flame className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Attention Required Monitoring</h2>
              <p className="text-xs text-slate-500">Urgent SLA conditions and escalation watchpoints</p>
            </div>
          </div>
          <button
            onClick={onNavigateToCases}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 self-start sm:self-auto"
          >
            <span>View Filtered Cases</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Critical Cases (72h Escalation) */}
          <div
            onClick={onNavigateToCases}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              periodStats.criticalCount > 0
                ? 'bg-rose-50/80 border-rose-200 hover:border-rose-400'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                Critical (72h SLA)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  periodStats.criticalCount > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {periodStats.criticalCount}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Harassment, violence, safety threats requiring 72h executive escalation.
            </p>
          </div>

          {/* Overdue Breaches */}
          <div
            onClick={onNavigateToCases}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              periodStats.activeBreached > 0
                ? 'bg-rose-50/80 border-rose-200 hover:border-rose-400'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                Overdue Breached
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  periodStats.activeBreached > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {periodStats.activeBreached}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Cases that have passed resolution due date and need immediate HR intervention.
            </p>
          </div>

          {/* Approaching Due (<= 48h) */}
          <div
            onClick={onNavigateToCases}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              periodStats.approachingCount > 0
                ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Approaching Due (&le; 48h)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  periodStats.approachingCount > 0
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {periodStats.approachingCount}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Within 48 hours of SLA expiration. Expedite PIC investigation notes.
            </p>
          </div>

          {/* Pending CAPA / Action Plan */}
          <div
            onClick={onNavigateToCases}
            className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 hover:border-slate-300 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                Pending CAPA Action
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
                {periodStats.pendingCapaCount}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Active cases in Investigation or Action Taken awaiting corrective action plans.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION D: GRIEVANCE CHANNEL DISTRIBUTION (SALURAN MASUK / INSTRUMENTS)
          Online, Grievance Box, Verbal, Hotline
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Target className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Grievance Channel Distribution (Saluran Masuk)
              </h2>
              <p className="text-xs text-slate-500">
                Volume and percentage share across four intake instruments
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {periodStats.total} Total Channel Reports
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Online */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 hover:border-blue-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Online</span>
              </span>
              <span className="text-xs font-bold text-blue-700">{channelCounts.Online.pct}%</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-950">
                {channelCounts.Online.count}
              </span>
              <span className="text-[11px] text-blue-700 font-medium">Website Internal</span>
            </div>
            <div className="mt-3 w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${channelCounts.Online.pct}%` }}
              />
            </div>
          </div>

          {/* 2. Grievance Box */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 hover:border-amber-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-amber-600" />
                <span>2. Grievance Box</span>
              </span>
              <span className="text-xs font-bold text-amber-700">
                {channelCounts['Grievance Box'].pct}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-950">
                {channelCounts['Grievance Box'].count}
              </span>
              <span className="text-[11px] text-amber-700 font-medium">Kotak Saran Fisik</span>
            </div>
            <div className="mt-3 w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-600 h-1.5 rounded-full"
                style={{ width: `${channelCounts['Grievance Box'].pct}%` }}
              />
            </div>
          </div>

          {/* 3. Verbal */}
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 hover:border-purple-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                <span>3. Verbal</span>
              </span>
              <span className="text-xs font-bold text-purple-700">
                {channelCounts.Verbal.pct}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-950">
                {channelCounts.Verbal.count}
              </span>
              <span className="text-[11px] text-purple-700 font-medium">Lisan ke HR Team</span>
            </div>
            <div className="mt-3 w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full"
                style={{ width: `${channelCounts.Verbal.pct}%` }}
              />
            </div>
          </div>

          {/* 4. Hotline */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                <span>4. Hotline</span>
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {channelCounts.Hotline.pct}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-950">
                {channelCounts.Hotline.count}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">Telepon / WhatsApp</span>
            </div>
            <div className="mt-3 w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${channelCounts.Hotline.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION E: GRIEVANCE ANALYTICS & DETAILED INSIGHTS
          1. Lifecycle Stages Funnel
          2. Category Breakdown
          3. Department Distribution
          4. Monthly Trends
          5. SLA Performance Breakdown
          6. Priority Attention Queue Table
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Grievance Lifecycle Stages Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Grievance Lifecycle Stages</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Standard 4-Step SJI</span>
          </div>

          <div className="space-y-3.5">
            {Object.entries(statusCounts).map(([status, count], idx) => {
              const max = Math.max(...Object.values(statusCounts), 1);
              const pct = Math.round((count / max) * 100);
              const totalPct = periodStats.total ? Math.round((count / periodStats.total) * 100) : 0;
              return (
                <div key={status} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{status}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-400">{totalPct}%</span>
                      <span className="font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100">
                        {count}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        status === 'Closed'
                          ? 'bg-emerald-600'
                          : status === 'Action Taken'
                          ? 'bg-indigo-600'
                          : status === 'Investigation'
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Overall Resolution Velocity</span>
            <span className="font-bold text-slate-800">{periodStats.resolutionRate}% Complete</span>
          </div>
        </div>

        {/* 2. Complaint Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>Complaint Category Breakdown</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">By Volume</span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {Object.keys(categoryMap).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No grievance categories in range</p>
            ) : (
              Object.entries(categoryMap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => {
                  const total = periodStats.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate pr-2 max-w-[200px]" title={cat}>
                          {cat}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-[10px] text-slate-400">{pct}%</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-xs">
                            {count}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* 3. Department Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Department Distribution</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">PIC Focus</span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {Object.keys(departmentMap).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No departmental records</p>
            ) : (
              Object.entries(departmentMap)
                .sort((a, b) => b[1] - a[1])
                .map(([dept, count]) => {
                  return (
                    <div
                      key={dept}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 truncate" title={dept}>
                          {dept}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded shrink-0">
                        {count} {count === 1 ? 'Case' : 'Cases'}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Analytics Second Row: Monthly Trends + SLA Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 4. Monthly Grievance Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Monthly Grievance Intake Trends</span>
              </h3>
              <p className="text-xs text-slate-500">
                Registered complaints vs. resolved cases across recent months
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-medium text-slate-600">
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                <span>Total Received</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Resolved</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 pt-4 border-t border-slate-100">
            {monthlyTrends.map((t) => {
              const maxMonthly = Math.max(...monthlyTrends.map((m) => m.total), 4);
              const totalHeight = Math.round((t.total / maxMonthly) * 110);
              const closedHeight = Math.round((t.closed / maxMonthly) * 110);

              return (
                <div key={t.month} className="flex flex-col items-center">
                  <div className="h-32 flex items-end justify-center gap-1.5 w-full">
                    <div
                      className="w-4 sm:w-6 bg-blue-600 rounded-t transition-all hover:bg-blue-700 relative group"
                      style={{ height: `${Math.max(totalHeight, 4)}px` }}
                      title={`${t.month}: ${t.total} total cases`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-10 transition">
                        {t.total}
                      </div>
                    </div>
                    <div
                      className="w-4 sm:w-6 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600 relative group"
                      style={{ height: `${Math.max(closedHeight, 4)}px` }}
                      title={`${t.month}: ${t.closed} closed cases`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-10 transition">
                        {t.closed}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 mt-2 truncate">
                    {t.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. SLA Performance Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>SLA Performance Health</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Compliance</span>
            </div>

            <div className="space-y-3">
              {/* Met */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-950">Met / Resolved On Time</span>
                </div>
                <span className="text-xs font-bold text-emerald-800">{slaBreakdown.met}</span>
              </div>

              {/* On Track */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-xs font-semibold text-blue-950">Active &bull; On Track (&gt; 48h)</span>
                </div>
                <span className="text-xs font-bold text-blue-800">{slaBreakdown.onTrack}</span>
              </div>

              {/* Approaching */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-950">Approaching (&le; 48h)</span>
                </div>
                <span className="text-xs font-bold text-amber-800">{slaBreakdown.approaching}</span>
              </div>

              {/* Breached */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  <span className="text-xs font-semibold text-rose-950">Breached / Overdue</span>
                </div>
                <span className="text-xs font-bold text-rose-800">{slaBreakdown.breached}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Corporate SLA Standard: Critical (72h), Major (7 Days), Minor (14 Days).
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION E (Continued): 6. PRIORITY ATTENTION QUEUE TABLE
          Direct operational queue for immediate investigator & PIC actions
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Priority Attention Queue (Critical, Breached &amp; Approaching SLA)</span>
            </h3>
            <p className="text-xs text-slate-500">
              High-priority cases requiring immediate HR investigator or PIC intervention
            </p>
          </div>
          <button
            onClick={onNavigateToCases}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 self-start sm:self-auto"
          >
            <span>View All Cases in Case Management</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Reporter / Complainant</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned PIC</th>
                <th className="py-3 px-4">SLA Clock</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {urgentQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-600">No Urgent or Overdue Cases in Queue</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All grievances are currently progressing on track within established SLA deadlines.
                    </p>
                  </td>
                </tr>
              ) : (
                urgentQueue.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {c.ticketId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {c.isAnonymous ? (
                        <span className="text-slate-500 italic flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>{c.anonymousAlias || 'Protected Whistleblower'}</span>
                        </span>
                      ) : (
                        <span>{c.employeeName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[160px] truncate" title={c.complaintCategory}>
                      {c.complaintCategory}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          c.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : c.priority === 'Major'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          c.status === 'Investigation'
                            ? 'bg-amber-100 text-amber-800'
                            : c.status === 'Action Taken'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[120px]" title={c.assignedPic || '-'}>
                      {c.assignedPic || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 ${
                          c.slaStatus === 'Breached'
                            ? 'bg-rose-600 text-white'
                            : c.slaStatus === 'Approaching Due'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {c.slaStatus === 'Breached'
                            ? 'Overdue'
                            : c.slaHoursLeft !== undefined
                            ? `${c.slaHoursLeft}h left`
                            : 'On Track'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onOpenCase(c)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold border border-slate-200 transition"
                      >
                        Open Case
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
