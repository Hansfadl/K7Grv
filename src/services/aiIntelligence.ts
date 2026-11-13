import {
  GrievanceCase,
  InvestigationRecord,
  RootCauseAnalysis,
  MasterCategory,
  MasterDepartment,
  AiGrievanceAnalysis,
  AiRootCauseResult,
  AiRepeatGrievanceResult,
  AiRiskAssessmentResult,
  AiRecommendedCapaResult,
  AiManagementInsightType,
  AiActualManagementMetrics,
  AiManagementInsightsResult,
} from '../types';
import { calculateSlaCompliance } from '../utils/sla';

export interface AiEndpointResponse<T> {
  result: T;
  modelUsed: string;
}

/**
 * Redacts personal identifiers (emails, phone numbers, NIKs, explicit reporter names)
 * from free-text fields before transmitting data to server AI endpoints.
 */
export function scrubPiiString(
  text?: string | null,
  knownNames: string[] = [],
  knownNiks: string[] = []
): string {
  if (!text) return '';
  let scrubbed = String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_TERLINDUNGI]')
    .replace(/(\+62|62|0)8[1-9][0-9\-\s]{7,13}/g, '[KONTAK_TERLINDUNGI]')
    .replace(/\b\d{12,18}\b/g, '[ID_TERLINDUNGI]');

  for (const rawName of knownNames) {
    const clean = (rawName || '').trim();
    if (clean.length >= 3 && !clean.toLowerCase().includes('anonim') && !clean.toLowerCase().includes('whistleblower')) {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      scrubbed = scrubbed.replace(new RegExp(escaped, 'gi'), '[NAMA_TERLINDUNGI]');
    }
  }

  for (const rawNik of knownNiks) {
    const clean = (rawNik || '').trim();
    if (clean.length >= 4) {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      scrubbed = scrubbed.replace(new RegExp(escaped, 'gi'), '[NIK_TERLINDUNGI]');
    }
  }

  return scrubbed;
}

export interface RedactedCasePayload {
  id: string;
  ticketId: string;
  dateReceived: string;
  employeeName: string;
  isAnonymous: boolean;
  department: string;
  complaintCategory: string;
  priority: string;
  status: string;
  dueDate: string | null;
  closingDate: string | null;
  slaStatus: string;
  channelReceived: string;
  description: string;
  incidentDate: string | null;
  location: string | null;
  involvedParties: string | null;
  resolutionSummary: string | null;
  assignedPic?: string;
}

/**
 * Strips direct PII (employeeName, employeeNik, investigator identities) from a case
 * while preserving operational grievance context needed by SJI AI Intelligence.
 */
export function redactCaseForAi(c: GrievanceCase, includePicLabel = false): RedactedCasePayload {
  const knownNames = [c.employeeName, c.assignedInvestigator || ''].filter(Boolean);
  const knownNiks = [c.employeeNik || ''].filter(Boolean);

  return {
    id: c.id,
    ticketId: c.ticketId,
    dateReceived: c.dateReceived,
    employeeName: c.isAnonymous
      ? 'Pelapor Anonim (Whistleblower Terlindungi)'
      : 'Karyawan SJI (Identitas Disamarkan)',
    isAnonymous: Boolean(c.isAnonymous),
    department: c.department || 'Umum',
    complaintCategory: c.complaintCategory || 'Belum Diklasifikasi',
    priority: c.priority || 'Major',
    status: c.status || 'Open',
    dueDate: c.dueDate || null,
    closingDate: c.closingDate || null,
    slaStatus: c.slaStatus || 'On Track',
    channelReceived: c.channelReceived || 'Online',
    description: scrubPiiString(c.description, knownNames, knownNiks),
    incidentDate: c.incidentDate || null,
    location: c.location ? scrubPiiString(c.location, knownNames, knownNiks) : null,
    involvedParties: c.involvedParties ? 'Pihak Terkait Internal (Identitas Disamarkan)' : null,
    resolutionSummary: c.resolutionSummary
      ? scrubPiiString(c.resolutionSummary, knownNames, knownNiks)
      : null,
    ...(includePicLabel ? { assignedPic: c.department ? `PIC Departemen ${c.department}` : 'PIC Departemen' } : {}),
  };
}

