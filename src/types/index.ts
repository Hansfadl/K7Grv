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
