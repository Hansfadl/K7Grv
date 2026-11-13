import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  GrievanceCase,
  InvestigationRecord,
  RootCauseAnalysis,
  ActionPlan,
  CommunicationLog,
  EvidenceItem,
  MasterCategory,
  MasterDepartment,
  UserProfile,
  PriorityLevel,
  CaseStatus,
  GrievanceInstrument,
  AiAnalysisRecord,
  AiReviewStatus
} from '../types';
import {
  INITIAL_CASES,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_DEPARTMENTS,
} from './mockData';
import * as XLSX from 'xlsx';
import {
  SJI_COMPANY_HOLIDAYS,
  getSlaWorkdays,
  addWorkdays,
  calculateDueDate,
  evaluateCaseSla,
  calculateSlaCompliance,
  calculateSlaStatus as calcStatus,
  CaseSlaEvaluation,
  SlaComplianceSummary,
} from '../utils/sla';

// Local storage cache keys for instant initial paint & offline tolerance
const STORAGE_PREFIX = 'sji_hr_v5_firestore_';

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalData<T>(key: string, data: T) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage caching warning:', err);
  }
}

// Device & Client Information detection
export function getDeviceSummary(): string {
  if (typeof window === 'undefined') return 'Server Node Runtime';
  const ua = navigator.userAgent;
  let browser = 'Web Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('iPhone')) os = 'Apple iPhone';
  else if (ua.includes('iPad')) os = 'Apple iPad';
  else if (ua.includes('Linux')) os = 'Linux OS';

  return `${browser} on ${os}`;
}

export function formatRoleName(role?: string): string {
  switch (role) {
    case 'hr_admin':
      return 'HR Administrator';
    case 'hr_investigator':
      return 'HR Investigator';
    case 'hr_lead':
      return 'HR Lead / Manager';
    case 'department_pic':
      return 'Department PIC';
    default:
      return role || 'Authorized Staff';
  }
}

// Export SLA Matrix & Compliance utilities from single source of truth
export {
  SJI_COMPANY_HOLIDAYS,
  getSlaWorkdays,
  addWorkdays,
  calculateDueDate,
  evaluateCaseSla,
  calculateSlaCompliance,
};
export type { CaseSlaEvaluation, SlaComplianceSummary };

// Helper: Get SLA days based on Priority (Workdays: Minor = 3, Major = 7, Critical = 14)
export function getSlaDays(priority: PriorityLevel): number {
  return getSlaWorkdays(priority);
}

// Helper: Calculate Target Due Date based on Grievance Date (dateReceived) and Priority SLA in WORKDAYS
export function calculateDueDateFromGrievanceDate(dateReceivedStr: string, priority: PriorityLevel): string {
  return calculateDueDate(dateReceivedStr, priority);
}

// Helper: Calculate SLA remaining hours & Met/Overdue status
export function calculateSlaStatus(
  dateReceived: string,
  dueDate: string,
  status: CaseStatus,
  closingDate?: string | null
): { slaStatus: 'On Track' | 'Approaching Due' | 'Breached' | 'Met' | 'Overdue'; slaHoursLeft: number } {
  return calcStatus(dateReceived, dueDate, status, closingDate);
}

/**
 * Universal Firestore Sanitizer:
 * Recursively strips `undefined` from objects and arrays so Firestore never throws:
 * "Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Ensures case payload strictly complies with Firestore data rules:
 * - If status === 'Closed', closingDate must be a valid ISO date string.
 * - If status !== 'Closed', closingDate must be null (never undefined!).
 * - Empty string optional fields are cleanly normalized to null.
 * - No undefined properties are ever sent.
 */
export function prepareCasePayload(
  caseData: Partial<GrievanceCase>,
  fallbackTicketId?: string
): Partial<GrievanceCase> {
  const isClosed = caseData.status === 'Closed';
  const cleanClosingDate: string | null = isClosed
    ? (caseData.closingDate || new Date().toISOString().substring(0, 10))
    : null;

  const dateReceived = caseData.dateReceived || new Date().toISOString().substring(0, 10);
  const priority = caseData.priority || 'Major';
  const dueDate = caseData.dueDate || calculateDueDateFromGrievanceDate(dateReceived, priority);
  const status = caseData.status || 'Open';
  const { slaStatus: computedSlaStatus, slaHoursLeft: computedSlaHours } = calculateSlaStatus(
    dateReceived,
    dueDate,
    status,
    cleanClosingDate
  );

  const cleanPayload: Partial<GrievanceCase> = {
    ...caseData,
    dateReceived,
    priority,
    status,
    dueDate,
    closingDate: cleanClosingDate,
    slaStatus: isClosed ? computedSlaStatus : (caseData.slaStatus && caseData.slaStatus !== 'Met' ? caseData.slaStatus : computedSlaStatus),
    slaHoursLeft: isClosed ? 0 : computedSlaHours,
    lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  if (!cleanPayload.ticketId && fallbackTicketId) {
    cleanPayload.ticketId = fallbackTicketId;
  }

  // Normalize optional string fields to null if empty or undefined
  if (cleanPayload.incidentDate === undefined || cleanPayload.incidentDate === '') {
    cleanPayload.incidentDate = null as any;
  }
  if (cleanPayload.location === undefined || cleanPayload.location === '') {
    cleanPayload.location = null as any;
  }
  if (cleanPayload.involvedParties === undefined || cleanPayload.involvedParties === '') {
    cleanPayload.involvedParties = null as any;
  }
  if (cleanPayload.anonymousAlias === undefined || cleanPayload.anonymousAlias === '') {
    cleanPayload.anonymousAlias = cleanPayload.isAnonymous ? 'Whistleblower' : (null as any);
  }
  if (cleanPayload.employeeNik === undefined || cleanPayload.employeeNik === '') {
    cleanPayload.employeeNik = null as any;
  }
  if (cleanPayload.resolutionSummary === undefined || cleanPayload.resolutionSummary === '') {
    cleanPayload.resolutionSummary = null as any;
  }
  if (cleanPayload.approvedBy === undefined || cleanPayload.approvedBy === '') {
    cleanPayload.approvedBy = null as any;
  }

  return sanitizeForFirestore(cleanPayload);
}

// ==========================================
// SYNC NOTIFICATION & OFFLINE PERSISTENCE
// ==========================================
export interface SyncStatus {
  hasError: boolean;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  pendingSyncCount: number;
}

let syncStatusListeners: Array<(status: SyncStatus) => void> = [];
let currentSyncStatus: SyncStatus = {
  hasError: false,
  errorMessage: null,
  lastAttemptAt: null,
  pendingSyncCount: 0,
};

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  syncStatusListeners.push(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((l) => l !== listener);
  };
}

