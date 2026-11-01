import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { UserProfile } from '../types';
import { SignOutConfirmModal } from '../components/common/SignOutConfirmModal';

interface AuthContextType {
  currentUser: User | null;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'prep_titans_auth_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Sync profile on mount (Firebase Auth + persistent local session)
  useEffect(() => {
    let isMounted = true;

    // Check stored session first for instantaneous loading
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as UserProfile;
        if (parsed && parsed.uid && parsed.email) {
          setUserProfile(parsed);
          setCurrentUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.displayName,
          } as any);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      if (user) {
        setCurrentUser(user);
        await loadUserProfile(user.uid, user.email || '');
      } else {
        // If not in Firebase Auth state, check if we have an active local session
        const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession) as UserProfile;
            if (parsed && parsed.uid) {
              await loadUserProfile(parsed.uid, parsed.email);
            }
          } catch {
            setUserProfile(null);
            setCurrentUser(null);
          }
        } else {
          setUserProfile(null);
          setCurrentUser(null);
        }
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Real-time sync for current user profile (e.g. newly allotted categories or role adjustments)
  useEffect(() => {
    if (!userProfile?.uid) return;

    const unsub = onSnapshot(
      doc(db, 'users', userProfile.uid),
      (snap) => {
        if (snap.exists()) {
          const freshData = snap.data() as UserProfile;
          const merged: UserProfile = { ...freshData, uid: userProfile.uid };
          setUserProfile((prev) => {
            if (!prev) return merged;
            const catsChanged = JSON.stringify(prev.assignedCategories || []) !== JSON.stringify(merged.assignedCategories || []);
            const metaChanged = prev.displayName !== merged.displayName || prev.role !== merged.role || prev.status !== merged.status;
            if (catsChanged || metaChanged) {
              localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(merged));
              return merged;
            }
            return prev;
          });
        }
      },
      (err) => {
        console.warn('Real-time profile sync listener notice:', err);
      }
    );

    return () => unsub();
  }, [userProfile?.uid]);

  const loadUserProfile = async (uid: string, email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      let resolvedUid = uid;
      let userSnap = await getDoc(doc(db, 'users', resolvedUid));

      // If document with this UID doesn't exist, resolve by credentials or email
      if (!userSnap.exists() && cleanEmail) {
        // 1. Check credentials collection
        const cId = 'cred_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const credSnap = await getDoc(doc(db, 'credentials', cId));
        if (credSnap.exists()) {
          const credData = credSnap.data();
          if (credData.uid) {
            resolvedUid = credData.uid;
            userSnap = await getDoc(doc(db, 'users', resolvedUid));
          }
        }

        // 2. Check for mentoflux super admin bootstrap
        if (!userSnap.exists() && cleanEmail === 'mentoflux@gmail.com') {
          resolvedUid = 'admin_hamza_saif';
          userSnap = await getDoc(doc(db, 'users', 'admin_hamza_saif'));
        }

        // 3. Fallback: check users collection by email query
        if (!userSnap.exists()) {
          const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const qUsersSnap = await getDocs(qUsers);
          if (!qUsersSnap.empty) {
            const firstDoc = qUsersSnap.docs[0];
            resolvedUid = firstDoc.id;
            userSnap = firstDoc;
          }
        }
      }

      if (userSnap.exists()) {
        const rawProfile = userSnap.data() as UserProfile;
        const profile: UserProfile = {
          ...rawProfile,
          uid: resolvedUid,
        };

        if (profile.status === 'deactivated') {
          await signOut(auth);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setUserProfile(null);
          setCurrentUser(null);
          return;
        }

        setUserProfile(profile);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));

        // Mirror to users/uid if uid differs from resolvedUid so direct UID reads always succeed
        if (uid && uid !== resolvedUid) {
          await setDoc(doc(db, 'users', uid), profile, { merge: true }).catch(() => {});
        }

        // Update lastActiveAt and mark user online
        const now = Date.now();
        await updateDoc(doc(db, 'users', resolvedUid), { lastActiveAt: now, isOnline: true }).catch(() => {});
      } else {
        // Special bootstrap for Hamza Saif if brand new environment
        if (cleanEmail === 'mentoflux@gmail.com') {
          const now = Date.now();
          const superAdminProfile: UserProfile = {
            uid: 'admin_hamza_saif',
            email: 'mentoflux@gmail.com',
            displayName: 'Hamza Saif',
            role: 'super_admin',
            status: 'active',
            createdAt: now,
            lastActiveAt: now,
            professionalTitle: 'Executive Super Admin & Career Specialist',
            shortDescription: 'Lead Founder & Executive Super Admin for Career Guide by Prep Titans.',
          };
          await setDoc(doc(db, 'users', 'admin_hamza_saif'), superAdminProfile, { merge: true });
          await setDoc(doc(db, 'admins', 'admin_hamza_saif'), {
            role: 'super_admin',
            email: 'mentoflux@gmail.com',
            displayName: 'Hamza Saif',
          }, { merge: true });
          setUserProfile(superAdminProfile);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(superAdminProfile));
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Firebase Auth Client SDK first (if enabled in console)
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      // Resolve user profile using resolvedUid
      let resolvedUid = cred.user.uid;
      let snap = await getDoc(doc(db, 'users', resolvedUid));

      if (!snap.exists()) {
        const cId = 'cred_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const credSnap = await getDoc(doc(db, 'credentials', cId));
        if (credSnap.exists() && credSnap.data().uid) {
          resolvedUid = credSnap.data().uid;
          snap = await getDoc(doc(db, 'users', resolvedUid));
        }
      }

      if (snap.exists()) {
        const rawProfile = snap.data() as UserProfile;
        const profile: UserProfile = { ...rawProfile, uid: resolvedUid };
        if (profile.status === 'deactivated') {
          await signOut(auth);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          throw new Error('This account has been deactivated. Please contact the administrator.');
        }
        setUserProfile(profile);
        setCurrentUser({
          ...cred.user,
          uid: resolvedUid,
          email: profile.email,
          displayName: profile.displayName,
        } as any);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
        await updateDoc(doc(db, 'users', resolvedUid), { lastActiveAt: Date.now() }).catch(() => {});
        return profile;
      }
    } catch (sdkErr: any) {
      // If error is deactivated, throw directly
      if (sdkErr.message?.includes('deactivated')) {
        throw sdkErr;
      }
      // If wrong password or other, fall back to server credentials check
    }

    // 2. Call server-side authentication endpoint
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: pass }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.profile) {
      const profile = data.profile as UserProfile;
      setUserProfile(profile);
      setCurrentUser({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
      } as any);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    }

    throw new Error(data.error || 'Invalid email or password. Please verify your credentials.');
  };

  const registerStudent = async (data: {
    fullName: string;
    email: string;
    pass: string;
    phone: string;
    qualification: string;
    qualificationDetail?: string;
    board?: string;
  }): Promise<UserProfile> => {
    // Call server-side registration endpoint
    const res = await fetch('/api/auth/register-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        email: data.email,
        password: data.pass,
        phone: data.phone,
        qualification: data.qualification,
        qualificationDetail: data.qualificationDetail,
        board: data.board,
      }),
    });

    const resData = await res.json();
    if (!res.ok || !resData.success || !resData.profile) {
      throw new Error(resData.error || 'Registration failed. Please check your details and try again.');
    }

    const profile = resData.profile as UserProfile;
    setUserProfile(profile);
    setCurrentUser({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
    } as any);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    const targetUid = userProfile?.uid || currentUser?.uid;
    if (targetUid) {
      try {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, { isOnline: false, lastActiveAt: Date.now() }).catch(() => {});
      } catch {
        // Ignore
      }
    }
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setUserProfile(null);
    setCurrentUser(null);
  };

  // Real-time online heartbeat and tab presence
  useEffect(() => {
    if (!userProfile?.uid) return;

    const setPresence = (online: boolean) => {
      try {
        const userRef = doc(db, 'users', userProfile.uid);
        updateDoc(userRef, { isOnline: online, lastActiveAt: Date.now() }).catch(() => {});
      } catch {}
    };

    // Mark online immediately
    setPresence(true);

    // Heartbeat every 45s while user has tab active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setPresence(true);
      }
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPresence(true);
      } else {
        setPresence(false);
      }
    };

    const handleUnload = () => {
      setPresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      setPresence(false);
    };
  }, [userProfile?.uid]);

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // If native auth reset isn't active, notify user instructions
      throw new Error('Password reset instructions could not be delivered. Please contact support@preptitans.com.');
    }
  };

  const refreshProfile = async () => {
    if (userProfile) {
      await loadUserProfile(userProfile.uid, userProfile.email || '');
    }
  };

  const updateActivityTimestamp = async () => {
    if (userProfile) {
      try {
        const userRef = doc(db, 'users', userProfile.uid);
        await updateDoc(userRef, { lastActiveAt: Date.now(), isOnline: true }).catch(() => {});
      } catch {
        // Ignore
      }
    }
  };

  const requestLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const cancelLogout = () => {
    setIsLogoutConfirmOpen(false);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    await logout();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        login,
        registerStudent,
        logout,
        requestLogout,
        resetPassword,
        refreshProfile,
        updateActivityTimestamp,
      }}
    >
      {children}
      <SignOutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
        userName={userProfile?.displayName}
      />
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
