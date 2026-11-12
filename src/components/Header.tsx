import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCases } from '../context/CaseContext';
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  LogOut,
  ChevronDown,
  FileSpreadsheet,
  PlusCircle,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  Bell,
  Search,
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  CheckCheck
} from 'lucide-react';
import { GrievanceCase } from '../types';

interface HeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onNavigateToCases?: () => void;
}

interface NotificationItem {
  id: string;
  ticketId: string;
  caseItem: GrievanceCase;
  type: 'critical' | 'overdue' | 'approaching' | 'assignment' | 'action_taken' | 'closed';
  title: string;
  message: string;
  timestamp: string;
  isUrgent: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen = true,
  onToggleSidebar,
  onNavigateToCases
}) => {
  const {
    currentUser,
    logout,
    confidentialMode,
    toggleConfidentialMode,
    canRegisterCase,
  } = useAuth();

  const {
    setIsNewCaseModalOpen,
    setIsImportModalOpen,
    stats,
    cases,
    openCaseDetail,
    searchQuery,
    setSearchQuery,
  } = useCases();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sji_read_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save read notification state
  useEffect(() => {
    try {
      localStorage.setItem('sji_read_notifications', JSON.stringify(readNotificationIds));
    } catch {
      // quiet fail
    }
  }, [readNotificationIds]);

  // Dynamically derive live enterprise notifications from real cases
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];

    cases.forEach((c) => {
      const complainant = c.isAnonymous
        ? (confidentialMode ? 'Whistleblower Terlindungi' : c.anonymousAlias || 'Whistleblower')
        : c.employeeName;

      // 1. Critical Urgency Cases
      if (c.priority === 'Critical' && c.status !== 'Closed') {
        list.push({
          id: `crit-${c.id}`,
          ticketId: c.ticketId,
          caseItem: c,
          type: 'critical',
          title: `Eskalasi Eksekutif: #${c.ticketId}`,
          message: `Kasus Kritis (${c.complaintCategory} - ${c.department}). Mandat eskalasi 72 jam. Pelapor: ${complainant}.`,
          timestamp: c.lastUpdate || c.dateReceived,
          isUrgent: true,
        });
      }

      // 2. Overdue Breached Cases
      if (c.slaStatus === 'Breached' && c.status !== 'Closed') {
        list.push({
          id: `breach-${c.id}`,
          ticketId: c.ticketId,
          caseItem: c,
          type: 'overdue',
          title: `SLA Overdue: #${c.ticketId}`,
          message: `Batas waktu penanganan kasus (${c.dueDate}) telah terlewati. Segera ambil tindakan penyelidikan.`,
          timestamp: c.lastUpdate || c.dueDate,
          isUrgent: true,
        });
      }

      // 3. Approaching Due Date (< 48h)
      if (c.slaStatus === 'Approaching Due' && c.status !== 'Closed') {
        list.push({
          id: `appr-${c.id}`,
          ticketId: c.ticketId,
          caseItem: c,
          type: 'approaching',
          title: `Batas Waktu Mendekat: #${c.ticketId}`,
          message: `Tersisa ${c.slaHoursLeft} jam sebelum deadline target ${c.dueDate} (${c.department}).`,
          timestamp: c.lastUpdate || c.dateReceived,
          isUrgent: false,
        });
      }

      // 4. In Action Taken / Remediation
      if (c.status === 'Action Taken') {
        list.push({
          id: `act-${c.id}`,
          ticketId: c.ticketId,
          caseItem: c,
          type: 'action_taken',
          title: `Rencana Tindakan (CAPA): #${c.ticketId}`,
          message: `Kasus dalam fase tindakan perbaikan. PIC: ${c.assignedPic || 'Departemen Terkait'}.`,
          timestamp: c.lastUpdate || c.dateReceived,
          isUrgent: false,
        });
      }
    });

    return list.slice(0, 20);
  }, [cases, confidentialMode]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readNotificationIds.includes(n.id)).length;
  }, [notifications, readNotificationIds]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isRead = readNotificationIds.includes(n.id);
      if (notificationFilter === 'unread') return !isRead;
      if (notificationFilter === 'urgent') return n.isUrgent;
      return true;
    });
  }, [notifications, notificationFilter, readNotificationIds]);

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  const markItemAsRead = (id: string) => {
    setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleOpenNotificationCase = (item: NotificationItem) => {
    markItemAsRead(item.id);
    setShowNotifications(false);
    openCaseDetail(item.caseItem);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'hr_admin':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">HR Admin</span>;
      case 'hr_investigator':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">HR Investigator</span>;
      case 'hr_lead':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-purple-100 text-purple-800 border border-purple-200">HR Lead / Mgr</span>;
      case 'department_pic':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Department PIC</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-800">Staff</span>;
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* LEFT: Logo, Sidebar Toggle & System Title */}
          <div className="flex items-center space-x-3 min-w-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title={isSidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/80 shrink-0"
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
            )}

            <div className="bg-white px-2 py-1 rounded-lg flex items-center justify-center shadow-xs shrink-0 border border-slate-700/50">
              <img
                src="/assets/aistudio/logo_sji-02_36d1cfb8.png"
                alt="PT Shoenary Javanesia Inc."
                className="h-7 w-auto object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white uppercase truncate">
                  HR Grievance System
                </h1>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 mr-1" />
                  RESTRICTED PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center truncate">
                <span className="font-semibold text-slate-300">PT Shoenary Javanesia Inc.</span>
                <span className="hidden sm:inline mx-1.5 text-slate-600">•</span>
                <span className="hidden sm:inline">Authorized Operations Workspace</span>
                {currentUser?.role === 'department_pic' && (
                  <span className="ml-1.5 text-amber-300 font-medium truncate">
                    ({currentUser.department})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* CENTER: Clean Global Search Input */}
          <div className="hidden md:flex flex-1 max-w-xs lg:max-w-md mx-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari tiket, pelapor, departemen, PIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Notifications, Privacy Mask, Quick Actions & Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Confidential Anonymity Mask Toggle */}
            <button
              onClick={toggleConfidentialMode}
              title={confidentialMode ? 'Identitas pelapor rahasia sedang disamarkan' : 'Klik untuk menyamarkan identitas pelapor'}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                confidentialMode
                  ? 'bg-slate-800 text-emerald-300 border-slate-700 hover:bg-slate-750'
                  : 'bg-rose-950/70 text-rose-300 border-rose-800 hover:bg-rose-900/80'
              }`}
            >
              {confidentialMode ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">Masking: Aktif</span>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">Identitas: Terbuka</span>
                </>
              )}
            </button>

            {/* Notification Center Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-lg border transition ${
                  showNotifications
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700/80'
                }`}
                title="Pusat Notifikasi Kasus & SLA"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] text-[10px] font-bold rounded-full bg-rose-600 text-white border border-slate-900 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Popover Header */}
                  <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-xs">Notification Center</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                          {unreadCount} Baru
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-blue-300 hover:text-white flex items-center space-x-1 font-medium transition"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Tandai Semua Terbaca</span>
                      </button>
                    )}
                  </div>

                  {/* Filter Sub-nav */}
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setNotificationFilter('all')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          notificationFilter === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({notifications.length})
                      </button>
                      <button
                        onClick={() => setNotificationFilter('unread')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          notificationFilter === 'unread'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Belum Dibaca ({unreadCount})
                      </button>
                      <button
                        onClick={() => setNotificationFilter('urgent')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          notificationFilter === 'urgent'
                            ? 'bg-rose-600 text-white'
                            : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        Urgensi Kritis
                      </button>
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                        <p className="text-xs font-medium">Tidak ada notifikasi aktif</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Semua proses operasional berjalan normal</p>
                      </div>
                    ) : (
                      filteredNotifications.map((item) => {
                        const isRead = readNotificationIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`p-3 text-xs transition flex flex-col space-y-1.5 ${
                              isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  item.type === 'critical'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : item.type === 'overdue'
                                    ? 'bg-rose-600 text-white'
                                    : item.type === 'approaching'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {item.type === 'critical'
                                  ? 'Critical 72h'
                                  : item.type === 'overdue'
                                  ? 'Overdue Breached'
                                  : item.type === 'approaching'
                                  ? 'Approaching SLA'
                                  : 'CAPA Action'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.timestamp}
                              </span>
                            </div>

                            <p className="font-semibold text-slate-900 leading-tight">
                              {item.title}
                            </p>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {item.message}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              {!isRead && (
                                <button
                                  onClick={() => markItemAsRead(item.id)}
                                  className="text-[10px] text-slate-500 hover:text-slate-800 font-medium underline"
                                >
                                  Tandai terbaca
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenNotificationCase(item)}
                                className="ml-auto inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-blue-600 text-white text-[10px] font-bold transition"
                              >
                                <span>Buka Tiket #{item.ticketId}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Button for HR Admin */}
            {canRegisterCase && (
              <button
                onClick={() => setIsNewCaseModalOpen(true)}
                className="hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Daftarkan Keluhan</span>
              </button>
            )}

            {/* User Profile & Secure Sign Out Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-left transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-700 border border-blue-400 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-xs shrink-0">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    currentUser?.displayName.charAt(0) || 'U'
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight truncate max-w-[110px]">
                    {currentUser?.displayName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                    {currentUser?.department || 'Staff'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {/* Secure Profile Dropdown */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 rounded-t-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Akun Aktif Terverifikasi
                    </p>
                    <p className="text-sm font-bold text-slate-900 truncate">{currentUser?.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {currentUser && getRoleBadge(currentUser.role)}
                      <span className="text-[11px] text-slate-600 font-medium">
                        Dept: {currentUser?.department}
                      </span>
                    </div>
                    {currentUser?.employeeId && (
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">NIK: {currentUser.employeeId}</p>
                    )}
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Keluar (Sign Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