export function notifySyncError(errorMsg: string) {
  currentSyncStatus = {
    hasError: true,
    errorMessage: errorMsg,
    lastAttemptAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    pendingSyncCount: currentSyncStatus.pendingSyncCount + 1,
  };
  syncStatusListeners.forEach((l) => l(currentSyncStatus));
}

export function clearSyncError() {
  currentSyncStatus = {
    hasError: false,
    errorMessage: null,
    lastAttemptAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    pendingSyncCount: 0,
  };
  syncStatusListeners.forEach((l) => l(currentSyncStatus));
}

// ==========================================
// 1. MULTI-USER CLOUD PERSISTENCE
// ==========================================

export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  const usersCol = collection(db, 'users');

  const unsubscribe = onSnapshot(
    usersCol,
    (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((d) => {
        usersList.push({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) });
      });

      usersList.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setLocalData('users_list', usersList);
      callback(usersList);
    },
    (error) => {
      console.warn('Firestore users subscription fallback:', error.message);
      const cached = getLocalData<UserProfile[]>('users_list', INITIAL_USERS);
      callback(cached);
    }
  );

  return unsubscribe;
}

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    if (!snapshot.empty) {
      const list: UserProfile[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) });
      });
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setLocalData('users_list', list);
      return list;
    }
  } catch (err: any) {
    console.warn('Error fetching users from Firestore, using local cache:', err.message);
  }
  return getLocalData<UserProfile[]>('users_list', INITIAL_USERS);
}

export async function saveUser(user: UserProfile): Promise<void> {
  const cleanUser = sanitizeForFirestore(user);
  try {
    await setDoc(doc(db, 'users', user.id), cleanUser, { merge: true });
  } catch (err: any) {
    console.warn('Firestore saveUser error:', err.message);
  }
  const cached = getLocalData<UserProfile[]>('users_list', []);
  const existingIdx = cached.findIndex((u) => u.id === user.id);
  const updated = existingIdx >= 0
    ? cached.map((u) => (u.id === user.id ? { ...u, ...cleanUser } : u))
    : [...cached, cleanUser];
  setLocalData('users_list', updated);
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err: any) {
    console.warn('Firestore deleteUser error:', err.message);
  }
  const cached = getLocalData<UserProfile[]>('users_list', []);
  const updated = cached.filter((u) => u.id !== userId);
  setLocalData('users_list', updated);
}

export async function recordUserLogin(user: UserProfile, deviceStr?: string): Promise<void> {
  const device = deviceStr || getDeviceSummary();
  const now = new Date().toISOString();
  const loginCount = (user.loginCount || 0) + 1;

  try {
    await setDoc(
      doc(db, 'users', user.id),
      sanitizeForFirestore({
        ...user,
        lastLoginAt: now,
        lastLoginDevice: device,
        loginCount,
      }),
      { merge: true }
    );
  } catch (err: any) {
    console.warn('Firestore recordUserLogin fallback:', err.message);
  }
}

