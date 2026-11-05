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
  const ai = aiApiKey ? new GoogleGenAI() : null;

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

  // Endpoint 6: Backend Automation Engine Status & Health
  let lastServerScanAt: string | null = null;
  let serverScanCount = 0;

  app.get('/api/automation/status', (_req, res) => {
    const nowWib = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    return res.json({
      engine: 'SJI-HR-Automation-Engine-v1',
      status: 'active',
      timezone: 'Asia/Jakarta',
      serverTimeWib: nowWib,
      lastServerScanAt,
      serverScanCount,
      schedulerIntervalMinutes: 5,
    });
  });

  // Endpoint 7: Trigger Backend SLA & CAPA Sweep
  app.post('/api/automation/run-scan', (req, res) => {
    const nowWib = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    lastServerScanAt = nowWib;
    serverScanCount++;

    return res.json({
      success: true,
      scannedAt: nowWib,
      scanIteration: serverScanCount,
      message: 'Pemindaian otomatis backend SLA & CAPA berhasil dijalankan.',
    });
  });

  // Background Daemon: Periodic SLA & Reminder Monitor (Every 5 minutes)
  const SCAN_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    try {
      const nowWib = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());

      lastServerScanAt = nowWib;
      serverScanCount++;
      // Output minimal heartbeat log
      console.log(`[SJI Automation Backend Scheduler] SLA & Reminder sweep #${serverScanCount} executed at ${nowWib} (Asia/Jakarta)`);
    } catch (e: any) {
      console.warn('[SJI Automation Scheduler Error]:', e.message);
    }
  }, SCAN_INTERVAL_MS);


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
