import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import {
  GrievanceCase,
  InvestigationFinding,
  RootCauseAnalysis,
  ActionPlan,
  CommunicationLog,
  EvidenceItem,
  AuditLog,
  MasterCategory,
  MasterDepartment,
  UserProfile,
  UserRole
} from '../types';
import {
  INITIAL_CASES,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_DEPARTMENTS,
  INITIAL_FINDINGS,
  INITIAL_ROOT_CAUSES,
  INITIAL_ACTION_PLANS,
  INITIAL_COMMUNICATIONS,
  INITIAL_EVIDENCE,
  INITIAL_AUDIT_LOGS
} from './mockData';
import * as XLSX from 'xlsx';

// Local storage cache keys for instant initial paint & offline tolerance
const STORAGE_PREFIX = 'sji_hr_v4_cloud_';

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
    console.warn('LocalStorage caching:', err);
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

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const screenRes = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  return `${browser} on ${os} (${isMobile ? 'Mobile' : 'Desktop'}${screenRes ? `, ${screenRes}` : ''})`;
}

// Format Role Name for audits
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

// ==========================================
// 1. REAL-TIME MULTI-USER CLOUD PERSISTENCE
// ==========================================

// Subscribe to real-time Users list from Firestore
export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  const usersCol = collection(db, 'users');

  const unsubscribe = onSnapshot(
    usersCol,
    (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((d) => {
        usersList.push({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) });
      });

      // Sort by display name or creation date
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

// Fetch all registered users from Firestore
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

// Save or update a single user in Firestore
export async function saveUser(user: UserProfile): Promise<void> {
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } catch (err: any) {
    console.warn('Firestore saveUser error:', err.message);
  }
  // Sync local cache
  const cached = getLocalData<UserProfile[]>('users_list', []);
  const existingIdx = cached.findIndex((u) => u.id === user.id);
  const updated = existingIdx >= 0
    ? cached.map((u) => (u.id === user.id ? { ...u, ...user } : u))
    : [...cached, user];
  setLocalData('users_list', updated);
}

// Save bulk users (e.g. array update)
export async function saveUsers(users: UserProfile[]): Promise<void> {
  setLocalData('users_list', users);
  for (const u of users) {
    try {
      await setDoc(doc(db, 'users', u.id), u, { merge: true });
    } catch (err: any) {
      console.warn('Firestore saveUsers error for user', u.id, err.message);
    }
  }
}

// Delete user from Firestore
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

// Record User Access / Login into Firestore
export async function recordUserLogin(user: UserProfile, deviceStr?: string): Promise<void> {
  const device = deviceStr || getDeviceSummary();
  const now = new Date().toISOString();
  const loginCount = (user.loginCount || 0) + 1;

  try {
    await updateDoc(doc(db, 'users', user.id), {
      lastLoginAt: now,
      lastLoginDevice: device,
      loginCount,
    });
  } catch {
    // If updateDoc fails (e.g., doc just created), try setDoc with merge
    try {
      await setDoc(
        doc(db, 'users', user.id),
        {
          ...user,
          lastLoginAt: now,
          lastLoginDevice: device,
          loginCount,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Firestore recordUserLogin fallback:', err.message);
    }
  }

  // Record login event in Audit Logs for compliance tracking
  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'USER_LOGIN',
    details: `Pengguna berhasil login dari perangkat: ${device}. Status: Aktif.`,
    device,
  });
}

// ==========================================
// 2. AUDIT LOGS PERSISTENCE (WHO ACCESSED WHAT)
// ==========================================

