import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket, onSocket } from '../lib/socket';
import { UserProfile } from '../types';
import { SignOutConfirmModal } from '../components/common/SignOutConfirmModal';
import { ChangePasswordModal } from '../components/common/ChangePasswordModal';

/** Minimal identity of the signed-in user (kept for components that used Firebase's User). */
export interface CurrentUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  currentUser: CurrentUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<UserProfile>;
  registerStudent: (data: {
    fullName: string;
    email: string;
    pass: string;
    phone: string;
    qualification: string;
    qualificationDetail?: string;
    board?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  requestLogout: () => void;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateActivityTimestamp: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Restore the session from the httpOnly cookie.
  useEffect(() => {
    api
      .get<{ profile: UserProfile | null }>('/auth/me')
      .then(({ profile }) => setUserProfile(profile))
      .catch(() => setUserProfile(null))
      .finally(() => setLoading(false));
  }, []);

  // Live connection while signed in: profile changes (role, categories, status)
  // arrive over the socket; a 401 anywhere means the session ended.
  const uid = userProfile?.uid;
  useEffect(() => {
    if (!uid) {
      disconnectSocket();
      return;
    }
    connectSocket();
    const offProfile = onSocket<UserProfile>('profile:update', (profile) => {
      if (profile.uid === uid) setUserProfile(profile);
    });
    const onUnauthorized = () => setUserProfile(null);
    window.addEventListener('app:unauthorized', onUnauthorized);
    return () => {
      offProfile();
      window.removeEventListener('app:unauthorized', onUnauthorized);
    };
  }, [uid]);

  const login = useCallback(async (email: string, pass: string) => {
    const { profile } = await api.post<{ profile: UserProfile }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password: pass,
    });
    setUserProfile(profile);
    return profile;
  }, []);

  const registerStudent = useCallback<AuthContextType['registerStudent']>(async (data) => {
    const { profile } = await api.post<{ profile: UserProfile }>('/auth/register', {
      fullName: data.fullName,
      email: data.email,
      password: data.pass,
      phone: data.phone,
      qualification: data.qualification,
      qualificationDetail: data.qualificationDetail,
      board: data.board,
    });
    setUserProfile(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Signing out locally is enough if the server is unreachable.
    }
    disconnectSocket();
    setUserProfile(null);
  }, []);

  const resetPassword = useCallback(async (_email: string) => {
    throw new Error(
      'Password resets are handled by the Career Code team. Please contact your counselor or an administrator to reset your password.'
    );
  }, []);

  const refreshProfile = useCallback(async () => {
    const { profile } = await api.get<{ profile: UserProfile | null }>('/auth/me');
    setUserProfile(profile);
  }, []);

  const updateActivityTimestamp = useCallback(async () => {
    // Presence is tracked by the socket connection; nothing to do.
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
    setUserProfile((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  const currentUser = useMemo<CurrentUser | null>(
    () => (userProfile ? { uid: userProfile.uid, email: userProfile.email, displayName: userProfile.displayName } : null),
    [userProfile?.uid, userProfile?.email, userProfile?.displayName]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        login,
        registerStudent,
        logout,
        requestLogout: () => setIsLogoutConfirmOpen(true),
        resetPassword,
        refreshProfile,
        updateActivityTimestamp,
        changePassword,
      }}
    >
      {children}
      <SignOutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false);
          await logout();
        }}
        userName={userProfile?.displayName}
      />
      {userProfile?.mustChangePassword && <ChangePasswordModal forced onClose={() => {}} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
