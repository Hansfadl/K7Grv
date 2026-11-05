import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Clock,
  ArrowRight,
  Shield,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  RotateCcw,
  Calendar,
  Lock,
  Plus,
  Eye
} from 'lucide-react';
import { GrievanceCase, InvestigationRecord } from '../types';
import { getCaseInvestigations, saveCaseInvestigation } from '../services/db';
import { generateAiInvestigationSummary } from '../services/ai';

interface InvestigationViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({ onOpenCase }) => {
  const { cases, handleUpdateCase } = useCases();
  const { currentUser, canInvestigate } = useAuth();

  // Selected case state
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [searchFilter, setSearchFilter] = useState('');
  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || null;

  // Investigation records
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // 9 Field Investigation Form State
  const [form, setForm] = useState({
    investigationDate: new Date().toISOString().substring(0, 10),
    investigationDetails: '',
    interviewNotes: '',
    witnessInfo: '',
    supportingInfo: '',
    evidenceRef: '',
    findings: '',
    conclusion: '',
    recommendedActions: '',
  });

  // AI Generation State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Load investigations for the active case
  useEffect(() => {
    if (!activeCase) return;
    setIsLoading(true);
    setSaveNotice(null);

    getCaseInvestigations(activeCase.id).then((records) => {
      setInvestigations(records);
      if (records.length > 0) {
        const latest = records[0];
        setForm({
          investigationDate: latest.investigationDate || new Date().toISOString().substring(0, 10),
          investigationDetails: latest.investigationDetails || '',
          interviewNotes: latest.interviewNotes || '',
          witnessInfo: latest.witnessInfo || '',
          supportingInfo: latest.supportingInfo || '',
          evidenceRef: latest.evidenceRef || '',
          findings: latest.findings || '',
          conclusion: latest.conclusion || '',
          recommendedActions: latest.recommendedActions || '',
        });
      } else {
        // Reset form for fresh entry
        setForm({
          investigationDate: new Date().toISOString().substring(0, 10),
          investigationDetails: `Pemeriksaan keluhan terkait: ${activeCase.complaintCategory} - ${activeCase.department}`,
          interviewNotes: '',
          witnessInfo: '',
          supportingInfo: '',
          evidenceRef: '',
          findings: '',
          conclusion: '',
          recommendedActions: '',
        });
      }
      setIsLoading(false);
    });
  }, [activeCase?.id]);

  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !currentUser) return;
    setIsSaving(true);
    setSaveNotice(null);

    try {
      const saved = await saveCaseInvestigation(
        activeCase.id,
        {
          caseId: activeCase.id,
          ticketId: activeCase.ticketId,
          investigationDate: form.investigationDate,
          investigationDetails: form.investigationDetails,
          interviewNotes: form.interviewNotes,
          witnessInfo: form.witnessInfo,
          supportingInfo: form.supportingInfo,
          evidenceRef: form.evidenceRef,
          findings: form.findings,
          conclusion: form.conclusion,
          recommendedActions: form.recommendedActions,
          investigatorName: currentUser.displayName,
          investigatorId: currentUser.id,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );

      setInvestigations((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSaveNotice('Data investigasi berhasil disimpan permanen ke Firestore.');

      // If case is still Open, automatically advance to Investigation stage
      if (activeCase.status === 'Open') {
        await handleUpdateCase(
          activeCase.id,
          { status: 'Investigation', progress: 45 },
          'Pemeriksaan investigasi dimulai.'
        );
      }

      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: any) {
      console.error('Error saving investigation:', err);
      setSaveNotice('Gagal menyimpan investigasi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSynthesize = async () => {
    if (!activeCase) return;
    setIsGeneratingAi(true);
    try {
      const result = await generateAiInvestigationSummary(activeCase, {
        interviewNotes: form.interviewNotes,
        witnessInfo: form.witnessInfo,
        investigationDetails: form.investigationDetails,
      });

      setForm((prev) => ({
        ...prev,
        findings: prev.findings ? `${prev.findings}\n\n[Analisis AI]\n${result}` : result,
        conclusion: prev.conclusion || `Berdasarkan fakta dan keterangan yang diverifikasi, kasus #${activeCase.ticketId} memerlukan tindak lanjut perbaikan departemen.`,
        recommendedActions: prev.recommendedActions || 'Penerbitan CAPA terukur dan audit kepatuhan berkala bersama PIC Departemen.',
      }));
    } catch (err) {
      console.warn('AI Investigation error:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.ticketId.toLowerCase().includes(q) ||
      c.complaintCategory.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      c.employeeName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Investigation Module</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              Terhubung Ticket ID
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
              9 Field Standar HR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan investigasi terstruktur: keterangan saksi, pemeriksaan bukti, temuan faktual, dan kesimpulan (tanpa signature).
          </p>
        </div>

        {activeCase && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenCase(activeCase, 'investigation')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs border border-blue-200 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Buka Detail Kasus #{activeCase.ticketId}</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Case Selector by Ticket ID */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Pilih Kasus (Ticket ID)</h3>
              <span className="text-xs text-slate-500">{filteredCases.length} Kasus</span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari Ticket ID, kategori..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cases List */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredCases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                        {c.ticketId}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'Open'
                            ? 'bg-rose-100 text-rose-800'
                            : c.status === 'Investigation'
                            ? 'bg-amber-100 text-amber-800'
                            : c.status === 'Action Taken'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-slate-900 truncate">
                      {c.complaintCategory}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>{c.department}</span>
                      <span>Tgl: {c.dateReceived}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: 9-Field Investigation Form */}
        <div className="lg:col-span-8 space-y-4">
          {!activeCase ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Pilih kasus untuk melihat atau mengisi data investigasi.
            </div>
          ) : (
            <form onSubmit={handleSaveInvestigation} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header Info of Selected Case */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="font-mono text-sm font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded border border-blue-200">
                    {activeCase.ticketId}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{activeCase.complaintCategory}</h3>
                    <p className="text-xs text-slate-500">
                      Dept: <strong>{activeCase.department}</strong> • Pelapor:{' '}
                      <strong>{activeCase.isAnonymous ? activeCase.anonymousAlias || 'Protected' : activeCase.employeeName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Status Saat Ini:</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {activeCase.status}
                  </span>
                </div>
              </div>

              {saveNotice && (
                <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{saveNotice}</span>
                  </span>
                </div>
              )}

              {/* Form 9 Fields */}
              <div className="p-5 space-y-5">
                {/* Notice: No signature & Internal Investigator */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Kerahasiaan &amp; Kebijakan Audit Internal SJI</p>
                    <p className="text-amber-800 text-[11px]">
                      Identitas pemeriksa ({currentUser?.displayName}) tersimpan secara internal untuk tata kelola kasus dan tidak akan ditampilkan pada laporan cetak/publik. Bagian tanda tangan resmi telah dihilangkan sesuai ketentuan.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Field 1: Investigation Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Investigation Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.investigationDate}
                      onChange={(e) => setForm({ ...form, investigationDate: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Field 6: Evidence Reference */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      6. Evidence Reference (Bukti Terkait)
                    </label>
                    <input
                      type="text"
                      value={form.evidenceRef}
                      onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })}
                      placeholder="Contoh: Lampiran Foto CCTV 14:20, Rekap Absensi, Memo 03/HR/2026"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Field 2: Investigation Details */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Investigation Details (Rincian Investigasi) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.investigationDetails}
                    onChange={(e) => setForm({ ...form, investigationDetails: e.target.value })}
                    required
                    placeholder="Jelaskan ruang lingkup, lokasi pemeriksaan, dan latar belakang pemeriksaan kasus..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Field 3: Interview Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        3. Interview Notes (Catatan Wawancara)
                      </label>
                      <button
                        type="button"
                        onClick={handleAiSynthesize}
                        disabled={isGeneratingAi}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{isGeneratingAi ? 'Menganalisis...' : 'Sintesis AI'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={form.interviewNotes}
                      onChange={(e) => setForm({ ...form, interviewNotes: e.target.value })}
                      placeholder="Transkrip tanya jawab dengan pihak terkait dan saksi lapangan..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Field 4: Witness Information */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      4. Witness Information (Informasi Saksi)
                    </label>
                    <textarea
                      rows={4}
                      value={form.witnessInfo}
                      onChange={(e) => setForm({ ...form, witnessInfo: e.target.value })}
                      placeholder="Nama / inisial saksi, bagian kerja, posisi saat kejadian, hubungan dengan terlapor..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Field 5: Supporting Information */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    5. Supporting Information (Informasi Pendukung / Riwayat Terkait)
                  </label>
                  <textarea
                    rows={2}
                    value={form.supportingInfo}
                    onChange={(e) => setForm({ ...form, supportingInfo: e.target.value })}
                    placeholder="SOP operasional terkait, catatan disiplin sebelumnya, kondisi lingkungan kerja..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Field 7: Findings */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    7. Findings (Temuan Pemeriksaan) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.findings}
                    onChange={(e) => setForm({ ...form, findings: e.target.value })}
                    required
                    placeholder="Fakta-fakta konkret yang berhasil diverifikasi dan terbukti dari proses investigasi..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Field 8: Investigation Conclusion */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    8. Investigation Conclusion (Kesimpulan Investigasi) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.conclusion}
                    onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
                    required
                    placeholder="Pernyataan kesimpulan apakah terdapat pelanggaran norma kerja, SOP, atau murni kesalahpahaman..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* Field 9: Recommended Actions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    9. Recommended Actions (Rekomendasi Tindakan / Arahan CAPA) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.recommendedActions}
                    onChange={(e) => setForm({ ...form, recommendedActions: e.target.value })}
                    required
                    placeholder="Tindakan korektif yang wajib dijalankan oleh Department PIC dan tim HR..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Form Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Pemeriksa: <strong className="text-slate-700">{currentUser?.displayName}</strong> (Internal HR)
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Data Investigasi'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
