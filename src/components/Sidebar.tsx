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
  PanelLeft,
  BarChart2,
  PieChart,
  Layers
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
  | 'user_management';

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

  // Collapsed desktop state (compact icon-only vs full width)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Collapsible section states
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  const workspaceModules = [
    { id: 'dashboard' as AppModule, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'cases' as AppModule,
      label: 'Case Directory',
      icon: FolderGit2,
      badge: stats.total > 0 ? stats.total : undefined,
      badgeColor: 'bg-blue-100 text-blue-900',
    },
  ];

  const investigationModules = [
    {
      id: 'investigation' as AppModule,
      label: 'Investigation',
      icon: Search,
      badge: stats.investigation > 0 ? stats.investigation : undefined,
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    { id: 'root_cause' as AppModule, label: 'Root Cause (6M)', icon: GitFork },
    {
      id: 'action_plan' as AppModule,
      label: 'Action Plan (CAPA)',
      icon: CheckSquare,
      badge: stats.actionTaken > 0 ? stats.actionTaken : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-900',
    },
    { id: 'communication' as AppModule, label: 'Communication Log', icon: MessageSquare },
    { id: 'evidence' as AppModule, label: 'Evidence Vault', icon: FileArchive },
  ];

  const reportModules = [
    { id: 'weekly_report' as AppModule, label: 'Weekly Report', icon: Calendar },
    { id: 'monthly_report' as AppModule, label: 'Monthly Report', icon: CalendarRange },
    { id: 'quarterly_report' as AppModule, label: 'Quarterly Report', icon: BarChart2 },
    { id: 'annual_report' as AppModule, label: 'Annual Report', icon: TrendingUp },
    { id: 'custom_report' as AppModule, label: 'Custom Range', icon: PieChart },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 text-slate-300 select-none min-h-[calc(100vh-4rem)] transition-all duration-200 z-30`}
    >
      {/* Scope Banner & Collapse Toggle */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
        {!isCollapsed && (
          <div className="flex items-center space-x-2 text-xs truncate">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                Akses Terverifikasi
              </span>
              <span className="text-white font-semibold capitalize text-xs truncate block">
                {currentUser?.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-1 ml-auto">
          {/* Desktop compact/expand toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* GROUP 1: WORKSPACE */}
        <div>
          {!isCollapsed && (
            <div className="pb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Main Workspace</span>
              <Layers className="w-3 h-3 text-slate-400" />
            </div>
          )}
          <div className="space-y-1">
            {workspaceModules.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium transition group relative ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        isActive ? 'bg-white text-blue-900' : item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge !== undefined && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* GROUP 2: INVESTIGATION & REMEDIATION */}
        <div>
          {!isCollapsed && (
            <div className="pb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Investigation &amp; Resolution
            </div>
          )}
          <div className="space-y-1">
            {investigationModules.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium transition group relative ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        isActive ? 'bg-white text-blue-900' : item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge !== undefined && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* GROUP 3: COMPLIANCE REPORTING */}
        <div>
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsReportsOpen(!isReportsOpen)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition mb-1"
            >
              <span>Compliance Reports</span>
              {isReportsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-full border-t border-slate-800 my-2" />
          )}

          {(isReportsOpen || isCollapsed) && (
            <div className="space-y-1">
              {reportModules.map((item) => {
                const Icon = item.icon;
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectModule(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center py-2' : 'space-x-2.5 px-3 py-1.5'
                    } rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* GROUP 4: SYSTEM GOVERNANCE (If permitted) */}
        {(canManageUsers || canManageMasterData) && (
          <div>
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => setIsGovernanceOpen(!isGovernanceOpen)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition mb-1"
              >
                <span>Administration</span>
                {isGovernanceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-full border-t border-slate-800 my-2" />
            )}

            {(isGovernanceOpen || isCollapsed) && (
              <div className="space-y-1">
                {canManageMasterData && (
                  <button
                    onClick={() => onSelectModule('master_data')}
                    title={isCollapsed ? 'Master Data' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center py-2' : 'space-x-2.5 px-3 py-1.5'
                    } rounded-xl text-xs font-medium transition ${
                      currentModule === 'master_data'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    {!isCollapsed && <span>Master Data</span>}
                  </button>
                )}
                {canManageUsers && (
                  <button
                    onClick={() => onSelectModule('user_management')}
                    title={isCollapsed ? 'User Management' : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center py-2' : 'space-x-2.5 px-3 py-1.5'
                    } rounded-xl text-xs font-medium transition ${
                      currentModule === 'user_management'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    {!isCollapsed && <span>User Management</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer Branding Info */}
      {!isCollapsed ? (
        <div className="p-3 m-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-400">
          <span className="font-bold text-slate-300 block mb-0.5">PT SHOENARY JAVANESIA INC.</span>
          <span>Corporate HR Compliance System</span>
        </div>
      ) : (
        <div className="p-2 mb-2 text-center text-[10px] font-bold text-slate-500">
          SJI
        </div>
      )}
    </aside>
  );
};