export async function logAuditAction(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const newLog: AuditLog = {
    ...log,
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    device: log.device || getDeviceSummary(),
  };

  try {
    await setDoc(doc(db, 'audit_logs', newLog.id), newLog);
  } catch (err: any) {
    console.warn('Audit log write local sync:', err.message);
  }

  const existingLogs = getLocalData<AuditLog[]>('audit_logs', INITIAL_AUDIT_LOGS);
  setLocalData('audit_logs', [newLog, ...existingLogs.slice(0, 199)]);
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void) {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logsList: AuditLog[] = [];
      snapshot.forEach((d) => {
        logsList.push({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) });
      });
      setLocalData('audit_logs', logsList);
      callback(logsList);
    },
    (error) => {
      console.warn('Audit logs listener fallback:', error.message);
      const cached = getLocalData<AuditLog[]>('audit_logs', INITIAL_AUDIT_LOGS);
      callback(cached);
    }
  );

  return unsubscribe;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
      setLocalData('audit_logs', list);
      return list;
    }
  } catch (err: any) {
    console.warn('Audit logs read local fallback:', err.message);
  }
  return getLocalData('audit_logs', INITIAL_AUDIT_LOGS);
}

// ==========================================
// 3. GRIEVANCE CASES CLOUD PERSISTENCE
// ==========================================

// Subscribe to Cases with real-time Firestore sync
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
      casesList.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
      
      // Update local storage cache
      setLocalData('cases', casesList);
      callback(filterCasesByRole(casesList, user));
    },
    (error) => {
      console.warn('Firestore Cases onSnapshot notice, using cached repository:', error.message);
      const cached = getLocalData<GrievanceCase[]>('cases', []);
      callback(filterCasesByRole(cached, user));
    }
  );

  return unsubscribe;
}

// Granular Role-Based Access Control (RBAC) filtering:
// - Department PICs can ONLY see cases assigned to them or their assigned department
// - HR Investigator can ONLY see cases assigned to them or within HR
// - HR Admin and HR Lead have full enterprise visibility
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

  // HR Admin and HR Lead have full enterprise visibility
  return cases;
}

// Add New Case directly to Firestore
export async function createCase(
  caseData: Omit<GrievanceCase, 'id'>,
  user: UserProfile
): Promise<GrievanceCase> {
  const newId = `case-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const fullCase: GrievanceCase = {
    ...caseData,
    id: newId,
    lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  try {
    await setDoc(doc(db, 'cases', newId), fullCase);
  } catch (error: any) {
    console.warn('Saving case locally fallback:', error.message);
  }

  // Update local cache
  const currentCases = getLocalData('cases', INITIAL_CASES);
  const updated = [fullCase, ...currentCases];
  setLocalData('cases', updated);

  // Add audit log
  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'REGISTER_GRIEVANCE',
    caseId: newId,
    ticketId: fullCase.ticketId,
    details: `Mendaftarkan pengaduan baru #${fullCase.ticketId} (${fullCase.department} - ${fullCase.complaintCategory}) melalui saluran ${fullCase.channelReceived}. Prioritas: ${fullCase.priority}.`,
  });

  return fullCase;
}

