import React from 'react';
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
  AlertCircle,
  FileSpreadsheet
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
  | 'annual_report'
  | 'master_data'
  | 'user_management';

interface SidebarProps {
  currentModule: AppModule;
  onSelectModule: (module: AppModule) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onSelectModule }) => {
  const { currentUser, canManageUsers, canManageMasterData } = useAuth();
  const { stats } = useCases();

  const navItems: {
    id: AppModule;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
    category?: string;
  }[] = [
    // Core Modules
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'cases',
      label: 'Case Management',
      icon: FolderGit2,
      badge: stats.total,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'investigation',
      label: 'Investigation',
      icon: Search,
      badge: stats.investigation > 0 ? stats.investigation : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    { id: 'root_cause', label: 'Root Cause Analysis', icon: GitFork },
    {
      id: 'action_plan',
      label: 'Action Plan (CAPA)',
      icon: CheckSquare,
      badge: stats.actionTaken > 0 ? stats.actionTaken : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    { id: 'communication', label: 'Communication Log', icon: MessageSquare },
    { id: 'evidence', label: 'Evidence Management', icon: FileArchive },

    // Reporting Modules
    { id: 'weekly_report', label: 'Weekly Reporting', icon: Calendar, category: 'Compliance Reports' },
    { id: 'monthly_report', label: 'Monthly Reporting', icon: CalendarRange },
    { id: 'annual_report', label: 'Annual Reporting', icon: TrendingUp },

    // Governance Modules
    { id: 'master_data', label: 'Master Data', icon: Database, category: 'Administration' },
    { id: 'user_management', label: 'User Management', icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 text-slate-300 select-none min-h-[calc(100vh-4rem)]">
      {/* Session Scope Banner */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center space-x-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Access Tier
            </span>
            <span className="text-white font-medium capitalize">
              {currentUser?.role.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;

          // Check permissions for admin-only modules
          if (item.id === 'user_management' && !canManageUsers) return null;
          if (item.id === 'master_data' && !canManageMasterData) return null;

          return (
            <React.Fragment key={item.id}>
              {item.category && (
                <div className="pt-3 pb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {item.category}
                </div>
              )}
              <button
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
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
            </React.Fragment>
          );
        })}
      </nav>

      {/* Mandatory Corporate Policy Box */}
      <div className="p-3 m-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block text-[10px] uppercase tracking-wider">
              Shoenary Javanesia Inc. Policy
            </span>
            <p className="leading-relaxed text-[10px] text-slate-400">
              Employee grievances are submitted via the separate internal employee website. Only authorized HR team and assigned PICs may access this system.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
