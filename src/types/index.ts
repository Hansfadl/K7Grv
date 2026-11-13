export type UserRole = 'hr_admin' | 'hr_investigator' | 'department_pic' | 'hr_lead';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  status: 'active' | 'inactive';
  employeeId?: string; // NIK
  phoneNumber?: string;
  pin?: string; // PIN akses login
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  lastLoginDevice?: string;
  loginCount?: number;
}

export type PriorityLevel = 'Minor' | 'Major' | 'Critical';

export type GrievanceInstrument = 'Online' | 'Grievance Box' | 'Verbal' | 'Hotline';

// Strictly four workflow statuses as mandated by SJI workflow
export type CaseStatus = 
  | 'Open'
  | 'Investigation'
  | 'Action Taken'
  | 'Closed';

export type SlaStatus = 'On Track' | 'Approaching Due' | 'Breached' | 'Met' | 'Overdue';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  caseId?: string;
  ticketId?: string;
  details: string;
  device?: string;
  timestamp: string;
}

export interface GrievanceCase {
  id: string;
  ticketId: string;
  dateReceived: string; // YYYY-MM-DD (Grievance Date)
  employeeName: string;
  employeeNik?: string | null;
  isAnonymous: boolean;
  anonymousAlias?: string | null;
  department: string;
  complaintCategory: string;
  priority: PriorityLevel;
  status: CaseStatus;
  assignedPic: string;
  assignedPicId: string;
  assignedInvestigator?: string | null;
  assignedInvestigatorId?: string | null;
  progress: number; // 0 - 100
  dueDate: string; // Target Due Date based on Grievance Date + SLA
  closingDate?: string | null;
  slaStatus: SlaStatus;
  slaHoursLeft: number;
  lastUpdate: string;
  description: string;
  incidentDate?: string | null;
  location?: string | null;
  involvedParties?: string | null;
  channelReceived: string;
  resolutionSummary?: string | null;
  closureRemarks?: string | null;
  approvedBy?: string | null;
  createdBy?: string | null;
}

// 1. Investigation Module (Linked to Ticket ID, 9 fields, NO signature, internal investigator info)
export interface InvestigationRecord {
  id: string;
  caseId: string;
  ticketId: string;
  investigationDate: string; // YYYY-MM-DD
  investigationDetails: string;
  interviewNotes: string;
  witnessInfo: string;
  supportingInfo: string;
  evidenceRef: string;
  findings: string;
  conclusion: string;
  recommendedActions: string;
  investigatorName: string; // Internal management only
  investigatorId: string;   // Internal management only
  createdAt: string;
  updatedAt?: string;
}

// Legacy alias for compatibility
export type InvestigationFinding = InvestigationRecord;

// 2. Root Cause Analysis (6M Ishikawa Framework: Man, Method, Machine, Material, Measurement, Environment)
export type Rca6MCategory = 
  | 'Man'
  | 'Method'
  | 'Machine'
  | 'Material'
  | 'Measurement'
  | 'Environment';

export interface RootCauseAnalysis {
  id: string;
  caseId: string;
  ticketId: string;
  category: Rca6MCategory;
  rootCause: string;
  contributingFactors: string;
  impact: string;
  correctiveRecommendations: string;
  analystId: string;
  analystName: string;
  updatedAt: string;
}

// 3. CAPA / Action Plan (Strictly 2 progress statuses: 'Progress' | 'Completed')
export type CapaProgressStatus = 'Progress' | 'Completed';

export interface ActionPlan {
  id: string;
  caseId: string;
  ticketId: string;
  description: string; // Action Plan Description
  responsiblePic: string; // Responsible Department PIC
  targetDate: string; // Target Date
  actionTaken: string; // Action Taken
  progressStatus: CapaProgressStatus; // 'Progress' | 'Completed'
  completionDate?: string | null; // Completion Date
  notes?: string; // Notes / Revisions
  // Backward compatibility fields
  title?: string;
  type?: string;
  status?: string;
  assignedTo?: string;
  assignedRole?: string;
  createdAt: string;
  updatedAt?: string;
}

// 4. Evidence Item (JPG, JPEG, PNG, PDF)
export interface EvidenceItem {
  id: string;
  caseId: string;
  ticketId: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string; // 'image/jpeg' | 'image/png' | 'application/pdf' | etc.
  fileUrl?: string; // Firebase storage download URL if uploaded
  fileData?: string; // Base64 Data URL for preview / download
  category: 'Document' | 'Photo' | 'Email/Chat Screenshot' | 'Witness Statement' | 'CCTV/Video Log' | 'Audio Recording';
  uploadedBy: string;
  uploadedAt: string;
  isConfidential: boolean;
  chainOfCustody: string;
}

