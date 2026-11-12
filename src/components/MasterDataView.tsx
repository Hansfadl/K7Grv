import React, { useState, useEffect } from 'react';
import { MasterCategory, MasterDepartment } from '../types';
import {
  getCategories,
  saveCategories,
  getDepartments,
  saveDepartments,
  updateCategoryDescription,
  SJI_COMPANY_HOLIDAYS,
  getSlaWorkdays,
} from '../services/db';
import { useAuth } from '../context/AuthContext';
import {
  Database,
  Plus,
  Check,
  X,
  Shield,
  Clock,
  Edit3,
  FileText,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';

export const MasterDataView: React.FC = () => {
  const { currentUser, canManageMasterData } = useAuth();
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [activeTab, setActiveTab] = useState<'categories' | 'departments' | 'sla'>('categories');

  // New Category State
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({
    name: '',
    code: '',
    defaultPriority: 'Major' as MasterCategory['defaultPriority'],
    slaDays: 7,
    description: '',
  });

  // Edit Category Description State
  const [editingCategory, setEditingCategory] = useState<MasterCategory | null>(null);
  const [editCategoryDesc, setEditCategoryDesc] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // New Dept State
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDept, setNewDept] = useState({
    name: '',
    code: '',
    picName: '',
    picEmail: '',
  });

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editPicName, setEditPicName] = useState('');
  const [editPicEmail, setEditPicEmail] = useState('');

  const handleStartEditPic = (dept: MasterDepartment) => {
    setEditingDeptId(dept.id);
    setEditPicName(dept.picName || '');
    setEditPicEmail(dept.picEmail || '');
  };

  const handleSavePic = (deptId: string) => {
    const updated = departments.map((d) =>
      d.id === deptId ? { ...d, picName: editPicName.trim(), picEmail: editPicEmail.trim() } : d
    );
    setDepartments(updated);
    saveDepartments(updated);
    setEditingDeptId(null);
  };

  const handleStartEditCategory = (cat: MasterCategory) => {
    setEditingCategory(cat);
    setEditCategoryDesc(cat.description || '');
    setSaveSuccessMsg(null);
  };

  const handleSaveCategoryDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSavingCat(true);
    try {
      const updated = await updateCategoryDescription(
        editingCategory.id,
        editCategoryDesc,
        currentUser
      );
      setCategories(updated);
      setSaveSuccessMsg(`Deskripsi kategori "${editingCategory.name}" berhasil diperbarui dan tersimpan permanen di Firebase.`);
      setTimeout(() => {
        setEditingCategory(null);
        setSaveSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan deskripsi: ' + (err.message || 'Periksa koneksi database.'));
    } finally {
      setIsSavingCat(false);
    }
  };

  useEffect(() => {
    getCategories().then(setCategories);
    getDepartments().then(setDepartments);

    const handleCategoriesUpdated = (e: any) => {
      if (e.detail) setCategories(e.detail);
    };
    window.addEventListener('sji_categories_updated', handleCategoriesUpdated);
    return () => window.removeEventListener('sji_categories_updated', handleCategoriesUpdated);
  }, []);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    const defaultSla = getSlaWorkdays(newCat.defaultPriority);
    const item: MasterCategory = {
      ...newCat,
      id: `cat-${Date.now().toString(36)}`,
      code: newCat.code || newCat.name.toUpperCase().substring(0, 6),
      slaDays: defaultSla,
      active: true,
    };
    const updated = [...categories, item];
    setCategories(updated);
    saveCategories(updated);
    setShowAddCat(false);
    setNewCat({ name: '', code: '', defaultPriority: 'Major', slaDays: 7, description: '' });
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    const item: MasterDepartment = {
      ...newDept,
      id: `dept-${Date.now().toString(36)}`,
      code: newDept.code || newDept.name.toUpperCase().substring(0, 4),
      active: true,
    };
    const updated = [...departments, item];
    setDepartments(updated);
    saveDepartments(updated);
    setShowAddDept(false);
    setNewDept({ name: '', code: '', picName: '', picEmail: '' });
  };

  const toggleCategoryActive = (id: string) => {
    const updated = categories.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
    setCategories(updated);
    saveCategories(updated);
  };

  const toggleDepartmentActive = (id: string) => {
    const updated = departments.map((d) => (d.id === id ? { ...d, active: !d.active } : d));
    setDepartments(updated);
    saveDepartments(updated);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Master Data Configuration</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              SLA Single Source of Truth
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola master kategori keluhan, deskripsi kebijakan, PIC departemen, dan Service Level Agreement (SLA) berbasis Hari Kerja.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'categories' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
          }`}
        >
          Complaint Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'departments' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
          }`}
        >
          Departments &amp; PICs ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('sla')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'sla' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
          }`}
        >
          SLA Matrix Rules (Hari Kerja)
        </button>
      </div>

      {/* TAB: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Deskripsi kategori ditampilkan secara lengkap tanpa pemotongan dan dapat diedit oleh authorized user kapan saja.
            </p>
            {canManageMasterData && (
              <button
                onClick={() => setShowAddCat(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Complaint Category</span>
              </button>
            )}
          </div>

          {/* Add Category Form */}
          {showAddCat && (
            <form onSubmit={handleAddCategory} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3 text-xs">
              <span className="font-bold text-blue-900 block">New Complaint Category</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Category Name *"
                  required
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
                <select
                  value={newCat.defaultPriority}
                  onChange={(e) => {
                    const prio = e.target.value as MasterCategory['defaultPriority'];
                    const sla = getSlaWorkdays(prio);
                    setNewCat({ ...newCat, defaultPriority: prio, slaDays: sla });
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                >
                  <option value="Minor">Minor (3 Hari Kerja)</option>
                  <option value="Major">Major (7 Hari Kerja)</option>
                  <option value="Critical">Critical (14 Hari Kerja)</option>
                </select>
                <input
                  type="number"
                  placeholder="Target SLA Hari Kerja"
                  value={newCat.slaDays}
                  onChange={(e) => setNewCat({ ...newCat, slaDays: parseInt(e.target.value) || 7 })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded bg-slate-50"
                  readOnly
                  title="SLA dihitung otomatis berdasarkan matriks prioritas"
                />
              </div>
              <textarea
                placeholder="Tuliskan deskripsi lengkap ruang lingkup kebijakan atau jenis keluhan..."
                rows={3}
                value={newCat.description}
                onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded leading-relaxed"
              />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowAddCat(false)} className="px-3 py-1.5 text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded">
                  Save Category
                </button>
              </div>
            </form>
          )}

          {/* Categories Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4 w-44">Category Name</th>
                    <th className="py-3 px-4 w-20">Code</th>
                    <th className="py-3 px-4 w-32">Default Priority</th>
                    <th className="py-3 px-4 w-32">Target Resolution SLA</th>
                    <th className="py-3 px-4 min-w-[320px]">Description (Full Policy Scope)</th>
                    <th className="py-3 px-4 text-right w-44">Aksi / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 align-top">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 align-top">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {c.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.defaultPriority === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : c.defaultPriority === 'Major'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.defaultPriority}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-blue-700 align-top">
                        <span className="inline-flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>{c.slaDays} Hari Kerja</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 align-top">
                        <div className="whitespace-pre-line break-words leading-relaxed text-xs text-slate-700">
                          {c.description || (
                            <span className="text-slate-400 italic">Belum ada deskripsi kebijakan.</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right align-top space-x-1.5 whitespace-nowrap">
                        {canManageMasterData && (
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(c)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                            title="Edit deskripsi lengkap kategori ini"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Deskripsi</span>
                          </button>
                        )}
                        <button
                          onClick={() => toggleCategoryActive(c.id)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                            c.active
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                          }`}
                        >
                          {c.active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CATEGORY DESCRIPTION */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base">Edit Deskripsi Complaint Category</h3>
                  <p className="text-xs text-slate-400">
                    Kategori: <strong className="text-white">{editingCategory.name}</strong> ({editingCategory.code}) • SLA Resolusi:{' '}
                    <strong className="text-blue-300">{editingCategory.slaDays} Hari Kerja</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryDescription} className="p-6 space-y-4 text-xs">
              {saveSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{saveSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Category ID &amp; Code</span>
                  <span className="font-mono text-slate-800 font-bold">{editingCategory.id} • {editingCategory.code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Tingkat Prioritas</span>
                  <span className="font-bold text-slate-800">{editingCategory.defaultPriority} ({editingCategory.slaDays} Hari Kerja)</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                  Uraian Lengkap Deskripsi Kebijakan &amp; Ruang Lingkup Masalah *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Teks ini tampil tanpa pemotongan pada seluruh form intake, detail kasus, dan laporan HR. Gunakan baris baru untuk memisahkan poin-poin ruang lingkup.
                </p>
                <textarea
                  rows={6}
                  required
                  value={editCategoryDesc}
                  onChange={(e) => setEditCategoryDesc(e.target.value)}
                  placeholder="Tuliskan uraian detail ruang lingkup keluhan, batas kebijakan perusahaan, contoh kejadian terkait..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs text-slate-800 leading-relaxed font-sans bg-white shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[11px] text-slate-500 italic">
                  *Perubahan tersimpan permanen di Firebase Firestore dan tidak mengubah riwayat kasus lama.
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCat}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSavingCat ? (
                      <span>Menyimpan...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan Perubahan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Daftar departemen aktif dan Person in Charge (PIC) penerima notifikasi otomatis penanganan keluhan.
            </p>
            {canManageMasterData && (
              <button
                onClick={() => setShowAddDept(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Department</span>
              </button>
            )}
          </div>

          {showAddDept && (
            <form onSubmit={handleAddDepartment} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3 text-xs">
              <span className="font-bold text-blue-900 block">New Department &amp; PIC</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Department Name *"
                  required
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
                <input
                  type="text"
                  placeholder="Code (e.g. OPS) *"
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
                <input
                  type="text"
                  placeholder="Designated PIC Name *"
                  required
                  value={newDept.picName}
                  onChange={(e) => setNewDept({ ...newDept, picName: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
                <input
                  type="email"
                  placeholder="PIC Email *"
                  required
                  value={newDept.picEmail}
                  onChange={(e) => setNewDept({ ...newDept, picEmail: e.target.value })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowAddDept(false)} className="px-3 py-1.5 text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded">
                  Save Department
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <th className="py-2.5 px-4">Department Name</th>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Designated PIC</th>
                  <th className="py-2.5 px-4">PIC Email</th>
                  <th className="py-2.5 px-4 text-right">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => {
                  const isEditing = editingDeptId === d.id;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{d.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{d.code}</td>

                      {/* Designated PIC */}
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPicName}
                            onChange={(e) => setEditPicName(e.target.value)}
                            placeholder="Nama PIC"
                            className="px-2 py-1 text-xs border border-blue-400 rounded bg-white w-36"
                          />
                        ) : d.picName ? (
                          <span className="font-medium text-slate-800">{d.picName}</span>
                        ) : (
                          <span className="text-amber-600 italic text-[11px] font-medium">Belum Ditentukan</span>
                        )}
                      </td>

                      {/* PIC Email */}
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editPicEmail}
                            onChange={(e) => setEditPicEmail(e.target.value)}
                            placeholder="email.pic@sji-corp.com"
                            className="px-2 py-1 text-xs border border-blue-400 rounded bg-white w-44"
                          />
                        ) : d.picEmail ? (
                          <span className="text-slate-500 font-mono text-[11px]">{d.picEmail}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSavePic(d.id)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                              Simpan PIC
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDeptId(null)}
                              className="px-2 py-1 rounded text-[10px] font-medium text-slate-600 hover:bg-slate-200"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEditPic(d)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition"
                            >
                              {d.picName ? 'Ubah PIC' : '+ Set PIC'}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDepartmentActive(d.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {d.active ? 'Active' : 'Disabled'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SLA MATRIX */}
      {activeTab === 'sla' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>SJI Corporate Resolution SLA Benchmark Matrix (Workdays)</span>
            </h3>
            <p className="text-slate-500 leading-relaxed mt-0.5">
              Service Level Agreement (SLA) adalah sumber utama (single source of truth) penentuan Target Due Date di seluruh sistem SJI HR Grievance.
              Perhitungan menggunakan <strong>HARI KERJA (WORKDAYS)</strong> tidak termasuk hari Sabtu, Minggu, dan Hari Libur Resmi Perusahaan.
            </p>
          </div>

          {/* 3 SLA Priority Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Minor: 3 Hari Kerja */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs uppercase tracking-wider block">Minor Priority</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">SLA Ringan</span>
              </div>
              <div className="text-3xl font-black text-slate-900">3 Hari Kerja</div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Penyelesaian untuk keluhan administratif, absensi, fasilitas kerja, cuti, atau hubungan kerja interpersonal harian.
              </p>
            </div>

            {/* Major: 7 Hari Kerja */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 text-xs uppercase tracking-wider block">Major Priority</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">SLA Menengah</span>
              </div>
              <div className="text-3xl font-black text-amber-900">7 Hari Kerja</div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Penyelidikan dan mediasi formal untuk keluhan implementasi kebijakan, perlakuan atasan, sengketa lembur, proses operasional, atau benefit.
              </p>
            </div>

            {/* Critical: 14 Hari Kerja */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-xs uppercase tracking-wider block">Critical Priority</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900">SLA Kritis</span>
              </div>
              <div className="text-3xl font-black text-rose-700">14 Hari Kerja</div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                Target resolusi menyeluruh untuk kasus pelecehan, kekerasan fisik/verbal, pelanggaran etika berat, atau bahaya keselamatan kerja (K3/Keamanan).
              </p>
              <div className="mt-2 p-2 rounded bg-rose-100/80 border border-rose-300 text-[10px] text-rose-900 font-medium flex items-start space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span>Mandatori: Penanganan awal, triage darurat, dan koordinasi investigasi tetap wajib dimulai segera dalam 72 jam pertama.</span>
              </div>
            </div>
          </div>

          {/* SJI Corporate Calendar & Holiday Info */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
            <h4 className="font-bold text-blue-900 flex items-center space-x-2 text-xs">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span>Kalender Hari Libur Perusahaan PT Shoenary Javanesia Inc. (Tahun 2026)</span>
            </h4>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Sistem secara otomatis melompati hari Sabtu, Minggu, serta kalender hari libur nasional &amp; cuti bersama perusahaan berikut saat menghitung Due Date:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
              {SJI_COMPANY_HOLIDAYS.map((h) => (
                <div key={h} className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 font-semibold text-center">
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Audit Rule Information */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-slate-700">
            <h4 className="font-bold text-slate-900 flex items-center space-x-2 text-xs">
              <Info className="w-4 h-4 text-slate-600" />
              <span>Ketentuan &amp; Tata Kelola Audit SLA SJI</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1 leading-relaxed">
              <li><strong>Target Due Date</strong> dihitung otomatis berdasarkan <em>Tanggal Penerimaan (Grievance Date)</em> ditambah hari kerja SLA.</li>
              <li>Perubahan ketentuan SLA berlaku otomatis untuk <strong>kasus baru</strong> yang didaftarkan atau diimpor.</li>
              <li>Kasus-kasus lama <strong>mempertahankan Target Due Date historisnya</strong> untuk menjaga keabsahan rekonsiliasi audit periode sebelumnya.</li>
              <li><strong>Rumus SLA Compliance Laporan:</strong> <code>(Total On Time / (Total On Time + Total Overdue)) × 100%</code>. Kasus Pending dan Data Incomplete dikecualikan dari denominator.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
