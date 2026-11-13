import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import {
  evaluateCaseSla,
  calculateSlaCompliance,
  getSlaWorkdays,
  SJI_COMPANY_HOLIDAYS,
  sanitizeForFirestore,
  logAuditAction,
  formatRoleName,
} from '../services/db';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  AutomationConfig,
  AutomationLogItem,
  AutomationEventType,
  AuditLog,
} from '../types';
import {
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Activity,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
  Save,
  AlertCircle,
} from 'lucide-react';

const LOCAL_CONFIG_KEY = 'sji_hr_v5_firestore_automation_config';
const LOCAL_LOGS_KEY = 'sji_hr_v5_firestore_automation_logs';

const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  id: 'automation_config',
  isEnabled: true,
  slaReminderHoursBeforeDue: 48,
  checkIntervalMinutes: 30,
  notifyOnNewCase: true,
  notifyOnPicChange: true,
  notifyOnStatusChange: true,
  notifyOnCritical: true,
  notifyOnOverdue: true,
  notifyOnActionPlanDue: true,
  notifyOnApproval: true,
  companyHolidays: [...SJI_COMPANY_HOLIDAYS],
  escalationRecipients: ['HR Lead / Manager', 'HR Administrator'],
  updatedAt: new Date().toISOString().substring(0, 10),
};

function mapAuditActionToEventType(action: string): AutomationEventType {
  const upper = (action || '').toUpperCase();
  if (upper.includes('REGISTER')) return 'NEW_GRIEVANCE';
  if (upper.includes('OVERDUE')) return 'SLA_OVERDUE';
  if (upper.includes('REMINDER') || upper.includes('SLA_SCAN')) return 'SLA_REMINDER';
  if (upper.includes('CRITICAL')) return 'CRITICAL_ESCALATION';
  if (upper.includes('CLOSED')) return 'CASE_CLOSED';
  if (upper.includes('PIC')) return 'PIC_ASSIGNED';
  if (upper.includes('APPROVAL')) return 'APPROVAL_REQUESTED';
  return 'STATUS_CHANGED';
}

