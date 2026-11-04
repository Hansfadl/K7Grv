import React, { useState, useEffect } from 'react';
import { MasterCategory, MasterDepartment } from '../types';
import { getCategories, saveCategories, getDepartments, saveDepartments } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Database, Plus, Check, X, Shield, Clock } from 'lucide-react';

export const MasterDataView: React.FC = () => {
  const { canManageMasterData } = useAuth();
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

  useEffect(() => {
    getCategories().then(setCategories);
    getDepartments().then(setDepartments);
  }, []);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    const item: MasterCategory = {
      ...newCat,
      id: `cat-${Date.now().toString(36)}`,
      code: newCat.code || newCat.name.toUpperCase().substring(0, 6),
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Master Data Configuration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain complaint categories, department PIC registries, and Service Level Agreement rules
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
          SLA Matrix Rules
        </button>
      </div>

      {/* TAB: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
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
                    const sla = prio === 'Critical' ? 14 : prio === 'Major' ? 7 : 3;
                    setNewCat({ ...newCat, defaultPriority: prio, slaDays: sla });
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                >
                  <option value="Minor">Minor (3 Hari)</option>
                  <option value="Major">Major (7 Hari)</option>
                  <option value="Critical">Critical (14 Hari)</option>
                </select>
                <input
                  type="number"
                  placeholder="Target SLA Days"
                  value={newCat.slaDays}
                  onChange={(e) => setNewCat({ ...newCat, slaDays: parseInt(e.target.value) || 7 })}
                  className="px-2.5 py-1.5 border border-slate-200 rounded"
                />
              </div>
              <textarea
                placeholder="Description of policy scope..."
                rows={2}
                value={newCat.description}
                onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
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

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <th className="py-2.5 px-4">Category Name</th>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Default Priority</th>
                  <th className="py-2.5 px-4">Target SLA</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{c.code}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {c.defaultPriority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-blue-700">{c.slaDays} Days</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{c.description}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => toggleCategoryActive(c.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
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
      )}

      {/* TAB: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
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
                  <th className="py-2.5 px-4 text-right">Status</th>
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
                            placeholder="Nama PIC..."
                            className="px-2 py-1 text-xs border border-blue-400 rounded bg-white w-36"
                          />
                        ) : d.picName ? (
                          <span className="font-semibold text-slate-800">{d.picName}</span>
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
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">SJI Corporate SLA Benchmark Parameters</h3>
          <p className="text-slate-500 leading-relaxed">
            Service Level Agreements are automatically calibrated upon grievance intake according to the established priority tier.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-700 text-xs uppercase tracking-wider block">Minor Priority</span>
              <div className="text-2xl font-black text-slate-800 mt-1">3 Hari</div>
              <p className="text-[11px] text-slate-600 mt-1">
                Penyelesaian cepat untuk keluhan administratif, fasilitas kerja, absensi, cuti, atau hubungan kerja harian.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60">
              <span className="font-bold text-amber-900 text-xs uppercase tracking-wider block">Major Priority</span>
              <div className="text-2xl font-black text-amber-800 mt-1">7 Hari</div>
              <p className="text-[11px] text-amber-900 mt-1">
                Penyelidikan dan mediasi untuk keluhan kebijakan, perlakuan atasan, sengketa lembur, proses produksi, atau benefit.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60">
              <span className="font-bold text-rose-900 text-xs uppercase tracking-wider block">Critical Priority</span>
              <div className="text-2xl font-black text-rose-700 mt-1">14 Hari</div>
              <p className="text-[11px] text-rose-800 mt-1">
                Investigasi komprehensif untuk kasus pelecehan, pelanggaran etika berat, atau bahaya keselamatan kerja (K3/Keamanan).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
