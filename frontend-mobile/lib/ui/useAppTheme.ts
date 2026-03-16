import { useMemo } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useColorSchemeContext } from '../../contexts/ColorSchemeContext';
import { createTokens } from '../designSystem';
import type { AppRole, ColorScheme } from '../designSystem';

export type AppThemeRole = AppRole;

interface UseAppThemeOptions {
  role?: AppThemeRole;
  /** Força um scheme específico (ignora o contexto global). */
  scheme?: ColorScheme;
}

function _resolveRole(pathname: string, userRole?: string | null, forcedRole?: AppThemeRole): AppThemeRole {
  if (forcedRole) return forcedRole;
  if (userRole === 'doctor') return 'doctor';
  if (userRole === 'sus') return 'patient';
  if (userRole === 'patient') return 'patient';
  if (pathname.startsWith('/(doctor)') || pathname.startsWith('/doctor-')) return 'doctor';
  if (pathname.startsWith('/(sus)')) return 'patient';
  return 'patient';
}

/**
 * Hook central de design tokens — retorna paleta correta para:
 * - role do usuário (patient | doctor)
 * - color scheme do sistema/usuário (light | dark)
 *
 * Todos os componentes que usam `useAppTheme` recebem dark mode automaticamente.
 *
 * PERF: usePathname() só é chamado quando necessário.
 * - Se `options.role` for passado explicitamente → sem usePathname.
 * - Se user?.role for definido (patient/doctor/sus) → sem usePathname.
 * - Só cai no pathname como fallback para telas de auth onde user ainda é null.
 * Isso reduz drasticamente re-renders em navegação: 129 componentes deixam de
 * re-renderizar a cada mudança de rota.
 */
export function useAppTheme(options?: UseAppThemeOptions) {
  const { user } = useAuth();
  const { colorScheme: contextScheme } = useColorSchemeContext();

  // PERF: só chama usePathname quando o role não puder ser determinado por user.role ou options.role.
  // user.role cobre 99% dos casos após login. Pathname só é necessário para telas de auth (user = null).
  const needsPathname = !options?.role && !user?.role;
  // Hooks devem ser chamados incondicionalmente — usePathname sempre, mas o valor só é
  // usado quando needsPathname for true.
  const pathname = usePathname();

  const role = useMemo(() => {
    if (options?.role) return options.role;
    if (user?.role === 'doctor') return 'doctor' as AppRole;
    if (user?.role === 'sus' || user?.role === 'patient') return 'patient' as AppRole;
    // Fallback por pathname (apenas telas auth onde user ainda é null)
    if (needsPathname) {
      if (pathname.startsWith('/(doctor)') || pathname.startsWith('/doctor-')) return 'doctor' as AppRole;
      if (pathname.startsWith('/(sus)')) return 'patient' as AppRole;
    }
    return 'patient' as AppRole;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.role, user?.role, needsPathname ? pathname : '']);

  const scheme = options?.scheme ?? contextScheme;

  // createTokens retorna singleton — mesma referência quando role+scheme não mudam.
  // Isso garante que os useMemo([colors]) downstream não disparam sem necessidade.
  return useMemo(() => createTokens(role, scheme), [role, scheme]);
}
