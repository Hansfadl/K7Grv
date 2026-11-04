import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  subscribeToUsers,
  saveUser,
  deleteUserFromDb,
  recordUserLogin,
  logAuditAction,
  getDeviceSummary
} from '../services/db';

interface AuthContextType {
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  switchUser: (userId: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsStaff: (email: string, pin?: string) => Promise<{ success: boolean; message?: string }>;
  addUser: (userData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<UserProfile>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  setupSuperAdmin: (
    name: string,
    email: string,
    role?: 'hr_admin' | 'hr_lead',
    pin?: string,
    employeeId?: string,
    department?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  confidentialMode: boolean;
  toggleConfidentialMode: () => void;
  canRegisterCase: boolean;
  canDeleteCase: boolean;
  canInvestigate: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canManageMasterData: boolean;
  canExport: boolean;
  isPic: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [confidentialMode, setConfidentialMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // 1. Subscribe to real-time Users list from Firestore
    // This guarantees that any user added or updated on ANY device is instantly reflected everywhere.
    const unsubscribeUsers = subscribeToUsers((users) => {
      setAvailableUsers(users || []);

      const savedUserId = localStorage.getItem('sji_active_user_id');
      if (savedUserId && users.length > 0) {
        const match = users.find((u) => u.id === savedUserId);
        if (match) {
          // If user exists and is active, keep active session synchronized with latest profile
          if (match.status === 'active') {
            setCurrentUser(match);
          } else {
            // Revoked access
            setCurrentUser(null);
            localStorage.removeItem('sji_active_user_id');
          }
        }
      }
    });

    // 2. Listen to Firebase Google Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (fbUser) {
        const email = (fbUser.email || '').toLowerCase();
        // Wait briefly for availableUsers or fetch
        const match = availableUsers.find((u) => u.email.toLowerCase() === email);

        if (match) {
          if (match.status === 'active') {
            await recordUserLogin(match, getDeviceSummary());
            setCurrentUser(match);
            localStorage.setItem('sji_active_user_id', match.id);
          }
        } else if (email) {
          // Provision verified corporate user on first Google login
          const newUser: UserProfile = {
            id: fbUser.uid,
            email: email,
            displayName: fbUser.displayName || 'Authorized HR Officer',
            role: 'hr_admin',
            department: 'HR',
            status: 'active',
            avatarUrl: fbUser.photoURL || undefined,
            createdAt: new Date().toISOString().substring(0, 10),
            lastLoginAt: new Date().toISOString(),
            lastLoginDevice: getDeviceSummary(),
            loginCount: 1,
          };
          await saveUser(newUser);
          await recordUserLogin(newUser, getDeviceSummary());
          setCurrentUser(newUser);
          localStorage.setItem('sji_active_user_id', newUser.id);
        }
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAuth();
    };
  }, [availableUsers.length]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const email = (res.user.email || '').toLowerCase();
        const existing = availableUsers.find((u) => u.email.toLowerCase() === email);
        if (existing) {
          await recordUserLogin(existing, getDeviceSummary());
          setCurrentUser(existing);
          localStorage.setItem('sji_active_user_id', existing.id);
        } else {
          const newUser: UserProfile = {
            id: res.user.uid,
            email,
            displayName: res.user.displayName || 'Authorized HR Officer',
            role: 'hr_admin',
            department: 'HR',
            status: 'active',
            avatarUrl: res.user.photoURL || undefined,
            createdAt: new Date().toISOString().substring(0, 10),
            lastLoginAt: new Date().toISOString(),
            lastLoginDevice: getDeviceSummary(),
            loginCount: 1,
          };
          await saveUser(newUser);
          await recordUserLogin(newUser, getDeviceSummary());
          setCurrentUser(newUser);
          localStorage.setItem('sji_active_user_id', newUser.id);
        }
      }
    } catch (error: any) {
      console.warn('Google sign-in completed or dialog closed:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsStaff = async (email: string, pin?: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const match = availableUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail || (u.employeeId && u.employeeId.toLowerCase() === cleanEmail)
    );

    if (!match) {
      return {
        success: false,
        message: 'Akun dengan email / NIK tersebut belum terdaftar di sistem cloud SJI. Pastikan admin telah mendaftarkan akun Anda.',
      };
    }
    if (match.status !== 'active') {
      return {
        success: false,
        message: 'Akses akun ini sedang dinonaktifkan (Revoked) oleh HR Administrator.',
      };
    }

    // Verify PIN if the account has a PIN set
    if (match.pin && match.pin.trim() !== '') {
      if (!pin || pin.trim() === '') {
        return {
          success: false,
          message: 'Akun ini memerlukan PIN akses login. Silakan masukkan PIN 6-digit Anda.',
        };
      }
      if (match.pin.trim() !== pin.trim()) {
        return {
          success: false,
          message: 'PIN otorisasi salah. Periksa kembali PIN akses akun Anda.',
        };
      }
    }

    // Record login into Firestore (tracks who accessed it, when, and from what device)
    const device = getDeviceSummary();
    await recordUserLogin(match, device);

    setCurrentUser(match);
    localStorage.setItem('sji_active_user_id', match.id);

    return { success: true };
  };

