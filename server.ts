import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateLocalCaseSummary(caseData: any): string {
  const reporter = caseData.isAnonymous ? 'Pelapor Anonim (Identitas Terlindungi)' : caseData.employeeName || 'Karyawan SJI';
  return `### Ringkasan Eksekutif Kasus (${caseData.ticketId})
Keluhan terkait **${caseData.complaintCategory}** telah dicatat pada sistem internal HR PT Shoenary Javanesia Inc. oleh ${reporter} untuk departemen **${caseData.department}** dengan tingkat urgensi **${caseData.priority}**.

### Poin Utama & Analisis Situasional
- **Inti Keluhan**: ${caseData.description || 'Tidak ada uraian detail'}
- **Saluran Masuk**: ${caseData.channelReceived || 'Online Portal'}
- **Tanggal Keluhan**: ${caseData.dateReceived || '-'}
- **Fasilitas / Lokasi Kejadian**: ${caseData.location || 'Area Kerja PT Shoenary Javanesia Inc.'}
- **Pihak yang Terkait**: ${caseData.involvedParties || 'Sedang dalam pendalaman investigasi'}

### Rekomendasi Investigasi HR & Langkah Awal
1. **Verifikasi Bukti Dokumen & Log**: Periksa bukti pendukung (foto/dokumen/PDF) yang relevan dengan nomor tiket ${caseData.ticketId}.
2. **Klarifikasi Tertutup**: Lakukan pemanggilan klarifikasi formal terhadap pihak terlapor dan saksi-saksi secara tertutup tanpa memperlihatkan identitas pelapor (jika anonim).
3. **Analisis 6M Root Cause**: Identifikasi akar masalah mendalam melalui domain Man, Method, Machine, Material, Measurement, Environment.
4. **Penyusunan Rencana CAPA**: Rumuskan rencana tindakan korektif dan preventif bersama PIC Departemen ${caseData.department}.`;
}

