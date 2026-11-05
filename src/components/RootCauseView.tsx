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
  ChevronDown,
  Search,
  Eye,
  User,
  Wrench,
  Cog,
  Box,
  Scale,
  Compass,
  Check
} from 'lucide-react';
import { GrievanceCase, RootCauseAnalysis, Rca6MCategory } from '../types';
import { getCaseRootCauses, saveCaseRootCause } from '../services/db';
import { generateAiRootCause } from '../services/ai';

interface RootCauseViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

const CATEGORIES_6M: { id: Rca6MCategory; label: string; desc: string; icon: any }[] = [
  { id: 'Man', label: 'Man (Manusia)', desc: 'Kompetensi, beban kerja, kepemimpinan, komunikasi, perilaku', icon: User },
  { id: 'Method', label: 'Method (Metode)', desc: 'SOP, prosedur kerja, alur koordinasi, instruksi kerja', icon: Wrench },
  { id: 'Machine', label: 'Machine (Mesin/Alat)', desc: 'Peralatan, sistem absensi, sarana kerja, fasilitas fisik', icon: Cog },
  { id: 'Material', label: 'Material (Bahan)', desc: 'APD, seragam, formulir, data masukan, kelengkapan berkas', icon: Box },
  { id: 'Measurement', label: 'Measurement (Pengukuran)', desc: 'KPI, target kerja, standar evaluasi penilaian, cuti/lembur', icon: Scale },
  { id: 'Environment', label: 'Environment (Lingkungan)', desc: 'Suhu, kebisingan, ergonomi, budaya kerja, iklim organisasi', icon: Compass },
];

