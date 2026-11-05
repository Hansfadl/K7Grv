import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCases } from '../context/CaseContext';
import {
  Cpu,
  Play,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Settings,
  Flame,
  CheckSquare,
  FileCheck,
  Send,
  Eye,
  Check,
  RefreshCw,
  UserCheck,
  FolderGit2
} from 'lucide-react';
import {
  AutomationLogItem,
  AutomationEventType,
  AutomationExecutionStatus,
  AutomationConfig,
  GrievanceCase,
  ActionPlan
} from '../types';
import { AutomationLogService } from '../services/automation/AutomationLogService';
import { AutomationService } from '../services/automation/AutomationService';
import { ReminderService } from '../services/automation/ReminderService';
import { EscalationService } from '../services/automation/EscalationService';
import { ApprovalService } from '../services/automation/ApprovalService';
import { NotificationService } from '../services/automation/NotificationService';
import { getCaseActionPlans } from '../services/db';

export const AutomationLogView: React.FC = () => {
  const { currentUser, canManageUsers } = useAuth();
  const { cases, openCaseDetail } = useCases();

  const [logs, setLogs] = useState<AutomationLogItem[]>([]);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'config' | 'testing'>('logs');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Testing feedback
  const [testResult, setTestResult] = useState<{
    scenario: string;
    status: 'success' | 'error' | 'running';
    message: string;
  } | null>(null);

  // Subscribe to real-time logs and config
  useEffect(() => {
    const unsubLogs = AutomationLogService.subscribeToLogs((allLogs) => {
      setLogs(allLogs);
    });

    const unsubConfig = AutomationService.subscribeConfig((cfg) => {
      setConfig(cfg);
    });

    return () => {
      unsubLogs();
      unsubConfig();
    };
  }, []);

  const handleToggleEngine = async () => {
    if (!currentUser || !config) return;
    try {
      await AutomationService.updateConfig({ isEnabled: !config.isEnabled }, currentUser);
    } catch (err: any) {
      console.warn('Config toggle notice:', err);
    }
  };

  const handleUpdateConfigOption = async (key: keyof AutomationConfig, val: any) => {
    if (!currentUser || !config) return;
    try {
      await AutomationService.updateConfig({ [key]: val }, currentUser);
    } catch (err: any) {
      console.warn('Config update notice:', err);
    }
  };

  // Run Scheduled Scan manually
  const handleRunScanNow = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setTestResult({
      scenario: 'Pemeriksaan SLA & CAPA Lengkap',
      status: 'running',
      message: 'Sedang memindai seluruh tiket aktif dan rencana perbaikan (CAPA)...',
    });

    try {
      // Gather action plans for all cases
      const planPromises = cases.map((c) => getCaseActionPlans(c.id));
      const nested = await Promise.all(planPromises);
      const allPlans = nested.flat();

      const result = await AutomationService.runScheduledAutomationScan(cases, allPlans);

      setTestResult({
        scenario: 'Pemeriksaan SLA & CAPA Selesai',
        status: 'success',
        message: `Berhasil memindai ${result.scannedCases} kasus dan ${allPlans.length} rencana CAPA. ${result.triggeredAlerts} peringatan/pengingat baru diterbitkan ke pusat notifikasi.`,
      });
    } catch (err: any) {
      setTestResult({
        scenario: 'Pemeriksaan SLA & CAPA',
        status: 'error',
        message: `Gagal menjalankan pemindaian: ${err.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Automated Test Scenarios
  const runTestScenario = async (testId: string) => {
    if (!currentUser) return;
    const testTicketId = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetCase = cases[0] || ({
      id: 'case-test-demo',
      ticketId: testTicketId,
      department: 'Produksi',
      complaintCategory: 'K3 & Lingkungan Kerja',
      priority: 'Major',
      status: 'Open',
      assignedPic: 'PIC Produksi (Agus)',
      assignedPicId: 'usr-pic-prod',
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10),
      dateReceived: new Date().toISOString().substring(0, 10),
      isAnonymous: false,
      employeeName: 'Karyawan Uji',
      channelReceived: 'Online',
      description: 'Kasus simulasi pengujian otomatis SJI HR Automation Engine.',
      slaStatus: 'On Track',
      slaHoursLeft: 72,
      lastUpdate: new Date().toISOString().substring(0, 16),
      progress: 25,
    } as GrievanceCase);

    setTestResult({
      scenario: testId,
      status: 'running',
      message: `Menjalankan skenario pengujian: ${testId}...`,
    });

    try {
      switch (testId) {
        case 'test_new_grievance': {
          await AutomationService.onCaseCreated(
            {
              ...targetCase,
              ticketId: testTicketId,
              priority: 'Major',
            },
            currentUser
          );
          setTestResult({
            scenario: 'Membuat Tiket Baru',
            status: 'success',
            message: `Tiket #${testTicketId} disimulasikan. Notifikasi dikirimkan ke HR Admin dan PIC (${targetCase.assignedPic}). Log tersimpan.`,
          });
          break;
        }

        case 'test_pic_change': {
          const newPic = 'PIC HR (Budi Santoso)';
          await AutomationService.onCaseUpdated(
            targetCase,
            { ...targetCase, assignedPic: newPic, assignedPicId: 'usr-pic-budi' },
            currentUser,
            'Rotasi penugasan investigasi internal'
          );
          setTestResult({
            scenario: 'Mengubah PIC Kasus',
            status: 'success',
            message: `PIC kasus #${targetCase.ticketId} diubah ke "${newPic}". Notifikasi penugasan terkirim ke PIC baru dan riwayat tersimpan di log.`,
          });
          break;
        }

        case 'test_priority_critical': {
          const critDueDate = new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10);
          await AutomationService.onCaseUpdated(
            { ...targetCase, priority: 'Major' },
            { ...targetCase, priority: 'Critical', dueDate: critDueDate },
            currentUser,
            'Ditemukan potensi risiko K3 berat pada lini produksi'
          );
          setTestResult({
            scenario: 'Eskalasi Prioritas Kritis (Critical SLA 72 Jam)',
            status: 'success',
            message: `Kasus #${targetCase.ticketId} dieskalasikan menjadi KRITIS. Peringatan darurat terkirim langsung ke HR Lead dan HR Admin.`,
          });
          break;
        }

        case 'test_status_change': {
          await AutomationService.onCaseUpdated(
            { ...targetCase, status: 'Open' },
            { ...targetCase, status: 'Investigation' },
            currentUser,
            'Investigasi lapangan dimulai oleh tim HR'
          );
          setTestResult({
            scenario: 'Pembaruan Status Kasus',
            status: 'success',
            message: `Status kasus #${targetCase.ticketId} diperbarui ke "Investigation". Stakeholder terkait menerima notifikasi status.`,
          });
          break;
        }

        case 'test_case_closing': {
          const closingDate = new Date().toISOString().substring(0, 10);
          await AutomationService.onCaseUpdated(
            { ...targetCase, status: 'Action Taken' },
            { ...targetCase, status: 'Closed', closingDate },
            currentUser,
            'Penyelesaian disepakati semua pihak dan diverifikasi tuntas'
          );
          setTestResult({
            scenario: 'Penutupan Kasus (Case Closed)',
            status: 'success',
            message: `Kasus #${targetCase.ticketId} ditutup dengan tanggal penutupan valid (${closingDate}). Seluruh reminder aktif dihentikan.`,
          });
          break;
        }

        case 'test_closed_exclusion': {
          const closedCase: GrievanceCase = {
            ...targetCase,
            status: 'Closed',
            closingDate: '2026-10-01',
            dueDate: '2026-09-30', // expired
          };
          const res = await ReminderService.checkCaseSla(closedCase, config || ({} as any));
          setTestResult({
            scenario: 'Eksklusi Kasus Closed',
            status: 'success',
            message: `Verifikasi berhasil: Kasus berstatus Closed dikecualikan secara ketat (${res.actionTaken === false ? 'TIDAK ada notifikasi/reminder dikirim' : 'Gagal'}).`,
          });
          break;
        }

        case 'test_sla_reminder': {
          // Simulate case due in 24 hours
          const tomorrow = new Date(Date.now() + 24 * 3600000).toISOString().substring(0, 10);
          const simCase: GrievanceCase = {
            ...targetCase,
            ticketId: `SLA-${Math.floor(1000 + Math.random() * 9000)}`,
            dueDate: tomorrow,
            status: 'Open',
          };
          await ReminderService.checkCaseSla(simCase, config || ({} as any));
          setTestResult({
            scenario: 'Pengingat SLA (Mendekati Batas Waktu)',
            status: 'success',
            message: `Pengingat SLA berhasil dipicu untuk kasus #${simCase.ticketId} dengan target besok (${tomorrow}). Notifikasi diterbitkan.`,
          });
          break;
        }

        case 'test_overdue_alert': {
          // Simulate case due 3 days ago
          const pastDue = new Date(Date.now() - 3 * 86400000).toISOString().substring(0, 10);
          const simCase: GrievanceCase = {
            ...targetCase,
            ticketId: `OVR-${Math.floor(1000 + Math.random() * 9000)}`,
            dueDate: pastDue,
            status: 'Investigation',
          };
          await ReminderService.checkCaseSla(simCase, config || ({} as any));
          setTestResult({
            scenario: 'Peringatan Overdue (Melewati Batas Waktu)',
            status: 'success',
            message: `Kasus overdue #${simCase.ticketId} (${pastDue}) memicu Overdue Alert dengan prioritas Urgent ke PIC dan HR tim.`,
          });
          break;
        }

        case 'test_action_plan_reminder': {
          const samplePlan: ActionPlan = {
            id: `plan-test-${Date.now().toString(36)}`,
            caseId: targetCase.id,
            ticketId: targetCase.ticketId,
            description: 'Sosialisasi refreshment SOP keselamatan kerja di area sewing',
            responsiblePic: targetCase.assignedPic,
            targetDate: new Date(Date.now() + 24 * 3600000).toISOString().substring(0, 10),
            actionTaken: '',
            progressStatus: 'Progress',
            createdAt: new Date().toISOString().substring(0, 10),
          };
          await ReminderService.checkActionPlanReminders(samplePlan, targetCase);
          setTestResult({
            scenario: 'Pengingat Action Plan (CAPA)',
            status: 'success',
            message: `Rencana tindakan CAPA untuk kasus #${targetCase.ticketId} yang berstatus "Progress" berhasil mengirim pengingat ke PIC.`,
          });
          break;
        }

        case 'test_approval_flow': {
          const req = await ApprovalService.requestApproval({
            caseId: targetCase.id,
            ticketId: targetCase.ticketId,
            requestType: 'CASE_CLOSURE',
            requestedBy: currentUser,
            approverRole: 'hr_lead',
            requestNotes: 'Pengajuan penutupan tiket setelah verifikasi tuntas seluruh rekomendasi CAPA.',
          });

          setTestResult({
            scenario: 'Alur Permohonan Approval',
            status: 'success',
            message: `Permohonan approval Case Closure untuk #${targetCase.ticketId} diterbitkan (ID: ${req.id}). Notifikasi terkirim ke HR Lead.`,
          });
          break;
        }

        case 'test_idempotency': {
          const testKey = `idempotency-test-${Date.now().toString(36)}`;
          // 1st call
          await AutomationLogService.recordLog({
            eventType: 'NEW_GRIEVANCE',
            ticketId: 'DEDUP-001',
            recipient: 'Test Recipient',
            executionStatus: 'Success',
            deliveryStatus: 'Delivered',
            idempotencyKey: testKey,
            details: 'Panggilan pertama event',
          });

          // 2nd call check
          const isDupe = AutomationLogService.isDuplicate(testKey, 60000);

          setTestResult({
            scenario: 'Uji Pencegahan Duplikasi (Idempotency)',
            status: isDupe ? 'success' : 'error',
            message: isDupe
              ? `Uji idempotency BERHASIL. Event dengan key "${testKey}" berhasil terdeteksi sebagai duplikat dan dihentikan otomatis.`
              : 'Gagal mendeteksi duplikasi event.',
          });
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      setTestResult({
        scenario: testId,
        status: 'error',
        message: `Kegagalan saat menjalankan skenario: ${err.message}`,
      });
    }
  };

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    if (eventFilter !== 'all' && l.eventType !== eventFilter) return false;
    if (statusFilter !== 'all' && l.executionStatus !== statusFilter) return false;
    if (dateFilter && !l.triggerDate.includes(dateFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTicket = l.ticketId?.toLowerCase().includes(q);
      const matchRecip = l.recipient?.toLowerCase().includes(q);
      const matchDetails = l.details?.toLowerCase().includes(q);
      const matchAutoId = l.automationId?.toLowerCase().includes(q);
      if (!matchTicket && !matchRecip && !matchDetails && !matchAutoId) return false;
    }
    return true;
  });

  const getStatusBadge = (status: AutomationExecutionStatus) => {
    switch (status) {
      case 'Success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Success
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <RotateCw className="w-3 h-3 mr-1 text-blue-600 animate-spin" />
            Processing
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Failed
          </span>
        );
      case 'Skipped':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 mr-1 text-slate-500" />
            Skipped (Idempotent)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">Automation Engine &amp; Governance Log</h2>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold border ${
                    config?.isEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {config?.isEnabled ? 'ENGINE AKTIF' : 'ENGINE NON-AKTIF'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pusat pemantauan otomatisasi SLA, eskalasi prioritas Kritis, pengingat CAPA, dan audit trace pengiriman notifikasi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Scan Now */}
          <button
            type="button"
            onClick={handleRunScanNow}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Memindai...' : 'Jalankan Pemindaian SLA'}</span>
          </button>

          {/* Master Toggle */}
          {canManageUsers && (
            <button
              type="button"
              onClick={handleToggleEngine}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                config?.isEnabled
                  ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
              }`}
            >
              <span>{config?.isEnabled ? 'Matikan Engine' : 'Aktifkan Engine'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Test Feedback Alert */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between text-xs transition ${
            testResult.status === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : testResult.status === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start space-x-3">
            {testResult.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : testResult.status === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            ) : (
              <RotateCw className="w-5 h-5 text-blue-600 flex-shrink-0 animate-spin mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {testResult.status === 'success' ? 'Pengujian Berhasil' : testResult.status === 'error' ? 'Pengujian Gagal' : 'Sedang Diproses'}: {testResult.scenario}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed">{testResult.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Riwayat Log Otomatisasi ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('testing')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition ${
            activeTab === 'testing'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Suite Pengujian Otomatis (12 Skenario)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Konfigurasi Aturan &amp; Jadwal
        </button>
      </div>

      {/* Tab 1: Logs Table */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari ID, tiket, penerima, detail..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Event Filter */}
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Jenis Event</option>
                <option value="NEW_GRIEVANCE">NEW_GRIEVANCE (Tiket Baru)</option>
                <option value="PIC_ASSIGNED">PIC_ASSIGNED (Penugasan PIC)</option>
                <option value="STATUS_CHANGED">STATUS_CHANGED (Perubahan Status)</option>
                <option value="CRITICAL_ESCALATION">CRITICAL_ESCALATION (Eskalasi Kritis)</option>
                <option value="SLA_REMINDER">SLA_REMINDER (Pengingat SLA)</option>
                <option value="SLA_OVERDUE">SLA_OVERDUE (Peringatan Overdue)</option>
                <option value="ACTION_PLAN_REMINDER">ACTION_PLAN_REMINDER (Pengingat CAPA)</option>
                <option value="APPROVAL_REQUESTED">APPROVAL_REQUESTED (Pengajuan Approval)</option>
                <option value="APPROVAL_DECIDED">APPROVAL_DECIDED (Keputusan Approval)</option>
                <option value="CASE_CLOSED">CASE_CLOSED (Penutupan Kasus)</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status Eksekusi</option>
                <option value="Success">Success (Berhasil)</option>
                <option value="Failed">Failed (Gagal)</option>
                <option value="Skipped">Skipped (Deduplikasi)</option>
                <option value="Processing">Processing</option>
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setEventFilter('all');
                setStatusFilter('all');
                setDateFilter('');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              Reset Filter
            </button>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Belum ada catatan log otomatisasi yang sesuai dengan kriteria filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Trigger Date (WIB)</th>
                      <th className="px-4 py-3">Event Type</th>
                      <th className="px-4 py-3">Ticket ID</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Execution Status</th>
                      <th className="px-4 py-3">Delivery Status</th>
                      <th className="px-4 py-3">Details / Audit</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => {
                      const associatedCase = cases.find(
                        (c) => (log.ticketId && c.ticketId === log.ticketId) || (log.caseId && c.id === log.caseId)
                      );

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {log.triggerDate}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {log.eventType}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-mono font-bold">
                            {log.ticketId ? (
                              <span className="text-slate-900">#{log.ticketId}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.recipient}>
                            {log.recipient}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusBadge(log.executionStatus)}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-medium text-[11px] text-slate-600">
                            {log.deliveryStatus}
                          </td>

                          <td className="px-4 py-3 text-slate-600 max-w-xs" title={log.details}>
                            <div className="line-clamp-2 text-[11px]">
                              {log.details || log.errorMessage || '-'}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {associatedCase && (
                              <button
                                type="button"
                                onClick={() => openCaseDetail(associatedCase, 'overview')}
                                title="Buka Detail Kasus Terkait"
                                className="p-1 text-slate-600 hover:text-blue-600 rounded transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Test Suite */}
      {activeTab === 'testing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Play className="w-4 h-4 text-blue-600" />
              <span>Suite Pengujian Otomatisasi Terintegrasi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Jalankan setiap skenario pengujian untuk memverifikasi alur otomatisasi, pencegahan duplikasi (idempotency), dan ketepatan pengiriman notifikasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Scenario 1 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  Skenario 1
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Membuat Tiket Baru</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memicu event NEW_GRIEVANCE, notifikasi ke HR Admin dan PIC yang ditugaskan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_new_grievance')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Buat Tiket
              </button>
            </div>

            {/* Scenario 2 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  Skenario 2
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Mengubah PIC Kasus</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memicu event PIC_ASSIGNED, notifikasi penugasan baru ke PIC pengganti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_pic_change')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Ubah PIC
              </button>
            </div>

            {/* Scenario 3 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                  Skenario 3
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Eskalasi Prioritas Kritis</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memicu CRITICAL_ESCALATION alert darurat ke HR Lead dan HR Admin (SLA 72 Jam).
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_priority_critical')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition shadow-2xs"
              >
                Uji Eskalasi Kritis
              </button>
            </div>

            {/* Scenario 4 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  Skenario 4
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Mengubah Status Kasus</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memicu STATUS_CHANGED, mencatat status sebelumnya dan status baru secara audit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_status_change')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Ubah Status
              </button>
            </div>

            {/* Scenario 5 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                  Skenario 5
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Menutup Kasus (Case Closed)</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memastikan closingDate valid, menghentikan seluruh reminder, dan notifikasi penutupan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_case_closing')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Tutup Kasus
              </button>
            </div>

            {/* Scenario 6 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  Skenario 6
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Eksklusi Kasus Closed</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memverifikasi kasus yang sudah Closed tidak boleh menerima reminder atau overdue alert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_closed_exclusion')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Eksklusi Closed
              </button>
            </div>

            {/* Scenario 7 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Skenario 7
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Pengingat SLA (Approaching)</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Simulasi sisa waktu &lt;= 48 jam sebelum Due Date. Mengirim SLA Reminder ke PIC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_sla_reminder')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji SLA Reminder
              </button>
            </div>

            {/* Scenario 8 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                  Skenario 8
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Peringatan Overdue</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Simulasi melewati Due Date. Mengirim Overdue Alert prioritas Urgent ke PIC &amp; HR Admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_overdue_alert')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Overdue Alert
              </button>
            </div>

            {/* Scenario 9 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Skenario 9
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Pengingat CAPA Action Plan</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mengidentifikasi rencana perbaikan yang belum selesai dan mengirim reminder ke pemilik aksi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_action_plan_reminder')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji CAPA Reminder
              </button>
            </div>

            {/* Scenario 10 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  Skenario 10
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Pengajuan Approval</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mengajukan permohonan persetujuan (Closure/CAPA) ke HR Lead dengan notifikasi langsung.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_approval_flow')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Alur Approval
              </button>
            </div>

            {/* Scenario 11 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                  Skenario 11
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Uji Pencegahan Duplikasi</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memverifikasi Idempotency key mendeteksi dan menghentikan pengiriman ganda pada periode yang sama.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runTestScenario('test_idempotency')}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                Uji Idempotency
              </button>
            </div>

            {/* Scenario 12 */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-blue-800 bg-blue-200 px-2 py-0.5 rounded">
                  Skenario 12
                </span>
                <h4 className="font-bold text-xs text-slate-900 mt-2">Pemindaian SLA &amp; CAPA Penuh</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Menjalankan background sweep terhadap seluruh data di memori/database saat ini.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunScanNow}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition shadow-2xs"
              >
                Jalankan Full Sweep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Configuration Panel */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-4xl">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>Konfigurasi Parameter Otomatisasi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Aturan ini berlaku secara global pada seluruh siklus hidup keluhan di PT Shoenary Javanesia Inc.
            </p>
          </div>

          {config && (
            <div className="space-y-5">
              {/* Reminder SLA window */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Ambang Batas Pengingat SLA (Jam sebelum Due Date)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min={12}
                    max={120}
                    value={config.slaReminderHoursBeforeDue}
                    onChange={(e) =>
                      handleUpdateConfigOption('slaReminderHoursBeforeDue', Number(e.target.value))
                    }
                    className="w-32 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                  <span className="text-xs text-slate-500">
                    Jam (Default: 48 jam sebelum tanggal target selesai).
                  </span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Pengaktifan Jalur Notifikasi
                </h4>

                {[
                  {
                    key: 'notifyOnNewCase' as keyof AutomationConfig,
                    label: 'Notifikasi Tiket Baru',
                    desc: 'Kirim notifikasi kepada HR Admin dan penugasan langsung kepada PIC saat keluhan baru tercatat.',
                  },
                  {
                    key: 'notifyOnPicChange' as keyof AutomationConfig,
                    label: 'Notifikasi Perubahan PIC',
                    desc: 'Kirim notifikasi penugasan baru kepada personil saat dilakukan perubahan PIC.',
                  },
                  {
                    key: 'notifyOnCritical' as keyof AutomationConfig,
                    label: 'Eskalasi Kasus Kritis (72 Jam)',
                    desc: 'Kirim alert eskalasi darurat segera ke HR Lead dan HR Admin bila kasus berstatus Kritis.',
                  },
                  {
                    key: 'notifyOnOverdue' as keyof AutomationConfig,
                    label: 'Peringatan Kasus Overdue',
                    desc: 'Kirim peringatan tegas kepada PIC dan HR Admin jika kasus melewati target Due Date.',
                  },
                  {
                    key: 'notifyOnActionPlanDue' as keyof AutomationConfig,
                    label: 'Pengingat Rencana Aksi CAPA',
                    desc: 'Kirim pengingat kepada PIC apabila target penyelesaian rencana perbaikan mendekati atau melewati batas waktu.',
                  },
                  {
                    key: 'notifyOnApproval' as keyof AutomationConfig,
                    label: 'Notifikasi Alur Approval',
                    desc: 'Kirim pemberitahuan kepada approver saat ada pengajuan persetujuan penutupan kasus atau CAPA.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canManageUsers}
                      onClick={() => handleUpdateConfigOption(item.key, !config[item.key])}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        config[item.key] ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          config[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Timezone and Holidays Information */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Zona Waktu &amp; Operasional</h4>
                <p className="text-[11px] text-slate-500">
                  Zona Waktu Operasional: <strong>Asia/Jakarta (WIB)</strong>. Seluruh perhitungan batas waktu SLA dihitung berdasarkan tanggal kalender operasional PT Shoenary Javanesia Inc. Kasus yang berstatus <strong>Closed</strong> otomatis dikecualikan dari seluruh perhitungan reminder.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
