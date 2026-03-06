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

function resolveRole(pathname: string, userRole?: string | null, forcedRole?: AppThemeRole): AppThemeRole {
  if (forcedRole) return forcedRole;
  if (userRole === 'doctor') return 'doctor';
  if (userRole === 'patient') return 'patient';
  if (pathname.startsWith('/(doctor)') || pathname.startsWith('/doctor-')) return 'doctor';
  return 'patient';
}

/**
 * Hook central de design tokens — retorna paleta correta para:
 * - role do usuário (patient | doctor)
 * - color scheme do sistema/usuário (light | dark)
 *
 * Todos os componentes que usam `useAppTheme` recebem dark mode automaticamente.
 * Telas com StyleSheet estático devem migrar gradualmente.
 */
export function useAppTheme(options?: UseAppThemeOptions) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { colorScheme: contextScheme } = useColorSchemeContext();

  const role = resolveRole(pathname ?? '', user?.role, options?.role);
  const scheme = options?.scheme ?? contextScheme;

  return useMemo(() => createTokens(role, scheme), [role, scheme]);
}
