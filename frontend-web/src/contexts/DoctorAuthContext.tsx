import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  getToken,
  getStoredUser,
  getMe,
  getDoctorProfile,
  logoutDoctor,
  type DoctorUser,
  type DoctorProfile,
} from '@/services/doctorApi';

interface DoctorAuthState {
  user: DoctorUser | null;
  doctorProfile: DoctorProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  profileComplete: boolean;
  refreshUser: () => Promise<void>;
  setAuthFromLogin: (user: DoctorUser) => void;
  signOut: () => void;
}

const DoctorAuthContext = createContext<DoctorAuthState | null>(null);

export function DoctorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DoctorUser | null>(getStoredUser);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      try {
        const profile = await getDoctorProfile();
        setDoctorProfile(profile);
      } catch {
        setDoctorProfile(null);
      }
    } catch {
      setUser(null);
      setDoctorProfile(null);
    }
  }, []);

  const setAuthFromLogin = useCallback((loggedUser: DoctorUser) => {
    setUser(loggedUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    const stored = getStoredUser();
    if (stored && !user) {
      setUser(stored);
    }
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const signOut = useCallback(() => {
    logoutDoctor();
  }, []);

  return (
    <DoctorAuthContext.Provider
      value={{
        user,
        doctorProfile,
        loading,
        isAuthenticated: !!user && !!getToken(),
        profileComplete: user?.profileComplete !== false,
        refreshUser,
        setAuthFromLogin,
        signOut,
      }}
    >
      {children}
    </DoctorAuthContext.Provider>
  );
}

export function useDoctorAuth() {
  const ctx = useContext(DoctorAuthContext);
  if (!ctx) throw new Error('useDoctorAuth must be inside DoctorAuthProvider');
  return ctx;
}
