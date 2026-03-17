import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api-client';
import { AUTH_TOKEN_KEY } from '../lib/constants/storage-keys';
import { getSecureItem, setSecureItem, removeSecureItem } from '../lib/secure-storage';
import { unregisterPushToken } from '../lib/api';
import { getLastRegisteredPushToken, setLastRegisteredPushToken } from '../lib/pushTokenRegistry';
import { UserDto, UserRole, AuthResponseDto, DoctorProfileDto } from '../types/database';

interface AuthContextType {
  user: UserDto | null;
  doctorProfile: DoctorProfileDto | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserDto>;
  signUp: (data: SignUpData) => Promise<UserDto>;
  signUpDoctor: (data: DoctorSignUpData) => Promise<{ user: UserDto; requiresApproval: boolean }>;
  signInWithGoogle: (googleToken: string, role?: UserRole) => Promise<UserDto>;
  signOut: () => Promise<void>;
  cancelRegistration: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshDoctorProfile: () => Promise<void>;
  completeProfile: (data: CompleteProfileData) => Promise<UserDto>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  cpf: string;
  birthDate?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface DoctorSignUpData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  cpf: string;
  crm: string;
  crmState: string;
  specialty: string;
  birthDate?: string;
  bio?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  professionalAddress?: string;
  professionalPhone?: string;
  professionalPostalCode?: string;
  professionalStreet?: string;
  professionalNumber?: string;
  professionalNeighborhood?: string;
  professionalComplement?: string;
  professionalCity?: string;
  professionalState?: string;
  university?: string;
  courses?: string;
  hospitalsServices?: string;
}

