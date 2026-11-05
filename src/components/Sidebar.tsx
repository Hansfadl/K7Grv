import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCases } from '../context/CaseContext';
import {
  LayoutDashboard,
  FolderGit2,
  Search,
  GitFork,
  CheckSquare,
  MessageSquare,
  FileArchive,
  Calendar,
  CalendarRange,
  TrendingUp,
  Database,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  BarChart2,
  PieChart,
  Cpu
} from 'lucide-react';

export type AppModule =
  | 'dashboard'
  | 'cases'
  | 'investigation'
  | 'root_cause'
  | 'action_plan'
  | 'communication'
  | 'evidence'
  | 'weekly_report'
  | 'monthly_report'
  | 'quarterly_report'
  | 'annual_report'
  | 'custom_report'
  | 'master_data'
  | 'user_management'
  | 'automation_log';

interface SidebarProps {
  currentModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  isOpen,
  onToggle
}) => {
  const { currentUser, canManageUsers, canManageMasterData } = useAuth();
  const { stats } = useCases();

  // Collapsible sections state
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  const coreModules = [
    { id: 'dashboard' as AppModule, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'cases' as AppModule,
      label: 'Case Management',
      icon: FolderGit2,
      badge: stats.total,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'investigation' as AppModule,
      label: 'Investigation',
      icon: Search,
      badge: stats.investigation > 0 ? stats.investigation : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    { id: 'root_cause' as AppModule, label: 'Root Cause (6M Ishikawa)', icon: GitFork },
    {
      id: 'action_plan' as AppModule,
      label: 'Action Plan (CAPA)',
      icon: CheckSquare,
      badge: stats.actionTaken > 0 ? stats.actionTaken : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    { id: 'communication' as AppModule, label: 'Communication Log', icon: MessageSquare },
    { id: 'evidence' as AppModule, label: 'Evidence Vault', icon: FileArchive },
  ];

  const reportModules = [
    { id: 'weekly_report' as AppModule, label: 'Weekly Report', icon: Calendar },
    { id: 'monthly_report' as AppModule, label: 'Monthly Report', icon: CalendarRange },
    { id: 'quarterly_report' as AppModule, label: 'Quarterly Report', icon: BarChart2 },
    { id: 'annual_report' as AppModule, label: 'Annual Report', icon: TrendingUp },
    { id: 'custom_report' as AppModule, label: 'Custom Date Range', icon: PieChart },
  ];

  const handleItemClick = (mod: AppModule) => {
    onSelectModule(mod);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-150"
        onClick={onToggle}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 left-0 z-40 lg:static lg:z-auto w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 text-slate-300 select-none min-h-[calc(100vh-4rem)] transition-all duration-200 shadow-2xl lg:shadow-none animate-in slide-in-from-left duration-200">
        {/* Session Scope Banner */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs truncate">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                Tingkat Akses
              </span>
              <span className="text-white font-semibold capitalize text-xs">
                {currentUser?.role.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Tutup Menu Sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Core Case Management Flow */}
          <div className="pb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workflow Modul
          </div>

          {coreModules.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={`w-4 h-4 transition ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-blue-900' : item.badgeColor || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Collapsible Section: Reports */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setIsReportsOpen(!isReportsOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
          >
            <span>Compliance Reports</span>
            {isReportsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {isReportsOpen && (
            <div className="space-y-1 mt-1 pl-1">
              {reportModules.map((item) => {
                const Icon = item.icon;
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapsible Section: Administration (If permitted) */}
        {(canManageUsers || canManageMasterData) && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setIsGovernanceOpen(!isGovernanceOpen)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
            >
              <span>Administration</span>
              {isGovernanceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isGovernanceOpen && (
              <div className="space-y-1 mt-1 pl-1">
                {canManageMasterData && (
                  <button
                    onClick={() => handleItemClick('master_data')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      currentModule === 'master_data'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span>Master Data</span>
                  </button>
                )}
                {canManageUsers && (
                  <button
                    onClick={() => handleItemClick('user_management')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      currentModule === 'user_management'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>User Management</span>
                  </button>
                )}
                {(canManageUsers || currentUser?.role === 'hr_admin' || currentUser?.role === 'hr_lead') && (
                  <button
                    onClick={() => handleItemClick('automation_log')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      currentModule === 'automation_log'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>Automation Log</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer System Info */}
      <div className="p-3 m-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400">
        <span className="font-bold text-slate-300 block mb-0.5">PT SHOENARY JAVANESIA INC.</span>
        <span>SJI Grievance &amp; Compliance Portal</span>
      </div>
    </aside>
  </>
  );
};
