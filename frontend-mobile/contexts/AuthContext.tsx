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
  phone: string;
  cpf: string;
  birthDate?: string;
}

interface DoctorSignUpData {
  name: string;
  email: string;
  password: string;
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
  crm?: string;
  crmState?: string;
  specialty?: string;
  bio?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@renoveja:auth_token';
const USER_KEY = '@renoveja:user';
const DOCTOR_PROFILE_KEY = '@renoveja:doctor_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const storedDoctorProfile = await AsyncStorage.getItem(DOCTOR_PROFILE_KEY);

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const parsedDoctorProfile = storedDoctorProfile
          ? JSON.parse(storedDoctorProfile)
          : null;

        // Verify token is still valid by calling /api/auth/me
        try {
          const currentUser = await apiClient.get<UserDto>('/api/auth/me');
          setUser(currentUser);

          // If doctor, get doctor profile from stored data or fetch if needed
          if (currentUser.role === 'doctor' && parsedDoctorProfile) {
            setDoctorProfile(parsedDoctorProfile);
          }
        } catch (error) {
          // Token is invalid, clear auth
          await clearAuth();
        }
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/login', {
        email,
        password,
      });

      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

      if (response.doctorProfile) {
        await AsyncStorage.setItem(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
      }

      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  const signUp = async (data: SignUpData): Promise<UserDto> => {
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        cpf: data.cpf,
        birthDate: data.birthDate,
      });

      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Erro ao criar conta');
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
          phone: data.phone,
          cpf: data.cpf,
          crm: data.crm,
          crmState: data.crmState,
          specialty: data.specialty,
          birthDate: data.birthDate,
          bio: data.bio,
        }
      );

      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      if (response.doctorProfile) {
        await AsyncStorage.setItem(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
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

      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

      if (response.doctorProfile) {
        await AsyncStorage.setItem(
          DOCTOR_PROFILE_KEY,
          JSON.stringify(response.doctorProfile)
        );
        setDoctorProfile(response.doctorProfile);
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
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
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

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
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
