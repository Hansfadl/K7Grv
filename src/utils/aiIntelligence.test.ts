import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scrubPiiString,
  redactCaseForAi,
  redactInvestigationsForAi,
  computeActualManagementMetrics,
} from '../services/aiIntelligence';
import { GrievanceCase, InvestigationRecord, RootCauseAnalysis } from '../types';

const SAMPLE_CASES: GrievanceCase[] = [
  {
    id: 'c1',
    ticketId: 'GRV-2026-001',
    dateReceived: '2026-11-02',
    employeeName: 'Budi Santoso',
    employeeNik: '3201019001010001',
    isAnonymous: false,
    department: 'Sewing',
    complaintCategory: 'Lembur & Jam Kerja',
    priority: 'Major',
    status: 'Closed',
    assignedPic: 'Agus Wijaya',
    assignedPicId: 'u-pic-1',
    assignedInvestigator: 'Rina Kusuma',
    assignedInvestigatorId: 'u-inv-1',
    progress: 100,
    dueDate: '2026-11-11',
    closingDate: '2026-11-10',
    slaStatus: 'Met',
    slaHoursLeft: 0,
    lastUpdate: '2026-11-10 15:00',
    description:
      'Karyawan Budi Santoso (budi.santoso@sji.co.id / 081234567890) melaporkan selisih jam lembur shift malam di Line 4.',
    channelReceived: 'Online',
  },
  {
    id: 'c2',
    ticketId: 'GRV-2026-002',
    dateReceived: '2026-11-03',
    employeeName: 'Anonim Rahasia',
    employeeNik: '3201019001010002',
    isAnonymous: true,
    anonymousAlias: 'Whistleblower #4821',
    department: 'Sewing',
    complaintCategory: 'Lembur & Jam Kerja',
    priority: 'Major',
    status: 'Investigation',
    assignedPic: 'Agus Wijaya',
    assignedPicId: 'u-pic-1',
    assignedInvestigator: 'Rina Kusuma',
    assignedInvestigatorId: 'u-inv-1',
    progress: 45,
    dueDate: '2026-11-06',
    closingDate: null,
    slaStatus: 'Overdue',
    slaHoursLeft: -48,
    lastUpdate: '2026-11-11 09:00',
    description: 'Rekonsiliasi form lembur tanggal 1 November belum sesuai dengan finger log.',
    channelReceived: 'Grievance Box',
  },
  {
    id: 'c3',
    ticketId: 'GRV-2026-003',
    dateReceived: '2026-11-10',
    employeeName: 'Siti Aminah',
    employeeNik: '3201019001010003',
    isAnonymous: false,
    department: 'Assembly',
    complaintCategory: 'Keselamatan K3',
    priority: 'Critical',
    status: 'Open',
    assignedPic: 'Dedi Pratama',
    assignedPicId: 'u-pic-2',
    progress: 15,
    dueDate: '2026-11-30',
    closingDate: null,
    slaStatus: 'On Track',
    slaHoursLeft: 240,
    lastUpdate: '2026-11-10 11:00',
    description: 'Ventilasi area lem berbau menyengat dan butuh pemeriksaan K3 segera.',
    channelReceived: 'Hotline',
  },
  {
    id: 'c4',
    ticketId: 'GRV-2026-004',
    dateReceived: '2026-10-15',
    employeeName: 'Hendra Gunawan',
    isAnonymous: false,
    department: 'Warehouse',
    complaintCategory: 'Fasilitas',
    priority: 'Minor',
    status: 'Closed',
    assignedPic: 'Tono',
    assignedPicId: 'u-pic-3',
    progress: 100,
    dueDate: '', // Data Incomplete
    closingDate: '2026-10-18',
    slaStatus: 'Met',
    slaHoursLeft: 0,
    lastUpdate: '2026-10-18 10:00',
    description: 'Lampu gudang B redup.',
    channelReceived: 'Online',
  },
];

test('PII Redaction strips names, NIK, email, phone numbers, and investigator info without mutating source', () => {
  const originalSnapshot = JSON.stringify(SAMPLE_CASES[0]);
  const redacted = redactCaseForAi(SAMPLE_CASES[0]);

  assert.equal(JSON.stringify(SAMPLE_CASES[0]), originalSnapshot);
  assert.ok(!redacted.employeeName.includes('Budi Santoso'));
  assert.ok(!redacted.description.includes('Budi Santoso'));
  assert.ok(!redacted.description.includes('budi.santoso@sji.co.id'));
  assert.ok(!redacted.description.includes('081234567890'));
  assert.ok(redacted.description.includes('[NAMA_TERLINDUNGI]'));
  assert.ok(redacted.description.includes('[EMAIL_TERLINDUNGI]'));
  assert.ok(redacted.description.includes('[KONTAK_TERLINDUNGI]'));
  assert.equal((redacted as any).employeeNik, undefined);
  assert.equal((redacted as any).assignedInvestigator, undefined);

  const anonRedacted = redactCaseForAi(SAMPLE_CASES[1]);
  assert.ok(anonRedacted.employeeName.includes('Anonim'));
});