  const setupSuperAdmin = async (
    name: string,
    email: string,
    role: 'hr_admin' | 'hr_lead' = 'hr_admin',
    pin: string = '123456',
    employeeId: string = 'SJI-HR-001',
    department: string = 'HR'
  ) => {
    const device = getDeviceSummary();
    const newAdmin: UserProfile = {
      id: `usr-admin-${Date.now().toString(36)}`,
      displayName: name,
      email: email.toLowerCase(),
      role,
      department,
      employeeId,
      pin,
      status: 'active',
      createdAt: new Date().toISOString().substring(0, 10),
      lastLoginAt: new Date().toISOString(),
      lastLoginDevice: device,
      loginCount: 1,
    };

    // Save directly to Firestore cloud database so ALL devices recognize this admin immediately
    await saveUser(newAdmin);
    await recordUserLogin(newAdmin, device);

    setCurrentUser(newAdmin);
    localStorage.setItem('sji_active_user_id', newAdmin.id);

    await logAuditAction({
      userId: newAdmin.id,
      userName: newAdmin.displayName,
      userRole: newAdmin.role,
      action: 'SYSTEM_BOOTSTRAP_ADMIN',
      details: `Inisialisasi akun Administrator Pertama di cloud Firestore: ${name} (${email}, Role: ${role}, NIK: ${employeeId}). Perangkat: ${device}.`,
      device,
    });
  };

  const addUser = async (userData: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> => {
    const created: UserProfile = {
      ...userData,
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString().substring(0, 10),
      loginCount: 0,
    };

    // Save directly to Firestore
    await saveUser(created);

    if (currentUser) {
      await logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: 'PROVISION_AUTHORIZED_USER',
        details: `Menambahkan akses personil baru: ${created.displayName} (${created.role} - ${created.department}, NIK: ${created.employeeId || '-'}).`,
        device: getDeviceSummary(),
      });
    }
    return created;
  };

  const updateUser = async (userId: string, updates: Partial<UserProfile>) => {
    const existing = availableUsers.find((u) => u.id === userId);
    if (!existing) return;

    const merged = { ...existing, ...updates };
    await saveUser(merged);

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(merged);
    }

    if (currentUser) {
      await logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: 'UPDATE_AUTHORIZED_USER',
        details: `Memperbarui profil personil: ${existing.displayName} (${userId}). Perubahan: ${Object.keys(updates).join(', ')}.`,
        device: getDeviceSummary(),
      });
    }
  };

  const deleteUser = async (userId: string) => {
    const toDelete = availableUsers.find((u) => u.id === userId);
    await deleteUserFromDb(userId);

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(null);
      localStorage.removeItem('sji_active_user_id');
    }

    if (currentUser) {
      await logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: 'DELETE_AUTHORIZED_USER',
        details: `Menghapus akun personil: ${toDelete?.displayName || userId}.`,
        device: getDeviceSummary(),
      });
    }
  };

  const switchUser = async (userId: string) => {
    const selected = availableUsers.find((u) => u.id === userId);
    if (selected && selected.status === 'active') {
      const device = getDeviceSummary();
      await recordUserLogin(selected, device);
      setCurrentUser(selected);
      localStorage.setItem('sji_active_user_id', selected.id);
    }
  };

  const logout = async () => {
    const current = currentUser;
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      console.warn('Firebase sign-out:', err.message);
    }
    if (current) {
      await logAuditAction({
        userId: current.id,
        userName: current.displayName,
        userRole: current.role,
        action: 'USER_LOGOUT',
        details: `Pengguna ${current.displayName} logout dari sistem.`,
        device: getDeviceSummary(),
      });
    }
    setCurrentUser(null);
    localStorage.removeItem('sji_active_user_id');
  };

  const toggleConfidentialMode = () => {
    setConfidentialMode((prev) => !prev);
    if (currentUser) {
      logAuditAction({
        userId: currentUser.id,
        userName: currentUser.displayName,
        userRole: currentUser.role,
        action: !confidentialMode ? 'ENABLE_CONFIDENTIAL_MASK' : 'REVEAL_CONFIDENTIAL_DATA',
        details: `User toggled confidential whistleblower masking to ${!confidentialMode ? 'PROTECTED' : 'UNMASKED'}.`,
        device: getDeviceSummary(),
      });
    }
  };

  // RBAC Permission checks
  const role = currentUser?.role;
  const canRegisterCase = role === 'hr_admin';
  const canDeleteCase = role === 'hr_admin' || role === 'hr_lead';
  const canInvestigate = role === 'hr_investigator' || role === 'hr_admin';
  const canApprove = role === 'hr_lead' || role === 'hr_admin';
  const canManageUsers = role === 'hr_admin';
  const canManageMasterData = role === 'hr_admin';
  const canExport = role === 'hr_admin' || role === 'hr_lead' || role === 'hr_investigator';
  const isPic = role === 'department_pic';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        availableUsers,
        switchUser,
        loginWithGoogle,
        loginAsStaff,
        addUser,
        updateUser,
        deleteUser,
        setupSuperAdmin,
        logout,
        confidentialMode,
        toggleConfidentialMode,
        canRegisterCase,
        canDeleteCase,
        canInvestigate,
        canApprove,
        canManageUsers,
        canManageMasterData,
        canExport,
        isPic,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
