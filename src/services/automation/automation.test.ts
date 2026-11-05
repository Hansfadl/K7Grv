import test from 'node:test';
import assert from 'node:assert/strict';
import { ReminderService } from './ReminderService';
import { AutomationLogService } from './AutomationLogService';
import { NotificationService } from './NotificationService';
import { GrievanceCase, UserProfile, ActionPlan, NotificationItem } from '../../types';

test('ReminderService.getHoursRemaining calculates positive hours for future date', () => {
  const futureDate = '2099-12-31';
  const hours = ReminderService.getHoursRemaining(futureDate);
  assert.ok(hours > 1000, 'Future date should have large remaining hours');
});

test('ReminderService.isDatePast correctly detects past dates', () => {
  const pastDate = '2020-01-01';
  assert.equal(ReminderService.isDatePast(pastDate), true, 'Past date must evaluate to true');

  const futureDate = '2099-01-01';
  assert.equal(ReminderService.isDatePast(futureDate), false, 'Future date must evaluate to false');
});

test('AutomationLogService.isDuplicate detects duplicate idempotency keys', () => {
  const uniqueKey = `test-key-${Date.now()}`;
  assert.equal(AutomationLogService.isDuplicate(uniqueKey), false, 'Initial key must not be duplicate');

  // Record key into local cache simulation
  AutomationLogService.recordLog({
    eventType: 'NEW_GRIEVANCE',
    ticketId: 'TEST-001',
    recipient: 'HR Admin',
    executionStatus: 'Success',
    deliveryStatus: 'Delivered',
    idempotencyKey: uniqueKey,
  });

  assert.equal(AutomationLogService.isDuplicate(uniqueKey), true, 'Key must be recognized as duplicate on second call');
});

test('NotificationService.filterForUser respects user roles and department boundaries', () => {
  const hrUser: UserProfile = {
    id: 'user-hr-admin',
    displayName: 'Admin User',
    email: 'admin@sji.co.id',
    role: 'hr_admin',
    department: 'HR',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const picUser: UserProfile = {
    id: 'user-pic-sewing',
    displayName: 'PIC Sewing',
    email: 'pic.sewing@sji.co.id',
    role: 'department_pic',
    department: 'Sewing',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const notifs: NotificationItem[] = [
    {
      id: 'n1',
      recipientId: 'user-hr-admin',
      category: 'New Grievance',
      title: 'Notif for Admin',
      message: 'Hello Admin',
      isRead: false,
      createdAt: '2026-01-01',
      priority: 'medium',
    },
    {
      id: 'n2',
      recipientId: 'role:all_hr',
      roleTarget: 'all_hr',
      category: 'SLA Reminder',
      title: 'Broadcast for HR',
      message: 'Attention HR',
      isRead: false,
      createdAt: '2026-01-01',
      priority: 'high',
    },
    {
      id: 'n3',
      recipientId: 'role:department_pic',
      departmentTarget: 'Sewing',
      category: 'New PIC Assignment',
      title: 'For Sewing PIC',
      message: 'Assigned to Sewing',
      isRead: false,
      createdAt: '2026-01-01',
      priority: 'high',
    },
    {
      id: 'n4',
      recipientId: 'role:department_pic',
      departmentTarget: 'Finishing',
      category: 'New PIC Assignment',
      title: 'For Finishing PIC',
      message: 'Assigned to Finishing',
      isRead: false,
      createdAt: '2026-01-01',
      priority: 'medium',
    },
  ];

  // HR should see n1 and n2 (broadcast), not n3 or n4
  const hrFiltered = NotificationService.filterForUser(notifs, hrUser);
  assert.equal(hrFiltered.some((n) => n.id === 'n1'), true);
  assert.equal(hrFiltered.some((n) => n.id === 'n2'), true);
  assert.equal(hrFiltered.some((n) => n.id === 'n3'), false);
  assert.equal(hrFiltered.some((n) => n.id === 'n4'), false);

  // Sewing PIC should see n3, but NOT n1, n2, or n4
  const picFiltered = NotificationService.filterForUser(notifs, picUser);
  assert.equal(picFiltered.some((n) => n.id === 'n3'), true);
  assert.equal(picFiltered.some((n) => n.id === 'n1'), false);
  assert.equal(picFiltered.some((n) => n.id === 'n2'), false);
  assert.equal(picFiltered.some((n) => n.id === 'n4'), false);
});

test('ReminderService.checkCaseSla excludes closed cases from reminders and overdue alerts', async () => {
  const closedCase: GrievanceCase = {
    id: 'case-closed-test',
    ticketId: 'GRV-CLOSED-01',
    dateReceived: '2026-01-01',
    employeeName: 'John',
    isAnonymous: false,
    department: 'HR',
    complaintCategory: 'Kebijakan',
    priority: 'Critical',
    status: 'Closed',
    assignedPic: 'PIC',
    assignedPicId: 'usr-pic',
    progress: 100,
    dueDate: '2026-01-04',
    closingDate: '2026-01-03',
    slaStatus: 'Met',
    slaHoursLeft: 0,
    lastUpdate: '2026-01-03',
    description: 'Resolved complaint',
    channelReceived: 'Online',
  };

  const config = {
    id: 'test',
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
    companyHolidays: [],
    escalationRecipients: [],
    updatedAt: '',
  };

  const result = await ReminderService.checkCaseSla(closedCase, config);
  assert.equal(result.actionTaken, false, 'Closed case must NEVER trigger overdue alert');
  assert.equal(result.type, 'ON_TRACK');
});

test('ReminderService.checkActionPlanReminders ignores Completed items', async () => {
  const completedPlan: ActionPlan = {
    id: 'plan-comp-1',
    caseId: 'c1',
    ticketId: 'GRV-001',
    description: 'Install safety guard',
    responsiblePic: 'PIC Prod',
    targetDate: '2020-01-01', // expired date
    actionTaken: 'Installed',
    progressStatus: 'Completed',
    createdAt: '2020-01-01',
  };

  const actionTaken = await ReminderService.checkActionPlanReminders(completedPlan);
  assert.equal(actionTaken, false, 'Completed action plan must not trigger reminder even if past targetDate');
  setTimeout(() => process.exit(0), 200);
});