interface CompleteProfileData {
  phone?: string;
  cpf?: string;
  birthDate?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  crm?: string;
  crmState?: string;
  specialty?: string;
  bio?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = '@renoveja:user';
const DOCTOR_PROFILE_KEY = '@renoveja:doctor_profile';
export const FORBIDDEN_MESSAGE_KEY = '@renoveja:forbidden_message';

/** AsyncStorage não aceita undefined/null; usa setItem só se tiver valor, senão removeItem. */
async function setItemSafe(key: string, value: string | undefined | null): Promise<void> {
  if (value != null && value !== '') {
    await AsyncStorage.setItem(key, value);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  // FIX M11: ref to abort background /me validation on unmount
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadStoredUser();
    return () => { activeControllerRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  // Timeout de segurança: se após 1,2s ainda estiver loading, libera a tela (evita loading infinito ao escanear QR)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading((prev) => (prev ? false : prev));
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  const loadStoredUser = async () => {
    // Fallback: se AsyncStorage travar, libera a tela em no máximo 1,5s
    const guard = setTimeout(() => setLoading(false), 3500);
    try {
      // FIX M1: Use secure storage for auth token (auto-migrates from AsyncStorage)
      const storedToken = await getSecureItem(AUTH_TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const storedDoctorProfile = await AsyncStorage.getItem(DOCTOR_PROFILE_KEY);

      if (storedToken && storedUser) {
        apiClient.setTokenCache(storedToken);
        let parsedUser: UserDto;
        let parsedDoctorProfile: DoctorProfileDto | null = null;
        try {
          parsedUser = JSON.parse(storedUser) as UserDto;
          if (storedDoctorProfile) {
            parsedDoctorProfile = JSON.parse(storedDoctorProfile) as DoctorProfileDto | null;
          }
        } catch {
          clearTimeout(guard);
          await clearAuth();
          setLoading(false);
          return;
        }

        // PERF: mostra o app IMEDIATAMENTE com dados do cache (optimistic startup).
        // A validação do token ocorre em background — elimina tela branca de 200-600ms.
        clearTimeout(guard);
        setUser(parsedUser);
        if (parsedDoctorProfile) setDoctorProfile(parsedDoctorProfile);
        setLoading(false);

        // Valida token em background — não bloqueia a UI
        // FIX M11: store controller ref so we can abort on unmount/re-run
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        // Save ref for cleanup (loadStoredUser is called from useEffect)
        activeControllerRef.current = controller;
        apiClient.get<UserDto>('/api/auth/me', undefined, { signal: controller.signal })
          .then(async (currentUser) => {
            clearTimeout(timeoutId);
            // Atualiza silenciosamente com dados frescos do servidor
            setUser(currentUser);
            await setItemSafe(USER_KEY, currentUser ? JSON.stringify(currentUser) : undefined);
            // BUG FIX: buscar doctor profile fresco do servidor em vez de reutilizar cache velho
            if (currentUser.role === 'doctor') {
              try {
                const freshProfile = await apiClient.get<DoctorProfileDto | null>('/api/doctors/me');
                if (freshProfile) {
                  setDoctorProfile(freshProfile);
                  await setItemSafe(DOCTOR_PROFILE_KEY, JSON.stringify(freshProfile));
                }
              } catch {
                // Falha ao buscar profile: manter o cache existente
                if (parsedDoctorProfile) setDoctorProfile(parsedDoctorProfile);
              }
            }
          })
          .catch((err: unknown) => {
            clearTimeout(timeoutId);
            const status = (err as { status?: number })?.status;
            const isAborted = err instanceof Error && err.name === 'AbortError';
            if (status === 401 || status === 403) {
              // Token inválido ou expirado: desloga
              clearAuth();
            } else if (!isAborted) {
              // Falha de rede ou 5xx — mantém sessão cacheada (já está exibindo)
              if (__DEV__) console.warn('[AuthContext] Validação bg falhou (rede/servidor), mantendo sessão em cache:', err);
            }
            // AbortError (timeout 6s) → mantém sessão cacheada silenciosamente
          });
        return;
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading stored user:', error);
      await clearAuth();
    } finally {
      clearTimeout(guard);
    }
    setLoading(false);
  };

  const clearAuth = useCallback(async () => {
    try {
      apiClient.clearTokenCache();
      // FIX M1: Remove token from secure storage (and legacy AsyncStorage)
      await removeSecureItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
    } catch (e) {
      if (__DEV__) console.warn('AsyncStorage removeItem error:', e);
    }
    setUser(null);
    setDoctorProfile(null);
  }, []);

  useEffect(() => {
    let lastClearAt = 0;
    const UNAUTHORIZED_DEBOUNCE_MS = 2000;
    apiClient.setOnUnauthorized(() => {
      const now = Date.now();
      if (now - lastClearAt < UNAUTHORIZED_DEBOUNCE_MS) return;
      lastClearAt = now;
      clearAuth();
    });
    apiClient.setOnForbidden(async (message) => {
      if (message) {
        try {
          await AsyncStorage.setItem(FORBIDDEN_MESSAGE_KEY, message);
        } catch {}
      }
      clearAuth();
    });
    return () => {
      apiClient.setOnUnauthorized(null);
      apiClient.setOnForbidden(null);
    };
  }, [clearAuth]);

  const signIn = useCallback(async (email: string, password: string): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/login', { email, password });
      if (!response?.user) throw new Error('Resposta inválida do servidor. Tente novamente.');
      if (response.token == null || response.token === '') throw new Error('Servidor não retornou token de acesso. Tente novamente.');
      await setSecureItem(AUTH_TOKEN_KEY, response.token);
      apiClient.setTokenCache(response.token);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));
      if (response.doctorProfile) {
        await setItemSafe(DOCTOR_PROFILE_KEY, JSON.stringify(response.doctorProfile));
        setDoctorProfile(response.doctorProfile);
      } else {
        await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
      }
      setUser(response.user);
      return response.user;
    } catch (error: unknown) {
      if (__DEV__) console.error('Sign in error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao fazer login');
    }
  }, []);

  const signUp = useCallback(async (data: SignUpData): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/register', {
        name: data.name, email: data.email, password: data.password, confirmPassword: data.confirmPassword,
        phone: data.phone, cpf: data.cpf, birthDate: data.birthDate, street: data.street, number: data.number,
        neighborhood: data.neighborhood, complement: data.complement, city: data.city, state: data.state, postalCode: data.postalCode,
      });
      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      // BUG FIX: validar que o token não é nulo/vazio (mesma verificação que signIn)
      if (response.token == null || response.token === '') throw new Error('Servidor não retornou token de acesso. Tente novamente.');
      await setSecureItem(AUTH_TOKEN_KEY, response.token);
      apiClient.setTokenCache(response.token);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
      return response.user;
    } catch (error: unknown) {
      if (__DEV__) console.error('Sign up error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao criar conta');
    }
  }, []);

  const signUpDoctor = useCallback(async (data: DoctorSignUpData): Promise<{ user: UserDto; requiresApproval: boolean }> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/register-doctor', {
        name: data.name, email: data.email, password: data.password, confirmPassword: data.confirmPassword,
        phone: data.phone, cpf: data.cpf, crm: data.crm, crmState: data.crmState, specialty: data.specialty,
        birthDate: data.birthDate, bio: data.bio, street: data.street, number: data.number, neighborhood: data.neighborhood,
        complement: data.complement, city: data.city, state: data.state, postalCode: data.postalCode,
        professionalPhone: data.professionalPhone || undefined,
        professionalPostalCode: data.professionalPostalCode || undefined,
        professionalStreet: data.professionalStreet || undefined,
        professionalNumber: data.professionalNumber || undefined,
        professionalNeighborhood: data.professionalNeighborhood || undefined,
        professionalComplement: data.professionalComplement || undefined,
        professionalCity: data.professionalCity || undefined,
        professionalState: data.professionalState || undefined,
        university: data.university || undefined,
        courses: data.courses || undefined,
        hospitalsServices: data.hospitalsServices || undefined,
      });
      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      const requiresApproval = !response.token || response.token.trim() === '';
      if (!requiresApproval) {
        await setSecureItem(AUTH_TOKEN_KEY, response.token);
        apiClient.setTokenCache(response.token);
        await setItemSafe(USER_KEY, JSON.stringify(response.user));
        if (response.doctorProfile) {
          await setItemSafe(DOCTOR_PROFILE_KEY, JSON.stringify(response.doctorProfile));
          setDoctorProfile(response.doctorProfile);
        } else {
          await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
        }
        setUser(response.user);
      }
      return { user: response.user, requiresApproval };
    } catch (error: unknown) {
      if (__DEV__) console.error('Doctor sign up error:', error);
      const err = error as { message?: string; errors?: string[]; messages?: string[] };
      const msg = err?.message || (Array.isArray(err?.errors) ? err.errors[0] : null) || err?.messages?.[0] || 'Erro ao criar conta de médico';
      throw new Error(typeof msg === 'string' ? msg : 'Erro ao criar conta de médico');
    }
  }, []);

  const signInWithGoogle = useCallback(async (googleToken: string, role?: UserRole): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/google', { googleToken, role });
      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      if (response.token == null || response.token === '') throw new Error('Servidor não retornou token de acesso. Tente novamente.');
      await setSecureItem(AUTH_TOKEN_KEY, response.token);
      apiClient.setTokenCache(response.token);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));
      if (response.doctorProfile) {
        await setItemSafe(DOCTOR_PROFILE_KEY, JSON.stringify(response.doctorProfile));
        setDoctorProfile(response.doctorProfile);
      } else {
        await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
      }
      setUser(response.user);
      return response.user;
    } catch (error: unknown) {
      if (__DEV__) console.error('Google sign in error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao fazer login com Google');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch (error) {
      if (__DEV__) console.warn('Logout API error (local logout will continue):', error);
    }
    try {
      const pushToken = getLastRegisteredPushToken();
      if (pushToken) {
        await unregisterPushToken(pushToken);
        setLastRegisteredPushToken(null);
      }
    } catch {
      // Ignore — token pode já estar inválido
    }
    try {
      await clearAuth();
    } catch (e) {
      if (__DEV__) console.warn('clearAuth error:', e);
      setUser(null);
      setDoctorProfile(null);
    }
  }, [clearAuth]);

  const cancelRegistration = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/cancel-registration', {});
    } catch { /* ignore */ }
    await clearAuth();
  }, [clearAuth]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const refreshUser = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const currentUser = await apiClient.get<UserDto>('/api/auth/me');
      await setItemSafe(USER_KEY, currentUser ? JSON.stringify(currentUser) : undefined);
      setUser(currentUser);
    } catch (error) {
      if (__DEV__) console.error('Error refreshing user:', error);
      await clearAuth();
    }
  }, [clearAuth]);

  const refreshDoctorProfile = useCallback(async () => {
    if (user?.role !== 'doctor') return;
    try {
      const profile = await apiClient.get<DoctorProfileDto | null>('/api/doctors/me');
      if (profile) {
        await setItemSafe(DOCTOR_PROFILE_KEY, JSON.stringify(profile));
        setDoctorProfile(profile);
      }
    } catch (error) {
      if (__DEV__) console.error('Error refreshing doctor profile:', error);
    }
  }, [user?.role]);

  const completeProfile = useCallback(async (data: CompleteProfileData): Promise<UserDto> => {
    try {
      const updatedUser = await apiClient.patch<UserDto>('/api/auth/complete-profile', data);
      await setItemSafe(USER_KEY, updatedUser ? JSON.stringify(updatedUser) : undefined);
      setUser(updatedUser);
      return updatedUser;
    } catch (error: unknown) {
      if (__DEV__) console.error('Complete profile error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao completar perfil');
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await apiClient.post('/api/auth/forgot-password', { email });
    } catch (error: unknown) {
      if (__DEV__) console.error('Forgot password error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao solicitar recuperação de senha');
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      await apiClient.post('/api/auth/reset-password', { token, newPassword });
    } catch (error: unknown) {
      if (__DEV__) console.error('Reset password error:', error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message;
      throw new Error(msg || 'Erro ao redefinir senha');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    doctorProfile,
    loading,
    signIn,
    signUp,
    signUpDoctor,
    signInWithGoogle,
    signOut,
    cancelRegistration,
    refreshUser,
    refreshDoctorProfile,
    completeProfile,
    forgotPassword,
    resetPassword,
  }), [user, doctorProfile, loading, signIn, signUp, signUpDoctor, signInWithGoogle, signOut, cancelRegistration, refreshUser, refreshDoctorProfile, completeProfile, forgotPassword, resetPassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