// Update Case in Firestore
export async function updateCaseRecord(
  caseId: string,
  updates: Partial<GrievanceCase>,
  user: UserProfile,
  reason?: string
): Promise<void> {
  const currentCases = getLocalData('cases', INITIAL_CASES);
  const targetIndex = currentCases.findIndex((c) => c.id === caseId);
  const existingCase = currentCases[targetIndex];

  const updatedRecord: GrievanceCase = {
    ...(existingCase || ({} as GrievanceCase)),
    ...updates,
    lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  try {
    await updateDoc(doc(db, 'cases', caseId), {
      ...updates,
      lastUpdate: updatedRecord.lastUpdate,
    });
  } catch {
    try {
      await setDoc(doc(db, 'cases', caseId), updatedRecord, { merge: true });
    } catch (err: any) {
      console.warn('Firestore updateCaseRecord fallback:', err.message);
    }
  }

  if (targetIndex >= 0) {
    currentCases[targetIndex] = updatedRecord;
    setLocalData('cases', currentCases);
  }

  // Audit
  if (updates.status && existingCase && updates.status !== existingCase.status) {
    await logAuditAction({
      userId: user.id,
      userName: user.displayName,
      userRole: formatRoleName(user.role),
      action: 'UPDATE_STATUS',
      caseId,
      ticketId: updatedRecord.ticketId,
      details: `Status kasus diubah dari "${existingCase.status}" menjadi "${updates.status}". ${reason ? `Catatan: ${reason}` : ''}`,
    });
  } else {
    await logAuditAction({
      userId: user.id,
      userName: user.displayName,
      userRole: formatRoleName(user.role),
      action: 'UPDATE_CASE',
      caseId,
      ticketId: updatedRecord.ticketId,
      details: `Memperbarui data kasus: ${Object.keys(updates).join(', ')}. ${reason ? `Catatan: ${reason}` : ''}`,
    });
  }
}

// Delete Case (for erroneous input / salah input)
export async function deleteCaseRecord(
  caseId: string,
  user: UserProfile,
  reason: string
): Promise<void> {
  const currentCases = getLocalData<GrievanceCase[]>('cases', INITIAL_CASES);
  const targetCase = currentCases.find((c) => c.id === caseId);
  const ticketId = targetCase?.ticketId || caseId;

  // 1. Remove from local storage
  const updatedCases = currentCases.filter((c) => c.id !== caseId);
  setLocalData('cases', updatedCases);

  // 2. Remove associated subcollections from local storage
  const localFindings = getLocalData<Record<string, InvestigationFinding[]>>('findings', INITIAL_FINDINGS);
  if (localFindings[caseId]) {
    delete localFindings[caseId];
    setLocalData('findings', localFindings);
  }

  const localRca = getLocalData<Record<string, RootCauseAnalysis>>('root_causes', INITIAL_ROOT_CAUSES);
  if (localRca[caseId]) {
    delete localRca[caseId];
    setLocalData('root_causes', localRca);
  }

  const localActionPlans = getLocalData<Record<string, ActionPlan[]>>('action_plans', INITIAL_ACTION_PLANS);
  if (localActionPlans[caseId]) {
    delete localActionPlans[caseId];
    setLocalData('action_plans', localActionPlans);
  }

  const localComms = getLocalData<Record<string, CommunicationLog[]>>('communications', INITIAL_COMMUNICATIONS);
  if (localComms[caseId]) {
    delete localComms[caseId];
    setLocalData('communications', localComms);
  }

  const localEvidence = getLocalData<Record<string, EvidenceItem[]>>('evidence', INITIAL_EVIDENCE);
  if (localEvidence[caseId]) {
    delete localEvidence[caseId];
    setLocalData('evidence', localEvidence);
  }

  // 3. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'cases', caseId));
  } catch (error: any) {
    console.warn('Firestore deleteDoc fallback to local state:', error.message);
  }

  // 4. Audit Log
  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'DELETE_CASE',
    caseId,
    ticketId,
    details: `Menghapus kasus #${ticketId} (${targetCase ? targetCase.department + ' - ' + targetCase.complaintCategory : ''}) karena salah input. Alasan: ${reason || 'Salah input pengaduan'}.`,
  });
}

// ==========================================
// 4. SUBCOLLECTIONS PERSISTENCE
// ==========================================

// Subcollection: Investigations
export async function getCaseFindings(caseId: string): Promise<InvestigationFinding[]> {
  try {
    const q = collection(db, 'cases', caseId, 'investigations');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvestigationFinding, 'id'>) }));
    }
  } catch (err: any) {
    console.warn('Fetching findings fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, InvestigationFinding[]>>('findings', INITIAL_FINDINGS);
  return localMap[caseId] || [];
}

export async function addCaseFinding(
  caseId: string,
  finding: Omit<InvestigationFinding, 'id'>,
  user: UserProfile
): Promise<InvestigationFinding> {
  const newId = `fnd-${Date.now().toString(36)}`;
  const fullFinding: InvestigationFinding = { ...finding, id: newId, caseId };

  try {
    await setDoc(doc(db, 'cases', caseId, 'investigations', newId), fullFinding);
  } catch (err: any) {
    console.warn('Cached finding locally:', err.message);
  }

  const localMap = getLocalData<Record<string, InvestigationFinding[]>>('findings', INITIAL_FINDINGS);
  localMap[caseId] = [...(localMap[caseId] || []), fullFinding];
  setLocalData('findings', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'ADD_INVESTIGATION_NOTE',
    caseId,
    details: `Mencatat wawancara investigasi: ${finding.intervieweeName} (${finding.interviewType}).`,
  });

  return fullFinding;
}

