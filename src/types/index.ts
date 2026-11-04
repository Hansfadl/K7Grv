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

export type CaseStatus = 
  | 'Open'
  | 'Investigation'
  | 'Action Taken'
  | 'Closed';

export type SlaStatus = 'On Track' | 'Approaching Due' | 'Breached' | 'Met';

export interface GrievanceCase {
  id: string;
  ticketId: string;
  dateReceived: string; // YYYY-MM-DD
  employeeName: string;
  isAnonymous: boolean;
  anonymousAlias?: string;
  department: string;
  complaintCategory: string;
  priority: PriorityLevel;
  status: CaseStatus;
  assignedPic: string;
  assignedPicId: string;
  assignedInvestigator: string;
  assignedInvestigatorId: string;
  progress: number; // 0 - 100
  dueDate: string;
  closingDate?: string;
  slaStatus: SlaStatus;
  slaHoursLeft: number;
  lastUpdate: string;
  description: string;
  incidentDate?: string;
  location?: string;
  involvedParties?: string;
  channelReceived: string;
  resolutionSummary?: string;
  closureRemarks?: string;
  approvedBy?: string;
  createdBy?: string;
}

export interface InvestigationFinding {
  id: string;
  caseId: string;
  title: string;
  investigatorName: string;
  investigatorId: string;
  intervieweeName: string;
  interviewType: 'Complainant' | 'Accused / Respondent' | 'Witness' | 'Subject Matter Expert';
  dateConducted: string;
  keyFindings: string;
  statementSummary: string;
  credibilityAssessment: string;
  createdAt: string;
}

export interface RootCauseAnalysis {
  id: string;
  caseId: string;
  primaryCategory: 'People' | 'Process' | 'Policy' | 'Work Environment' | 'Management & Leadership' | 'Equipment / System';
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  systemicFactors: string;
  preventiveRecommendations: string;
  analystId: string;
  analystName: string;
  updatedAt: string;
}

export interface ActionPlan {
  id: string;
  caseId: string;
  title: string;
  description: string;
  type: 'Corrective' | 'Preventive' | 'Disciplinary' | 'Policy Amendment' | 'Counseling/Mediation';
  assignedTo: string;
  assignedRole: string;
  targetDate: string;
  completedDate?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Verified';
  verificationNotes?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface CommunicationLog {
  id: string;
  caseId: string;
  type: 'Internal Note' | 'Employee Correspondence' | 'Formal HR Memo' | 'Legal Consultation' | 'Meeting Summary';
  subject: string;
  content: string;
  senderName: string;
  senderRole: string;
  senderId: string;
  recipient: string;
  isConfidential: boolean;
  timestamp: string;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  category: 'Document' | 'Email/Chat Screenshot' | 'Audio Recording' | 'Photo' | 'CCTV/Video Log' | 'Witness Written Statement';
  fileUrl?: string;
  fileName: string;
  fileSize: string;
  fileType?: string; // image/jpeg, image/png, application/pdf, etc.
  fileData?: string; // base64 Data URL for viewing / downloading
  uploadedBy: string;
  uploadedAt: string;
  isConfidential: boolean;
  chainOfCustody: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  caseId?: string;
  ticketId?: string;
  details: string;
  timestamp: string;
  device?: string;
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