export function redactInvestigationsForAi(
  investigations: InvestigationRecord[],
  caseData?: GrievanceCase
) {
  const knownNames = caseData
    ? [caseData.employeeName, caseData.assignedInvestigator || ''].filter(Boolean)
    : [];
  const knownNiks = caseData ? [caseData.employeeNik || ''].filter(Boolean) : [];

  return (investigations || []).map((inv) => ({
    investigationDate: inv.investigationDate,
    investigationDetails: scrubPiiString(inv.investigationDetails, knownNames, knownNiks),
    interviewNotes: scrubPiiString(inv.interviewNotes, knownNames, knownNiks),
    witnessInfo: inv.witnessInfo ? '[INFORMASI_SAKSI_DISAMARKAN]' : '',
    supportingInfo: scrubPiiString(inv.supportingInfo, knownNames, knownNiks),
    findings: scrubPiiString(inv.findings, knownNames, knownNiks),
    conclusion: scrubPiiString(inv.conclusion, knownNames, knownNiks),
    recommendedActions: scrubPiiString(inv.recommendedActions, knownNames, knownNiks),
  }));
}

/**
 * Computes 100% deterministic database metrics using the single source of truth
 * SLA compliance engine (`calculateSlaCompliance`). Used to ground Management Insights.
 */
export function computeActualManagementMetrics(
  cases: GrievanceCase[],
  rcaMap: Record<string, RootCauseAnalysis[]> = {},
  insightType: AiManagementInsightType = 'monthly',
  selectedDepartment?: string,
  referenceDateStr?: string
): AiActualManagementMetrics {
  const refIso = (referenceDateStr || new Date().toISOString().substring(0, 10)).substring(0, 10);
  const refDateObj = new Date(`${refIso}T12:00:00`);
  const weekStartObj = new Date(refDateObj);
  weekStartObj.setDate(weekStartObj.getDate() - 6);
  const weekStartIso = weekStartObj.toISOString().substring(0, 10);
  const monthPrefix = refIso.substring(0, 7);

  let scopedCases = [...cases];
  let periodLabel = `Seluruh Data Historis (s/d ${refIso})`;

  if (insightType === 'weekly') {
    scopedCases = cases.filter((c) => {
      const d = (c.dateReceived || '').substring(0, 10);
      return d >= weekStartIso && d <= refIso;
    });
    periodLabel = `Mingguan (${weekStartIso} s/d ${refIso})`;
  } else if (insightType === 'monthly') {
    scopedCases = cases.filter((c) => (c.dateReceived || '').startsWith(monthPrefix));
    periodLabel = `Bulanan (${monthPrefix})`;
  } else if (insightType === 'departmental') {
    if (selectedDepartment && selectedDepartment !== 'all') {
      scopedCases = cases.filter(
        (c) => (c.department || '').trim().toLowerCase() === selectedDepartment.trim().toLowerCase()
      );
      periodLabel = `Departemen ${selectedDepartment}`;
    } else {
      periodLabel = 'Lintas Seluruh Departemen';
    }
  } else if (insightType === 'executive') {
    periodLabel = `Ringkasan Eksekutif Kumulatif (s/d ${refIso})`;
  }

  const totalGrievance = scopedCases.length;

  // Category distribution
  const catCounts: Record<string, number> = {};
  scopedCases.forEach((c) => {
    const k = c.complaintCategory || 'Lainnya';
    catCounts[k] = (catCounts[k] || 0) + 1;
  });
  const topCatEntry = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  const dominantCategory = topCatEntry
    ? {
        name: topCatEntry[0],
        count: topCatEntry[1],
        percentage: totalGrievance > 0 ? Math.round((topCatEntry[1] / totalGrievance) * 100) : 0,
      }
    : { name: 'Tidak ada data', count: 0, percentage: 0 };

  // Department distribution
  const deptCounts: Record<string, number> = {};
  scopedCases.forEach((c) => {
    const k = c.department || 'Umum';
    deptCounts[k] = (deptCounts[k] || 0) + 1;
  });
  const topDeptEntry = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];
  const highestDepartment = topDeptEntry
    ? {
        name: topDeptEntry[0],
        count: topDeptEntry[1],
        percentage: totalGrievance > 0 ? Math.round((topDeptEntry[1] / totalGrievance) * 100) : 0,
      }
    : { name: 'Tidak ada data', count: 0, percentage: 0 };

  // Repeat grievance calculation (cases belonging to category+department clusters >= 2)
  const clusterGroups: Record<string, number> = {};
  scopedCases.forEach((c) => {
    const key = `${c.complaintCategory}|||${c.department}`;
    clusterGroups[key] = (clusterGroups[key] || 0) + 1;
  });
  const repeatGrievanceCount = Object.values(clusterGroups)
    .filter((cnt) => cnt >= 2)
    .reduce((sum, cnt) => sum + cnt, 0);

  // Unified SLA Calculation
  const slaSummary = calculateSlaCompliance(scopedCases, refIso);

  const unresolvedCases = scopedCases.filter((c) => c.status !== 'Closed').length;
  const criticalActiveCount = scopedCases.filter(
    (c) => c.status !== 'Closed' && c.priority === 'Critical'
  ).length;

  // Root Cause 6M trends across scoped cases
  const rcCounts: Record<string, number> = {};
  scopedCases.forEach((c) => {
    const list = rcaMap[c.id] || [];
    list.forEach((rc) => {
      rcCounts[rc.category] = (rcCounts[rc.category] || 0) + 1;
    });
  });
  const rootCauseTrends = Object.entries(rcCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    periodLabel,
    totalGrievance,
    dominantCategory,
    highestDepartment,
    repeatGrievanceCount,
    slaComplianceRate: slaSummary.complianceRate,
    onTimeCount: slaSummary.onTime,
    overdueCount: slaSummary.overdue,
    pendingCount: slaSummary.pending,
    unresolvedCases,
    criticalActiveCount,
    rootCauseTrends,
  };
}

