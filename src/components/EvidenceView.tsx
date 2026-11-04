import React from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { FileArchive, Lock, ShieldCheck, ArrowRight, Image as ImageIcon, FileText, Upload } from 'lucide-react';
import { GrievanceCase } from '../types';

interface EvidenceViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Secured Evidence Vault &amp; Chain of Custody</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center">
              <Upload className="w-3 h-3 mr-1" />
              Upload Foto / PDF Aktif
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Cryptographic Hash Integrity
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident archive of documents, PDF reports, CCTV stills, photos, and witness statements.
          </p>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          Belum ada keluhan yang terdaftar. Daftarkan keluhan di menu Case Management.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {c.ticketId}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 px-2 py-0.5 bg-slate-100 rounded">
                    {c.department}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900">{c.complaintCategory}</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Reporter: {c.isAnonymous ? c.anonymousAlias || 'Protected Whistleblower' : c.employeeName}
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <ImageIcon className="w-3 h-3 text-blue-500" />
                    <span>Foto Lapangan</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <FileText className="w-3 h-3 text-rose-500" />
                    <span>Dokumen PDF</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Status: <strong className="text-slate-700">{c.status}</strong></span>
                <button
                  onClick={() => onOpenCase(c, 'evidence')}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  <span>Buka Vault Bukti</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
