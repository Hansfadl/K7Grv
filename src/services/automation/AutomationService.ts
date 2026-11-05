import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  GrievanceCase,
  ActionPlan,
  AutomationConfig,
  UserProfile,
  CaseStatus,
  PriorityLevel
} from '../../types';
import { NotificationService } from './NotificationService';
import { AutomationLogService } from './AutomationLogService';
import { EscalationService } from './EscalationService';
import { ReminderService } from './ReminderService';

const DEFAULT_CONFIG: AutomationConfig = {
  id: 'global_settings',
  isEnabled: true,
  slaReminderHoursBeforeDue: 48,
  checkIntervalMinutes: 5,
  notifyOnNewCase: true,
  notifyOnPicChange: true,
  notifyOnStatusChange: true,
  notifyOnCritical: true,
  notifyOnOverdue: true,
  notifyOnActionPlanDue: true,
  notifyOnApproval: true,
  companyHolidays: [
    '2026-01-01', // Tahun Baru
    '2026-03-21', // Hari Raya Idul Fitri
    '2026-05-01', // Hari Buruh Internasional
    '2026-08-17', // Hari Kemerdekaan RI
    '2026-12-25', // Hari Raya Natal
  ],
  escalationRecipients: ['hr_lead', 'hr_admin'],
  updatedAt: new Date().toISOString(),
};

const CONFIG_STORAGE_KEY = 'sji_automation_config_cache';
let inMemoryConfigFallback: AutomationConfig = DEFAULT_CONFIG;

function getLocalConfig(): AutomationConfig {
  if (typeof localStorage === 'undefined') return inMemoryConfigFallback;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function setLocalConfig(cfg: AutomationConfig) {
  inMemoryConfigFallback = cfg;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn('Config local save error:', err);
  }
}

export class AutomationService {
  /**
   * Fetch current automation configuration
   */
  static async getConfig(): Promise<AutomationConfig> {
    try {
      const snap = await getDoc(doc(db, 'automation_config', 'global_settings'));
      if (snap.exists()) {
        const data = snap.data() as AutomationConfig;
        setLocalConfig(data);
        return data;
      }
      // Initialize default in Firestore if not exists
      await setDoc(doc(db, 'automation_config', 'global_settings'), DEFAULT_CONFIG);
      setLocalConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    } catch {
      return getLocalConfig();
    }
  }

  /**
   * Update automation configuration (Admin only)
   */
  static async updateConfig(updates: Partial<AutomationConfig>, user: UserProfile): Promise<AutomationConfig> {
    const current = await this.getConfig();
    const updated: AutomationConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: user.displayName,
    };

    setLocalConfig(updated);
    try {
      await setDoc(doc(db, 'automation_config', 'global_settings'), updated);
    } catch (err: any) {
      console.warn('Firestore updateConfig notice:', err.message);
    }

    await AutomationLogService.recordLog({
      eventType: 'STATUS_CHANGED',
      recipient: 'System Engine',
      executionStatus: 'Success',
      deliveryStatus: 'Delivered',
      idempotencyKey: `cfg-update-${Date.now()}`,
      details: `Konfigurasi Automation Engine diperbarui oleh ${user.displayName}. Engine Enabled: ${updated.isEnabled}.`,
    });

