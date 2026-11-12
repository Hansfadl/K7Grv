import {
  GrievanceCase,
  InvestigationFinding,
  RootCauseAnalysis,
  ActionPlan,
  CommunicationLog,
  EvidenceItem,
  UserProfile,
  MasterCategory,
  MasterDepartment,
  AuditLog,
  GrievanceInstrument
} from '../types';

export const GRIEVANCE_INSTRUMENTS: GrievanceInstrument[] = [
  'Online',
  'Grievance Box',
  'Verbal',
  'Hotline'
];

// Kosongkan semua data user awal agar user menambahkan sendiri
export const INITIAL_USERS: UserProfile[] = [];

// 12 Kategori standard SJI (SLA Resolusi: Minor 3 Hari Kerja, Major 7 Hari Kerja, Critical 14 Hari Kerja)
export const INITIAL_CATEGORIES: MasterCategory[] = [
  {
    id: 'cat-01',
    name: 'Kebijakan',
    code: 'KBJ',
    defaultPriority: 'Major',
    slaDays: 7,
    description: 'Keluhan terkait implementasi aturan perusahaan, Standar Operasional Prosedur (SOP), surat peringatan (SP), atau kebijakan ketenagakerjaan internal PT SJI.',
    active: true,
  },
  {
    id: 'cat-02',
    name: 'Atasan',
    code: 'ATS',
    defaultPriority: 'Major',
    slaDays: 7,
    description: 'Penyalahgunaan wewenang, perlakuan tidak adil, komunikasi tidak profesional, favoritisme, atau diskriminasi oleh atasan langsung/supervisor.',
    active: true,
  },
  {
    id: 'cat-03',
    name: 'Lingkungan Kerja',
    code: 'LK',
    defaultPriority: 'Minor',
    slaDays: 3,
    description: 'Kondisi fisik area kerja, kenyamanan ruang kerja, sirkulasi udara, kebisingan, suhu lini produksi, atau hubungan interpersonal sesama rekan kerja.',
    active: true,
  },
  {
    id: 'cat-04',
    name: 'Pelecehan',
    code: 'PLH',
    defaultPriority: 'Critical',
    slaDays: 14,
    description: 'Pelecehan verbal, fisik, seksual, intimidasi, kekerasan di tempat kerja, atau perundungan (bullying). Penanganan awal & triage segera (72 jam), target resolusi tuntas 14 hari kerja.',
    active: true,
  },
  {
    id: 'cat-05',
    name: 'Cuti',
    code: 'CT',
    defaultPriority: 'Minor',
    slaDays: 3,
    description: 'Kendala pengajuan cuti tahunan, cuti melahirkan/keguguran, cuti sakit dengan surat dokter, izin resmi, atau persetujuan hak cuti karyawan.',
    active: true,
  },
  {
    id: 'cat-06',
    name: 'Lembur',
    code: 'LBR',
    defaultPriority: 'Major',
    slaDays: 7,
    description: 'Perhitungan upah lembur tidak sesuai, pembagian jadwal lembur tidak proporsional, form lembur terlambat, atau pemaksaan jam lembur di luar kesepakatan.',
    active: true,
  },
  {
    id: 'cat-07',
    name: 'Fasilitas',
    code: 'FSL',
    defaultPriority: 'Minor',
    slaDays: 3,
    description: 'Fasilitas umum pabrik: kantin, toilet, musala, loker kerja, area parkir kendaraan, klinik pabrik, sarana kebersihan, atau transportasi bus jemputan karyawan.',
    active: true,
  },
  {
    id: 'cat-08',
    name: 'Keamanan',
    code: 'KMN',
    defaultPriority: 'Critical',
    slaDays: 14,
    description: 'Bahaya K3 (Keselamatan dan Kesehatan Kerja), ketiadaan APD darurat, mesin tanpa guard pelindung, ancaman keselamatan fisik, atau bahaya kebakaran. Penanganan awal segera (72 jam), target resolusi 14 hari kerja.',
    active: true,
  },
  {
    id: 'cat-09',
    name: 'Proses Produksi',
    code: 'PRD',
    defaultPriority: 'Major',
    slaDays: 7,
    description: 'Target output lini kerja tidak realistis, material cacat dari supplier, kendala alur kerja proses produksi, atau bottleneck mesin operasional.',
    active: true,
  },
  {
    id: 'cat-10',
    name: 'People Development',
    code: 'PPD',
    defaultPriority: 'Minor',
    slaDays: 3,
    description: 'Peluang pelatihan/skill training operator, program sertifikasi kompetensi, kejelasan jenjang karier, penilaian kinerja berkala, atau promosi jabatan.',
    active: true,
  },
  {
    id: 'cat-11',
    name: 'Benefit',
    code: 'BNF',
    defaultPriority: 'Major',
    slaDays: 7,
    description: 'Jaminan BPJS Ketenagakerjaan & BPJS Kesehatan, tunjangan hari raya (THR), insentif kehadiran kerja, uang makan/transportasi, atau bonus kinerja.',
    active: true,
  },
  {
    id: 'cat-12',
    name: 'Absensi',
    code: 'ABS',
    defaultPriority: 'Minor',
    slaDays: 3,
    description: 'Masalah mesin fingerprint/face recognition, ketidaktercatatan jam masuk/pulang kerja, koreksi absensi manual, atau rekonsiliasi pemotongan keterlambatan.',
    active: true,
  }
];

// 12 Departemen dari user, dengan PIC dikosongkan agar user menambahkan sendiri
export const INITIAL_DEPARTMENTS: MasterDepartment[] = [
  { id: 'dept-01', name: 'HR', code: 'HR', picName: '', picEmail: '', active: true },
  { id: 'dept-02', name: 'GA Departement', code: 'GA', picName: '', picEmail: '', active: true },
  { id: 'dept-03', name: 'HSE', code: 'HSE', picName: '', picEmail: '', active: true },
  { id: 'dept-04', name: 'PPIC', code: 'PPIC', picName: '', picEmail: '', active: true },
  { id: 'dept-05', name: 'Payroll', code: 'PAY', picName: '', picEmail: '', active: true },
  { id: 'dept-06', name: 'Sewing', code: 'SEW', picName: '', picEmail: '', active: true },
  { id: 'dept-07', name: 'Assembling', code: 'ASM', picName: '', picEmail: '', active: true },
  { id: 'dept-08', name: 'Teknikal', code: 'TEK', picName: '', picEmail: '', active: true },
  { id: 'dept-09', name: 'PCC', code: 'PCC', picName: '', picEmail: '', active: true },
  { id: 'dept-10', name: 'Engineering', code: 'ENG', picName: '', picEmail: '', active: true },
  { id: 'dept-11', name: 'HA', code: 'HA', picName: '', picEmail: '', active: true },
  { id: 'dept-12', name: 'Others', code: 'OTH', picName: '', picEmail: '', active: true },
];

// Dikosongkan total agar user memulai dari kondisi bersih
export const INITIAL_CASES: GrievanceCase[] = [];
export const INITIAL_FINDINGS: Record<string, InvestigationFinding[]> = {};
export const INITIAL_ROOT_CAUSES: Record<string, RootCauseAnalysis> = {};
export const INITIAL_ACTION_PLANS: Record<string, ActionPlan[]> = {};
export const INITIAL_COMMUNICATIONS: Record<string, CommunicationLog[]> = {};
export const INITIAL_EVIDENCE: Record<string, EvidenceItem[]> = {};
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
