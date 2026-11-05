import React, { useState, useEffect } from 'react';
import { GrievanceCase, PriorityLevel, CaseStatus, GrievanceInstrument, MasterCategory, MasterDepartment } from '../types';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { getCategories, getDepartments, calculateDueDateFromGrievanceDate } from '../services/db';
import { X, Edit3, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface EditCaseModalProps {
  caseData: GrievanceCase | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({ caseData, isOpen, onClose }) => {
  const { handleUpdateCase } = useCases();
  const { currentUser } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ticketId: '',
    dateReceived: '',
    dueDate: '',
    priority: 'Major' as PriorityLevel,
    status: 'Open' as CaseStatus,
    department: 'HR',
    complaintCategory: 'Kebijakan',
    employeeName: '',
    isAnonymous: false,
    anonymousAlias: '',
    assignedPic: '',
    channelReceived: 'Online' as GrievanceInstrument,
    description: '',
    incidentDate: '',
    location: '',
    involvedParties: '',
    closingDate: '',
  });

  useEffect(() => {
    getCategories().then((cats) => cats && setCategories(cats));
    getDepartments().then((depts) => depts && setDepartments(depts));
  }, []);

  useEffect(() => {
    if (caseData) {
      setFormData({
        ticketId: caseData.ticketId || '',
        dateReceived: caseData.dateReceived || new Date().toISOString().substring(0, 10),
        dueDate: caseData.dueDate || calculateDueDateFromGrievanceDate(caseData.dateReceived, caseData.priority),
        priority: caseData.priority || 'Major',
        status: caseData.status || 'Open',
        department: caseData.department || 'HR',
        complaintCategory: caseData.complaintCategory || 'Kebijakan',
        employeeName: caseData.employeeName || '',
        isAnonymous: Boolean(caseData.isAnonymous),
        anonymousAlias: caseData.anonymousAlias || '',
        assignedPic: caseData.assignedPic || '',
        channelReceived: (caseData.channelReceived || 'Online') as GrievanceInstrument,
        description: caseData.description || '',
        incidentDate: caseData.incidentDate || '',
        location: caseData.location || '',
        involvedParties: caseData.involvedParties || '',
        closingDate: caseData.closingDate || '',
      });
      setErrorMsg(null);
    }
  }, [caseData]);

  if (!isOpen || !caseData) return null;

  // When dateReceived or priority changes, dynamically re-calculate target due date
  const handleDateReceivedChange = (newDate: string) => {
    const autoDue = calculateDueDateFromGrievanceDate(newDate, formData.priority);
    setFormData((prev) => ({
      ...prev,
      dateReceived: newDate,
      dueDate: autoDue,
    }));
  };

  const handlePriorityChange = (newPriority: PriorityLevel) => {
    const autoDue = calculateDueDateFromGrievanceDate(formData.dateReceived, newPriority);
    setFormData((prev) => ({
      ...prev,
      priority: newPriority,
      dueDate: autoDue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setErrorMsg('Uraian keluhan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const updates: Partial<GrievanceCase> = {
        dateReceived: formData.dateReceived,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: formData.status,
        department: formData.department,
        complaintCategory: formData.complaintCategory,
        employeeName: formData.isAnonymous ? 'Pelapor Anonim' : formData.employeeName || 'Karyawan SJI',
        isAnonymous: formData.isAnonymous,
        anonymousAlias: formData.isAnonymous ? formData.anonymousAlias || 'Whistleblower' : null,
        assignedPic: formData.assignedPic,
        channelReceived: formData.channelReceived,
        description: formData.description,
        incidentDate: formData.incidentDate || null,
        location: formData.location || null,
        involvedParties: formData.involvedParties || null,
        closingDate: formData.status === 'Closed' ? (formData.closingDate || new Date().toISOString().substring(0, 10)) : null,
        progress: formData.status === 'Closed' ? 100 : formData.status === 'Action Taken' ? 75 : formData.status === 'Investigation' ? 45 : 15,
      };

      await handleUpdateCase(caseData.id, updates, 'Revisi data keluhan oleh user berwenang');
      toast.success(`Data keluhan #${caseData.ticketId} berhasil diperbarui.`);
      onClose();
    } catch (err: any) {
      const msg = 'Gagal memperbarui keluhan: ' + (err.message || 'Periksa koneksi jaringan.');
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Edit3 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base leading-tight">Edit Data Keluhan Karyawan</h3>
              <p className="text-xs text-slate-400">
                Koreksi informasi, penyesuaian tanggal keluhan, atau pembaruan PIC (Tiket: {caseData.ticketId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ticket ID & Grievance Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nomor Tiket (Read-only)</label>
              <input
                type="text"
                disabled
                value={formData.ticketId}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-blue-900 bg-slate-100 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Tanggal Keluhan (Grievance Date) *
              </label>
              <input
                type="date"
                required
                value={formData.dateReceived}
                onChange={(e) => handleDateReceivedChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-[10px] text-slate-500">Dasar perhitungan SLA &amp; laporan</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Target Selesai (Due Date) *
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
              />
              <span className="text-[10px] text-blue-600 font-medium">Berdasarkan Tgl Keluhan + SLA</span>
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status Kasus (4 Tahapan) *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CaseStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="Open">1. Open</option>
                <option value="Investigation">2. Investigation</option>
                <option value="Action Taken">3. Action Taken</option>
                <option value="Closed">4. Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Prioritas (SLA Target) *</label>
              <select
                value={formData.priority}
                onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="Minor">Minor (3 Hari)</option>
                <option value="Major">Major (7 Hari)</option>
                <option value="Critical">Critical (14 Hari)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Saluran Masuk (Instrument) *</label>
              <select
                value={formData.channelReceived}
                onChange={(e) => setFormData({ ...formData, channelReceived: e.target.value as GrievanceInstrument })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Online">1. Online (Website Internal)</option>
                <option value="Grievance Box">2. Grievance Box (Kotak Saran)</option>
                <option value="Verbal">3. Verbal (Lisan Langsung)</option>
                <option value="Hotline">4. Hotline (WhatsApp / Telepon)</option>
              </select>
            </div>
          </div>

          {/* Department & Complaint Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Departemen *</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Kategori Keluhan *</label>
              <select
                value={formData.complaintCategory}
                onChange={(e) => setFormData({ ...formData, complaintCategory: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Complainant Identity */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Pelapor Meminta Identitas Dirahasiakan (Anonim)</span>
              </label>
              {formData.isAnonymous && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  Masked Protected
                </span>
              )}
            </div>

            {formData.isAnonymous ? (
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">
                  Alias Pelapor Anonim
                </label>
                <input
                  type="text"
                  value={formData.anonymousAlias}
                  onChange={(e) => setFormData({ ...formData, anonymousAlias: e.target.value })}
                  placeholder="Contoh: Whistleblower #4821"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-mono text-slate-800"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Karyawan Pelapor *</label>
                <input
                  type="text"
                  value={formData.employeeName}
                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                  placeholder="Nama lengkap pelapor"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Assigned PIC */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">PIC Departemen Bertanggung Jawab</label>
            <input
              type="text"
              value={formData.assignedPic}
              onChange={(e) => setFormData({ ...formData, assignedPic: e.target.value })}
              placeholder="Nama PIC penanggung jawab"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
            />
          </div>

          {/* Incident Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tanggal Kejadian</label>
              <input
                type="date"
                value={formData.incidentDate}
                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Lokasi Kejadian</label>
              <input
                type="text"
                placeholder="Misal: Line 3 Sewing, Gedung B"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Pihak Terkait</label>
              <input
                type="text"
                placeholder="Misal: Supervisor shift, saksi"
                value={formData.involvedParties}
                onChange={(e) => setFormData({ ...formData, involvedParties: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Uraian / Narasi Keluhan *</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* If Closed, optional closing date */}
          {formData.status === 'Closed' && (
            <div>
              <label className="block text-emerald-800 font-semibold mb-1">Tanggal Penyelesaian (Closing Date)</label>
              <input
                type="date"
                value={formData.closingDate}
                onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                className="w-full sm:w-60 px-3 py-2 border border-emerald-300 rounded-lg bg-emerald-50 text-emerald-950 font-medium"
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan Perubahan...' : 'Simpan Pembaruan Keluhan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
