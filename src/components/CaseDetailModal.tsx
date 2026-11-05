import React, { useState, useEffect } from 'react';
import {
  GrievanceCase,
  InvestigationRecord,
  RootCauseAnalysis,
  Rca6MCategory,
  ActionPlan,
  CommunicationLog,
  EvidenceItem,
  CaseStatus,
  CapaProgressStatus
} from '../types';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  getCaseInvestigations,
  saveCaseInvestigation,
  getCaseRootCauses,
  saveCaseRootCause,
  getCaseActionPlans,
  addCaseActionPlan,
  updateCaseActionPlan,
  deleteCaseActionPlan,
  getCaseCommunications,
  addCaseCommunication,
  getCaseEvidence,
  addCaseEvidence,
  deleteCaseEvidence,
} from '../services/db';
import {
  X,
  Clock,
  Shield,
  ShieldAlert,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  FileText,
  Search,
  MessageSquare,
  Check,
  Calendar,
  Lock,
  GitFork,
  ArrowRight,
  Trash2,
  Sparkles,
  Eye,
  Download,
  FileIcon,
  Edit3,
  RefreshCw,
  Upload,
  CheckSquare,
  Wrench,
  Cog,
  Box,
  Scale,
  Compass
} from 'lucide-react';
import {
  generateCaseAiSummary,
  generateAiInvestigationSummary,
  generateAiRootCause
} from '../services/ai';
import { EditCaseModal } from './EditCaseModal';

const CATEGORIES_6M: { id: Rca6MCategory; label: string; icon: any }[] = [
  { id: 'Man', label: 'Man (Manusia)', icon: User },
  { id: 'Method', label: 'Method (Metode)', icon: Wrench },
  { id: 'Machine', label: 'Machine (Mesin)', icon: Cog },
  { id: 'Material', label: 'Material (Bahan)', icon: Box },
  { id: 'Measurement', label: 'Measurement (Pengukuran)', icon: Scale },
  { id: 'Environment', label: 'Environment (Lingkungan)', icon: Compass },
];

