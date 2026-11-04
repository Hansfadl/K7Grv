import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { GrievanceCase, MasterDepartment } from '../types';
import { getDepartments } from '../services/db';
import { INITIAL_DEPARTMENTS } from '../services/mockData';
import {
  Search,
  Filter,
  PlusCircle,
  FileSpreadsheet,
  Download,
  RotateCcw,
  AlertCircle,
  Clock,
  Eye,
  CheckCircle,
  Shield,
  Building,
  User,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

interface CaseManagementViewProps {
  onOpenCase: (c: GrievanceCase) => void;
}

export const CaseManagementView: React.FC<CaseManagementViewProps> = ({ onOpenCase }) => {
  const [departments, setDepartments] = useState<MasterDepartment[]>(INITIAL_DEPARTMENTS);

  useEffect(() => {
    getDepartments().then((depts) => {
      if (depts && depts.length > 0) setDepartments(depts);
    });
  }, []);
  const {
    filteredCases,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    departmentFilter,
    setDepartmentFilter,
    categoryFilter,
    setCategoryFilter,
    resetFilters,
    handleExport,
    setIsNewCaseModalOpen,
    setIsImportModalOpen,
    handleDeleteCase,
    stats
  } = useCases();

  const { currentUser, canRegisterCase, canDeleteCase, confidentialMode } = useAuth();

  // Erroneous Case Deletion Modal State
  const [caseToDelete, setCaseToDelete] = useState<GrievanceCase | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('Salah input data keluhan');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteCase(caseToDelete.id, deleteReason.trim() || 'Salah input data keluhan');
      setCaseToDelete(null);
      setDeleteReason('Salah input data keluhan');
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus data keluhan.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Critical</span>;
      case 'Major':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Major</span>;
      case 'Minor':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Minor</span>;
      default:
        return <span>{priority}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Open</span>;
      case 'Investigation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Investigation</span>;
      case 'Action Taken':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Action Taken</span>;
      case 'Closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Closed</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getSlaBadge = (c: GrievanceCase) => {
    if (c.status === 'Closed') {
      return (
        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
          Closed
        </span>
      );
    }
    if (c.slaStatus === 'Breached') {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-white bg-rose-600 px-2 py-0.5 rounded animate-pulse">
          <Clock className="w-3 h-3 mr-1" />
          Overdue
        </span>
      );
    }
    if (c.slaStatus === 'Approaching Due') {
      return (
        <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
          <Clock className="w-3 h-3 mr-1 text-amber-600" />
          {c.slaHoursLeft}h left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
        On Track ({c.slaHoursLeft}h)
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Case Management Directory</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                {filteredCases.length} records found
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive registry of employee grievances received via the internal intake website.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canRegisterCase && (
              <>
                <button
                  onClick={() => setIsNewCaseModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Register Grievance</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  title="Import Excel or CSV file"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Import Excel</span>
                </button>
              </>
            )}

            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleExport('xlsx')}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title="Export filtered records to Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition"
                title="Export as CSV"
              >
                CSV
              </button>
            </div>
          </div>
        </div>

        {/* PIC Restricted Notice */}
        {currentUser?.role === 'department_pic' && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Department PIC Scope Enforced:</strong> You are currently restricted to viewing cases
              pertaining to the <strong>{currentUser.department}</strong> department or assigned directly to you.
            </span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Ticket ID, employee, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Status (All)</option>
              <option value="Open">Open</option>
              <option value="Investigation">Investigation</option>
              <option value="Action Taken">Action Taken</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Prioritas</option>
              <option value="Critical">Critical (14 Hari)</option>
              <option value="Major">Major (7 Hari)</option>
              <option value="Minor">Minor (3 Hari)</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Departemen</option>
              {departments.filter(d => d.active).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters / Mengatur Ulang */}
          <div className="flex items-center">
            <button
              onClick={resetFilters}
              title="Mengatur ulang semua filter pencarian"
              className="w-full inline-flex items-center justify-center space-x-1.5 py-1.5 px-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Mengatur Ulang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-semibold">
                <th className="py-3 px-3">Ticket ID</th>
                <th className="py-3 px-3">Received</th>
                <th className="py-3 px-3">Employee Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Complaint Category</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Assigned PIC</th>
                <th className="py-3 px-3">Progress</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3">SLA</th>
                <th className="py-3 px-3">Last Update</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No grievance records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or register a new case.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCase(c)}
                    className="hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    {/* Ticket ID & Instrument */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-blue-700">{c.ticketId}</div>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                        c.channelReceived === 'Online'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : c.channelReceived === 'Grievance Box'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : c.channelReceived === 'Verbal'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {c.channelReceived || 'Online'}
                      </span>
                    </td>

                    {/* Date Received */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {c.dateReceived}
                    </td>

                    {/* Employee Name (confidentiality protection) */}
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {c.isAnonymous ? (
                        <div className="flex items-center space-x-1 text-slate-500">
                          <Shield className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="italic">
                            {confidentialMode
                              ? c.anonymousAlias || 'Whistleblower (Protected)'
                              : `${c.anonymousAlias} [UNMASKED: Anonymous Reporter]`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{c.employeeName}</span>
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {c.department}
                    </td>

                    {/* Complaint Category */}
                    <td className="py-3 px-3 font-medium text-slate-800 max-w-[200px] truncate" title={c.complaintCategory}>
                      {c.complaintCategory}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getPriorityBadge(c.priority)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Assigned PIC */}
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {c.assignedPic || 'Unassigned'}
                    </td>

                    {/* Progress */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${c.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">{c.progress}%</span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {c.dueDate}
                    </td>

                    {/* SLA */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getSlaBadge(c)}
                    </td>

                    {/* Last Update */}
                    <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {c.lastUpdate}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCase(c);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition"
                          title="Periksa rincian kasus"
                        >
                          Inspect
                        </button>
                        {canDeleteCase && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCaseToDelete(c);
                              setDeleteReason('Salah input data keluhan');
                              setDeleteError(null);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition border border-transparent hover:border-rose-200"
                            title="Hapus jika salah input (HR Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Kasus Salah Input */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Hapus Keluhan (Koreksi Salah Input)</h3>
                  <p className="text-xs text-rose-100 mt-0.5">Penghapusan data &amp; pencatatan Audit Trail HR</p>
                </div>
              </div>
              <button
                onClick={() => setCaseToDelete(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Warning card */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Perhatian:</span> Gunakan fitur ini jika terjadi kesalahan penginputan data (human error), duplikasi tiket, atau pengujian. Kasus akan dihapus secara permanen dari database dan tercatat pada <strong>Audit Trail</strong>.
                </div>
              </div>

              {/* Case Info Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Nomor Tiket:</span>
                  <span className="font-mono font-bold text-blue-700">{caseToDelete.ticketId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Pelapor:</span>
                  <span className="font-semibold text-slate-800">
                    {caseToDelete.isAnonymous ? (caseToDelete.anonymousAlias || 'Anonim') : caseToDelete.employeeName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Departemen:</span>
                  <span className="text-slate-700">{caseToDelete.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Kategori Keluhan:</span>
                  <span className="text-slate-700 font-medium">{caseToDelete.complaintCategory}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Tanggal Diterima:</span>
                  <span className="text-slate-700">{caseToDelete.dateReceived}</span>
                </div>
              </div>

              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Alasan Penghapusan / Koreksi <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Salah input kategori / departemen',
                    'Data keluhan duplikat',
                    'Testing / uji coba sistem',
                    'Salah identitas pelapor / nomor tiket',
                    'Dibatalkan resmi oleh pelapor',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeleteReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        deleteReason === preset
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={2}
                  placeholder="Tuliskan alasan spesifik penghapusan..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
              </div>

              {deleteError && (
                <div className="p-2.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCaseToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting || !deleteReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition flex items-center space-x-1.5 shadow-xs"
                >
                  {isDeleting ? (
                    <span>Menghapus...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Kasus Ini</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