    return updated;
  }

  /**
   * Subscribe in real-time to configuration changes
   */
  static subscribeConfig(callback: (cfg: AutomationConfig) => void) {
    try {
      return onSnapshot(
        doc(db, 'automation_config', 'global_settings'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AutomationConfig;
            setLocalConfig(data);
            callback(data);
          } else {
            callback(getLocalConfig());
          }
        },
        () => {
          callback(getLocalConfig());
        }
      );
    } catch {
      callback(getLocalConfig());
      return () => {};
    }
  }

  // ==========================================
  // EVENT TRIGGER HANDLERS
  // ==========================================

  /**
   * Trigger A: New Grievance Created
   */
  static async onCaseCreated(newCase: GrievanceCase, actor: UserProfile): Promise<void> {
    const config = getLocalConfig();
    if (!config.isEnabled || !config.notifyOnNewCase) {
      return;
    }

    const dedupKey = `new-case-${newCase.ticketId}-${newCase.id}`;
    if (AutomationLogService.isDuplicate(dedupKey, 600000)) {
      return;
    }

    // 1. Notify HR Admin and HR Lead
    await NotificationService.sendNotification({
      recipientId: 'role:hr_admin',
      roleTarget: 'all_hr',
      ticketId: newCase.ticketId,
      caseId: newCase.id,
      category: 'New Grievance',
      title: `Pengaduan Baru Terdaftar: #${newCase.ticketId}`,
      message: `Keluhan baru kategori "${newCase.complaintCategory}" pada departemen ${newCase.department}. Prioritas: ${newCase.priority} (SLA: ${newCase.dueDate}).`,
      priority: newCase.priority === 'Critical' ? 'urgent' : newCase.priority === 'Major' ? 'high' : 'medium',
      targetTab: 'overview',
    });

    // 2. If PIC is already assigned, notify PIC
    if (newCase.assignedPicId || (newCase.assignedPic && newCase.assignedPic !== 'Unassigned')) {
      await NotificationService.sendNotification({
        recipientId: newCase.assignedPicId || 'role:department_pic',
        departmentTarget: newCase.department,
        ticketId: newCase.ticketId,
        caseId: newCase.id,
        category: 'New PIC Assignment',
        title: `Penugasan Keluhan Baru: #${newCase.ticketId}`,
        message: `Anda ditugaskan sebagai PIC untuk keluhan #${newCase.ticketId} di Departemen ${newCase.department}. Mohon tinjau uraian keluhan dan susun investigasi awal.`,
        priority: 'high',
        targetTab: 'overview',
      });
    }

    // 3. If Priority is Critical, trigger immediate escalation
    if (newCase.priority === 'Critical') {
      await EscalationService.escalateCriticalCase(newCase, actor, 'Kasus didaftarkan dengan prioritas Kritis');
    }

    // 4. Record Automation Log
    await AutomationLogService.recordLog({
      eventType: 'NEW_GRIEVANCE',
      ticketId: newCase.ticketId,
      caseId: newCase.id,
      recipient: `HR Admin, Lead & PIC (${newCase.assignedPic || 'Unassigned'})`,
      recipientId: newCase.assignedPicId,
      executionStatus: 'Success',
      deliveryStatus: 'Delivered',
      idempotencyKey: dedupKey,
      details: `Tiket baru #${newCase.ticketId} berhasil tersimpan. Notifikasi terkirim otomatis.`,
    });
  }

  /**
   * Trigger B & C & D & E: Case Updates (PIC, Status, Priority, Closing)
   */
  static async onCaseUpdated(
    oldCase: GrievanceCase | undefined,
    updatedCase: GrievanceCase,
    actor: UserProfile,
    reason?: string
  ): Promise<void> {
    const config = getLocalConfig();
    if (!config.isEnabled) return;

    // A. PIC Assignment Changed
    const isPicChanged = oldCase && oldCase.assignedPic !== updatedCase.assignedPic && updatedCase.assignedPic;
    if (isPicChanged && config.notifyOnPicChange) {
      const dedupKey = `pic-change-${updatedCase.ticketId}-${updatedCase.assignedPicId || updatedCase.assignedPic}`;
      if (!AutomationLogService.isDuplicate(dedupKey, 300000)) {
        await NotificationService.sendNotification({
          recipientId: updatedCase.assignedPicId || 'role:department_pic',
          departmentTarget: updatedCase.department,
          ticketId: updatedCase.ticketId,
          caseId: updatedCase.id,
          category: 'New PIC Assignment',
          title: `Penugasan PIC Kasus #${updatedCase.ticketId}`,
          message: `Anda telah ditugaskan sebagai PIC baru menggantikan ${oldCase?.assignedPic || 'PIC sebelumnya'} untuk kasus #${updatedCase.ticketId} (${updatedCase.department}).`,
          priority: 'high',
          targetTab: 'overview',
        });

        await AutomationLogService.recordLog({
          eventType: 'PIC_ASSIGNED',
          ticketId: updatedCase.ticketId,
          caseId: updatedCase.id,
          recipient: `PIC Baru (${updatedCase.assignedPic})`,
          recipientId: updatedCase.assignedPicId,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `Perubahan PIC dari "${oldCase?.assignedPic || '-'}" ke "${updatedCase.assignedPic}".`,
        });
      }
    }

    // B. Priority Changed to Critical
    const isPriorityCritical = updatedCase.priority === 'Critical' && (!oldCase || oldCase.priority !== 'Critical');
    if (isPriorityCritical && config.notifyOnCritical) {
      await EscalationService.escalateCriticalCase(
        updatedCase,
        actor,
        reason || `Prioritas diubah dari ${oldCase?.priority || 'Sebelumnya'} ke Critical`
      );
    }

    // C. Status Changed
    const isStatusChanged = oldCase && oldCase.status !== updatedCase.status;
    if (isStatusChanged && config.notifyOnStatusChange) {
      const dedupKey = `status-change-${updatedCase.ticketId}-${updatedCase.status}`;
      if (!AutomationLogService.isDuplicate(dedupKey, 300000)) {
        const isClosed = updatedCase.status === 'Closed';

        // Recipient routing based on role
        await NotificationService.sendNotification({
          recipientId: updatedCase.assignedPicId || 'role:hr_admin',
          roleTarget: 'all_hr',
          departmentTarget: updatedCase.department,
          ticketId: updatedCase.ticketId,
          caseId: updatedCase.id,
          category: isClosed ? 'Case Closed' : updatedCase.status === 'Action Taken' ? 'Case Resolved' : 'Investigation Update',
          title: isClosed
            ? `Kasus #${updatedCase.ticketId} DITUTUP (Closed)`
            : `Pembaruan Status Kasus #${updatedCase.ticketId}: ${updatedCase.status}`,
          message: isClosed
            ? `Kasus #${updatedCase.ticketId} telah resmi ditutup pada ${updatedCase.closingDate || 'hari ini'} oleh ${actor.displayName}. Seluruh SLA aktif dihentikan.`
            : `Status kasus #${updatedCase.ticketId} berubah dari "${oldCase?.status}" menjadi "${updatedCase.status}". ${reason ? `Alasan: ${reason}` : ''}`,
          priority: isClosed ? 'medium' : 'high',
          targetTab: isClosed ? 'overview' : updatedCase.status === 'Investigation' ? 'investigation' : 'action_plan',
        });

        await AutomationLogService.recordLog({
          eventType: isClosed ? 'CASE_CLOSED' : 'STATUS_CHANGED',
          ticketId: updatedCase.ticketId,
          caseId: updatedCase.id,
          recipient: `PIC (${updatedCase.assignedPic}) & HR Tim`,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `Status tiket diubah dari "${oldCase?.status}" ke "${updatedCase.status}". Aktor: ${actor.displayName}. ${reason ? `Catatan: ${reason}` : ''}`,
        });
      }
    }
  }

  /**
   * Periodic / On-demand Automation Scan (Checks SLA and Action Plans)
   */
  static async runScheduledAutomationScan(
    cases: GrievanceCase[],
    actionPlans?: ActionPlan[]
  ): Promise<{ scannedCases: number; triggeredAlerts: number }> {
    const config = await this.getConfig();
    if (!config.isEnabled) {
      return { scannedCases: 0, triggeredAlerts: 0 };
    }

    let triggeredAlerts = 0;

    // 1. Scan active cases for SLA approaching or overdue
    for (const c of cases) {
      if (c.status === 'Closed') continue; // Case exclusion
      const res = await ReminderService.checkCaseSla(c, config);
      if (res.actionTaken) {
        triggeredAlerts++;
      }
    }

    // 2. Scan action plans if provided
    if (actionPlans && actionPlans.length > 0) {
      for (const p of actionPlans) {
        const associatedCase = cases.find((c) => c.ticketId === p.ticketId || c.id === p.caseId);
        const actionTaken = await ReminderService.checkActionPlanReminders(p, associatedCase);
        if (actionTaken) {
          triggeredAlerts++;
        }
      }
    }

    return { scannedCases: cases.length, triggeredAlerts };
  }
}