// Lightweight internal audit action recorder for case changes
export async function logAuditAction(log: {
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  caseId?: string;
  ticketId?: string;
  details: string;
  device?: string;
}): Promise<void> {
  const logId = `aud-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      ...log,
      id: logId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      device: log.device || getDeviceSummary(),
    });
  } catch {
    // quiet fail
  }
}

// ==========================================
// 2. GRIEVANCE CASES PERSISTENCE
// ==========================================

export function filterCasesByRole(cases: GrievanceCase[], user?: UserProfile | null): GrievanceCase[] {
  if (!user) return [];

  if (user.role === 'department_pic') {
    const userDept = (user.department || '').trim().toLowerCase();
    const userName = (user.displayName || '').trim().toLowerCase();
    return cases.filter((c) => {
      const caseDept = (c.department || '').trim().toLowerCase();
      const picName = (c.assignedPic || '').trim().toLowerCase();
      const isDeptMatch = !!userDept && caseDept === userDept;
      const isPicIdMatch = c.assignedPicId === user.id;
      const isPicNameMatch = !!userName && picName.includes(userName);
      return isDeptMatch || isPicIdMatch || isPicNameMatch;
    });
  }

  if (user.role === 'hr_investigator') {
    const userDept = (user.department || '').trim().toLowerCase();
    const userName = (user.displayName || '').trim().toLowerCase();
    return cases.filter((c) => {
      const isInvestigatorMatch = c.assignedInvestigatorId === user.id;
      const isPicIdMatch = c.assignedPicId === user.id;
      const isPicNameMatch = !!userName && (c.assignedPic || '').toLowerCase().includes(userName);
      const isHrDept = (c.department || '').toLowerCase() === 'hr';
      const isDeptMatch = !!userDept && (c.department || '').toLowerCase() === userDept;
      return isInvestigatorMatch || isPicIdMatch || isPicNameMatch || isHrDept || isDeptMatch;
    });
  }

  return cases;
}

export function subscribeToCases(
  callback: (cases: GrievanceCase[]) => void,
  user?: UserProfile | null
) {
  const casesCollection = collection(db, 'cases');

  const unsubscribe = onSnapshot(
    casesCollection,
    (snapshot) => {
      const casesList: GrievanceCase[] = [];
      snapshot.forEach((docSnap) => {
        casesList.push({ id: docSnap.id, ...(docSnap.data() as Omit<GrievanceCase, 'id'>) });
      });
      // Sort primarily by Grievance Date (dateReceived) descending
      casesList.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
      
      setLocalData('cases', casesList);
      callback(filterCasesByRole(casesList, user));
    },
    (error) => {
      console.warn('Firestore Cases onSnapshot notice, using cached repository:', error.message);
      const cached = getLocalData<GrievanceCase[]>('cases', INITIAL_CASES);
      callback(filterCasesByRole(cached, user));
    }
  );

  return unsubscribe;
}

export async function createCase(
  caseData: Omit<GrievanceCase, 'id'>,
  user: UserProfile
): Promise<GrievanceCase> {
  const currentCases = getLocalData<GrievanceCase[]>('cases', INITIAL_CASES);
  const normalizedTicketId = (caseData.ticketId || '').trim().toUpperCase();
  
  // Deduplication check: if case with ticketId already exists, update instead of creating duplicate
  const existingCase = currentCases.find(
    (c) => c.ticketId && c.ticketId.trim().toUpperCase() === normalizedTicketId
  );

  const targetId = existingCase ? existingCase.id : `case-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  
  // Prepare payload: sets closingDate: null if not Closed, sanitizes all fields, calculates SLA strictly
  const prepared = prepareCasePayload(
    {
      ...caseData,
      id: targetId,
      ticketId: normalizedTicketId || `GRV-${Date.now().toString(36).toUpperCase()}`,
    },
    `GRV-${Date.now().toString(36).toUpperCase()}`
  ) as GrievanceCase;

  let firestoreFailed = false;
  let syncErrMessage = '';

  try {
    await setDoc(doc(db, 'cases', targetId), prepared);
    clearSyncError();
  } catch (error: any) {
    firestoreFailed = true;
    syncErrMessage = error?.message || 'Gagal menyimpan ke Firestore';
    console.error('Firestore save case error:', error);
    notifySyncError(`Gagal sinkronisasi kasus #${prepared.ticketId} ke Cloud Firestore: ${syncErrMessage}`);
  }

  // Update local cache without duplication
  const existingIdx = currentCases.findIndex((c) => c.id === targetId || (c.ticketId && c.ticketId.trim().toUpperCase() === normalizedTicketId));
  let updatedList: GrievanceCase[];
  if (existingIdx >= 0) {
    updatedList = currentCases.map((c, idx) => (idx === existingIdx ? prepared : c));
  } else {
    updatedList = [prepared, ...currentCases];
  }
  setLocalData('cases', updatedList);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: existingCase ? 'UPDATE_CASE_DEDUPLICATED' : 'REGISTER_GRIEVANCE',
    caseId: targetId,
    ticketId: prepared.ticketId,
    details: `${existingCase ? 'Pembaruan otomatis (deduplikasi)' : 'Mendaftarkan'} keluhan baru #${prepared.ticketId} (${prepared.department} - ${prepared.complaintCategory}). Status: ${prepared.status}. Target Selesai: ${prepared.dueDate}.${firestoreFailed ? ' [TERCATAT SECARA LOKAL - PERLU SYNC]' : ' [SYNCED FIRESTORE]'}`,
  });

  return prepared;
}

export async function updateCaseRecord(
  caseId: string,
  updates: Partial<GrievanceCase>,
  user: UserProfile,
  reason?: string
): Promise<void> {
  const currentCases = getLocalData<GrievanceCase[]>('cases', INITIAL_CASES);
  const targetIndex = currentCases.findIndex((c) => c.id === caseId);
  const existingCase = currentCases[targetIndex];

  // Re-calculate target due date if grievance date or priority changed and no explicit dueDate passed
  let dueDate = updates.dueDate || existingCase?.dueDate;
  const dateReceived = updates.dateReceived || existingCase?.dateReceived || new Date().toISOString().substring(0, 10);
  const priority = updates.priority || existingCase?.priority || 'Major';
  const status = updates.status || existingCase?.status || 'Open';

  if (!updates.dueDate && (updates.dateReceived || updates.priority)) {
    dueDate = calculateDueDateFromGrievanceDate(dateReceived, priority);
  }

  // Rule A.3 & A.4 & A.5: closingDate must be null if status is not Closed!
  const isClosed = status === 'Closed';
  let cleanClosingDate: string | null = null;
  if (isClosed) {
    cleanClosingDate = updates.closingDate || existingCase?.closingDate || new Date().toISOString().substring(0, 10);
  } else {
    cleanClosingDate = null; // Reopened or non-closed status resets to null
  }

  const { slaStatus, slaHoursLeft } = calculateSlaStatus(dateReceived, dueDate || '', status, cleanClosingDate);

  const rawMerged: GrievanceCase = {
    ...(existingCase || ({} as GrievanceCase)),
    ...updates,
    id: caseId,
    dueDate: dueDate || existingCase?.dueDate || '',
    closingDate: cleanClosingDate,
    slaStatus: updates.slaStatus || slaStatus,
    slaHoursLeft: isClosed ? 0 : (updates.slaHoursLeft !== undefined ? updates.slaHoursLeft : slaHoursLeft),
    lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  const cleanPayload = prepareCasePayload(rawMerged) as GrievanceCase;

  let firestoreFailed = false;
  try {
    await setDoc(doc(db, 'cases', caseId), cleanPayload, { merge: true });
    clearSyncError();
  } catch (err: any) {
    firestoreFailed = true;
    console.error('Firestore updateCaseRecord error:', err);
    notifySyncError(`Gagal memperbarui kasus #${cleanPayload.ticketId || caseId} di Cloud Firestore: ${err.message}`);
  }

  if (targetIndex >= 0) {
    currentCases[targetIndex] = cleanPayload;
    setLocalData('cases', currentCases);
  }

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'UPDATE_CASE',
    caseId,
    ticketId: cleanPayload.ticketId,
    details: `Memperbarui data kasus: ${Object.keys(updates).join(', ')}. ${reason ? `Alasan: ${reason}.` : ''}${firestoreFailed ? ' [TERCATAT SECARA LOKAL - PERLU SYNC]' : ' [SYNCED FIRESTORE]'}`,
  });
}

/**
 * Resync offline/local cases to Firestore without creating duplicates.
 * Uses ticketId & id matching to safely merge records.
 */
