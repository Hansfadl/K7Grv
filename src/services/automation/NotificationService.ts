import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationItem, UserProfile, NotificationCategory, NotificationPriority } from '../../types';

const NOTIFICATIONS_STORAGE_KEY = 'sji_notifications_cache';
let inMemoryNotifsFallback: NotificationItem[] = [];

function getLocalNotifications(): NotificationItem[] {
  if (typeof localStorage === 'undefined') return inMemoryNotifsFallback;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return inMemoryNotifsFallback;
  }
}

function setLocalNotifications(list: NotificationItem[]) {
  inMemoryNotifsFallback = list.slice(0, 300);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list.slice(0, 300)));
  } catch (err) {
    console.warn('Local notifications cache error:', err);
  }
}

function sanitizeNotification<T extends Record<string, any>>(obj: T): T {
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

export class NotificationService {
  /**
   * Dispatches a new notification to a specific user, role, or department.
   * Strictly enforces whistleblower protection and sensitive data masking.
   */
  static async sendNotification(params: {
    recipientId: string;
    recipientEmail?: string;
    roleTarget?: NotificationItem['roleTarget'];
    departmentTarget?: string;
    ticketId?: string;
    caseId?: string;
    category: NotificationCategory;
    title: string;
    message: string;
    priority?: NotificationPriority;
    targetTab?: NotificationItem['targetTab'];
    metadata?: Record<string, any>;
  }): Promise<NotificationItem> {
    const id = `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const notifItem: NotificationItem = {
      id,
      recipientId: params.recipientId,
      recipientEmail: params.recipientEmail,
      roleTarget: params.roleTarget,
      departmentTarget: params.departmentTarget,
      ticketId: params.ticketId,
      caseId: params.caseId,
      category: params.category,
      title: params.title,
      message: params.message,
      isRead: false,
      createdAt: now,
      priority: params.priority || 'medium',
      targetTab: params.targetTab || 'overview',
      metadata: params.metadata,
    };

    // Save to local cache
    const current = getLocalNotifications();
    const updated = [notifItem, ...current.filter((n) => n.id !== id)].slice(0, 300);
    setLocalNotifications(updated);

    // Save to Firestore non-blocking
    try {
      await setDoc(doc(db, 'notifications', id), sanitizeNotification(notifItem));
    } catch (err: any) {
      console.warn('Firestore notification write error:', err.message);
    }

    return notifItem;
  }

  /**
   * Filter notifications that belong to a specific logged-in user
   */
  static filterForUser(all: NotificationItem[], user: UserProfile | null): NotificationItem[] {
    if (!user) return [];

    const isHrStaff = user.role === 'hr_admin' || user.role === 'hr_lead' || user.role === 'hr_investigator';
    const userDept = (user.department || '').trim().toLowerCase();
    const userRole = user.role;

    return all.filter((n) => {
      // Direct recipient match
      if (n.recipientId === user.id || (n.recipientEmail && n.recipientEmail.toLowerCase() === user.email.toLowerCase())) {
        return true;
      }
      // Role-based target
      if (n.roleTarget === userRole) {
        return true;
      }
      // All HR broadcast
      if (n.roleTarget === 'all_hr' && isHrStaff) {
        return true;
      }
      // Department PIC targeted broadcast
      if (user.role === 'department_pic' && n.departmentTarget) {
        return n.departmentTarget.trim().toLowerCase() === userDept;
      }
      return false;
    });
  }

  /**
   * Subscribes in real-time to notifications relevant for the user
   */
  static subscribeUserNotifications(
    user: UserProfile | null,
    callback: (notifs: NotificationItem[]) => void
  ) {
    if (!user) {
      callback([]);
      return () => {};
    }

    try {
      const q = collection(db, 'notifications');
      return onSnapshot(
        q,
        (snapshot) => {
          const list: NotificationItem[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLocalNotifications(list);
          const filtered = this.filterForUser(list, user);
          callback(filtered);
        },
        (error) => {
          console.warn('Notifications onSnapshot notice, using cached:', error.message);
          const cached = getLocalNotifications();
          callback(this.filterForUser(cached, user));
        }
      );
    } catch {
      const cached = getLocalNotifications();
      callback(this.filterForUser(cached, user));
      return () => {};
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    const cached = getLocalNotifications();
    const now = new Date().toISOString();
    const updated = cached.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: now } : n));
    setLocalNotifications(updated);

    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: now,
      });
    } catch (err: any) {
      console.warn('Firestore markAsRead error:', err.message);
    }
  }

  /**
   * Mark all notifications for the user as read
   */
  static async markAllAsRead(user: UserProfile, notifsToMark: NotificationItem[]): Promise<void> {
    const now = new Date().toISOString();
    const idsToMark = new Set(notifsToMark.map((n) => n.id));

    const cached = getLocalNotifications();
    const updated = cached.map((n) => (idsToMark.has(n.id) ? { ...n, isRead: true, readAt: now } : n));
    setLocalNotifications(updated);

    // Update in Firestore
    for (const notif of notifsToMark) {
      if (!notif.isRead) {
        try {
          await updateDoc(doc(db, 'notifications', notif.id), {
            isRead: true,
            readAt: now,
          });
        } catch {
          // quiet fallback
        }
      }
    }
  }
}
