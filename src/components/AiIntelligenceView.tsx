import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  GrievanceCase,
  InvestigationRecord,
  RootCauseAnalysis,
  MasterCategory,
  MasterDepartment,
  AiAnalysisRecord,
  AiAnalysisType,
  AiGrievanceAnalysis,
  AiRootCauseResult,
  AiRepeatGrievanceResult,
  AiRiskAssessmentResult,
  AiRecommendedCapaResult,
  AiManagementInsightsResult,
  AiManagementInsightType,
  AiReviewStatus,
} from '../types';
import {
  getCategories,
  getDepartments,
  getCaseInvestigations,
  getCaseRootCauses,
  saveCaseRootCause,
  addCaseActionPlan,
  getCaseAiAnalyses,
  saveCaseAiAnalysis,
  updateCaseAiAnalysisReview,
  getGlobalAiInsights,
  saveGlobalAiInsight,
  updateGlobalAiInsightReview,
} from '../services/db';
import {
  computeActualManagementMetrics,
  runAiGrievanceAnalysis,
  runAiRootCauseAnalysis,
  runAiRepeatDetection,
  runAiRiskAssessment,
  runAiRecommendCapa,
  runAiManagementInsights,
} from '../services/aiIntelligence';
import {
  Sparkles,
  Brain,
  GitFork,
  Repeat,
  ShieldAlert,
  CheckSquare,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  AlertTriangle,
  Info,
  History,
  ArrowRight,
  ExternalLink,
  Layers,
  Send,
  FileCheck2,
  Search,
} from 'lucide-react';

interface AiIntelligenceViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

type AiTab =
  | 'grievance_analysis'
  | 'root_cause'
  | 'repeat_detection'
  | 'risk_assessment'
  | 'recommended_capa'
  | 'management_insights';

const TAB_CONFIG: { id: AiTab; label: string; shortLabel: string; icon: any; scope: 'case' | 'global' }[] = [
  { id: 'grievance_analysis', label: 'Analisis Keluhan', shortLabel: 'Analisis', icon: Brain, scope: 'case' },
  { id: 'root_cause', label: 'Root Cause (5 Why & 6M)', shortLabel: 'RCA 5Why/6M', icon: GitFork, scope: 'case' },
  { id: 'repeat_detection', label: 'Deteksi Keluhan Berulang', shortLabel: 'Pola Berulang', icon: Repeat, scope: 'global' },
  { id: 'risk_assessment', label: 'Early Warning Risiko', shortLabel: 'Early Warning', icon: ShieldAlert, scope: 'global' },
  { id: 'recommended_capa', label: 'Draft Action Plan (CAPA)', shortLabel: 'Draft CAPA', icon: CheckSquare, scope: 'case' },
  { id: 'management_insights', label: 'Management Insights', shortLabel: 'Insights', icon: BarChart3, scope: 'global' },
];