test('Investigation Redaction strips witness and investigator PII', () => {
  const inv: InvestigationRecord[] = [
    {
      id: 'inv-1',
      caseId: 'c1',
      ticketId: 'GRV-2026-001',
      investigationDate: '2026-11-05',
      investigationDetails: 'Pemeriksaan bersama Rina Kusuma atas laporan Budi Santoso NIK 3201019001010001.',
      interviewNotes: 'Hubungi saksi di 081234567890',
      witnessInfo: 'Saksi A (Supervisor)',
      supportingInfo: 'Rekap absensi',
      evidenceRef: 'PDF-01',
      findings: 'Ditemukan jeda input form lembur.',
      conclusion: 'Perlu sinkronisasi harian.',
      recommendedActions: 'Update SOP verifikasi.',
      investigatorName: 'Rina Kusuma',
      investigatorId: 'u-inv-1',
      createdAt: '2026-11-05 14:00',
    },
  ];

  const redactedInv = redactInvestigationsForAi(inv, SAMPLE_CASES[0]);
  assert.equal(redactedInv.length, 1);
  assert.ok(!redactedInv[0].investigationDetails.includes('Rina Kusuma'));
  assert.ok(!redactedInv[0].investigationDetails.includes('Budi Santoso'));
  assert.ok(!redactedInv[0].investigationDetails.includes('3201019001010001'));
  assert.ok(!redactedInv[0].interviewNotes.includes('081234567890'));
  assert.equal(redactedInv[0].witnessInfo, '[INFORMASI_SAKSI_DISAMARKAN]');
  assert.equal((redactedInv[0] as any).investigatorName, undefined);
});

test('computeActualManagementMetrics computes exact SLA compliance, repeat clusters, and 6M trends', () => {
  const rcaMap: Record<string, RootCauseAnalysis[]> = {
    c1: [
      {
        id: 'rc1',
        caseId: 'c1',
        ticketId: 'GRV-2026-001',
        category: 'Method',
        rootCause: 'Prosedur manual',
        contributingFactors: 'Form terlambat',
        impact: 'Selisih lembur',
        correctiveRecommendations: 'Digitalisasi cek',
        analystId: 'u-inv-1',
        analystName: 'Rina Kusuma',
        updatedAt: '2026-11-08 10:00',
      },
    ],
  };

  // Monthly scope for 2026-11 (refDate 2026-11-12): includes c1 (On Time), c2 (Overdue), c3 (Pending)
  const monthly = computeActualManagementMetrics(SAMPLE_CASES, rcaMap, 'monthly', undefined, '2026-11-12');
  assert.equal(monthly.totalGrievance, 3);
  assert.equal(monthly.onTimeCount, 1);
  assert.equal(monthly.overdueCount, 1);
  assert.equal(monthly.pendingCount, 1);
  // Pending is excluded from denominator: 1 / (1 + 1) * 100 = 50%
  assert.equal(monthly.slaComplianceRate, 50);
  assert.equal(monthly.unresolvedCases, 2);
  assert.equal(monthly.criticalActiveCount, 1);
  assert.equal(monthly.dominantCategory.name, 'Lembur & Jam Kerja');
  assert.equal(monthly.dominantCategory.count, 2);
  assert.equal(monthly.highestDepartment.name, 'Sewing');
  assert.equal(monthly.highestDepartment.count, 2);
  assert.equal(monthly.repeatGrievanceCount, 2);
  assert.deepEqual(monthly.rootCauseTrends, [{ category: 'Method', count: 1 }]);

  // Departmental scope (Assembly)
  const dept = computeActualManagementMetrics(SAMPLE_CASES, rcaMap, 'departmental', 'Assembly', '2026-11-12');
  assert.equal(dept.totalGrievance, 1);
  assert.equal(dept.criticalActiveCount, 1);
  assert.equal(dept.pendingCount, 1);
  assert.equal(dept.slaComplianceRate, 0); // 0 evaluable (only pending)

  // Executive scope excludes Data Incomplete (c4) from SLA denominator cleanly
  const exec = computeActualManagementMetrics(SAMPLE_CASES, rcaMap, 'executive', undefined, '2026-11-12');
  assert.equal(exec.totalGrievance, 4);
  assert.equal(exec.onTimeCount, 1);
  assert.equal(exec.overdueCount, 1);
  assert.equal(exec.slaComplianceRate, 50);
});

test('scrubPiiString handles null and empty safely', () => {
  assert.equal(scrubPiiString(null), '');
  assert.equal(scrubPiiString(undefined), '');
  assert.equal(scrubPiiString('Keluhan fasilitas AC ruang produksi'), 'Keluhan fasilitas AC ruang produksi');
});
