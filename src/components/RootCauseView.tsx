import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  GitFork,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  HelpCircle,
  RotateCcw,
  Layers,
  ChevronDown
} from 'lucide-react';
import { GrievanceCase, RootCauseAnalysis } from '../types';
import { getCaseRootCause, saveCaseRootCause } from '../services/db';
import { generateAiRootCause } from '../services/ai';

interface RootCauseViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const RootCauseView: React.FC<RootCauseViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  // Active case for editing Lembar 5W
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || null;

  // Lembar 5W form state
  const [rcaForm, setRcaForm] = useState({
    primaryCategory: 'Management & Leadership' as RootCauseAnalysis['primaryCategory'],
    why1: '',
    why2: '',
    why3: '',
    why4: '',
    why5: '',
    systemicFactors: '',
    preventiveRecommendations: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Load existing 5 Whys when active case changes
  useEffect(() => {
    if (!activeCase) return;
    setIsLoading(true);
    setSaveSuccessNotice(null);

    getCaseRootCause(activeCase.id).then((rca) => {
      if (rca) {
        setRcaForm({
          primaryCategory: rca.primaryCategory || 'Management & Leadership',
          why1: rca.why1 || '',
          why2: rca.why2 || '',
          why3: rca.why3 || '',
          why4: rca.why4 || '',
          why5: rca.why5 || '',
          systemicFactors: rca.systemicFactors || '',
          preventiveRecommendations: rca.preventiveRecommendations || '',
        });
      } else {
        setRcaForm({
          primaryCategory: 'Management & Leadership',
          why1: '',
          why2: '',
          why3: '',
          why4: '',
          why5: '',
          systemicFactors: '',
          preventiveRecommendations: '',
        });
      }
      setIsLoading(false);
    });
  }, [activeCase?.id]);

  const handleSaveRca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !currentUser) return;
    setIsSaving(true);
    try {
      await saveCaseRootCause(
        activeCase.id,
        {
          ...rcaForm,
          caseId: activeCase.id,
          analystId: currentUser.id,
          analystName: currentUser.displayName,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );
      setSaveSuccessNotice('Lembar 5W berhasil disimpan dan disinkronkan ke audit trail.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      alert('Gagal menyimpan Lembar 5W: ' + (err.message || 'Koneksi error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!activeCase) return;
    setIsGeneratingAi(true);
    try {
      const suggestion = await generateAiRootCause(activeCase);
      setRcaForm((prev) => ({
        ...prev,
        primaryCategory: suggestion.primaryCategory || prev.primaryCategory,
        why1: suggestion.why1 || prev.why1,
        why2: suggestion.why2 || prev.why2,
        why3: suggestion.why3 || prev.why3,
        why4: suggestion.why4 || prev.why4,
        why5: suggestion.why5 || prev.why5,
        systemicFactors: suggestion.systemicFactors || prev.systemicFactors,
        preventiveRecommendations: suggestion.preventiveRecommendations || prev.preventiveRecommendations,
      }));
      setSaveSuccessNotice('Sugesti Lembar 5W berhasil dihasilkan oleh AI. Silakan tinjau dan simpan.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      alert('Gagal menghasilkan AI root cause: ' + err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Lembar 5W &amp; Analisis Akar Masalah (Root Cause)</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Ishikawa &amp; 5 Whys
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Formulir investigasi sistemik untuk mengidentifikasi penyebab mendasar ketidaksesuaian kerja di PT Shoenary Javanesia Inc.
          </p>
        </div>

        {/* Case Selector Dropdown */}
        {cases.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Pilih Kasus:</span>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs max-w-xs"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ticketId} • {c.complaintCategory} ({c.department})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Belum ada keluhan yang terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">Silakan daftarkan keluhan baru terlebih dahulu di menu Case Management.</p>
        </div>
      ) : activeCase ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Active Case Overview */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {activeCase.ticketId}
                </span>
                <span className="text-xs font-semibold text-slate-600 px-2 py-0.5 bg-slate-100 rounded">
                  {activeCase.department}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">{activeCase.complaintCategory}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pelapor: {activeCase.isAnonymous ? 'Anonim (Terlindungi)' : activeCase.employeeName}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeCase.description}
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prioritas</span>
                  <strong className="text-slate-800">{activeCase.priority}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status Siklus</span>
                  <strong className="text-slate-800">{activeCase.status}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">PIC Terkait</span>
                  <span className="text-slate-800">{activeCase.assignedPic || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tgl Masuk</span>
                  <span className="text-slate-800">{activeCase.dateReceived}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenCase(activeCase, 'root_cause')}
                className="w-full mt-2 inline-flex items-center justify-center space-x-1 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <span>Buka Detail Workspace Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Case List Switcher */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Daftar Kasus Lainnya</h4>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition flex items-center justify-between ${
                      c.id === activeCase.id
                        ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{c.ticketId} • {c.complaintCategory}</span>
                    <span className="text-[10px] text-slate-400 ml-1">{c.department}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Lembar 5W Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSaveRca} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <GitFork className="w-4 h-4 text-blue-600" />
                    <span>Lembar Kerja 5 Whys (Penyelidikan Akar Masalah)</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Tiket: <strong className="text-blue-700">{activeCase.ticketId}</strong> ({activeCase.complaintCategory})
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isGeneratingAi ? 'Menganalisis...' : 'Bantu dengan AI (Sugesti 5W)'}</span>
                  </button>
                </div>
              </div>

              {saveSuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{saveSuccessNotice}</span>
                </div>
              )}

              {/* Primary Category Domain */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Kategori Utama Ishikawa (Domain Masalah) *
                </label>
                <select
                  value={rcaForm.primaryCategory}
                  onChange={(e) => setRcaForm({ ...rcaForm, primaryCategory: e.target.value as any })}
                  className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Management & Leadership">Management &amp; Leadership (Kepemimpinan / Koordinasi)</option>
                  <option value="Process">Process (Standar Operasional / Prosedur Alur Kerja)</option>
                  <option value="Policy">Policy (Kebijakan Perusahaan / Peraturan)</option>
                  <option value="People">People (Kompetensi / Pelatihan Karyawan)</option>
                  <option value="Work Environment">Work Environment (Lingkungan Kerja &amp; Keselamatan)</option>
                  <option value="Equipment / System">Equipment / System (Peralatan Kerja / Sistem IT)</option>
                </select>
              </div>

              {/* 5 Whys Sequential Chain */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900 border-b border-slate-200 pb-1.5">
                  <span>Rantai Interogasi 5 Whys (Mengapa Hal Ini Terjadi?)</span>
                  <span className="text-[11px] text-slate-500 font-normal">Tingkat 1 s/d Tingkat 5</span>
                </div>

                {[1, 2, 3, 4, 5].map((num) => {
                  const key = `why${num}` as keyof typeof rcaForm;
                  return (
                    <div key={num} className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {num}
                        </span>
                        <label className="text-xs font-semibold text-slate-800">
                          Why #{num}: {num === 5 ? '(Akar Masalah Utama / Root Cause)' : ''}
                        </label>
                      </div>
                      <input
                        type="text"
                        value={rcaForm[key]}
                        onChange={(e) => setRcaForm({ ...rcaForm, [key]: e.target.value })}
                        placeholder={`Mengapa kejadian pada tingkat ${num} ini bisa terjadi?`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Systemic Factors & Preventive Recommendations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Faktor Sistemik yang Ditemukan (Systemic Drivers)
                  </label>
                  <textarea
                    rows={3}
                    value={rcaForm.systemicFactors}
                    onChange={(e) => setRcaForm({ ...rcaForm, systemicFactors: e.target.value })}
                    placeholder="Contoh: Kurangnya pengawasan berkala lini, belum ada checklist harian, atau bias subjektif atasan..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Rekomendasi Tindakan Pencegahan (Preventive Recommendations)
                  </label>
                  <textarea
                    rows={3}
                    value={rcaForm.preventiveRecommendations}
                    onChange={(e) => setRcaForm({ ...rcaForm, preventiveRecommendations: e.target.value })}
                    placeholder="Contoh: Refreshment training supervisor, revisi SOP pembagian lembur, audit berkala HR..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Data 5W akan tersimpan dan tersinkronisasi ke laporan audit investigasi.
                </span>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Lembar 5W'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
