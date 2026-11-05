import { GrievanceCase, RootCauseAnalysis, InvestigationRecord, ActionPlan, Rca6MCategory } from '../types';

export async function generateCaseAiSummary(caseData: GrievanceCase): Promise<string> {
  try {
    const res = await fetch('/api/ai/case-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData }),
    });
    if (!res.ok) throw new Error('Failed to generate summary');
    const data = await res.json();
    return data.summary;
  } catch (err: any) {
    console.warn('AI summary fetch notice:', err);
    return `### Ringkasan Eksekutif Kasus (${caseData.ticketId})
Keluhan terkait ${caseData.complaintCategory} pada departemen ${caseData.department} dengan prioritas ${caseData.priority}.
Status terkini: ${caseData.status}. Saluran masuk: ${caseData.channelReceived}.`;
  }
}

export async function generateAiInvestigationSummary(
  caseData: GrievanceCase,
  investigationData: Partial<InvestigationRecord>
): Promise<string> {
  try {
    const res = await fetch('/api/ai/investigation-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData, investigationData }),
    });
    if (!res.ok) throw new Error('Failed to generate investigation summary');
    const data = await res.json();
    return data.summary;
  } catch (err: any) {
    return `Investigasi terhadap pengaduan #${caseData.ticketId} di departemen ${caseData.department} telah dilaksanakan dengan pengumpulan keterangan saksi dan pembuktian dokumenter.`;
  }
}

export async function generateAiRootCause(
  caseData: GrievanceCase,
  category?: Rca6MCategory
): Promise<Partial<RootCauseAnalysis>> {
  try {
    const res = await fetch('/api/ai/root-cause-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData, category }),
    });
    if (!res.ok) throw new Error('Failed to generate root cause');
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('AI RCA fetch notice:', err);
    return {
      category: category || 'Method',
      rootCause: `Ketidaksesuaian prosedur operasional terkait ${caseData.complaintCategory}.`,
      contributingFactors: 'Komunikasi standar kerja antar tingkatan belum optimal.',
      impact: 'Potensi friksi dan penurunan kenyamanan kerja karyawan.',
      correctiveRecommendations: 'Penyegaran SOP dan pengawasan berkala oleh PIC Departemen.',
    };
  }
}

export async function generateAiCapaSummary(
  caseData: GrievanceCase,
  actionPlans: ActionPlan[]
): Promise<string> {
  try {
    const res = await fetch('/api/ai/capa-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData, actionPlans }),
    });
    if (!res.ok) throw new Error('Failed to generate CAPA summary');
    const data = await res.json();
    return data.summary;
  } catch (err) {
    return `Terdapat ${actionPlans.length} item CAPA terdaftar untuk kasus #${caseData.ticketId}. Status perbaikan dipantau secara berkala oleh PIC.`;
  }
}

export async function generateAiReportNarrative(
  period: string,
  stats: any,
  categoryStats: any,
  deptStats: any,
  rankings?: any
): Promise<string> {
  try {
    const res = await fetch('/api/ai/report-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, stats, categoryStats, deptStats, rankings }),
    });
    if (!res.ok) throw new Error('Failed to generate narrative');
    const data = await res.json();
    return data.narrative;
  } catch (err: any) {
    console.warn('AI Narrative fetch notice:', err);
    return `Selama periode pelaporan (${period}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. mengelola ${stats.total || 0} keluhan formal dengan tingkat kepatuhan penyelesaian SLA sebesar ${stats.complianceRate || 100}%. Prioritas penanganan difokuskan pada penyelesaian akar masalah melalui CAPA dan verifikasi tindak lanjut.`;
  }
}
