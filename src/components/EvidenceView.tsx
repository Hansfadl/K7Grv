import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  FileArchive,
  Lock,
  ShieldCheck,
  ArrowRight,
  Image as ImageIcon,
  FileText,
  Upload,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  X,
  CheckCircle2
} from 'lucide-react';
import { GrievanceCase, EvidenceItem } from '../types';
import { getCaseEvidence, addCaseEvidence, deleteCaseEvidence } from '../services/db';

interface EvidenceViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const EvidenceView: React.FC<EvidenceViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTicketId, setUploadTicketId] = useState<string>(cases[0]?.ticketId || '');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<EvidenceItem['category']>('Document');
  const [uploadConfidential, setUploadConfidential] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);

  // Replace item state
  const [replaceTargetItem, setReplaceTargetItem] = useState<EvidenceItem | null>(null);

  // Load all evidence for cases
  const loadEvidence = async () => {
    setIsLoading(true);
    try {
      const promises = cases.map(async (c) => {
        const evs = await getCaseEvidence(c.id, currentUser);
        return evs.map((e) => ({
          ...e,
          ticketId: e.ticketId || c.ticketId,
          caseId: c.id,
        }));
      });
      const results = await Promise.all(promises);
      setEvidenceList(results.flat());
    } catch (err) {
      console.warn('Error loading evidence:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [cases.length, currentUser?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Format file ${ext} tidak didukung. Harap unggah format JPG, JPEG, PNG, atau PDF.`);
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`Ukuran file (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 10 MB.`);
      return;
    }

    setUploadError(null);
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: sizeStr,
        type: file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedFile) {
      setUploadError('Harap pilih file dokumen atau foto bukti.');
      return;
    }

    const targetCase = cases.find((c) => c.ticketId === uploadTicketId) || cases[0];
    if (!targetCase) {
      setUploadError('Pilih Ticket ID kasus yang valid.');
      return;
    }

    setIsUploading(true);
    try {
      if (replaceTargetItem) {
        // Replace existing evidence
        await deleteCaseEvidence(replaceTargetItem.caseId, replaceTargetItem.id, currentUser);
      }

      await addCaseEvidence(
        targetCase.id,
        {
          caseId: targetCase.id,
          ticketId: targetCase.ticketId,
          title: uploadTitle.trim() || selectedFile.name,
          category: uploadCategory,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          fileData: selectedFile.dataUrl,
          isConfidential: uploadConfidential,
          uploadedBy: currentUser.displayName,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          chainOfCustody: `Diverifikasi dan diarsipkan oleh ${currentUser.displayName} (${currentUser.role}).`,
        },
        currentUser
      );

      setShowUploadModal(false);
      setReplaceTargetItem(null);
      setSelectedFile(null);
      setUploadTitle('');
      await loadEvidence();
    } catch (err: any) {
      setUploadError('Gagal mengunggah bukti: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (item: EvidenceItem) => {
    if (!currentUser) return;
    if (!window.confirm(`Hapus file bukti "${item.fileName}" untuk Ticket #${item.ticketId}?`)) {
      return;
    }

    try {
      await deleteCaseEvidence(item.caseId, item.id, currentUser);
      setEvidenceList((prev) => prev.filter((e) => e.id !== item.id));
    } catch (err) {
      console.warn('Error deleting evidence:', err);
    }
  };

  const handleDownloadItem = (item: EvidenceItem) => {
    if (!item.fileData && !item.fileUrl) {
      alert('Data file tidak tersedia untuk diunduh.');
      return;
    }

    const downloadSource = item.fileData || item.fileUrl || '';
    const a = document.createElement('a');
    a.href = downloadSource;
    a.download = item.fileName || `Evidence_${item.ticketId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleStartReplace = (item: EvidenceItem) => {
    setReplaceTargetItem(item);
    setUploadTicketId(item.ticketId);
    setUploadTitle(item.title);
    setUploadCategory(item.category);
    setUploadConfidential(item.isConfidential);
    setSelectedFile(null);
    setUploadError(null);
    setShowUploadModal(true);
  };

  // Filtered evidence items
  const filteredEvidence = evidenceList.filter((item) => {
    if (selectedCaseId !== 'all' && item.caseId !== selectedCaseId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTicket = item.ticketId?.toLowerCase().includes(q);
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchFile = item.fileName?.toLowerCase().includes(q);
      if (!matchTicket && !matchTitle && !matchFile) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Secured Evidence Vault &amp; Chain of Custody</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              JPG, JPEG, PNG, PDF
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
              Role-Based Access
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Arsip bukti investigasi terenkripsi terhubung langsung dengan Ticket ID: upload, preview, unduh, ganti (replace), dan hapus.
          </p>
        </div>

        <button
          onClick={() => {
            setReplaceTargetItem(null);
            setSelectedFile(null);
            setUploadTitle('');
            setUploadError(null);
            setShowUploadModal(true);
          }}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Bukti Baru</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari file, judul, Ticket ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Kasus ({cases.length})</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.ticketId} - {c.department}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadEvidence}
          title="Muat Ulang Vault"
          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Evidence Items Grid */}
      {filteredEvidence.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          {isLoading ? 'Memuat arsip bukti...' : 'Belum ada bukti digital yang diunggah untuk kasus ini.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvidence.map((item) => {
            const isPdf = item.fileType?.includes('pdf') || item.fileName.toLowerCase().endsWith('.pdf');
            const associatedCase = cases.find((c) => c.ticketId === item.ticketId || c.id === item.caseId);

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-blue-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {item.ticketId}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {item.category}
                    </span>
                  </div>

                  {/* Thumbnail / Icon preview */}
                  <div
                    onClick={() => setPreviewItem(item)}
                    className="h-32 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition relative group"
                  >
                    {!isPdf && item.fileData ? (
                      <img
                        src={item.fileData}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center space-y-1 text-slate-400">
                        <FileText className="w-10 h-10 text-rose-500" />
                        <span className="text-[11px] font-bold text-slate-600">Dokumen PDF</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-semibold space-x-1">
                      <Eye className="w-4 h-4" />
                      <span>Klik untuk Preview</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{item.fileName} • {item.fileSize}</p>
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    Diunggah: {item.uploadedAt} oleh {item.uploadedBy}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      title="Preview Bukti"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadItem(item)}
                      title="Download File"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartReplace(item)}
                      title="Ganti File (Replace)"
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      title="Hapus Bukti"
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {associatedCase && (
                    <button
                      onClick={() => onOpenCase(associatedCase, 'evidence')}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      Detail Kasus →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload & Replace Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {replaceTargetItem ? 'Ganti File Bukti (Replace)' : 'Upload Dokumen / Foto Bukti'}
                </h3>
                <p className="text-xs text-slate-400">
                  Format didukung: JPG, JPEG, PNG, PDF (Maksimal 10 MB)
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUpload} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ticket ID Kasus <span className="text-rose-500">*</span>
                </label>
                <select
                  value={uploadTicketId}
                  onChange={(e) => setUploadTicketId(e.target.value)}
                  disabled={Boolean(replaceTargetItem)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-slate-100"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.ticketId}>
                      {c.ticketId} - {c.department} ({c.complaintCategory})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Dokumen / Keterangan Bukti <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  placeholder="Contoh: Tangkapan Layar CCTV Koridor A / Surat Pernyataan"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Bukti
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Document">Dokumen Resmi / SOP</option>
                    <option value="Photo">Foto Lapangan</option>
                    <option value="Email/Chat Screenshot">Screenshot Email / Chat</option>
                    <option value="Witness Statement">Pernyataan Saksi</option>
                    <option value="CCTV/Video Log">Log / Still CCTV</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uploadConfidential}
                      onChange={(e) => setUploadConfidential(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold">Kerahasiaan Khusus HR</span>
                  </label>
                </div>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih File Bukti (JPG, PNG, PDF) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    ✓ File siap diunggah: {selectedFile.name} ({selectedFile.size})
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Mengunggah...' : replaceTargetItem ? 'Ganti File' : 'Unggah Bukti'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Preview Modal for Image & PDF */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs font-bold text-blue-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  #{previewItem.ticketId}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-white">{previewItem.title}</h3>
                  <p className="text-xs text-slate-400">{previewItem.fileName} • {previewItem.fileSize}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadItem(previewItem)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh</span>
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-4 overflow-auto flex items-center justify-center min-h-[420px]">
              {previewItem.fileType?.includes('pdf') || previewItem.fileName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewItem.fileData || previewItem.fileUrl}
                  title={previewItem.fileName}
                  className="w-full h-[520px] rounded border border-slate-800 bg-white"
                />
              ) : previewItem.fileData || previewItem.fileUrl ? (
                <img
                  src={previewItem.fileData || previewItem.fileUrl}
                  alt={previewItem.title}
                  className="max-h-[520px] max-w-full object-contain rounded shadow-lg"
                />
              ) : (
                <div className="text-white text-xs">Pratinjau tidak tersedia.</div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Rantai Penjagaan (Chain of Custody): <strong>{previewItem.chainOfCustody}</strong></span>
              <span>Waktu Unggah: {previewItem.uploadedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
