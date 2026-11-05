import React, { useState } from 'react';
import { useCases } from '../context/CaseContext';
import { parseExcelImportAdvanced, ExcelImportResult } from '../services/db';
import { GrievanceCase } from '../types';
import { X, FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle, ArrowRight, Download, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

export const ExcelImportModal: React.FC = () => {
  const { isImportModalOpen, setIsImportModalOpen, handleImportCases, cases } = useCases();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isImportModalOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setParseError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const result = await parseExcelImportAdvanced(selectedFile, cases);
      setImportResult(result);
      if (result.validCases.length === 0 && result.errors.length === 0) {
        setParseError('Tidak ada baris data keluhan yang ditemukan di dalam spreadsheet.');
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Gagal memproses file. Pastikan format spreadsheet berupa .xlsx, .xls, atau .csv.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleRows = [
      {
        'Ticket ID': 'GRV-2026-0101',
        'Tanggal Keluhan': '2026-10-15',
        'Nama Pelapor': 'Ahmad Fauzi',
        'Departemen': 'Sewing',
        'Kategori Keluhan': 'Fasilitas',
        'Prioritas': 'Minor',
        'Status': 'Open',
        'PIC Departemen': 'Budi Santoso',
        'Target Selesai': '2026-10-18',
        'Saluran': 'Online',
        'Uraian Keluhan': 'Kipas ventilasi pada line sewing 3 berbunyi keras dan berdebu.',
      },
      {
        'Ticket ID': 'GRV-2026-0102',
        'Tanggal Keluhan': '2026-10-20',
        'Nama Pelapor': 'Rina Anggraini',
        'Departemen': 'PPIC',
        'Kategori Keluhan': 'Lembur',
        'Prioritas': 'Major',
        'Status': 'Investigation',
        'PIC Departemen': 'Dewi Lestari',
        'Target Selesai': '2026-10-27',
        'Saluran': 'Grievance Box',
        'Uraian Keluhan': 'Perhitungan jam lembur pada hari libur nasional belum sesuai slip gaji.',
      },
      {
        'Ticket ID': 'GRV-2026-0103',
        'Tanggal Keluhan': '2026-10-25',
        'Nama Pelapor': 'Pelapor Anonim',
        'Departemen': 'Assembling',
        'Kategori Keluhan': 'Pelecehan',
        'Prioritas': 'Critical',
        'Status': 'Open',
        'PIC Departemen': 'Hendra Wijaya',
        'Target Selesai': '2026-11-08',
        'Saluran': 'Hotline',
        'Uraian Keluhan': 'Laporan intimidasi dan perlakuan kasar berulang dari atasan shift.',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Keluhan SJI');
    XLSX.writeFile(wb, 'SJI_Template_Import_Keluhan.xlsx');
  };

  const handleConfirmImport = async () => {
    if (!importResult || importResult.validCases.length === 0) return;
    setIsImporting(true);
    setParseError(null);
    try {
      const count = await handleImportCases(importResult.validCases);
      setSuccessMsg(`Berhasil mengimpor ${count} data keluhan ke database Cloud Firestore.`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportResult(null);
        setFile(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setParseError('Gagal mengimpor data ke database: ' + (err.message || 'Periksa koneksi.'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">Import Data Keluhan (Excel / CSV)</h3>
              <p className="text-xs text-slate-400">
                Impor data pengaduan massal dari website internal atau file rekapitulasi HR
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsImportModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Download Template Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
            <div>
              <span className="font-bold text-slate-900 block text-xs">Unduh Format Template Resmi SJI</span>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Kolom didukung: Ticket ID, Tanggal Keluhan, Nama Pelapor, Departemen, Kategori, Prioritas, Status, PIC, Target Selesai, Deskripsi.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs whitespace-nowrap shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Template (.xlsx)</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition bg-slate-50/50">
            <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm mb-1">
              Pilih Berkas Spreadsheet (.xlsx, .xls, .csv)
            </p>
            <p className="text-slate-500 text-xs mb-3">
              Tanggal keluhan akan diidentifikasi secara otomatis (mendukung format DD/MM/YYYY atau Excel Date)
            </p>
            <label className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs transition">
              <span>{isLoading ? 'Memproses Berkas...' : 'Pilih File Komputer'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isLoading}
                className="hidden"
              />
            </label>
            {file && (
              <p className="text-xs text-blue-700 font-semibold mt-3">
                File terpilih: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center space-x-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error & Duplicate Warnings List */}
          {importResult && importResult.errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Peringatan Validasi Spreadsheet ({importResult.errors.length} catatan dilewati):</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-amber-800 max-h-24 overflow-y-auto space-y-0.5">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table of Valid Rows */}
          {importResult && importResult.validCases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  Pratinjau Data Terverifikasi ({importResult.validCases.length} keluhan siap disimpan)
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Due Date Dihitung Berdasarkan Tanggal Keluhan
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2 px-3">Ticket ID</th>
                      <th className="py-2 px-3">Tgl Keluhan</th>
                      <th className="py-2 px-3">Pelapor</th>
                      <th className="py-2 px-3">Departemen</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3">Prioritas</th>
                      <th className="py-2 px-3">Batas Waktu (Due Date)</th>
                      <th className="py-2 px-3">Uraian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResult.validCases.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.ticketId}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{row.dateReceived}</td>
                        <td className="py-2 px-3">{row.employeeName}</td>
                        <td className="py-2 px-3">{row.department}</td>
                        <td className="py-2 px-3 max-w-[130px] truncate">{row.complaintCategory}</td>
                        <td className="py-2 px-3 font-semibold">{row.priority}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-blue-700 font-medium">{row.dueDate}</td>
                        <td className="py-2 px-3 max-w-[200px] truncate">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsImportModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Batal
          </button>
          <button
            disabled={!importResult || importResult.validCases.length === 0 || isImporting}
            onClick={handleConfirmImport}
            className={`inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition ${
              importResult && importResult.validCases.length > 0 && !isImporting
                ? 'bg-blue-600 hover:bg-blue-700 shadow-xs'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            <span>
              {isImporting
                ? 'Menyimpan ke Cloud...'
                : `Simpan ${importResult?.validCases.length || 0} Keluhan ke Firestore`}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
