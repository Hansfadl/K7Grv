import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Lock,
  ArrowRight,
  Plus,
  Send,
  Calendar,
  User,
  Users,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileText
} from 'lucide-react';
import { GrievanceCase, CommunicationLog } from '../types';
import { getCaseCommunications, addCaseCommunication } from '../services/db';

interface CommunicationViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

const CHANNELS: CommunicationLog['channel'][] = [
  'Email',
  'Formal HR Memo',
  'Internal Note',
  'Verbal Discussion',
  'Meeting',
  'Hotline / WhatsApp',
];

export const CommunicationView: React.FC<CommunicationViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [commsList, setCommsList] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New Communication Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    ticketId: cases[0]?.ticketId || '',
    date: new Date().toISOString().substring(0, 10),
    channel: 'Email' as CommunicationLog['channel'],
    communicator: currentUser?.displayName || '',
    recipient: '',
    details: '',
    followUpNotes: '',
    isConfidential: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAllComms = async () => {
    setIsLoading(true);
    try {
      const promises = cases.map(async (c) => {
        const comms = await getCaseCommunications(c.id);
        return comms.map((cm) => ({
          ...cm,
          ticketId: cm.ticketId || c.ticketId,
          caseId: c.id,
        }));
      });
      const results = await Promise.all(promises);
      const flattened = results.flat().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setCommsList(flattened);
    } catch (err) {
      console.warn('Error fetching comms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllComms();
  }, [cases.length]);

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!form.ticketId.trim()) {
      setFormError('Harap pilih Ticket ID.');
      return;
    }
    if (!form.recipient.trim()) {
      setFormError('Recipient (Penerima) wajib diisi.');
      return;
    }
    if (!form.details.trim()) {
      setFormError('Communication Details wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const targetCase = cases.find((c) => c.ticketId === form.ticketId) || cases[0];
      const saved = await addCaseCommunication(
        targetCase.id,
        {
          caseId: targetCase.id,
          ticketId: targetCase.ticketId,
          date: form.date,
          channel: form.channel,
          communicator: form.communicator || currentUser.displayName,
          recipient: form.recipient,
          details: form.details,
          followUpNotes: form.followUpNotes,
          isConfidential: form.isConfidential,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        currentUser
      );

      setCommsList((prev) => [saved, ...prev]);
      setShowAddForm(false);
      setForm({
        ticketId: cases[0]?.ticketId || '',
        date: new Date().toISOString().substring(0, 10),
        channel: 'Email',
        communicator: currentUser.displayName,
        recipient: '',
        details: '',
        followUpNotes: '',
        isConfidential: true,
      });
    } catch (err: any) {
      setFormError('Gagal menyimpan komunikasi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredComms = commsList.filter((c) => {
    if (selectedCaseId !== 'all' && c.caseId !== selectedCaseId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTicket = c.ticketId?.toLowerCase().includes(q);
      const matchDetails = c.details?.toLowerCase().includes(q);
      const matchComm = c.communicator?.toLowerCase().includes(q);
      const matchRec = c.recipient?.toLowerCase().includes(q);
      if (!matchTicket && !matchDetails && !matchComm && !matchRec) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Communication Log &amp; Official HR Memo Registry</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Terhubung Ticket ID
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
              6 Field Standar
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Catatan korespondensi resmi, memo bipartit, klarifikasi verbal, dan notula rapat penanganan kasus.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Tutup Formulir' : 'Catat Komunikasi Baru'}</span>
        </button>
      </div>

      {/* Add New Form */}
      {showAddForm && (
        <form onSubmit={handleSaveComm} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">Formulir Log Komunikasi Baru</h3>
            <span className="text-xs text-slate-400">Tersimpan ke Firestore</span>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ticket ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ticket ID <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.ticketId}
                onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.ticketId}>
                    {c.ticketId} - {c.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date (Tanggal Komunikasi) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Communication Channel */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Communication Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Communicator */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Communicator (Pihak Pengirim / Narahubung) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.communicator}
                onChange={(e) => setForm({ ...form, communicator: e.target.value })}
                required
                placeholder="Nama pihak yang menyampaikan informasi"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Recipient */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient (Penerima Informasi) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                required
                placeholder="Nama individu, jabatan, atau serikat pekerja"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Communication Details (Isi Ringkas Pembicaraan / Memo) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              required
              placeholder="Rangkuman komunikasi resmi, pokok bahasan, dan komitmen yang disepakati..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Follow-up Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Follow-up Notes (Tindak Lanjut yang Diperlukan)
            </label>
            <input
              type="text"
              value={form.followUpNotes}
              onChange={(e) => setForm({ ...form, followUpNotes: e.target.value })}
              placeholder="Contoh: Menunggu tanda tangan serikat pekerja sebelum tanggal 15"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <label className="inline-flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isConfidential}
                onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold">Kerahasiaan Khusus HR</span>
            </label>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Log Komunikasi'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari korespondensi, pihak, Ticket ID..."
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
          onClick={loadAllComms}
          title="Muat Ulang Log"
          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Communication Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredComms.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            {isLoading ? 'Memuat log komunikasi...' : 'Belum ada log komunikasi yang tercatat untuk filter ini.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Communicator</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Communication Details</th>
                  <th className="px-4 py-3">Follow-up Notes</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComms.map((item) => {
                  const associatedCase = cases.find((c) => c.ticketId === item.ticketId || c.id === item.caseId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {item.ticketId}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                        {item.date}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                          {item.channel}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {item.communicator}
                      </td>

                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {item.recipient}
                      </td>

                      <td className="px-4 py-3 text-slate-700 max-w-sm">
                        <div className="line-clamp-2">{item.details}</div>
                      </td>

                      <td className="px-4 py-3 text-slate-500 max-w-xs">
                        <div className="line-clamp-1">{item.followUpNotes || '-'}</div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {associatedCase && (
                          <button
                            onClick={() => onOpenCase(associatedCase, 'communication')}
                            className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            <span>Kasus</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
