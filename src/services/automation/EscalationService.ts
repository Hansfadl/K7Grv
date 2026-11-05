import { GrievanceCase, UserProfile } from '../../types';
import { NotificationService } from './NotificationService';
import { AutomationLogService } from './AutomationLogService';

export class EscalationService {
  /**
   * Immediate escalation when a case is marked or updated to 'Critical'
   */
  static async escalateCriticalCase(
    c: GrievanceCase,
    actor?: UserProfile,
    reason?: string
  ): Promise<boolean> {
    const dedupKey = `critical-escalation-${c.ticketId}-${c.lastUpdate || Date.now()}`;

    if (AutomationLogService.isDuplicate(dedupKey, 600000)) {
      return false; // Skip duplicate trigger within 10 minutes
    }

    // 1. Notify HR Admin and HR Lead
    await NotificationService.sendNotification({
      recipientId: 'role:hr_lead',
      roleTarget: 'hr_lead',
      ticketId: c.ticketId,
      caseId: c.id,
      category: 'Critical Case Alert',
      title: `ESKALASI KRITIS (SLA 72 Jam): Kasus #${c.ticketId}`,
      message: `Keluhan berstatus KRITIS pada Departemen ${c.department} (${c.complaintCategory}). Batas penyelesaian mandatori 72 jam: ${c.dueDate}. ${reason ? `Catatan: ${reason}` : ''}`,
      priority: 'urgent',
      targetTab: 'overview',
      metadata: { priority: 'Critical', actor: actor?.displayName },
    });

    // Also notify HR Admin
    await NotificationService.sendNotification({
      recipientId: 'role:hr_admin',
      roleTarget: 'hr_admin',
      ticketId: c.ticketId,
      caseId: c.id,
      category: 'Critical Case Alert',
      title: `ESKALASI KRITIS: Kasus #${c.ticketId} - Dept ${c.department}`,
      message: `Tingkat urgensi CRITICAL memerlukan penanganan langsung & koordinasi investigasi segera. Target: ${c.dueDate}.`,
      priority: 'urgent',
      targetTab: 'overview',
    });

    // 2. Notify assigned PIC if set
    if (c.assignedPicId) {
      await NotificationService.sendNotification({
        recipientId: c.assignedPicId,
        departmentTarget: c.department,
        ticketId: c.ticketId,
        caseId: c.id,
        category: 'Critical Case Alert',
        title: `PERHATIAN KHUSUS: Kasus #${c.ticketId} Ditetapkan sebagai KRITIS`,
        message: `Kasus di departemen Anda ditetapkan dalam status prioritas KRITIS. Mohon lakukan respons koordinasi segera bersama HR.`,
        priority: 'urgent',
        targetTab: 'action_plan',
      });
    }

    // 3. Log Escalation
    await AutomationLogService.recordLog({
      eventType: 'CRITICAL_ESCALATION',
      ticketId: c.ticketId,
      caseId: c.id,
      recipient: `HR Lead, HR Admin, & PIC (${c.assignedPic || 'Unassigned'})`,
      recipientId: c.assignedPicId,
      executionStatus: 'Success',
      deliveryStatus: 'Delivered',
      idempotencyKey: dedupKey,
      details: `Eskalasi darurat kasus Kritis #${c.ticketId} (${c.department} - ${c.complaintCategory}). SLA 72 jam target: ${c.dueDate}. Dipicu oleh: ${actor?.displayName || 'Sistem'}. ${reason ? `Alasan: ${reason}` : ''}`,
    });

    return true;
  }
}