export async function syncOfflineCasesToFirestore(): Promise<{ synced: number; errors: string[] }> {
  const currentCases = getLocalData<GrievanceCase[]>('cases', []);
  let synced = 0;
  const errors: string[] = [];

  for (const c of currentCases) {
    try {
      const clean = prepareCasePayload(c);
      await setDoc(doc(db, 'cases', c.id), clean, { merge: true });
      synced++;
    } catch (err: any) {
      errors.push(`Kasus #${c.ticketId}: ${err.message}`);
    }
  }

  if (errors.length === 0) {
    clearSyncError();
  } else {
    notifySyncError(`${errors.length} kasus gagal disinkronkan ke Firestore.`);
  }

  return { synced, errors };
}

export async function deleteCaseRecord(
  caseId: string,
  user: UserProfile,
  reason: string
): Promise<void> {
  const currentCases = getLocalData<GrievanceCase[]>('cases', INITIAL_CASES);
  const targetCase = currentCases.find((c) => c.id === caseId);
  const ticketId = targetCase?.ticketId || caseId;

  const updatedCases = currentCases.filter((c) => c.id !== caseId);
  setLocalData('cases', updatedCases);

  try {
    await deleteDoc(doc(db, 'cases', caseId));
  } catch (error: any) {
    console.warn('Firestore deleteDoc fallback:', error.message);
  }

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'DELETE_CASE',
    caseId,
    ticketId,
    details: `Menghapus kasus #${ticketId} (${targetCase?.department} - ${targetCase?.complaintCategory}). Alasan: ${reason}.`,
  });
}

// ==========================================
// 3. INVESTIGATION MANAGEMENT (NO SIGNATURES)
// ==========================================

