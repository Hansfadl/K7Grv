import React, { useState } from 'react';
import { useCases } from '../context/CaseContext';
import { parseExcelImport } from '../services/db';
import { GrievanceCase } from '../types';
import { X, FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

export const ExcelImportModal: React.FC = () => {
  const { isImportModalOpen, setIsImportModalOpen, handleImportCases } = useCases();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Partial<GrievanceCase>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isImportModalOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const parsed = await parseExcelImport(selectedFile);
      if (parsed.length === 0) {
        setErrorMsg('No valid grievance rows found in the uploaded spreadsheet.');
      } else {
        setPreviewData(parsed);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to parse file. Please upload a valid .xlsx or .csv spreadsheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleRows = [
      {
        'Ticket ID': 'GRV-2026-IMP01',
        'Date Received': '2026-11-01',
        'Employee Name': 'Ahmad Fauzi',
        Department: 'Sewing',
        'Complaint Category': 'Fasilitas',
        Priority: 'Minor',
        Status: 'Open',
        'Assigned PIC': 'Budi Santoso',
        'Due Date': '2026-11-04',
        Description: 'Kipas ventilasi pada line sewing 3 berbunyi keras dan berdebu.',
      },
      {
        'Ticket ID': 'GRV-2026-IMP02',
        'Date Received': '2026-11-01',
        'Employee Name': 'Rina Anggraini',
        Department: 'PPIC',
        'Complaint Category': 'Lembur',
        Priority: 'Major',
        Status: 'Open',
        'Assigned PIC': 'Dewi Lestari',
        'Due Date': '2026-11-08',
        Description: 'Perhitungan jam lembur pada hari libur nasional belum sesuai slip.',
      },
      {
        'Ticket ID': 'GRV-2026-IMP03',
        'Date Received': '2026-11-01',
        'Employee Name': 'Anonymous Reporter',
        Department: 'Assembling',
        'Complaint Category': 'Pelecehan',
        Priority: 'Critical',
        Status: 'Investigation',
        'Assigned PIC': 'Hendra Wijaya',
        'Due Date': '2026-11-15',
        Description: 'Laporan intimidasi dan perlakuan kasar berulang dari atasan shift.',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample Grievances');
    XLSX.writeFile(wb, 'SJI_Grievance_Import_Template.xlsx');
  };

  const handleConfirmImport = async () => {
    if (previewData.length === 0) return;
    setIsImporting(true);
    try {
      const count = await handleImportCases(previewData);
      alert(`Successfully imported ${count} grievance records into SJI HR System.`);
      setIsImportModalOpen(false);
      setPreviewData([]);
      setFile(null);
    } catch (err) {
      console.error(err);
      alert('Error during batch import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">Excel / CSV Batch Grievance Import</h3>
              <p className="text-xs text-slate-400">
                Import exported grievance logs from company internal submission portal
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
          {/* Instructions and Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3">
            <div>
              <span className="font-bold text-slate-900 block">Expected Spreadsheet Format</span>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Headers accepted: Ticket ID, Date Received, Employee Name, Department, Complaint Category, Priority, Description.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs whitespace-nowrap shadow-2xs"
            >
              Download Sample Template (.xlsx)
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition bg-slate-50/50">
            <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm mb-1">
              Select Excel or CSV Spreadsheet
            </p>
            <p className="text-slate-500 text-xs mb-3">Supports .xlsx, .xls, and .csv files</p>
            <label className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs transition">
              <span>Browse Files</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && (
              <p className="text-xs text-emerald-700 font-semibold mt-3">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  Spreadsheet Preview ({previewData.length} records verified)
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Ready to commit
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2 px-3">Ticket ID</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Employee</th>
                      <th className="py-2 px-3">Department</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Priority</th>
                      <th className="py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.ticketId}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{row.dateReceived}</td>
                        <td className="py-2 px-3">{row.employeeName}</td>
                        <td className="py-2 px-3">{row.department}</td>
                        <td className="py-2 px-3 max-w-[150px] truncate">{row.complaintCategory}</td>
                        <td className="py-2 px-3 font-semibold">{row.priority}</td>
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
            Cancel
          </button>
          <button
            disabled={previewData.length === 0 || isImporting}
            onClick={handleConfirmImport}
            className={`inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition ${
              previewData.length > 0 && !isImporting
                ? 'bg-blue-600 hover:bg-blue-700 shadow-xs'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            <span>{isImporting ? 'Importing Cases...' : `Commit ${previewData.length} Cases to System`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
