import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Check,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Calendar,
  Save,
  X,
  Eye,
  RefreshCw
} from 'lucide-react';
import { GrievanceCase, ActionPlan, CapaProgressStatus } from '../types';
import {
  getCaseActionPlans,
  addCaseActionPlan,
  updateCaseActionPlan,
  deleteCaseActionPlan
} from '../services/db';

interface ActionPlanViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const ActionPlanView: React.FC<ActionPlanViewProps> = ({ onOpenCase }) => {
  const { cases, handleUpdateCase } = useCases();
  const { currentUser } = useAuth();

  // Selected filter states
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Progress' | 'Completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Plans collection
  const [allPlans, setAllPlans] = useState<ActionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);

  // Form State with the 8 exact fields
  const [form, setForm] = useState({
    ticketId: '',
    caseId: '',
    description: '',
    responsiblePic: '',
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    actionTaken: '',
    progressStatus: 'Progress' as CapaProgressStatus,
    completionDate: '',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load all action plans for all cases
  const loadAllPlans = async () => {
    setIsLoading(true);
    try {
      const planPromises = cases.map(async (c) => {
        const plans = await getCaseActionPlans(c.id);
        return plans.map((p) => ({
          ...p,
          ticketId: p.ticketId || c.ticketId,
          caseId: c.id,
        }));
      });
      const results = await Promise.all(planPromises);
      const flattened = results.flat();
      setAllPlans(flattened);
    } catch (err) {
      console.warn('Error loading CAPA plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllPlans();
  }, [cases.length]);

  const openAddModal = (defaultCase?: GrievanceCase) => {
    const targetCase = defaultCase || cases[0];
    setEditingPlan(null);
    setForm({
      ticketId: targetCase?.ticketId || '',
      caseId: targetCase?.id || '',
      description: '',
      responsiblePic: targetCase?.assignedPic || currentUser?.displayName || '',
      targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      actionTaken: '',
      progressStatus: 'Progress',
      completionDate: '',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: ActionPlan) => {
    setEditingPlan(plan);
    setForm({
      ticketId: plan.ticketId,
      caseId: plan.caseId,
      description: plan.description || plan.title || '',
      responsiblePic: plan.responsiblePic || plan.assignedTo || '',
      targetDate: plan.targetDate || '',
      actionTaken: plan.actionTaken || '',
      progressStatus: (plan.progressStatus === 'Completed' || plan.status === 'Completed' ? 'Completed' : 'Progress'),
      completionDate: plan.completionDate || (plan.progressStatus === 'Completed' ? new Date().toISOString().substring(0, 10) : ''),
      notes: plan.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!form.ticketId.trim()) {
      setFormError('Ticket ID wajib diisi.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Action Plan Description wajib diisi.');
      return;
    }
    if (!form.responsiblePic.trim()) {
      setFormError('Responsible Department PIC wajib diisi.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const targetCase = cases.find((c) => c.ticketId === form.ticketId || c.id === form.caseId) || cases[0];
      const caseId = targetCase?.id || form.caseId;

      if (editingPlan) {
        // Edit / Revisi existing CAPA
        await updateCaseActionPlan(
          caseId,
          editingPlan.id,
          {
            ticketId: form.ticketId,
            description: form.description,
            responsiblePic: form.responsiblePic,
            targetDate: form.targetDate,
            actionTaken: form.actionTaken,
            progressStatus: form.progressStatus,
            completionDate: form.progressStatus === 'Completed' ? (form.completionDate || new Date().toISOString().substring(0, 10)) : undefined,
            notes: form.notes,
          },
          currentUser
        );
      } else {
        // Add new CAPA
        await addCaseActionPlan(
          caseId,
          {
            ticketId: form.ticketId,
            caseId,
            description: form.description,
            responsiblePic: form.responsiblePic,
            targetDate: form.targetDate,
            actionTaken: form.actionTaken,
            progressStatus: form.progressStatus,
            completionDate: form.progressStatus === 'Completed' ? (form.completionDate || new Date().toISOString().substring(0, 10)) : undefined,
            notes: form.notes,
          },
          currentUser
        );
      }

      await loadAllPlans();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving CAPA:', err);
      setFormError('Gagal menyimpan CAPA: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggleStatus = async (plan: ActionPlan) => {
    if (!currentUser) return;
    const newStatus: CapaProgressStatus = plan.progressStatus === 'Completed' ? 'Progress' : 'Completed';
    const completionDate = newStatus === 'Completed' ? new Date().toISOString().substring(0, 10) : undefined;

    try {
      await updateCaseActionPlan(
        plan.caseId,
        plan.id,
        {
          progressStatus: newStatus,
          completionDate,
        },
        currentUser
      );
      setAllPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id ? { ...p, progressStatus: newStatus, completionDate } : p
        )
      );
    } catch (err) {
      console.warn('Error toggling CAPA status:', err);
    }
  };

  const handleDeletePlan = async (plan: ActionPlan) => {
    if (!currentUser) return;
    if (!window.confirm(`Hapus rencana perbaikan #${plan.ticketId}? Data akan dihapus permanen.`)) {
      return;
    }
    try {
      await deleteCaseActionPlan(plan.caseId, plan.id, currentUser);
      setAllPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err) {
      console.warn('Error deleting CAPA:', err);
    }
  };

  // Filtered plans
  const filteredPlans = allPlans.filter((plan) => {
    if (selectedCaseId !== 'all' && plan.caseId !== selectedCaseId) return false;
    if (statusFilter !== 'all' && plan.progressStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTicket = plan.ticketId?.toLowerCase().includes(q);
      const matchDesc = plan.description?.toLowerCase().includes(q);
      const matchPic = plan.responsiblePic?.toLowerCase().includes(q);
      if (!matchTicket && !matchDesc && !matchPic) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">CAPA / Action Plan Management</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Korektif &amp; Preventif
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
              Revisi &amp; Edit Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan rencana aksi perbaikan terstruktur dengan 8 field wajib dan status tegas: <strong>Progress</strong> atau <strong>Completed</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah CAPA Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Ticket ID, deskripsi, PIC..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Case Ticket */}
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Kasus ({cases.length})</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.ticketId} - {c.department}
              </option>
            ))}
          </select>

          {/* Status Filter (Strictly Progress | Completed) */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({allPlans.length})
            </button>
            <button
              onClick={() => setStatusFilter('Progress')}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === 'Progress' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Progress ({allPlans.filter((p) => p.progressStatus === 'Progress').length})
            </button>
            <button
              onClick={() => setStatusFilter('Completed')}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === 'Completed' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({allPlans.filter((p) => p.progressStatus === 'Completed').length})
            </button>
          </div>
        </div>

        <button
          onClick={loadAllPlans}
          title="Muat Ulang Data"
          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Plans List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredPlans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            {isLoading ? 'Memuat data CAPA...' : 'Belum ada data rencana aksi (CAPA) yang sesuai dengan filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Action Plan Description</th>
                  <th className="px-4 py-3">Responsible PIC</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3">Action Taken</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completion Date</th>
                  <th className="px-4 py-3">Notes / Revisi</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((plan) => {
                  const isCompleted = plan.progressStatus === 'Completed';
                  const associatedCase = cases.find((c) => c.ticketId === plan.ticketId || c.id === plan.caseId);

                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition">
                      {/* Ticket ID */}
                      <td className="px-4 py-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {plan.ticketId}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-xs">
                        <div className="line-clamp-2">{plan.description || plan.title || '-'}</div>
                      </td>

                      {/* Responsible PIC */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        <span className="font-semibold">{plan.responsiblePic || plan.assignedTo || 'Unassigned'}</span>
                        {associatedCase && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            Dept: {associatedCase.department}
                          </div>
                        )}
                      </td>

                      {/* Target Date */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">
                        {plan.targetDate || '-'}
                      </td>

                      {/* Action Taken */}
                      <td className="px-4 py-3 text-slate-600 max-w-xs">
                        <div className="line-clamp-2">{plan.actionTaken || <span className="text-slate-400 italic">Belum ada tindakan tercatat</span>}</div>
                      </td>

                      {/* Progress Status (Strictly Progress | Completed) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Completed
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              Progress
                            </>
                          )}
                        </span>
                      </td>

                      {/* Completion Date */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {plan.completionDate || (isCompleted ? 'Tuntas' : '-')}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 text-slate-500 max-w-[180px]">
                        <div className="truncate text-[11px]" title={plan.notes}>
                          {plan.notes || '-'}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => handleQuickToggleStatus(plan)}
                          title={isCompleted ? 'Kembalikan ke Progress' : 'Tandai Selesai (Completed)'}
                          className={`p-1.5 rounded transition ${
                            isCompleted
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {isCompleted ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(plan)}
                          title="Edit / Revisi CAPA (Mark Progress / Update)"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {associatedCase && (
                          <button
                            type="button"
                            onClick={() => onOpenCase(associatedCase, 'action_plan')}
                            title="Buka Detail Kasus"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan)}
                          title="Hapus Rencana"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Working Add / Edit Modal (Revisi Data CAPA) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editingPlan ? 'Edit / Revisi CAPA (Action Plan)' : 'Tambah CAPA Baru'}
                </h3>
                <p className="text-xs text-slate-400">
                  Perubahan akan tersimpan permanen ke Firestore dan langsung muncul pada detail kasus.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Ticket ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Ticket ID <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.ticketId}
                    onChange={(e) => {
                      const selected = cases.find((c) => c.ticketId === e.target.value);
                      setForm({
                        ...form,
                        ticketId: e.target.value,
                        caseId: selected?.id || form.caseId,
                        responsiblePic: selected?.assignedPic || form.responsiblePic,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    <option value="">-- Pilih Ticket ID --</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.ticketId}>
                        {c.ticketId} ({c.department})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Responsible Department PIC */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Responsible Department PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.responsiblePic}
                    onChange={(e) => setForm({ ...form, responsiblePic: e.target.value })}
                    required
                    placeholder="Nama PIC Departemen Penanggung Jawab"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 2. Action Plan Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Action Plan Description (Rencana Tindakan) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  placeholder="Rincian perbaikan atau pencegahan yang wajib dilaksanakan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 4. Target Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Target Date (Batas Waktu) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* 6. Progress Status (Only Progress | Completed) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6. Progress Status (Hanya 2 Status) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.progressStatus}
                    onChange={(e) => {
                      const val = e.target.value as CapaProgressStatus;
                      setForm({
                        ...form,
                        progressStatus: val,
                        completionDate: val === 'Completed' ? new Date().toISOString().substring(0, 10) : '',
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="Progress">Progress (Dalam Pengerjaan)</option>
                    <option value="Completed">Completed (Selesai Tuntas)</option>
                  </select>
                </div>
              </div>

              {/* 5. Action Taken */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  5. Action Taken (Tindakan Nyata yang Dilakukan)
                </label>
                <textarea
                  rows={2}
                  value={form.actionTaken}
                  onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                  placeholder="Jelaskan tindakan konkrit yang telah dijalankan di lapangan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 7. Completion Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    7. Completion Date (Tanggal Selesai)
                  </label>
                  <input
                    type="date"
                    value={form.completionDate}
                    onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
                    disabled={form.progressStatus !== 'Completed'}
                    placeholder="Wajib jika status Completed"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-slate-100"
                  />
                </div>

                {/* 8. Notes / Revisi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    8. Notes (Catatan / Alasan Revisi)
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Contoh: Revisi batas waktu atas instruksi HR Head"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Data CAPA'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
