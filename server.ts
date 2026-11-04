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
- **Fasilitas / Lokasi Kejadian**: ${caseData.location || 'Area Kerja PT Shoenary Javanesia Inc.'}
- **Pihak yang Terkait**: ${caseData.involvedParties || 'Sedang dalam pendalaman investigasi'}

### Rekomendasi Investigasi HR & Langkah Awal
1. **Verifikasi Bukti Dokumen & Log**: Periksa bukti pendukung (foto/dokumen/PDF) yang relevan dengan kasus.
2. **Klarifikasi Terpisah**: Lakukan pemanggilan klarifikasi formal terhadap pihak terlapor dan saksi-saksi secara tertutup tanpa memperlihatkan identitas pelapor (jika anonim).
3. **Pengisian Lembar 5W**: Lakukan identifikasi akar masalah melalui lembar 5 Whys untuk menemukan akar sistemik di level operasional maupun manajerial.
4. **Penyusunan Rencana CAPA**: Rumuskan rencana tindakan korektif dan preventif bersama PIC Departemen ${caseData.department}.`;
}

function generateLocal5Whys(caseData: any) {
  const cat = caseData.complaintCategory || 'Kebijakan';
  let primaryCategory: any = 'Management & Leadership';
  let why1 = `Karyawan mengalami kendala atau ketidakpuasan terkait ${cat}.`;
  let why2 = `Komunikasi dan sosialisasi standar kerja di departemen ${caseData.department || 'terkait'} belum berjalan optimal.`;
  let why3 = `Kurangnya pengawasan berkala dan mekanisme umpan balik dua arah antara atasan dan bawahan.`;
  let why4 = `Belum ada checklist evaluasi berkala untuk mencegah friksi atau ketidaksesuaian prosedur operasional.`;
  let why5 = `Sistem manajemen kepatuhan operasional belum mengintegrasikan deteksi dini isu kepuasan kerja dan kepemimpinan.`;

  if (cat.includes('Lembur') || cat.includes('Payroll') || cat.includes('Absensi')) {
    primaryCategory = 'Process';
    why1 = 'Terdapat ketidaksesuaian dalam perhitungan jam kerja atau kompensasi lembur.';
    why2 = 'Pencatatan data absensi dan form lembur terlambat diinput atau belum diverifikasi supervisor.';
    why3 = 'Proses validasi manual antar bagian sering mengalami selisih data.';
    why4 = 'Belum diterapkannya sistem rekonsiliasi data kehadiran otomatis harian.';
    why5 = 'Standard Operating Procedure (SOP) pengajuan dan verifikasi lembur belum terintegrasi menyeluruh.';
  } else if (cat.includes('Pelecehan') || cat.includes('Lingkungan Kerja')) {
    primaryCategory = 'Work Environment';
    why1 = 'Terjadi ketidaknyamanan relasi antarpribadi di lingkungan kerja harian.';
    why2 = 'Adanya perilaku atau ucapan yang melanggar kode etik kesopanan tempat kerja.';
    why3 = 'Kurangnya pemahaman mengenai batasan profesional dan sanksi terhadap pelecehan/bullying.';
    why4 = 'Supervisi di lini produksi belum mengedepankan budaya kerja saling menghargai.';
    why5 = 'Sosialisasi berkala dan penegakan pakta integritas anti-pelecehan belum intensif dilakukan.';
  }

  return {
    primaryCategory,
    why1,
    why2,
    why3,
    why4,
    why5,
    systemicFactors: `Keterbatasan sosialisasi prosedur, pengawasan berkala lini kerja, dan kebutuhan penguatan fungsi pengawasan PIC Departemen ${caseData.department || 'terkait'}.`,
    preventiveRecommendations: `1. Refreshment pelatihan etika kerja dan kepemimpinan untuk seluruh supervisor.\n2. Standardisasi waktu verifikasi harian.\n3. Monitoring berkala oleh HR & PIC secara konsisten.`,
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '25mb' }));

  const aiApiKey = process.env.GEMINI_API_KEY;
  const ai = aiApiKey ? new GoogleGenAI() : null;

  // Endpoint 1: Generate Case Summary & Investigation Notes
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

      const prompt = `Anda adalah Spesialis Hubungan Karyawan & Investigasi Etika HR di PT SHOENARY JAVANESIA INC. (SJI).
