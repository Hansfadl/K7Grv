import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { GrievanceCase } from '../types';
import {
  subscribeToCases,
  createCase,
  updateCaseRecord,
  deleteCaseRecord,
  exportCasesToExcel,
  filterCasesByRole,
  logAuditAction
} from '../services/db';
import { useAuth } from './AuthContext';

interface CaseContextType {
  cases: GrievanceCase[];
  filteredCases: GrievanceCase[];
  selectedCase: GrievanceCase | null;
  setSelectedCase: (c: GrievanceCase | null) => void;
  isDetailModalOpen: boolean;
  setIsDetailModalOpen: (open: boolean) => void;
  isNewCaseModalOpen: boolean;
  setIsNewCaseModalOpen: (open: boolean) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  detailActiveTab: 'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | 'audit';
  setDetailActiveTab: (tab: 'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | 'audit') => void;
  
  // Search & Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (d: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  resetFilters: () => void;

  // Actions
  handleCreateCase: (data: Omit<GrievanceCase, 'id'>) => Promise<GrievanceCase>;
  handleUpdateCase: (caseId: string, updates: Partial<GrievanceCase>, reason?: string) => Promise<void>;
  handleDeleteCase: (caseId: string, reason?: string) => Promise<void>;
  handleImportCases: (newCases: Partial<GrievanceCase>[]) => Promise<number>;
  handleExport: (format?: 'xlsx' | 'csv') => void;
  openCaseDetail: (c: GrievanceCase, tab?: 'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | 'audit') => void;
  stats: {
    total: number;
    open: number;
    investigation: number;
    actionTaken: number;
    closed: number;
    criticalCount: number;
    slaBreachedCount: number;
    slaApproachingCount: number;
    complianceRate: number;
  };
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [cases, setCases] = useState<GrievanceCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<GrievanceCase | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [detailActiveTab, setDetailActiveTab] = useState<'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | 'audit'>('overview');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const unsubscribe = subscribeToCases((allFetchedCases) => {
      setCases(allFetchedCases);
      // Keep selectedCase synchronized in real-time without loop
      setSelectedCase((prev) => {
        if (!prev) return null;
        const found = allFetchedCases.find((c) => c.id === prev.id);
        return found || prev;
      });
    }, currentUser);

