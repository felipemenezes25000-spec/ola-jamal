import { createContext } from 'react';
import type { DoctorUser, DoctorProfile } from '@/services/doctorApi';


export interface DoctorAuthState {
  user: DoctorUser | null;
  doctorProfile: DoctorProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  profileComplete: boolean;
  refreshUser: () => Promise<void>;
  setAuthFromLogin: (user: DoctorUser) => void;
  signOut: () => void;
}

export const DoctorAuthContext = createContext<DoctorAuthState | null>(null);
