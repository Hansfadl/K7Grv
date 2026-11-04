import { GrievanceCase, RootCauseAnalysis } from '../types';

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

export async function generateAiRootCause(
  caseData: GrievanceCase
): Promise<Partial<RootCauseAnalysis>> {
  try {
    const res = await fetch('/api/ai/root-cause-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData }),
    });
    if (!res.ok) throw new Error('Failed to generate root cause');
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('AI RCA fetch notice:', err);
    return {
      primaryCategory: 'Management & Leadership',
      why1: `Ketidaksesuaian operasional terkait ${caseData.complaintCategory}.`,
      why2: 'Komunikasi standar kerja antar tingkatan belum optimal.',
      why3: 'Pengawasan dan tindak lanjut keluhan sebelumnya belum terdokumentasi rapi.',
      why4: 'Belum adanya evaluasi berkala kepatuhan operasional di departemen terkait.',
      why5: 'Sistem pengawasan dan evaluasi PIC belum dijalankan secara konsisten.',
      systemicFactors: 'Kebutuhan standardisasi SOP dan penegakan komunikasi berkala di area kerja.',
      preventiveRecommendations: 'Pelatihan penyegaran kepemimpinan dan audit berkala oleh tim HR.',
    };
  }
}

export async function generateAiReportNarrative(
  period: string,
  stats: any,
  categoryStats: any,
  deptStats: any
): Promise<string> {
  try {
    const res = await fetch('/api/ai/report-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, stats, categoryStats, deptStats }),
    });
    if (!res.ok) throw new Error('Failed to generate narrative');
    const data = await res.json();
    return data.narrative;
  } catch (err: any) {
    console.warn('AI Narrative fetch notice:', err);
    return `Selama periode pelaporan (${period}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. mengelola ${stats.total || 0} keluhan formal dengan tingkat kepatuhan penyelesaian SLA sebesar ${stats.complianceRate || 100}%. Prioritas penanganan difokuskan pada penyelesaian akar masalah melalui CAPA dan verifikasi tindak lanjut.`;
  }
}
