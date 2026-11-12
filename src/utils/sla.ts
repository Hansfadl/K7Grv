/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PriorityLevel, CaseStatus, GrievanceCase, SlaStatus } from '../types';

/**
 * Kalender Hari Libur Nasional & Perusahaan PT Shoenary Javanesia Inc. (SJI) 2026
 * Format: YYYY-MM-DD
 */
export const SJI_COMPANY_HOLIDAYS: string[] = [
  '2026-01-01', // Tahun Baru Masehi
  '2026-01-27', // Isra Mi'raj Nabi Muhammad SAW
  '2026-02-17', // Tahun Baru Imlek 2577 Kongzili
  '2026-03-21', // Hari Suci Nyepi / Hari Raya Idul Fitri 1447 H
  '2026-03-22', // Cuti Bersama Idul Fitri
  '2026-03-23', // Cuti Bersama Idul Fitri
  '2026-04-03', // Wafat Yesus Kristus
  '2026-05-01', // Hari Buruh Internasional
  '2026-05-14', // Kenaikan Yesus Kristus
  '2026-05-27', // Hari Raya Idul Adha 1447 H
  '2026-06-01', // Hari Lahir Pancasila
  '2026-06-16', // Tahun Baru Islam 1448 H
  '2026-08-17', // Hari Kemerdekaan RI
  '2026-08-25', // Maulid Nabi Muhammad SAW
  '2026-12-25', // Hari Raya Natal
];

/**
 * Memeriksa apakah suatu tanggal merupakan hari non-kerja (Sabtu/Minggu atau Hari Libur Perusahaan).
 */
export function isNonWorkingDay(d: Date, customHolidays: string[] = SJI_COMPANY_HOLIDAYS): boolean {
  const dayOfWeek = d.getDay(); // 0 = Minggu, 6 = Sabtu
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const isoDate = `${y}-${m}-${day}`;

  return customHolidays.includes(isoDate);
}

/**
 * Matriks Resolusi SLA SJI Berdasarkan Prioritas (Satuan: Hari Kerja / WORKDAYS):
 * - Minor: 3 hari kerja
 * - Major: 7 hari kerja
 * - Critical: 14 hari kerja
 */
export function getSlaWorkdays(priority: PriorityLevel): number {
  switch (priority) {
    case 'Minor':
      return 3;
    case 'Major':
      return 7;
    case 'Critical':
      return 14;
    default:
      return 7;
  }
}

/**
 * Menambahkan N hari kerja (WORKDAYS) ke tanggal mulai dengan memperhitungkan
 * akhir pekan (Sabtu/Minggu) dan kalender hari libur perusahaan.
 * 
 * Aturan:
 * Jika workdaysToAdd = 3 dan tanggal mulai Senin (02/03):
 * - Hari 1: Selasa (03/03)
 * - Hari 2: Rabu (04/03)
 * - Hari 3: Kamis (05/03) -> Due Date: 2026-03-05
 */