// 5. Communication Log (Linked to Ticket ID with Date, Channel, Communicator, Recipient, Details, Follow-up Notes)
export interface CommunicationLog {
  id: string;
  caseId: string;
  ticketId: string;
  date: string; // YYYY-MM-DD
  channel: 'Email' | 'Formal HR Memo' | 'Internal Note' | 'Verbal Discussion' | 'Meeting' | 'Hotline / WhatsApp';
  communicator: string;
  recipient: string;
  details: string; // Communication Details
  followUpNotes?: string; // Follow-up Notes
  isConfidential: boolean;
  timestamp: string;
  // Backward compatibility
  subject?: string;
  content?: string;
  senderName?: string;
  senderRole?: string;
  senderId?: string;
  type?: string;
}

export interface MasterCategory {
  id: string;
  name: string;
  code: string;
  defaultPriority: PriorityLevel;
  slaDays: number;
  description: string;
  active: boolean;
}

export interface MasterDepartment {
  id: string;
  name: string;
  code: string;
  picName: string;
  picEmail: string;
  active: boolean;
}

// 6. Automation & Notification Types
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationCategory =
  | 'Critical Case Alert'
  | 'Overdue Alert'
  | 'SLA Reminder'
  | 'New Grievance'
  | 'New PIC Assignment'
  | 'Action Plan Reminder'
  | 'Approval Request'
  | 'Case Closed'
  | 'Case Resolved'
  | 'Investigation Update'
  | 'General';

export interface NotificationItem {
  id: string;
  recipientId: string;
  recipientEmail?: string;
  roleTarget?: 'all_hr' | 'hr_lead' | 'hr_admin' | 'hr_investigator' | 'department_pic' | string;
  departmentTarget?: string;
  ticketId?: string;
  caseId?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  priority?: NotificationPriority;
  targetTab?: 'overview' | 'investigation' | 'root_cause' | 'action_plan' | 'communication' | 'evidence' | string;
  metadata?: Record<string, any>;
}

export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revision Required';

export interface ApprovalRequest {
  id: string;
  caseId: string;
  ticketId: string;
  requestType: 'case_closure' | 'status_change' | 'capa_verification' | 'sla_extension' | string;
  requestedBy: string;
  requestedById: string;
  requestedRole: UserRole | string;
  approverRole?: 'hr_lead' | 'hr_admin' | string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  status: ApprovalRequestStatus;
  requestNotes: string;
  createdAt: string;
  previousValue?: string;
  proposedValue?: string;
  decidedBy?: string;
  decidedById?: string;
  decidedAt?: string;
  decisionNotes?: string;
}

export type AutomationEventType =
  | 'NEW_GRIEVANCE'
  | 'PIC_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'CASE_CLOSED'
  | 'SLA_REMINDER'
  | 'SLA_OVERDUE'
  | 'ACTION_PLAN_REMINDER'
  | 'ACTION_PLAN_OVERDUE'
  | 'CRITICAL_ESCALATION'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_DECIDED';

export type AutomationExecutionStatus = 'Success' | 'Processing' | 'Failed' | 'Skipped';

export interface AutomationLogItem {
  id: string;
  automationId: string;
  eventType: AutomationEventType;
  ticketId?: string;
  caseId?: string;
  recipient: string;
  recipientId?: string;
  triggerDate: string;
  executionStatus: AutomationExecutionStatus;
  deliveryStatus: 'Delivered' | 'Undelivered' | 'Queued' | 'Suppressed';
  errorMessage?: string;
  retryCount?: number;
  idempotencyKey: string;
  details?: string;
  payload?: Record<string, any>;
  createdAt: string;
}

export interface AutomationConfig {
  id: string;
  isEnabled: boolean;
  slaReminderHoursBeforeDue: number;
  checkIntervalMinutes: number;
  notifyOnNewCase: boolean;
  notifyOnPicChange: boolean;
  notifyOnStatusChange: boolean;
  notifyOnCritical: boolean;
  notifyOnOverdue: boolean;
  notifyOnActionPlanDue: boolean;
  notifyOnApproval: boolean;
  companyHolidays: string[];
  escalationRecipients: string[];
  updatedAt: string;
  updatedBy?: string;
}

