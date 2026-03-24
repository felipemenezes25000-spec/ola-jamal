import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook que redireciona para login se o usuário não estiver autenticado.
 * Retorna `{ user, loading }` — renderize null/loading enquanto `loading` ou `!user`.
 *
 * @param requiredRole — se informado, redireciona se o role não bater.
 */
export function useRequireAuth(requiredRole?: 'doctor' | 'patient') {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.back();
    }
  }, [loading, user, requiredRole, router]);

  const ready = !loading && !!user && (!requiredRole || user.role === requiredRole);

  return { user, loading, ready };
}
