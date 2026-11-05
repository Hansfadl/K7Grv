import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { ApprovalRequest, ApprovalRequestStatus, UserProfile } from '../../types';
import { NotificationService } from './NotificationService';
import { AutomationLogService } from './AutomationLogService';

const APPROVALS_STORAGE_KEY = 'sji_approvals_cache';
let inMemoryApprovalsFallback: ApprovalRequest[] = [];

function getLocalApprovals(): ApprovalRequest[] {
  if (typeof localStorage === 'undefined') return inMemoryApprovalsFallback;
  try {
    const raw = localStorage.getItem(APPROVALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return inMemoryApprovalsFallback;
  }
}

function setLocalApprovals(list: ApprovalRequest[]) {
  inMemoryApprovalsFallback = list;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Local approvals cache error:', err);
  }
}

function sanitizeApproval<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = val;
    } else {
      result[key] = null;
    }
  }
  return result as T;
}

export class ApprovalService {
  /**
   * Submit a new approval request (e.g. Case Closure, Status Change, CAPA verification)
   */
  static async requestApproval(params: {
    caseId: string;
    ticketId: string;
    requestType: ApprovalRequest['requestType'];
    requestedBy: UserProfile;
    approverRole?: 'hr_lead' | 'hr_admin';
    assignedApproverId?: string;
    assignedApproverName?: string;
    requestNotes: string;
    previousValue?: string;
    proposedValue?: string;
  }): Promise<ApprovalRequest> {
    const id = `appr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const request: ApprovalRequest = {
      id,
      caseId: params.caseId,
      ticketId: params.ticketId,
      requestType: params.requestType,
      requestedBy: params.requestedBy.displayName,
      requestedById: params.requestedBy.id,
      requestedRole: params.requestedBy.role,
      approverRole: params.approverRole || 'hr_lead',
      assignedApproverId: params.assignedApproverId,
      assignedApproverName: params.assignedApproverName,
      status: 'Pending',
      requestNotes: params.requestNotes,
      createdAt: now,
      previousValue: params.previousValue,
      proposedValue: params.proposedValue,
    };

    // Cache locally
    const current = getLocalApprovals();
    const updated = [request, ...current.filter((a) => a.id !== id)];
    setLocalApprovals(updated);

    // Save to Firestore
    try {
      await setDoc(doc(db, 'approvals', id), sanitizeApproval(request));
    } catch (err: any) {
      console.warn('Firestore approval request write notice:', err.message);
    }

    // Send Notification to Approver
    await NotificationService.sendNotification({
      recipientId: params.assignedApproverId || 'role:hr_lead',
      roleTarget: params.approverRole || 'hr_lead',
      ticketId: params.ticketId,
      caseId: params.caseId,
      category: 'Approval Request',
      title: `Permintaan Approval Baru: Tiket #${params.ticketId}`,
      message: `${params.requestedBy.displayName} (${params.requestedBy.role}) mengajukan permohonan persetujuan ${params.requestType.replace('_', ' ')} untuk kasus #${params.ticketId}.`,
      priority: 'high',
      targetTab: 'overview',
    });

    // Log to Automation Log
    await AutomationLogService.recordLog({
      eventType: 'APPROVAL_REQUESTED',
      ticketId: params.ticketId,
      caseId: params.caseId,
      recipient: `Approver (${params.approverRole || 'hr_lead'})`,
      executionStatus: 'Success',
      deliveryStatus: 'Delivered',
      idempotencyKey: `approval-req-${id}`,
      details: `Pengajuan approval ${params.requestType} untuk kasus #${params.ticketId} oleh ${params.requestedBy.displayName}.`,
    });

    return request;
  }

  /**
   * Decide on an approval request (Approved, Rejected, Revision Required)
   */
  static async decideApproval(
    approvalId: string,
    decision: ApprovalRequestStatus,
    decidedBy: UserProfile,
    decisionNotes?: string
  ): Promise<void> {
    // RBAC: Only HR Lead and HR Admin can approve
    if (decidedBy.role !== 'hr_lead' && decidedBy.role !== 'hr_admin') {
      throw new Error('Akses ditolak: Hanya HR Lead atau HR Admin yang memiliki wewenang persetujuan (approval).');
    }

    const current = getLocalApprovals();
    const target = current.find((a) => a.id === approvalId);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedApproval: ApprovalRequest = {
      ...target,
      status: decision,
      decidedBy: decidedBy.displayName,
      decidedById: decidedBy.id,
      decidedAt: now,
      decisionNotes: decisionNotes || '',
    };

    const updatedList = current.map((a) => (a.id === approvalId ? updatedApproval : a));
    setLocalApprovals(updatedList);

    try {
      await setDoc(doc(db, 'approvals', approvalId), sanitizeApproval(updatedApproval), { merge: true });
    } catch (err: any) {
      console.warn('Firestore decideApproval error:', err.message);
    }

    // Send Notification back to Requester
    await NotificationService.sendNotification({
      recipientId: target.requestedById,
      ticketId: target.ticketId,
      caseId: target.caseId,
      category: 'Approval Request',
      title: `Hasil Approval: Permohonan Tiket #${target.ticketId} ${decision}`,
      message: `Permohonan ${target.requestType.replace('_', ' ')} telah diputuskan sebagai "${decision}" oleh ${decidedBy.displayName}. ${decisionNotes ? `Catatan: ${decisionNotes}` : ''}`,
      priority: decision === 'Rejected' ? 'high' : 'medium',
      targetTab: 'overview',
    });

    // Log Decision
    await AutomationLogService.recordLog({
      eventType: 'APPROVAL_DECIDED',
      ticketId: target.ticketId,
      caseId: target.caseId,
      recipient: `Pemohon (${target.requestedBy})`,
      recipientId: target.requestedById,
      executionStatus: 'Success',
      deliveryStatus: 'Delivered',
      idempotencyKey: `approval-dec-${approvalId}-${decision}`,
      details: `Keputusan approval ${decision} untuk #${target.ticketId} oleh ${decidedBy.displayName}. Catatan: ${decisionNotes || '-'}`,
    });
  }

  /**
   * Fetch all approvals
   */
  static async getApprovals(): Promise<ApprovalRequest[]> {
    try {
      const snap = await getDocs(collection(db, 'approvals'));
      if (!snap.empty) {
        const list: ApprovalRequest[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<ApprovalRequest, 'id'>) });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLocalApprovals(list);
        return list;
      }
    } catch (err: any) {
      console.warn('getApprovals fallback to cache:', err.message);
    }
    return getLocalApprovals();
  }

  /**
   * Realtime subscription to approval requests
   */
  static subscribeApprovals(callback: (approvals: ApprovalRequest[]) => void) {
    try {
      return onSnapshot(
        collection(db, 'approvals'),
        (snapshot) => {
          const list: ApprovalRequest[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<ApprovalRequest, 'id'>) });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLocalApprovals(list);
          callback(list);
        },
        (error) => {
          console.warn('Approvals onSnapshot error:', error.message);
          callback(getLocalApprovals());
        }
      );
    } catch {
      callback(getLocalApprovals());
      return () => {};
    }
  }
}
