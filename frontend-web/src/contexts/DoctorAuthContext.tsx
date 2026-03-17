import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
  // ── Inicialização síncrona a partir do localStorage ──
  // Isso garante que no PRIMEIRO RENDER já temos user e token,
  // sem depender de nenhum useEffect assíncrono.
  const [user, setUser] = useState<DoctorUser | null>(() => getStoredUser());
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  // MUDANÇA CRÍTICA: loading começa como TRUE apenas se tem token mas NÃO tem user cached.
  // Se já tem ambos (token + user no localStorage), loading começa FALSE — sem flash.
  const [loading, setLoading] = useState(() => {
    const hasToken = !!getToken();
    const hasUser = !!getStoredUser();
    // Se tem token E user cached → já podemos renderizar (loading = false)
    // Se tem token mas NÃO tem user → precisa esperar getMe() (loading = true)
    // Se NÃO tem token → não autenticado (loading = false)
    return hasToken && !hasUser;
  });

  // Guard contra múltiplos refreshes simultâneos e StrictMode double-mount
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);

  const refreshUser = useCallback(async () => {
    if (refreshingRef.current) return;
    if (!getToken()) return;

    refreshingRef.current = true;
    try {
      const me = await getMe();
      if (mountedRef.current) {
        setUser(me);
      }

      try {
        const profile = await getDoctorProfile();
        if (mountedRef.current) setDoctorProfile(profile);
      } catch {
        if (mountedRef.current) setDoctorProfile(null);
      }
    } catch {
      // MUDANÇA: Só zera user se o token foi removido (pelo authFetch no 401).
      // Se o token ainda existe, foi erro de rede — manter user cached.
      if (mountedRef.current) {
        if (!getToken()) {
          setUser(null);
          setDoctorProfile(null);
        }
        // Se token ainda existe → manter user do localStorage (erro de rede/timeout)
      }
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const setAuthFromLogin = useCallback((loggedUser: DoctorUser) => {
    setUser(loggedUser);
    setLoading(false);
    // Buscar profile em background
    getDoctorProfile()
      .then((p) => { if (mountedRef.current) setDoctorProfile(p); })
      .catch(() => { if (mountedRef.current) setDoctorProfile(null); });
  }, []);

  // ── Effect de inicialização ──
  useEffect(() => {
    mountedRef.current = true;

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Refresh em background — NÃO bloqueia a renderização se já temos user cached
    refreshUser().finally(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [refreshUser]);

  // ── Listener para auth expirado (disparado pelo authFetch no 401) ──
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setDoctorProfile(null);
      setLoading(false);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const signOut = useCallback(() => {
    logoutDoctor();
  }, []);

  // ── isAuthenticated: usa user E token (ambos devem existir) ──
  const isAuthenticated = !!user && !!getToken();

  return (
    <DoctorAuthContext.Provider
      value={{
        user,
        doctorProfile,
        loading,
        isAuthenticated,
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
