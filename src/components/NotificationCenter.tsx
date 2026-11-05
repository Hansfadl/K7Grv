import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCases } from '../context/CaseContext';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Clock,
  AlertTriangle,
  FolderGit2,
  UserCheck,
  ShieldAlert,
  ClipboardList,
  CheckCircle2,
  X,
  Filter
} from 'lucide-react';
import { NotificationItem, NotificationCategory } from '../types';
import { NotificationService } from '../services/automation/NotificationService';

export const NotificationCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const { cases, openCaseDetail } = useCases();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime notifications for the current authenticated user
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = NotificationService.subscribeUserNotifications(currentUser, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const handleOpenCase = (notif: NotificationItem) => {
    if (!notif.isRead) {
      NotificationService.markAsRead(notif.id);
    }

    if (notif.ticketId || notif.caseId) {
      const foundCase = cases.find(
        (c) => (notif.caseId && c.id === notif.caseId) || (notif.ticketId && c.ticketId === notif.ticketId)
      );

      if (foundCase) {
        const tab = notif.targetTab || 'overview';
        openCaseDetail(foundCase, tab as any);
        setIsOpen(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    const unread = notifications.filter((n) => !n.isRead);
    await NotificationService.markAllAsRead(currentUser, unread);
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'Critical Case Alert':
      case 'Overdue Alert':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'SLA Reminder':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'New Grievance':
        return <FolderGit2 className="w-4 h-4 text-blue-500" />;
      case 'New PIC Assignment':
        return <UserCheck className="w-4 h-4 text-indigo-500" />;
      case 'Action Plan Reminder':
        return <ClipboardList className="w-4 h-4 text-emerald-500" />;
      case 'Approval Request':
        return <ShieldAlert className="w-4 h-4 text-purple-500" />;
      case 'Case Closed':
      case 'Case Resolved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryBadgeClass = (category: NotificationCategory) => {
    switch (category) {
      case 'Critical Case Alert':
      case 'Overdue Alert':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SLA Reminder':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'New Grievance':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'New PIC Assignment':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Action Plan Reminder':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Approval Request':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Case Closed':
      case 'Case Resolved':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;

      const now = new Date();
      const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return 'Baru saja';
      if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
      const diffHours = Math.round(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;

      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Pusat Notifikasi & Eskalasi"
        aria-label="Pusat Notifikasi"
        className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm">Pusat Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {unreadCount} Baru
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-slate-300 hover:text-white flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                  title="Tandai semua telah dibaca"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                  <span>Baca Semua</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
            <div className="flex space-x-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filter === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filter === 'unread' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('read')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filter === 'read' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dibaca
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">Asia/Jakarta</span>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-400 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">Tidak ada notifikasi</p>
                <p className="mt-1 text-[11px]">
                  {filter === 'unread'
                    ? 'Semua notifikasi penting telah Anda baca.'
                    : 'Belum ada catatan aktivitas untuk akun Anda.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 transition flex flex-col gap-2 ${
                    notif.isRead ? 'bg-white hover:bg-slate-50/70' : 'bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="p-1 rounded bg-white shadow-2xs border border-slate-100">
                        {getCategoryIcon(notif.category)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadgeClass(
                          notif.category
                        )}`}
                      >
                        {notif.category}
                      </span>
                      {notif.ticketId && (
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">
                          #{notif.ticketId}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatTimestamp(notif.createdAt)}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <div>
                    <h4
                      className={`text-xs ${
                        notif.isRead ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center space-x-2">
                      {notif.ticketId && (
                        <button
                          type="button"
                          onClick={() => handleOpenCase(notif)}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold transition"
                        >
                          <span>Buka Kasus</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {!notif.isRead ? (
                      <button
                        type="button"
                        onClick={() => NotificationService.markAsRead(notif.id)}
                        className="text-slate-400 hover:text-slate-700 text-[10px] font-medium flex items-center space-x-0.5 transition"
                      >
                        <Check className="w-3 h-3 mr-0.5" />
                        <span>Tandai dibaca</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 flex items-center">
                        <CheckCheck className="w-3 h-3 text-slate-400 mr-1" />
                        Dibaca
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium">
            <span>SJI HR Automation Engine • Confidentiality Protected</span>
          </div>
        </div>
      )}
    </div>
  );
};
