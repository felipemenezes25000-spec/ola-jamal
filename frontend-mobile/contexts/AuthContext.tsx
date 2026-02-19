import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api-client';
import { UserDto, UserRole, AuthResponseDto, DoctorProfileDto } from '../types/database';

interface AuthContextType {
  user: UserDto | null;
  doctorProfile: DoctorProfileDto | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserDto>;
  signUp: (data: SignUpData) => Promise<UserDto>;
  signUpDoctor: (data: DoctorSignUpData) => Promise<UserDto>;
  signInWithGoogle: (googleToken: string, role?: UserRole) => Promise<UserDto>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeProfile: (data: CompleteProfileData) => Promise<UserDto>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

interface SignUpData {
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

interface DoctorSignUpData {
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

const TOKEN_KEY = '@renoveja:auth_token';
const USER_KEY = '@renoveja:user';
const DOCTOR_PROFILE_KEY = '@renoveja:doctor_profile';

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

  useEffect(() => {
    loadStoredUser();
  }, []);

  // Timeout de segurança: se após 2s ainda estiver loading, libera a tela (evita loading infinito)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading((prev) => (prev ? false : prev));
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const loadStoredUser = async () => {
    // Fallback: se AsyncStorage/rede travar, libera a tela em no máximo 2.5s
    const guard = setTimeout(() => setLoading(false), 2500);
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const storedDoctorProfile = await AsyncStorage.getItem(DOCTOR_PROFILE_KEY);

      if (storedToken && storedUser) {
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

        // Mostra o app na hora com usuário em cache; valida token em background
        clearTimeout(guard);
        setUser(parsedUser);
        if (parsedDoctorProfile) setDoctorProfile(parsedDoctorProfile);
        setLoading(false);

        // Valida token em background (sem travar a abertura). Se falhar, desloga.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
          const currentUser = await apiClient.get<UserDto>('/api/auth/me', undefined, {
            signal: controller.signal,
          });
          setUser(currentUser);
          if (currentUser.role === 'doctor' && parsedDoctorProfile) {
            setDoctorProfile(parsedDoctorProfile);
          }
        } catch {
          await clearAuth();
        } finally {
          clearTimeout(timeoutId);
        }
        return;
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
      await clearAuth();
    } finally {
      clearTimeout(guard);
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/login', {
        email,
        password,
      });

      if (!response?.user) {
        throw new Error('Resposta inválida do servidor. Tente novamente.');
      }
      if (response.token == null || response.token === '') {
        throw new Error('Servidor não retornou token de acesso. Tente novamente.');
      }

      await setItemSafe(TOKEN_KEY, response.token);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));

      if (response.doctorProfile) {
        await setItemSafe(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
      } else {
        await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
      }

      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error?.message || 'Erro ao fazer login');
    }
  };

  const signUp = async (data: SignUpData): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        phone: data.phone,
        cpf: data.cpf,
        birthDate: data.birthDate,
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        complement: data.complement,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
      });

      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      await setItemSafe(TOKEN_KEY, response.token ?? undefined);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error?.message || 'Erro ao criar conta');
    }
  };

  const signUpDoctor = async (data: DoctorSignUpData): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>(
        '/api/auth/register-doctor',
        {
          name: data.name,
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
          phone: data.phone,
          cpf: data.cpf,
          crm: data.crm,
          crmState: data.crmState,
          specialty: data.specialty,
          birthDate: data.birthDate,
          bio: data.bio,
        }
      );

      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      await setItemSafe(TOKEN_KEY, response.token ?? undefined);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));
      if (response.doctorProfile) {
        await setItemSafe(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
      } else {
        await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
      }
      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Doctor sign up error:', error);
      throw new Error(error.message || 'Erro ao criar conta de médico');
    }
  };

  const signInWithGoogle = async (googleToken: string, role?: UserRole): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/google', {
        googleToken,
        role,
      });

      if (!response?.user) throw new Error('Resposta inválida do servidor.');
      await setItemSafe(TOKEN_KEY, response.token ?? undefined);
      await setItemSafe(USER_KEY, JSON.stringify(response.user));

      if (response.doctorProfile) {
        await setItemSafe(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
      } else {
        await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
      }

      setUser(response.user);

      if (!response.profileComplete) {
        throw new Error('PROFILE_INCOMPLETE');
      }

      return response.user;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      if (error.message === 'PROFILE_INCOMPLETE') {
        throw error;
      }
      throw new Error(error.message || 'Erro ao fazer login com Google');
    }
  };

  const signOut = async () => {
    try {
      // Call logout endpoint
      await apiClient.post('/api/auth/logout', {});
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local cleanup even if API call fails
    } finally {
      await clearAuth();
    }
  };

  const refreshUser = async () => {
    if (!user) return;

    try {
      const currentUser = await apiClient.get<UserDto>('/api/auth/me');
      await setItemSafe(USER_KEY, currentUser ? JSON.stringify(currentUser) : undefined);
      setUser(currentUser);
    } catch (error) {
      console.error('Error refreshing user:', error);
      // If refresh fails, user might be logged out
      await clearAuth();
    }
  };

  const completeProfile = async (data: CompleteProfileData): Promise<UserDto> => {
    try {
      const updatedUser = await apiClient.patch<UserDto>(
        '/api/auth/complete-profile',
        data
      );

      await setItemSafe(USER_KEY, updatedUser ? JSON.stringify(updatedUser) : undefined);
      setUser(updatedUser);
      return updatedUser;
    } catch (error: any) {
      console.error('Complete profile error:', error);
      throw new Error(error.message || 'Erro ao completar perfil');
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      await apiClient.post('/api/auth/forgot-password', { email });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(error.message || 'Erro ao solicitar recuperação de senha');
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      await apiClient.post('/api/auth/reset-password', { token, newPassword });
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(error.message || 'Erro ao redefinir senha');
    }
  };

  const clearAuth = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(DOCTOR_PROFILE_KEY);
    setUser(null);
    setDoctorProfile(null);
  };

  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      clearAuth();
    });
    return () => apiClient.setOnUnauthorized(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        doctorProfile,
        loading,
        signIn,
        signUp,
        signUpDoctor,
        signInWithGoogle,
        signOut,
        refreshUser,
        completeProfile,
        forgotPassword,
        resetPassword,
      }}
    >
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