export const AutomationLogView: React.FC = () => {
  const { cases, openCaseDetail } = useCases();
  const { currentUser, canManageUsers } = useAuth();

  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'config'>('monitor');
  const [monitorFilter, setMonitorFilter] = useState<'all_active' | 'overdue' | 'approaching' | 'critical' | 'incomplete'>('all_active');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [config, setConfig] = useState<AutomationConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_CONFIG_KEY);
      return saved ? { ...DEFAULT_AUTOMATION_CONFIG, ...JSON.parse(saved) } : DEFAULT_AUTOMATION_CONFIG;
    } catch {
      return DEFAULT_AUTOMATION_CONFIG;
    }
  });

  const [automationLogs, setAutomationLogs] = useState<AutomationLogItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_LOGS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newHoliday, setNewHoliday] = useState('');

  // Load automation config & audit logs from Firestore
  const loadEngineData = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const cfgSnap = await getDoc(doc(db, 'master_data', 'automation_config'));
      if (cfgSnap.exists()) {
        const data = cfgSnap.data() as Partial<AutomationConfig>;
        const merged = { ...DEFAULT_AUTOMATION_CONFIG, ...data };
        setConfig(merged);
        localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(merged));
      }
    } catch (err) {
      console.warn('Automation config fetch fallback:', err);
    }

    try {
      const auditSnap = await getDocs(collection(db, 'audit_logs'));
      const fetchedLogs: AutomationLogItem[] = [];
      auditSnap.forEach((docSnap) => {
        const raw = docSnap.data() as AuditLog;
        fetchedLogs.push({
          id: docSnap.id,
          automationId: raw.action || 'SYSTEM_AUDIT',
          eventType: mapAuditActionToEventType(raw.action),
          ticketId: raw.ticketId,
          caseId: raw.caseId,
          recipient: raw.userName || 'System',
          recipientId: raw.userId,
          triggerDate: raw.timestamp || '',
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: `${docSnap.id}`,
          details: raw.details,
          createdAt: raw.timestamp || '',
        });
      });

      // Merge any locally recorded SLA scan logs without duplicating IDs
      const localStored: AutomationLogItem[] = (() => {
        try {
          const raw = localStorage.getItem(LOCAL_LOGS_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();

      const mergedMap = new Map<string, AutomationLogItem>();
      [...fetchedLogs, ...localStored].forEach((item) => {
        mergedMap.set(item.id, item);
      });

      const sorted = Array.from(mergedMap.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setAutomationLogs(sorted.slice(0, 150));
    } catch (err) {
      console.warn('Audit logs fetch notice:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadEngineData();
  }, [loadEngineData]);

  // SLA evaluation across all cases
  const slaSummary = useMemo(() => calculateSlaCompliance(cases), [cases]);

  const evaluatedActiveCases = useMemo(() => {
    return cases
      .filter((c) => c.status !== 'Closed')
      .map((c) => ({
        caseItem: c,
        evalResult: evaluateCaseSla(c),
        targetWorkdays: getSlaWorkdays(c.priority),
      }))
      .sort((a, b) => {
        const rank = (item: typeof a) => {
          if (item.evalResult.isOverdue) return 4;
          if (item.caseItem.priority === 'Critical') return 3;
          if (item.caseItem.slaStatus === 'Approaching Due') return 2;
          if (item.evalResult.isDataIncomplete) return 1;
          return 0;
        };
        return rank(b) - rank(a);
      });
  }, [cases]);

  const counts = useMemo(() => {
    const overdue = evaluatedActiveCases.filter((i) => i.evalResult.isOverdue).length;
    const approaching = evaluatedActiveCases.filter(
      (i) => !i.evalResult.isOverdue && (i.caseItem.slaStatus === 'Approaching Due' || (i.evalResult.isPending && i.evalResult.hoursLeft <= config.slaReminderHoursBeforeDue))
    ).length;
    const critical = evaluatedActiveCases.filter((i) => i.caseItem.priority === 'Critical').length;
    const incomplete = evaluatedActiveCases.filter((i) => i.evalResult.isDataIncomplete).length;
    return {
      allActive: evaluatedActiveCases.length,
      overdue,
      approaching,
      critical,
      incomplete,
    };
  }, [evaluatedActiveCases, config.slaReminderHoursBeforeDue]);

  const filteredMonitorCases = useMemo(() => {
    return evaluatedActiveCases.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const match =
          item.caseItem.ticketId.toLowerCase().includes(q) ||
          item.caseItem.department.toLowerCase().includes(q) ||
          item.caseItem.complaintCategory.toLowerCase().includes(q) ||
          (item.caseItem.assignedPic || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      if (monitorFilter === 'overdue') return item.evalResult.isOverdue;
      if (monitorFilter === 'approaching') {
        return (
          !item.evalResult.isOverdue &&
          (item.caseItem.slaStatus === 'Approaching Due' ||
            (item.evalResult.isPending && item.evalResult.hoursLeft <= config.slaReminderHoursBeforeDue))
        );
      }
      if (monitorFilter === 'critical') return item.caseItem.priority === 'Critical';
      if (monitorFilter === 'incomplete') return item.evalResult.isDataIncomplete;
      return true;
    });
  }, [evaluatedActiveCases, monitorFilter, searchQuery, config.slaReminderHoursBeforeDue]);

  const filteredLogs = useMemo(() => {
    return automationLogs.filter((log) => {
      if (logFilter !== 'all' && log.eventType !== logFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        return (
          (log.ticketId || '').toLowerCase().includes(q) ||
          (log.recipient || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q) ||
          (log.eventType || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [automationLogs, logFilter, searchQuery]);

  // Run an active SLA & Escalation scan across active cases
  const handleRunSlaScan = async () => {
    if (!currentUser) return;
    setIsScanning(true);
    setFeedback(null);
    try {
      const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newLogs: AutomationLogItem[] = [];

      evaluatedActiveCases.forEach(({ caseItem, evalResult }) => {
        if (evalResult.isOverdue && config.notifyOnOverdue) {
          newLogs.push({
            id: `sla-scan-od-${caseItem.id}-${Date.now()}`,
            automationId: 'SLA_OVERDUE_WATCHER',
            eventType: 'SLA_OVERDUE',
            ticketId: caseItem.ticketId,
            caseId: caseItem.id,
            recipient: caseItem.assignedPic || 'HR Lead / Manager',
            triggerDate: nowStamp,
            executionStatus: 'Success',
            deliveryStatus: 'Delivered',
            idempotencyKey: `od-${caseItem.ticketId}-${nowStamp.substring(0, 10)}`,
            details: `Kasus #${caseItem.ticketId} (${caseItem.department} · ${caseItem.priority}) melewati Due Date (${caseItem.dueDate}).`,
            createdAt: nowStamp,
          });
        } else if (
          evalResult.isPending &&
          evalResult.hoursLeft <= config.slaReminderHoursBeforeDue
        ) {
          newLogs.push({
            id: `sla-scan-rem-${caseItem.id}-${Date.now()}`,
            automationId: 'SLA_REMINDER_WATCHER',
            eventType: 'SLA_REMINDER',
            ticketId: caseItem.ticketId,
            caseId: caseItem.id,
            recipient: caseItem.assignedPic || 'HR Investigator',
            triggerDate: nowStamp,
            executionStatus: 'Success',
            deliveryStatus: 'Delivered',
            idempotencyKey: `rem-${caseItem.ticketId}-${nowStamp.substring(0, 10)}`,
            details: `Pengingat SLA #${caseItem.ticketId}: tersisa ${evalResult.hoursLeft} jam menuju Due Date (${caseItem.dueDate}).`,
            createdAt: nowStamp,
          });
        }
      });

      if (newLogs.length === 0) {
        newLogs.push({
          id: `sla-scan-ok-${Date.now()}`,
          automationId: 'SLA_HEALTH_CHECK',
          eventType: 'SLA_REMINDER',
          recipient: currentUser.displayName,
          triggerDate: nowStamp,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: `ok-${nowStamp}`,
          details: `Pemindaian SLA selesai (${evaluatedActiveCases.length} kasus aktif). Tidak ada keterlambatan baru.`,
          createdAt: nowStamp,
        });
      }

      const combined = [...newLogs, ...automationLogs].slice(0, 150);
      setAutomationLogs(combined);
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(combined.slice(0, 50)));

      await logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: formatRoleName(currentUser.role),
        action: 'SLA_SCAN_EXECUTED',
        details: `Menjalankan pemindaian SLA Engine manual: ${counts.overdue} overdue, ${counts.approaching} approaching due, compliance ${slaSummary.complianceRate}%.`,
      });

      setFeedback({
        type: 'success',
        message: `Pemindaian SLA selesai: ${counts.overdue} kasus overdue dan ${counts.approaching} kasus approaching due terverifikasi.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal menjalankan pemindaian SLA.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Persist Automation Config to Firestore master_data/automation_config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingConfig(true);
    setFeedback(null);

    const updatedConfig: AutomationConfig = {
      ...config,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedBy: currentUser.displayName,
    };

    try {
      const path = 'master_data/automation_config';
      try {
        await setDoc(doc(db, 'master_data', 'automation_config'), sanitizeForFirestore(updatedConfig));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }

      setConfig(updatedConfig);
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(updatedConfig));

      await logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: formatRoleName(currentUser.role),
        action: 'UPDATE_AUTOMATION_CONFIG',
        details: `Memperbarui konfigurasi SLA & Automation Engine (Status: ${updatedConfig.isEnabled ? 'Aktif' : 'Dijeda'}, Reminder: ${updatedConfig.slaReminderHoursBeforeDue} jam sebelum Due Date).`,
      });

      setFeedback({
        type: 'success',
        message: 'Konfigurasi Automation & SLA Engine berhasil disimpan ke Cloud Firestore.',
      });
    } catch (err: any) {
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(updatedConfig));
      setFeedback({
        type: 'error',
        message: `Gagal menyimpan ke Firestore: ${err?.message || 'Periksa koneksi atau izin akses.'}`,
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddHoliday = () => {
    const trimmed = newHoliday.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return;
    if (config.companyHolidays.includes(trimmed)) return;
    setConfig((prev) => ({
      ...prev,
      companyHolidays: [...prev.companyHolidays, trimmed].sort(),
    }));
    setNewHoliday('');
  };

  const handleRemoveHoliday = (dateStr: string) => {
    setConfig((prev) => ({
      ...prev,
      companyHolidays: prev.companyHolidays.filter((d) => d !== dateStr),
    }));
  };

  if (!canManageUsers) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Akses Terbatas</h2>
        <p className="text-xs text-slate-500 mt-1">
          Modul Automation &amp; SLA Engine hanya tersedia untuk HR Administrator dan HR Lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Automation &amp; SLA Engine
              </h1>
              <p className="text-xs text-slate-500">
                Pemantauan antrean SLA real-time, audit pemicu notifikasi, dan konfigurasi aturan hari kerja SJI.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadEngineData}
            disabled={isLoadingLogs}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>

          <button
            type="button"
            onClick={handleRunSlaScan}
            disabled={isScanning}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Memindai...' : 'Run SLA Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-3.5 flex items-center justify-between text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800 font-semibold px-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Engine Status</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {config.isEnabled ? 'Active' : 'Paused'}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Reminder {config.slaReminderHoursBeforeDue}h
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            SLA Workdays: Minor 3 · Major 7 · Critical 14
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">SLA Compliance Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {slaSummary.complianceRate}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {slaSummary.onTime} On Time / {slaSummary.evaluableCount} Eval
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {slaSummary.pending} Pending · {slaSummary.dataIncomplete} Incomplete
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Overdue Active Watch</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono tabular-nums ${counts.overdue > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {counts.overdue}
            </span>
            <span className="text-xs text-amber-700 font-semibold font-mono tabular-nums">
              {counts.approaching} Approaching
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Kasus aktif melewati atau mendekati Due Date
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Critical 72h Triage</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {counts.critical}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {automationLogs.length} Audit Events
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Prioritas Critical aktif yang dipantau ketat
          </p>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-lg text-xs font-semibold self-start">
            <button
              type="button"
              onClick={() => setActiveTab('monitor')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'monitor'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SLA Monitor Queue ({counts.allActive})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'logs'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Execution &amp; Audit Logs ({automationLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                activeTab === 'config'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Engine Configuration</span>
            </button>
          </div>

          {activeTab !== 'config' && (
            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Ticket ID, PIC, atau keterangan..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* TAB 1: SLA MONITOR QUEUE */}
        {activeTab === 'monitor' && (
          <div>
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1 mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter:
              </span>
              {[
                { id: 'all_active', label: `All Active (${counts.allActive})` },
                { id: 'overdue', label: `Overdue (${counts.overdue})` },
                { id: 'approaching', label: `Approaching Due (${counts.approaching})` },
                { id: 'critical', label: `Critical (${counts.critical})` },
                { id: 'incomplete', label: `Incomplete Due Date (${counts.incomplete})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMonitorFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    monitorFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Department &amp; Category</th>
                    <th className="py-3 px-4">Priority / SLA</th>
                    <th className="py-3 px-4">Grievance Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Assigned PIC</th>
                    <th className="py-3 px-4">Evaluasi SLA</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMonitorCases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Tidak ada kasus aktif yang cocok dengan filter pemantauan saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredMonitorCases.map(({ caseItem, evalResult, targetWorkdays }) => (
                      <tr key={caseItem.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {caseItem.ticketId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{caseItem.department}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {caseItem.complaintCategory}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{caseItem.priority}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="font-mono tabular-nums text-slate-600">{targetWorkdays}h kerja</span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {caseItem.dateReceived || '-'}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-800 font-medium whitespace-nowrap">
                          {caseItem.dueDate || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {caseItem.assignedPic || '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {evalResult.isOverdue ? (
                            <span className="font-bold text-rose-700">
                              Overdue
                            </span>
                          ) : evalResult.isDataIncomplete ? (
                            <span className="font-medium text-slate-500">
                              Data Incomplete
                            </span>
                          ) : evalResult.hoursLeft <= config.slaReminderHoursBeforeDue ? (
                            <span className="font-semibold text-amber-700 font-mono tabular-nums">
                              Approaching ({evalResult.hoursLeft}h)
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-700 font-mono tabular-nums">
                              Pending ({evalResult.hoursLeft}h)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openCaseDetail(caseItem, 'overview')}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold border border-slate-200 transition"
                          >
                            <span>Open Case</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTION & AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div>
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium mr-1">Event Type:</span>
              {[
                { id: 'all', label: 'Semua Event' },
                { id: 'NEW_GRIEVANCE', label: 'New Grievance' },
                { id: 'STATUS_CHANGED', label: 'Case / Config Update' },
                { id: 'SLA_REMINDER', label: 'SLA Scan & Reminder' },
                { id: 'SLA_OVERDUE', label: 'SLA Overdue' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLogFilter(t.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    logFilter === t.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Actor / Recipient</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        {isLoadingLogs
                          ? 'Memuat catatan eksekusi sistem...'
                          : 'Belum ada riwayat log eksekusi yang sesuai.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {log.triggerDate || '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                          {log.eventType}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {log.ticketId || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {log.recipient}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-emerald-700">
                            {log.executionStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-md">
                          {log.details || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ENGINE CONFIGURATION */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="p-6 space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* General Engine Rules */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Pengaturan Pemantauan SLA</h3>

                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">Aktifkan Automation &amp; SLA Engine</span>
                    <span className="text-[11px] text-slate-500">
                      Menjalankan evaluasi SLA otomatis dan pencatatan notifikasi kasus.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.isEnabled}
                    onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Batas Pengingat SLA (Jam Sebelum Due)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={config.slaReminderHoursBeforeDue}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          slaReminderHoursBeforeDue: Math.max(1, parseInt(e.target.value, 10) || 48),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Interval Sinkronisasi (Menit)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={config.checkIntervalMinutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          checkIntervalMinutes: Math.max(5, parseInt(e.target.value, 10) || 30),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                </div>

                {/* Trigger Toggles */}
                <div className="space-y-2 pt-2">
                  <span className="font-bold text-slate-800 block">Pemicu Notifikasi Event</span>
                  {[
                    { key: 'notifyOnNewCase', label: 'Pendaftaran Grievance Baru' },
                    { key: 'notifyOnPicChange', label: 'Penugasan / Perubahan PIC Departemen' },
                    { key: 'notifyOnStatusChange', label: 'Perubahan Tahap Status Kasus' },
                    { key: 'notifyOnCritical', label: 'Eskalasi Kasus Critical (Triage 72 Jam)' },
                    { key: 'notifyOnOverdue', label: 'Peringatan Kasus Melewati Due Date (Overdue)' },
                    { key: 'notifyOnActionPlanDue', label: 'Pengingat Jatuh Tempo CAPA' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center space-x-2.5 py-1.5 text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean((config as any)[item.key])}
                        onChange={(e) =>
                          setConfig({ ...config, [item.key]: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 rounded border-slate-300"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Holiday Calendar */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Kalender Hari Libur Perusahaan</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tanggal non-kerja berikut dilewati otomatis pada kalkulasi SLA hari kerja (Minor 3 · Major 7 · Critical 14).
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={newHoliday}
                    onChange={(e) => setNewHoliday(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddHoliday}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                  >
                    Tambah Tanggal
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                  {config.companyHolidays.map((dateStr) => (
                    <div
                      key={dateStr}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-800"
                    >
                      <span>{dateStr}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(dateStr)}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-2"
                        title="Hapus tanggal libur"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Terakhir diperbarui: <strong className="font-mono text-slate-700">{config.updatedAt}</strong>
                {config.updatedBy ? ` oleh ${config.updatedBy}` : ''}
              </span>
              <button
                type="submit"
                disabled={isSavingConfig}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? 'Menyimpan...' : 'Simpan Konfigurasi Engine'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