    return () => unsubscribe();
  }, [currentUser?.id]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDepartmentFilter('all');
    setCategoryFilter('all');
  };

  // Filtered cases for tables and lists
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          c.ticketId.toLowerCase().includes(q) ||
          c.employeeName.toLowerCase().includes(q) ||
          (c.anonymousAlias && c.anonymousAlias.toLowerCase().includes(q)) ||
          c.department.toLowerCase().includes(q) ||
          c.complaintCategory.toLowerCase().includes(q) ||
          c.assignedPic.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Status
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Priority
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;

      // Department
      if (departmentFilter !== 'all' && c.department !== departmentFilter) return false;

      // Category
      if (categoryFilter !== 'all' && c.complaintCategory !== categoryFilter) return false;

      return true;
    });
  }, [cases, searchQuery, statusFilter, priorityFilter, departmentFilter, categoryFilter]);

  // Derived KPI metrics strictly supporting 4-stage lifecycle: Open -> Investigation -> Action Taken -> Closed
  const stats = useMemo(() => {
    const total = cases.length;
    const open = cases.filter((c) => c.status === 'Open').length;
    const investigation = cases.filter((c) => c.status === 'Investigation').length;
    const actionTaken = cases.filter((c) => c.status === 'Action Taken').length;
    const closed = cases.filter((c) => c.status === 'Closed').length;
    const criticalCount = cases.filter((c) => c.priority === 'Critical' && c.status !== 'Closed').length;
    const slaBreachedCount = cases.filter((c) => c.slaStatus === 'Breached').length;
    const slaApproachingCount = cases.filter((c) => c.slaStatus === 'Approaching Due').length;
    const complianceRate = total > 0 ? Math.round(((total - slaBreachedCount) / total) * 100) : 100;

    return {
      total,
      open,
      investigation,
      actionTaken,
      closed,
      criticalCount,
      slaBreachedCount,
      slaApproachingCount,
      complianceRate,
    };
  }, [cases]);

  const handleCreateCase = async (data: Omit<GrievanceCase, 'id'>): Promise<GrievanceCase> => {
    if (!currentUser) throw new Error('Unauthorized');
    const created = await createCase(data, currentUser);
    // Instant real-time UI update without waiting for network or reload
    setCases((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    return created;
  };

  const handleUpdateCase = async (caseId: string, updates: Partial<GrievanceCase>, reason?: string) => {
    if (!currentUser) throw new Error('Unauthorized');
    await updateCaseRecord(caseId, updates, currentUser, reason);
    const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, ...updates, lastUpdate: nowStamp } : c))
    );
    setSelectedCase((prev) => (prev && prev.id === caseId ? { ...prev, ...updates, lastUpdate: nowStamp } : prev));
  };

  const handleDeleteCase = async (caseId: string, reason: string = 'Salah input data keluhan') => {
    if (!currentUser) throw new Error('Unauthorized');
    await deleteCaseRecord(caseId, currentUser, reason);
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    setSelectedCase((prev) => (prev && prev.id === caseId ? null : prev));
    setIsDetailModalOpen(false);
  };

  const handleImportCases = async (newCases: Partial<GrievanceCase>[]): Promise<number> => {
    if (!currentUser) throw new Error('Unauthorized');
    let count = 0;
    for (const item of newCases) {
      if (item.ticketId && item.complaintCategory) {
        await createCase({
          ticketId: item.ticketId,
          dateReceived: item.dateReceived || new Date().toISOString().substring(0, 10),
          employeeName: item.employeeName || 'Imported Grievance',
          isAnonymous: item.isAnonymous ?? false,
          anonymousAlias: item.anonymousAlias,
          department: item.department || 'Operations',
          complaintCategory: item.complaintCategory,
          priority: item.priority || 'Major',
          status: item.status || 'Open',
          assignedPic: item.assignedPic || 'Unassigned',
          assignedPicId: item.assignedPicId || 'usr-pic-ops',
          assignedInvestigator: item.assignedInvestigator || '',
          assignedInvestigatorId: item.assignedInvestigatorId || '',
          progress: item.progress ?? 10,
          dueDate: item.dueDate || new Date(Date.now() + (item.priority === 'Critical' ? 14 : item.priority === 'Major' ? 7 : 3) * 86400000).toISOString().substring(0, 10),
          closingDate: item.closingDate,
          slaStatus: item.slaStatus || 'On Track',
          slaHoursLeft: item.slaHoursLeft ?? ((item.priority === 'Critical' ? 14 : item.priority === 'Major' ? 7 : 3) * 24),
          lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 16),
          description: item.description || 'Imported case data from company spreadsheet.',
          channelReceived: item.channelReceived || 'Internal Grievance Web Portal (Batch Sync)',
          createdBy: currentUser.email,
        }, currentUser);
        count++;
      }
    }

    await logAuditAction({
      userId: currentUser.id,
      userName: currentUser.displayName,
      userRole: currentUser.role,
      action: 'EXCEL_BATCH_IMPORT',
      details: `Successfully imported ${count} grievance records via spreadsheet parser.`,
    });

    return count;
  };

  const handleExport = (format: 'xlsx' | 'csv' = 'xlsx') => {
    exportCasesToExcel(filteredCases, format);
    if (currentUser) {
      logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: 'EXCEL_EXPORT',
        details: `Exported ${filteredCases.length} case records to ${format.toUpperCase()} format.`,
      });
    }
  };

  const openCaseDetail = useCallback((
    c: GrievanceCase,
    tab: 'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | 'audit' = 'overview'
  ) => {
    setSelectedCase(c);
    setDetailActiveTab(tab);
    setIsDetailModalOpen(true);
    if (currentUser) {
      logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: 'VIEW_CASE_DETAILS',
        caseId: c.id,
        ticketId: c.ticketId,
        details: `Viewed case ${c.ticketId} (${tab} view).`,
      });
    }
  }, [currentUser]);

  return (
    <CaseContext.Provider
      value={{
        cases,
        filteredCases,
        selectedCase,
        setSelectedCase,
        isDetailModalOpen,
        setIsDetailModalOpen,
        isNewCaseModalOpen,
        setIsNewCaseModalOpen,
        isImportModalOpen,
        setIsImportModalOpen,
        detailActiveTab,
        setDetailActiveTab,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        priorityFilter,
        setPriorityFilter,
        departmentFilter,
        setDepartmentFilter,
        categoryFilter,
        setCategoryFilter,
        resetFilters,
        handleCreateCase,
        handleUpdateCase,
        handleDeleteCase,
        handleImportCases,
        handleExport,
        openCaseDetail,
        stats,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
};

export const useCases = () => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCases must be used within a CaseProvider');
  }
  return context;
};