// Subcollection: Root Cause Analysis (5 Whys)
export async function getCaseRootCause(caseId: string): Promise<RootCauseAnalysis | null> {
  try {
    const q = collection(db, 'cases', caseId, 'root_causes');
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const first = snapshot.docs[0];
      return { id: first.id, ...(first.data() as Omit<RootCauseAnalysis, 'id'>) };
    }
  } catch (err: any) {
    console.warn('Fetching RCA fallback:', err.message);
  }
  const localMap = getLocalData<Record<string, RootCauseAnalysis>>('root_causes', INITIAL_ROOT_CAUSES);
  return localMap[caseId] || null;
}

export async function saveCaseRootCause(
  caseId: string,
  rca: Omit<RootCauseAnalysis, 'id'>,
  user: UserProfile
): Promise<RootCauseAnalysis> {
  const rcaId = `rc-${caseId}`;
  const fullRca: RootCauseAnalysis = {
    ...rca,
    id: rcaId,
    caseId,
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  try {
    await setDoc(doc(db, 'cases', caseId, 'root_causes', rcaId), fullRca);
  } catch (err: any) {
    console.warn('Cached RCA locally:', err.message);
  }

  const localMap = getLocalData<Record<string, RootCauseAnalysis>>('root_causes', INITIAL_ROOT_CAUSES);
  localMap[caseId] = fullRca;
  setLocalData('root_causes', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'SAVE_ROOT_CAUSE_ANALYSIS',
    caseId,
    details: `Menyimpan Lembar 5 Whys Root Cause Analysis. Kategori: ${rca.primaryCategory}.`,
  });

  return fullRca;
}

// Subcollection: Action Plans (CAPA)
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
  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', INITIAL_ACTION_PLANS);
  return localMap[caseId] || [];
}

export async function addCaseActionPlan(
  caseId: string,
  actionItem: Omit<ActionPlan, 'id'>,
  user: UserProfile
): Promise<ActionPlan> {
  const newId = `act-${Date.now().toString(36)}`;
  const fullPlan: ActionPlan = { ...actionItem, id: newId, caseId };

  try {
    await setDoc(doc(db, 'cases', caseId, 'action_plans', newId), fullPlan);
  } catch (err: any) {
    console.warn('Cached action plan locally:', err.message);
  }

  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', INITIAL_ACTION_PLANS);
  localMap[caseId] = [...(localMap[caseId] || []), fullPlan];
  setLocalData('action_plans', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'CREATE_ACTION_PLAN',
    caseId,
    details: `Menambahkan item CAPA: "${actionItem.title}" ditugaskan ke ${actionItem.assignedTo}.`,
  });

  return fullPlan;
}

export async function updateActionPlanStatus(
  caseId: string,
  planId: string,
  status: ActionPlan['status'],
  user: UserProfile,
  verificationNotes?: string
): Promise<void> {
  const localMap = getLocalData<Record<string, ActionPlan[]>>('action_plans', INITIAL_ACTION_PLANS);
  const items = localMap[caseId] || [];
  const target = items.find((i) => i.id === planId);
  if (target) {
    target.status = status;
    if (status === 'Completed' || status === 'Verified') {
      target.completedDate = new Date().toISOString().substring(0, 10);
    }
    if (verificationNotes) {
      target.verificationNotes = verificationNotes;
      target.verifiedBy = user.displayName;
    }
    setLocalData('action_plans', localMap);
  }

  try {
    await updateDoc(doc(db, 'cases', caseId, 'action_plans', planId), {
      status,
      completedDate: status === 'Completed' ? new Date().toISOString().substring(0, 10) : null,
      verificationNotes: verificationNotes || null,
      verifiedBy: verificationNotes ? user.displayName : null,
    });
  } catch (err: any) {
    console.warn('Action plan update error:', err.message);
  }

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'UPDATE_ACTION_PLAN_STATUS',
    caseId,
    details: `Mengubah progress CAPA menjadi status ${status}.`,
  });
}

