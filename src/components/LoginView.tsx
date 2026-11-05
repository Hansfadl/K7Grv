import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  Building2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  KeyRound,
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
  const [showSuperAdminInit, setShowSuperAdminInit] = useState(false);

  // Setup form states (Only for initial system bootstrap if 0 users exist)
  const [setupName, setSetupName] = useState('Administrator HR');
  const [setupNik, setSetupNik] = useState('SJI-HR-001');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPin, setSetupPin] = useState('123456');
  const [setupDepartment, setSetupDepartment] = useState('HR');

  const isBrandNewSystem = availableUsers.length === 0;

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailInput.trim()) {
      setErrorMsg('Masukkan email resmi atau NIK akun Anda.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMsg('Masukkan PIN akses login Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginAsStaff(emailInput.trim(), passwordInput.trim());
      if (!res.success) {
        setErrorMsg(
          res.message ||
            'Kredensial tidak valid atau akun belum terdaftar. Pastikan Administrator HR telah mendaftarkan akun Anda.'
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
      setErrorMsg('Lengkapi nama dan email untuk akun Administrator HR.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setupSuperAdmin(
        setupName.trim(),
        setupEmail.trim(),
        'hr_admin',
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
      {/* Background Decorative Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-5">
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
              PT Shoenary Javanesia Inc. • Portal Resmi Manajemen Keluhan &amp; Kepatuhan
            </p>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
            <span>PORTAL TERTUTUP: KHUSUS TIM HR &amp; PIC DEPARTEMEN</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
          {/* Security Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900 font-bold">Otorisasi Terpusat Cloud Firestore:</strong>
              Data kasus dan kredensial tersimpan secara persisten di database cloud. Setiap akun personil harus didaftarkan oleh Administrator HR.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* If 0 users in database or initial admin setup toggle */}
          {isBrandNewSystem || showSuperAdminInit ? (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span>Inisialisasi Administrator HR Utama</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Database cloud belum memiliki personil. Daftarkan administrator pertama.
                  </p>
                </div>
                {!isBrandNewSystem && (
                  <button
                    type="button"
                    onClick={() => setShowSuperAdminInit(false)}
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      placeholder="SJI-HR-001"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PIN Akses *</label>
                    <input
                      type="password"
                      required
                      value={setupPin}
                      onChange={(e) => setSetupPin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                      placeholder="••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departemen</label>
                  <input
                    type="text"
                    value={setupDepartment}
                    onChange={(e) => setSetupDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Cloud Firestore...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Inisialisasi Akun Admin</span>
                    </>
                  )}
                </button>
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
                className="w-full py-2.5 px-4 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center justify-center space-x-2"
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
                <span>Masuk dengan Google (Akun Korporat)</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 absolute">
                  Atau Masuk dengan Email / NIK &amp; PIN
                </span>
              </div>

              {/* Option 2: Email / NIK & Password */}
              <form onSubmit={handleStaffLogin} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Resmi atau NIK Karyawan *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="nama@sji.co.id atau NIK (misal: SJI-HR-001)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIN / Password Akses *
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
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
            </div>
          )}

          {/* Privacy & Compliance Footer */}
          <div className="pt-2 text-center text-[10px] text-slate-400 space-y-0.5 border-t border-slate-100">
            <p>Akses tercatat dan diawasi oleh Departemen Kepatuhan Internal.</p>
            <p>© 2026 PT Shoenary Javanesia Inc. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
