import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole, MasterDepartment } from '../types';
import { INITIAL_DEPARTMENTS } from '../services/mockData';
import { getDepartments } from '../services/db';
import {
  Users,
  Plus,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Search,
  Phone,
  Lock,
  RefreshCw,
  Copy,
  CheckCircle2,
  Building2,
  UserCheck,
  Clock
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { availableUsers, currentUser, addUser, updateUser, deleteUser } = useAuth();
  const [departments, setDepartments] = useState<MasterDepartment[]>(INITIAL_DEPARTMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Visible PIN state for privacy in directory
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State for Provisioning / Editing
  const [formData, setFormData] = useState({
    displayName: '',
    employeeId: '',
    email: '',
    role: 'department_pic' as UserRole,
    departmentSelect: 'HR',
    customDepartment: '',
    isCustomDept: false,
    pin: '123456',
    phoneNumber: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [showFormPin, setShowFormPin] = useState(false);

  useEffect(() => {
    getDepartments().then((depts) => {
      if (depts && depts.length > 0) {
        setDepartments(depts);
      }
    });
  }, []);

  const resetForm = () => {
    setFormData({
      displayName: '',
      employeeId: '',
      email: '',
      role: 'department_pic',
      departmentSelect: departments[0]?.name || 'HR',
      customDepartment: '',
      isCustomDept: false,
      pin: '123456',
      phoneNumber: '',
      status: 'active',
    });
    setFormError(null);
    setShowFormPin(false);
  };

  const openAddModal = () => {
    resetForm();
    setEditingUser(null);
    setShowAddModal(true);
  };

  const openEditModal = (user: UserProfile) => {
    const isCustom = !departments.some((d) => d.name === user.department);
    setFormData({
      displayName: user.displayName,
      employeeId: user.employeeId || '',
      email: user.email,
      role: user.role,
      departmentSelect: isCustom ? '__custom__' : user.department,
      customDepartment: isCustom ? user.department : '',
      isCustomDept: isCustom,
      pin: user.pin || '123456',
      phoneNumber: user.phoneNumber || '',
      status: user.status,
    });
    setEditingUser(user);
    setFormError(null);
    setShowFormPin(false);
    setShowAddModal(true);
  };

  const generateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData((prev) => ({ ...prev, pin: randomPin }));
  };

  const handleDepartmentChange = (val: string) => {
    if (val === '__custom__') {
      setFormData((prev) => ({ ...prev, departmentSelect: '__custom__', isCustomDept: true }));
    } else {
      setFormData((prev) => ({
        ...prev,
        departmentSelect: val,
        isCustomDept: false,
        customDepartment: '',
      }));
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.displayName.trim()) {
      setFormError('Nama lengkap personil wajib diisi.');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email korporat personil wajib diisi.');
      return;
    }

    const finalDepartment = formData.isCustomDept
      ? formData.customDepartment.trim() || 'Others'
      : formData.departmentSelect;

    const cleanEmail = formData.email.trim().toLowerCase();

    // Check duplicate email
    const duplicate = availableUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail && (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      setFormError(`Email "${cleanEmail}" sudah digunakan oleh personil lain (${duplicate.displayName}).`);
      return;
    }

    if (editingUser) {
      // Update existing user
      await updateUser(editingUser.id, {
        displayName: formData.displayName.trim(),
        employeeId: formData.employeeId.trim() || undefined,
        email: cleanEmail,
        role: formData.role,
        department: finalDepartment,
        pin: formData.pin.trim() || '123456',
        phoneNumber: formData.phoneNumber.trim() || undefined,
        status: formData.status,
      });
    } else {
      // Add new user
      await addUser({
        displayName: formData.displayName.trim(),
        employeeId: formData.employeeId.trim() || undefined,
        email: cleanEmail,
        role: formData.role,
        department: finalDepartment,
        pin: formData.pin.trim() || '123456',
        phoneNumber: formData.phoneNumber.trim() || undefined,
        status: formData.status,
      });
    }

    setShowAddModal(false);
    resetForm();
  };

  const togglePinReveal = (id: string) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPinToClipboard = (pin: string, id: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    await updateUser(user.id, { status: nextStatus });
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  // Filtered users
  const filteredUsers = availableUsers.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'hr_admin':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            HR ADMIN
          </span>
        );
      case 'hr_investigator':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            INVESTIGATOR
          </span>
        );
      case 'department_pic':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            DEPARTMENT PIC
          </span>
        );
      case 'hr_lead':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            HR LEAD
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
            STAFF
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">User Management &amp; Access Directory</h2>
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {availableUsers.length} Personil Terdaftar
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftarkan personil secara mandiri: tentukan nama, NIK, email, departemen, role otorisasi, dan PIN akses login
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Authorized Staff</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="p-3 bg-slate-900 text-slate-300 border border-slate-800 rounded-xl text-xs flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block">Akses Sistem Tertutup (Strict Access Control):</span>
          Sistem ini tidak dibuka untuk registrasi publik. Hanya personil resmi yang ditambahkan secara mandiri oleh HR Admin pada halaman ini yang dapat login menggunakan email dan PIN yang telah ditetapkan.
        </div>
      </div>

      {/* Direktori Personil */}
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama, email, NIK, atau departemen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Semua Role' },
                { id: 'hr_admin', label: 'HR Admin' },
                { id: 'hr_investigator', label: 'Investigator' },
                { id: 'department_pic', label: 'Dept PIC' },
                { id: 'hr_lead', label: 'HR Lead' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    roleFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <th className="py-3 px-4">Personil (Nama &amp; NIK)</th>
                  <th className="py-3 px-4">Kontak Resmi</th>
                  <th className="py-3 px-4">Tingkat Akses (Role)</th>
                  <th className="py-3 px-4">Departemen</th>
                  <th className="py-3 px-4">PIN Akses Login</th>
                  <th className="py-3 px-4">Akses Terakhir &amp; Perangkat</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="max-w-sm mx-auto space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-700">Belum ada personil yang sesuai</p>
                    <p className="text-[11px] text-slate-400">
                      Gunakan tombol <strong>'+ Provision Authorized Staff'</strong> untuk menambahkan akun PIC departemen atau tim HR secara mandiri.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isPinRevealed = !!revealedPins[u.id];
                const displayPin = u.pin || '123456';
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    {/* Personil */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            NIK: {u.employeeId || '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700 font-mono text-[11px]">{u.email}</div>
                      {u.phoneNumber && (
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{u.phoneNumber}</span>
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-800">{u.department}</span>
                      </div>
                    </td>

                    {/* PIN Display */}
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-200">
                        <KeyRound className="w-3 h-3 text-slate-500" />
                        <span className="font-mono font-bold text-slate-900 tracking-wider text-[11px]">
                          {isPinRevealed ? displayPin : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePinReveal(u.id)}
                          title={isPinRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                          className="p-0.5 text-slate-500 hover:text-slate-800"
                        >
                          {isPinRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyPinToClipboard(displayPin, u.id)}
                          title="Salin PIN ke clipboard"
                          className="p-0.5 text-slate-500 hover:text-blue-600"
                        >
                          {copiedId === u.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Akses Terakhir & Perangkat */}
                    <td className="py-3 px-4">
                      {u.lastLoginAt ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 text-[11px] flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>
                              {new Date(u.lastLoginAt).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          <div
                            className="text-[10px] text-slate-500 truncate max-w-[140px]"
                            title={u.lastLoginDevice || 'Web Browser'}
                          >
                            {u.lastLoginDevice || 'Web Browser'}
                          </div>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {u.loginCount || 1}x login
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Belum pernah login</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold transition ${
                          u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{u.status === 'active' ? 'Active' : 'Revoked'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit Personil"
                          className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          title="Hapus Akun"
                          className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {/* Provision / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span>{editingUser ? 'Edit Data Personil' : 'Provision New Authorized User'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan data akun dan kredensial personil secara mandiri
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              {/* Row 1: Name & NIK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lengkap Personil *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Contoh: Syehan S."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Induk Karyawan (NIK)
                  </label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="Contoh: SJI-2024-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Resmi Korporat *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nama@sji.co.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Telepon / WhatsApp (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="0812-3456-7890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Role & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tingkat Akses (Role) *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="hr_admin">HR Admin (Akses Penuh Seluruh Modul)</option>
                    <option value="hr_investigator">HR Investigator (Penyelidikan &amp; RCA)</option>
                    <option value="department_pic">Department PIC (Dibatasi Kasus Dept)</option>
                    <option value="hr_lead">HR Lead (Kepala HR / Otorisasi)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Departemen Terkait *
                  </label>
                  <select
                    value={formData.departmentSelect}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    <option value="__custom__">+ Input Departemen Lain Secara Manual...</option>
                  </select>
                </div>
              </div>

              {/* Custom Department Free-Text (if selected) */}
              {formData.isCustomDept && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <label className="block font-semibold text-blue-900">
                    Ketik Nama Departemen Secara Bebas:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customDepartment}
                    onChange={(e) => setFormData({ ...formData, customDepartment: e.target.value })}
                    placeholder="Contoh: Quality Assurance / Cutting / Maintenance"
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Row 4: PIN Akses Login & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center space-x-1">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      <span>PIN Akses Login *</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPin}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                      <span>Acak PIN</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showFormPin ? 'text' : 'password'}
                      required
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      placeholder="Contoh: 123456"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPin(!showFormPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showFormPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan 6 angka atau kata sandi yang mudah diingat untuk login.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Status Akun Otorisasi
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="active">Active (Diberikan Akses Masuk)</option>
                    <option value="inactive">Inactive / Revoked (Akses Dinonaktifkan)</option>
                  </select>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingUser ? 'Simpan Perubahan' : 'Daftarkan Personil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Hapus Akun Personil?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda akan menghapus akses untuk <strong>{userToDelete.displayName}</strong> ({userToDelete.email}).
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
