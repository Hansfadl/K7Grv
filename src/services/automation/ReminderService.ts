import { GrievanceCase, ActionPlan, AutomationConfig } from '../../types';
import { NotificationService } from './NotificationService';
import { AutomationLogService } from './AutomationLogService';

export interface SlaCheckResult {
  ticketId: string;
  type: 'REMINDER_DUE_SOON' | 'OVERDUE' | 'CRITICAL_URGENT' | 'ON_TRACK';
  hoursRemaining: number;
  dueDate: string;
  actionTaken: boolean;
  notifiedRecipient?: string;
}

export class ReminderService {
  /**
   * Evaluates hours left until due date in Asia/Jakarta timezone
   */
  static getHoursRemaining(dueDateStr: string): number {
    try {
      const now = new Date();
      const due = new Date(`${dueDateStr}T23:59:59+07:00`); // Asia/Jakarta end of day
      const diffMs = due.getTime() - now.getTime();
      return Math.round(diffMs / (1000 * 60 * 60));
    } catch {
      return 999;
    }
  }

  /**
   * Check if date is passed in Asia/Jakarta
   */
  static isDatePast(dateStr: string): boolean {
    try {
      const now = new Date();
      // Get current date string in Asia/Jakarta format YYYY-MM-DD
      const jakartaDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      return dateStr < jakartaDate;
    } catch {
      return false;
    }
  }

  /**
   * Processes SLA reminders and overdue warnings for all active cases
   */
  static async checkCaseSla(
    c: GrievanceCase,
    config: AutomationConfig
  ): Promise<SlaCheckResult> {
    // RULE: Closed cases NEVER receive reminders or overdue alerts
    if (c.status === 'Closed') {
      return {
        ticketId: c.ticketId,
        type: 'ON_TRACK',
        hoursRemaining: 0,
        dueDate: c.dueDate,
        actionTaken: false,
      };
    }

    const hoursLeft = this.getHoursRemaining(c.dueDate);
    const isPastDue = this.isDatePast(c.dueDate) || hoursLeft < 0;
    const reminderThreshold = config.slaReminderHoursBeforeDue || 48;

    // 1. OVERDUE ALERT
    if (isPastDue) {
      // Deduplicate: Send at most once per 24 hours per ticket
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const dedupKey = `overdue-${c.ticketId}-${c.dueDate}-${todayKey}`;

      if (!AutomationLogService.isDuplicate(dedupKey, 20 * 3600000)) {
        // Send Overdue notification to HR Admin and PIC
        await NotificationService.sendNotification({
          recipientId: c.assignedPicId || 'role:hr_admin',
          roleTarget: 'all_hr',
          departmentTarget: c.department,
          ticketId: c.ticketId,
          caseId: c.id,
          category: 'Overdue Alert',
          title: `PERINGATAN OVERDUE: Kasus #${c.ticketId} Melewati Batas Waktu`,
          message: `Kasus pengaduan ${c.complaintCategory} di departemen ${c.department} telah melewati target selesai (${c.dueDate}). Segera tuntaskan tindakan CAPA dan perbarui status kasus.`,
          priority: 'urgent',
          targetTab: 'overview',
        });

        await AutomationLogService.recordLog({
          eventType: 'SLA_OVERDUE',
          ticketId: c.ticketId,
          caseId: c.id,
          recipient: `PIC (${c.assignedPic}) & HR Admins`,
          recipientId: c.assignedPicId,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `Kasus #${c.ticketId} melewati deadline (${c.dueDate}). Overdue alert dikirimkan ke PIC dan HR tim.`,
        });

        return {
          ticketId: c.ticketId,
          type: 'OVERDUE',
          hoursRemaining: hoursLeft,
          dueDate: c.dueDate,
          actionTaken: true,
          notifiedRecipient: c.assignedPic,
        };
      }

      return {
        ticketId: c.ticketId,
        type: 'OVERDUE',
        hoursRemaining: hoursLeft,
        dueDate: c.dueDate,
        actionTaken: false,
      };
    }

    // 2. SLA REMINDER (Approaching Due Date within threshold)
    if (hoursLeft <= reminderThreshold && hoursLeft > 0) {
      // Deduplicate: 1 reminder per dueDate cycle
      const dedupKey = `sla-reminder-${c.ticketId}-${c.dueDate}`;

      if (!AutomationLogService.isDuplicate(dedupKey, 48 * 3600000)) {
        await NotificationService.sendNotification({
          recipientId: c.assignedPicId || 'role:hr_admin',
          roleTarget: 'all_hr',
          departmentTarget: c.department,
          ticketId: c.ticketId,
          caseId: c.id,
          category: 'SLA Reminder',
          title: `Pengingat SLA: Kasus #${c.ticketId} Mendekati Batas Waktu`,
          message: `Kasus pengaduan ${c.complaintCategory} (${c.department}) memiliki sisa waktu ~${hoursLeft} jam hingga target selesai (${c.dueDate}). Mohon pastikan rencana perbaikan sedang berjalan.`,
          priority: hoursLeft <= 24 ? 'high' : 'medium',
          targetTab: 'action_plan',
        });

        await AutomationLogService.recordLog({
          eventType: 'SLA_REMINDER',
          ticketId: c.ticketId,
          caseId: c.id,
          recipient: `PIC (${c.assignedPic})`,
          recipientId: c.assignedPicId,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `Pengingat SLA dikirim untuk #${c.ticketId}. Sisa waktu ~${hoursLeft} jam sampai ${c.dueDate}.`,
        });

        return {
          ticketId: c.ticketId,
          type: 'REMINDER_DUE_SOON',
          hoursRemaining: hoursLeft,
          dueDate: c.dueDate,
          actionTaken: true,
          notifiedRecipient: c.assignedPic,
        };
      }
    }

    return {
      ticketId: c.ticketId,
      type: 'ON_TRACK',
      hoursRemaining: hoursLeft,
      dueDate: c.dueDate,
      actionTaken: false,
    };
  }

