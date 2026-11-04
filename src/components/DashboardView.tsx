import React from 'react';
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
  PieChart
} from 'lucide-react';
import { GrievanceCase } from '../types';

interface DashboardViewProps {
  onOpenCase: (c: GrievanceCase) => void;
  onNavigateToCases: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenCase, onNavigateToCases }) => {
  const { cases, stats, setIsNewCaseModalOpen, setIsImportModalOpen, handleExport } = useCases();
  const { currentUser, canRegisterCase } = useAuth();

  // Urgent cases needing prompt action (Breached or Critical)
  const urgentCases = cases
    .filter((c) => (c.slaStatus === 'Breached' || c.priority === 'Critical') && c.status !== 'Closed')
    .slice(0, 5);

  // Status distribution (Siklus 4 Tahapan SJI: Open -> Investigation -> Action Taken -> Closed)
  const statusCounts: Record<string, number> = {
    Open: cases.filter((c) => c.status === 'Open').length,
    Investigation: cases.filter((c) => c.status === 'Investigation').length,
    'Action Taken': cases.filter((c) => c.status === 'Action Taken').length,
    Closed: cases.filter((c) => c.status === 'Closed').length,
  };

  // Category counts
  const categoryMap = cases.reduce((acc, c) => {
    acc[c.complaintCategory] = (acc[c.complaintCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Instrument counts
  const instrumentMap: Record<string, number> = {
    Online: cases.filter((c) => c.channelReceived === 'Online').length,
    'Grievance Box': cases.filter((c) => c.channelReceived === 'Grievance Box').length,
    Verbal: cases.filter((c) => c.channelReceived === 'Verbal').length,
    Hotline: cases.filter((c) => c.channelReceived === 'Hotline').length,
  };

  // Department counts
  const departmentMap = cases.reduce((acc, c) => {
    acc[c.department] = (acc[c.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Welcome & Context Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Executive HRIS Grievance Oversight
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
              Live SJI Instance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-700">{currentUser?.displayName}</span> (
            <span className="capitalize">{currentUser?.role.replace('_', ' ')}</span>) • 
            {currentUser?.role === 'department_pic'
              ? ` Department PIC filtered view (${currentUser.department})`
              : ' Full corporate HR scope'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRegisterCase && (
            <>
              <button
                onClick={() => setIsNewCaseModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register Grievance</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Import from Website File</span>
              </button>
            </>
          )}
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cases */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Active Cases
            </span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-500 font-medium">
              {stats.closed} Closed
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{
                width: `${stats.total ? Math.round((stats.closed / stats.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* In Investigation */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              In Active Investigation
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{stats.investigation}</span>
            <span className="text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {stats.actionTaken} Action Taken
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Assigned to HR Investigator &amp; PICs
          </p>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SLA Compliance Rate
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{stats.complianceRate}%</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                stats.complianceRate >= 90
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {stats.slaBreachedCount === 0 ? 'Optimal' : `${stats.slaBreachedCount} Overdue`}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${stats.complianceRate >= 90 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${stats.complianceRate}%` }}
            />
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Critical Urgency Cases
            </span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700">{stats.criticalCount}</span>
            <span className="text-xs text-slate-500 font-medium">Harassment &amp; Safety</span>
          </div>
          <p className="mt-3 text-[11px] text-rose-600 font-medium">
            Requires 72h executive escalation SLA
          </p>
        </div>
      </div>

      {/* SLA Alert Callout (If breaches or approaching) */}
      {(stats.slaBreachedCount > 0 || stats.slaApproachingCount > 0) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                SLA Compliance Watchlist Notice
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                There are <span className="font-bold">{stats.slaBreachedCount} breached</span> cases and{' '}
                <span className="font-bold">{stats.slaApproachingCount} cases approaching due date</span> within 48
                hours. Corporate governance mandates immediate resolution review by the assigned HR Investigator and PIC.
              </p>
            </div>
            <button
              onClick={onNavigateToCases}
              className="text-xs font-bold text-rose-900 hover:text-rose-700 underline flex items-center space-x-1"
            >
              <span>Inspect Cases</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Grievance Intake Instrument Monitoring */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Distribusi Saluran Masuk (Instrument Grievance)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Sistem Monitoring Terpadu</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">1. Online</span>
              <span className="text-xl font-black text-blue-900">{instrumentMap['Online'] || 0}</span>
              <span className="text-[10px] text-blue-600 block">Website Internal</span>
            </div>
            <span className="p-2 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">Web</span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">2. Grievance Box</span>
              <span className="text-xl font-black text-amber-900">{instrumentMap['Grievance Box'] || 0}</span>
              <span className="text-[10px] text-amber-600 block">Kotak Saran Fisik</span>
            </div>
            <span className="p-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">Box</span>
          </div>

          <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">3. Verbal</span>
              <span className="text-xl font-black text-purple-900">{instrumentMap['Verbal'] || 0}</span>
              <span className="text-[10px] text-purple-600 block">Lisan Langsung ke HR</span>
            </div>
            <span className="p-2 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold">Talk</span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">4. Hotline</span>
              <span className="text-xl font-black text-emerald-900">{instrumentMap['Hotline'] || 0}</span>
              <span className="text-[10px] text-emerald-600 block">Telepon / WhatsApp</span>
            </div>
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">Call</span>
          </div>
        </div>
      </div>

      {/* Charts & Analytical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Lifecycle Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Grievance Lifecycle Stages</span>
            </h3>
            <span className="text-[11px] text-slate-400">Standard SJI Flow</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(statusCounts).map(([status, count]) => {
              const max = Math.max(...Object.values(statusCounts), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{status}</span>
                    <span className="font-bold text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        status === 'Closed'
                          ? 'bg-emerald-500'
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
        </div>

        {/* Complaint Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>Complaint Category Breakdown</span>
            </h3>
            <span className="text-[11px] text-slate-400">Volume</span>
          </div>
          <div className="space-y-3">
            {Object.entries(categoryMap).map(([cat, count]) => {
              const total = cases.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={cat} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <div className="truncate pr-2">
                    <p className="font-medium text-slate-800 truncate">{cat}</p>
                    <span className="text-[10px] text-slate-400">{pct}% of total grievances</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-xs">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Heatmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Department Distribution</span>
            </h3>
            <span className="text-[11px] text-slate-400">PIC Assignments</span>
          </div>
          <div className="space-y-3">
            {Object.entries(departmentMap).map(([dept, count]) => {
              return (
                <div key={dept} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-800">{dept}</span>
                  </div>
                  <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                    {count} Cases
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Urgent Cases Table / Direct Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Priority Attention Queue (Critical &amp; Approaching SLA)
            </h3>
            <p className="text-xs text-slate-500">Cases requiring prompt investigator intervention</p>
          </div>
          <button
            onClick={onNavigateToCases}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>View All Cases</span>
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
              {urgentCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No critical or overdue cases in queue. All SLAs are currently on track.
                  </td>
                </tr>
              ) : (
                urgentCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {c.ticketId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {c.isAnonymous ? (
                        <span className="text-slate-500 italic flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-slate-400 mr-1" />
                          {c.anonymousAlias || 'Protected Whistleblower'}
                        </span>
                      ) : (
                        c.employeeName
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{c.complaintCategory}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.assignedPic}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.slaStatus === 'Breached'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {c.slaStatus === 'Breached' ? 'Overdue' : `${c.slaHoursLeft}h left`}
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