export const AiIntelligenceView: React.FC<AiIntelligenceViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser, canApprove, canInvestigate, isPic } = useAuth();

  const canRunAi = canApprove || canInvestigate;
  const [activeTab, setActiveTab] = useState<AiTab>('grievance_analysis');

  // Case selector for case-scoped analyses
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [caseSearch, setCaseSearch] = useState('');

  const filteredSelectableCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.ticketId.toLowerCase().includes(q) ||
        c.complaintCategory.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q)
    );
  }, [cases, caseSearch]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || cases[0] || null,
    [cases, selectedCaseId]
  );

  // Master data & contextual records
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [caseInvestigations, setCaseInvestigations] = useState<InvestigationRecord[]>([]);
  const [caseRcas, setCaseRcas] = useState<RootCauseAnalysis[]>([]);
  const [allRcaMap, setAllRcaMap] = useState<Record<string, RootCauseAnalysis[]>>({});

  // Persisted AI histories
  const [caseHistory, setCaseHistory] = useState<AiAnalysisRecord[]>([]);
  const [globalHistory, setGlobalHistory] = useState<AiAnalysisRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Filters for Global Tabs
  const [repeatPeriodFilter, setRepeatPeriodFilter] = useState<'all' | '30d' | '90d' | 'ytd'>('all');
  const [insightType, setInsightType] = useState<AiManagementInsightType>('monthly');
  const [insightDept, setInsightDept] = useState<string>('all');

  // UI states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [reviewNotesDraft, setReviewNotesDraft] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Load master data & global AI insights
  useEffect(() => {
    if (isPic) return;
    Promise.all([getCategories(), getDepartments(), getGlobalAiInsights()]).then(
      ([cats, depts, globals]) => {
        setCategories(cats);
        setDepartments(depts);
        setGlobalHistory(globals);
      }
    );
  }, [isPic]);

  // Load RCA map across all cases for Management Insights grounding
  useEffect(() => {
    if (isPic || activeTab !== 'management_insights' || cases.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        cases.slice(0, 60).map(async (c) => {
          const rcas = await getCaseRootCauses(c.id);
          return [c.id, rcas] as const;
        })
      );
      if (!cancelled) {
        const map: Record<string, RootCauseAnalysis[]> = {};
        entries.forEach(([id, list]) => {
          map[id] = list;
        });
        setAllRcaMap(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPic, activeTab, cases]);

  // Load case-specific context & AI history when activeCase changes
  const refreshCaseContext = useCallback(async () => {
    if (!activeCase || isPic) return;
    setIsLoadingHistory(true);
    try {
      const [invs, rcas, analyses] = await Promise.all([
        getCaseInvestigations(activeCase.id),
        getCaseRootCauses(activeCase.id),
        getCaseAiAnalyses(activeCase.id),
      ]);
      setCaseInvestigations(invs);
      setCaseRcas(rcas);
      setCaseHistory(analyses);
    } catch (err: any) {
      setErrorBanner(`Gagal memuat riwayat AI kasus: ${err.message}`);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeCase, isPic]);

  useEffect(() => {
    refreshCaseContext();
  }, [refreshCaseContext]);

  const refreshGlobalHistory = useCallback(async () => {
    if (isPic) return;
    const globals = await getGlobalAiInsights();
    setGlobalHistory(globals);
  }, [isPic]);

  // Select latest matching record whenever tab or histories change
  const matchingTabHistory = useMemo(() => {
    const scope = TAB_CONFIG.find((t) => t.id === activeTab)?.scope || 'case';
    const source = scope === 'case' ? caseHistory : globalHistory;
    return source.filter((item) => item.analysisType === activeTab);
  }, [activeTab, caseHistory, globalHistory]);

  const displayedRecord = useMemo(() => {
    if (matchingTabHistory.length === 0) return null;
    if (selectedRecordId) {
      const found = matchingTabHistory.find((r) => r.id === selectedRecordId);
      if (found) return found;
    }
    return matchingTabHistory[0];
  }, [matchingTabHistory, selectedRecordId]);

  useEffect(() => {
    setSelectedRecordId(null);
    setReviewNotesDraft('');
    setErrorBanner(null);
    setSuccessBanner(null);
  }, [activeTab, selectedCaseId]);

  // Deterministic live preview metrics for Management Insights
  const liveManagementMetrics = useMemo(() => {
    return computeActualManagementMetrics(cases, allRcaMap, insightType, insightDept);
  }, [cases, allRcaMap, insightType, insightDept]);

  // Scoped cases for Repeat Detection
  const repeatScopedCases = useMemo(() => {
    if (repeatPeriodFilter === 'all') return cases;
    const now = new Date();
    const cutoff = new Date(now);
    if (repeatPeriodFilter === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (repeatPeriodFilter === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (repeatPeriodFilter === 'ytd') cutoff.setMonth(0, 1);
    const cutoffIso = cutoff.toISOString().substring(0, 10);
    return cases.filter((c) => (c.dateReceived || '').substring(0, 10) >= cutoffIso);
  }, [cases, repeatPeriodFilter]);

  const repeatPeriodLabel = useMemo(() => {
    if (repeatPeriodFilter === '30d') return '30 Hari Terakhir';
    if (repeatPeriodFilter === '90d') return '90 Hari Terakhir';
    if (repeatPeriodFilter === 'ytd') return `Tahun Berjalan (${new Date().getFullYear()})`;
    return 'Seluruh Periode Tercatat';
  }, [repeatPeriodFilter]);

  // RBAC Block for Department PIC (Phase 8 Privacy & Whistleblower Protection)
  if (isPic) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-3xl mx-auto mt-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Akses Modul SJI AI Intelligence Dibatasi</h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Sesuai kebijakan tata kelola privasi dan perlindungan pelapor (Whistleblower Protection) PT Shoenary
              Javanesia Inc., modul <strong>SJI AI Intelligence</strong> hanya dapat diakses oleh personil HR berwenang
              (HR Administrator, HR Lead, dan HR Investigator).
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Rekomendasi tindakan perbaikan (CAPA) yang telah disetujui HR akan tetap muncul di modul{' '}
              <strong>Action Plan (CAPA)</strong> untuk departemen Anda.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Run / Regenerate AI Analysis handler
  const handleRunAnalysis = async () => {
    if (!currentUser || !canRunAi) return;
    setErrorBanner(null);
    setSuccessBanner(null);
    setIsGenerating(true);

    try {
      if (activeTab === 'grievance_analysis') {
        if (!activeCase) throw new Error('Pilih minimal satu kasus terlebih dahulu.');
        const { result, modelUsed } = await runAiGrievanceAnalysis(activeCase, categories, departments);
        const saved = await saveCaseAiAnalysis<AiGrievanceAnalysis>(
          activeCase.id,
          {
            caseId: activeCase.id,
            ticketId: activeCase.ticketId,
            analysisType: 'grievance_analysis',
            title: `Analisis Keluhan #${activeCase.ticketId}`,
            result,
            dataSources: [`Tiket #${activeCase.ticketId} (Tersamarkan PII)`, 'Master Kategori & Departemen SJI'],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshCaseContext();
        setSelectedRecordId(saved.id);
        setSuccessBanner(`Analisis keluhan #${activeCase.ticketId} berhasil dibuat (Status: Pending Review).`);
      } else if (activeTab === 'root_cause') {
        if (!activeCase) throw new Error('Pilih minimal satu kasus terlebih dahulu.');
        const { result, modelUsed } = await runAiRootCauseAnalysis(activeCase, caseInvestigations);
        const saved = await saveCaseAiAnalysis<AiRootCauseResult>(
          activeCase.id,
          {
            caseId: activeCase.id,
            ticketId: activeCase.ticketId,
            analysisType: 'root_cause',
            title: `Root Cause 5 Why & 6M #${activeCase.ticketId}`,
            result,
            dataSources: [
              `Tiket #${activeCase.ticketId}`,
              `${caseInvestigations.length} Catatan Investigasi (Tersamarkan PII)`,
            ],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshCaseContext();
        setSelectedRecordId(saved.id);
        setSuccessBanner(`Draft Root Cause Analysis (5 Why & 6M) untuk #${activeCase.ticketId} berhasil disusun.`);
      } else if (activeTab === 'recommended_capa') {
        if (!activeCase) throw new Error('Pilih minimal satu kasus terlebih dahulu.');
        const approvedAiRca = caseHistory.find(
          (r) => r.analysisType === 'root_cause' && r.reviewStatus === 'Approved'
        )?.result;
        const rcaContext = caseRcas.length > 0 ? caseRcas : approvedAiRca || null;
        const { result, modelUsed } = await runAiRecommendCapa(activeCase, rcaContext, caseInvestigations);
        const saved = await saveCaseAiAnalysis<AiRecommendedCapaResult>(
          activeCase.id,
          {
            caseId: activeCase.id,
            ticketId: activeCase.ticketId,
            analysisType: 'recommended_capa',
            title: `Draft CAPA #${activeCase.ticketId}`,
            result,
            dataSources: [
              `Tiket #${activeCase.ticketId}`,
              `${caseRcas.length} Record 6M RCA`,
              `${caseInvestigations.length} Catatan Investigasi`,
            ],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshCaseContext();
        setSelectedRecordId(saved.id);
        setSuccessBanner(`Draft Action Plan (CAPA) untuk #${activeCase.ticketId} siap ditinjau HR.`);
      } else if (activeTab === 'repeat_detection') {
        if (repeatScopedCases.length === 0) throw new Error('Tidak ada kasus pada periode yang dipilih.');
        const { result, modelUsed } = await runAiRepeatDetection(repeatScopedCases, repeatPeriodLabel);
        const saved = await saveGlobalAiInsight<AiRepeatGrievanceResult>(
          {
            analysisType: 'repeat_detection',
            title: `Deteksi Keluhan Berulang — ${repeatPeriodLabel}`,
            result,
            dataSources: [`${repeatScopedCases.length} Kasus Firestore (${repeatPeriodLabel}, Tersamarkan PII)`],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshGlobalHistory();
        setSelectedRecordId(saved.id);
        setSuccessBanner(`Pemindaian pola keluhan berulang selesai (${result.repeatClusterCount} klaster ditemukan).`);
      } else if (activeTab === 'risk_assessment') {
        const activeCases = cases.filter((c) => c.status !== 'Closed');
        const { result, modelUsed } = await runAiRiskAssessment(activeCases);
        const saved = await saveGlobalAiInsight<AiRiskAssessmentResult>(
          {
            analysisType: 'risk_assessment',
            title: `Early Warning Risiko (${activeCases.length} Kasus Aktif)`,
            result,
            dataSources: [`${activeCases.length} Kasus Aktif (Non-Closed, Tersamarkan PII)`],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshGlobalHistory();
        setSelectedRecordId(saved.id);
        setSuccessBanner('Pemindaian Early Warning Risiko berhasil diperbarui.');
      } else if (activeTab === 'management_insights') {
        const { result, modelUsed } = await runAiManagementInsights(insightType, liveManagementMetrics);
        const saved = await saveGlobalAiInsight<AiManagementInsightsResult>(
          {
            analysisType: 'management_insights',
            title: `Management Insight (${insightType.toUpperCase()}) — ${liveManagementMetrics.periodLabel}`,
            result,
            dataSources: [
              'Agregasi Real-Time Database Firestore',
              'Single Source of Truth SLA Engine (calculateSlaCompliance)',
              'Koleksi 6M Root Cause Analysis',
            ],
            dataLimitations: result.dataLimitations,
            modelUsed,
            reviewStatus: 'Pending Review',
          },
          currentUser
        );
        await refreshGlobalHistory();
        setSelectedRecordId(saved.id);
        setSuccessBanner(`Management Insights (${liveManagementMetrics.periodLabel}) berhasil disusun.`);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Gagal menjalankan analisis SJI AI Intelligence.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Review handler (Approve / Reject) - strictly for HR Lead / HR Admin
  const handleReviewDecision = async (record: AiAnalysisRecord, decision: AiReviewStatus) => {
    if (!currentUser || !canApprove) return;
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const scope = TAB_CONFIG.find((t) => t.id === record.analysisType)?.scope || 'case';
      if (scope === 'case' && record.caseId) {
        await updateCaseAiAnalysisReview(record.caseId, record.id, decision, currentUser, reviewNotesDraft);
        await refreshCaseContext();
      } else {
        await updateGlobalAiInsightReview(record.id, decision, currentUser, reviewNotesDraft);
        await refreshGlobalHistory();
      }
      setReviewNotesDraft('');
      setSuccessBanner(`Rekomendasi AI ditandai sebagai "${decision}" oleh ${currentUser.displayName}.`);
    } catch (err: any) {
      setErrorBanner(`Gagal memperbarui status review: ${err.message}`);
    }
  };

  // Apply Approved Root Cause to Official 6M RCA Module
  const handleApplyRootCause = async (record: AiAnalysisRecord<AiRootCauseResult>) => {
    if (!currentUser || !canApprove || !activeCase || record.reviewStatus !== 'Approved') return;
    setIsApplying(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const rca = record.result;
      await saveCaseRootCause(
        activeCase.id,
        {
          caseId: activeCase.id,
          ticketId: activeCase.ticketId,
          category: rca.recommendedPrimaryCategory || 'Method',
          rootCause: rca.fiveWhy?.rootCauseConclusion || 'Akar masalah terverifikasi HR',
          contributingFactors: rca.contributingFactors || '-',
          impact: rca.impact || '-',
          correctiveRecommendations: rca.correctiveRecommendations || '-',
          analystId: currentUser.id,
          analystName: currentUser.displayName,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );
      await updateCaseAiAnalysisReview(
        activeCase.id,
        record.id,
        'Approved',
        currentUser,
        record.reviewNotes || 'Diterapkan ke modul resmi 6M RCA.',
        true
      );
      await refreshCaseContext();
      setSuccessBanner(
        `Draft RCA (${rca.recommendedPrimaryCategory}) berhasil diterapkan ke modul Root Cause (6M) untuk tiket #${activeCase.ticketId}.`
      );
    } catch (err: any) {
      setErrorBanner(`Gagal menerapkan RCA ke modul resmi: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Apply Approved CAPA Drafts to Official Action Plan Module
  const handleApplyCapaDrafts = async (record: AiAnalysisRecord<AiRecommendedCapaResult>) => {
    if (!currentUser || !canApprove || !activeCase || record.reviewStatus !== 'Approved') return;
    setIsApplying(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const drafts = record.result?.drafts || [];
      if (drafts.length === 0) throw new Error('Tidak ada draft CAPA untuk diterapkan.');

      for (const draft of drafts) {
        await addCaseActionPlan(
          activeCase.id,
          {
            caseId: activeCase.id,
            ticketId: activeCase.ticketId,
            description: `[Corrective] ${draft.correctiveAction}\n[Preventive] ${draft.preventiveAction}`,
            responsiblePic: draft.recommendedPic || activeCase.assignedPic || 'PIC Departemen',
            targetDate: draft.suggestedTargetDate || activeCase.dueDate,
            actionTaken: `Target Outcome: ${draft.expectedOutcome}`,
            progressStatus: 'Progress',
            completionDate: null,
            notes: `Monitoring: ${draft.monitoringRecommendation} (Disetujui HR dari SJI AI Intelligence)`,
          },
          currentUser
        );
      }

      await updateCaseAiAnalysisReview(
        activeCase.id,
        record.id,
        'Approved',
        currentUser,
        record.reviewNotes || `${drafts.length} item draft diterapkan ke Action Plan (CAPA).`,
        true
      );
      await refreshCaseContext();
      setSuccessBanner(
        `${drafts.length} rencana perbaikan resmi telah ditambahkan ke Action Plan (CAPA) tiket #${activeCase.ticketId}.`
      );
    } catch (err: any) {
      setErrorBanner(`Gagal menerapkan CAPA ke modul resmi: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const activeScope = TAB_CONFIG.find((t) => t.id === activeTab)?.scope || 'case';

  const getReviewBadge = (status: AiReviewStatus) => {
    if (status === 'Approved') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved HR</span>
        </span>
      );
    }
    if (status === 'Rejected') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-800 border border-red-200">
          <XCircle className="w-3.5 h-3.5" />
          <span>Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3.5 h-3.5" />
        <span>Pending Review</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Corporate AI Intelligence Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">SJI AI Intelligence</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-200 border border-blue-700/60 rounded">
                  HR Decision Support System
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Sistem pendukung keputusan berbasis data aktual PT Shoenary Javanesia Inc. Seluruh output AI bersifat
                rekomendasi read-only (PII terlindungi) dan memerlukan konfirmasi HR sebelum mengubah alur kerja resmi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>PII Redacted &amp; Server-Side AI</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 flex items-center space-x-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Human-in-the-Loop Governance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-module Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banners */}
      {errorBanner && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-700 font-bold hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-800 font-bold hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Control Toolbar: Context Selection + Analyze Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          {activeScope === 'case' ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Cari Tiket Kasus
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    placeholder="Filter Ticket ID, kategori, atau departemen..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Pilih Kasus Target ({filteredSelectableCases.length})
                </label>
                <select
                  value={activeCase?.id || ''}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  {filteredSelectableCases.length === 0 ? (
                    <option value="">Tidak ada kasus ditemukan</option>
                  ) : (
                    filteredSelectableCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.ticketId} — {c.complaintCategory} ({c.department}) [{c.priority} • {c.status}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          ) : activeTab === 'repeat_detection' ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Rentang Periode Evaluasi Pola
                </label>
                <select
                  value={repeatPeriodFilter}
                  onChange={(e) => setRepeatPeriodFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="all">Seluruh Periode ({cases.length} Kasus)</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="90d">90 Hari Terakhir</option>
                  <option value="ytd">Tahun Berjalan</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  Cakupan Analisis: <strong className="font-mono tabular-nums">{repeatScopedCases.length}</strong> kasus
                  tercatat
                </div>
              </div>
            </div>
          ) : activeTab === 'risk_assessment' ? (
            <div className="flex-1 flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Memindai{' '}
                <strong className="font-mono tabular-nums">
                  {cases.filter((c) => c.status !== 'Closed').length}
                </strong>{' '}
                kasus aktif (status Open / Investigation / Action Taken) untuk sinyal eskalasi dini.
              </span>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tipe Management Insight
                </label>
                <select
                  value={insightType}
                  onChange={(e) => setInsightType(e.target.value as AiManagementInsightType)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="weekly">Weekly Insight (7 Hari Terakhir)</option>
                  <option value="monthly">Monthly Insight (Bulan Berjalan)</option>
                  <option value="departmental">Departmental Insight</option>
                  <option value="executive">Executive Summary (Kumulatif)</option>
                </select>
              </div>
              {insightType === 'departmental' ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Pilih Departemen
                  </label>
                  <select
                    value={insightDept}
                    onChange={(e) => setInsightDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="all">Seluruh Departemen</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-end">
                  <div className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    Periode: <strong>{liveManagementMetrics.periodLabel}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {activeScope === 'case' && activeCase && (
              <button
                type="button"
                onClick={() => onOpenCase(activeCase, 'overview')}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Tiket</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGenerating || !canRunAi || (activeScope === 'case' && !activeCase)}
              onClick={handleRunAnalysis}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center space-x-2 transition shadow-xs"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{displayedRecord ? 'Regenerate Analisis' : 'Analyze dengan AI'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected Case Quick Metadata Strip */}
        {activeScope === 'case' && activeCase && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-mono font-bold text-slate-900">#{activeCase.ticketId}</span>
            <span className="text-slate-300">|</span>
            <span>
              Dept: <strong className="text-slate-800">{activeCase.department}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Kategori: <strong className="text-slate-800">{activeCase.complaintCategory}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Prioritas Aktual: <strong className="text-slate-800">{activeCase.priority}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Status: <strong className="text-slate-800">{activeCase.status}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Investigasi: <strong className="font-mono">{caseInvestigations.length}</strong> catatan • RCA 6M:{' '}
              <strong className="font-mono">{caseRcas.length}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Live Deterministic Metrics Strip for Management Insights */}
      {activeTab === 'management_insights' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Keluhan
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {liveManagementMetrics.totalGrievance}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              SLA Compliance
            </span>
            <span className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-1 block">
              {liveManagementMetrics.slaComplianceRate}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {liveManagementMetrics.onTimeCount} On Time / {liveManagementMetrics.overdueCount} Overdue
            </span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Unresolved Aktif
            </span>
            <span className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
              {liveManagementMetrics.unresolvedCases}
            </span>
            <span className="text-[10px] text-red-600 font-semibold font-mono">
              {liveManagementMetrics.criticalActiveCount} Critical Aktif
            </span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Kasus Klaster Berulang
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {liveManagementMetrics.repeatGrievanceCount}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Kategori Dominan
            </span>
            <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
              {liveManagementMetrics.dominantCategory.name}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {liveManagementMetrics.dominantCategory.count} kasus ({liveManagementMetrics.dominantCategory.percentage}%)
            </span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Dept Tertinggi
            </span>
            <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
              {liveManagementMetrics.highestDepartment.name}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {liveManagementMetrics.highestDepartment.count} kasus (
              {liveManagementMetrics.highestDepartment.percentage}%)
            </span>
          </div>
        </div>
      )}

      {/* Main Content Grid: Result View + History Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left / Center Result Card */}
        <div className="xl:col-span-8 space-y-5">
          {isLoadingHistory && !displayedRecord ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              Memuat riwayat analisis dari Firestore...
            </div>
          ) : !displayedRecord ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Belum Ada Analisis Tersimpan pada Sub-Modul Ini
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Klik tombol <strong>Analyze dengan AI</strong> di kanan atas untuk menghasilkan rekomendasi berbasis data
                aktual. Semua hasil analisis akan tercatat beserta tanggal, sumber data, dan status review HR.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Record Governance Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{displayedRecord.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                    <span>{displayedRecord.createdAt}</span>
                    <span>•</span>
                    <span>Oleh: {displayedRecord.createdBy}</span>
                    <span>•</span>
                    <span>Engine: {displayedRecord.modelUsed}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getReviewBadge(displayedRecord.reviewStatus)}
                  {displayedRecord.appliedToModule && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      Diterapkan ke Modul Resmi
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Tab Body */}
              <div className="p-6 space-y-6">
                {/* PHASE 2: GRIEVANCE ANALYSIS */}
                {displayedRecord.analysisType === 'grievance_analysis' && (
                  <GrievanceAnalysisBody result={displayedRecord.result as AiGrievanceAnalysis} />
                )}

                {/* PHASE 3: ROOT CAUSE 5 WHY & 6M */}
                {displayedRecord.analysisType === 'root_cause' && (
                  <RootCauseBody
                    result={displayedRecord.result as AiRootCauseResult}
                    record={displayedRecord}
                    canApprove={canApprove}
                    isApplying={isApplying}
                    onApply={() => handleApplyRootCause(displayedRecord)}
                  />
                )}

                {/* PHASE 4: REPEAT GRIEVANCE DETECTION */}
                {displayedRecord.analysisType === 'repeat_detection' && (
                  <RepeatDetectionBody
                    result={displayedRecord.result as AiRepeatGrievanceResult}
                    cases={cases}
                    onOpenCase={onOpenCase}
                  />
                )}

                {/* PHASE 5: EARLY WARNING RISK */}
                {displayedRecord.analysisType === 'risk_assessment' && (
                  <RiskAssessmentBody
                    result={displayedRecord.result as AiRiskAssessmentResult}
                    cases={cases}
                    onOpenCase={onOpenCase}
                  />
                )}

                {/* PHASE 6: RECOMMENDED CAPA */}
                {displayedRecord.analysisType === 'recommended_capa' && (
                  <RecommendedCapaBody
                    result={displayedRecord.result as AiRecommendedCapaResult}
                    record={displayedRecord}
                    canApprove={canApprove}
                    isApplying={isApplying}
                    onApply={() => handleApplyCapaDrafts(displayedRecord)}
                  />
                )}

                {/* PHASE 7: MANAGEMENT INSIGHTS */}
                {displayedRecord.analysisType === 'management_insights' && (
                  <ManagementInsightsBody result={displayedRecord.result as AiManagementInsightsResult} />
                )}

                {/* Data Sources & Limitations Transparency Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Transparansi Sumber Data &amp; Keterbatasan Analisis</span>
                  </div>
                  <p className="text-slate-600">
                    <strong>Sumber Data:</strong> {(displayedRecord.dataSources || []).join(' • ')}
                  </p>
                  <p className="text-slate-600">
                    <strong>Batasan Data:</strong> {displayedRecord.dataLimitations}
                  </p>
                </div>

                {/* HR Human-in-the-Loop Review Bar */}
                <div className="border-t border-slate-200 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Keputusan Review HR (Read-Only Advisory Control)
                    </span>
                    {displayedRecord.reviewedBy && (
                      <span className="text-[11px] text-slate-500">
                        Ditinjau oleh <strong>{displayedRecord.reviewedBy}</strong> ({displayedRecord.reviewedAt})
                      </span>
                    )}
                  </div>

                  {displayedRecord.reviewNotes && (
                    <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 text-xs text-slate-700">
                      <strong>Catatan Reviewer:</strong> {displayedRecord.reviewNotes}
                    </div>
                  )}

                  {canApprove ? (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={reviewNotesDraft}
                        onChange={(e) => setReviewNotesDraft(e.target.value)}
                        placeholder="Catatan persetujuan / revisi HR (opsional)..."
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReviewDecision(displayedRecord, 'Approved')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewDecision(displayedRecord, 'Rejected')}
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Hanya HR Lead / HR Administrator yang memiliki kewenangan Approve atau Reject rekomendasi AI.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right History Sidebar */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Riwayat Analisis ({matchingTabHistory.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Firestore Synced</span>
            </div>

            {matchingTabHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada histori tersimpan untuk tab ini.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {matchingTabHistory.map((item) => {
                  const isSelected = displayedRecord?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedRecordId(item.id)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            item.reviewStatus === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.reviewStatus === 'Rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.reviewStatus === 'Pending Review' ? 'Pending' : item.reviewStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-mono">
                        <span>{item.createdAt}</span>
                        <span>{item.createdBy}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Non-Negotiable Governance Reminder Card */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl border border-slate-800 p-5 text-xs space-y-2">
            <div className="font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Batasan AI Governance SJI</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc pl-4 leading-relaxed">
              <li>AI tidak mengubah Priority, Status, SLA, PIC, atau Closing Date secara otomatis.</li>
              <li>Identitas pelapor &amp; NIK disamarkan sebelum analisis AI dijalankan.</li>
              <li>Draft RCA dan CAPA hanya masuk modul resmi setelah klik Approve dan Apply oleh HR berwenang.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * SUB-COMPONENTS FOR EACH PHASE OUTPUT
 * ============================================================================ */

const GrievanceAnalysisBody: React.FC<{ result: AiGrievanceAnalysis }> = ({ result }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Rekomendasi Kategori
        </span>
        <span className="text-sm font-bold text-slate-900 mt-1 block">{result.recommendedCategory}</span>
      </div>
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Rekomendasi Prioritas
        </span>
        <span
          className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold ${
            result.recommendedPriority === 'Critical'
              ? 'bg-red-100 text-red-800'
              : result.recommendedPriority === 'Major'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {result.recommendedPriority}
        </span>
      </div>
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Departemen Terkait
        </span>
        <span className="text-sm font-bold text-slate-900 mt-1 block">{result.relatedDepartment}</span>
      </div>
    </div>

    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        Ringkasan Keluhan Profesional
      </h4>
      <p className="text-sm text-slate-800 leading-relaxed bg-blue-50/40 border border-blue-100 rounded-xl p-4">
        {result.professionalSummary}
      </p>
    </div>

    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        Alasan Rekomendasi Prioritas (Wajib Konfirmasi HR)
      </h4>
      <p className="text-xs text-slate-700 leading-relaxed">{result.priorityRationale}</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl border border-slate-200 bg-white">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Indikasi Permasalahan</h4>
        <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
          {(result.issueIndications || []).map((ind, idx) => (
            <li key={idx}>{ind}</li>
          ))}
        </ul>
      </div>
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
          Informasi yang Masih Perlu Dilengkapi HR
        </h4>
        <ul className="space-y-1.5 text-xs text-amber-900 list-disc pl-4">
          {(result.missingInvestigationInfo || []).map((m, idx) => (
            <li key={idx}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const RootCauseBody: React.FC<{
  result: AiRootCauseResult;
  record: AiAnalysisRecord;
  canApprove: boolean;
  isApplying: boolean;
  onApply: () => void;
}> = ({ result, record, canApprove, isApplying, onApply }) => (
  <div className="space-y-6">
    {/* 5 Why Section */}
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          A. 5 Why Analysis (Pemisahan Gejala vs Akar Masalah)
        </h3>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
          Kategori Utama 6M: {result.recommendedPrimaryCategory}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        <strong>Gejala Awal Dilaporkan:</strong> {result.fiveWhy?.symptom}
      </div>

      <div className="space-y-2">
        {(result.fiveWhy?.steps || []).map((step) => (
          <div key={step.level} className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 bg-white">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold font-mono flex items-center justify-center shrink-0">
              W{step.level}
            </span>
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-slate-900">{step.question}</div>
              <div className="text-slate-600">{step.finding}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
        <div className="font-bold text-emerald-900">Kesimpulan Akar Masalah: {result.fiveWhy?.rootCauseConclusion}</div>
        <div className="text-emerald-800">{result.fiveWhy?.symptomsVsRootCauseNote}</div>
      </div>
    </div>

    {/* Fishbone 6M Section */}
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
        B. Fishbone Analysis — 6M (Hanya Aspek yang Didukung Fakta)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(result.fishbone6M || []).map((item) => (
          <div
            key={item.category}
            className={`p-3.5 rounded-xl border text-xs ${
              item.isRelevant ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-900">{item.category}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  item.isRelevant ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.isRelevant ? 'Relevan (Ada Bukti)' : 'Tidak Didukung Fakta'}
              </span>
            </div>
            {item.isRelevant && item.possibleCauses?.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-slate-700 mb-1.5">
                {item.possibleCauses.map((cause, idx) => (
                  <li key={idx}>{cause}</li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500">Dasar: {item.evidenceBasis}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Apply Approved Root Cause to Official Module */}
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-xs text-slate-600">
        <strong className="text-slate-900 block">Transfer ke Modul Root Cause (6M) Resmi</strong>
        Hanya tersedia setelah analisis ini berstatus <strong>Approved HR</strong>.
      </div>
      {canApprove && (
        <button
          type="button"
          disabled={record.reviewStatus !== 'Approved' || record.appliedToModule || isApplying}
          onClick={onApply}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center space-x-1.5 transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{record.appliedToModule ? 'Sudah Diterapkan' : 'Terapkan ke Modul RCA (6M)'}</span>
        </button>
      )}
    </div>
  </div>
);

const RepeatDetectionBody: React.FC<{
  result: AiRepeatGrievanceResult;
  cases: GrievanceCase[];
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}> = ({ result, cases, onOpenCase }) => (
  <div className="space-y-4">
    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
      <strong>Prinsip Objektivitas:</strong> Pengelompokan keluhan berulang bertujuan mengevaluasi efektivitas proses
      dan pencegahan sistemik, bukan mencari kesalahan individu atau departemen.
    </div>

    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
      {result.overallPatternSummary}
    </div>

    {result.clusters.length === 0 ? (
      <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
        Tidak ditemukan pengulangan keluhan signifikan pada rentang data ini.
      </div>
    ) : (
      <div className="space-y-3">
        {result.clusters.map((cluster, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">{cluster.patternTitle}</span>
              <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold font-mono">
                {cluster.similarCaseCount} Kasus Serupa
              </span>
            </div>
            <div className="text-slate-600">
              <strong>Periode:</strong> {cluster.occurrencePeriod} • <strong>Departemen:</strong>{' '}
              {(cluster.departments || []).join(', ')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(cluster.similarTicketIds || []).map((tid) => {
                const matchedCase = cases.find((c) => c.ticketId === tid);
                return matchedCase ? (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => onOpenCase(matchedCase, 'overview')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-blue-800 font-mono font-semibold text-[11px] flex items-center space-x-1"
                  >
                    <span>#{tid}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span key={tid} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                    #{tid}
                  </span>
                );
              })}
            </div>
            <p className="text-slate-700">
              <strong>Riwayat Penanganan:</strong> {cluster.previousActionsSummary}
            </p>
            <p className="text-slate-700">
              <strong>Evaluasi Efektivitas:</strong> {cluster.potentialEffectivenessGap}
            </p>
            <p className="text-[11px] text-slate-500 italic">{cluster.neutralObservationNote}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const RiskAssessmentBody: React.FC<{
  result: AiRiskAssessmentResult;
  cases: GrievanceCase[];
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}> = ({ result, cases, onOpenCase }) => (
  <div className="space-y-4">
    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
      {result.governanceDisclaimer}
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
        <span className="text-[10px] font-bold uppercase text-red-700 block">Critical Attention</span>
        <span className="text-2xl font-bold text-red-900 font-mono tabular-nums">
          {result.criticalAttentionCount}
        </span>
      </div>
      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
        <span className="text-[10px] font-bold uppercase text-amber-700 block">High Attention</span>
        <span className="text-2xl font-bold text-amber-900 font-mono tabular-nums">
          {result.highAttentionCount}
        </span>
      </div>
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-[10px] font-bold uppercase text-slate-500 block">Normal Monitoring</span>
        <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
          {result.normalMonitoringCount}
        </span>
      </div>
    </div>

    <p className="text-xs text-slate-700 leading-relaxed">{result.earlyWarningSummary}</p>

    <div className="space-y-2.5">
      {(result.riskItems || []).map((item) => {
        const matchedCase = cases.find((c) => c.id === item.caseId || c.ticketId === item.ticketId);
        return (
          <div key={item.ticketId} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-slate-900">#{item.ticketId}</span>
                <span className="text-slate-500">
                  {item.department} • {item.complaintCategory}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                    item.attentionLevel === 'Critical Attention'
                      ? 'bg-red-100 text-red-800'
                      : item.attentionLevel === 'High Attention'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.attentionLevel}
                </span>
                {matchedCase && (
                  <button
                    type="button"
                    onClick={() => onOpenCase(matchedCase, 'overview')}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold"
                  >
                    Tinjau Kasus
                  </button>
                )}
              </div>
            </div>
            <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
              {(item.riskIndicators || []).map((ind, idx) => (
                <li key={idx}>{ind}</li>
              ))}
            </ul>
            <div className="text-slate-600">
              <strong>Potensi Eskalasi:</strong> {item.escalationPotential}
            </div>
            {item.requiresPriorityHumanReview && (
              <div className="text-[11px] font-semibold text-red-700">
                Wajib Tinjauan Langsung Manusia (HR Berwenang): {item.humanReviewReason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const RecommendedCapaBody: React.FC<{
  result: AiRecommendedCapaResult;
  record: AiAnalysisRecord;
  canApprove: boolean;
  isApplying: boolean;
  onApply: () => void;
}> = ({ result, record, canApprove, isApplying, onApply }) => (
  <div className="space-y-4">
    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
      <strong>Status Draft CAPA:</strong> {result.policyAlignmentNote}
    </div>

    <div className="space-y-3">
      {(result.drafts || []).map((draft, idx) => (
        <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900">Draft Rencana Perbaikan #{idx + 1}</span>
            <span className="font-mono text-[11px] text-slate-600">
              PIC: {draft.recommendedPic} ({draft.recommendedDepartment}) • Target: {draft.suggestedTargetDate} (
              {draft.targetFollowUpDays} hari)
            </span>
          </div>
          <div>
            <strong className="text-slate-800 block">Corrective Action:</strong>
            <p className="text-slate-700">{draft.correctiveAction}</p>
          </div>
          <div>
            <strong className="text-slate-800 block">Preventive Action:</strong>
            <p className="text-slate-700">{draft.preventiveAction}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-700 block mb-0.5">Expected Outcome</strong>
              <span className="text-slate-600">{draft.expectedOutcome}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-slate-700 block mb-0.5">Monitoring Recommendation</strong>
              <span className="text-slate-600">{draft.monitoringRecommendation}</span>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-xs text-slate-600">
        <strong className="text-slate-900 block">Terapkan ke Modul Action Plan (CAPA) Resmi</strong>
        Hanya aktif setelah draft ini berstatus <strong>Approved HR</strong>.
      </div>
      {canApprove && (
        <button
          type="button"
          disabled={record.reviewStatus !== 'Approved' || record.appliedToModule || isApplying}
          onClick={onApply}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center space-x-1.5 transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{record.appliedToModule ? 'Sudah Diterapkan ke CAPA' : 'Terapkan ke Action Plan (CAPA)'}</span>
        </button>
      )}
    </div>
  </div>
);

const ManagementInsightsBody: React.FC<{ result: AiManagementInsightsResult }> = ({ result }) => (
  <div className="space-y-5">
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        Narasi Eksekutif ({result.actualMetrics?.periodLabel})
      </h4>
      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-200 rounded-xl p-4">
        {result.executiveNarrative}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl border border-slate-200 bg-white">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Temuan Kunci Aktual</h4>
        <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
          {(result.keyFindings || []).map((f, idx) => (
            <li key={idx}>{f}</li>
          ))}
        </ul>
      </div>
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">
          Rekomendasi Tindakan Manajemen
        </h4>
        <ul className="list-disc pl-4 space-y-1.5 text-xs text-blue-900">
          {(result.recommendedManagementActions || []).map((act, idx) => (
            <li key={idx}>{act}</li>
          ))}
        </ul>
      </div>
    </div>

    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700">
      <strong className="text-slate-900 block mb-1">Ringkasan Tren Akar Masalah (6M):</strong>
      {result.rootCauseTrendSummary}
    </div>
  </div>
);