function generateLocal6MRca(caseData: any) {
  const cat = caseData.complaintCategory || 'Kebijakan';
  let category: any = 'Method';
  let rootCause = `Kurangnya sosialisasi berkala dan pengawasan implementasi SOP terkait ${cat} di tingkat lini operasional.`;
  let contributingFactors = `Beban kerja tinggi, rotasi personil baru tanpa onboarding SOP yang memadai, dan minimnya checklist audit harian.`;
  let impact = `Terjadinya friksi kerja, potensi penurunan moral karyawan, dan risiko ketidakpatuhan terhadap standar audit ketenagakerjaan.`;
  let correctiveRecommendations = `1. Refreshment briefing SOP harian oleh Supervisor.\n2. Pembentukan saluran komunikasi dua arah antara PIC Departemen dan karyawan.\n3. Evaluasi berkala efektivitas tindakan perbaikan setiap 14 hari.`;

  if (cat.includes('Lembur') || cat.includes('Payroll') || cat.includes('Absensi')) {
    category = 'Method';
    rootCause = 'Rekonsiliasi data kehadiran dan formulir lembur belum terintegrasi otomatis sehingga terjadi selisih pencatatan manual.';
    contributingFactors = 'Validasi form lembur terlambat diserahkan oleh line supervisor sebelum cut-off payroll.';
    impact = 'Keterlambatan atau perbedaan nominal kompensasi yang menimbulkan ketidakpuasan karyawan.';
    correctiveRecommendations = '1. Terapkan batas waktu finalisasi lembur harian.\n2. Audit silang acak antara finger log dan form lembur mingguan.';
  } else if (cat.includes('Pelecehan') || cat.includes('Lingkungan Kerja')) {
    category = 'Man';
    rootCause = 'Kurangnya pemahaman mengenai etika komunikasi profesional dan batasan perilaku antar rekan kerja di lini kerja.';
    contributingFactors = 'Kurangnya pengawasan sikap oleh atasan langsung dan belum rutinnya sosialisasi pakta integritas tempat kerja aman.';
    impact = 'Tekanan psikologis bagi korban dan rusaknya suasana kerja yang harmonis di tempat kerja.';
    correctiveRecommendations = '1. Tindakan pembinaan disiplin tegas sesuai Peraturan Perusahaan.\n2. Sosialisasi anti-pelecehan dan pendampingan bagi korban.';
  } else if (cat.includes('Fasilitas') || cat.includes('K3') || cat.includes('Mesin')) {
    category = 'Machine';
    rootCause = 'Jadwal preventive maintenance mesin/fasilitas terlambat dieksekusi atau suku cadang pending penggantian.';
    contributingFactors = 'Intensitas operasional tinggi tanpa jeda inspeksi berkala.';
    impact = 'Ketidaknyamanan fisik dan potensi bahaya K3 bagi karyawan di area terkait.';
    correctiveRecommendations = '1. Perbaikan dan peremajaan komponen yang rusak.\n2. Pembuatan checklist inspeksi harian pra-operasional.';
  }

  return {
    category,
    rootCause,
    contributingFactors,
    impact,
    correctiveRecommendations,
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  const aiApiKey = process.env.GEMINI_API_KEY;
  const ai = aiApiKey
    ? new GoogleGenAI({
        apiKey: aiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  const AI_MODEL = 'gemini-4-hydrogen';

  function parseCleanJson(rawText?: string): any {
    let jsonStr = (rawText || '').trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(jsonStr);
  }

  function scrubPiiText(text?: string | null): string {
    if (!text) return '';
    return String(text)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_TERLINDUNGI]')
      .replace(/(\+62|62|0)8[1-9][0-9\-\s]{7,13}/g, '[KONTAK_TERLINDUNGI]')
      .replace(/\b\d{16}\b/g, '[ID_TERLINDUNGI]');
  }

  function sanitizeCaseForServerAi(c: any) {
    if (!c) return {};
    return {
      id: c.id,
      ticketId: c.ticketId,
      dateReceived: c.dateReceived,
      reporterLabel: c.isAnonymous ? 'Pelapor Anonim (Whistleblower Terlindungi)' : 'Karyawan Terlindungi (Identitas Disamarkan)',
      department: c.department || 'Umum',
      complaintCategory: c.complaintCategory || 'Belum Diklasifikasi',
      currentPriority: c.priority || 'Major',
      status: c.status || 'Open',
      dueDate: c.dueDate || null,
      closingDate: c.closingDate || null,
      slaStatus: c.slaStatus || 'On Track',
      channelReceived: c.channelReceived || 'Online',
      description: scrubPiiText(c.description),
      incidentDate: c.incidentDate || null,
      location: scrubPiiText(c.location),
      involvedParties: c.involvedParties ? 'Pihak Terkait Internal (Disamarkan untuk Privasi)' : null,
      resolutionSummary: scrubPiiText(c.resolutionSummary),
    };
  }

  // Endpoint 1: Grievance Summary & Executive Notes
  app.post('/api/ai/case-summary', async (req, res) => {
    try {
      const { caseData } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }

      if (!ai) {
        const generated = generateLocalCaseSummary(caseData);
        return res.json({ summary: generated, model: 'sji-local-rules-engine' });
      }

      const prompt = `Anda adalah Spesialis Kepatuhan Etika & Hubungan Industrial di PT SHOENARY JAVANESIA INC. (SJI).
Gunakan HANYA informasi aktual dari data berikut tanpa menambah fakta fiktif:
- Ticket ID: ${caseData.ticketId}
- Tanggal Diterima (Grievance Date): ${caseData.dateReceived}
- Pelapor: ${caseData.isAnonymous ? 'Anonim (Whistleblower Terlindungi)' : caseData.employeeName}
- Departemen: ${caseData.department}
- Kategori Keluhan: ${caseData.complaintCategory}
- Prioritas: ${caseData.priority} (SLA: Minor 3 Hari, Major 7 Hari, Critical 14 Hari)
- Saluran Masuk: ${caseData.channelReceived}
- Uraian Keluhan: ${caseData.description}
- Tanggal Kejadian: ${caseData.incidentDate || '-'}
- Lokasi: ${caseData.location || '-'}
- Pihak Terlibat: ${caseData.involvedParties || '-'}

Susun ringkasan eksekutif formal dalam Bahasa Indonesia:
1. **Ringkasan Eksekutif Kasus**
2. **Poin Analisis Situasional & Kepatuhan**
3. **Poin-Poin Kunci Investigasi Lanjutan**
4. **Rekomendasi Aksi Cepat Sesuai SLA**`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return res.json({ summary: response.text, model: 'gemini-3.8-flash' });
    } catch (err: any) {
      console.warn('Gemini summary call notification:', err.message);
      const fallback = generateLocalCaseSummary(req.body.caseData);
      return res.json({ summary: fallback, model: 'sji-local-rules-engine' });
    }
  });

  // Endpoint 2: Investigation Summary
  app.post('/api/ai/investigation-summary', async (req, res) => {
    try {
      const { caseData, investigationData } = req.body;
      if (!ai) {
        const notes = investigationData?.interviewNotes || 'Klarifikasi telah dilakukan dengan saksi dan pihak terkait.';
        const findings = investigationData?.findings || 'Ditemukan bukti pendukung ketidaksesuaian prosedur operasional.';
        const conclusion = investigationData?.conclusion || 'Investigasi menyimpulkan perlunya tindakan perbaikan CAPA.';
        return res.json({
          summary: `### Ringkasan Investigasi Kasus #${caseData?.ticketId || ''}\n- **Wawancara**: ${notes}\n- **Temuan**: ${findings}\n- **Kesimpulan**: ${conclusion}\n- **Tindakan**: Koordinasi dengan PIC Departemen ${caseData?.department || ''}.`
        });
      }

      const prompt = `Anda adalah Investigator Hubungan Karyawan PT SHOENARY JAVANESIA INC.
Buat ringkasan investigasi faktual dan objektif berdasarkan data berikut (jangan mengarang hal yang tidak tertulis):
- Kasus: ${caseData?.ticketId} (${caseData?.complaintCategory} - ${caseData?.department})
- Tanggal Investigasi: ${investigationData?.investigationDate}
- Detail Investigasi: ${investigationData?.investigationDetails}
- Catatan Wawancara: ${investigationData?.interviewNotes}
- Keterangan Saksi: ${investigationData?.witnessInfo}
- Temuan Lapangan: ${investigationData?.findings}
- Kesimpulan: ${investigationData?.conclusion}
- Rekomendasi Tindakan: ${investigationData?.recommendedActions}

Tuliskan 2 paragraf ringkasan investigasi formal dalam Bahasa Indonesia.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      return res.json({ summary: response.text });
    } catch (err: any) {
      return res.json({
        summary: `Investigasi kasus #${req.body.caseData?.ticketId || ''} telah selesai didokumentasikan dan diserahkan ke bagian terkait.`
      });
    }
  });

  // Endpoint 3: 6M Root Cause Analysis Suggestion
  app.post('/api/ai/root-cause-suggest', async (req, res) => {
    try {
      const { caseData } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }

      if (!ai) {
        return res.json(generateLocal6MRca(caseData));
      }

      const prompt = `Anda adalah Auditor & Praktisi Root Cause Analysis (6M Ishikawa) di PT SHOENARY JAVANESIA INC.
Berdasarkan keluhan faktual berikut:
- Kategori: ${caseData.complaintCategory}
- Departemen: ${caseData.department}
- Deskripsi: ${caseData.description}

Hasilkan analisis RCA berdasarkan 6M (Man / Method / Machine / Material / Measurement / Environment) dalam format JSON murni:
{
  "category": "Man" | "Method" | "Machine" | "Material" | "Measurement" | "Environment",
  "rootCause": "Penyebab mendasar masalah",
  "contributingFactors": "Faktor pendukung terjadinya masalah",
  "impact": "Dampak terhadap operasional atau karyawan",
  "correctiveRecommendations": "Rekomendasi perbaikan korektif & preventif"
}
Hanya kembalikan JSON valid tanpa backticks markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      let jsonStr = response.text?.trim() || '';
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();

      const parsed = JSON.parse(jsonStr);
      return res.json(parsed);
    } catch (err) {
      return res.json(generateLocal6MRca(req.body.caseData));
    }
  });

  // Endpoint 4: CAPA Summary
  app.post('/api/ai/capa-summary', async (req, res) => {
    try {
      const { caseData, actionPlans } = req.body;
      if (!ai || !actionPlans || actionPlans.length === 0) {
        const completedCount = (actionPlans || []).filter((p: any) => p.progressStatus === 'Completed').length;
        return res.json({
          summary: `Terdapat ${(actionPlans || []).length} item rencana perbaikan CAPA untuk kasus ${caseData?.ticketId || ''}. ${completedCount} item telah selesai (Completed) dan sisanya dalam pengerjaan (Progress) oleh PIC Departemen ${caseData?.department || ''}.`
        });
      }

      const prompt = `Buat ringkasan eksekutif Corrective and Preventive Action (CAPA) PT SHOENARY JAVANESIA INC. untuk kasus #${caseData?.ticketId}:
Item CAPA: ${JSON.stringify(actionPlans)}
Departemen: ${caseData?.department}
Tuliskan 1-2 paragraf evaluasi pelaksanaan tindakan perbaikan dalam Bahasa Indonesia.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      return res.json({ summary: response.text });
    } catch {
      return res.json({
        summary: `Rencana tindakan korektif dan preventif (CAPA) berjalan sesuai target yang ditetapkan.`
      });
    }
  });

  // Endpoint 5: Report Highlights (Weekly / Monthly / Annual)
  app.post('/api/ai/report-narrative', async (req, res) => {
    try {
      const { period, stats, categoryStats, deptStats, rankings } = req.body;
      if (!ai) {
        return res.json({
          narrative: `Selama periode pelaporan (${period || 'Operasional Terkini'}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. mengelola ${stats.total || 0} keluhan formal dengan tingkat kepatuhan penyelesaian SLA sebesar ${stats.complianceRate || 100}%. Prioritas penanganan diarahkan pada penguatan fungsi pengawasan PIC Departemen dan percepatan eksekusi Corrective and Preventive Action (CAPA).`
        });
      }
      const prompt = `Anda adalah Manajer Kepatuhan & HR Corporate di PT SHOENARY JAVANESIA INC. (SJI).
Buat narasi laporan eksekutif formal berdasarkan data aktual berikut:
- Periode: ${period}
- Total Kasus: ${stats.total}
- Kasus Selesai (Closed): ${stats.closed}
- Kasus Investigasi / Tindakan: ${(stats.total || 0) - (stats.closed || 0)}
- Tingkat Kepatuhan SLA: ${stats.complianceRate}%
- Kasus Kritis: ${stats.critical}
- Distribusi Kategori: ${JSON.stringify(categoryStats || [])}
- Distribusi Departemen: ${JSON.stringify(deptStats || [])}
- Ranking Teratas: ${JSON.stringify(rankings || [])}

Tuliskan 2-3 paragraf formal, objektif, tanpa mengarang fakta baru, dengan fokus pada evaluasi kepatuhan operasional dan rekomendasi perbaikan.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      return res.json({ narrative: response.text });
    } catch (err) {
      return res.json({
        narrative: `Selama periode pelaporan (${req.body.period || 'Operasional Terkini'}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. memproses keluhan formal sesuai standar kepatuhan audit operasional.`
      });
    }
  });

  // ============================================================================
  // SJI AI INTELLIGENCE ENDPOINTS (Decision Support System - Read-Only Recommendations)
  // ============================================================================

  // Phase 2: AI Grievance Analysis
  app.post('/api/ai/intelligence/analyze-grievance', async (req, res) => {
    try {
      const { caseData, categories = [], departments = [] } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }
      const safeCase = sanitizeCaseForServerAi(caseData);
      const validCategoryNames = (categories || []).map((c: any) => c.name).filter(Boolean);
      const validDeptNames = (departments || []).map((d: any) => d.name).filter(Boolean);

      const buildFallback = () => {
        const desc = (safeCase.description || '').toLowerCase();
        let recPrio: 'Minor' | 'Major' | 'Critical' = safeCase.currentPriority || 'Major';
        if (desc.includes('pelecehan') || desc.includes('ancam') || desc.includes('kekerasan') || desc.includes('k3') || desc.includes('bahaya') || desc.includes('kecelakaan')) {
          recPrio = 'Critical';
        } else if (desc.includes('lembur') || desc.includes('atasan') || desc.includes('kebijakan') || desc.includes('gaji') || desc.includes('bpjs')) {
          recPrio = 'Major';
        }
        const missing: string[] = [];
        if (!safeCase.incidentDate) missing.push('Tanggal kejadian spesifik belum tercantum.');
        if (!safeCase.location) missing.push('Lokasi detail kejadian belum dilengkapi.');
        if (!safeCase.involvedParties) missing.push('Keterangan saksi atau fungsi terkait untuk klarifikasi belum tersedia.');
        if ((safeCase.description || '').length < 60) missing.push('Kronologi kejadian masih sangat singkat sehingga perlu wawancara klarifikasi.');

        return {
          result: {
            recommendedCategory: safeCase.complaintCategory || validCategoryNames[0] || 'Kebijakan',
            recommendedPriority: recPrio,
            priorityRationale: `Rekomendasi prioritas ${recPrio} didasarkan pada kata kunci uraian keluhan dan kategori ${safeCase.complaintCategory} (memerlukan konfirmasi HR).`,
            relatedDepartment: safeCase.department || validDeptNames[0] || 'HR',
            issueIndications: [
              `Indikasi isu pada kategori ${safeCase.complaintCategory} di departemen ${safeCase.department}.`,
              'Perlu verifikasi kronologi dan bukti pendukung sebelum penetapan tindak lanjut.',
            ],
            professionalSummary: `Keluhan #${safeCase.ticketId} diterima melalui saluran ${safeCase.channelReceived} terkait ${safeCase.complaintCategory} di departemen ${safeCase.department}. Uraian awal mengindikasikan perlunya penelaahan prosedur dan klarifikasi faktual oleh HR.`,
            missingInvestigationInfo: missing.length > 0 ? missing : ['Bukti dokumenter pendukung dan berita acara klarifikasi awal.'],
            dataLimitations: 'Analisis hanya membaca metadata dan deskripsi awal keluhan tanpa mengakses identitas pribadi pelapor maupun berkas lampiran biner.',
          },
          modelUsed: 'sji-rules-intelligence-engine',
        };
      };

      if (!ai) {
        return res.json(buildFallback());
      }

      const prompt = `Anda adalah Sistem Pendukung Keputusan HR (HR Grievance Decision Support System) di PT Shoenary Javanesia Inc. (SJI).
Tugas Anda adalah memberikan REKOMENDASI analisis keluhan (bukan keputusan final — HR wajib mengonfirmasi).
JANGAN menyebut nama pribadi, NIK, atau membuat tuduhan kesalahan terhadap individu.

Data Keluhan Tersamarkan:
${JSON.stringify(safeCase, null, 2)}

Daftar Kategori Resmi SJI: ${JSON.stringify(validCategoryNames)}
Daftar Departemen Resmi SJI: ${JSON.stringify(validDeptNames)}

Aturan Prioritas SJI:
- Minor (3 hari kerja): administratif, fasilitas harian, absensi, cuti, lingkungan ringan.
- Major (7 hari kerja): kebijakan, perilaku atasan, lembur, produksi, benefit.
- Critical (14 hari kerja + triage 72 jam): pelecehan, kekerasan, ancaman, pelanggaran etika berat, bahaya keselamatan K3/keamanan.

Kembalikan JSON valid persis dengan struktur berikut:
{
  "recommendedCategory": "pilih dari Daftar Kategori Resmi SJI jika sesuai",
  "recommendedPriority": "Minor" | "Major" | "Critical",
  "priorityRationale": "alasan objektif rekomendasi prioritas",
  "relatedDepartment": "departemen terkait dari daftar",
  "issueIndications": ["indikasi permasalahan 1", "indikasi 2"],
  "professionalSummary": "ringkasan keluhan netral dan profesional dalam Bahasa Indonesia",
  "missingInvestigationInfo": ["informasi yang masih kurang untuk investigasi HR"],
  "dataLimitations": "penjelasan keterbatasan informasi yang tersedia saat ini"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({ result: parsed, modelUsed: AI_MODEL });
    } catch (err: any) {
      console.warn('AI analyze-grievance fallback:', err?.message);
      const safeCase = sanitizeCaseForServerAi(req.body?.caseData);
      return res.json({
        result: {
          recommendedCategory: safeCase.complaintCategory || 'Kebijakan',
          recommendedPriority: safeCase.currentPriority || 'Major',
          priorityRationale: 'Evaluasi sementara mengikuti klasifikasi awal karena layanan AI sedang tidak terjangkau.',
          relatedDepartment: safeCase.department || 'HR',
          issueIndications: [`Laporan pada departemen ${safeCase.department} memerlukan peninjauan HR.`],
          professionalSummary: `Keluhan #${safeCase.ticketId} (${safeCase.complaintCategory}) membutuhkan klarifikasi investigasi lebih lanjut.`,
          missingInvestigationInfo: ['Berita acara klarifikasi lapangan dan bukti pendukung.'],
          dataLimitations: 'Menggunakan fallback engine lokal; verifikasi manual HR diperlukan.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Phase 3: AI Root Cause Analysis (5 Why + 6M Fishbone)
  app.post('/api/ai/intelligence/root-cause', async (req, res) => {
    try {
      const { caseData, investigations = [] } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }
      const safeCase = sanitizeCaseForServerAi(caseData);
      const safeInv = (investigations || []).map((inv: any) => ({
        investigationDate: inv.investigationDate,
        investigationDetails: scrubPiiText(inv.investigationDetails),
        interviewNotes: scrubPiiText(inv.interviewNotes),
        findings: scrubPiiText(inv.findings),
        conclusion: scrubPiiText(inv.conclusion),
        recommendedActions: scrubPiiText(inv.recommendedActions),
      }));

      const buildFallback = () => {
        const baseRca = generateLocal6MRca(safeCase);
        const hasInv = safeInv.length > 0;
        return {
          result: {
            fiveWhy: {
              symptom: `Keluhan #${safeCase.ticketId} mengenai ${safeCase.complaintCategory} di departemen ${safeCase.department}.`,
              steps: [
                { level: 1, question: 'Mengapa keluhan ini muncul di area kerja?', finding: safeInv[0]?.findings || `Terdapat ketidaksesuaian praktik di lapangan terkait ${safeCase.complaintCategory}.` },
                { level: 2, question: 'Mengapa ketidaksesuaian tersebut dapat terjadi?', finding: baseRca.contributingFactors },
                { level: 3, question: 'Mengapa pengawasan atau koordinasi tidak mencegahnya?', finding: 'Mekanisme pengecekan rutin dan verifikasi dokumen di lini operasional belum konsisten.' },
                { level: 4, question: 'Mengapa mekanisme pengecekan belum berjalan konsisten?', finding: 'Belum tersedia standar evaluasi berkala yang seragam antar penanggung jawab area.' },
                { level: 5, question: 'Apa akar masalah sistemik yang perlu diperbaiki?', finding: baseRca.rootCause },
              ],
              rootCauseConclusion: baseRca.rootCause,
              symptomsVsRootCauseNote: 'Gejala adalah keluhan yang dirasakan karyawan; akar masalah terletak pada kesenjangan prosedur, sosialisasi, atau sistem kontrol operasional.',
            },
            fishbone6M: [
              { category: 'Man', isRelevant: baseRca.category === 'Man' || hasInv, possibleCauses: ['Pemahaman standar komunikasi atau SOP di level pelaksana belum seragam.'], evidenceBasis: 'Berdasarkan kategori keluhan dan catatan interaksi.' },
              { category: 'Method', isRelevant: true, possibleCauses: [baseRca.rootCause], evidenceBasis: 'Berdasarkan uraian proses kerja pada deskripsi keluhan.' },
              { category: 'Machine', isRelevant: baseRca.category === 'Machine', possibleCauses: baseRca.category === 'Machine' ? ['Keterlambatan pemeliharaan atau kondisi sarana fasilitas.'] : [], evidenceBasis: baseRca.category === 'Machine' ? 'Terkait fasilitas/peralatan.' : 'Tidak ada bukti keterlibatan mesin pada data saat ini.' },
              { category: 'Material', isRelevant: false, possibleCauses: [], evidenceBasis: 'Tidak ditemukan indikasi kendala bahan baku/formulir pada data tersedia.' },
              { category: 'Measurement', isRelevant: true, possibleCauses: ['Monitoring kepatuhan prosedur dan audit berkala belum terdokumentasi rutin.'], evidenceBasis: 'Evaluasi kepatuhan proses internal.' },
              { category: 'Environment', isRelevant: safeCase.complaintCategory?.toLowerCase().includes('lingkungan') || safeCase.complaintCategory?.toLowerCase().includes('keamanan'), possibleCauses: safeCase.complaintCategory?.toLowerCase().includes('lingkungan') ? ['Kondisi lingkungan kerja memerlukan peninjauan ergonomi/kenyamanan.'] : [], evidenceBasis: 'Berdasarkan klasifikasi kategori keluhan.' },
            ],
            recommendedPrimaryCategory: baseRca.category,
            contributingFactors: baseRca.contributingFactors,
            impact: baseRca.impact,
            correctiveRecommendations: baseRca.correctiveRecommendations,
            dataLimitations: hasInv
              ? 'Analisis disusun dari deskripsi kasus dan catatan investigasi yang tersedia tanpa menyertakan identitas personal.'
              : 'Belum terdapat catatan investigasi lapangan; 5 Why dan 6M bersifat hipotesis awal dan wajib diverifikasi HR.',
          },
          modelUsed: 'sji-rules-intelligence-engine',
        };
      };

      if (!ai) {
        return res.json(buildFallback());
      }

      const prompt = `Anda adalah Spesialis Root Cause Analysis HR di PT Shoenary Javanesia Inc. (SJI).
Susun analisis akar masalah berbasis fakta investigasi dengan DUA metode:
A. 5 Why Analysis (pisahkan gejala vs akar masalah, bertahap 1..5 berdasarkan data aktual).
B. Fishbone Analysis – 6M (Man, Method, Machine, Material, Measurement, Environment).
PENTING: Jangan memaksakan semua kategori 6M — tandai "isRelevant": false dengan possibleCauses: [] jika tidak didukung fakta kasus/investigasi.

Data Kasus:
${JSON.stringify(safeCase, null, 2)}

Fakta Investigasi (${safeInv.length} catatan):
${JSON.stringify(safeInv, null, 2)}

Kembalikan JSON valid persis dengan struktur:
{
  "fiveWhy": {
    "symptom": "gejala awal yang dilaporkan",
    "steps": [
      { "level": 1, "question": "...", "finding": "..." },
      { "level": 2, "question": "...", "finding": "..." },
      { "level": 3, "question": "...", "finding": "..." },
      { "level": 4, "question": "...", "finding": "..." },
      { "level": 5, "question": "...", "finding": "..." }
    ],
    "rootCauseConclusion": "kesimpulan akar masalah utama",
    "symptomsVsRootCauseNote": "penjelasan perbedaan gejala dan akar masalah pada kasus ini"
  },
  "fishbone6M": [
    { "category": "Man", "isRelevant": true, "possibleCauses": ["..."], "evidenceBasis": "..." },
    { "category": "Method", "isRelevant": true, "possibleCauses": ["..."], "evidenceBasis": "..." },
    { "category": "Machine", "isRelevant": false, "possibleCauses": [], "evidenceBasis": "Tidak didukung bukti" },
    { "category": "Material", "isRelevant": false, "possibleCauses": [], "evidenceBasis": "Tidak didukung bukti" },
    { "category": "Measurement", "isRelevant": true, "possibleCauses": ["..."], "evidenceBasis": "..." },
    { "category": "Environment", "isRelevant": false, "possibleCauses": [], "evidenceBasis": "Tidak didukung bukti" }
  ],
  "recommendedPrimaryCategory": "Man" | "Method" | "Machine" | "Material" | "Measurement" | "Environment",
  "contributingFactors": "faktor pendukung gabungan",
  "impact": "dampak operasional dan hubungan industrial",
  "correctiveRecommendations": "rekomendasi perbaikan sistemik",
  "dataLimitations": "catatan keterbatasan data investigasi saat ini"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({ result: parsed, modelUsed: AI_MODEL });
    } catch (err: any) {
      console.warn('AI root-cause fallback:', err?.message);
      const safeCase = sanitizeCaseForServerAi(req.body?.caseData);
      const baseRca = generateLocal6MRca(safeCase);
      return res.json({
        result: {
          fiveWhy: {
            symptom: `Keluhan #${safeCase.ticketId} (${safeCase.complaintCategory})`,
            steps: [
              { level: 1, question: 'Mengapa keluhan terjadi?', finding: baseRca.contributingFactors },
              { level: 2, question: 'Mengapa kondisi tersebut berlangsung?', finding: baseRca.rootCause },
            ],
            rootCauseConclusion: baseRca.rootCause,
            symptomsVsRootCauseNote: 'Perlu validasi investigasi lanjutan untuk memastikan akar masalah sistemik.',
          },
          fishbone6M: [
            { category: baseRca.category, isRelevant: true, possibleCauses: [baseRca.rootCause], evidenceBasis: 'Berdasarkan kategori keluhan.' },
          ],
          recommendedPrimaryCategory: baseRca.category,
          contributingFactors: baseRca.contributingFactors,
          impact: baseRca.impact,
          correctiveRecommendations: baseRca.correctiveRecommendations,
          dataLimitations: 'Fallback rule-based digunakan; verifikasi investigasi HR diperlukan.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Phase 4: Repeat Grievance Detection
  app.post('/api/ai/intelligence/repeat-detection', async (req, res) => {
    try {
      const { cases = [], periodLabel = 'Seluruh Periode' } = req.body;
      const safeCases = (cases || []).map(sanitizeCaseForServerAi);

      // Compute deterministic grouping by category + department first
      const groupMap: Record<string, any[]> = {};
      safeCases.forEach((c: any) => {
        const key = `${c.complaintCategory}|||${c.department}`;
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(c);
      });

      const repeatClustersRaw = Object.entries(groupMap)
        .filter(([, list]) => list.length >= 2)
        .map(([key, list]) => {
          const [category, dept] = key.split('|||');
          const dates = list.map((x) => x.dateReceived).filter(Boolean).sort();
          const closedList = list.filter((x) => x.status === 'Closed');
          return {
            patternTitle: `Pola Berulang: ${category} (${dept})`,
            complaintCategory: category,
            departments: [dept],
            similarCaseCount: list.length,
            similarTicketIds: list.map((x) => x.ticketId),
            occurrencePeriod: dates.length > 0 ? `${dates[0]} s/d ${dates[dates.length - 1]}` : periodLabel,
            previousActionsSummary: closedList.length > 0
              ? `${closedList.length} dari ${list.length} kasus berstatus Closed (${closedList.map((x) => x.resolutionSummary || 'Selesai').slice(0, 2).join('; ')}).`
              : 'Belum ada riwayat penutupan kasus sebelumnya pada kelompok ini.',
            potentialEffectivenessGap: closedList.length > 0
              ? 'Kemunculan kasus serupa setelah penutupan mengindikasikan tindakan korektif/preventif sebelumnya berpotensi belum sepenuhnya efektif.'
              : 'Seluruh kasus dalam klaster masih aktif; diperlukan evaluasi efektivitas solusi setelah implementasi CAPA.',
            neutralObservationNote: 'Temuan ini merupakan pola data historis sebagai dasar evaluasi sistem/proses, bukan bukti kesalahan individu maupun departemen.',
          };
        })
        .sort((a, b) => b.similarCaseCount - a.similarCaseCount);

      if (!ai || safeCases.length === 0) {
        return res.json({
          result: {
            totalAnalyzedCases: safeCases.length,
            repeatClusterCount: repeatClustersRaw.length,
            clusters: repeatClustersRaw,
            overallPatternSummary: repeatClustersRaw.length > 0
              ? `Teridentifikasi ${repeatClustersRaw.length} klaster keluhan berulang dari ${safeCases.length} kasus pada ${periodLabel}. Evaluasi diarahkan pada efektivitas perbaikan proses.`
              : `Tidak ditemukan pengulangan keluhan signifikan (≥ 2 kasus serupa) pada ${safeCases.length} kasus yang dianalisis.`,
            dataLimitations: 'Deteksi kemiripan menggunakan pengelompokan kategori, departemen, dan riwayat status aktual yang tersedia.',
          },
          modelUsed: 'sji-rules-intelligence-engine',
        });
      }

      const prompt = `Anda adalah Analis Pola Hubungan Industrial PT Shoenary Javanesia Inc. (SJI).
Analisis data keluhan berikut untuk mengidentifikasi KELUHAN BERULANG berdasarkan kategori, departemen, kemiripan isi keluhan, periode kemunculan, dan riwayat penyelesaian sebelumnya.
ATURAN KETAT:
- JANGAN menganggap keluhan berulang sebagai bukti kesalahan individu atau departemen.
- Gunakan angka dan Ticket ID aktual yang ada pada data di bawah ini (jangan mengarang Ticket ID).

Periode Analisis: ${periodLabel}
Total Kasus: ${safeCases.length}
Klaster Awal Terdeteksi Sistem:
${JSON.stringify(repeatClustersRaw, null, 2)}

Sampel Uraian Kasus Tersamarkan (maks 30 terbaru):
${JSON.stringify(safeCases.slice(0, 30), null, 2)}

Kembalikan JSON valid:
{
  "totalAnalyzedCases": ${safeCases.length},
  "repeatClusterCount": number,
  "clusters": [
    {
      "patternTitle": "judul pola masalah yang netral",
      "complaintCategory": "kategori",
      "departments": ["dept"],
      "similarCaseCount": number,
      "similarTicketIds": ["ticketId aktual"],
      "occurrencePeriod": "rentang tanggal",
      "previousActionsSummary": "ringkasan riwayat penyelesaian",
      "potentialEffectivenessGap": "penilaian apakah tindakan sebelumnya berpotensi belum efektif",
      "neutralObservationNote": "catatan netral bahwa pola ini bukan tuduhan kesalahan individu/departemen"
    }
  ],
  "overallPatternSummary": "ringkasan pola berulang secara objektif",
  "dataLimitations": "keterbatasan data perbandingan historis"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const parsed = parseCleanJson(response.text);
      parsed.totalAnalyzedCases = safeCases.length;
      return res.json({ result: parsed, modelUsed: AI_MODEL });
    } catch (err: any) {
      console.warn('AI repeat-detection fallback:', err?.message);
      const safeCases = (req.body?.cases || []).map(sanitizeCaseForServerAi);
      return res.json({
        result: {
          totalAnalyzedCases: safeCases.length,
          repeatClusterCount: 0,
          clusters: [],
          overallPatternSummary: 'Analisis pola berulang sementara menggunakan kalkulasi dasar; silakan ulangi pemindaian.',
          dataLimitations: 'Fallback mode aktif.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Phase 5: AI Risk Detection (Early Warning)
  app.post('/api/ai/intelligence/risk-assessment', async (req, res) => {
    try {
      const { cases = [] } = req.body;
      const safeCases = (cases || []).filter((c: any) => c.status !== 'Closed').map(sanitizeCaseForServerAi);

      const categoryCounts: Record<string, number> = {};
      safeCases.forEach((c: any) => {
        categoryCounts[c.complaintCategory] = (categoryCounts[c.complaintCategory] || 0) + 1;
      });

      const deterministicItems = safeCases.map((c: any) => {
        const text = `${c.complaintCategory} ${c.description}`.toLowerCase();
        const indicators: string[] = [];
        let level: 'Critical Attention' | 'High Attention' | 'Normal Monitoring' = 'Normal Monitoring';
        let requiresHuman = false;

        const isSensitive =
          text.includes('pelecehan') ||
          text.includes('kekerasan') ||
          text.includes('ancam') ||
          text.includes('intimidasi') ||
          text.includes('bullying') ||
          text.includes('seksual') ||
          c.currentPriority === 'Critical';

        if (isSensitive) {
          indicators.push('Keluhan sensitif / indikasi pelecehan, keselamatan, atau prioritas Critical');
          level = 'Critical Attention';
          requiresHuman = true;
        }
        if (c.slaStatus === 'Breached' || c.slaStatus === 'Overdue') {
          indicators.push('Melewati target SLA (risiko eskalasi penanganan)');
          if (level !== 'Critical Attention') level = 'High Attention';
        }
        if (text.includes('atasan') || text.includes('komunikasi') || text.includes('supervisor') || text.includes('diskriminasi')) {
          indicators.push('Indikasi ketegangan komunikasi atasan-bawahan atau potensi pelanggaran kebijakan');
          if (level === 'Normal Monitoring') level = 'High Attention';
        }
        if ((categoryCounts[c.complaintCategory] || 0) >= 2) {
          indicators.push(`Kategori berulang (${categoryCounts[c.complaintCategory]} kasus aktif serupa)`);
          if (level === 'Normal Monitoring') level = 'High Attention';
        }
        if (text.includes('lingkungan') || text.includes('k3') || text.includes('keamanan') || text.includes('apd')) {
          indicators.push('Isu lingkungan kerja atau keselamatan K3');
        }
        if (indicators.length === 0) {
          indicators.push('Pemantauan rutin sesuai alur SLA standar');
        }

        return {
          ticketId: c.ticketId,
          caseId: c.id,
          department: c.department,
          complaintCategory: c.complaintCategory,
          attentionLevel: level,
          riskIndicators: indicators,
          escalationPotential: level === 'Critical Attention'
            ? 'Tinggi — Memerlukan peninjauan segera oleh HR Lead / Investigator berwenang.'
            : level === 'High Attention'
            ? 'Sedang-Tinggi — Perlu pemantauan progres PIC dan mediasi aktif.'
            : 'Normal — Ditangani dalam alur reguler.',
          humanReviewReason: requiresHuman
            ? 'Kasus sensitif wajib ditinjau langsung oleh manusia (HR berwenang); AI tidak menilai pelanggaran maupun kesalahan pihak.'
            : 'Peninjauan berkala oleh PIC dan HR Investigator.',
          requiresPriorityHumanReview: requiresHuman,
        };
      });

      const orderMap: Record<string, number> = { 'Critical Attention': 3, 'High Attention': 2, 'Normal Monitoring': 1 };
      deterministicItems.sort((a: any, b: any) => orderMap[b.attentionLevel] - orderMap[a.attentionLevel]);

      const critCount = deterministicItems.filter((i: any) => i.attentionLevel === 'Critical Attention').length;
      const highCount = deterministicItems.filter((i: any) => i.attentionLevel === 'High Attention').length;
      const normCount = deterministicItems.filter((i: any) => i.attentionLevel === 'Normal Monitoring').length;

      const disclaimer = 'PEMBERITAHUAN TATA KELOLA: AI hanya memberikan sinyal perhatian dini (Early Warning). AI tidak menetapkan kesimpulan pelanggaran atau menentukan pihak yang bersalah. Seluruh kasus sensitif wajib ditinjau langsung oleh HR yang berwenang.';

      const buildRiskFallback = () => ({
        result: {
          criticalAttentionCount: critCount,
          highAttentionCount: highCount,
          normalMonitoringCount: normCount,
          riskItems: deterministicItems.slice(0, 20),
          earlyWarningSummary: `Teridentifikasi ${critCount} kasus Critical Attention dan ${highCount} kasus High Attention dari ${safeCases.length} kasus aktif.`,
          governanceDisclaimer: disclaimer,
          dataLimitations: 'Penilaian risiko didasarkan pada data kasus aktif yang belum ditutup tanpa membuka identitas pelapor anonim.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });

      if (!ai || safeCases.length === 0) {
        return res.json(buildRiskFallback());
      }

      const prompt = `Anda adalah Sistem Early Warning Risiko Hubungan Industrial PT Shoenary Javanesia Inc. (SJI).
Berdasarkan kasus aktif berikut, berikan ringkasan early warning dan validasi tingkat perhatian:
- Critical Attention (kasus sensitif, pelecehan/kekerasan, keselamatan berat, eskalasi kritis)
- High Attention (keluhan berulang, komunikasi atasan-bawahan, lingkungan kerja signifikan, potensi pelanggaran kebijakan, mendekati/lewat SLA)
- Normal Monitoring (penanganan reguler)

ATURAN MUTLAK:
- AI TIDAK BOLEH menetapkan kesimpulan pelanggaran atau menyebut siapa yang bersalah.
- Gunakan angka dan Ticket ID aktual di bawah ini.

Hasil Evaluasi Awal Sistem:
Critical Attention: ${critCount}, High Attention: ${highCount}, Normal Monitoring: ${normCount}
Daftar Kasus Aktif (maks 20 teratas):
${JSON.stringify(deterministicItems.slice(0, 20), null, 2)}

Kembalikan JSON valid:
{
  "criticalAttentionCount": ${critCount},
  "highAttentionCount": ${highCount},
  "normalMonitoringCount": ${normCount},
  "riskItems": [pertahankan struktur tiap item dari input dan pertajam riskIndicators serta escalationPotential secara netral],
  "earlyWarningSummary": "ringkasan eksekutif early warning untuk HR dalam Bahasa Indonesia",
  "governanceDisclaimer": "${disclaimer}",
  "dataLimitations": "penjelasan batas data penilaian risiko"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const parsed = parseCleanJson(response.text);
      parsed.criticalAttentionCount = critCount;
      parsed.highAttentionCount = highCount;
      parsed.normalMonitoringCount = normCount;
      parsed.governanceDisclaimer = disclaimer;
      return res.json({ result: parsed, modelUsed: AI_MODEL });
    } catch (err: any) {
      console.warn('AI risk-assessment fallback:', err?.message);
      const casesList = Array.isArray(req.body?.cases) ? req.body.cases : [];
      const activeList = casesList.filter((c: any) => c.status !== 'Closed').map(sanitizeCaseForServerAi);
      const disclaimer = 'PEMBERITAHUAN TATA KELOLA: AI hanya memberikan sinyal perhatian dini (Early Warning). AI tidak menetapkan kesimpulan pelanggaran atau menentukan pihak yang bersalah. Seluruh kasus sensitif wajib ditinjau langsung oleh HR yang berwenang.';
      return res.json({
        result: {
          criticalAttentionCount: activeList.filter((c: any) => c.currentPriority === 'Critical').length,
          highAttentionCount: activeList.filter((c: any) => c.slaStatus === 'Overdue' || c.slaStatus === 'Breached').length,
          normalMonitoringCount: Math.max(0, activeList.length),
          riskItems: [],
          earlyWarningSummary: 'Mode evaluasi risiko lokal digunakan sementara karena layanan AI tidak terjangkau.',
          governanceDisclaimer: disclaimer,
          dataLimitations: 'Menggunakan fallback engine lokal.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Phase 6: AI Recommended Action Plan (CAPA Draft)
  app.post('/api/ai/intelligence/recommend-capa', async (req, res) => {
    try {
      const { caseData, rootCauseAnalysis, investigations = [] } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }
      const safeCase = sanitizeCaseForServerAi(caseData);
      const suggestedDate = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);

      const buildFallback = () => ({
        result: {
          drafts: [
            {
              correctiveAction: `Lakukan penyelesaian korektif langsung terhadap isu ${safeCase.complaintCategory} pada kasus #${safeCase.ticketId} di departemen ${safeCase.department}.`,
              preventiveAction: `Lakukan sosialisasi ulang SOP terkait ${safeCase.complaintCategory} dan pemeriksaan kepatuhan mingguan di area ${safeCase.department}.`,
              recommendedPic: caseData.assignedPic || `PIC Departemen ${safeCase.department}`,
              recommendedDepartment: safeCase.department,
              targetFollowUpDays: 7,
              suggestedTargetDate: suggestedDate,
              expectedOutcome: 'Masalah inti tertangani tuntas dan potensi keluhan serupa di departemen terkait dapat dicegah.',
              monitoringRecommendation: 'Evaluasi kepatuhan implementasi dilakukan oleh HR & PIC setelah 14 hari kalender melalui checklist verifikasi.',
            },
          ],
          policyAlignmentNote: 'Draft CAPA disusun sebagai usulan awal sesuai kewenangan operasional perusahaan dan wajib disetujui HR sebelum masuk ke Action Plan resmi.',
          dataLimitations: rootCauseAnalysis
            ? 'Disusun berdasarkan data kasus dan analisis akar masalah.'
            : 'Disusun dari data kasus awal tanpa input RCA lengkap; penyesuaian target dan PIC oleh HR diperlukan.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });

      if (!ai) {
        return res.json(buildFallback());
      }

      const prompt = `Anda adalah Konsultan CAPA (Corrective and Preventive Action) HR di PT Shoenary Javanesia Inc. (SJI).
Susun 1–3 DRAFT rekomendasi Action Plan yang realistis, terukur, dan sesuai kewenangan perusahaan (bukan tindakan yang melampaui hukum atau kewenangan HR).
Draft ini BARU boleh masuk Action Plan resmi setelah HR menekan tombol Approve.

Data Kasus:
${JSON.stringify(safeCase, null, 2)}

Analisis Root Cause (jika ada):
${JSON.stringify(rootCauseAnalysis || 'Belum tersedia', null, 2)}

Catatan Investigasi:
${JSON.stringify((investigations || []).map((i: any) => ({ findings: scrubPiiText(i.findings), recommendedActions: scrubPiiText(i.recommendedActions) })), null, 2)}

Kembalikan JSON valid:
{
  "drafts": [
    {
      "correctiveAction": "tindakan korektif konkret",
      "preventiveAction": "tindakan pencegahan sistemik",
      "recommendedPic": "${caseData.assignedPic || 'PIC Departemen ' + safeCase.department}",
      "recommendedDepartment": "${safeCase.department}",
      "targetFollowUpDays": 7,
      "suggestedTargetDate": "${suggestedDate}",
      "expectedOutcome": "hasil terukur yang diharapkan",
      "monitoringRecommendation": "cara dan jadwal monitoring verifikasi efektivitas"
    }
  ],
  "policyAlignmentNote": "catatan kesesuaian dengan kebijakan dan kewenangan perusahaan",
  "dataLimitations": "keterbatasan informasi yang mendasari draft CAPA"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.25 },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({ result: parsed, modelUsed: AI_MODEL });
    } catch (err: any) {
      console.warn('AI recommend-capa fallback:', err?.message);
      const safeCase = sanitizeCaseForServerAi(req.body?.caseData);
      const suggestedDate = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
      return res.json({
        result: {
          drafts: [
            {
              correctiveAction: `Tindak lanjuti penyelesaian keluhan #${safeCase.ticketId} (${safeCase.complaintCategory}).`,
              preventiveAction: `Audit prosedur kerja dan briefing rutin di departemen ${safeCase.department}.`,
              recommendedPic: req.body?.caseData?.assignedPic || `PIC ${safeCase.department}`,
              recommendedDepartment: safeCase.department,
              targetFollowUpDays: 7,
              suggestedTargetDate: suggestedDate,
              expectedOutcome: 'Terwujudnya penyelesaian kasus dan perbaikan alur kerja.',
              monitoringRecommendation: 'Tinjau ulang progres CAPA setiap 7 hari hingga tuntas.',
            },
          ],
          policyAlignmentNote: 'Draft memerlukan persetujuan HR.',
          dataLimitations: 'Fallback rules engine digunakan.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Phase 7: AI Management Insights (Strictly grounded in pre-computed actual metrics)
  app.post('/api/ai/intelligence/management-insights', async (req, res) => {
    try {
      const { insightType = 'monthly', actualMetrics } = req.body;
      if (!actualMetrics) {
        return res.status(400).json({ error: 'actualMetrics is required' });
      }

      const buildFallback = () => ({
        result: {
          insightType,
          actualMetrics,
          executiveNarrative: `Pada laporan ${insightType} (${actualMetrics.periodLabel}), tercatat ${actualMetrics.totalGrievance} keluhan dengan tingkat kepatuhan SLA sebesar ${actualMetrics.slaComplianceRate}% (${actualMetrics.onTimeCount} On Time, ${actualMetrics.overdueCount} Overdue, ${actualMetrics.pendingCount} Pending). Kategori dominan adalah ${actualMetrics.dominantCategory?.name} (${actualMetrics.dominantCategory?.count} kasus) dan departemen dengan volume tertinggi adalah ${actualMetrics.highestDepartment?.name} (${actualMetrics.highestDepartment?.count} kasus).`,
          keyFindings: [
            `Total kasus terdaftar: ${actualMetrics.totalGrievance}, dengan ${actualMetrics.unresolvedCases} kasus masih aktif (${actualMetrics.criticalActiveCount} prioritas Critical).`,
            `Terdapat ${actualMetrics.repeatGrievanceCount} indikasi kasus dalam klaster berulang yang memerlukan perhatian preventif.`,
            `Kepatuhan SLA aktual mencapai ${actualMetrics.slaComplianceRate}% (On Time: ${actualMetrics.onTimeCount}, Overdue: ${actualMetrics.overdueCount}).`,
          ],
          rootCauseTrendSummary: actualMetrics.rootCauseTrends?.length > 0
            ? `Tren akar masalah didominasi oleh aspek ${actualMetrics.rootCauseTrends.map((t: any) => `${t.category} (${t.count})`).join(', ')}.`
            : 'Belum tersedia data tren 6M Root Cause yang tersimpan pada periode ini.',
          recommendedManagementActions: [
            `Prioritaskan penyelesaian ${actualMetrics.overdueCount} kasus overdue dan ${actualMetrics.criticalActiveCount} kasus critical aktif bersama PIC terkait.`,
            `Evaluasi sistem kerja dan sosialisasi SOP pada kategori dominan (${actualMetrics.dominantCategory?.name}) di departemen ${actualMetrics.highestDepartment?.name}.`,
            'Pastikan setiap CAPA yang disetujui HR dimonitor hingga status Completed dan diverifikasi efektivitasnya.',
          ],
          dataLimitations: 'Seluruh angka statistik berasal langsung dari perhitungan database Firestore; narasi bersifat pendukung keputusan manajemen.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });

      if (!ai) {
        return res.json(buildFallback());
      }

      const prompt = `Anda adalah HR Management Decision Support Analyst di PT Shoenary Javanesia Inc. (SJI).
Susun ringkasan analisis manajemen tipe "${insightType}" menggunakan HANYA angka aktual di bawah ini.
DILARANG mengarang, mengubah, atau mengestimasi angka baru di luar actualMetrics.

Data Metrik Aktual dari Database & SLA Engine SJI:
${JSON.stringify(actualMetrics, null, 2)}

Kembalikan JSON valid:
{
  "executiveNarrative": "2 paragraf ringkasan eksekutif berbasis data aktual dalam Bahasa Indonesia formal",
  "keyFindings": ["temuan kunci 1 dengan angka persis", "temuan 2", "temuan 3"],
  "rootCauseTrendSummary": "ringkasan tren akar masalah berdasarkan actualMetrics.rootCauseTrends",
  "recommendedManagementActions": ["rekomendasi strategis 1 untuk manajemen HR", "rekomendasi 2", "rekomendasi 3"],
  "dataLimitations": "catatan transparansi sumber data dan batas analisis"
}`;

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({
        result: {
          insightType,
          actualMetrics,
          ...parsed,
        },
        modelUsed: AI_MODEL,
      });
    } catch (err: any) {
      console.warn('AI management-insights fallback:', err?.message);
      const { insightType = 'monthly', actualMetrics } = req.body;
      return res.json({
        result: {
          insightType,
          actualMetrics,
          executiveNarrative: `Ringkasan ${insightType} (${actualMetrics?.periodLabel || '-'}) mencatat ${actualMetrics?.totalGrievance || 0} keluhan dengan SLA Compliance ${actualMetrics?.slaComplianceRate || 0}%.`,
          keyFindings: [`Total keluhan: ${actualMetrics?.totalGrievance || 0}`, `Unresolved: ${actualMetrics?.unresolvedCases || 0}`],
          rootCauseTrendSummary: 'Mengacu pada data 6M RCA tercatat.',
          recommendedManagementActions: ['Review kasus prioritas tinggi dan percepat verifikasi CAPA.'],
          dataLimitations: 'Fallback rules engine aktif.',
        },
        modelUsed: 'sji-rules-intelligence-engine',
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`PT Shoenary Javanesia Inc. server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
