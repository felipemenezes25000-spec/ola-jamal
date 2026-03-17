import { useContext } from 'react';
import { DoctorAuthContext } from '@/contexts/doctor-auth-context';

export function useDoctorAuth() {
  const ctx = useContext(DoctorAuthContext);
  if (!ctx) throw new Error('useDoctorAuth must be inside DoctorAuthProvider');
  return ctx;
}