async function postAiEndpoint<T>(url: string, body: unknown): Promise<AiEndpointResponse<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Permintaan AI gagal (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }

  return response.json();
}

export async function runAiGrievanceAnalysis(
  caseData: GrievanceCase,
  categories: MasterCategory[],
  departments: MasterDepartment[]
): Promise<AiEndpointResponse<AiGrievanceAnalysis>> {
  return postAiEndpoint<AiGrievanceAnalysis>('/api/ai/intelligence/analyze-grievance', {
    caseData: redactCaseForAi(caseData),
    categories: categories.filter((c) => c.active).map((c) => ({ name: c.name, defaultPriority: c.defaultPriority })),
    departments: departments.filter((d) => d.active).map((d) => ({ name: d.name })),
  });
}

export async function runAiRootCauseAnalysis(
  caseData: GrievanceCase,
  investigations: InvestigationRecord[]
): Promise<AiEndpointResponse<AiRootCauseResult>> {
  return postAiEndpoint<AiRootCauseResult>('/api/ai/intelligence/root-cause', {
    caseData: redactCaseForAi(caseData),
    investigations: redactInvestigationsForAi(investigations, caseData),
  });
}

export async function runAiRepeatDetection(
  cases: GrievanceCase[],
  periodLabel: string
): Promise<AiEndpointResponse<AiRepeatGrievanceResult>> {
  return postAiEndpoint<AiRepeatGrievanceResult>('/api/ai/intelligence/repeat-detection', {
    cases: cases.map((c) => redactCaseForAi(c)),
    periodLabel,
  });
}

export async function runAiRiskAssessment(
  cases: GrievanceCase[]
): Promise<AiEndpointResponse<AiRiskAssessmentResult>> {
  return postAiEndpoint<AiRiskAssessmentResult>('/api/ai/intelligence/risk-assessment', {
    cases: cases.map((c) => redactCaseForAi(c)),
  });
}

export async function runAiRecommendCapa(
  caseData: GrievanceCase,
  rootCauseAnalysis: RootCauseAnalysis[] | AiRootCauseResult | null,
  investigations: InvestigationRecord[]
): Promise<AiEndpointResponse<AiRecommendedCapaResult>> {
  return postAiEndpoint<AiRecommendedCapaResult>('/api/ai/intelligence/recommend-capa', {
    caseData: redactCaseForAi(caseData, true),
    rootCauseAnalysis,
    investigations: redactInvestigationsForAi(investigations, caseData),
  });
}

export async function runAiManagementInsights(
  insightType: AiManagementInsightType,
  actualMetrics: AiActualManagementMetrics
): Promise<AiEndpointResponse<AiManagementInsightsResult>> {
  return postAiEndpoint<AiManagementInsightsResult>('/api/ai/intelligence/management-insights', {
    insightType,
    actualMetrics,
  });
}
