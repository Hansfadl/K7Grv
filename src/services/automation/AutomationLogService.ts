import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { AutomationLogItem, AutomationEventType, AutomationExecutionStatus } from '../../types';

const LOG_STORAGE_KEY = 'sji_automation_logs_cache';
let inMemoryLogsFallback: AutomationLogItem[] = [];

function getLocalLogs(): AutomationLogItem[] {
  if (typeof localStorage === 'undefined') return inMemoryLogsFallback;
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return inMemoryLogsFallback;
  }
}

function setLocalLogs(logs: AutomationLogItem[]) {
  inMemoryLogsFallback = logs.slice(0, 300);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch (err) {
    console.warn('Local log cache error:', err);
  }
}

function sanitizeLog<T extends Record<string, any>>(obj: T): T {
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

// In-memory idempotency cache for fast sub-second deduplication
const seenIdempotencyKeys = new Map<string, number>();

export class AutomationLogService {
  /**
   * Checks if an event with this idempotency key was already processed recently
   * (within windowMs, default 1 hour)
   */
  static isDuplicate(key: string, windowMs = 3600000): boolean {
    if (!key) return false;
    const now = Date.now();
    const lastSeen = seenIdempotencyKeys.get(key);
    if (lastSeen && now - lastSeen < windowMs) {
      return true;
    }
    // Check in local cache
    const cached = getLocalLogs();
    const found = cached.find((l) => l.idempotencyKey === key);
    if (found) {
      const logTime = new Date(found.triggerDate).getTime();
      if (!isNaN(logTime) && now - logTime < windowMs) {
        seenIdempotencyKeys.set(key, logTime);
        return true;
      }
    }
    return false;
  }

  /**
   * Records a new automation log entry with idempotency registration
   */
  static async recordLog(entry: {
    eventType: AutomationEventType;
    ticketId?: string;
    caseId?: string;
    recipient: string;
    recipientId?: string;
    executionStatus: AutomationExecutionStatus;
    deliveryStatus: 'Delivered' | 'Undelivered' | 'Queued' | 'Suppressed';
    errorMessage?: string;
    retryCount?: number;
    idempotencyKey: string;
    details?: string;
    payload?: Record<string, any>;
  }): Promise<AutomationLogItem> {
    const now = new Date();
    // Jakarta format
    const jakartaTime = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);

    const logId = `auto-log-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const automationId = `AUT-${entry.eventType}-${Date.now().toString(36).toUpperCase()}`;

    const fullLog: AutomationLogItem = {
      id: logId,
      automationId,
      eventType: entry.eventType,
      ticketId: entry.ticketId,
      caseId: entry.caseId,
      recipient: entry.recipient,
      recipientId: entry.recipientId,
      triggerDate: jakartaTime.replace(/\//g, '-'),
      executionStatus: entry.executionStatus,
      deliveryStatus: entry.deliveryStatus,
      errorMessage: entry.errorMessage,
      retryCount: entry.retryCount ?? 0,
      idempotencyKey: entry.idempotencyKey,
      details: entry.details,
      payload: entry.payload,
      createdAt: now.toISOString(),
    };

    // Record in-memory key
    seenIdempotencyKeys.set(entry.idempotencyKey, Date.now());

    // Update local cache first
    const cached = getLocalLogs();
    const updated = [fullLog, ...cached.filter((l) => l.id !== logId)].slice(0, 300);
    setLocalLogs(updated);

    // Save to Firestore non-blocking
    try {
      await setDoc(doc(db, 'automation_logs', logId), sanitizeLog(fullLog));
    } catch (err: any) {
      console.warn('Firestore automation_logs write notice:', err.message);
    }

    return fullLog;
  }

  /**
   * Fetches latest automation logs from Firestore or cache
   */
  static async getLogs(limitCount = 100): Promise<AutomationLogItem[]> {
    try {
      const q = query(collection(db, 'automation_logs'), limit(limitCount));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: AutomationLogItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<AutomationLogItem, 'id'>) });
        });
        // Sort descending by createdAt
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLocalLogs(list);
        return list;
      }
    } catch (err: any) {
      console.warn('Fetch automation logs notice:', err.message);
    }
    return getLocalLogs();
  }

  /**
   * Realtime subscription for Automation Log dashboard
   */
  static subscribeToLogs(callback: (logs: AutomationLogItem[]) => void) {
    try {
      const q = collection(db, 'automation_logs');
      return onSnapshot(
        q,
        (snapshot) => {
          const list: AutomationLogItem[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<AutomationLogItem, 'id'>) });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLocalLogs(list);
          callback(list);
        },
        (error) => {
          console.warn('Automation logs onSnapshot fallback:', error.message);
          callback(getLocalLogs());
        }
      );
    } catch {
      callback(getLocalLogs());
      return () => {};
    }
  }
}
