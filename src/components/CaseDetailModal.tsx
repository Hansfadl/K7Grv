import React, { useState, useEffect } from 'react';
import { GrievanceCase, InvestigationFinding, RootCauseAnalysis, ActionPlan, CommunicationLog, EvidenceItem, CaseStatus } from '../types';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  getCaseFindings,
  addCaseFinding,
  getCaseRootCause,
  saveCaseRootCause,
  getCaseActionPlans,
  addCaseActionPlan,
  updateActionPlanStatus,
  getCaseCommunications,
  addCaseCommunication,
  getCaseEvidence,
  addCaseEvidence,
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
  FileCheck,
  Search,
  MessageSquare,
  Paperclip,
  Check,
  Calendar,
  Lock,
  GitFork,
  ArrowRight,
  Trash2,
  Sparkles,
  Copy,
  Eye,
  Download,
  ExternalLink,
  FileIcon
} from 'lucide-react';
import { generateCaseAiSummary, generateAiRootCause } from '../services/ai';

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

  const { currentUser, confidentialMode, canApprove, canInvestigate, canDeleteCase } = useAuth();

  // Delete case state (salah input)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Salah input data keluhan');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteCase = async () => {
    if (!selectedCase) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteCase(selectedCase.id, deleteReason.trim() || 'Salah input data keluhan');
      setShowDeleteModal(false);
      setIsDetailModalOpen(false);
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus data keluhan.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Subcollection state
  const [findings, setFindings] = useState<InvestigationFinding[]>([]);
  const [rootCause, setRootCause] = useState<RootCauseAnalysis | null>(null);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form states for new subcollection items
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [newFinding, setNewFinding] = useState({
    title: '',
    intervieweeName: '',
    interviewType: 'Witness' as InvestigationFinding['interviewType'],
    dateConducted: new Date().toISOString().substring(0, 10),
    keyFindings: '',
    statementSummary: '',
    credibilityAssessment: 'Verified reliable.',
  });

  // RCA Form
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

  // Action Plan Form
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    type: 'Corrective' as ActionPlan['type'],
    assignedTo: '',
    assignedRole: 'Department PIC',
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
  });

  // Comm Form
  const [newComm, setNewComm] = useState({
    type: 'Internal Note' as CommunicationLog['type'],
    subject: '',
    content: '',
    recipient: 'HR Investigation Team',
    isConfidential: true,
  });

  // Evidence Form & File Upload State (Supports Photo & PDF)
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);

  const [newEvidence, setNewEvidence] = useState({
    title: '',
    category: 'Document' as EvidenceItem['category'],
    fileName: '',
    fileSize: '1.2 MB',
    isConfidential: false,
    chainOfCustody: 'Logged by authorized investigator.',
  });

  // AI Generation States
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [isGeneratingAiRca, setIsGeneratingAiRca] = useState(false);
  const [rcaSaveNotice, setRcaSaveNotice] = useState<string | null>(null);

  // Load subcollections only when selectedCase ID changes (preserves in-progress 5W typing)
  useEffect(() => {
    if (!selectedCase) return;
    setIsLoading(true);
    setAiSummary(null);
    setRcaSaveNotice(null);

    Promise.all([
      getCaseFindings(selectedCase.id),
      getCaseRootCause(selectedCase.id),
      getCaseActionPlans(selectedCase.id),
      getCaseCommunications(selectedCase.id),
      getCaseEvidence(selectedCase.id, currentUser),
    ]).then(([fnds, rca, plans, comms, evs]) => {
      setFindings(fnds);
      setRootCause(rca);
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
      setActionPlans(plans);
      setCommunications(comms);
      setEvidenceList(evs);
      setIsLoading(false);
    });
  }, [selectedCase?.id, currentUser?.id]);

  if (!isDetailModalOpen || !selectedCase) return null;

  // Siklus 4 Tahapan Kasus SJI: Open -> Investigation -> Action Taken -> Closed
  const STATUS_FLOW: CaseStatus[] = [
    'Open',
    'Investigation',
    'Action Taken',
    'Closed',
  ];

  const currentStatusIndex = STATUS_FLOW.indexOf(selectedCase.status);

  // Status Updater
  const handleStatusChange = async (newStatus: CaseStatus) => {
    let progress = selectedCase.progress;
    if (newStatus === 'Open') progress = 15;
    else if (newStatus === 'Investigation') progress = 45;
    else if (newStatus === 'Action Taken') progress = 80;
    else if (newStatus === 'Closed') progress = 100;

    const updates: Partial<GrievanceCase> = {
      status: newStatus,
      progress,
      closingDate: newStatus === 'Closed' ? new Date().toISOString().substring(0, 10) : selectedCase.closingDate,
      approvedBy: newStatus === 'Closed' ? currentUser?.displayName : selectedCase.approvedBy,
    };

    await handleUpdateCase(selectedCase.id, updates, `Status advanced to ${newStatus}`);
  };

  // Add Investigation Finding
  const handleSaveFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const item = await addCaseFinding(
      selectedCase.id,
      {
        ...newFinding,
        caseId: selectedCase.id,
        investigatorName: currentUser.displayName,
        investigatorId: currentUser.id,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      currentUser
    );
    setFindings((prev) => [item, ...prev]);
    setShowAddFinding(false);
    setNewFinding({
      title: '',
      intervieweeName: '',
      interviewType: 'Witness',
      dateConducted: new Date().toISOString().substring(0, 10),
      keyFindings: '',
      statementSummary: '',
      credibilityAssessment: 'Verified reliable.',
    });
  };

  // Save RCA
  const handleSaveRca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedCase) return;
    const item = await saveCaseRootCause(
      selectedCase.id,
      {
        ...rcaForm,
        caseId: selectedCase.id,
        analystId: currentUser.id,
        analystName: currentUser.displayName,
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      currentUser
    );
    setRootCause(item);
    setRcaSaveNotice('Lembar 5W berhasil disimpan dan diperbarui.');
    setTimeout(() => setRcaSaveNotice(null), 3500);
  };

  // AI 5W Sugestion
  const handleAiSuggestRca = async () => {
    if (!selectedCase) return;
    setIsGeneratingAiRca(true);
    try {
      const suggestion = await generateAiRootCause(selectedCase);
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
      setRcaSaveNotice('Sugesti Lembar 5W berhasil dihasilkan AI.');
      setTimeout(() => setRcaSaveNotice(null), 3500);
    } catch (err: any) {
      alert('Gagal menghasilkan AI root cause: ' + err.message);
    } finally {
      setIsGeneratingAiRca(false);
    }
  };

  // AI Case Summary Generation
  const handleGenerateAiSummary = async () => {
    if (!selectedCase) return;
    setIsGeneratingAiSummary(true);
    try {
      const summary = await generateCaseAiSummary(selectedCase);
      setAiSummary(summary);
    } catch (err: any) {
      alert('Gagal membuat ringkasan AI: ' + err.message);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  // Add Action Plan
  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const item = await addCaseActionPlan(
      selectedCase.id,
      {
        ...newAction,
        caseId: selectedCase.id,
        status: 'In Progress',
        createdAt: new Date().toISOString().substring(0, 10),
      },
      currentUser
    );
    setActionPlans((prev) => [...prev, item]);
    setShowAddAction(false);
    setNewAction({
      title: '',
      description: '',
      type: 'Corrective',
      assignedTo: '',
      assignedRole: 'Department PIC',
      targetDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    });
  };

  // Update Action Status (Toggle between Completed & In Progress)
  const handleActionStatusChange = async (planId: string, status: ActionPlan['status']) => {
    if (!currentUser) return;
    await updateActionPlanStatus(selectedCase.id, planId, status, currentUser, 'Verified by authorized staff');
    setActionPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status,
              completedDate: status === 'Completed' ? new Date().toISOString().substring(0, 10) : undefined,
            }
          : p
      )
    );
  };

  // Add Communication Log
  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComm.subject.trim() || !newComm.content.trim()) return;
    const item = await addCaseCommunication(
      selectedCase.id,
      {
        ...newComm,
        caseId: selectedCase.id,
        senderName: currentUser.displayName,
        senderRole: currentUser.role,
        senderId: currentUser.id,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      currentUser
    );
    setCommunications((prev) => [item, ...prev]);
    setNewComm({
      type: 'Internal Note',
      subject: '',
      content: '',
      recipient: 'HR Investigation Team',
      isConfidential: true,
    });
  };

  // File Upload Handler (Photo or PDF)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const sizeKb = (file.size / 1024).toFixed(1) + ' KB';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setSelectedFile({
        name: file.name,
        size: sizeKb,
        type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        dataUrl: reader.result as string,
      });
      setNewEvidence((prev) => ({
        ...prev,
        fileName: file.name,
        fileSize: sizeKb,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        category: isPdf ? 'Document' : 'Photo',
      }));
    };
    reader.readAsDataURL(file);
  };

  // Add Evidence (Saves Photo / PDF)
  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newEvidence.title.trim()) return;
    const item = await addCaseEvidence(
      selectedCase.id,
      {
        ...newEvidence,
        caseId: selectedCase.id,
        fileName: selectedFile?.name || newEvidence.fileName || 'dokumen_terlampir.pdf',
        fileSize: selectedFile?.size || newEvidence.fileSize,
        fileData: selectedFile?.dataUrl || undefined,
        fileType: selectedFile?.type || (newEvidence.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        uploadedBy: currentUser.displayName,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      currentUser
    );
    setEvidenceList((prev) => [item, ...prev]);
    setShowAddEvidence(false);
    setSelectedFile(null);
    setNewEvidence({
      title: '',
      category: 'Document',
      fileName: '',
      fileSize: '1.2 MB',
      isConfidential: false,
      chainOfCustody: 'Logged by authorized investigator.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="px-2.5 py-1 rounded bg-blue-600 font-mono font-bold text-sm tracking-wider">
              {selectedCase.ticketId}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">
                  {selectedCase.complaintCategory}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedCase.priority === 'Critical'
                      ? 'bg-rose-500 text-white'
                      : selectedCase.priority === 'Major'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {selectedCase.priority} Priority
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Departemen: <span className="text-slate-200 font-semibold">{selectedCase.department}</span> •
                Saluran: <span className="text-blue-300 font-bold px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800">{selectedCase.channelReceived || 'Online'}</span> •
                Diterima: {selectedCase.dateReceived} • SLA: <span
                  className={
                    selectedCase.slaStatus === 'Breached'
                      ? 'text-rose-400 font-bold'
                      : 'text-emerald-400 font-semibold'
                  }
                >
                  {selectedCase.slaStatus}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canDeleteCase && (
              <button
                type="button"
                onClick={() => {
                  setDeleteReason('Salah input data keluhan');
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-xs font-semibold transition"
                title="Hapus keluhan jika terjadi salah input"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus Kasus (Salah Input)</span>
              </button>
            )}
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Lifecycle Stepper */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Case Progression Lifecycle</span>
            <span>Current Stage: <strong className="text-blue-700">{selectedCase.status}</strong></span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {STATUS_FLOW.map((st, idx) => {
              const isPast = idx < currentStatusIndex;
              const isCurrent = idx === currentStatusIndex;
              return (
                <button
                  key={st}
                  disabled={currentUser?.role === 'department_pic' && idx > currentStatusIndex + 1}
                  onClick={() => handleStatusChange(st)}
                  className={`py-2 px-2 rounded-lg text-center text-[11px] font-bold border transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="truncate">{idx + 1}. {st}</div>
                  <div className="text-[9px] font-normal opacity-85">
                    {isCurrent ? 'Tahap Aktif' : isPast ? 'Selesai' : 'Berikutnya'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Details', icon: FileText },
            { id: 'investigation', label: `Investigation (${findings.length})`, icon: Search },
            { id: 'root_cause', label: 'Root Cause (5 Whys)', icon: GitFork },
            { id: 'action_plan', label: `Action Plan (${actionPlans.length})`, icon: FileCheck },
            { id: 'communication', label: `Communications (${communications.length})`, icon: MessageSquare },
            { id: 'evidence', label: `Evidence Vault (${evidenceList.length})`, icon: Paperclip },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = detailActiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDetailActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {/* TAB 1: OVERVIEW */}
          {detailActiveTab === 'overview' && (
            <div className="space-y-6">
              {/* Complainant Identity Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Reporter &amp; Case Personnel
                    </h4>
                  </div>
                  {selectedCase.isAnonymous && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Protected Whistleblower Record</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Complainant / Reporter</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedCase.isAnonymous
                        ? confidentialMode
                          ? `${selectedCase.anonymousAlias || 'Whistleblower'} [Protected]`
                          : `${selectedCase.anonymousAlias} [UNMASKED]`
                        : selectedCase.employeeName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Department PIC</span>
                    <span className="font-semibold text-slate-800 text-sm">{selectedCase.assignedPic || 'Unassigned'}</span>
                  </div>
                </div>
              </div>

              {/* Description & Intake Details */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                    Grievance Description (Received via Internal Portal)
                  </h4>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedCase.description}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Incident Date</span>
                    <span className="font-medium text-slate-800">{selectedCase.incidentDate || 'Not specified'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Incident Location</span>
                    <span className="font-medium text-slate-800">{selectedCase.location || 'Company premises'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Involved Parties</span>
                    <span className="font-medium text-slate-800">{selectedCase.involvedParties || 'Under inquiry'}</span>
                  </div>
                </div>
              </div>

              {/* AI Executive Summary & Investigation Notes */}
              <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl border border-blue-200 p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                        Ringkasan Eksekutif &amp; Catatan Investigasi (AI Generated)
                      </h4>
                      <p className="text-[11px] text-blue-800">
                        Sintesis keluhan, identifikasi risiko, dan rekomendasi investigasi cerdas via Gemini AI
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    disabled={isGeneratingAiSummary}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingAiSummary ? 'Menganalisis Kasus...' : 'Generate Ringkasan AI'}</span>
                  </button>
                </div>

                {aiSummary ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-white rounded-lg border border-blue-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                      {aiSummary}
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(aiSummary);
                          alert('Ringkasan AI disalin ke clipboard.');
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Ringkasan</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleUpdateCase(selectedCase.id, {
                            resolutionSummary: aiSummary,
                          });
                          alert('Ringkasan AI berhasil diterapkan sebagai Resolution Summary.');
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Terapkan ke Ringkasan Kasus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white/70 rounded-lg border border-dashed border-blue-200 text-center text-xs text-slate-500">
                    Klik tombol <strong>"Generate Ringkasan AI"</strong> untuk membuat analisis komprehensif, poin investigasi, dan rekomendasi CAPA secara otomatis.
                  </div>
                )}
              </div>

              {/* Resolution Summary (If resolved/closed) */}
              {(selectedCase.resolutionSummary || selectedCase.status === 'Closed') && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-xs">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs uppercase tracking-wider mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolution Summary &amp; Executive Sign-off</span>
                  </div>
                  <p className="text-xs text-emerald-950 leading-relaxed whitespace-pre-wrap">
                    {selectedCase.resolutionSummary || 'Resolution documented and agreed upon by Department PIC.'}
                  </p>
                  {selectedCase.closureRemarks && (
                    <div className="mt-2 text-xs text-emerald-800 border-t border-emerald-200 pt-2">
                      <strong>Closure Remarks:</strong> {selectedCase.closureRemarks}
                    </div>
                  )}
                  {selectedCase.approvedBy && (
                    <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                      Approved By: {selectedCase.approvedBy} on {selectedCase.closingDate || 'Recent'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVESTIGATION */}
          {detailActiveTab === 'investigation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Investigation Findings &amp; Interviews</h4>
                  <p className="text-xs text-slate-500">Document witness interviews, depositions, and facts</p>
                </div>
                {canInvestigate && (
                  <button
                    onClick={() => setShowAddFinding(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log Interview / Finding</span>
                  </button>
                )}
              </div>

              {/* Add Finding Form */}
              {showAddFinding && (
                <form onSubmit={handleSaveFinding} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-blue-900">New Investigation Entry</span>
                    <button type="button" onClick={() => setShowAddFinding(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Title / Hearing Topic *"
                      required
                      value={newFinding.title}
                      onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Interviewee Name *"
                      required
                      value={newFinding.intervieweeName}
                      onChange={(e) => setNewFinding({ ...newFinding, intervieweeName: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    />
                    <select
                      value={newFinding.interviewType}
                      onChange={(e) => setNewFinding({ ...newFinding, interviewType: e.target.value as any })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    >
                      <option value="Complainant">Complainant</option>
                      <option value="Accused / Respondent">Accused / Respondent</option>
                      <option value="Witness">Witness</option>
                      <option value="Subject Matter Expert">Subject Matter Expert</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Key findings and material facts established *"
                    required
                    rows={3}
                    value={newFinding.keyFindings}
                    onChange={(e) => setNewFinding({ ...newFinding, keyFindings: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFinding(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Save Finding
                    </button>
                  </div>
                </form>
              )}

              {/* Findings List */}
              <div className="space-y-3">
                {findings.length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                    No investigation interviews logged yet for this case.
                  </div>
                ) : (
                  findings.map((fnd) => (
                    <div key={fnd.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{fnd.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {fnd.interviewType}: {fnd.intervieweeName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{fnd.dateConducted}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{fnd.keyFindings}</p>
                      {fnd.statementSummary && (
                        <div className="p-2.5 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-600 italic">
                          "{fnd.statementSummary}"
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Investigator: {fnd.investigatorName}</span>
                        <span>Credibility: {fnd.credibilityAssessment}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ROOT CAUSE ANALYSIS (5 WHYS) */}
          {detailActiveTab === 'root_cause' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <GitFork className="w-4 h-4 text-blue-600" />
                    <span>Lembar 5W &amp; Root Cause Analysis (Ishikawa)</span>
                  </h4>
                  <p className="text-xs text-slate-500">Uncover underlying systemic breakdowns rather than symptoms</p>
                </div>

                <button
                  type="button"
                  onClick={handleAiSuggestRca}
                  disabled={isGeneratingAiRca}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isGeneratingAiRca ? 'Menganalisis...' : 'Sugesti 5W dengan AI'}</span>
                </button>
              </div>

              {rcaSaveNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{rcaSaveNotice}</span>
                </div>
              )}

              <form onSubmit={handleSaveRca} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Primary Ishikawa Root Cause Domain
                  </label>
                  <select
                    value={rcaForm.primaryCategory}
                    onChange={(e) => setRcaForm({ ...rcaForm, primaryCategory: e.target.value as any })}
                    className="w-full sm:w-80 px-3 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-medium"
                  >
                    <option value="Management & Leadership">Management &amp; Leadership</option>
                    <option value="Process">Process &amp; Standard Operating Procedure</option>
                    <option value="Policy">Company Policy &amp; Guidelines</option>
                    <option value="People">People Competency / Training</option>
                    <option value="Work Environment">Work Environment &amp; Psychological Safety</option>
                    <option value="Equipment / System">Equipment / Digital System</option>
                  </select>
                </div>

                {/* 5 Whys Chain */}
                <div className="space-y-2 border-l-2 border-blue-500 pl-4 my-2">
                  {[1, 2, 3, 4, 5].map((num) => {
                    const key = `why${num}` as keyof typeof rcaForm;
                    return (
                      <div key={num} className="space-y-1">
                        <label className="block text-[11px] font-bold text-blue-900">
                          Why #{num}:
                        </label>
                        <input
                          type="text"
                          value={rcaForm[key]}
                          onChange={(e) => setRcaForm({ ...rcaForm, [key]: e.target.value })}
                          placeholder={`Why did this happen? (Level ${num})`}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Systemic Factors Identified
                    </label>
                    <textarea
                      rows={3}
                      value={rcaForm.systemicFactors}
                      onChange={(e) => setRcaForm({ ...rcaForm, systemicFactors: e.target.value })}
                      placeholder="e.g. Inadequate supervisor dual-authorization checks, missing safety cutoff interlock..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Preventive Recommendations
                    </label>
                    <textarea
                      rows={3}
                      value={rcaForm.preventiveRecommendations}
                      onChange={(e) => setRcaForm({ ...rcaForm, preventiveRecommendations: e.target.value })}
                      placeholder="Long-term organizational adjustments to eliminate recurrence..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                  >
                    Save Root Cause Analysis
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: ACTION PLAN (CAPA) */}
          {detailActiveTab === 'action_plan' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Corrective &amp; Preventive Action Plans (CAPA)</h4>
                  <p className="text-xs text-slate-500">Track assigned remediations and verification sign-offs</p>
                </div>
                <button
                  onClick={() => setShowAddAction(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Action Item</span>
                </button>
              </div>

              {/* Add Action Form */}
              {showAddAction && (
                <form onSubmit={handleSaveAction} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-blue-900">New CAPA Remediation Task</span>
                    <button type="button" onClick={() => setShowAddAction(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Action Title *"
                      required
                      value={newAction.title}
                      onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    />
                    <select
                      value={newAction.type}
                      onChange={(e) => setNewAction({ ...newAction, type: e.target.value as any })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    >
                      <option value="Corrective">Corrective</option>
                      <option value="Preventive">Preventive</option>
                      <option value="Disciplinary">Disciplinary</option>
                      <option value="Policy Amendment">Policy Amendment</option>
                      <option value="Counseling/Mediation">Counseling/Mediation</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Assignee (e.g. David Chen) *"
                      required
                      value={newAction.assignedTo}
                      onChange={(e) => setNewAction({ ...newAction, assignedTo: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                  <textarea
                    placeholder="Specific actionable instructions..."
                    rows={2}
                    value={newAction.description}
                    onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAction(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Commit Action Plan
                    </button>
                  </div>
                </form>
              )}

              {/* Action Plans Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Action Item</th>
                      <th className="py-2.5 px-3">Assignee</th>
                      <th className="py-2.5 px-3">Target Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actionPlans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No CAPA action items assigned yet.
                        </td>
                      </tr>
                    ) : (
                      actionPlans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {plan.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{plan.title}</div>
                            {plan.description && <div className="text-[11px] text-slate-500">{plan.description}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{plan.assignedTo}</td>
                          <td className="py-2.5 px-3 text-slate-600">{plan.targetDate}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                plan.status === 'Completed' || plan.status === 'Verified'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : plan.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {plan.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {plan.status !== 'Verified' && (
                              <div className="inline-flex items-center space-x-1.5 justify-end">
                                <select
                                  value={plan.status}
                                  onChange={(e) => handleActionStatusChange(plan.id, e.target.value as any)}
                                  className="py-1 px-1.5 text-[10px] font-semibold rounded border border-slate-300 bg-white text-slate-800"
                                >
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Pending">Pending</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleActionStatusChange(
                                      plan.id,
                                      plan.status === 'Completed' ? 'In Progress' : 'Completed'
                                    )
                                  }
                                  className={`px-2 py-1 text-[10px] font-bold rounded transition ${
                                    plan.status === 'Completed'
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  {plan.status === 'Completed' ? 'Set In Progress' : 'Mark Completed'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: COMMUNICATION LOG */}
          {detailActiveTab === 'communication' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Communication &amp; HR Memo Log</h4>
                  <p className="text-xs text-slate-500">Official correspondence, legal advice, and internal case notes</p>
                </div>
              </div>

              {/* Compose New Memo/Note */}
              <form onSubmit={handleSaveComm} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newComm.type}
                    onChange={(e) => setNewComm({ ...newComm, type: e.target.value as any })}
                    className="px-2.5 py-1.5 border border-slate-200 rounded text-xs bg-slate-50"
                  >
                    <option value="Internal Note">Internal Note</option>
                    <option value="Employee Correspondence">Employee Correspondence</option>
                    <option value="Formal HR Memo">Formal HR Memo</option>
                    <option value="Legal Consultation">Legal Consultation</option>
                    <option value="Meeting Summary">Meeting Summary</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Subject *"
                    required
                    value={newComm.subject}
                    onChange={(e) => setNewComm({ ...newComm, subject: e.target.value })}
                    className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Recipient / Stakeholders"
                    value={newComm.recipient}
                    onChange={(e) => setNewComm({ ...newComm, recipient: e.target.value })}
                    className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  />
                </div>
                <textarea
                  placeholder="Memo contents or meeting notes..."
                  required
                  rows={2}
                  value={newComm.content}
                  onChange={(e) => setNewComm({ ...newComm, content: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newComm.isConfidential}
                      onChange={(e) => setNewComm({ ...newComm, isConfidential: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Mark as strictly confidential</span>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Log Message</span>
                  </button>
                </div>
              </form>

              {/* Log Timeline */}
              <div className="space-y-3">
                {communications.length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                    No communication records recorded for this case.
                  </div>
                ) : (
                  communications.map((comm) => (
                    <div key={comm.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{comm.subject}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {comm.type}
                          </span>
                          {comm.isConfidential && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />
                              <span>Confidential</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{comm.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{comm.content}</p>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span>From: <strong>{comm.senderName}</strong> ({comm.senderRole})</span>
                        <span>Recipient: <strong>{comm.recipient}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: EVIDENCE VAULT */}
          {detailActiveTab === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Secured Evidence Repository</h4>
                  <p className="text-xs text-slate-500">Documents, audio logs, photos, and verified chain of custody</p>
                </div>
                {currentUser?.role !== 'department_pic' && (
                  <button
                    onClick={() => setShowAddEvidence(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Evidence Record</span>
                  </button>
                )}
              </div>

              {/* Add Evidence Form */}
              {showAddEvidence && (
                <form onSubmit={handleSaveEvidence} className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-blue-900">Unggah Bukti Baru (Foto / PDF)</span>
                    <button type="button" onClick={() => setShowAddEvidence(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* File Selector Dropzone */}
                  <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition text-center">
                    <input
                      type="file"
                      id="case-evidence-upload"
                      accept="image/*,application/pdf,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="case-evidence-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <Paperclip className="w-6 h-6 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">
                        {selectedFile ? selectedFile.name : 'Pilih Berkas Foto atau PDF dari Komputer / HP'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {selectedFile
                          ? `Ukuran: ${selectedFile.size} • Format: ${selectedFile.type}`
                          : 'Format yang didukung: Foto (JPG, PNG, WebP) dan Dokumen PDF'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Judul / Keterangan Bukti *</label>
                      <input
                        type="text"
                        placeholder="Contoh: Foto Kerusakan Mesin / PDF Slip Gaji"
                        required
                        value={newEvidence.title}
                        onChange={(e) => setNewEvidence({ ...newEvidence, title: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Kategori Dokumen *</label>
                      <select
                        value={newEvidence.category}
                        onChange={(e) => setNewEvidence({ ...newEvidence, category: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
                      >
                        <option value="Photo">Foto (Dokumentasi Lapangan)</option>
                        <option value="Document">Dokumen (PDF / Surat)</option>
                        <option value="Email/Chat Screenshot">Screenshot Chat / Email</option>
                        <option value="Witness Written Statement">Pernyataan Tertulis Saksi</option>
                        <option value="CCTV/Video Log">Log Rekaman CCTV</option>
                        <option value="Audio Recording">Audio Recording</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Chain of Custody / Sumber Bukti</label>
                    <input
                      type="text"
                      placeholder="Contoh: Diserahkan pelapor, disimpan di brankas digital HR SJI"
                      value={newEvidence.chainOfCustody}
                      onChange={(e) => setNewEvidence({ ...newEvidence, chainOfCustody: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <label className="flex items-center space-x-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={newEvidence.isConfidential}
                        onChange={(e) => setNewEvidence({ ...newEvidence, isConfidential: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Tandai Sangat Rahasia (Hanya HR &amp; Manajemen)</span>
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddEvidence(false);
                          setSelectedFile(null);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                      >
                        Simpan Bukti
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Evidence Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {evidenceList.length === 0 ? (
                  <div className="sm:col-span-2 bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                    Belum ada berkas bukti (Foto / PDF) yang diunggah untuk kasus ini.
                  </div>
                ) : (
                  evidenceList.map((evi) => {
                    const isPdf =
                      evi.fileType?.includes('pdf') ||
                      evi.fileName.toLowerCase().endsWith('.pdf') ||
                      evi.category === 'Document';
                    const isImage =
                      evi.fileType?.startsWith('image') ||
                      evi.fileData?.startsWith('data:image') ||
                      evi.category === 'Photo' ||
                      evi.fileName.match(/\.(jpeg|jpg|png|webp|gif)$/i);

                    return (
                      <div key={evi.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{evi.title}</span>
                              <span className="text-[11px] text-slate-500 font-mono">{evi.fileName} ({evi.fileSize})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {evi.category}
                            </span>
                          </div>

                          {/* Image or PDF Preview area */}
                          {isImage && evi.fileData ? (
                            <div
                              onClick={() => setPreviewEvidence(evi)}
                              className="relative cursor-pointer group rounded-lg overflow-hidden border border-slate-200 h-32 bg-slate-100 flex items-center justify-center"
                            >
                              <img
                                src={evi.fileData}
                                alt={evi.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold space-x-1">
                                <Eye className="w-4 h-4" />
                                <span>Lihat Foto Penuh</span>
                              </div>
                            </div>
                          ) : isPdf ? (
                            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg flex items-center space-x-3">
                              <div className="p-2 bg-rose-100 rounded text-rose-700 font-bold text-xs uppercase">
                                PDF
                              </div>
                              <div className="flex-1 truncate">
                                <span className="font-semibold text-xs text-rose-950 block truncate">
                                  Dokumen PDF Terverifikasi
                                </span>
                                <span className="text-[10px] text-rose-700">Tersimpan dalam vault bukti</span>
                              </div>
                              {evi.fileData && (
                                <a
                                  href={evi.fileData}
                                  download={evi.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded bg-white hover:bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold transition flex items-center space-x-1"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Unduh</span>
                                </a>
                              )}
                            </div>
                          ) : null}

                          {evi.isConfidential && (
                            <div className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <Lock className="w-2.5 h-2.5 mr-1" />
                              <span>Sangat Rahasia • Masked dari PIC</span>
                            </div>
                          )}

                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-normal">
                            <strong>Chain of Custody:</strong> {evi.chainOfCustody}
                          </p>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                          <span>Diunggah: {evi.uploadedBy}</span>
                          <span>{evi.uploadedAt}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Case Ticket ID: <span className="font-mono font-bold text-slate-800">{selectedCase.ticketId}</span> • Last Updated: {selectedCase.lastUpdate}
          </div>
          <button
            onClick={() => setIsDetailModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Close Workspace
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Kasus Salah Input (Detail Workspace) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Perhatian:</span> Kasus {selectedCase.ticketId} akan dihapus secara permanen dari database. Tindakan ini akan dicatat ke dalam <strong>Audit Trail</strong> dengan nama Anda.
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Nomor Tiket:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedCase.ticketId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Pelapor:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedCase.isAnonymous ? (selectedCase.anonymousAlias || 'Anonim') : selectedCase.employeeName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Departemen:</span>
                  <span className="text-slate-700">{selectedCase.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Kategori:</span>
                  <span className="text-slate-700 font-medium">{selectedCase.complaintCategory}</span>
                </div>
              </div>

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
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCase}
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

      {/* Preview Modal for Photo / PDF Evidence */}
      {previewEvidence && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <div>
                  <h4 className="font-bold text-xs">{previewEvidence.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{previewEvidence.fileName} ({previewEvidence.fileSize})</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {previewEvidence.fileData && (
                  <a
                    href={previewEvidence.fileData}
                    download={previewEvidence.fileName}
                    className="inline-flex items-center space-x-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Berkas</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewEvidence(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
              {previewEvidence.fileData?.startsWith('data:image') || previewEvidence.category === 'Photo' ? (
                <img
                  src={previewEvidence.fileData}
                  alt={previewEvidence.title}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-xs max-w-md">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 font-bold text-sm">
                    PDF
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{previewEvidence.fileName}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Dokumen telah tersimpan aman dengan integritas rantai bukti (chain of custody).
                  </p>
                  {previewEvidence.fileData && (
                    <a
                      href={previewEvidence.fileData}
                      download={previewEvidence.fileName}
                      className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Buka / Unduh Dokumen PDF</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