export function addWorkdays(
  startDateStr: string,
  workdaysToAdd: number,
  customHolidays: string[] = SJI_COMPANY_HOLIDAYS
): string {
  if (!startDateStr || workdaysToAdd <= 0) return startDateStr || '';

  // Parse YYYY-MM-DD secara aman tanpa time-zone offset bugs
  let current: Date;
  const parts = startDateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    current = new Date(y, m, d, 12, 0, 0);
  } else {
    current = new Date(startDateStr);
    current.setHours(12, 0, 0, 0);
  }

  if (isNaN(current.getTime())) {
    current = new Date();
    current.setHours(12, 0, 0, 0);
  }

  let remaining = workdaysToAdd;
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    if (!isNonWorkingDay(current, customHolidays)) {
      remaining--;
    }
  }

  const resY = current.getFullYear();
  const resM = String(current.getMonth() + 1).padStart(2, '0');
  const resD = String(current.getDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Menghitung Due Date secara otomatis berdasarkan tanggal penerimaan grievance (dateReceived)
 * dan matriks SLA hari kerja (WORKDAYS) perusahaan.
 */
export function calculateDueDate(
  dateReceivedStr: string,
  priority: PriorityLevel,
  customHolidays: string[] = SJI_COMPANY_HOLIDAYS
): string {
  const days = getSlaWorkdays(priority);
  return addWorkdays(dateReceivedStr, days, customHolidays);
}

/**
 * Menghitung jumlah hari kerja yang telah berlalu antara dua tanggal (start exclusive, end inclusive).
 */
export function countWorkdaysBetween(
  startDateStr: string,
  endDateStr: string,
  customHolidays: string[] = SJI_COMPANY_HOLIDAYS
): number {
  if (!startDateStr || !endDateStr || startDateStr >= endDateStr) return 0;

  const startParts = startDateStr.split('-');
  const endParts = endDateStr.split('-');
  const current = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10), 12, 0, 0);
  const end = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10), 12, 0, 0);

  let count = 0;
  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (!isNonWorkingDay(current, customHolidays)) {
      count++;
    }
  }
  return count;
}

/**
 * Kategori Klasifikasi Audit SLA Kasus SJI:
 * A. On Time: Kasus selesai sebelum atau tepat pada Due Date.
 * B. Overdue: 
 *    - Kasus selesai setelah Due Date.
 *    - Kasus belum selesai tetapi sudah melewati Due Date.
 * C. Pending: Kasus belum selesai dan Due Date belum terlewati.
 * D. Data Incomplete: Kasus tidak memiliki Due Date yang valid.
 */
export type CaseSlaClassification = 'On Time' | 'Overdue' | 'Pending' | 'Data Incomplete';

export interface CaseSlaEvaluation {
  classification: CaseSlaClassification;
  isOnTime: boolean;
  isOverdue: boolean;
  isPending: boolean;
  isDataIncomplete: boolean;
  hoursLeft: number;
}

/**
 * Mengevaluasi status kepatuhan SLA suatu kasus grievance berdasarkan kriteria audit SJI.
 * Mendukung referensi tanggal evaluasi (misal cutoff periode laporan historis).
 */
export function evaluateCaseSla(
  c: GrievanceCase,
  referenceDateStr?: string
): CaseSlaEvaluation {
  // D. Data Incomplete: Kasus tidak memiliki Due Date yang valid. Jangan otomatis menghitungnya sebagai On Time.
  if (!c.dueDate || !c.dueDate.trim() || isNaN(new Date(c.dueDate).getTime())) {
    return {
      classification: 'Data Incomplete',
      isOnTime: false,
      isOverdue: false,
      isPending: false,
      isDataIncomplete: true,
      hoursLeft: 0,
    };
  }

  const dueDateIso = c.dueDate.substring(0, 10);
  const refDate = referenceDateStr
    ? referenceDateStr.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  // Status: Selesai (Closed)
  if (c.status === 'Closed') {
    // Tanggal penyelesaian kasus
    const closingIso = c.closingDate
      ? c.closingDate.substring(0, 10)
      : (c.lastUpdate ? c.lastUpdate.substring(0, 10) : (c.dateReceived?.substring(0, 10) || refDate));

    // A. On Time: Kasus selesai sebelum atau tepat pada Due Date.
    if (closingIso <= dueDateIso) {
      return {
        classification: 'On Time',
        isOnTime: true,
        isOverdue: false,
        isPending: false,
        isDataIncomplete: false,
        hoursLeft: 0,
      };
    } else {
      // B. Overdue (Kasus selesai setelah Due Date)
      return {
        classification: 'Overdue',
        isOnTime: false,
        isOverdue: true,
        isPending: false,
        isDataIncomplete: false,
        hoursLeft: 0,
      };
    }
  }

  // Status: Belum Selesai (Open / Investigation / Action Taken)
  // Evaluasi terhadap tanggal referensi (hari ini atau cutoff laporan)
  if (refDate > dueDateIso) {
    // B. Overdue (Kasus belum selesai tetapi sudah melewati Due Date)
    const dueTime = new Date(`${dueDateIso}T23:59:59+07:00`).getTime();
    const nowTime = new Date().getTime();
    const hoursLeft = Math.round((dueTime - nowTime) / (1000 * 60 * 60));
    return {
      classification: 'Overdue',
      isOnTime: false,
      isOverdue: true,
      isPending: false,
      isDataIncomplete: false,
      hoursLeft,
    };
  } else {
    // C. Pending: Kasus belum selesai dan Due Date belum terlewati.
    const dueTime = new Date(`${dueDateIso}T23:59:59+07:00`).getTime();
    const nowTime = new Date().getTime();
    const hoursLeft = Math.max(0, Math.round((dueTime - nowTime) / (1000 * 60 * 60)));
    return {
      classification: 'Pending',
      isOnTime: false,
      isOverdue: false,
      isPending: true,
      isDataIncomplete: false,
      hoursLeft,
    };
  }
}