// Subcollection: Communication Log
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
  const localMap = getLocalData<Record<string, CommunicationLog[]>>('comms', INITIAL_COMMUNICATIONS);
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
    await setDoc(doc(db, 'cases', caseId, 'communications', newId), fullComm);
  } catch (err: any) {
    console.warn('Comms save local sync:', err.message);
  }

  const localMap = getLocalData<Record<string, CommunicationLog[]>>('comms', INITIAL_COMMUNICATIONS);
  localMap[caseId] = [...(localMap[caseId] || []), fullComm];
  setLocalData('comms', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'LOG_COMMUNICATION',
    caseId,
    details: `Mencatat korespondensi ${comm.type}: "${comm.subject}" (Tujuan: ${comm.recipient}).`,
  });

  return fullComm;
}

// Subcollection: Evidence Management
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
    const localMap = getLocalData<Record<string, EvidenceItem[]>>('evidence', INITIAL_EVIDENCE);
    list = localMap[caseId] || [];
  }

  // Security constraint: If Department PIC, mask confidential evidence files
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
    await setDoc(doc(db, 'cases', caseId, 'evidence', newId), fullEvidence);
  } catch (err: any) {
    console.warn('Evidence save local sync:', err.message);
  }

  const localMap = getLocalData<Record<string, EvidenceItem[]>>('evidence', INITIAL_EVIDENCE);
  localMap[caseId] = [...(localMap[caseId] || []), fullEvidence];
  setLocalData('evidence', localMap);

  await logAuditAction({
    userId: user.id,
    userName: user.displayName,
    userRole: formatRoleName(user.role),
    action: 'UPLOAD_EVIDENCE',
    caseId,
    details: `Mengunggah berkas bukti: "${evidence.title}" (${evidence.fileName}) [Kerahasiaan: ${evidence.isConfidential ? 'Rahasia' : 'Biasa'}].`,
  });

  return fullEvidence;
}

// ==========================================
// 5. MASTER DATA (CATEGORIES & DEPARTMENTS)
// ==========================================

