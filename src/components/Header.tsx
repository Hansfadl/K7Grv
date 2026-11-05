import React, { useState } from 'react';
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
  Menu,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen = true, onToggleSidebar }) => {
  const {
    currentUser,
    logout,
    confidentialMode,
    toggleConfidentialMode,
    canRegisterCase,
  } = useAuth();

  const { setIsNewCaseModalOpen, setIsImportModalOpen, stats } = useCases();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'hr_admin':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">HR Admin</span>;
      case 'hr_investigator':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">HR Investigator</span>;
      case 'hr_lead':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800 border border-purple-200">HR Lead</span>;
      case 'department_pic':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Department PIC</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-800">Staff</span>;
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo, Sidebar Toggle & Title */}
          <div className="flex items-center space-x-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title={isSidebarOpen ? 'Tutup Sidebar' : 'Buka Sidebar'}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
              >
                {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
              </button>
            )}

            <div className="bg-white px-2 py-1 rounded-lg flex items-center justify-center shadow-xs">
              <img
                src="/assets/aistudio/logo_sji-02_36d1cfb8.png"
                alt="Shoenary Javanesia Inc."
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white uppercase">
                  HR Grievance Management System
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 mr-1" />
                  RESTRICTED PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center">
                <span className="font-medium text-slate-300">PT Shoenary Javanesia Inc.</span>
                <span className="mx-1.5 text-slate-600">•</span>
                <span>Authorized HR Operations &amp; PIC Workspace</span>
                {currentUser?.role === 'department_pic' && (
                  <span className="ml-2 text-amber-300 font-medium">
                    (Dibatasi Kasus {currentUser.department})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Tools & Session Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Urgent SLA Alert Pill */}
            {stats.slaBreachedCount > 0 && (
              <div className="hidden lg:flex items-center px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-medium animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                <span>{stats.slaBreachedCount} Kasus Overdue</span>
              </div>
            )}

            {/* Confidential Anonymity Mask Toggle */}
            <button
              onClick={toggleConfidentialMode}
              title={confidentialMode ? 'Identitas pelapor rahasia sedang disamarkan' : 'Klik untuk menyamarkan identitas pelapor'}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                confidentialMode
                  ? 'bg-slate-800 text-emerald-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-rose-950 text-rose-300 border-rose-800 hover:bg-rose-900'
              }`}
            >
              {confidentialMode ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Anonymity Mask: Aktif</span>
                  <EyeOff className="w-3 h-3 text-slate-400" />
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Identitas: Terlihat</span>
                </>
              )}
            </button>

            {/* Quick Action Buttons for HR Admin */}
            {canRegisterCase && (
              <div className="hidden md:flex items-center space-x-2">
                <button
                  onClick={() => setIsNewCaseModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Daftarkan Keluhan</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                  title="Import data keluhan dari file Excel/CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Import Excel</span>
                </button>
              </div>
            )}

            {/* Notification Center */}
            <NotificationCenter />

            {/* User Profile & Secure Sign Out Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-700 border border-blue-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    currentUser?.displayName.charAt(0) || 'U'
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser?.displayName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser?.department}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Secure Dropdown Menu - No Unauthorized Switching */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-900 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Akun Aktif Terautentikasi
                    </p>
                    <p className="text-sm font-bold text-slate-900">{currentUser?.displayName}</p>
                    <p className="text-xs text-slate-500">{currentUser?.email}</p>
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

                  <div className="pt-2 px-3">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition"
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