// 7. SJI AI Intelligence (Decision Support System & Governance)
export type AiReviewStatus = 'Pending Review' | 'Approved' | 'Rejected';

export type AiAnalysisType =
  | 'grievance_analysis'
  | 'root_cause'
  | 'repeat_detection'
  | 'risk_assessment'
  | 'recommended_capa'
  | 'management_insights';

export interface AiGrievanceAnalysis {
  recommendedCategory: string;
  recommendedPriority: PriorityLevel;
  priorityRationale: string;
  relatedDepartment: string;
  issueIndications: string[];
  professionalSummary: string;
  missingInvestigationInfo: string[];
  dataLimitations: string;
}

export interface AiFiveWhyStep {
  level: number;
  question: string;
  finding: string;
}

export interface AiFishboneFactor {
  category: Rca6MCategory;
  isRelevant: boolean;
  possibleCauses: string[];
  evidenceBasis: string;
}

export interface AiRootCauseResult {
  fiveWhy: {
    symptom: string;
    steps: AiFiveWhyStep[];
    rootCauseConclusion: string;
    symptomsVsRootCauseNote: string;
  };
  fishbone6M: AiFishboneFactor[];
  recommendedPrimaryCategory: Rca6MCategory;
  contributingFactors: string;
  impact: string;
  correctiveRecommendations: string;
  dataLimitations: string;
}

export interface AiRepeatCluster {
  patternTitle: string;
  complaintCategory: string;
  departments: string[];
  similarCaseCount: number;
  similarTicketIds: string[];
  occurrencePeriod: string;
  previousActionsSummary: string;
  potentialEffectivenessGap: string;
  neutralObservationNote: string;
}

export interface AiRepeatGrievanceResult {
  totalAnalyzedCases: number;
  repeatClusterCount: number;
  clusters: AiRepeatCluster[];
  overallPatternSummary: string;
  dataLimitations: string;
}

export type AiRiskAttentionLevel = 'Critical Attention' | 'High Attention' | 'Normal Monitoring';

export interface AiRiskItem {
  ticketId: string;
  caseId: string;
  department: string;
  complaintCategory: string;
  attentionLevel: AiRiskAttentionLevel;
  riskIndicators: string[];
  escalationPotential: string;
  humanReviewReason: string;
  requiresPriorityHumanReview: boolean;
}

export interface AiRiskAssessmentResult {
  criticalAttentionCount: number;
  highAttentionCount: number;
  normalMonitoringCount: number;
  riskItems: AiRiskItem[];
  earlyWarningSummary: string;
  governanceDisclaimer: string;
  dataLimitations: string;
}

export interface AiCapaDraftItem {
  correctiveAction: string;
  preventiveAction: string;
  recommendedPic: string;
  recommendedDepartment: string;
  targetFollowUpDays: number;
  suggestedTargetDate: string;
  expectedOutcome: string;
  monitoringRecommendation: string;
}

export interface AiRecommendedCapaResult {
  drafts: AiCapaDraftItem[];
  policyAlignmentNote: string;
  dataLimitations: string;
}

export type AiManagementInsightType = 'weekly' | 'monthly' | 'departmental' | 'executive';

export interface AiActualManagementMetrics {
  periodLabel: string;
  totalGrievance: number;
  dominantCategory: { name: string; count: number; percentage: number };
  highestDepartment: { name: string; count: number; percentage: number };
  repeatGrievanceCount: number;
  slaComplianceRate: number;
  onTimeCount: number;
  overdueCount: number;
  pendingCount: number;
  unresolvedCases: number;
  criticalActiveCount: number;
  rootCauseTrends: { category: string; count: number }[];
}

export interface AiManagementInsightsResult {
  insightType: AiManagementInsightType;
  actualMetrics: AiActualManagementMetrics;
  executiveNarrative: string;
  keyFindings: string[];
  rootCauseTrendSummary: string;
  recommendedManagementActions: string[];
  dataLimitations: string;
}

export interface AiAnalysisRecord<T = any> {
  id: string;
  caseId?: string | null;
  ticketId?: string | null;
  analysisType: AiAnalysisType;
  title: string;
  result: T;
  dataSources: string[];
  dataLimitations: string;
  modelUsed: string;
  reviewStatus: AiReviewStatus;
  reviewedBy?: string | null;
  reviewedByRole?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  appliedToModule?: boolean;
  appliedAt?: string | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
}