export const CaseDetailModal: React.FC = () => {
  const {
    selectedCase,
    isDetailModalOpen,
    setIsDetailModalOpen,
    handleUpdateCase,
    handleDeleteCase,
    detailActiveTab,
    setDetailActiveTab,
  } = useCases();

  const { currentUser, canInvestigate, canDeleteCase } = useAuth();

  // Edit Case Modal
  const [showEditModal, setShowEditModal] = useState(false);

  // Delete case state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Salah input data keluhan');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Subcollections data
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [rcaList, setRcaList] = useState<RootCauseAnalysis[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Investigation Form State (9 Fields, NO signatures)
  const [invForm, setInvForm] = useState({
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
  const [isSavingInv, setIsSavingInv] = useState(false);
  const [invNotice, setInvNotice] = useState<string | null>(null);

  // 2. RCA 6M State
  const [activeRcaCategory, setActiveRcaCategory] = useState<Rca6MCategory>('Man');
  const [rcaForm, setRcaForm] = useState({
    rootCause: '',
    contributingFactors: '',
    impact: '',
    correctiveRecommendations: '',
  });
  const [isSavingRca, setIsSavingRca] = useState(false);
  const [rcaNotice, setRcaNotice] = useState<string | null>(null);

  // 3. CAPA Plan Form & Modal State (8 Fields, 2 Statuses: Progress | Completed)
  const [showCapaModal, setShowCapaModal] = useState(false);
  const [editingCapa, setEditingCapa] = useState<ActionPlan | null>(null);
  const [capaForm, setCapaForm] = useState({
    description: '',
    responsiblePic: '',
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    actionTaken: '',
    progressStatus: 'Progress' as CapaProgressStatus,
    completionDate: '',
    notes: '',
  });
  const [isSavingCapa, setIsSavingCapa] = useState(false);

  // 4. Evidence State & Upload Modal
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);
  const [replaceTargetEvidence, setReplaceTargetEvidence] = useState<EvidenceItem | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceCategory, setEvidenceCategory] = useState<EvidenceItem['category']>('Document');
  const [evidenceConfidential, setEvidenceConfidential] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  // 5. Communication Log Form State (6 Fields)
  const [showCommForm, setShowCommForm] = useState(false);
  const [commForm, setCommForm] = useState({
    date: new Date().toISOString().substring(0, 10),
    channel: 'Email' as CommunicationLog['channel'],
    communicator: currentUser?.displayName || '',
    recipient: '',
    details: '',
    followUpNotes: '',
    isConfidential: true,
  });
  const [isSavingComm, setIsSavingComm] = useState(false);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Load subcollections for the active case
  useEffect(() => {
    if (!selectedCase) return;
    setIsLoading(true);
    setAiSummary(null);
    setInvNotice(null);
    setRcaNotice(null);

    Promise.all([
      getCaseInvestigations(selectedCase.id),
      getCaseRootCauses(selectedCase.id),
      getCaseActionPlans(selectedCase.id),
      getCaseCommunications(selectedCase.id),
      getCaseEvidence(selectedCase.id, currentUser),
    ]).then(([invs, rcas, plans, comms, evs]) => {
      setInvestigations(invs);
      if (invs.length > 0) {
        const latest = invs[0];
        setInvForm({
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
        setInvForm({
          investigationDate: new Date().toISOString().substring(0, 10),
          investigationDetails: `Pemeriksaan keluhan #${selectedCase.ticketId}: ${selectedCase.complaintCategory}`,
          interviewNotes: '',
          witnessInfo: '',
          supportingInfo: '',
          evidenceRef: '',
          findings: '',
          conclusion: '',
          recommendedActions: '',
        });
      }

      setRcaList(rcas);
      const matchRca = rcas.find((item) => item.category === activeRcaCategory);
      if (matchRca) {
        setRcaForm({
          rootCause: matchRca.rootCause || '',
          contributingFactors: matchRca.contributingFactors || '',
          impact: matchRca.impact || '',
          correctiveRecommendations: matchRca.correctiveRecommendations || '',
        });
      }

      setActionPlans(plans);
      setCommunications(comms);
      setEvidenceList(evs);
      setIsLoading(false);
    });
  }, [selectedCase?.id, currentUser?.id]);

  // Sync RCA Form when active 6M tab changes
  useEffect(() => {
    const matchRca = rcaList.find((item) => item.category === activeRcaCategory);
    if (matchRca) {
      setRcaForm({
        rootCause: matchRca.rootCause || '',
        contributingFactors: matchRca.contributingFactors || '',
        impact: matchRca.impact || '',
        correctiveRecommendations: matchRca.correctiveRecommendations || '',
      });
    } else {
      setRcaForm({
        rootCause: '',
        contributingFactors: '',
        impact: '',
        correctiveRecommendations: '',
      });
    }
  }, [activeRcaCategory, rcaList]);

  if (!isDetailModalOpen || !selectedCase) return null;

  // 1. STRICT 4 STAGE WORKFLOW: OPEN -> INVESTIGATION -> ACTION TAKEN -> CLOSED
  const STAGES: { status: CaseStatus; label: string; desc: string }[] = [
    { status: 'Open', label: 'OPEN', desc: 'Kasus Diterima' },
    { status: 'Investigation', label: 'INVESTIGATION', desc: 'Pemeriksaan Lapangan' },
    { status: 'Action Taken', label: 'ACTION TAKEN', desc: 'Tindakan Korektif (CAPA)' },
    { status: 'Closed', label: 'CLOSED', desc: 'Selesai & Disetujui' },
  ];

  const currentStageIndex = STAGES.findIndex((s) => s.status === selectedCase.status);

  const handleAdvanceStage = async (newStatus: CaseStatus) => {
    let progress = 15;
    if (newStatus === 'Investigation') progress = 45;
    else if (newStatus === 'Action Taken') progress = 80;
    else if (newStatus === 'Closed') progress = 100;

    const updates: Partial<GrievanceCase> = {
      status: newStatus,
      progress,
      closingDate: newStatus === 'Closed' ? new Date().toISOString().substring(0, 10) : null,
      approvedBy: newStatus === 'Closed' ? currentUser?.displayName : null,
    };

    await handleUpdateCase(selectedCase.id, updates, `Status diperbarui menjadi ${newStatus}`);
  };

  // 2. Save Investigation (9 Fields, internal info, NO signatures)
  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingInv(true);
    setInvNotice(null);
    try {
      const saved = await saveCaseInvestigation(
        selectedCase.id,
        {
          caseId: selectedCase.id,
          ticketId: selectedCase.ticketId,
          investigationDate: invForm.investigationDate,
          investigationDetails: invForm.investigationDetails,
          interviewNotes: invForm.interviewNotes,
          witnessInfo: invForm.witnessInfo,
          supportingInfo: invForm.supportingInfo,
          evidenceRef: invForm.evidenceRef,
          findings: invForm.findings,
          conclusion: invForm.conclusion,
          recommendedActions: invForm.recommendedActions,
          investigatorName: currentUser.displayName,
          investigatorId: currentUser.id,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );
      setInvestigations((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
      setInvNotice('Data investigasi 9-field berhasil disimpan ke Firestore.');

      // Auto advance to Investigation if currently Open
      if (selectedCase.status === 'Open') {
        await handleAdvanceStage('Investigation');
      }
      setTimeout(() => setInvNotice(null), 3500);
    } catch (err: any) {
      setInvNotice('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSavingInv(false);
    }
  };

  // 3. Save 6M Ishikawa RCA
  const handleSaveRca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingRca(true);
    setRcaNotice(null);
    try {
      const saved = await saveCaseRootCause(
        selectedCase.id,
        {
          caseId: selectedCase.id,
          ticketId: selectedCase.ticketId,
          category: activeRcaCategory,
          rootCause: rcaForm.rootCause,
          contributingFactors: rcaForm.contributingFactors,
          impact: rcaForm.impact,
          correctiveRecommendations: rcaForm.correctiveRecommendations,
          analystId: currentUser.id,
          analystName: currentUser.displayName,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );
      setRcaList((prev) => {
        const filtered = prev.filter((item) => item.category !== activeRcaCategory);
        return [...filtered, saved];
      });
      setRcaNotice(`Analisis 6M (${activeRcaCategory}) tersimpan.`);
      setTimeout(() => setRcaNotice(null), 3500);
    } catch (err: any) {
      setRcaNotice('Gagal menyimpan RCA: ' + err.message);
    } finally {
      setIsSavingRca(false);
    }
  };

  // 4. Save CAPA Plan (8 Fields, 2 Statuses, working revision support)
  const handleOpenAddCapa = () => {
    setEditingCapa(null);
    setCapaForm({
      description: '',
      responsiblePic: selectedCase.assignedPic || currentUser?.displayName || '',
      targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      actionTaken: '',
      progressStatus: 'Progress',
      completionDate: '',
      notes: '',
    });
    setShowCapaModal(true);
  };

  const handleOpenEditCapa = (plan: ActionPlan) => {
    setEditingCapa(plan);
    setCapaForm({
      description: plan.description || plan.title || '',
      responsiblePic: plan.responsiblePic || plan.assignedTo || '',
      targetDate: plan.targetDate || '',
      actionTaken: plan.actionTaken || '',
      progressStatus: (plan.progressStatus === 'Completed' || plan.status === 'Completed' ? 'Completed' : 'Progress'),
      completionDate: plan.completionDate || (plan.progressStatus === 'Completed' ? new Date().toISOString().substring(0, 10) : ''),
      notes: plan.notes || '',
    });
    setShowCapaModal(true);
  };

  const handleSaveCapaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingCapa(true);

    try {
      if (editingCapa) {
        await updateCaseActionPlan(
          selectedCase.id,
          editingCapa.id,
          {
            description: capaForm.description,
            responsiblePic: capaForm.responsiblePic,
            targetDate: capaForm.targetDate,
            actionTaken: capaForm.actionTaken,
            progressStatus: capaForm.progressStatus,
            completionDate: capaForm.progressStatus === 'Completed' ? (capaForm.completionDate || new Date().toISOString().substring(0, 10)) : null,
            notes: capaForm.notes,
          },
          currentUser
        );
        setActionPlans((prev) =>
          prev.map((p) =>
            p.id === editingCapa.id
              ? {
                  ...p,
                  description: capaForm.description,
                  responsiblePic: capaForm.responsiblePic,
                  targetDate: capaForm.targetDate,
                  actionTaken: capaForm.actionTaken,
                  progressStatus: capaForm.progressStatus,
                  completionDate: capaForm.progressStatus === 'Completed' ? (capaForm.completionDate || new Date().toISOString().substring(0, 10)) : null,
                  notes: capaForm.notes,
                }
              : p
          )
        );
      } else {
        const added = await addCaseActionPlan(
          selectedCase.id,
          {
            ticketId: selectedCase.ticketId,
            caseId: selectedCase.id,
            description: capaForm.description,
            responsiblePic: capaForm.responsiblePic,
            targetDate: capaForm.targetDate,
            actionTaken: capaForm.actionTaken,
            progressStatus: capaForm.progressStatus,
            completionDate: capaForm.progressStatus === 'Completed' ? (capaForm.completionDate || new Date().toISOString().substring(0, 10)) : null,
            notes: capaForm.notes,
          },
          currentUser
        );
        setActionPlans((prev) => [...prev, added]);

        // Auto update case progress towards Action Taken
        if (selectedCase.status === 'Open' || selectedCase.status === 'Investigation') {
          await handleAdvanceStage('Action Taken');
        }
      }
      setShowCapaModal(false);
    } catch (err) {
      console.error('Error saving CAPA:', err);
    } finally {
      setIsSavingCapa(false);
    }
  };

  // 5. Evidence file handling
  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
      setEvidenceError('Format harus JPG, JPEG, PNG, atau PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setEvidenceError('Ukuran file maksimal 10 MB.');
      return;
    }

    setEvidenceError(null);
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: sizeStr,
        type: file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEvidenceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedFile) {
      setEvidenceError('Harap pilih berkas bukti.');
      return;
    }
    setIsUploadingEvidence(true);
    try {
      if (replaceTargetEvidence) {
        await deleteCaseEvidence(selectedCase.id, replaceTargetEvidence.id, currentUser);
      }
      const added = await addCaseEvidence(
        selectedCase.id,
        {
          caseId: selectedCase.id,
          ticketId: selectedCase.ticketId,
          title: evidenceTitle.trim() || selectedFile.name,
          category: evidenceCategory,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          fileData: selectedFile.dataUrl,
          isConfidential: evidenceConfidential,
          uploadedBy: currentUser.displayName,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          chainOfCustody: `Diverifikasi dan diarsipkan oleh ${currentUser.displayName}.`,
        },
        currentUser
      );

      setEvidenceList((prev) => [added, ...prev.filter((e) => e.id !== replaceTargetEvidence?.id)]);
      setShowEvidenceModal(false);
      setReplaceTargetEvidence(null);
      setSelectedFile(null);
      setEvidenceTitle('');
    } catch (err: any) {
      setEvidenceError('Gagal mengunggah bukti: ' + err.message);
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  // 6. Save Communication Log (6 Fields)
  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingComm(true);
    try {
      const added = await addCaseCommunication(
        selectedCase.id,
        {
          caseId: selectedCase.id,
          ticketId: selectedCase.ticketId,
          date: commForm.date,
          channel: commForm.channel,
          communicator: commForm.communicator || currentUser.displayName,
          recipient: commForm.recipient,
          details: commForm.details,
          followUpNotes: commForm.followUpNotes,
          isConfidential: commForm.isConfidential,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );
      setCommunications((prev) => [added, ...prev]);
      setShowCommForm(false);
      setCommForm({
        date: new Date().toISOString().substring(0, 10),
        channel: 'Email',
        communicator: currentUser.displayName,
        recipient: '',
        details: '',
        followUpNotes: '',
        isConfidential: true,
      });
    } catch (err) {
      console.warn('Error saving comm:', err);
    } finally {
      setIsSavingComm(false);
    }
  };

  // AI Summary Generator
  const handleGenerateAiSummary = async () => {
    setIsGeneratingAi(true);
    try {
      const summary = await generateCaseAiSummary(selectedCase);
      setAiSummary(summary);
    } catch (err) {
      console.warn('AI Summary error:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Confirm delete case
  const confirmDeleteCase = async () => {
    if (!selectedCase) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteCase(selectedCase.id, deleteReason.trim() || 'Salah input data keluhan');
      setShowDeleteModal(false);
      setIsDetailModalOpen(false);
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus kasus.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-bold text-blue-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              #{selectedCase.ticketId}
            </span>
            <div>
              <h2 className="font-bold text-base text-white">{selectedCase.complaintCategory}</h2>
              <p className="text-xs text-slate-400">
                Departemen: <strong className="text-slate-200">{selectedCase.department}</strong> • Tanggal Keluhan:{' '}
                <strong className="text-slate-200 font-mono">{selectedCase.dateReceived}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Edit Case Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Keluhan</span>
            </button>

            {/* Delete Case (Salah Input) */}
            {canDeleteCase && (
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Hapus Kasus (Salah Input)"
                className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition text-xs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. VISUAL 4-STAGE TIMELINE (OPEN -> INVESTIGATION -> ACTION TAKEN -> CLOSED) */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            {/* Connecting bar */}
            <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-slate-200 z-0">
              <div
                className="h-1 bg-blue-600 transition-all duration-300"
                style={{
                  width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%`,
                }}
              />
            </div>

            {STAGES.map((stage, idx) => {
              const isPassed = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div key={stage.status} className="relative z-10 flex flex-col items-center">
                  <button
                    onClick={() => handleAdvanceStage(stage.status)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs transition border-2 ${
                      isPassed
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : isCurrent
                        ? 'bg-white border-blue-600 text-blue-700 ring-4 ring-blue-100 shadow-md'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4" /> : idx + 1}
                  </button>
                  <span
                    className={`text-xs mt-1 font-bold ${
                      isCurrent ? 'text-blue-700' : isPassed ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block">
                    {stage.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-slate-200 px-4 flex items-center space-x-1 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview Kasus', icon: Eye },
            { id: 'investigation', label: 'Investigation (9 Field)', icon: Search },
            { id: 'root_cause', label: 'RCA (6M Ishikawa)', icon: GitFork },
            { id: 'action_plan', label: 'CAPA Plan', icon: CheckSquare },
            { id: 'evidence', label: `Evidence (${evidenceList.length})`, icon: FileText },
            { id: 'communication', label: `Komunikasi (${communications.length})`, icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = detailActiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDetailActiveTab(tab.id as any)}
                className={`py-3 px-3.5 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: OVERVIEW */}
          {detailActiveTab === 'overview' && (
            <div className="space-y-4">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Prioritas SLA</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block mt-0.5 ${
                      selectedCase.priority === 'Critical'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedCase.priority === 'Major'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedCase.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Target Selesai (Due Date)</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] block mt-0.5">
                    {selectedCase.dueDate || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Responsible PIC</span>
                  <span className="font-bold text-slate-800 text-[11px] block mt-0.5 truncate">
                    {selectedCase.assignedPic || 'Belum ditugaskan'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Saluran Pengaduan</span>
                  <span className="font-bold text-slate-800 text-[11px] block mt-0.5">
                    {selectedCase.channelReceived}
                  </span>
                </div>
              </div>

              {/* Complainant & Protected Reporter Info */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Identitas Pelapor
                </h4>
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>Nama: <strong>{selectedCase.isAnonymous ? selectedCase.anonymousAlias || 'Protected Whistleblower' : selectedCase.employeeName}</strong></span>
                  <span>NIK / NIK Pelapor: <strong>{selectedCase.isAnonymous ? 'Dirahasiakan (Anonim)' : selectedCase.employeeNik || '-'}</strong></span>
                </div>
              </div>

              {/* Complaint Description */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Uraian Keluhan (Description)
                  </h4>
                  <button
                    onClick={handleGenerateAiSummary}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingAi ? 'Menganalisis...' : 'Rangkuman AI'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-line border border-slate-100">
                  {selectedCase.description}
                </div>

                {aiSummary && (
                  <div className="p-3 bg-indigo-50/80 rounded-lg border border-indigo-200 text-xs text-indigo-950 space-y-1">
                    <div className="font-bold flex items-center space-x-1 text-indigo-800">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Hasil Analisis AI (Ringkasan Kasus)</span>
                    </div>
                    <p className="whitespace-pre-line text-[11px] leading-relaxed">{aiSummary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INVESTIGATION (9 FIELDS, NO SIGNATURE) */}
          {detailActiveTab === 'investigation' && (
            <form onSubmit={handleSaveInvestigation} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
                <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-bold">Investigasi Internal Standar HR SJI (Tanpa Signature)</p>
                  <p>
                    Data pemeriksa ({currentUser?.displayName}) tersimpan secara internal untuk audit trail. Bagian tanda tangan resmi dihilangkan sesuai ketentuan.
                  </p>
                </div>
              </div>

              {invNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  <span>{invNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Investigation Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invForm.investigationDate}
                    onChange={(e) => setInvForm({ ...invForm, investigationDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6. Evidence Reference
                  </label>
                  <input
                    type="text"
                    value={invForm.evidenceRef}
                    onChange={(e) => setInvForm({ ...invForm, evidenceRef: e.target.value })}
                    placeholder="Referensi bukti dokumen / foto / log cctv"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Investigation Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={invForm.investigationDetails}
                  onChange={(e) => setInvForm({ ...invForm, investigationDetails: e.target.value })}
                  required
                  placeholder="Ruang lingkup pemeriksaan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Interview Notes
                  </label>
                  <textarea
                    rows={3}
                    value={invForm.interviewNotes}
                    onChange={(e) => setInvForm({ ...invForm, interviewNotes: e.target.value })}
                    placeholder="Catatan wawancara terlapor / pelapor..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Witness Information
                  </label>
                  <textarea
                    rows={3}
                    value={invForm.witnessInfo}
                    onChange={(e) => setInvForm({ ...invForm, witnessInfo: e.target.value })}
                    placeholder="Informasi saksi di lokasi..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  5. Supporting Information
                </label>
                <input
                  type="text"
                  value={invForm.supportingInfo}
                  onChange={(e) => setInvForm({ ...invForm, supportingInfo: e.target.value })}
                  placeholder="Informasi pendukung / riwayat sebelumnya"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  7. Findings (Temuan Pemeriksaan) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={invForm.findings}
                  onChange={(e) => setInvForm({ ...invForm, findings: e.target.value })}
                  required
                  placeholder="Fakta konkret yang ditemukan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  8. Investigation Conclusion <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={invForm.conclusion}
                  onChange={(e) => setInvForm({ ...invForm, conclusion: e.target.value })}
                  required
                  placeholder="Kesimpulan akhir investigasi..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  9. Recommended Actions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={invForm.recommendedActions}
                  onChange={(e) => setInvForm({ ...invForm, recommendedActions: e.target.value })}
                  required
                  placeholder="Rekomendasi tindakan pencegahan & perbaikan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingInv}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {isSavingInv ? 'Menyimpan...' : 'Simpan Data Investigasi'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: RCA 6M ISHIKAWA */}
          {detailActiveTab === 'root_cause' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border rounded-xl overflow-hidden bg-slate-100 p-1 gap-1">
                {CATEGORIES_6M.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeRcaCategory === cat.id;
                  const hasData = rcaList.some((item) => item.category === cat.id && item.rootCause?.trim());

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveRcaCategory(cat.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition relative ${
                        isActive ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      {hasData && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="text-[11px]">{cat.id}</span>
                    </button>
                  );
                })}
              </div>

              {rcaNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  <span>{rcaNotice}</span>
                </div>
              )}

              <form onSubmit={handleSaveRca} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  Analisis Dimensi: <span className="text-indigo-600">{activeRcaCategory}</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Root Cause (Akar Masalah) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={rcaForm.rootCause}
                    onChange={(e) => setRcaForm({ ...rcaForm, rootCause: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contributing Factors
                    </label>
                    <textarea
                      rows={2}
                      value={rcaForm.contributingFactors}
                      onChange={(e) => setRcaForm({ ...rcaForm, contributingFactors: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Impact (Dampak) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={rcaForm.impact}
                      onChange={(e) => setRcaForm({ ...rcaForm, impact: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Corrective Recommendations <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={rcaForm.correctiveRecommendations}
                    onChange={(e) => setRcaForm({ ...rcaForm, correctiveRecommendations: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingRca}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    {isSavingRca ? 'Menyimpan...' : `Simpan Dimensi ${activeRcaCategory}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: CAPA PLAN */}
          {detailActiveTab === 'action_plan' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Rencana Perbaikan &amp; Pencegahan (CAPA)</h4>
                  <p className="text-[11px] text-slate-500">Status tegas: Progress | Completed. Revisi kapan saja.</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddCapa}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah CAPA</span>
                </button>
              </div>

              {actionPlans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  Belum ada rencana tindakan CAPA untuk kasus ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {actionPlans.map((plan) => {
                    const isCompleted = plan.progressStatus === 'Completed' || plan.status === 'Completed';

                    return (
                      <div key={plan.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">
                            {plan.description || plan.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isCompleted ? 'Completed' : 'Progress'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                          <div>PIC: <strong>{plan.responsiblePic || plan.assignedTo || 'Unassigned'}</strong></div>
                          <div>Target: <strong className="font-mono">{plan.targetDate || '-'}</strong></div>
                          <div>Selesai: <strong className="font-mono">{plan.completionDate || '-'}</strong></div>
                        </div>

                        {plan.actionTaken && (
                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-100">
                            Tindakan: {plan.actionTaken}
                          </div>
                        )}

                        {plan.notes && (
                          <div className="text-[11px] text-slate-500 italic">
                            Catatan / Revisi: {plan.notes}
                          </div>
                        )}

                        <div className="pt-2 flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCapa(plan)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 bg-blue-50 rounded border border-blue-200 flex items-center space-x-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Mark Progress / Update (Revisi)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EVIDENCE VAULT */}
          {detailActiveTab === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Evidence Vault (JPG, JPEG, PNG, PDF)</h4>
                  <p className="text-[11px] text-slate-500">Maksimal 10 MB per file terhubung dengan Ticket ID.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplaceTargetEvidence(null);
                    setSelectedFile(null);
                    setEvidenceTitle('');
                    setEvidenceError(null);
                    setShowEvidenceModal(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Bukti</span>
                </button>
              </div>

              {evidenceList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  Belum ada dokumen atau foto bukti yang diunggah.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {evidenceList.map((item) => {
                    const isPdf = item.fileType?.includes('pdf') || item.fileName.toLowerCase().endsWith('.pdf');

                    return (
                      <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div
                          onClick={() => setPreviewEvidence(item)}
                          className="h-28 bg-white rounded border overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90"
                        >
                          {!isPdf && item.fileData ? (
                            <img src={item.fileData} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-8 h-8 text-rose-500" />
                          )}
                        </div>

                        <div>
                          <h5 className="font-bold text-xs text-slate-900 truncate">{item.title}</h5>
                          <p className="text-[10px] text-slate-400 truncate">{item.fileName} • {item.fileSize}</p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                          <button
                            type="button"
                            onClick={() => setPreviewEvidence(item)}
                            className="text-blue-600 hover:underline font-semibold text-[11px]"
                          >
                            Preview
                          </button>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = item.fileData || item.fileUrl || '';
                                a.download = item.fileName;
                                a.click();
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplaceTargetEvidence(item);
                                setEvidenceTitle(item.title);
                                setEvidenceCategory(item.category);
                                setSelectedFile(null);
                                setShowEvidenceModal(true);
                              }}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (currentUser && window.confirm('Hapus file ini?')) {
                                  await deleteCaseEvidence(selectedCase.id, item.id, currentUser);
                                  setEvidenceList((prev) => prev.filter((e) => e.id !== item.id));
                                }
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: COMMUNICATION LOG */}
          {detailActiveTab === 'communication' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Communication Log Terkait #{selectedCase.ticketId}</h4>
                  <p className="text-[11px] text-slate-500">Rekam percakapan, memo, dan notula rapat.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommForm(!showCommForm)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showCommForm ? 'Tutup Form' : 'Tambah Log'}</span>
                </button>
              </div>

              {showCommForm && (
                <form onSubmit={handleSaveComm} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={commForm.date}
                        onChange={(e) => setCommForm({ ...commForm, date: e.target.value })}
                        required
                        className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Channel</label>
                      <select
                        value={commForm.channel}
                        onChange={(e) => setCommForm({ ...commForm, channel: e.target.value as any })}
                        className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                      >
                        <option value="Email">Email</option>
                        <option value="Formal HR Memo">Formal HR Memo</option>
                        <option value="Internal Note">Internal Note</option>
                        <option value="Verbal Discussion">Verbal Discussion</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Hotline / WhatsApp">Hotline / WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Recipient</label>
                      <input
                        type="text"
                        value={commForm.recipient}
                        onChange={(e) => setCommForm({ ...commForm, recipient: e.target.value })}
                        required
                        placeholder="Nama / Departemen Penerima"
                        className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Communication Details</label>
                    <textarea
                      rows={2}
                      value={commForm.details}
                      onChange={(e) => setCommForm({ ...commForm, details: e.target.value })}
                      required
                      placeholder="Isi komunikasi atau pembahasan..."
                      className="w-full px-3 py-2 text-xs rounded border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Notes</label>
                    <input
                      type="text"
                      value={commForm.followUpNotes}
                      onChange={(e) => setCommForm({ ...commForm, followUpNotes: e.target.value })}
                      placeholder="Catatan tindak lanjut..."
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowCommForm(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingComm}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                    >
                      {isSavingComm ? 'Menyimpan...' : 'Simpan Log'}
                    </button>
                  </div>
                </form>
              )}

              {communications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  Belum ada log komunikasi tercatat.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {communications.map((cm) => (
                    <div key={cm.id} className="p-3 bg-white space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{cm.communicator} → {cm.recipient}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{cm.date} • {cm.channel}</span>
                      </div>
                      <p className="text-xs text-slate-700">{cm.details}</p>
                      {cm.followUpNotes && (
                        <p className="text-[11px] text-slate-400 italic">Follow-up: {cm.followUpNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Status Kasus: <strong className="text-blue-700 font-bold uppercase">{selectedCase.status}</strong>
          </div>
          <button
            onClick={() => setIsDetailModalOpen(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Edit Case Modal (Full Edit Existing Complaint) */}
      <EditCaseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        caseData={selectedCase}
      />

      {/* Delete Case Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-rose-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">Hapus Data Kasus?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Tindakan ini untuk menghapus data keluhan yang salah dimasukkan. Seluruh data subkoleksi (RCA, investigasi, bukti) akan dihapus secara permanen dari Firestore.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Penghapusan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Salah input nomor tiket / duplikasi data"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>

            {deleteError && (
              <div className="text-xs text-rose-600 font-semibold">{deleteError}</div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteCase}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Kasus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAPA Add/Edit Submodal */}
      {showCapaModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCapa ? 'Revisi / Update Data CAPA' : 'Tambah Rencana Aksi (CAPA)'}
              </h3>
              <button onClick={() => setShowCapaModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCapaSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Action Plan Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={capaForm.description}
                  onChange={(e) => setCapaForm({ ...capaForm, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Responsible PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={capaForm.responsiblePic}
                    onChange={(e) => setCapaForm({ ...capaForm, responsiblePic: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={capaForm.targetDate}
                    onChange={(e) => setCapaForm({ ...capaForm, targetDate: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Action Taken (Tindakan Terlaksana)
                </label>
                <textarea
                  rows={2}
                  value={capaForm.actionTaken}
                  onChange={(e) => setCapaForm({ ...capaForm, actionTaken: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Progress Status (2 Status) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={capaForm.progressStatus}
                    onChange={(e) => setCapaForm({ ...capaForm, progressStatus: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-bold"
                  >
                    <option value="Progress">Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={capaForm.completionDate}
                    onChange={(e) => setCapaForm({ ...capaForm, completionDate: e.target.value })}
                    disabled={capaForm.progressStatus !== 'Completed'}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Catatan / Revisi Perbaikan)
                </label>
                <input
                  type="text"
                  value={capaForm.notes}
                  onChange={(e) => setCapaForm({ ...capaForm, notes: e.target.value })}
                  placeholder="Keterangan jika ada revisi"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCapaModal(false)}
                  className="px-3 py-2 border rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCapa}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {isSavingCapa ? 'Menyimpan...' : 'Simpan CAPA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Upload Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {replaceTargetEvidence ? 'Ganti File Bukti' : 'Unggah File Bukti'}
              </h3>
              <button onClick={() => setShowEvidenceModal(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {evidenceError && (
              <div className="text-xs text-rose-600 font-medium">{evidenceError}</div>
            )}

            <form onSubmit={handleSaveEvidenceUpload} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul / Keterangan Bukti</label>
                <input
                  type="text"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  placeholder="Contoh: Lampiran Kronologis Lapangan"
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih File (JPG, PNG, PDF)</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleEvidenceFileChange}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-3 py-2 border rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingEvidence}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {isUploadingEvidence ? 'Mengunggah...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Evidence Modal */}
      {previewEvidence && (
        <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">{previewEvidence.title}</h4>
                <p className="text-xs text-slate-400">{previewEvidence.fileName} • {previewEvidence.fileSize}</p>
              </div>
              <button onClick={() => setPreviewEvidence(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex-1 overflow-auto flex items-center justify-center min-h-[380px]">
              {previewEvidence.fileType?.includes('pdf') || previewEvidence.fileName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewEvidence.fileData || previewEvidence.fileUrl}
                  title={previewEvidence.fileName}
                  className="w-full h-[500px] rounded bg-white"
                />
              ) : previewEvidence.fileData || previewEvidence.fileUrl ? (
                <img
                  src={previewEvidence.fileData || previewEvidence.fileUrl}
                  alt={previewEvidence.title}
                  className="max-h-[500px] max-w-full object-contain rounded"
                />
              ) : (
                <div className="text-white text-xs">Preview tidak tersedia.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