  /**
   * Check Action Plan items for missing details or approaching/passed targetDate
   */
  static async checkActionPlanReminders(
    plan: ActionPlan,
    associatedCase?: GrievanceCase
  ): Promise<boolean> {
    // If completed, no reminder needed
    if (plan.progressStatus === 'Completed' || plan.status === 'Completed') {
      return false;
    }

    if (!plan.targetDate) return false;

    const isPastDue = this.isDatePast(plan.targetDate);
    const hoursLeft = this.getHoursRemaining(plan.targetDate);

    // Overdue CAPA Alert
    if (isPastDue) {
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const dedupKey = `capa-overdue-${plan.id}-${plan.targetDate}-${todayKey}`;

      if (!AutomationLogService.isDuplicate(dedupKey, 20 * 3600000)) {
        await NotificationService.sendNotification({
          recipientId: plan.responsiblePic || 'role:department_pic',
          departmentTarget: associatedCase?.department,
          ticketId: plan.ticketId,
          caseId: plan.caseId,
          category: 'Action Plan Reminder',
          title: `CAPA OVERDUE: Target Perbaikan #${plan.ticketId} Terlewati`,
          message: `Rencana tindakan "${plan.description.substring(0, 80)}..." melewati target (${plan.targetDate}). PIC bertanggung jawab: ${plan.responsiblePic}. Segera mutakhirkan progress tindakan.`,
          priority: 'urgent',
          targetTab: 'action_plan',
        });

        await AutomationLogService.recordLog({
          eventType: 'ACTION_PLAN_OVERDUE',
          ticketId: plan.ticketId,
          caseId: plan.caseId,
          recipient: `PIC ${plan.responsiblePic}`,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `CAPA untuk #${plan.ticketId} melewati targetDate ${plan.targetDate}. Status saat ini: ${plan.progressStatus}.`,
        });

        return true;
      }
    }

    // Approaching due date (within 48 hours)
    if (hoursLeft <= 48 && hoursLeft > 0) {
      const dedupKey = `capa-due-soon-${plan.id}-${plan.targetDate}`;

      if (!AutomationLogService.isDuplicate(dedupKey, 48 * 3600000)) {
        await NotificationService.sendNotification({
          recipientId: plan.responsiblePic || 'role:department_pic',
          departmentTarget: associatedCase?.department,
          ticketId: plan.ticketId,
          caseId: plan.caseId,
          category: 'Action Plan Reminder',
          title: `Pengingat Target CAPA: Kasus #${plan.ticketId}`,
          message: `Rencana tindakan "${plan.description.substring(0, 80)}..." jatuh tempo pada ${plan.targetDate} (~${hoursLeft} jam lagi). PIC: ${plan.responsiblePic}.`,
          priority: 'medium',
          targetTab: 'action_plan',
        });

        await AutomationLogService.recordLog({
          eventType: 'ACTION_PLAN_REMINDER',
          ticketId: plan.ticketId,
          caseId: plan.caseId,
          recipient: `PIC ${plan.responsiblePic}`,
          executionStatus: 'Success',
          deliveryStatus: 'Delivered',
          idempotencyKey: dedupKey,
          details: `Pengingat target CAPA #${plan.ticketId} dikirim ke ${plan.responsiblePic}.`,
        });

        return true;
      }
    }

    return false;
  }
}
