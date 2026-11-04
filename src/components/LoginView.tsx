import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Building2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  KeyRound,
  FileCheck2,
  CheckCircle2,
  RefreshCw,
  Laptop
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const {
    loginWithGoogle,
    loginAsStaff,
    setupSuperAdmin,
    availableUsers,
    isLoading: isAuthLoading
  } = useAuth();

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceSetupMode, setForceSetupMode] = useState<boolean | null>(null);

  // Setup form states (if no users exist yet or admin setup requested)
  const [setupName, setSetupName] = useState('Administrator HR');
  const [setupNik, setSetupNik] = useState('SJI-HR-001');
  const [setupEmail, setSetupEmail] = useState('syehansf@gmail.com');
  const [setupPin, setSetupPin] = useState('123456');
  const [setupDepartment, setSetupDepartment] = useState('HR');
  const [setupRole, setSetupRole] = useState<'hr_admin' | 'hr_lead'>('hr_admin');

  const showSetup = forceSetupMode !== null ? forceSetupMode : availableUsers.length === 0;

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailInput.trim()) {
      setErrorMsg('Masukkan email resmi atau NIK akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginAsStaff(emailInput.trim(), passwordInput);
      if (!res.success) {
        setErrorMsg(
          res.message ||
            'Akun tidak ditemukan atau PIN salah. Pastikan akun telah didaftarkan oleh Administrator HR.'
        );
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kendala saat login: ' + (err.message || 'Periksa koneksi jaringan.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!setupName.trim() || !setupEmail.trim()) {
      setErrorMsg('Lengkapi nama dan email untuk akun Administrator.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setupSuperAdmin(
        setupName.trim(),
        setupEmail.trim(),
        setupRole,
        setupPin.trim() || '123456',
        setupNik.trim() || 'SJI-HR-001',
        setupDepartment.trim() || 'HR'
      );
    } catch (err: any) {
      setErrorMsg('Gagal menginisialisasi akun admin: ' + (err.message || 'Periksa koneksi.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 select-none">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-lg border border-slate-200 mx-auto">
            <img
              src="/assets/aistudio/logo_sji-02_36d1cfb8.png"
              alt="Shoenary Javanesia Inc."
              className="h-11 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              HR Grievance Management System
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-1">
              Shoenary Javanesia Inc. • Portal Manajemen Pengaduan Karyawan &amp; Kepatuhan
            </p>
          </div>
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
            <span>AKSES TERBATAS: KHUSUS TIM HR &amp; PIC DEPARTEMEN</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          {/* Cloud Sync & Persistence Assurance */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed flex items-start space-x-2.5">
            <Laptop className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-blue-950 font-bold">Cloud Synchronization Aktif:</strong>
              Akun dan progres keluhan tersimpan di database cloud Firestore. Anda dapat login dari perangkat atau browser manapun tanpa kehilangan data.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Conditional: Initial Setup or Regular Login */}
          {showSetup ? (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span>Inisialisasi Akun Admin Cloud</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Daftarkan akun administrator pertama. Akun akan tersimpan permanen di cloud database.
                  </p>
                </div>
                {availableUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForceSetupMode(false)}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Batal
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateFirstAdmin} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Admin *</label>
                  <input
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Contoh: Syehan S."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Resmi *</label>
                  <input
                    type="email"
                    required
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="syehansf@gmail.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIK Admin</label>
                    <input
                      type="text"
                      value={setupNik}
                      onChange={(e) => setSetupNik(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      placeholder="SJI-HR-001"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PIN Akses Login *</label>
                    <input
                      type="text"
                      required
                      value={setupPin}
                      onChange={(e) => setSetupPin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                      placeholder="123456"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Role Awal *</label>
                    <select
                      value={setupRole}
                      onChange={(e) => setSetupRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="hr_admin">HR Admin (Full Access)</option>
                      <option value="hr_lead">HR Lead (Approval &amp; Audit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Departemen *</label>
                    <input
                      type="text"
                      value={setupDepartment}
                      onChange={(e) => setSetupDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      placeholder="HR"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Cloud...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan &amp; Masuk Sebagai Admin</span>
                    </>
                  )}
                </button>

                {availableUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForceSetupMode(false)}
                    className="w-full py-1 text-center text-xs text-slate-500 hover:text-slate-800"
                  >
                    Kembali ke Form Login
                  </button>
                )}
              </form>
            </div>
          ) : (
            /* Regular Sign-In Form */
            <div className="space-y-4">
              {/* Option 1: Google Corporate Login */}
              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isAuthLoading || isSubmitting}
                className="w-full py-2.5 px-4 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Akun Google Korporat</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 absolute">
                  Atau Login Email / NIK &amp; PIN
                </span>
              </div>

              {/* Option 2: Email / PIC Sign In */}
              <form onSubmit={handleStaffLogin} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Akun Resmi atau NIK Karyawan
                  </label>
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="nama@sji-corp.com atau NIK (misal: SJI-HR-001)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIN / Password Akses
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memverifikasi Akses...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard Sistem</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Personnel Picker from Firestore (Available accounts across devices) */}
              {availableUsers.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Akun Terdaftar di Cloud ({availableUsers.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setForceSetupMode(true)}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      + Tambah Admin
                    </button>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setEmailInput(u.email);
                          if (u.pin) setPasswordInput(u.pin);
                        }}
                        className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{u.displayName}</div>
                          <div className="text-[10px] text-slate-500">
                            {u.email} • {u.department} {u.employeeId ? `(NIK: ${u.employeeId})` : ''}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-blue-700 border border-slate-200">
                          {u.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Assurance */}
          <div className="pt-2 text-center text-[10px] text-slate-400 space-y-0.5">
            <p>Terhubung langsung ke Cloud Firestore. Akses tersimpan di riwayat audit.</p>
            <p>© 2026 PT Shoenary Javanesia Inc. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