export async function getCaseInvestigations(caseId: string): Promise<InvestigationRecord[]> {
  try {
    const q = collection(db, 'cases', caseId, 'investigations');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvestigationRecord, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Fetching investigations fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, InvestigationRecord[]>>('investigations', {});
  return localMap[caseId] || [];
}

export async function saveCaseInvestigation(
  caseId: string,
  record: Omit<InvestigationRecord, 'id'>,
  user: UserProfile
): Promise<InvestigationRecord> {
  const newId = `inv-${Date.now().toString(36)}`;
  const fullRecord: InvestigationRecord = {
    ...record,
    id: newId,
    caseId,
    investigatorName: user.displayName,
    investigatorId: user.id,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  try {
    await setDoc(doc(db, 'cases', caseId, 'investigations', newId), sanitizeForFirestore(fullRecord));
  } catch (err: any) {
    console.warn('Firestore save investigation fallback:', err.message);
  }

  const localMap = getLocalData<Record<string, InvestigationRecord[]>>('investigations', {});
  localMap[caseId] = [fullRecord, ...(localMap[caseId] || [])];
  setLocalData('investigations', localMap);

  return fullRecord;
}

// Backward compatibility alias
export const getCaseFindings = getCaseInvestigations;
export const addCaseFinding = (caseId: string, item: any, user: UserProfile) => {
  return saveCaseInvestigation(
    caseId,
    {
      caseId,
      ticketId: item.ticketId || '',
      investigationDate: item.dateConducted || item.investigationDate || new Date().toISOString().substring(0, 10),
      investigationDetails: item.title || item.investigationDetails || '',
      interviewNotes: item.statementSummary || item.interviewNotes || '',
      witnessInfo: item.intervieweeName || item.witnessInfo || '',
      supportingInfo: item.credibilityAssessment || item.supportingInfo || '',
      evidenceRef: item.evidenceRef || '',
      findings: item.keyFindings || item.findings || '',
      conclusion: item.conclusion || '',
      recommendedActions: item.recommendedActions || '',
      investigatorName: user.displayName,
      investigatorId: user.id,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    },
    user
  );
};

// ==========================================
// 4. ROOT CAUSE ANALYSIS (6M ISHIKAWA)
// ==========================================

export async function getCaseRootCauses(caseId: string): Promise<RootCauseAnalysis[]> {
  try {
    const q = collection(db, 'cases', caseId, 'root_causes_6m');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RootCauseAnalysis, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Fetching 6M RCA fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, RootCauseAnalysis[]>>('root_causes_6m', {});
  return localMap[caseId] || [];
}

export async function saveCaseRootCause(
  caseId: string,
  rca: Omit<RootCauseAnalysis, 'id'>,
  user: UserProfile
): Promise<RootCauseAnalysis> {
  const rcaId = `rc6m-${rca.category.toLowerCase()}-${Date.now().toString(36)}`;
  const fullRca: RootCauseAnalysis = {
    ...rca,
    id: rcaId,
    caseId,
    analystId: user.id,
    analystName: user.displayName,
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  try {
    await setDoc(doc(db, 'cases', caseId, 'root_causes_6m', rcaId), sanitizeForFirestore(fullRca));
  } catch (err: any) {
    console.warn('Firestore save 6M RCA fallback:', err.message);
  }

  const localMap = getLocalData<Record<string, RootCauseAnalysis[]>>('root_causes_6m', {});
  const existing = localMap[caseId] || [];
  const filtered = existing.filter((item) => item.category !== rca.category);
  localMap[caseId] = [...filtered, fullRca];
  setLocalData('root_causes_6m', localMap);

  return fullRca;
}

// Backward compatibility helper
export async function getCaseRootCause(caseId: string): Promise<RootCauseAnalysis | null> {
  const list = await getCaseRootCauses(caseId);
  return list[0] || null;
}

// ==========================================
// 5. CAPA / ACTION PLAN (ADD, EDIT, REVISE)
// ==========================================

export async function getCaseActionPlans(caseId: string): Promise<ActionPlan[]> {
  try {
    const q = collection(db, 'cases', caseId, 'action_plans');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActionPlan, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Action plans read fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', {});
  return localMap[caseId] || [];
}

export async function addCaseActionPlan(
  caseId: string,
  plan: Omit<ActionPlan, 'id' | 'createdAt'>,
  user: UserProfile
): Promise<ActionPlan> {
  const newId = `capa-${Date.now().toString(36)}`;
  const fullPlan: ActionPlan = {
    ...plan,
    id: newId,
    caseId,
    createdAt: new Date().toISOString().substring(0, 10),
  };

  try {
    await setDoc(doc(db, 'cases', caseId, 'action_plans', newId), sanitizeForFirestore(fullPlan));
  } catch (err: any) {
    console.warn('Cached action plan fallback:', err.message);
  }

  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', {});
  localMap[caseId] = [...(localMap[caseId] || []), fullPlan];
  setLocalData('action_plans', localMap);

  return fullPlan;
}

export async function updateCaseActionPlan(
  caseId: string,
  planId: string,
  updates: Partial<ActionPlan>,
  user: UserProfile
): Promise<void> {
  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', {});
  const list = localMap[caseId] || [];
  const targetIndex = list.findIndex((p) => p.id === planId);

  const merged = {
    ...(list[targetIndex] || ({} as ActionPlan)),
    ...updates,
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  if (targetIndex >= 0) {
    list[targetIndex] = merged;
    localMap[caseId] = list;
    setLocalData('action_plans', localMap);
  }

  try {
    await setDoc(doc(db, 'cases', caseId, 'action_plans', planId), sanitizeForFirestore(merged), { merge: true });
  } catch (err: any) {
    console.warn('Action plan update error:', err.message);
  }
}

export async function deleteCaseActionPlan(
  caseId: string,
  planId: string,
  user: UserProfile
): Promise<void> {
  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', {});
  if (localMap[caseId]) {
    localMap[caseId] = localMap[caseId].filter((p) => p.id !== planId);
    setLocalData('action_plans', localMap);
  }

  try {
    await deleteDoc(doc(db, 'cases', caseId, 'action_plans', planId));
  } catch (err: any) {
    console.warn('Action plan delete error:', err.message);
  }
}

export const updateActionPlanStatus = async (
  caseId: string,
  planId: string,
  status: any,
  user: UserProfile
) => {
  const progressStatus = status === 'Completed' || status === 'Verified' ? 'Completed' : 'Progress';
  await updateCaseActionPlan(
    caseId,
    planId,
    {
      progressStatus,
      completionDate: progressStatus === 'Completed' ? new Date().toISOString().substring(0, 10) : null,
    },
    user
  );
};

// ==========================================
// 6. EVIDENCE MANAGEMENT (JPG, PNG, PDF)
// ==========================================

export async function getCaseEvidence(caseId: string, user?: UserProfile | null): Promise<EvidenceItem[]> {
  let list: EvidenceItem[] = [];
  try {
    const q = collection(db, 'cases', caseId, 'evidence');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EvidenceItem, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Evidence read fallback:', err.message);
  }
  if (list.length === 0) {
    const localMap = getLocalData<Record<string, EvidenceItem[]>>('evidence', {});
    list = localMap[caseId] || [];
  }

  if (user && user.role === 'department_pic') {
    return list.filter((e) => !e.isConfidential);
  }
  return list;
}

export async function addCaseEvidence(
  caseId: string,
  evidence: Omit<EvidenceItem, 'id'>,
  user: UserProfile
): Promise<EvidenceItem> {
  const newId = `evi-${Date.now().toString(36)}`;
  const fullEvidence: EvidenceItem = { ...evidence, id: newId, caseId };

  try {
    await setDoc(doc(db, 'cases', caseId, 'evidence', newId), sanitizeForFirestore(fullEvidence));
  } catch (err: any) {
    console.warn('Evidence save fallback:', err.message);
  }

  const localMap = getLocalData<Record<string, EvidenceItem[]>>('evidence', {});
  localMap[caseId] = [fullEvidence, ...(localMap[caseId] || [])];
  setLocalData('evidence', localMap);

  return fullEvidence;
}

export async function deleteCaseEvidence(
  caseId: string,
  evidenceId: string,
  user: UserProfile
): Promise<void> {
  const localMap = getLocalData<Record<string, EvidenceItem[]>>('evidence', {});
  if (localMap[caseId]) {
    localMap[caseId] = localMap[caseId].filter((e) => e.id !== evidenceId);
    setLocalData('evidence', localMap);
  }

  try {
    await deleteDoc(doc(db, 'cases', caseId, 'evidence', evidenceId));
  } catch (err: any) {
    console.warn('Evidence delete fallback:', err.message);
  }
}

// ==========================================
// 7. COMMUNICATION LOG
// ==========================================

export async function getCaseCommunications(caseId: string): Promise<CommunicationLog[]> {
  try {
    const q = collection(db, 'cases', caseId, 'communications');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunicationLog, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Comms read fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, CommunicationLog[]>>('communications', {});
  return localMap[caseId] || [];
}

export async function addCaseCommunication(
  caseId: string,
  comm: Omit<CommunicationLog, 'id'>,
  user: UserProfile
): Promise<CommunicationLog> {
  const newId = `com-${Date.now().toString(36)}`;
  const fullComm: CommunicationLog = { ...comm, id: newId, caseId };

  try {
    await setDoc(doc(db, 'cases', caseId, 'communications', newId), sanitizeForFirestore(fullComm));
  } catch (err: any) {
    console.warn('Comms save fallback:', err.message);
  }

  const localMap = getLocalData<Record<string, CommunicationLog[]>>('communications', {});
  localMap[caseId] = [fullComm, ...(localMap[caseId] || [])];
  setLocalData('communications', localMap);

  return fullComm;
}

// ==========================================
// 8. MASTER DATA
// ==========================================

export async function getCategories(): Promise<MasterCategory[]> {
  try {
    const docSnap = await getDoc(doc(db, 'master_data', 'categories'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocalData('master_categories', data.list);
        return data.list;
      }
    }
    await setDoc(doc(db, 'master_data', 'categories'), { list: INITIAL_CATEGORIES });
    setLocalData('master_categories', INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  } catch {
    return getLocalData<MasterCategory[]>('master_categories', INITIAL_CATEGORIES);
  }
}

export async function saveCategories(categories: MasterCategory[]): Promise<void> {
  setLocalData('master_categories', categories);
  try {
    await setDoc(doc(db, 'master_data', 'categories'), { list: categories });
  } catch (err: any) {
    console.warn('Error saving categories to Firestore:', err.message);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sji_categories_updated', { detail: categories }));
  }
}

export async function updateCategoryDescription(
  categoryId: string,
  newDescription: string,
  actor?: UserProfile | null
): Promise<MasterCategory[]> {
  const currentCategories = await getCategories();
  const target = currentCategories.find((c) => c.id === categoryId);
  if (!target) {
    throw new Error(`Kategori keluhan dengan ID "${categoryId}" tidak ditemukan.`);
  }

  const updatedCategories = currentCategories.map((c) =>
    c.id === categoryId ? { ...c, description: newDescription.trim() } : c
  );

  await saveCategories(updatedCategories);

  if (actor) {
    await logAuditAction({
      userId: actor.id,
      userName: actor.displayName,
      userRole: actor.role,
      action: 'UPDATE_CATEGORY_DESCRIPTION',
      details: `Memperbarui deskripsi Complaint Category "${target.name}" (${target.code}).`,
    });
  }

  return updatedCategories;
}

export async function getDepartments(): Promise<MasterDepartment[]> {
  try {
    const docSnap = await getDoc(doc(db, 'master_data', 'departments'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocalData('master_departments', data.list);
        return data.list;
      }
    }
    await setDoc(doc(db, 'master_data', 'departments'), { list: INITIAL_DEPARTMENTS });
    setLocalData('master_departments', INITIAL_DEPARTMENTS);
    return INITIAL_DEPARTMENTS;
  } catch {
    return getLocalData<MasterDepartment[]>('master_departments', INITIAL_DEPARTMENTS);
  }
}

export async function saveDepartments(departments: MasterDepartment[]): Promise<void> {
  setLocalData('master_departments', departments);
  try {
    await setDoc(doc(db, 'master_data', 'departments'), { list: departments });
  } catch (err: any) {
    console.warn('Error saving departments:', err.message);
  }
}

// ==========================================
// 9. EXCEL IMPORT & EXPORT ENGINE
// ==========================================

// Helper: Convert Excel date (serial or string) to standard YYYY-MM-DD
export function normalizeExcelDate(value: any): string {
  if (!value) return new Date().toISOString().substring(0, 10);

  // If number (Excel date serial e.g. 45678)
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }
  }

  const str = String(value).trim();
  // If DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // If DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const [d, m, y] = str.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // If YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Attempt standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().substring(0, 10);
  }

  return new Date().toISOString().substring(0, 10);
}

export interface ExcelImportResult {
  validCases: Partial<GrievanceCase>[];
  errors: string[];
  duplicateCount: number;
}

export async function parseExcelImportAdvanced(
  file: File,
  existingCases: GrievanceCase[] = []
): Promise<ExcelImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        const existingTicketIds = new Set(existingCases.map((c) => c.ticketId.trim().toUpperCase()));
        const seenInFile = new Set<string>();

        const validCases: Partial<GrievanceCase>[] = [];
        const errors: string[] = [];
        let duplicateCount = 0;

        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // header is row 1

          // Find Ticket ID from multiple candidate column names
          const rawTicketId =
            row['Ticket ID'] ||
            row['ticketId'] ||
            row['ID Tiket'] ||
            row['Nomor Tiket'] ||
            row['No Tiket'] ||
            row['No'] ||
            `GRV-IMP-${String(idx + 1).padStart(4, '0')}`;

          const ticketId = String(rawTicketId).trim().toUpperCase();

          if (existingTicketIds.has(ticketId)) {
            duplicateCount++;
            errors.push(`Baris #${rowNum}: Ticket ID "${ticketId}" sudah ada di database sistem.`);
            return;
          }
          if (seenInFile.has(ticketId)) {
            duplicateCount++;
            errors.push(`Baris #${rowNum}: Ticket ID "${ticketId}" duplikat dalam file spreadsheet.`);
            return;
          }
          seenInFile.add(ticketId);

          // Grievance Date / Tanggal Keluhan
          const rawDateReceived =
            row['Date Received'] ||
            row['Tanggal Keluhan'] ||
            row['Tanggal Diterima'] ||
            row['Tanggal Masuk'] ||
            row['Tanggal'] ||
            row['dateReceived'];

          const dateReceived = normalizeExcelDate(rawDateReceived);

          // Employee Name
          const employeeName =
            row['Employee Name'] ||
            row['Nama Karyawan'] ||
            row['Nama Pelapor'] ||
            row['Pelapor'] ||
            row['employeeName'] ||
            'Pelapor Terlindungi';

          const isAnonymous =
            Boolean(row['Is Anonymous'] || row['isAnonymous']) ||
            String(employeeName).toLowerCase().includes('anon') ||
            String(employeeName).toLowerCase().includes('rahasia');

          // Department
          const department =
            row['Department'] ||
            row['Departemen'] ||
            row['Bagian'] ||
            row['department'] ||
            'HR';

          // Category
          const complaintCategory =
            row['Complaint Category'] ||
            row['Kategori'] ||
            row['Kategori Keluhan'] ||
            row['Jenis Keluhan'] ||
            row['complaintCategory'] ||
            'Kebijakan';

          // Priority (Minor, Major, Critical)
          let priority: PriorityLevel = 'Major';
          const rawPriority = String(
            row['Priority'] || row['Prioritas'] || row['Tingkat Prioritas'] || 'Major'
          ).toLowerCase();

          if (rawPriority.includes('crit') || rawPriority.includes('kritis')) priority = 'Critical';
          else if (rawPriority.includes('min')) priority = 'Minor';
          else priority = 'Major';

          // Status: strictly 4 stages: Open, Investigation, Action Taken, Closed
          let status: CaseStatus = 'Open';
          const rawStatus = String(row['Status'] || row['status'] || 'Open').toLowerCase();
          if (rawStatus.includes('clos') || rawStatus.includes('tutup') || rawStatus.includes('selesai')) {
            status = 'Closed';
          } else if (rawStatus.includes('action') || rawStatus.includes('tindakan')) {
            status = 'Action Taken';
          } else if (rawStatus.includes('invest') || rawStatus.includes('periksa')) {
            status = 'Investigation';
          } else {
            status = 'Open';
          }

          // PIC
          const assignedPic =
            row['Assigned PIC'] ||
            row['PIC'] ||
            row['PIC Departemen'] ||
            row['Penanggung Jawab'] ||
            'Unassigned PIC';

          // Due Date: calculate from dateReceived + SLA if not present or explicitly given
          const rawDueDate = row['Due Date'] || row['Batas Waktu'] || row['Target Selesai'];
          const dueDate = rawDueDate
            ? normalizeExcelDate(rawDueDate)
            : calculateDueDateFromGrievanceDate(dateReceived, priority);

          // Channel
          let channelReceived: GrievanceInstrument = 'Online';
          const rawChan = String(row['Instrument (Saluran)'] || row['Saluran'] || row['Saluran Masuk'] || 'Online').toLowerCase();
          if (rawChan.includes('box') || rawChan.includes('kotak')) channelReceived = 'Grievance Box';
          else if (rawChan.includes('verb') || rawChan.includes('lisan')) channelReceived = 'Verbal';
          else if (rawChan.includes('hot') || rawChan.includes('wa') || rawChan.includes('telepon')) channelReceived = 'Hotline';
          else channelReceived = 'Online';

          // Description
          const description =
            row['Description'] ||
            row['Deskripsi'] ||
            row['Uraian'] ||
            row['Keluhan'] ||
            row['Isi Keluhan'] ||
            'Data keluhan diimpor dari file portal internal.';

          validCases.push({
            ticketId,
            dateReceived,
            employeeName: String(employeeName),
            isAnonymous,
            anonymousAlias: isAnonymous ? `Whistleblower #${Math.floor(1000 + Math.random() * 9000)}` : null,
            department: String(department),
            complaintCategory: String(complaintCategory),
            priority,
            status,
            assignedPic: String(assignedPic),
            assignedPicId: 'usr-pic-auto',
            progress: status === 'Closed' ? 100 : status === 'Action Taken' ? 75 : status === 'Investigation' ? 45 : 15,
            dueDate,
            closingDate: status === 'Closed' ? dateReceived : null,
            channelReceived,
            description: String(description),
          });
        });

        resolve({ validCases, errors, duplicateCount });
      } catch (err: any) {
        reject(new Error('Gagal memproses file spreadsheet: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

// Backward compatibility alias
export async function parseExcelImport(file: File): Promise<Partial<GrievanceCase>[]> {
  const res = await parseExcelImportAdvanced(file);
  return res.validCases;
}

export function exportCasesToExcel(cases: GrievanceCase[], format: 'xlsx' | 'csv' = 'xlsx') {
  const exportData = cases.map((c) => ({
    'Ticket ID': c.ticketId,
    'Grievance Date (Tanggal Keluhan)': c.dateReceived,
    'Saluran (Instrument)': c.channelReceived || 'Online',
    'Nama Pelapor': c.isAnonymous ? `${c.anonymousAlias || 'Whistleblower'} (Protected)` : c.employeeName,
    'Departemen': c.department,
    'Kategori Keluhan': c.complaintCategory,
    'Tingkat Prioritas': c.priority,
    'Status Kasus': c.status,
    'PIC Departemen': c.assignedPic || '-',
    'Progress (%)': c.progress,
    'Batas Waktu (Due Date)': c.dueDate,
    'Tanggal Selesai (Closing Date)': c.closingDate || '-',
    'Status SLA': c.slaStatus,
    'Uraian Keluhan': c.description,
    'Ringkasan Penyelesaian': c.resolutionSummary || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Grievance Cases');

  const fileName = `SJI_Grievance_Report_${new Date().toISOString().substring(0, 10)}.${format}`;
  XLSX.writeFile(workbook, fileName, { bookType: format });
}

// ==========================================
// 10. SJI AI INTELLIGENCE PERSISTENCE
// ==========================================

export async function getCaseAiAnalyses(caseId: string): Promise<AiAnalysisRecord[]> {
  const path = `cases/${caseId}/ai_analyses`;
  try {
    const q = collection(db, 'cases', caseId, 'ai_analyses');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiAnalysisRecord, 'id'>) }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const localMap = getLocalData<Record<string, AiAnalysisRecord[]>>('ai_analyses', {});
      localMap[caseId] = list;
      setLocalData('ai_analyses', localMap);
      return list;
    }
  } catch (err: any) {
    console.warn(`AI analyses read fallback (${path}):`, err.message);
  }
  const localMap = getLocalData<Record<string, AiAnalysisRecord[]>>('ai_analyses', {});
  return (localMap[caseId] || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function saveCaseAiAnalysis<T>(
  caseId: string,
  record: Omit<AiAnalysisRecord<T>, 'id' | 'createdAt' | 'createdBy' | 'createdById'>,
  user: UserProfile
): Promise<AiAnalysisRecord<T>> {
  const newId = `ai-${record.analysisType}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const fullRecord: AiAnalysisRecord<T> = sanitizeForFirestore({
    ...record,
    id: newId,
    caseId,
    createdBy: user.displayName,
    createdById: user.id,
    createdAt: nowStamp,
    reviewStatus: record.reviewStatus || 'Pending Review',
    reviewedBy: null,
    reviewedByRole: null,
    reviewedAt: null,
    reviewNotes: null,
    appliedToModule: false,
    appliedAt: null,
  });

  const path = `cases/${caseId}/ai_analyses/${newId}`;
  try {
    await setDoc(doc(db, 'cases', caseId, 'ai_analyses', newId), fullRecord);
  } catch (err: any) {
    console.error(`Firestore save AI analysis error (${path}):`, err.message);
    notifySyncError(`Gagal menyimpan riwayat AI (${record.title}) ke Firestore: ${err.message}`);
  }

  const localMap = getLocalData<Record<string, AiAnalysisRecord[]>>('ai_analyses', {});
  localMap[caseId] = [fullRecord, ...(localMap[caseId] || [])];
  setLocalData('ai_analyses', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'AI_ANALYSIS_GENERATED',
    caseId,
    ticketId: record.ticketId || undefined,
    details: `Menjalankan SJI AI Intelligence (${record.analysisType}) untuk tiket #${record.ticketId || caseId}. Model: ${record.modelUsed}. Status: Pending Review.`,
  });

  return fullRecord;
}

export async function updateCaseAiAnalysisReview(
  caseId: string,
  analysisId: string,
  reviewStatus: AiReviewStatus,
  user: UserProfile,
  reviewNotes?: string,
  appliedToModule?: boolean
): Promise<void> {
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const localMap = getLocalData<Record<string, AiAnalysisRecord[]>>('ai_analyses', {});
  const list = localMap[caseId] || [];
  const existing = list.find((a) => a.id === analysisId);

  const updates: Partial<AiAnalysisRecord> = sanitizeForFirestore({
    reviewStatus,
    reviewedBy: user.displayName,
    reviewedByRole: formatRoleName(user.role),
    reviewedAt: nowStamp,
    reviewNotes: reviewNotes !== undefined ? reviewNotes : (existing?.reviewNotes ?? null),
    ...(appliedToModule !== undefined
      ? {
          appliedToModule,
          appliedAt: appliedToModule ? nowStamp : (existing?.appliedAt ?? null),
        }
      : {}),
  });

  const path = `cases/${caseId}/ai_analyses/${analysisId}`;
  try {
    await updateDoc(doc(db, 'cases', caseId, 'ai_analyses', analysisId), updates);
  } catch (err: any) {
    try {
      await setDoc(doc(db, 'cases', caseId, 'ai_analyses', analysisId), sanitizeForFirestore({ ...(existing || {}), ...updates }), { merge: true });
    } catch (innerErr: any) {
      handleFirestoreError(innerErr, OperationType.UPDATE, path);
    }
  }

  localMap[caseId] = list.map((a) => (a.id === analysisId ? { ...a, ...updates } : a));
  setLocalData('ai_analyses', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: appliedToModule ? 'AI_DRAFT_APPLIED' : `AI_ANALYSIS_${reviewStatus.toUpperCase().replace(/\s+/g, '_')}`,
    caseId,
    ticketId: existing?.ticketId || undefined,
    details: appliedToModule
      ? `Menerapkan draft AI (${existing?.analysisType || analysisId}) ke modul resmi setelah persetujuan HR.`
      : `Meninjau rekomendasi AI (${existing?.analysisType || analysisId}) dengan status: ${reviewStatus}.${reviewNotes ? ` Catatan: ${reviewNotes}` : ''}`,
  });
}

export async function getGlobalAiInsights(): Promise<AiAnalysisRecord[]> {
  try {
    const q = collection(db, 'ai_insights');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiAnalysisRecord, 'id'>) }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setLocalData('ai_insights', list);
      return list;
    }
  } catch (err: any) {
    console.warn('Global AI insights read fallback:', err.message);
  }
  const local = getLocalData<AiAnalysisRecord[]>('ai_insights', []);
  return local.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function saveGlobalAiInsight<T>(
  record: Omit<AiAnalysisRecord<T>, 'id' | 'createdAt' | 'createdBy' | 'createdById'>,
  user: UserProfile
): Promise<AiAnalysisRecord<T>> {
  const newId = `insight-${record.analysisType}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const fullRecord: AiAnalysisRecord<T> = sanitizeForFirestore({
    ...record,
    id: newId,
    caseId: null,
    ticketId: null,
    createdBy: user.displayName,
    createdById: user.id,
    createdAt: nowStamp,
    reviewStatus: record.reviewStatus || 'Pending Review',
    reviewedBy: null,
    reviewedByRole: null,
    reviewedAt: null,
    reviewNotes: null,
    appliedToModule: false,
    appliedAt: null,
  });

  try {
    await setDoc(doc(db, 'ai_insights', newId), fullRecord);
  } catch (err: any) {
    console.error('Firestore save global AI insight error:', err.message);
    notifySyncError(`Gagal menyimpan insight AI (${record.title}) ke Firestore: ${err.message}`);
  }

  const local = getLocalData<AiAnalysisRecord[]>('ai_insights', []);
  setLocalData('ai_insights', [fullRecord, ...local]);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'AI_GLOBAL_INSIGHT_GENERATED',
    details: `Menjalankan SJI AI Intelligence (${record.analysisType}): ${record.title}. Model: ${record.modelUsed}.`,
  });

  return fullRecord;
}

export async function updateGlobalAiInsightReview(
  insightId: string,
  reviewStatus: AiReviewStatus,
  user: UserProfile,
  reviewNotes?: string
): Promise<void> {
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const local = getLocalData<AiAnalysisRecord[]>('ai_insights', []);
  const existing = local.find((i) => i.id === insightId);

  const updates: Partial<AiAnalysisRecord> = sanitizeForFirestore({
    reviewStatus,
    reviewedBy: user.displayName,
    reviewedByRole: formatRoleName(user.role),
    reviewedAt: nowStamp,
    reviewNotes: reviewNotes !== undefined ? reviewNotes : (existing?.reviewNotes ?? null),
  });

  const path = `ai_insights/${insightId}`;
  try {
    await updateDoc(doc(db, 'ai_insights', insightId), updates);
  } catch (err: any) {
    try {
      await setDoc(doc(db, 'ai_insights', insightId), sanitizeForFirestore({ ...(existing || {}), ...updates }), { merge: true });
    } catch (innerErr: any) {
      handleFirestoreError(innerErr, OperationType.UPDATE, path);
    }
  }

  setLocalData(
    'ai_insights',
    local.map((i) => (i.id === insightId ? { ...i, ...updates } : i))
  );

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: `AI_INSIGHT_${reviewStatus.toUpperCase().replace(/\s+/g, '_')}`,
    details: `Meninjau insight AI global (${existing?.analysisType || insightId}) dengan status: ${reviewStatus}.${reviewNotes ? ` Catatan: ${reviewNotes}` : ''}`,
  });
}