export interface SlaComplianceSummary {
  total: number;
  onTime: number;
  overdue: number;
  pending: number;
  dataIncomplete: number;
  evaluableCount: number; // Total On Time + Total Overdue
  complianceRate: number; // Formula: (Total On Time / (Total On Time + Total Overdue)) * 100%
}

/**
 * Menghitung ringkasan kepatuhan SLA untuk daftar kasus.
 * 
 * Formula:
 * SLA Compliance = (Total On Time / (Total On Time + Total Overdue)) × 100%
 * 
 * Catatan penting:
 * - Pending dan Data Incomplete tidak masuk denominator.
 * - Nilai 100% hanya muncul apabila seluruh kasus yang memenuhi kriteria perhitungan benar-benar On Time.
 * - Jika tidak ada kasus evaluable (evaluableCount === 0), compliance rate adalah 0.
 */
export function calculateSlaCompliance(
  casesList: GrievanceCase[],
  referenceDateStr?: string
): SlaComplianceSummary {
  let onTime = 0;
  let overdue = 0;
  let pending = 0;
  let dataIncomplete = 0;

  for (const c of casesList) {
    const res = evaluateCaseSla(c, referenceDateStr);
    if (res.isOnTime) onTime++;
    else if (res.isOverdue) overdue++;
    else if (res.isPending) pending++;
    else if (res.isDataIncomplete) dataIncomplete++;
  }

  const evaluableCount = onTime + overdue;
  const complianceRate = evaluableCount > 0 ? Math.round((onTime / evaluableCount) * 100) : 0;

  return {
    total: casesList.length,
    onTime,
    overdue,
    pending,
    dataIncomplete,
    evaluableCount,
    complianceRate,
  };
}

/**
 * Menghitung detail SLA Status dan sisa jam untuk kartu/tabel individual.
 */
export function calculateSlaStatus(
  dateReceived: string,
  dueDate: string,
  status: CaseStatus,
  closingDate?: string | null
): { slaStatus: SlaStatus; slaHoursLeft: number } {
  const dummyCase = {
    id: 'eval',
    ticketId: 'eval',
    dateReceived,
    dueDate,
    status,
    closingDate,
  } as GrievanceCase;

  const evaluation = evaluateCaseSla(dummyCase);

  if (status === 'Closed') {
    return {
      slaStatus: evaluation.isOnTime ? 'Met' : 'Overdue',
      slaHoursLeft: 0,
    };
  }

  if (evaluation.isOverdue) {
    return {
      slaStatus: 'Overdue',
      slaHoursLeft: evaluation.hoursLeft,
    };
  }

  if (evaluation.isPending) {
    if (evaluation.hoursLeft <= 48) {
      return {
        slaStatus: 'Approaching Due',
        slaHoursLeft: evaluation.hoursLeft,
      };
    }
    return {
      slaStatus: 'On Track',
      slaHoursLeft: evaluation.hoursLeft,
    };
  }

  return {
    slaStatus: 'On Track',
    slaHoursLeft: 0,
  };
}