export const RootCauseView: React.FC<RootCauseViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  // Selected Case
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [searchFilter, setSearchFilter] = useState('');
  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || null;

  // Selected 6M Category
  const [activeCategory, setActiveCategory] = useState<Rca6MCategory>('Man');

  // Loaded RCA items for current case
  const [rcaList, setRcaList] = useState<RootCauseAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // 4 Fields for active category
  const [form, setForm] = useState({
    rootCause: '',
    contributingFactors: '',
    impact: '',
    correctiveRecommendations: '',
  });

  // Load existing 6M RCA when active case changes
  useEffect(() => {
    if (!activeCase) return;
    setIsLoading(true);
    setSaveSuccessNotice(null);

    getCaseRootCauses(activeCase.id).then((items) => {
      setRcaList(items);
      const match = items.find((item) => item.category === activeCategory);
      if (match) {
        setForm({
          rootCause: match.rootCause || '',
          contributingFactors: match.contributingFactors || '',
          impact: match.impact || '',
          correctiveRecommendations: match.correctiveRecommendations || '',
        });
      } else {
        setForm({
          rootCause: '',
          contributingFactors: '',
          impact: '',
          correctiveRecommendations: '',
        });
      }
      setIsLoading(false);
    });
  }, [activeCase?.id]);

  // Update form fields when active category tab changes
  useEffect(() => {
    const match = rcaList.find((item) => item.category === activeCategory);
    if (match) {
      setForm({
        rootCause: match.rootCause || '',
        contributingFactors: match.contributingFactors || '',
        impact: match.impact || '',
        correctiveRecommendations: match.correctiveRecommendations || '',
      });
    } else {
      setForm({
        rootCause: '',
        contributingFactors: '',
        impact: '',
        correctiveRecommendations: '',
      });
    }
  }, [activeCategory, rcaList]);

  const handleSaveCategoryRca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !currentUser) return;
    setIsSaving(true);
    try {
      const saved = await saveCaseRootCause(
        activeCase.id,
        {
          caseId: activeCase.id,
          ticketId: activeCase.ticketId,
          category: activeCategory,
          rootCause: form.rootCause,
          contributingFactors: form.contributingFactors,
          impact: form.impact,
          correctiveRecommendations: form.correctiveRecommendations,
          analystId: currentUser.id,
          analystName: currentUser.displayName,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );

      setRcaList((prev) => {
        const filtered = prev.filter((item) => item.category !== activeCategory);
        return [...filtered, saved];
      });

      setSaveSuccessNotice(`Analisis 6M (${activeCategory}) berhasil disimpan ke Firestore.`);
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Error saving RCA:', err);
      setSaveSuccessNotice('Gagal menyimpan RCA: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!activeCase) return;
    setIsGeneratingAi(true);
    try {
      const result = await generateAiRootCause(activeCase, activeCategory);

      setForm((prev) => ({
        ...prev,
        rootCause: result.rootCause || prev.rootCause,
        contributingFactors: result.contributingFactors || prev.contributingFactors,
        impact: result.impact || prev.impact,
        correctiveRecommendations: result.correctiveRecommendations || prev.correctiveRecommendations,
      }));
    } catch (err) {
      console.warn('AI RCA suggestion error:', err);
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
      c.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Root Cause Analysis (6M Ishikawa Framework)</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Ishikawa 6M
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Analisis akar penyebab terstruktur: Man, Method, Machine, Material, Measurement, Environment terhubung dengan Ticket ID.
          </p>
        </div>

        {activeCase && (
          <button
            onClick={() => onOpenCase(activeCase, 'root_cause')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs border border-blue-200 transition"
          >
            <Eye className="w-4 h-4" />
            <span>Buka Detail Kasus #{activeCase.ticketId}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Case Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Pilih Ticket ID</h3>
              <span className="text-xs text-slate-500">{filteredCases.length} Kasus</span>
            </div>

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

            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredCases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                        {c.ticketId}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {c.department}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-slate-900 truncate">
                      {c.complaintCategory}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span className="truncate max-w-[140px]">{c.assignedPic || 'No PIC'}</span>
                      <span className="font-semibold text-slate-600">{c.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: 6M Tabs & Form */}
        <div className="lg:col-span-8 space-y-4">
          {!activeCase ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Pilih kasus untuk melihat atau menyusun analisis 6M.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Selected Case Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-sm font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded border border-indigo-200">
                    {activeCase.ticketId}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{activeCase.complaintCategory}</h3>
                    <p className="text-xs text-slate-500">
                      Departemen: <strong>{activeCase.department}</strong> • PIC: <strong>{activeCase.assignedPic || 'Unassigned'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Kategori Terisi:</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {rcaList.length} / 6 Dimensi
                  </span>
                </div>
              </div>

              {saveSuccessNotice && (
                <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-medium flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
                  <span>{saveSuccessNotice}</span>
                </div>
              )}

              {/* 6M Category Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5">
                {CATEGORIES_6M.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  const hasData = rcaList.some((item) => item.category === cat.id && item.rootCause?.trim());

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-semibold transition relative ${
                        isActive
                          ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                      }`}
                    >
                      {hasData && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                      <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="text-[11px] font-bold">{cat.id}</span>
                      <span className="text-[9px] text-slate-400 font-normal truncate max-w-full">
                        {cat.label.split(' ')[1]?.replace(/[()]/g, '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 4 Fields Form */}
              <form onSubmit={handleSaveCategoryRca} className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                      <span>Dimensi: {CATEGORIES_6M.find((c) => c.id === activeCategory)?.label}</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      {CATEGORIES_6M.find((c) => c.id === activeCategory)?.desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingAi ? 'Menganalisis...' : `Saran AI (${activeCategory})`}</span>
                  </button>
                </div>

                {/* 1. Root Cause */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Root Cause (Akar Masalah Utama) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.rootCause}
                    onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
                    required
                    placeholder={`Akar masalah mendasar dari dimensi ${activeCategory}...`}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 2. Contributing Factors */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Contributing Factors (Faktor-Faktor Pemicu / Pendukung)
                  </label>
                  <textarea
                    rows={3}
                    value={form.contributingFactors}
                    onChange={(e) => setForm({ ...form, contributingFactors: e.target.value })}
                    placeholder="Faktor lingkungan kerja, tekanan target, kelalaian supervisi, atau ketiadaan panduan..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 3. Impact */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Impact (Dampak terhadap Karyawan / Operasional Pabrik) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.impact}
                    onChange={(e) => setForm({ ...form, impact: e.target.value })}
                    required
                    placeholder="Dampak moral kerja, penurunan produktivitas lini produksi, risiko ketidakpatuhan regulasi..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 4. Corrective Recommendations */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Corrective Recommendations (Rekomendasi Tindakan Korektif &amp; Preventif) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.correctiveRecommendations}
                    onChange={(e) => setForm({ ...form, correctiveRecommendations: e.target.value })}
                    required
                    placeholder="Langkah nyata perbaikan yang wajib diadopsi dalam rencana aksi (CAPA)..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Footer Save */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Analis: <strong className="text-slate-700">{currentUser?.displayName}</strong>
                  </span>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : `Simpan Dimensi ${activeCategory}`}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
