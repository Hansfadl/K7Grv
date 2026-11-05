/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CaseProvider, useCases } from './context/CaseContext';
import { Header } from './components/Header';
import { Sidebar, AppModule } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CaseManagementView } from './components/CaseManagementView';
import { InvestigationView } from './components/InvestigationView';
import { RootCauseView } from './components/RootCauseView';
import { ActionPlanView } from './components/ActionPlanView';
import { CommunicationView } from './components/CommunicationView';
import { EvidenceView } from './components/EvidenceView';
import { ReportsView } from './components/ReportsView';
import { MasterDataView } from './components/MasterDataView';
import { UserManagementView } from './components/UserManagementView';
import { CaseDetailModal } from './components/CaseDetailModal';
import { NewCaseModal } from './components/NewCaseModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { LoginView } from './components/LoginView';
import { GrievanceCase } from './types';
import { ToastProvider } from './context/ToastContext';
import { ChevronRight, ArrowLeft } from 'lucide-react';

const MODULE_TITLES: Record<AppModule, { title: string; category: string }> = {
  dashboard: { title: 'Dashboard Utama', category: 'Overview' },
  cases: { title: 'Case Management Directory', category: 'Kasus' },
  investigation: { title: 'Investigasi Lapangan', category: 'Penyelidikan' },
  root_cause: { title: 'Analisis Akar Masalah (5 Why)', category: 'Analisis' },
  action_plan: { title: 'Rencana Tindakan (CAPA)', category: 'Tindakan' },
  communication: { title: 'Komunikasi & Log', category: 'Koordinasi' },
  evidence: { title: 'Bukti & Lampiran Berkas', category: 'Dokumen' },
  weekly_report: { title: 'Laporan Mingguan', category: 'Pelaporan' },
  monthly_report: { title: 'Laporan Bulanan', category: 'Pelaporan' },
  quarterly_report: { title: 'Laporan Triwulan', category: 'Pelaporan' },
  annual_report: { title: 'Laporan Tahunan', category: 'Pelaporan' },
  custom_report: { title: 'Laporan Kustom', category: 'Pelaporan' },
  master_data: { title: 'Master Data SJI', category: 'Konfigurasi' },
  user_management: { title: 'Manajemen Pengguna', category: 'Hak Akses' },
  automation_log: { title: 'Automation Engine & Audit Logs', category: 'Otomasi' },
};

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentModule, setCurrentModule] = useState<AppModule>('dashboard');
  const { openCaseDetail } = useCases();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!currentUser) {
    return <LoginView />;
  }

  const handleOpenCase = (c: GrievanceCase, tab: any = 'overview') => {
    openCaseDetail(c, tab);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased overflow-x-hidden">
      {/* Top Corporate Navigation Header */}
      <Header
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Workspace with Sidebar & Dynamic View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentModule={currentModule}
          onSelectModule={setCurrentModule}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Breadcrumbs & Quick Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
              <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                <button
                  type="button"
                  onClick={() => setCurrentModule('dashboard')}
                  className="hover:text-blue-700 transition font-semibold text-slate-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                >
                  Beranda
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">{MODULE_TITLES[currentModule]?.category || 'Modul'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-blue-800 font-bold">{MODULE_TITLES[currentModule]?.title || currentModule}</span>
              </nav>

              {currentModule !== 'dashboard' && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentModule('dashboard')}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Ke Dashboard</span>
                  </button>
                  {currentModule !== 'cases' && (
                    <button
                      type="button"
                      onClick={() => setCurrentModule('cases')}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span>Direktori Kasus</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentModule === 'dashboard' && (
              <DashboardView
                onOpenCase={handleOpenCase}
                onNavigateToCases={() => setCurrentModule('cases')}
              />
            )}

            {currentModule === 'cases' && (
              <CaseManagementView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'investigation' && (
              <InvestigationView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'root_cause' && (
              <RootCauseView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'action_plan' && (
              <ActionPlanView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'communication' && (
              <CommunicationView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'evidence' && (
              <EvidenceView onOpenCase={handleOpenCase} />
            )}

            {currentModule === 'weekly_report' && (
              <ReportsView initialType="weekly" key="weekly" />
            )}

            {currentModule === 'monthly_report' && (
              <ReportsView initialType="monthly" key="monthly" />
            )}

            {currentModule === 'quarterly_report' && (
              <ReportsView initialType="quarterly" key="quarterly" />
            )}

            {currentModule === 'annual_report' && (
              <ReportsView initialType="annual" key="annual" />
            )}

            {currentModule === 'custom_report' && (
              <ReportsView initialType="custom" key="custom" />
            )}

            {currentModule === 'master_data' && (
              <MasterDataView />
            )}

            {currentModule === 'user_management' && (
              <UserManagementView />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CaseDetailModal />
      <NewCaseModal />
      <ExcelImportModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CaseProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </CaseProvider>
    </AuthProvider>
  );
}
