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
import { AutomationLogView } from './components/AutomationLogView';
import { CaseDetailModal } from './components/CaseDetailModal';
import { NewCaseModal } from './components/NewCaseModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { LoginView } from './components/LoginView';
import { GrievanceCase } from './types';

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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased">
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
          <div className="max-w-7xl mx-auto">
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

            {currentModule === 'automation_logs' && (
              <AutomationLogView />
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
        <AppContent />
      </CaseProvider>
    </AuthProvider>
  );
}