Buat analisis komprehensif, ringkasan eksekutif, dan catatan investigasi profesional untuk keluhan karyawan berikut:
- Ticket ID: ${caseData.ticketId}
- Tanggal Masuk: ${caseData.dateReceived}
- Pelapor: ${caseData.isAnonymous ? 'Anonim (Whistleblower terlindungi)' : caseData.employeeName}
- Departemen Terkait: ${caseData.department}
- Kategori Keluhan: ${caseData.complaintCategory}
- Prioritas SLA: ${caseData.priority} (Minor: 3 Hari, Major: 7 Hari, Critical: 14 Hari)
- Saluran Masuk: ${caseData.channelReceived}
- Deskripsi Keluhan: ${caseData.description}
- Tanggal Kejadian: ${caseData.incidentDate || '-'}
- Lokasi: ${caseData.location || '-'}
- Pihak Terlibat: ${caseData.involvedParties || '-'}

Format respons dalam Bahasa Indonesia formal:
1. **Ringkasan Eksekutif Kasus (Executive Summary)**
2. **Identifikasi Isu Kritis & Risiko Kepatuhan**
3. **Poin-poin Penting Wawancara Investigasi**
4. **Rekomendasi Tindakan Cepat (Immediate Action & CAPA)**`;

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

  // Endpoint 2: Generate 5 Whys Root Cause Suggestions
  app.post('/api/ai/root-cause-suggest', async (req, res) => {
    try {
      const { caseData } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: 'caseData is required' });
      }

      if (!ai) {
        return res.json(generateLocal5Whys(caseData));
      }

      const prompt = `Anda adalah Auditor & Spesialis Root Cause Analysis (RCA) di PT SHOENARY JAVANESIA INC.
Berdasarkan keluhan berikut:
- Kategori: ${caseData.complaintCategory}
- Departemen: ${caseData.department}
- Deskripsi: ${caseData.description}

Hasilkan analisis 5 Whys (Lembar 5W) dalam format JSON murni dengan field berikut:
{
  "primaryCategory": "Management & Leadership" | "Process" | "Policy" | "People" | "Work Environment" | "Equipment / System",
  "why1": "Penyebab langsung level 1",
  "why2": "Penyebab level 2",
  "why3": "Penyebab level 3",
  "why4": "Penyebab level 4",
  "why5": "Akar masalah utama level 5 (Root Cause)",
  "systemicFactors": "Faktor sistemik yang memungkinkan masalah terjadi",
  "preventiveRecommendations": "Rekomendasi tindakan pencegahan jangka panjang"
}
Hanya kembalikan JSON tanpa backticks.`;

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
      return res.json(generateLocal5Whys(req.body.caseData));
    }
  });

  // Endpoint 3: Generate Compliance Report Narrative
  app.post('/api/ai/report-narrative', async (req, res) => {
    try {
      const { period, stats, categoryStats, deptStats } = req.body;
      if (!ai) {
        return res.json({
          narrative: `Selama periode pelaporan (${period || 'Operasional Terkini'}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. mengelola ${stats.total || 0} keluhan formal dengan tingkat kepatuhan penyelesaian SLA sebesar ${stats.complianceRate || 100}%. Prioritas perbaikan diarahkan pada penguatan koordinasi lini supervisor dan percepatan eksekusi Corrective and Preventive Action (CAPA).`
        });
      }
      const prompt = `Buat narasi eksekutif laporan kepatuhan etika & keluhan karyawan PT SHOENARY JAVANESIA INC. untuk periode: ${period}.
Data: Total Kasus: ${stats.total}, Selesai: ${stats.closed}, Tingkat Kepatuhan SLA: ${stats.complianceRate}%, Kasus Kritis: ${stats.critical}.
Distribusi Kategori: ${JSON.stringify(categoryStats)}.
Distribusi Departemen: ${JSON.stringify(deptStats)}.
Tuliskan 2 paragraf formal dan analitis dalam Bahasa Indonesia.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      return res.json({ narrative: response.text });
    } catch (err) {
      return res.json({
        narrative: `Selama periode pelaporan (${req.body.period || 'Operasional Terkini'}), Sistem Manajemen Keluhan PT Shoenary Javanesia Inc. memproses keluhan formal sesuai SLA audit internal.`
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