export async function getCategories(): Promise<MasterCategory[]> {
  try {
    const docSnap = await getDoc(doc(db, 'master_data', 'categories'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocalData('master_categories_sji_v4', data.list);
        return data.list;
      }
    }
    // Seed default categories if not present in Firestore
    await setDoc(doc(db, 'master_data', 'categories'), { list: INITIAL_CATEGORIES });
    setLocalData('master_categories_sji_v4', INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  } catch (err: any) {
    console.warn('Error fetching categories from Firestore, using cache:', err.message);
  }

  const cached = getLocalData<MasterCategory[]>('master_categories_sji_v4', []);
  if (!cached || cached.length === 0) {
    setLocalData('master_categories_sji_v4', INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  }
  return cached;
}

export async function saveCategories(categories: MasterCategory[]): Promise<void> {
  setLocalData('master_categories_sji_v4', categories);
  try {
    await setDoc(doc(db, 'master_data', 'categories'), { list: categories });
  } catch (err: any) {
    console.warn('Error saving categories to Firestore:', err.message);
  }
}

export async function getDepartments(): Promise<MasterDepartment[]> {
  try {
    const docSnap = await getDoc(doc(db, 'master_data', 'departments'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocalData('master_departments_sji_v4', data.list);
        return data.list;
      }
    }
    // Seed default departments if not present in Firestore
    await setDoc(doc(db, 'master_data', 'departments'), { list: INITIAL_DEPARTMENTS });
    setLocalData('master_departments_sji_v4', INITIAL_DEPARTMENTS);
    return INITIAL_DEPARTMENTS;
  } catch (err: any) {
    console.warn('Error fetching departments from Firestore, using cache:', err.message);
  }

  const cached = getLocalData<MasterDepartment[]>('master_departments_sji_v4', []);
  if (!cached || cached.length === 0) {
    setLocalData('master_departments_sji_v4', INITIAL_DEPARTMENTS);
    return INITIAL_DEPARTMENTS;
  }
  return cached;
}

export async function saveDepartments(departments: MasterDepartment[]): Promise<void> {
  setLocalData('master_departments_sji_v4', departments);
  try {
    await setDoc(doc(db, 'master_data', 'departments'), { list: departments });
  } catch (err: any) {
    console.warn('Error saving departments to Firestore:', err.message);
  }
}

// ==========================================
// 6. EXCEL EXPORT & IMPORT UTILITIES
// ==========================================

export function exportCasesToExcel(cases: GrievanceCase[], format: 'xlsx' | 'csv' = 'xlsx') {
  const exportData = cases.map((c) => ({
    'Ticket ID': c.ticketId,
    'Date Received': c.dateReceived,
    'Instrument (Saluran)': c.channelReceived || 'Online',
    'Employee Name': c.isAnonymous ? `${c.anonymousAlias || 'Protected Whistleblower'} (Anonymous)` : c.employeeName,
    'Department': c.department,
    'Complaint Category': c.complaintCategory,
    'Priority': c.priority,
    'Status': c.status,
    'Assigned PIC': c.assignedPic,
    'Progress (%)': c.progress,
    'Due Date': c.dueDate,
    'Closing Date': c.closingDate || '-',
    'SLA Status': c.slaStatus,
    'SLA Hours Left': c.slaHoursLeft,
    'Last Update': c.lastUpdate,
    'Description': c.description,
    'Resolution Summary': c.resolutionSummary || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Grievance Cases');

  const fileName = `SJI_Grievances_${new Date().toISOString().substring(0, 10)}.${format}`;
  XLSX.writeFile(workbook, fileName, { bookType: format });
}

export async function parseExcelImport(file: File): Promise<Partial<GrievanceCase>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsedCases: Partial<GrievanceCase>[] = rawJson.map((row, idx) => {
          const ticketId = row['Ticket ID'] || row['ticketId'] || `GRV-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`;
          const dateReceived = row['Date Received'] || row['dateReceived'] || new Date().toISOString().substring(0, 10);
          const employeeName = row['Employee Name'] || row['employeeName'] || 'Pelapor Tidak Disebutkan';
          const isAnonymous = Boolean(row['Is Anonymous'] || row['isAnonymous'] || employeeName.toLowerCase().includes('anon'));
          const department = row['Department'] || row['department'] || 'HR';
          const complaintCategory = row['Complaint Category'] || row['complaintCategory'] || 'Kebijakan';
          const priority = (row['Priority'] || row['priority'] || 'Major') as any;
          const status = (row['Status'] || row['status'] || 'Open') as any;
          const assignedPic = row['Assigned PIC'] || row['assignedPic'] || 'Unassigned';
          const dueDate = row['Due Date'] || row['dueDate'] || new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
          const channelReceived = row['Instrument (Saluran)'] || row['channelReceived'] || 'Online';
          const description = row['Description'] || row['description'] || row['Uraian Keluhan'] || 'Data diimpor dari file spreadsheet.';

          return {
            ticketId,
            dateReceived,
            employeeName,
            isAnonymous,
            anonymousAlias: isAnonymous ? `Whistleblower #${Math.floor(1000 + Math.random() * 9000)}` : undefined,
            department,
            complaintCategory,
            priority,
            status,
            assignedPic,
            assignedPicId: 'usr-admin-01',
            assignedInvestigator: '',
            assignedInvestigatorId: '',
            progress: status === 'Closed' ? 100 : 20,
            dueDate,
            slaStatus: 'On Track',
            slaHoursLeft: 72,
            channelReceived,
            description,
          };
        });

        resolve(parsedCases);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
