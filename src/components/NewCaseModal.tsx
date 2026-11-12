import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { PriorityLevel, GrievanceCase, MasterCategory, MasterDepartment, GrievanceInstrument } from '../types';
import { INITIAL_CATEGORIES, INITIAL_DEPARTMENTS } from '../services/mockData';
import { getCategories, getDepartments, calculateDueDateFromGrievanceDate } from '../services/db';
import { X, ShieldCheck, AlertCircle, Building2, User, Clock, FileText } from 'lucide-react';

export const NewCaseModal: React.FC = () => {
  const { isNewCaseModalOpen, setIsNewCaseModalOpen, handleCreateCase, cases } = useCases();
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<MasterCategory[]>(INITIAL_CATEGORIES);
  const [departments, setDepartments] = useState<MasterDepartment[]>(INITIAL_DEPARTMENTS);

  // Auto-generate next ticket ID
  const defaultTicket = `GRV-2026-${String(cases.length + 1).padStart(4, '0')}`;
  const initialDateReceived = new Date().toISOString().substring(0, 10);
  const initialDueDate = calculateDueDateFromGrievanceDate(initialDateReceived, 'Major');

  const [formData, setFormData] = useState({
    ticketId: defaultTicket,
    dateReceived: initialDateReceived,
    dueDate: initialDueDate,
    employeeName: '',
    isAnonymous: false,
    anonymousAlias: `Whistleblower #${Math.floor(1000 + Math.random() * 9000)}`,
    department: 'HR',
    complaintCategory: 'Kebijakan',
    priority: 'Major' as PriorityLevel,
    assignedPic: '',
    assignedPicId: 'usr-admin-01',
    assignedInvestigator: '',
    assignedInvestigatorId: '',
    description: '',
    incidentDate: initialDateReceived,
    location: '',
    involvedParties: '',
    channelReceived: 'Online' as GrievanceInstrument,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getCategories().then((cats) => {
      if (cats && cats.length > 0) setCategories(cats);
    });

    const handleCategoriesUpdated = (e: any) => {
      if (e.detail) setCategories(e.detail);
    };
    window.addEventListener('sji_categories_updated', handleCategoriesUpdated);
    getDepartments().then((depts) => {
      if (depts && depts.length > 0) {
        setDepartments(depts);
        if (!formData.assignedPic && depts[0]?.picName) {
          setFormData((prev) => ({
            ...prev,
            assignedPic: depts[0].picName,
          }));
        }
      }
    });

    return () => window.removeEventListener('sji_categories_updated', handleCategoriesUpdated);
  }, [isNewCaseModalOpen]);

  if (!isNewCaseModalOpen) return null;

  // When dateReceived or priority changes, recalculate Due Date strictly from dateReceived
  const handleDateReceivedChange = (newDateReceived: string) => {
    const updatedDueDate = calculateDueDateFromGrievanceDate(newDateReceived, formData.priority);
    setFormData((prev) => ({
      ...prev,
      dateReceived: newDateReceived,
      dueDate: updatedDueDate,
    }));
  };

  const handlePriorityChange = (newPriority: PriorityLevel) => {
    const updatedDueDate = calculateDueDateFromGrievanceDate(formData.dateReceived, newPriority);
    setFormData((prev) => ({
      ...prev,
      priority: newPriority,
      dueDate: updatedDueDate,
    }));
  };

  const handleCategoryChange = (catName: string) => {
    const match = categories.find((c) => c.name === catName);
    const newPriority = match ? match.defaultPriority : formData.priority;
    const updatedDueDate = calculateDueDateFromGrievanceDate(formData.dateReceived, newPriority);
    setFormData((prev) => ({
      ...prev,
      complaintCategory: catName,
      priority: newPriority,
      dueDate: updatedDueDate,
    }));
  };

  const handleDepartmentChange = (deptName: string) => {
    const match = departments.find((d) => d.name === deptName);
    setFormData((prev) => ({
      ...prev,
      department: deptName,
      assignedPic: match?.picName || prev.assignedPic,
      assignedPicId: match ? `usr-pic-${match.code.toLowerCase()}` : prev.assignedPicId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      alert('Uraian keluhan wajib diisi.');
      return;
    }
    setIsSubmitting(true);

    try {
      // Due Date is based on dateReceived, not the input submission timestamp!
      const finalDueDate = formData.dueDate || calculateDueDateFromGrievanceDate(formData.dateReceived, formData.priority);

      await handleCreateCase({
        ticketId: formData.ticketId,
        dateReceived: formData.dateReceived,
        employeeName: formData.isAnonymous ? 'Pelapor Anonim' : formData.employeeName || 'Karyawan SJI',
        isAnonymous: formData.isAnonymous,
        anonymousAlias: formData.isAnonymous ? formData.anonymousAlias || 'Whistleblower' : null,
        department: formData.department,
        complaintCategory: formData.complaintCategory,
        priority: formData.priority,
        status: 'Open',
        assignedPic: formData.assignedPic,
        assignedPicId: formData.assignedPicId,
        assignedInvestigator: formData.assignedInvestigator,
        assignedInvestigatorId: formData.assignedInvestigatorId,
        progress: 15,
        dueDate: finalDueDate,
        closingDate: null,
        slaStatus: 'On Track',
        slaHoursLeft: (formData.priority === 'Critical' ? 14 : formData.priority === 'Major' ? 7 : 3) * 24,
        lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
        description: formData.description,
        incidentDate: formData.incidentDate || null,
        location: formData.location || null,
        involvedParties: formData.involvedParties || null,
        channelReceived: formData.channelReceived,
        createdBy: currentUser?.email,
      });

      setIsNewCaseModalOpen(false);
    } catch (err) {
      console.error('Failed to create grievance:', err);
      alert('Gagal mendaftarkan keluhan. Periksa koneksi jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base">Registrasi Keluhan Karyawan (Intake)</h3>
            <p className="text-xs text-slate-400">
              Pencatatan pengaduan formal yang masuk melalui saluran terpadu SJI
            </p>
          </div>
          <button
            onClick={() => setIsNewCaseModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Intake Scope Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Kerahasiaan &amp; Akurasi Tanggal Keluhan:</strong> Data keluhan tersimpan di database Cloud Firestore.
              Due date / target selesai dihitung berdasarkan <strong>Tanggal Keluhan Diterima</strong>, bukan saat Anda menginput formulir ini.
            </div>
          </div>

          {/* Ticket ID & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nomor Tiket *</label>
              <input
                type="text"
                required
                value={formData.ticketId}
                onChange={(e) => setFormData({ ...formData, ticketId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-blue-900 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Tanggal Keluhan Diterima *
              </label>
              <input
                type="date"
                required
                value={formData.dateReceived}
                onChange={(e) => handleDateReceivedChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-[10px] text-slate-500">Tanggal faktual pengaduan</span>
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
              <span className="text-[10px] text-blue-600 font-medium">Dihitung dari Tgl Keluhan + SLA</span>
            </div>
          </div>

          {/* Instrument Grievance (Saluran Masuk) */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 font-semibold text-xs">
              Instrument Grievance (Saluran Masuk) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Online', label: '1. Online', desc: 'Website Internal' },
                { id: 'Grievance Box', label: '2. Grievance Box', desc: 'Kotak Pengaduan' },
                { id: 'Verbal', label: '3. Verbal', desc: 'Lisan Langsung' },
                { id: 'Hotline', label: '4. Hotline', desc: 'Telepon / WA' },
              ].map((inst) => {
                const isSelected = formData.channelReceived === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, channelReceived: inst.id as GrievanceInstrument })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">{inst.label}</div>
                    <div className="text-[10px] text-slate-500">{inst.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anonymous Reporter Toggle */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Pelapor Meminta Perlindungan Identitas (Whistleblower Anonim)</span>
              </label>
              {formData.isAnonymous && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Identity Masked
                </span>
              )}
            </div>

            {formData.isAnonymous ? (
              <div className="pt-2">
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">
                  Alias Pelapor Terlindungi
                </label>
                <input
                  type="text"
                  value={formData.anonymousAlias}
                  onChange={(e) => setFormData({ ...formData, anonymousAlias: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white font-mono text-slate-700"
                />
              </div>
            ) : (
              <div className="pt-1">
                <label className="block text-slate-700 font-semibold mb-1">Nama Karyawan Pelapor *</label>
                <input
                  type="text"
                  placeholder="Nama lengkap pelapor"
                  value={formData.employeeName}
                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                />
              </div>
            )}
          </div>

          {/* Department & Complaint Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Departemen Terkait *</label>
              <select
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {departments.filter((d) => d.active).map((d) => (
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
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {categories.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {(() => {
                const selected = categories.find((c) => c.name === formData.complaintCategory);
                if (!selected?.description) return null;
                return (
                  <p className="mt-1.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 whitespace-pre-line break-words leading-relaxed">
                    {selected.description}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Priority & SLA Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Prioritas (SLA Target Resolusi) *</label>
              <select
                value={formData.priority}
                onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium"
              >
                <option value="Minor">Minor (3 Hari Kerja)</option>
                <option value="Major">Major (7 Hari Kerja)</option>
                <option value="Critical">Critical (14 Hari Kerja)</option>
              </select>
              {formData.priority === 'Critical' && (
                <p className="mt-1 text-[10px] text-rose-700 font-medium">
                  *Khusus kasus pelecehan, kekerasan, atau keselamatan kerja, penanganan awal dilakukan segera dalam 72 jam.
                </p>
              )}
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">PIC Departemen Bertanggung Jawab</label>
              <input
                type="text"
                value={formData.assignedPic}
                onChange={(e) => setFormData({ ...formData, assignedPic: e.target.value })}
                placeholder="Nama PIC Departemen"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-medium"
              />
            </div>
          </div>

          {/* Incident Date & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tanggal Kejadian</label>
              <input
                type="date"
                value={formData.incidentDate}
                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Lokasi Kejadian</label>
              <input
                type="text"
                placeholder="Misal: Line 3 Sewing"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Pihak Terkait</label>
              <input
                type="text"
                placeholder="Misal: Supervisor, saksi"
                value={formData.involvedParties}
                onChange={(e) => setFormData({ ...formData, involvedParties: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Uraian / Narasi Keluhan *</label>
            <textarea
              required
              rows={4}
              placeholder="Masukkan rincian keluhan karyawan secara objektif dan lengkap..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsNewCaseModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Mendaftarkan...' : 'Daftarkan Keluhan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
